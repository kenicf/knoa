/**
 * 統合マネージャー
 * 
 * タスク管理、セッション管理、フィードバック管理の3つの主要コンポーネントを統合し、
 * 一貫したワークフローを提供します。
 */

const { ValidationError, StateError, DataConsistencyError, LockTimeoutError } = require('./errors');

/**
 * 統合マネージャークラス
 */
class IntegrationManager {
  /**
   * コンストラクタ
   * @param {Object} taskManager - タスク管理アダプター（必須）
   * @param {Object} sessionManager - セッション管理アダプター（必須）
   * @param {Object} feedbackManager - フィードバック管理アダプター（必須）
   * @param {Object} stateManager - 状態管理（必須）
   * @param {Object} cacheManager - キャッシュ管理（必須）
   * @param {Object} eventEmitter - イベントエミッター（必須）
   * @param {Object} lockManager - ロック管理（必須）
   * @param {Object} logger - ロガー（必須）
   * @param {Object} pluginManager - プラグイン管理（必須）
   * @param {Object} validator - バリデーター（必須）
   * @param {Object} errorHandler - エラーハンドラー（必須）
   * @param {Object} options - 追加オプション
   * @param {number} options.syncInterval - 同期間隔（ミリ秒）
   */
  constructor(
    taskManager,
    sessionManager,
    feedbackManager,
    stateManager,
    cacheManager,
    eventEmitter,
    lockManager,
    logger,
    pluginManager,
    validator,
    errorHandler,
    options = {}
  ) {
    // 依存関係のバリデーション
    if (!taskManager) throw new Error('IntegrationManager requires a taskManager instance');
    if (!sessionManager) throw new Error('IntegrationManager requires a sessionManager instance');
    if (!feedbackManager) throw new Error('IntegrationManager requires a feedbackManager instance');
    if (!stateManager) throw new Error('IntegrationManager requires a stateManager instance');
    if (!cacheManager) throw new Error('IntegrationManager requires a cacheManager instance');
    if (!eventEmitter) throw new Error('IntegrationManager requires an eventEmitter instance');
    if (!lockManager) throw new Error('IntegrationManager requires a lockManager instance');
    if (!logger) throw new Error('IntegrationManager requires a logger instance');
    if (!pluginManager) throw new Error('IntegrationManager requires a pluginManager instance');
    if (!validator) throw new Error('IntegrationManager requires a validator instance');
    if (!errorHandler) throw new Error('IntegrationManager requires an errorHandler instance');
    
    // 依存関係の設定
    this.taskManager = taskManager;
    this.sessionManager = sessionManager;
    this.feedbackManager = feedbackManager;
    this.stateManager = stateManager;
    this.cacheManager = cacheManager;
    this.eventEmitter = eventEmitter;
    this.lockManager = lockManager;
    this.logger = logger;
    this.pluginManager = pluginManager;
    this.validator = validator;
    this.errorHandler = errorHandler;
    
    // オプションの設定
    this.syncInterval = options.syncInterval || 60000; // デフォルト1分
    
    // イベントリスナーの登録
    this._registerEventListeners();
    
    // コンポーネント間のデータ整合性を確保するための定期同期
    this._startPeriodicSync(this.syncInterval);
    
    this.logger.info('統合マネージャーが初期化されました');
  }
  
  /**
   * ワークフローを初期化
   * @param {string} projectId - プロジェクトID
   * @param {string} originalRequest - 元のリクエスト
   * @returns {Promise<Object>} 初期化されたワークフロー情報
   */
  async initializeWorkflow(projectId, originalRequest) {
    this.logger.info('ワークフローの初期化を開始します', { projectId, originalRequest });
    
    try {
      // 入力検証
      if (!projectId || typeof projectId !== 'string') {
        throw new ValidationError('プロジェクトIDは必須の文字列です');
      }
      
      if (!originalRequest || typeof originalRequest !== 'string') {
        throw new ValidationError('元のリクエストは必須の文字列です');
      }
      
      // ロックの取得
      await this.lockManager.acquireLock('workflow', 'initialization');
      
      // 状態の検証
      if (this.stateManager.getCurrentState() !== this.stateManager.states.UNINITIALIZED &&
          this.stateManager.getCurrentState() !== this.stateManager.states.SESSION_ENDED) {
        throw new StateError('ワークフローの初期化は未初期化または終了済み状態でのみ可能です');
      }
      
      // タスク管理の初期化
      const taskData = {
        project: projectId,
        original_request: originalRequest,
        task_hierarchy: {
          epics: [],
          stories: []
        },
        decomposed_tasks: [],
        current_focus: null
      };
      
      // タスクの作成
      const task = await this.taskManager.createTask(taskData);
      
      // 状態の更新
      this.stateManager.transitionTo(this.stateManager.states.INITIALIZED, {
        projectId,
        originalRequest,
        taskId: task.id
      });
      
      // イベントの発行
      this.eventEmitter.emit('workflow:initialized', {
        projectId,
        originalRequest,
        taskId: task.id,
        timestamp: new Date().toISOString()
      });
      
      // キャッシュの更新
      this.cacheManager.set('current_project', projectId);
      this.cacheManager.set('original_request', originalRequest);
      
      // ロックの解放
      await this.lockManager.releaseLock('workflow', 'initialization');
      
      return {
        projectId,
        originalRequest,
        taskId: task.id,
        status: 'initialized',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      // エラーハンドリング
      this.errorHandler.handle(error, 'IntegrationManager', 'initializeWorkflow');
      
      // ロックの解放（エラー時も）
      try {
        await this.lockManager.releaseLock('workflow', 'initialization');
      } catch (lockError) {
        this.logger.error('ロックの解放に失敗しました', { error: lockError });
      }
      
      throw error;
    }
  }
  
  /**
   * セッションを開始
   * @param {string} previousSessionId - 前回のセッションID（オプション）
   * @returns {Promise<Object>} セッション情報
   */
  async startSession(previousSessionId = null) {
    this.logger.info('セッションの開始を開始します', { previousSessionId });
    
    try {
      // ロックの取得
      await this.lockManager.acquireLock('session', 'start');
      
      // 状態の検証
      if (this.stateManager.getCurrentState() !== this.stateManager.states.INITIALIZED &&
          this.stateManager.getCurrentState() !== this.stateManager.states.SESSION_ENDED) {
        throw new StateError('セッションの開始は初期化済みまたはセッション終了状態でのみ可能です');
      }
      
      // セッションの作成
      const session = await this.sessionManager.createNewSession(previousSessionId);
      
      // 状態の更新
      this.stateManager.transitionTo(this.stateManager.states.SESSION_STARTED, {
        sessionId: session.session_id,
        previousSessionId
      });
      
      // イベントの発行
      this.eventEmitter.emit('session:started', {
        sessionId: session.session_id,
        previousSessionId,
        timestamp: new Date().toISOString()
      });
      
      // キャッシュの更新
      this.cacheManager.set('current_session', session.session_id);
      
      // ロックの解放
      await this.lockManager.releaseLock('session', 'start');
      
      return {
        sessionId: session.session_id,
        previousSessionId,
        status: 'started',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      // エラーハンドリング
      this.errorHandler.handle(error, 'IntegrationManager', 'startSession');
      
      // ロックの解放（エラー時も）
      try {
        await this.lockManager.releaseLock('session', 'start');
      } catch (lockError) {
        this.logger.error('ロックの解放に失敗しました', { error: lockError });
      }
      
      throw error;
    }
  }
  
  /**
   * イベントリスナーを登録
   * @private
   */
  _registerEventListeners() {
    // タスク関連イベント
    this.eventEmitter.on('task:created', (data) => {
      this.logger.info('タスクが作成されました', data);
    });
    
    this.eventEmitter.on('task:updated', (data) => {
      this.logger.info('タスクが更新されました', data);
    });
    
    // セッション関連イベント
    this.eventEmitter.on('session:started', (data) => {
      this.logger.info('セッションが開始されました', data);
    });
    
    this.eventEmitter.on('session:ended', (data) => {
      this.logger.info('セッションが終了しました', data);
    });
    
    // フィードバック関連イベント
    this.eventEmitter.on('feedback:collected', (data) => {
      this.logger.info('フィードバックが収集されました', data);
    });
    
    this.eventEmitter.on('feedback:resolved', (data) => {
      this.logger.info('フィードバックが解決されました', data);
    });
    
    // エラー関連イベント
    this.eventEmitter.on('error', (data) => {
      this.logger.error('エラーが発生しました', data);
    });
  }
  
  /**
   * 定期同期を開始
   * @param {number} interval - 同期間隔（ミリ秒）
   * @private
   */
  _startPeriodicSync(interval) {
    setInterval(() => {
      this._syncComponents().catch(error => {
        this.logger.error('定期同期中にエラーが発生しました', { error });
      });
    }, interval);
  }
  
  /**
   * コンポーネント間の同期を実行
   * @returns {Promise<void>}
   * @private
   */
  async _syncComponents() {
    try {
      this.logger.debug('コンポーネント間の同期を開始します');
      
      // 現在のプロジェクトとセッションを取得
      const currentProject = this.cacheManager.get('current_project');
      const currentSession = this.cacheManager.get('current_session');
      
      if (!currentProject || !currentSession) {
        this.logger.debug('同期をスキップします: プロジェクトまたはセッションが存在しません');
        return;
      }
      
      // タスクの同期
      const tasks = await this.taskManager.getAllTasks();
      
      // セッションの同期
      const session = await this.sessionManager.getSessionById(currentSession);
      
      // フィードバックの同期
      const feedbacks = await this.feedbackManager.getPendingFeedback();
      
      this.logger.debug('コンポーネント間の同期が完了しました', {
        tasksCount: tasks.length,
        sessionId: session?.session_id,
        feedbacksCount: feedbacks.length
      });
    } catch (error) {
      this.errorHandler.handle(error, 'IntegrationManager', '_syncComponents');
    }
  }
}

module.exports = { IntegrationManager };

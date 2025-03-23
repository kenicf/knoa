/**
 * 統合マネージャー
 * 
 * タスク管理、セッション管理、フィードバック管理の3つの主要コンポーネントを統合し、
 * 一貫したワークフローを提供します。
 */

const { ValidationError, StateError, DataConsistencyError, LockTimeoutError } = require('../../lib/utils/errors');

/**
 * 統合マネージャークラス
 */
class IntegrationManager {
  /**
   * コンストラクタ
   * @param {Object} options - オプションオブジェクト
   * @param {Object} options.taskManager - タスク管理アダプター（必須）
   * @param {Object} options.sessionManager - セッション管理アダプター（必須）
   * @param {Object} options.feedbackManager - フィードバック管理アダプター（必須）
   * @param {Object} options.stateManager - 状態管理（必須）
   * @param {Object} options.cacheManager - キャッシュ管理
   * @param {Object} options.eventEmitter - イベントエミッター
   * @param {Object} options.lockManager - ロック管理
   * @param {Object} options.logger - ロガー
   * @param {Object} options.pluginManager - プラグイン管理
   * @param {Object} options.validator - バリデーター
   * @param {Object} options.errorHandler - エラーハンドラー
   * @param {Object} options.config - 設定オプション
   * @param {number} options.config.syncInterval - 同期間隔（ミリ秒）
   * @param {boolean} options.config.enablePeriodicSync - 定期同期を有効にするかどうか
   */
  constructor(options = {}) {
    // 必須依存関係の検証
    if (!options.taskManager) throw new Error('IntegrationManager requires a taskManager instance');
    if (!options.sessionManager) throw new Error('IntegrationManager requires a sessionManager instance');
    if (!options.feedbackManager) throw new Error('IntegrationManager requires a feedbackManager instance');
    if (!options.stateManager) throw new Error('IntegrationManager requires a stateManager instance');
    
    // 依存関係の設定
    this.taskManager = options.taskManager;
    this.sessionManager = options.sessionManager;
    this.feedbackManager = options.feedbackManager;
    this.stateManager = options.stateManager;
    this.cacheManager = options.cacheManager;
    this.eventEmitter = options.eventEmitter;
    this.lockManager = options.lockManager;
    this.logger = options.logger || console;
    this.pluginManager = options.pluginManager;
    this.validator = options.validator;
    this.errorHandler = options.errorHandler;
    
    // 設定オプションの設定
    this.config = options.config || {};
    this.syncInterval = this.config.syncInterval || 60000; // デフォルト1分
    this.enablePeriodicSync = this.config.enablePeriodicSync !== undefined ? 
                             this.config.enablePeriodicSync : true; // デフォルトは有効
    
    // 同期タイマーの初期化
    this.syncTimer = null;
    
    // イベントリスナーの登録
    if (this.eventEmitter) {
      this._registerEventListeners();
    }
    
    // コンポーネント間のデータ整合性を確保するための定期同期
    // テストモードでは定期同期を無効化
    if (this.enablePeriodicSync && this.cacheManager && this.lockManager && process.env.NODE_ENV !== 'test') {
      this._startPeriodicSync(this.syncInterval);
    } else {
      this.logger.info('定期同期は無効化されています');
    }
    
    this.logger.info('統合マネージャーが初期化されました');
    
    // イベントエミッターが存在する場合はイベントを発行
    if (this.eventEmitter) {
      // トレースIDとリクエストIDの生成
      const traceId = `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // 標準化されたイベント発行
      if (typeof this.eventEmitter.emitStandardized === 'function') {
        this.eventEmitter.emitStandardized('integration', 'system_initialized', {
          syncInterval: this.syncInterval,
          enablePeriodicSync: this.enablePeriodicSync,
          timestamp: new Date().toISOString(),
          traceId,
          requestId,
          component: 'integration'
        });
      } else {
        // 後方互換性のため
        this.eventEmitter.emit('integration:manager:initialized', {
          syncInterval: this.syncInterval,
          enablePeriodicSync: this.enablePeriodicSync,
          timestamp: new Date().toISOString(),
          traceId,
          requestId
        });
        
        // 開発環境では警告を表示
        if (process.env.NODE_ENV === 'development') {
          console.warn('非推奨のイベント名 integration:manager:initialized が使用されています。代わりに integration:system_initialized を使用してください。');
        }
      }
    }
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
      let lock = null;
      if (this.lockManager) {
        const lockId = `workflow:${projectId}`;
        lock = await this.lockManager.acquire(lockId, 10000); // 10秒のタイムアウト
      }
      
      try {
        // プロジェクト情報の作成
        const projectInfo = {
          id: projectId,
          original_request: originalRequest,
          created_at: new Date().toISOString()
        };
        
        // タスクの初期化
        const tasks = await this.taskManager.initializeTasks(projectInfo);
        
        // 新しいセッションの作成
        const session = await this.sessionManager.createNewSession();
        
        // 状態の更新
        this.stateManager.setState('workflow', 'initialized');
        
        // イベントの発行
        if (this.eventEmitter) {
          // トレースIDとリクエストIDの生成
          const traceId = `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          // 標準化されたイベント発行
          if (typeof this.eventEmitter.emitStandardized === 'function') {
            this.eventEmitter.emitStandardized('integration', 'workflow_initialized', {
              projectId,
              sessionId: session.session_handover.session_id,
              taskCount: tasks.tasks.length,
              timestamp: new Date().toISOString(),
              traceId,
              requestId,
              component: 'integration'
            });
          } else {
            // 後方互換性のため
            this.eventEmitter.emit('workflow:initialized', {
              projectId,
              sessionId: session.session_handover.session_id,
              taskCount: tasks.tasks.length,
              timestamp: new Date().toISOString(),
              traceId,
              requestId
            });
            
            // 開発環境では警告を表示
            if (process.env.NODE_ENV === 'development') {
              console.warn('非推奨のイベント名 workflow:initialized が使用されています。代わりに integration:workflow_initialized を使用してください。');
            }
          }
        }
        
        return {
          project: projectInfo,
          session: session,
          tasks: tasks,
          state: this.stateManager.getState('workflow')
        };
      } finally {
        // ロックの解放
        if (lock) {
          await lock.release();
        }
      }
    } catch (error) {
      if (this.errorHandler) {
        return this.errorHandler.handle(error, 'IntegrationManager', 'initializeWorkflow', { projectId, originalRequest });
      } else {
        this.logger.error('ワークフローの初期化に失敗しました:', error);
        throw error;
      }
    }
  }
  
  /**
   * 新しいセッションを開始
   * @returns {Promise<Object>} 新しいセッション
   */
  async startNewSession() {
    try {
      // 最新のセッションを取得
      const latestSession = await this.sessionManager.getLatestSession();
      const previousSessionId = latestSession ? latestSession.session_handover.session_id : null;
      
      // 新しいセッションを作成
      const newSession = await this.sessionManager.createNewSession(previousSessionId);
      
      // 状態の更新
      this.stateManager.setState('session', 'started');
      
      // イベントの発行
      if (this.eventEmitter) {
        // トレースIDとリクエストIDの生成
        const traceId = `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // 標準化されたイベント発行
        if (typeof this.eventEmitter.emitStandardized === 'function') {
          this.eventEmitter.emitStandardized('session', 'session_started', {
            sessionId: newSession.session_handover.session_id,
            previousSessionId,
            timestamp: new Date().toISOString(),
            traceId,
            requestId,
            component: 'integration'
          });
        } else {
          // 後方互換性のため
          this.eventEmitter.emit('session:started', {
            sessionId: newSession.session_handover.session_id,
            previousSessionId,
            timestamp: new Date().toISOString(),
            traceId,
            requestId
          });
          
          // 開発環境では警告を表示
          if (process.env.NODE_ENV === 'development') {
            console.warn('非推奨のイベント名 session:started が使用されています。代わりに session:session_started を使用してください。');
          }
        }
      }
      
      return newSession;
    } catch (error) {
      if (this.errorHandler) {
        return this.errorHandler.handle(error, 'IntegrationManager', 'startNewSession');
      } else {
        this.logger.error('新しいセッションの開始に失敗しました:', error);
        throw error;
      }
    }
  }
  
  /**
   * 定期同期を停止
   * @returns {boolean} 停止結果
   */
  stopPeriodicSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      this.logger.info('定期同期を停止しました');
      return true;
    }
    return false;
  }
  
  /**
   * 定期同期を開始
   * @param {number} interval - 同期間隔（ミリ秒）
   * @returns {boolean} 開始結果
   */
  startPeriodicSync(interval) {
    // 既存のタイマーがあれば停止
    this.stopPeriodicSync();
    
    // 必要な依存関係がなければ開始しない
    if (!this.cacheManager || !this.lockManager) {
      this.logger.warn('定期同期の開始に必要な依存関係がありません');
      return false;
    }
    
    // 新しいタイマーを設定
    this._startPeriodicSync(interval || this.syncInterval);
    return true;
  }
  
  /**
   * イベントリスナーを登録
   * @private
   */
  _registerEventListeners() {
    // タスク関連イベント
    this.eventEmitter.on('task:created', (data) => {
      this.logger.debug('タスク作成イベントを受信しました', data);
      // 処理...
    });
    
    // セッション関連イベント
    this.eventEmitter.on('session:created', (data) => {
      this.logger.debug('セッション作成イベントを受信しました', data);
      // 処理...
    });
    
    // フィードバック関連イベント
    this.eventEmitter.on('feedback:created', (data) => {
      this.logger.debug('フィードバック作成イベントを受信しました', data);
      // 処理...
    });
    
    // エラーイベント
    this.eventEmitter.on('error', (data) => {
      this.logger.error('エラーイベントを受信しました', data);
      // 処理...
    });
  }
  
  /**
   * 定期同期を開始
   * @param {number} interval - 同期間隔（ミリ秒）
   * @private
   */
  _startPeriodicSync(interval) {
    this.syncTimer = setInterval(() => {
      this._syncComponents().catch(error => {
        // エラーの詳細情報をログに出力
        this.logger.error('コンポーネント同期中にエラーが発生しました:', {
          errorMessage: error.message,
          errorName: error.name,
          errorStack: error.stack,
          errorContext: error.context || {},
          errorCode: error.code
        });
      });
    }, interval);
    
    this.logger.info(`定期同期を開始しました（間隔: ${interval}ms）`);
  }
  
  /**
   * コンポーネント間の同期を実行
   * @returns {Promise<void>}
   * @private
   */
  async _syncComponents() {
    this.logger.debug('コンポーネント同期を開始します');
    
    try {
      // 依存関係の状態をログに出力
      this.logger.debug('依存関係の状態:', {
        hasCacheManager: !!this.cacheManager,
        hasLockManager: !!this.lockManager,
        hasTaskManager: !!this.taskManager,
        hasSessionManager: !!this.sessionManager,
        hasFeedbackManager: !!this.feedbackManager
      });

      // 必要な依存関係がなければ同期しない
      if (!this.cacheManager || !this.lockManager) {
        throw new Error('同期に必要な依存関係がありません');
      }
      
      // ロックの取得
      this.logger.debug('ロックの取得を試みます: sync:components');
      const lockerId = 'integration-manager';
      const lockAcquired = await this.lockManager.acquireLock('sync:components', lockerId, 5000);
      this.logger.debug('ロックの取得に成功しました: sync:components');
      
      try {
        // タスクの同期
        this.logger.debug('タスクの同期を開始します');
        const tasks = await this.taskManager.getAllTasks();
        this.cacheManager.set('tasks', tasks);
        this.logger.debug('タスクの同期が完了しました');
        
        // セッションの同期
        this.logger.debug('セッションの同期を開始します');
        const latestSession = await this.sessionManager.getLatestSession();
        if (latestSession) {
          this.cacheManager.set('latest-session', latestSession);
          this.logger.debug('最新セッションをキャッシュに設定しました');
        } else {
          this.logger.debug('最新セッションが見つかりませんでした');
        }
        
        // フィードバックの同期
        this.logger.debug('フィードバックの同期を開始します');
        const pendingFeedback = await this.feedbackManager.getPendingFeedback();
        if (pendingFeedback) {
          this.cacheManager.set('pending-feedback', pendingFeedback);
          this.logger.debug('保留中のフィードバックをキャッシュに設定しました');
        } else {
          this.logger.debug('保留中のフィードバックが見つかりませんでした');
        }
        
        this.logger.debug('コンポーネント同期が完了しました');
      } finally {
        // ロックの解放
        this.logger.debug('ロックの解放を試みます: sync:components');
        await this.lockManager.releaseLock('sync:components', lockerId);
        this.logger.debug('ロックの解放に成功しました: sync:components');
      }
    } catch (error) {
      if (error instanceof LockTimeoutError) {
        this.logger.warn('同期ロックの取得がタイムアウトしました');
      } else {
        // エラーの詳細情報をログに出力
        this.logger.error('コンポーネント同期中にエラーが発生しました:', {
          errorMessage: error.message,
          errorName: error.name,
          errorStack: error.stack,
          errorContext: error.context || {},
          errorCode: error.code
        });
        throw error;
      }
    }
  }
}

module.exports = IntegrationManager;
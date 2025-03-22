/**
 * 統合マネージャー
 * 
 * タスク管理、セッション管理、フィードバック管理の3つの主要コンポーネントを統合し、
 * 一貫したワークフローを提供します。
 */

// 必要なモジュールのインポート
const TaskManagerAdapter = require('./adapters/task-manager-adapter');
const SessionManagerAdapter = require('./adapters/session-manager-adapter');
const FeedbackManagerAdapter = require('./adapters/feedback-manager-adapter');
const StateManager = require('./state-manager');
const CacheManager = require('./cache-manager');
const EventEmitter = require('./event-emitter');
const LockManager = require('./lock-manager');
const Logger = require('./logger');
const PluginManager = require('./plugin-manager');
const Validator = require('./validator');
const { ValidationError, StateError, DataConsistencyError, LockTimeoutError } = require('./errors');

/**
 * 統合マネージャークラス
 */
class IntegrationManager {
  /**
   * コンストラクタ
   * @param {Object} options - オプション
   */
  constructor(options = {}) {
    // 各コンポーネントのインスタンス化
    const taskManager = require('../utils/task-manager');
    this.taskManager = new TaskManagerAdapter(
      options.taskManager || taskManager
    );
    
    const sessionManager = require('../utils/session-manager');
    this.sessionManager = new SessionManagerAdapter(
      options.sessionManager || sessionManager
    );
    
    const feedbackManager = require('../utils/feedback-manager');
    this.feedbackManager = new FeedbackManagerAdapter(
      options.feedbackManager || feedbackManager
    );
    
    // 状態管理
    this.stateManager = new StateManager(options.stateConfig);
    
    // キャッシュ管理
    this.cacheManager = new CacheManager(options.cacheConfig);
    
    // イベント管理
    this.eventEmitter = new EventEmitter();
    
    // ロック管理
    this.lockManager = new LockManager(options.lockConfig);
    
    // ロガー
    this.logger = new Logger(options.loggerConfig);
    
    // プラグイン管理
    this.pluginManager = new PluginManager({
      logger: this.logger
    });
    
    // イベントリスナーの登録
    this._registerEventListeners();
    
    // コンポーネント間のデータ整合性を確保するための定期同期
    this._startPeriodicSync(options.syncInterval || 60000); // デフォルト1分
    
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
      
      // プロジェクト情報の初期化
      const projectInfo = {
        project: projectId,
        original_request: originalRequest,
        task_hierarchy: {
          epics: [],
          stories: []
        },
        decomposed_tasks: [],
        current_focus: null
      };
      
      // トランザクション実行
      await this._executeTransaction([
        {
          execute: async () => {
            return await this.taskManager.initializeTasks(projectInfo);
          },
          rollback: async () => {
            this.logger.info('タスク初期化のロールバックを実行します');
            // ロールバック処理
          }
        }
      ]);
      
      // 状態遷移
      this.stateManager.transitionTo(this.stateManager.states.INITIALIZED, {
        projectId,
        timestamp: new Date().toISOString()
      });
      
      // イベント発行
      this.eventEmitter.emit('workflow:initialized', {
        projectId,
        timestamp: new Date().toISOString()
      });
      
      // ワークフロー状態の記録
      this._logActivity({
        type: 'workflow_initialized',
        timestamp: new Date().toISOString(),
        project_id: projectId,
        details: { original_request: originalRequest }
      });
      
      return projectInfo;
    } catch (error) {
      return this.handleError(error, 'workflow_initialization');
    } finally {
      // ロックの解放
      this.lockManager.releaseLock('workflow', 'initialization');
    }
  }
  
  /**
   * トランザクション実行
   * @param {Array<Function>} operations - 実行する操作の配列
   * @returns {Promise<Array>} 各操作の結果
   * @private
   */
  async _executeTransaction(operations) {
    // 操作結果を保存する配列
    const results = [];
    
    // ロールバック操作
    const rollbackOperations = [];
  
    try {
      // 各操作を順番に実行
      for (let i = 0; i < operations.length; i++) {
        const operation = operations[i];
        
        // 操作を実行
        const result = await operation.execute();
        results.push(result);
        
        // ロールバック操作を登録（実行とは逆順）
        if (operation.rollback) {
          rollbackOperations.unshift({
            execute: () => operation.rollback(result)
          });
        }
      }
      
      // すべての操作が成功した場合
      return results;
    } catch (error) {
      // エラーが発生した場合、ロールバック操作を実行
      this.logger.error('トランザクション実行中にエラーが発生しました。ロールバックを実行します:', error);
      
      for (const rollbackOperation of rollbackOperations) {
        try {
          await rollbackOperation.execute();
        } catch (rollbackError) {
          this.logger.error('ロールバック実行中にエラーが発生しました:', rollbackError);
        }
      }
      
      throw error;
    }
  }
  
  /**
   * イベントリスナーを登録
   * @private
   */
  _registerEventListeners() {
    // ワークフロー状態変更のリスナー
    this.stateManager.registerStateChangeListener((prevState, newState, metadata) => {
      this.logger.info(`ワークフロー状態が変更されました: ${prevState} -> ${newState}`, metadata);
      
      // キャッシュの無効化
      this.cacheManager.invalidate(`state:${prevState}`);
      
      // コンポーネント間の同期
      if (newState === this.stateManager.states.SESSION_STARTED || 
          newState === this.stateManager.states.SESSION_ENDED) {
        this.syncComponents().catch(error => {
          this.logger.error('状態変更後の同期中にエラーが発生しました:', error);
        });
      }
    });
    
    // エラーイベントのリスナー
    this.eventEmitter.on('error', (data) => {
      // 重大なエラーの場合は通知
      if (data.error instanceof StateError || 
          data.error instanceof ValidationError || 
          data.error instanceof DataConsistencyError) {
        this._notifyAdmin(data);
      }
    });
  }
  
  /**
   * 定期的な同期を開始
   * @param {number} interval - 同期間隔(ms)
   * @private
   */
  _startPeriodicSync(interval) {
    setInterval(() => {
      if (this.stateManager.getCurrentState() !== this.stateManager.states.UNINITIALIZED) {
        this.syncComponents().catch(error => {
          this.logger.error('定期同期中にエラーが発生しました:', error);
        });
      }
    }, interval);
  }
  
  /**
   * 管理者に通知
   * @param {Object} data - 通知データ
   * @private
   */
  _notifyAdmin(data) {
    // 管理者通知ロジック
    if (this.pluginManager.hasPlugin('notification')) {
      this.pluginManager.invokePlugin('notification', 'sendNotification', {
        level: 'error',
        title: `[${data.component}] エラーが発生しました`,
        message: data.error.message,
        details: data
      }).catch(error => {
        this.logger.error('通知送信中にエラーが発生しました:', error);
      });
    }
  }
  
  /**
   * アクティビティをログに記録
   * @param {Object} activity - アクティビティ情報
   * @private
   */
  _logActivity(activity) {
    try {
      const fs = require('fs');
      const path = require('path');
      const activityLogPath = path.join(process.cwd(), 'ai-context', 'logs', 'activity-log.json');
      
      // ディレクトリが存在しない場合は作成
      const logsDir = path.join(process.cwd(), 'ai-context', 'logs');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      
      // 既存のログを読み込む
      let activityLog = [];
      if (fs.existsSync(activityLogPath)) {
        const logData = fs.readFileSync(activityLogPath, 'utf8');
        activityLog = JSON.parse(logData);
      }
      
      // 新しいアクティビティを追加
      activityLog.push(activity);
      
      // ログを保存
      fs.writeFileSync(activityLogPath, JSON.stringify(activityLog, null, 2), 'utf8');
    } catch (error) {
      this.logger.error('アクティビティのログ記録に失敗しました:', error);
    }
  }

  /**
   * セッションを開始
   * @param {string} previousSessionId - 前回のセッションID
   * @returns {Promise<Object>} セッション情報
   */
  async startSession(previousSessionId = null) {
    this.logger.info('セッション開始処理を開始します', { previousSessionId });
    
    try {
      // 状態検証
      if (!this.stateManager.canTransitionTo(this.stateManager.states.SESSION_STARTED)) {
        throw new StateError(
          `現在の状態 ${this.stateManager.getCurrentState()} からセッション開始状態への遷移は許可されていません`
        );
      }
      
      // ロックの取得
      await this.lockManager.acquireLock('session', 'start');
      
      // キャッシュ確認
      const cacheKey = `session:start:${previousSessionId || 'new'}`;
      const cachedSession = this.cacheManager.get(cacheKey);
      if (cachedSession) {
        this.logger.debug('キャッシュからセッション情報を取得しました', { sessionId: cachedSession.session_id });
        return cachedSession;
      }
      
      // トランザクション実行
      const results = await this._executeTransaction([
        {
          // 新しいセッションの作成
          execute: async () => {
            return await this.sessionManager.createNewSession(previousSessionId);
          },
          rollback: async (session) => {
            if (session && session.session_id) {
              this.logger.info(`セッション ${session.session_id} 作成のロールバックを実行します`);
              // ロールバック処理
            }
          }
        },
        {
          // 現在のタスク状態をセッションに反映
          execute: async (session) => {
            const tasks = await this.taskManager.getAllTasks();
            const projectStateSummary = {
              completed_tasks: tasks.decomposed_tasks.filter(t => t.status === 'completed').map(t => t.id),
              current_tasks: tasks.decomposed_tasks.filter(t => t.status === 'in_progress').map(t => t.id),
              pending_tasks: tasks.decomposed_tasks.filter(t => t.status === 'pending').map(t => t.id),
              blocked_tasks: tasks.decomposed_tasks.filter(t => t.status === 'blocked').map(t => t.id)
            };
            
            await this.sessionManager.updateSession(session.session_id, {
              project_state_summary: projectStateSummary
            });
            
            return { session, tasks };
          }
        },
        {
          // 現在のフォーカスタスクをセッションに反映
          execute: async (data) => {
            if (data.tasks.current_focus) {
              await this.sessionManager.updateSession(data.session.session_id, {
                next_session_focus: data.tasks.current_focus
              });
            }
            
            return data.session;
          }
        }
      ]);
      
      const session = results[results.length - 1];
      
      // 状態遷移
      this.stateManager.transitionTo(this.stateManager.states.SESSION_STARTED, {
        sessionId: session.session_id,
        timestamp: new Date().toISOString()
      });
      
      // イベント発行
      this.eventEmitter.emit('session:started', {
        sessionId: session.session_id,
        previousSessionId,
        timestamp: new Date().toISOString()
      });
      
      // ワークフロー状態の記録
      this._logActivity({
        type: 'session_started',
        timestamp: new Date().toISOString(),
        session_id: session.session_id,
        details: { previous_session_id: previousSessionId }
      });
      
      // キャッシュ保存
      this.cacheManager.set(cacheKey, session, 60000); // 1分間有効
      
      return session;
    } catch (error) {
      return this.handleError(error, 'session_start');
    } finally {
      // ロックの解放
      this.lockManager.releaseLock('session', 'start');
    }
  }
  
  /**
   * セッションを終了
   * @param {string} sessionId - セッションID
   * @returns {Promise<Object>} 終了結果
   */
  async endSession(sessionId) {
    this.logger.info('セッション終了処理を開始します', { sessionId });
    
    try {
      // 入力検証
      if (!sessionId || typeof sessionId !== 'string') {
        throw new ValidationError('セッションIDは必須の文字列です');
      }
      
      // 状態検証
      if (!this.stateManager.canTransitionTo(this.stateManager.states.SESSION_ENDED)) {
        throw new StateError(
          `現在の状態 ${this.stateManager.getCurrentState()} からセッション終了状態への遷移は許可されていません`
        );
      }
      
      // ロックの取得
      await this.lockManager.acquireLock('session', 'end');
      
      // セッションの取得
      const session = await this.sessionManager.getSessionById(sessionId);
      if (!session) {
        throw new Error(`セッション ${sessionId} が見つかりません`);
      }
      
      // コンポーネント間の同期
      await this.syncComponents();
      
      // 引継ぎドキュメントの生成
      const handoverDocument = await this.sessionManager.generateSessionHandoverMarkdown(sessionId);
      
      // 状態遷移
      this.stateManager.transitionTo(this.stateManager.states.SESSION_ENDED, {
        sessionId,
        timestamp: new Date().toISOString()
      });
      
      // イベント発行
      this.eventEmitter.emit('session:ended', {
        sessionId,
        timestamp: new Date().toISOString()
      });
      
      // ワークフロー状態の記録
      this._logActivity({
        type: 'session_ended',
        timestamp: new Date().toISOString(),
        session_id: sessionId
      });
      
      // キャッシュの無効化
      this.cacheManager.invalidate(`session:${sessionId}`);
      
      return {
        session_id: sessionId,
        handover_document: handoverDocument
      };
    } catch (error) {
      return this.handleError(error, 'session_end');
    } finally {
      // ロックの解放
      this.lockManager.releaseLock('session', 'end');
    }
  }
  
  /**
   * タスクを作成
   * @param {Object} taskData - タスクデータ
   * @returns {Promise<Object>} 作成されたタスク
   */
  async createTask(taskData) {
    this.logger.info('タスク作成処理を開始します', { taskData });
    
    try {
      // 入力検証
      const validation = Validator.validateTaskInput(taskData);
      if (!validation.isValid) {
        throw new ValidationError(validation.errors.join(', '));
      }
      
      // ロックの取得
      await this.lockManager.acquireLock('task', 'create');
      
      // 状態検証
      if (this.stateManager.getCurrentState() !== this.stateManager.states.SESSION_STARTED &&
          this.stateManager.getCurrentState() !== this.stateManager.states.TASK_IN_PROGRESS &&
          this.stateManager.getCurrentState() !== this.stateManager.states.FEEDBACK_COLLECTED) {
        throw new StateError('タスクの作成はセッション開始後のみ可能です');
      }
      
      // トランザクション実行
      const results = await this._executeTransaction([
        {
          // タスクの作成
          execute: async () => {
            return await this.taskManager.createTask(taskData);
          },
          rollback: async (task) => {
            this.logger.info(`タスク ${task.id} 作成のロールバックを実行します`);
            // ロールバック処理
          }
        },
        {
          // セッションの更新
          execute: async (task) => {
            const session = await this.sessionManager.getLatestSession();
            if (!session) {
              return task;
            }
            
            // セッションのproject_state_summaryを更新
            const projectStateSummary = session.session_handover.project_state_summary;
            projectStateSummary.pending_tasks.push(task.id);
            
            await this.sessionManager.updateSession(session.session_id, {
              project_state_summary: projectStateSummary
            });
            
            return task;
          }
        }
      ]);
      
      const task = results[results.length - 1];
      
      // 状態遷移（既にTASK_IN_PROGRESSでない場合）
      if (this.stateManager.getCurrentState() !== this.stateManager.states.TASK_IN_PROGRESS) {
        this.stateManager.transitionTo(this.stateManager.states.TASK_IN_PROGRESS, {
          taskId: task.id,
          timestamp: new Date().toISOString()
        });
      }
      
      // イベント発行
      this.eventEmitter.emit('task:created', {
        taskId: task.id,
        timestamp: new Date().toISOString()
      });
      
      // ワークフロー状態の記録
      this._logActivity({
        type: 'task_created',
        timestamp: new Date().toISOString(),
        task_id: task.id,
        details: { title: task.title }
      });
      
      return task;
    } catch (error) {
      return this.handleError(error, 'task_creation');
    } finally {
      // ロックの解放
      this.lockManager.releaseLock('task', 'create');
    }
  }
  
  /**
   * タスク状態を更新
   * @param {string} taskId - タスクID
   * @param {string} status - 新しい状態
   * @param {number} progress - 進捗率
   * @returns {Promise<Object>} 更新されたタスク
   */
  async updateTaskStatus(taskId, status, progress) {
    this.logger.info('タスク状態更新処理を開始します', { taskId, status, progress });
    
    try {
      // 入力検証
      if (!taskId || typeof taskId !== 'string') {
        throw new ValidationError('タスクIDは必須の文字列です');
      }
      
      if (!status || typeof status !== 'string') {
        throw new ValidationError('ステータスは必須の文字列です');
      }
      
      if (progress !== undefined && (typeof progress !== 'number' || progress < 0 || progress > 100)) {
        throw new ValidationError('進捗率は0〜100の数値である必要があります');
      }
      
      // ロックの取得
      await this.lockManager.acquireLock('task', taskId);
      
      // 状態検証
      if (this.stateManager.getCurrentState() !== this.stateManager.states.SESSION_STARTED &&
          this.stateManager.getCurrentState() !== this.stateManager.states.TASK_IN_PROGRESS &&
          this.stateManager.getCurrentState() !== this.stateManager.states.FEEDBACK_COLLECTED) {
        throw new StateError('タスクの更新はセッション開始後のみ可能です');
      }
      
      // タスクの取得
      const task = await this.taskManager.getTaskById(taskId);
      if (!task) {
        throw new Error(`タスク ${taskId} が見つかりません`);
      }
      
      // 進捗状態の決定
      let progressState = task.progress_state;
      if (progress !== undefined) {
        if (progress === 0) {
          progressState = 'not_started';
        } else if (progress < 50) {
          progressState = 'in_progress';
        } else if (progress < 100) {
          progressState = 'almost_done';
        } else {
          progressState = 'completed';
        }
      }
      
      // タスク状態の更新
      const result = await this.taskManager.updateTaskProgress(taskId, progress, progressState);
      
      if (!result.success) {
        throw new Error(result.message);
      }
      
      // セッションの更新
      const session = await this.sessionManager.getLatestSession();
      if (session) {
        // セッションのproject_state_summaryを更新
        const projectStateSummary = session.session_handover.project_state_summary;
        
        // 古い状態からタスクを削除
        ['completed_tasks', 'current_tasks', 'pending_tasks', 'blocked_tasks'].forEach(category => {
          const index = projectStateSummary[category].indexOf(taskId);
          if (index !== -1) {
            projectStateSummary[category].splice(index, 1);
          }
        });
        
        // 新しい状態にタスクを追加
        switch (status) {
          case 'completed':
            projectStateSummary.completed_tasks.push(taskId);
            break;
          case 'in_progress':
            projectStateSummary.current_tasks.push(taskId);
            break;
          case 'pending':
            projectStateSummary.pending_tasks.push(taskId);
            break;
          case 'blocked':
            projectStateSummary.blocked_tasks.push(taskId);
            break;
        }
        
        await this.sessionManager.updateSession(session.session_id, {
          project_state_summary: projectStateSummary
        });
      }
      
      // 状態遷移（既にTASK_IN_PROGRESSでない場合）
      if (this.stateManager.getCurrentState() !== this.stateManager.states.TASK_IN_PROGRESS) {
        this.stateManager.transitionTo(this.stateManager.states.TASK_IN_PROGRESS, {
          taskId,
          timestamp: new Date().toISOString()
        });
      }
      
      // イベント発行
      this.eventEmitter.emit('task:updated', {
        taskId,
        status,
        progress,
        timestamp: new Date().toISOString()
      });
      
      // ワークフロー状態の記録
      this._logActivity({
        type: 'task_updated',
        timestamp: new Date().toISOString(),
        task_id: taskId,
        details: { status, progress }
      });
      
      return result.updatedTask;
    } catch (error) {
      return this.handleError(error, 'task_status_update');
    } finally {
      // ロックの解放
      this.lockManager.releaseLock('task', taskId);
    }
  }

  /**
   * フィードバックを収集
   * @param {string} taskId - タスクID
   * @param {string} testCommand - テストコマンド
   * @returns {Promise<Object>} フィードバック情報
   */
  async collectFeedback(taskId, testCommand) {
    this.logger.info('フィードバック収集処理を開始します', { taskId, testCommand });
    
    try {
      // 入力検証
      if (!taskId || typeof taskId !== 'string') {
        throw new ValidationError('タスクIDは必須の文字列です');
      }
      
      if (!testCommand || typeof testCommand !== 'string') {
        throw new ValidationError('テストコマンドは必須の文字列です');
      }
      
      // ロックの取得
      await this.lockManager.acquireLock('feedback', taskId);
      
      // 状態検証
      if (this.stateManager.getCurrentState() !== this.stateManager.states.SESSION_STARTED &&
          this.stateManager.getCurrentState() !== this.stateManager.states.TASK_IN_PROGRESS &&
          this.stateManager.getCurrentState() !== this.stateManager.states.FEEDBACK_COLLECTED) {
        throw new StateError('フィードバックの収集はセッション開始後のみ可能です');
      }
      
      // タスクの存在確認
      const task = await this.taskManager.getTaskById(taskId);
      if (!task) {
        throw new Error(`タスク ${taskId} が見つかりません`);
      }
      
      // トランザクション実行
      const results = await this._executeTransaction([
        {
          // テスト結果の収集
          execute: async () => {
            return await this.feedbackManager.collectTestResults(taskId, testCommand);
          },
          rollback: async (feedback) => {
            this.logger.info(`タスク ${taskId} のフィードバック収集のロールバックを実行します`);
            // ロールバック処理
          }
        },
        {
          // フィードバックの優先順位付け
          execute: async (feedback) => {
            return await this.feedbackManager.prioritizeFeedback(feedback);
          }
        },
        {
          // セッションとの統合
          execute: async (feedback) => {
            const session = await this.sessionManager.getLatestSession();
            if (!session) {
              return feedback;
            }
            
            await this.feedbackManager.integrateFeedbackWithSession(
              feedback.feedback_loop.task_id,
              session.session_id
            );
            
            return feedback;
          }
        },
        {
          // タスクとの統合
          execute: async (feedback) => {
            await this.feedbackManager.integrateFeedbackWithTask(
              feedback.feedback_loop.task_id,
              taskId
            );
            
            return feedback;
          }
        }
      ]);
      
      const feedback = results[results.length - 1];
      
      // 状態遷移
      this.stateManager.transitionTo(this.stateManager.states.FEEDBACK_COLLECTED, {
        taskId,
        feedbackId: feedback.feedback_loop.task_id,
        timestamp: new Date().toISOString()
      });
      
      // イベント発行
      this.eventEmitter.emit('feedback:collected', {
        taskId,
        feedbackId: feedback.feedback_loop.task_id,
        timestamp: new Date().toISOString()
      });
      
      // ワークフロー状態の記録
      this._logActivity({
        type: 'feedback_collected',
        timestamp: new Date().toISOString(),
        task_id: taskId,
        details: {
          test_command: testCommand,
          passes_tests: feedback.feedback_loop.verification_results.passes_tests
        }
      });
      
      return feedback;
    } catch (error) {
      return this.handleError(error, 'feedback_collection');
    } finally {
      // ロックの解放
      this.lockManager.releaseLock('feedback', taskId);
    }
  }
  
  /**
   * フィードバックを解決
   * @param {string} feedbackId - フィードバックID
   * @returns {Promise<Object>} 解決結果
   */
  async resolveFeedback(feedbackId) {
    this.logger.info('フィードバック解決処理を開始します', { feedbackId });
    
    try {
      // 入力検証
      if (!feedbackId || typeof feedbackId !== 'string') {
        throw new ValidationError('フィードバックIDは必須の文字列です');
      }
      
      // ロックの取得
      await this.lockManager.acquireLock('feedback', feedbackId);
      
      // 状態検証
      if (this.stateManager.getCurrentState() !== this.stateManager.states.FEEDBACK_COLLECTED) {
        throw new StateError('フィードバックの解決はフィードバック収集後のみ可能です');
      }
      
      // フィードバックの取得
      const feedback = await this.feedbackManager.getFeedbackByTaskId(feedbackId);
      if (!feedback) {
        throw new Error(`フィードバック ${feedbackId} が見つかりません`);
      }
      
      // トランザクション実行
      const results = await this._executeTransaction([
        {
          // フィードバック状態の更新
          execute: async () => {
            return await this.feedbackManager.updateFeedbackStatus(feedback, 'resolved');
          },
          rollback: async (updatedFeedback) => {
            this.logger.info(`フィードバック ${feedbackId} の解決のロールバックを実行します`);
            // ロールバック処理
          }
        },
        {
          // タスク状態の更新
          execute: async (updatedFeedback) => {
            // テストが成功した場合はタスクを完了状態に
            if (updatedFeedback.feedback_loop.verification_results.passes_tests) {
              await this.taskManager.updateTaskProgress(feedbackId, 100, 'completed');
            }
            
            return updatedFeedback;
          }
        },
        {
          // セッションの更新
          execute: async (updatedFeedback) => {
            const session = await this.sessionManager.getLatestSession();
            if (!session) {
              return updatedFeedback;
            }
            
            // セッションのproject_state_summaryを更新
            const projectStateSummary = session.session_handover.project_state_summary;
            
            // テストが成功した場合はタスクを完了タスクに移動
            if (updatedFeedback.feedback_loop.verification_results.passes_tests) {
              const index = projectStateSummary.current_tasks.indexOf(feedbackId);
              if (index !== -1) {
                projectStateSummary.current_tasks.splice(index, 1);
              }
              
              if (!projectStateSummary.completed_tasks.includes(feedbackId)) {
                projectStateSummary.completed_tasks.push(feedbackId);
              }
            }
            
            await this.sessionManager.updateSession(session.session_id, {
              project_state_summary: projectStateSummary
            });
            
            return updatedFeedback;
          }
        }
      ]);
      
      const updatedFeedback = results[results.length - 1];
      
      // 状態遷移
      this.stateManager.transitionTo(this.stateManager.states.TASK_IN_PROGRESS, {
        taskId: feedbackId,
        timestamp: new Date().toISOString()
      });
      
      // イベント発行
      this.eventEmitter.emit('feedback:resolved', {
        feedbackId,
        timestamp: new Date().toISOString()
      });
      
      // ワークフロー状態の記録
      this._logActivity({
        type: 'feedback_resolved',
        timestamp: new Date().toISOString(),
        feedback_id: feedbackId,
        details: {
          passes_tests: updatedFeedback.feedback_loop.verification_results.passes_tests
        }
      });
      
      return updatedFeedback;
    } catch (error) {
      return this.handleError(error, 'feedback_resolution');
    } finally {
      // ロックの解放
      this.lockManager.releaseLock('feedback', feedbackId);
    }
  }
  
  /**
   * コンポーネント間の同期を実行
   * @returns {Promise<boolean>} 同期結果
   */
  async syncComponents() {
    this.logger.info('コンポーネント間の同期を開始します');
    
    try {
      // ロックの取得
      await this.lockManager.acquireLock('sync', 'component_sync', 15000);
      
      // キャッシュの確認
      const cacheKey = 'sync:last_successful';
      const lastSync = this.cacheManager.get(cacheKey);
      
      if (lastSync && Date.now() - lastSync.timestamp < 5000) {
        this.logger.debug('前回の同期から5秒以内のため、同期をスキップします');
        return true;
      }
      
      // 同期操作をトランザクションとして実行
      await this._executeTransaction([
        {
          // 最新のタスク状態を取得
          execute: async () => {
            return await this.taskManager.getAllTasks();
          }
        },
        {
          // 最新のセッションを取得
          execute: async (tasks) => {
            const session = await this.sessionManager.getLatestSession();
            if (!session) {
              this.logger.warn('アクティブなセッションが見つかりません');
              return { tasks, session: null };
            }
            return { tasks, session };
          }
        },
        {
          // プロジェクト状態サマリーを更新
          execute: async (data) => {
            if (!data.session) {
              return data;
            }
            
            const projectStateSummary = {
              completed_tasks: data.tasks.decomposed_tasks.filter(t => t.status === 'completed').map(t => t.id),
              current_tasks: data.tasks.decomposed_tasks.filter(t => t.status === 'in_progress').map(t => t.id),
              pending_tasks: data.tasks.decomposed_tasks.filter(t => t.status === 'pending').map(t => t.id),
              blocked_tasks: data.tasks.decomposed_tasks.filter(t => t.status === 'blocked').map(t => t.id)
            };
            
            await this.sessionManager.updateSession(data.session.session_id, {
              project_state_summary: projectStateSummary,
              next_session_focus: data.tasks.current_focus
            });
            
            return data;
          }
        },
        {
          // 保留中のフィードバックを取得
          execute: async (data) => {
            const pendingFeedback = await this.feedbackManager.getPendingFeedback();
            return { ...data, pendingFeedback };
          }
        },
        {
          // フィードバックをセッションに統合
          execute: async (data) => {
            if (!data.session || !data.pendingFeedback) {
              return data;
            }
            
            await this.feedbackManager.integrateFeedbackWithSession(
              data.pendingFeedback.feedback_loop.task_id,
              data.session.session_id
            );
            
            return data;
          }
        }
      ]);
      
      // データの一貫性を確保
      await this._ensureConsistency();
      
      // 同期時刻をキャッシュに保存
      this.cacheManager.set(cacheKey, {
        timestamp: Date.now(),
        success: true
      });
      
      // イベント発行
      this.eventEmitter.emit('components:synced', {
        timestamp: new Date().toISOString()
      });
      
      this.logger.info('コンポーネント間の同期が完了しました');
      return true;
    } catch (error) {
      this.handleError(error, 'component_sync');
      return false;
    } finally {
      // ロックの解放
      this.lockManager.releaseLock('sync', 'component_sync');
    }
  }
  
  /**
   * データの一貫性を確保
   * @returns {Promise<boolean>} 一貫性確保結果
   * @private
   */
  async _ensureConsistency() {
    try {
      this.logger.debug('データの一貫性確保処理を開始します');
      
      // タスク状態の取得
      const tasks = await this.taskManager.getAllTasks();
      
      // セッション状態の取得
      const session = await this.sessionManager.getLatestSession();
      if (!session) {
        this.logger.debug('アクティブなセッションがないため、一貫性確保をスキップします');
        return true;
      }
      
      // 不整合を検出
      const inconsistencies = [];
      
      // 1. 完了タスク数の不整合
      const completedTaskIds = tasks.decomposed_tasks.filter(t => t.status === 'completed').map(t => t.id);
      const sessionCompletedTasks = session.session_handover.project_state_summary.completed_tasks;
      
      if (!this._arraysEqual(completedTaskIds, sessionCompletedTasks)) {
        inconsistencies.push({
          type: 'completed_tasks_mismatch',
          expected: completedTaskIds,
          actual: sessionCompletedTasks
        });
        
        // 修正
        await this.sessionManager.updateSession(session.session_id, {
          project_state_summary: {
            ...session.session_handover.project_state_summary,
            completed_tasks: completedTaskIds
          }
        });
      }
      
      // 2. 進行中タスク数の不整合
      const inProgressTaskIds = tasks.decomposed_tasks.filter(t => t.status === 'in_progress').map(t => t.id);
      const sessionCurrentTasks = session.session_handover.project_state_summary.current_tasks;
      
      if (!this._arraysEqual(inProgressTaskIds, sessionCurrentTasks)) {
        inconsistencies.push({
          type: 'current_tasks_mismatch',
          expected: inProgressTaskIds,
          actual: sessionCurrentTasks
        });
        
        // 修正
        await this.sessionManager.updateSession(session.session_id, {
          project_state_summary: {
            ...session.session_handover.project_state_summary,
            current_tasks: inProgressTaskIds
          }
        });
      }
      
      // 3. current_focusとnext_session_focusの不整合
      if (tasks.current_focus && tasks.current_focus !== session.session_handover.next_session_focus) {
        inconsistencies.push({
          type: 'focus_mismatch',
          expected: tasks.current_focus,
          actual: session.session_handover.next_session_focus
        });
        
        // 修正
        await this.sessionManager.updateSession(session.session_id, {
          next_session_focus: tasks.current_focus
        });
      }
      
      // 不整合がある場合はログに記録
      if (inconsistencies.length > 0) {
        this.logger.warn('データの不整合を検出し、修正しました', { inconsistencies });
      } else {
        this.logger.debug('データの一貫性が確認されました');
      }
      
      return true;
    } catch (error) {
      this.logger.error('データの一貫性確保中にエラーが発生しました:', error);
      return false;
    }
  }
  
  /**
   * 2つの配列が等しいか比較
   * @param {Array} arr1 - 配列1
   * @param {Array} arr2 - 配列2
   * @returns {boolean} 等しいかどうか
   * @private
   */
  _arraysEqual(arr1, arr2) {
    if (!Array.isArray(arr1) || !Array.isArray(arr2)) {
      return false;
    }
    
    if (arr1.length !== arr2.length) {
      return false;
    }
    
    const sorted1 = [...arr1].sort();
    const sorted2 = [...arr2].sort();
    
    return sorted1.every((val, idx) => val === sorted2[idx]);
  }

  /**
   * レポートを生成
   * @param {string} reportType - レポートタイプ
   * @param {Object} options - レポートオプション
   * @returns {Promise<string>} レポート
   */
  async generateReport(reportType, options = {}) {
    this.logger.info('レポート生成を開始します', { reportType, options });
    
    try {
      // プラグインに対応したレポートタイプの場合
      if (this.pluginManager.hasPlugin('report') && 
          await this.pluginManager.invokePlugin('report', 'canHandleReportType', reportType)) {
        return await this.pluginManager.invokePlugin('report', 'generateReport', reportType, options);
      }
      
      // 標準レポートタイプの処理
      let report;
      
      switch (reportType) {
        case 'task_summary':
          report = await this._generateTaskSummaryReport(options);
          break;
        case 'session_summary':
          report = await this._generateSessionSummaryReport(options);
          break;
        case 'feedback_summary':
          report = await this._generateFeedbackSummaryReport(options);
          break;
        case 'workflow_status':
          report = await this._generateWorkflowStatusReport(options);
          break;
        case 'integration_status':
          report = await this._generateIntegrationStatusReport(options);
          break;
        default:
          throw new Error(`不明なレポートタイプ: ${reportType}`);
      }
      
      // 出力形式の変換
      return this._formatReport(report, options.format || 'text');
    } catch (error) {
      return this.handleError(error, 'report_generation');
    }
  }
  
  /**
   * タスクサマリーレポートを生成
   * @param {Object} options - レポートオプション
   * @returns {Object} レポートデータ
   * @private
   */
  async _generateTaskSummaryReport(options) {
    // キャッシュの確認
    const cacheKey = `report:task_summary:${JSON.stringify(options)}`;
    const cachedReport = this.cacheManager.get(cacheKey);
    
    if (cachedReport && !options.noCache) {
      return cachedReport;
    }
    
    const tasks = await this.taskManager.getAllTasks();
    
    // タスク状態のカウント
    const statusCounts = {
      completed: tasks.decomposed_tasks.filter(t => t.status === 'completed').length,
      in_progress: tasks.decomposed_tasks.filter(t => t.status === 'in_progress').length,
      pending: tasks.decomposed_tasks.filter(t => t.status === 'pending').length,
      blocked: tasks.decomposed_tasks.filter(t => t.status === 'blocked').length
    };
    
    // 進捗状態のカウント
    const progressStateCounts = {};
    tasks.decomposed_tasks.forEach(task => {
      progressStateCounts[task.progress_state] = (progressStateCounts[task.progress_state] || 0) + 1;
    });
    
    // 優先度別のタスク数
    const priorityCounts = {};
    tasks.decomposed_tasks.forEach(task => {
      priorityCounts[task.priority] = (priorityCounts[task.priority] || 0) + 1;
    });
    
    // 依存関係の分析
    const dependencyAnalysis = this._analyzeDependencies(tasks.decomposed_tasks);
    
    // 進捗率の統計
    const progressStats = this._calculateProgressStats(tasks.decomposed_tasks);
    
    // 現在のフォーカスタスク
    let focusTask = null;
    if (tasks.current_focus) {
      focusTask = tasks.decomposed_tasks.find(t => t.id === tasks.current_focus);
    }
    
    // レポートデータの構築
    const reportData = {
      title: 'タスクサマリーレポート',
      project: tasks.project,
      original_request: tasks.original_request,
      timestamp: new Date().toISOString(),
      status_counts: statusCounts,
      progress_state_counts: progressStateCounts,
      priority_counts: priorityCounts,
      dependency_analysis: dependencyAnalysis,
      progress_stats: progressStats,
      focus_task: focusTask,
      task_count: tasks.decomposed_tasks.length,
      estimated_total_hours: tasks.decomposed_tasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0),
      overall_progress: progressStats.average
    };
    
    // キャッシュに保存
    this.cacheManager.set(cacheKey, reportData, 60000); // 1分間有効
    
    return reportData;
  }
  
  /**
   * 依存関係を分析
   * @param {Array} tasks - タスク配列
   * @returns {Object} 依存関係の分析結果
   * @private
   */
  _analyzeDependencies(tasks) {
    const result = {
      dependency_chains: [],
      blocked_by: {},
      blocking: {},
      circular_dependencies: []
    };
    
    // 依存関係マップの構築
    const dependsOn = {};
    const blocks = {};
    
    tasks.forEach(task => {
      dependsOn[task.id] = task.dependencies.map(d => d.task_id);
      
      task.dependencies.forEach(dep => {
        if (!blocks[dep.task_id]) {
          blocks[dep.task_id] = [];
        }
        blocks[dep.task_id].push(task.id);
      });
    });
    
    // 各タスクが直接ブロックしているタスク
    tasks.forEach(task => {
      result.blocking[task.id] = blocks[task.id] || [];
    });
    
    // 各タスクが直接ブロックされているタスク
    tasks.forEach(task => {
      result.blocked_by[task.id] = dependsOn[task.id] || [];
    });
    
    // 循環依存の検出
    const detectCircular = (taskId, visited = new Set(), path = []) => {
      if (visited.has(taskId)) {
        // 循環が検出された場合
        const cycleStart = path.indexOf(taskId);
        if (cycleStart !== -1) {
          const cycle = path.slice(cycleStart).concat(taskId);
          result.circular_dependencies.push(cycle);
        }
        return;
      }
      
      visited.add(taskId);
      path.push(taskId);
      
      const deps = dependsOn[taskId] || [];
      for (const depId of deps) {
        detectCircular(depId, new Set(visited), [...path]);
      }
    };
    
    tasks.forEach(task => {
      detectCircular(task.id);
    });
    
    return result;
  }
  
  /**
   * 進捗率の統計を計算
   * @param {Array} tasks - タスク配列
   * @returns {Object} 進捗率の統計
   * @private
   */
  _calculateProgressStats(tasks) {
    if (tasks.length === 0) {
      return {
        average: 0,
        min: 0,
        max: 0,
        median: 0,
        completed_percentage: 0,
        estimated_completion_date: null
      };
    }
    
    const progressValues = tasks.map(t => t.progress_percentage || 0);
    const sum = progressValues.reduce((a, b) => a + b, 0);
    const average = sum / progressValues.length;
    
    // 昇順でソート
    progressValues.sort((a, b) => a - b);
    
    const min = progressValues[0];
    const max = progressValues[progressValues.length - 1];
    
    // 中央値
    const midIndex = Math.floor(progressValues.length / 2);
    const median = progressValues.length % 2 === 0
      ? (progressValues[midIndex - 1] + progressValues[midIndex]) / 2
      : progressValues[midIndex];
    
    // 完了率
    const completedCount = tasks.filter(t => t.status === 'completed').length;
    const completedPercentage = (completedCount / tasks.length) * 100;
    
    // 完了日予測（簡易的な実装）
    let estimatedCompletionDate = null;
    if (average > 0 && average < 100) {
      // 直近の進捗率を基に予測
      const now = new Date();
      const daysRemaining = (100 - average) / (average / 7); // 1週間あたりの進捗率で除算
      estimatedCompletionDate = new Date(now.getTime() + (daysRemaining * 24 * 60 * 60 * 1000));
    }
    
    return {
      average,
      min,
      max,
      median,
      completed_percentage: completedPercentage,
      estimated_completion_date: estimatedCompletionDate
    };
  }
  
  /**
   * レポートを指定された形式にフォーマット
   * @param {Object} reportData - レポートデータ
   * @param {string} format - 出力形式
   * @returns {string} フォーマット済みレポート
   * @private
   */
  _formatReport(reportData, format) {
    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(reportData, null, 2);
      
      case 'markdown':
        return this._formatReportAsMarkdown(reportData);
      
      case 'text':
      default:
        return this._formatReportAsText(reportData);
    }
  }
  
  /**
   * レポートをテキスト形式にフォーマット
   * @param {Object} reportData - レポートデータ
   * @returns {string} テキスト形式のレポート
   * @private
   */
  _formatReportAsText(reportData) {
    // テキスト形式のレポートを構築
    let text = `${reportData.title}\n`;
    text += `=`.repeat(reportData.title.length) + '\n\n';
    
    text += `生成日時: ${new Date(reportData.timestamp).toLocaleString()}\n\n`;
    
    // レポートタイプに応じた内容を追加
    if (reportData.project) {
      text += `プロジェクト: ${reportData.project}\n`;
    }
    
    if (reportData.status_counts) {
      text += `タスク状態:\n`;
      text += `- 完了: ${reportData.status_counts.completed}\n`;
      text += `- 進行中: ${reportData.status_counts.in_progress}\n`;
      text += `- 保留中: ${reportData.status_counts.pending}\n`;
      text += `- ブロック中: ${reportData.status_counts.blocked}\n\n`;
    }
    
    if (reportData.overall_progress !== undefined) {
      text += `全体進捗率: ${reportData.overall_progress.toFixed(1)}%\n\n`;
    }
    
    if (reportData.focus_task) {
      text += `現在のフォーカス:\n`;
      text += `- ${reportData.focus_task.id}: ${reportData.focus_task.title}\n`;
      text += `  状態: ${reportData.focus_task.status}, 進捗率: ${reportData.focus_task.progress_percentage}%\n\n`;
    }
    
    return text;
  }
  
  /**
   * レポートをMarkdown形式にフォーマット
   * @param {Object} reportData - レポートデータ
   * @returns {string} Markdown形式のレポート
   * @private
   */
  _formatReportAsMarkdown(reportData) {
    // Markdown形式のレポートを構築
    let md = `# ${reportData.title}\n\n`;
    
    md += `**生成日時**: ${new Date(reportData.timestamp).toLocaleString()}  \n\n`;
    
    // レポートタイプに応じた内容を追加
    if (reportData.project) {
      md += `**プロジェクト**: ${reportData.project}  \n\n`;
    }
    
    if (reportData.status_counts) {
      md += `## タスク状態\n\n`;
      md += `- **完了**: ${reportData.status_counts.completed}\n`;
      md += `- **進行中**: ${reportData.status_counts.in_progress}\n`;
      md += `- **保留中**: ${reportData.status_counts.pending}\n`;
      md += `- **ブロック中**: ${reportData.status_counts.blocked}\n\n`;
    }
    
    if (reportData.overall_progress !== undefined) {
      md += `## 全体進捗率\n\n`;
      md += `${reportData.overall_progress.toFixed(1)}%\n\n`;
    }
    
    if (reportData.focus_task) {
      md += `## 現在のフォーカス\n\n`;
      md += `### ${reportData.focus_task.id}: ${reportData.focus_task.title}\n\n`;
      md += `- **状態**: ${reportData.focus_task.status}\n`;
      md += `- **進捗率**: ${reportData.focus_task.progress_percentage}%\n`;
      md += `- **説明**: ${reportData.focus_task.description}\n\n`;
    }
    
    return md;
  }
  
  /**
   * エラーを処理
   * @param {Error} error - エラー
   * @param {string} component - エラーが発生したコンポーネント
   * @returns {Object} エラー情報
   */
  handleError(error, component) {
    this.logger.error(`[${component}] エラーが発生しました:`, {
      error: error.message,
      stack: error.stack,
      component
    });
    
    // エラーログの記録
    this._logActivity({
      type: 'error',
      timestamp: new Date().toISOString(),
      component,
      details: {
        message: error.message,
        stack: error.stack
      }
    });
    
    // エラーイベントの発行
    this.eventEmitter.emit('error', {
      error,
      component,
      timestamp: new Date().toISOString()
    });
    
    // エラーの種類に応じた回復処理
    switch (component) {
      case 'workflow_initialization':
        // 初期化エラーの場合は、ワークフローの状態をリセット
        if (this._isRecoverableError(error)) {
          this._recoverWorkflowState();
        }
        
        // 空のプロジェクト情報を返す
        return {
          project: 'unknown',
          original_request: '',
          decomposed_tasks: [],
          current_focus: null,
          error: error.message,
          recoverable: this._isRecoverableError(error)
        };
      
      case 'session_start':
      case 'session_end':
        // セッション関連のエラーの場合はセッション情報を再構築
        if (this._isRecoverableError(error)) {
          this._recoverSessionState();
        }
        
        return {
          session_id: 'error-recovery-session',
          error: error.message,
          recoverable: this._isRecoverableError(error),
          recovery_action: this._isRecoverableError(error) ? 'セッション情報を再構築しました' : '手動での回復が必要です'
        };
      
      case 'task_creation':
      case 'task_status_update':
        // タスク関連のエラーの場合はタスク情報を再構築
        if (this._isRecoverableError(error)) {
          this._recoverTaskState();
        }
        
        return {
          id: 'error-recovery-task',
          error: error.message,
          recoverable: this._isRecoverableError(error),
          recovery_action: this._isRecoverableError(error) ? 'タスク情報を再構築しました' : '手動での回復が必要です'
        };
      
      case 'feedback_collection':
      case 'feedback_resolution':
        // フィードバック関連のエラーの場合はフィードバック情報を再構築
        if (this._isRecoverableError(error)) {
          this._recoverFeedbackState();
        }
        
        return {
          feedback_loop: {
            task_id: 'error-recovery-feedback',
            error: error.message
          },
          recoverable: this._isRecoverableError(error),
          recovery_action: this._isRecoverableError(error) ? 'フィードバック情報を再構築しました' : '手動での回復が必要です'
        };
      
      case 'component_sync':
        // 同期エラーの場合は自動的に再試行
        if (this._isRecoverableError(error)) {
          setTimeout(() => {
            this.logger.info('同期エラー回復のため再同期を実行します');
            this.syncComponents().catch(syncError => {
              this.logger.error('再同期中にエラーが発生しました:', syncError);
            });
          }, 5000); // 5秒後に再試行
        }
        
        return {
          error: error.message,
          component,
          timestamp: new Date().toISOString(),
          recoverable: this._isRecoverableError(error),
          recovery_action: this._isRecoverableError(error) ? '5秒後に再同期を試みます' : '手動での回復が必要です'
        };
      
      default:
        // その他のエラーの場合は一般的なエラー情報を返す
        return {
          error: error.message,
          component,
          timestamp: new Date().toISOString(),
          recoverable: this._isRecoverableError(error),
          recovery_action: this._isRecoverableError(error) ? '自動回復を試みます' : '手動での回復が必要です'
        };
    }
  }
  
  /**
   * エラーが回復可能かどうか判定
   * @param {Error} error - エラー
   * @returns {boolean} 回復可能かどうか
   * @private
   */
  _isRecoverableError(error) {
    // 回復不可能なエラー
    if (error instanceof StateError ||
        error instanceof DataConsistencyError ||
        error.message.includes('critical') ||
        error.message.includes('corruption')) {
      return false;
    }
    
    // タイムアウトエラーは一時的なものとして回復可能
    if (error.message.includes('timeout') ||
        error.message.includes('temporary') ||
        error instanceof LockTimeoutError) {
      return true;
    }
    
    // バリデーションエラーは回復不可能
    if (error instanceof ValidationError) {
      return false;
    }
    
    // デフォルトは回復可能とする
    return true;
  }
  
  /**
   * ワークフロー状態を回復
   * @private
   */
  async _recoverWorkflowState() {
    try {
      this.logger.info('ワークフロー状態の回復を開始します');
      
      // タスク状態の取得
      const tasks = await this.taskManager.getAllTasks();
      
      // 状態が有効かチェック
      if (tasks && tasks.project) {
        // 状態遷移
        if (this.stateManager.getCurrentState() === this.stateManager.states.UNINITIALIZED) {
          this.stateManager.transitionTo(this.stateManager.states.INITIALIZED, {
            projectId: tasks.project,
            timestamp: new Date().toISOString(),
            recovery: true
          });
          
          this.logger.info('ワークフロー状態を INITIALIZED に回復しました');
        }
      } else {
        // 有効な状態が見つからない場合は初期状態に戻す
        this.stateManager.transitionTo(this.stateManager.states.UNINITIALIZED, {
          timestamp: new Date().toISOString(),
          recovery: true
        });
        
        this.logger.warn('有効なワークフロー状態が見つからないため UNINITIALIZED に戻しました');
      }
      
      // キャッシュをクリア
      this.cacheManager.clear();
      
      this.logger.info('ワークフロー状態の回復が完了しました');
    } catch (error) {
      this.logger.error('ワークフロー状態の回復中にエラーが発生しました:', error);
    }
  }
  
  /**
   * セッション状態を回復
   * @private
   */
  async _recoverSessionState() {
    try {
      this.logger.info('セッション状態の回復を開始します');
      
      // 最新のセッションを取得
      const session = await this.sessionManager.getLatestSession();
      
      if (session) {
        // セッションが存在する場合は同期を実行
        await this.syncComponents();
        
        this.logger.info('セッション状態を回復しました');
      } else {
        // セッションが存在しない場合は新しいセッションを作成
        this.logger.warn('有効なセッションが見つからないため、新しいセッションを作成します');
        
        // 状態が適切であれば新しいセッションを作成
        if (this.stateManager.getCurrentState() === this.stateManager.states.INITIALIZED) {
          await this.startSession();
        }
      }
    } catch (error) {
      this.logger.error('セッション状態の回復中にエラーが発生しました:', error);
    }
  }
  
  /**
   * タスク状態を回復
   * @private
   */
  async _recoverTaskState() {
    try {
      this.logger.info('タスク状態の回復を開始します');
      
      // タスク状態の取得
      const tasks = await this.taskManager.getAllTasks();
      
      // セッションの取得
      const session = await this.sessionManager.getLatestSession();
      
      if (session && tasks) {
        // セッションとタスクの同期
        await this._ensureConsistency();
        
        this.logger.info('タスク状態を回復しました');
      } else {
        this.logger.warn('タスク状態の回復に必要な情報が不足しています');
      }
    } catch (error) {
      this.logger.error('タスク状態の回復中にエラーが発生しました:', error);
    }
  }
  
  /**
   * フィードバック状態を回復
   * @private
   */
  async _recoverFeedbackState() {
    try {
      this.logger.info('フィードバック状態の回復を開始します');
      
      // 保留中のフィードバックを取得
      const pendingFeedback = await this.feedbackManager.getPendingFeedback();
      
      if (pendingFeedback) {
        // セッションの取得
        const session = await this.sessionManager.getLatestSession();
        
        if (session) {
          // フィードバックとセッションの統合
          await this.feedbackManager.integrateFeedbackWithSession(
            pendingFeedback.feedback_loop.task_id,
            session.session_id
          );
          
          // フィードバックとタスクの統合
          await this.feedbackManager.integrateFeedbackWithTask(
            pendingFeedback.feedback_loop.task_id,
            pendingFeedback.feedback_loop.task_id
          );
          
          this.logger.info('フィードバック状態を回復しました');
        } else {
          this.logger.warn('フィードバック状態の回復に必要なセッション情報が不足しています');
        }
      } else {
        this.logger.info('回復が必要なフィードバックはありません');
      }
    } catch (error) {
      this.logger.error('フィードバック状態の回復中にエラーが発生しました:', error);
    }
  }
}

// モジュールのエクスポート
module.exports = IntegrationManager;

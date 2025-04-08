const { ApplicationError, CliError } = require('../lib/utils/errors');
const { emitErrorEvent } = require('../lib/utils/error-helpers');
// ID生成関数をインポート (EventEmitter から取得するため不要)
// const { generateTraceId, generateRequestId } = require('../lib/utils/id-generators');

/**
 * CLIにおけるワークフロー状態表示関連の操作を管理するクラス
 */
class CliStatusViewer {
  /**
   * @param {object} options - オプション
   * @param {object} options.logger - Loggerインスタンス (必須)
   * @param {object} options.eventEmitter - EventEmitterインスタンス (必須)
   * @param {object} options.stateManagerAdapter - StateManagerAdapterインスタンス (必須)
   * @param {object} options.taskManagerAdapter - TaskManagerAdapterインスタンス (必須)
   * @param {object} options.sessionManagerAdapter - SessionManagerAdapterインスタンス (必須)
   * @param {object} [options.errorHandler] - エラーハンドラー (オプション)
   * @param {Function} options.traceIdGenerator - トレースID生成関数 (必須)
   * @param {Function} options.requestIdGenerator - リクエストID生成関数 (必須)
   */
  constructor(options = {}) {
    // 分割代入で依存関係を取得
    const {
      logger,
      eventEmitter,
      stateManagerAdapter,
      taskManagerAdapter,
      sessionManagerAdapter,
      errorHandler, // 任意
      traceIdGenerator,
      requestIdGenerator,
    } = options;

    // 必須依存関係のチェック
    if (!logger)
      throw new ApplicationError('CliStatusViewer requires logger instance.');
    if (!eventEmitter)
      throw new ApplicationError(
        'CliStatusViewer requires eventEmitter instance.'
      );
    if (!stateManagerAdapter)
      throw new ApplicationError(
        'CliStatusViewer requires stateManagerAdapter instance.'
      );
    if (!taskManagerAdapter)
      throw new ApplicationError(
        'CliStatusViewer requires taskManagerAdapter instance.'
      );
    if (!sessionManagerAdapter)
      throw new ApplicationError(
        'CliStatusViewer requires sessionManagerAdapter instance.'
      );
    if (!traceIdGenerator)
      throw new ApplicationError(
        'CliStatusViewer requires traceIdGenerator function.'
      );
    if (!requestIdGenerator)
      throw new ApplicationError(
        'CliStatusViewer requires requestIdGenerator function.'
      );

    this.logger = logger;
    this.eventEmitter = eventEmitter;
    this.stateManager = stateManagerAdapter;
    this.taskManager = taskManagerAdapter;
    this.sessionManager = sessionManagerAdapter;
    this.errorHandler = errorHandler; // 任意なのでチェック不要
    this._traceIdGenerator = traceIdGenerator;
    this._requestIdGenerator = requestIdGenerator;

    this.logger.debug('CliStatusViewer initialized');
  }

  /**
   * 標準化されたイベントを発行する内部ヘルパー
   * @param {string} action - アクション名 (例: 'get_before')
   * @param {object} [data={}] - イベントデータ
   * @param {string} [traceId] - トレースID (指定されなければ生成)
   * @param {string} [requestId] - リクエストID (指定されなければ生成)
   * @returns {Promise<void>}
   * @private
   */
  async _emitEvent(action, data = {}, traceId, requestId) {
    if (
      !this.eventEmitter ||
      typeof this.eventEmitter.emitStandardizedAsync !== 'function'
    ) {
      this.logger.warn(
        `Cannot emit event status_${action}: eventEmitter or emitStandardizedAsync is missing.`
      );
      return;
    }
    const finalTraceId = traceId || this._traceIdGenerator();
    const finalRequestId = requestId || this._requestIdGenerator();
    const eventData = {
      ...data,
      traceId: finalTraceId,
      requestId: finalRequestId,
    };
    try {
      // コンポーネント名を 'cli'、アクション名を 'status_action' 形式に統一
      await this.eventEmitter.emitStandardizedAsync(
        'cli',
        `status_${action}`,
        eventData
      );
    } catch (error) {
      this.logger.warn(`イベント発行中にエラー: cli:status_${action}`, {
        error,
      });
    }
  }

  /**
   * エラー処理を行う内部ヘルパー
   * @param {Error} error - 発生したエラー
   * @param {string} operation - 操作名
   * @param {object} [context={}] - エラーコンテキスト
   * @returns {*} エラーハンドラーの戻り値、またはエラーを再スロー
   * @throws {CliError} エラーハンドラーがない場合、またはエラーハンドラーがエラーをスローした場合
   * @private
   */
  _handleError(error, operation, context = {}) {
    // エラーを CliError でラップ (常に)
    const processedError = new CliError(`Failed during ${operation}`, error, {
      // エラーコード生成ルールを統一 (コンポーネント名を含む)
      code: `ERR_CLI_STATUSVIEWER_${operation.toUpperCase()}`,
      ...context,
    });

    emitErrorEvent(
      this.eventEmitter,
      this.logger,
      'CliStatusViewer',
      operation,
      processedError,
      null,
      context
    );

    if (this.errorHandler) {
      return this.errorHandler.handle(
        processedError,
        'CliStatusViewer',
        operation,
        context
      );
    } else {
      throw processedError;
    }
  }

  /**
   * 現在のワークフロー状態を取得し、整形して返す
   * @returns {Promise<object>} ワークフロー状態情報
   * @throws {CliError} 状態取得に失敗した場合
   */
  async getWorkflowStatus() {
    const operation = 'getWorkflowStatus';
    const traceId = this._traceIdGenerator();
    const requestId = this._requestIdGenerator();
    const context = { traceId, requestId }; // エラーハンドリング用コンテキスト

    await this._emitEvent('get_before', {}, traceId, requestId);
    this.logger.info('Getting workflow status...', { ...context, operation });

    try {
      // 各アダプターから情報を取得 (Promise.all で並列化も検討可能だが、依存関係がなければ現状維持)
      const currentState = this.stateManager.getCurrentState(); // 同期処理と仮定
      const tasksResult = await this.taskManager.getAllTasks();
      const sessionResult = await this.sessionManager.getLatestSession();

      // 取得した情報を整形
      const statusInfo = {
        currentState: currentState,
        tasks: {
          count: tasksResult?.decomposed_tasks?.length || 0,
          statusCounts: this._calculateTaskStatusCounts(
            tasksResult?.decomposed_tasks || []
          ),
          currentFocus: this._findFocusTask(
            tasksResult?.decomposed_tasks || [],
            tasksResult?.current_focus
          ),
        },
        session: sessionResult
          ? {
              id: sessionResult.session_id,
              timestamp:
                sessionResult.session_handover?.session_timestamp ||
                sessionResult.created_at,
              previousSessionId:
                sessionResult.session_handover?.previous_session_id ||
                sessionResult.previous_session_id,
            }
          : null,
      };

      await this._emitEvent('get_after', { statusInfo }, traceId, requestId);
      this.logger.info('Workflow status retrieved successfully.', {
        traceId,
        requestId,
      });
      return statusInfo;
    } catch (error) {
      // エラーハンドラが値を返さない場合はエラー情報を含むオブジェクトを返す
      const handledResult = this._handleError(error, operation, context);
      return handledResult === undefined
        ? { error: error.message || 'Failed to get status' }
        : handledResult;
    }
  }

  /**
   * タスクリストから状態ごとの件数を計算する内部ヘルパー
   * @param {Array<object>} tasks - タスクオブジェクトの配列
   * @returns {{pending: number, in_progress: number, completed: number, blocked: number}} 状態ごとの件数
   * @private
   */
  _calculateTaskStatusCounts(tasks) {
    return tasks.reduce(
      (counts, task) => {
        counts[task.status] = (counts[task.status] || 0) + 1;
        return counts;
      },
      { pending: 0, in_progress: 0, completed: 0, blocked: 0 }
    );
  }

  /**
   * フォーカス中のタスク情報を検索する内部ヘルパー
   * @param {Array<object>} tasks - タスクオブジェクトの配列
   * @param {string|null} focusTaskId - フォーカス中のタスクID
   * @returns {{id: string, title: string, status: string, progress: number}|null} フォーカス中のタスク情報、または null
   * @private
   */
  _findFocusTask(tasks, focusTaskId) {
    if (!focusTaskId) return null;
    const task = tasks.find((t) => t.id === focusTaskId);
    return task
      ? {
          id: task.id,
          title: task.title,
          status: task.status,
          progress: task.progress_percentage || 0,
        }
      : null;
  }
}
module.exports = CliStatusViewer;

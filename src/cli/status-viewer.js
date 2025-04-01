const { ApplicationError, CliError } = require('../lib/utils/errors'); // CliError をインポート
const { emitErrorEvent } = require('../lib/utils/error-helpers');

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
   * @param {object} options.errorHandler - エラーハンドラー (オプション)
   */
  constructor(options = {}) {
    // 必須依存関係のチェック
    const requiredDependencies = [
      'logger',
      'eventEmitter',
      'stateManagerAdapter',
      'taskManagerAdapter',
      'sessionManagerAdapter',
    ];
    for (const dep of requiredDependencies) {
      if (!options[dep]) {
        throw new ApplicationError(`CliStatusViewer requires ${dep} instance.`);
      }
    }

    this.logger = options.logger;
    this.eventEmitter = options.eventEmitter;
    this.stateManager = options.stateManagerAdapter;
    this.taskManager = options.taskManagerAdapter;
    this.sessionManager = options.sessionManagerAdapter;
    this.errorHandler = options.errorHandler;

    this.logger.debug('CliStatusViewer initialized');
  }

  /**
   * 現在のワークフロー状態を取得し、整形して返す
   * @returns {Promise<object>} ワークフロー状態情報
   * @throws {ApplicationError} 状態取得に失敗した場合
   */
  async getWorkflowStatus() {
    const operation = 'getWorkflowStatus';
    this.logger.info('Getting workflow status...', { operation });
    await this.eventEmitter.emitStandardizedAsync(
      'cli_status',
      `${operation}_before`
    );

    try {
      // 各アダプターから情報を取得
      const currentState = this.stateManager.getCurrentState(); // 同期？
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
                sessionResult.created_at, // handover 優先
              previousSessionId:
                sessionResult.session_handover?.previous_session_id ||
                sessionResult.previous_session_id,
            }
          : null,
      };

      await this.eventEmitter.emitStandardizedAsync(
        'cli_status',
        `${operation}_after`,
        { statusInfo }
      );
      this.logger.info('Workflow status retrieved successfully.');
      return statusInfo;
    } catch (error) {
      // CliError でラップするように修正
      const cliError = new CliError(
        'Failed to get workflow status',
        error, // cause
        { code: 'ERR_CLI_STATUS_GET' } // context (エラーコードのみ指定)
      );
      emitErrorEvent(
        this.eventEmitter,
        this.logger,
        'CliStatusViewer',
        operation,
        cliError, // 正しく生成されたエラーオブジェクトを使用
        null // context は emitErrorEvent には渡さない (cliError 内に含まれる)
      );
      if (this.errorHandler) {
        // エラーハンドラーが状態オブジェクトの代替を返すことも可能
        // handle メソッドの第4引数 (context) は null を渡す
        return (
          this.errorHandler.handle(
            cliError,
            'CliStatusViewer',
            operation,
            null
          ) || {
            error: cliError.message,
          }
        );
      } else {
        throw cliError; // 正しく生成されたエラーオブジェクトをスロー
      }
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
    ); // 初期値を設定
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

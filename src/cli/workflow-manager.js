const { ApplicationError, CliError } = require('../lib/utils/errors'); // CliError をインポート
const { emitErrorEvent } = require('../lib/utils/error-helpers');

/**
 * CLIにおけるワークフロー関連の操作を管理するクラス
 */
class CliWorkflowManager {
  /**
   * @param {object} options - オプション
   * @param {object} options.logger - Loggerインスタンス (必須)
   * @param {object} options.eventEmitter - EventEmitterインスタンス (必須)
   * @param {object} options.integrationManagerAdapter - IntegrationManagerAdapterインスタンス (必須)
   * @param {object} options.stateManagerAdapter - StateManagerAdapterインスタンス (必須)
   * @param {object} options.errorHandler - エラーハンドラー (オプション)
   */
  constructor(options = {}) {
    // 必須依存関係のチェック
    const requiredDependencies = [
      'logger',
      'eventEmitter',
      'integrationManagerAdapter',
      'stateManagerAdapter',
    ];
    for (const dep of requiredDependencies) {
      if (!options[dep]) {
        throw new ApplicationError(
          `CliWorkflowManager requires ${dep} instance.`
        );
      }
    }

    this.logger = options.logger;
    this.eventEmitter = options.eventEmitter;
    this.integrationManager = options.integrationManagerAdapter;
    this.stateManager = options.stateManagerAdapter;
    this.errorHandler = options.errorHandler;

    this.logger.debug('CliWorkflowManager initialized');
  }

  /**
   * ワークフローを初期化する
   * @param {string} projectId - プロジェクトID
   * @param {string} request - 元のリクエスト
   * @returns {Promise<object>} 初期化結果
   * @throws {ApplicationError} 初期化に失敗した場合
   */
  async initializeWorkflow(projectId, request) {
    const operation = 'initializeWorkflow';
    this.logger.info(`Initializing workflow for project: ${projectId}`, {
      operation,
    });
    await this.eventEmitter.emitStandardizedAsync(
      'cli_workflow',
      `${operation}_before`,
      { projectId, request }
    );

    try {
      // integrationManagerAdapter を使用して初期化を実行
      const result = await this.integrationManager.initializeWorkflow(
        projectId,
        request
      );

      // integrationManagerAdapter がエラーオブジェクトを返す場合があるためチェック
      if (result && result.error) {
        // ApplicationError のシグネチャに合わせて修正
        throw new ApplicationError(
          `Workflow initialization failed: ${result.error}`,
          {
            // options オブジェクト
            code: 'ERR_WORKFLOW_INIT',
            context: { projectId, request, errorDetail: result.error },
          }
        );
      }
      if (!result || !result.project) {
        // 成功時の期待される構造を確認
        // ApplicationError のシグネチャに合わせて修正
        throw new ApplicationError(
          'Workflow initialization did not return expected result.',
          {
            // options オブジェクト
            code: 'ERR_WORKFLOW_INIT_UNEXPECTED',
            context: { projectId, request, result },
          }
        );
      }

      await this.eventEmitter.emitStandardizedAsync(
        'cli_workflow',
        `${operation}_after`,
        { projectId, request, result }
      );
      this.logger.info(
        `Workflow initialized successfully for project: ${projectId}`
      );
      return result;
    } catch (error) {
      // ApplicationError のコンストラクタ呼び出しとエラーコードの扱いを修正
      const cliError =
        error instanceof ApplicationError &&
        (error.code === 'ERR_WORKFLOW_INIT' ||
          error.code === 'ERR_WORKFLOW_INIT_UNEXPECTED')
          ? error // 特定のエラーコードはそのまま使用
          : new CliError( // CliError でラップするように変更
              `Failed to initialize workflow for project ${projectId}`,
              error, // cause
              {
                // context
                code: 'ERR_CLI_WORKFLOW_INIT', // エラーコードを指定
                projectId,
                request,
              }
            );
      emitErrorEvent(
        this.eventEmitter,
        this.logger,
        'CliWorkflowManager',
        operation,
        cliError,
        null,
        { projectId, request }
      );

      if (this.errorHandler) {
        return this.errorHandler.handle(
          cliError,
          'CliWorkflowManager',
          operation,
          { projectId, request }
        );
      } else {
        throw cliError;
      }
    }
  }

  // 他のワークフロー関連メソッド (例: getWorkflowStatus など) をここに追加
  // getWorkflowStatus は CliStatusViewer に移譲する可能性が高い
}

module.exports = CliWorkflowManager;

const { ApplicationError, CliError } = require('../lib/utils/errors');
const { emitErrorEvent } = require('../lib/utils/error-helpers');
// ID生成関数をインポート (EventEmitter から取得するため不要)
// const { generateTraceId, generateRequestId } = require('../lib/utils/id-generators');

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
   * @param {object} [options.errorHandler] - エラーハンドラー (オプション)
   * @param {Function} options.traceIdGenerator - トレースID生成関数 (必須)
   * @param {Function} options.requestIdGenerator - リクエストID生成関数 (必須)
   */
  constructor(options = {}) {
    // 分割代入で依存関係を取得
    const {
      logger,
      eventEmitter,
      integrationManagerAdapter,
      stateManagerAdapter,
      errorHandler, // 任意
      traceIdGenerator,
      requestIdGenerator,
    } = options;

    // 必須依存関係のチェック
    if (!logger)
      throw new ApplicationError(
        'CliWorkflowManager requires logger instance.'
      );
    if (!eventEmitter)
      throw new ApplicationError(
        'CliWorkflowManager requires eventEmitter instance.'
      );
    if (!integrationManagerAdapter)
      throw new ApplicationError(
        'CliWorkflowManager requires integrationManagerAdapter instance.'
      );
    if (!stateManagerAdapter)
      throw new ApplicationError(
        'CliWorkflowManager requires stateManagerAdapter instance.'
      );
    if (!traceIdGenerator)
      throw new ApplicationError(
        'CliWorkflowManager requires traceIdGenerator function.'
      );
    if (!requestIdGenerator)
      throw new ApplicationError(
        'CliWorkflowManager requires requestIdGenerator function.'
      );

    this.logger = logger;
    this.eventEmitter = eventEmitter;
    this.integrationManager = integrationManagerAdapter;
    this.stateManager = stateManagerAdapter;
    this.errorHandler = errorHandler; // 任意なのでチェック不要
    this._traceIdGenerator = traceIdGenerator;
    this._requestIdGenerator = requestIdGenerator;

    this.logger.debug('CliWorkflowManager initialized');
  }

  /**
   * 標準化されたイベントを発行する内部ヘルパー
   * @param {string} action - アクション名 (例: 'init_before')
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
        `Cannot emit event workflow_${action}: eventEmitter or emitStandardizedAsync is missing.`
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
      // コンポーネント名を 'cli'、アクション名を 'workflow_action' 形式に統一
      await this.eventEmitter.emitStandardizedAsync(
        'cli',
        `workflow_${action}`,
        eventData
      );
    } catch (error) {
      this.logger.warn(`イベント発行中にエラー: cli:workflow_${action}`, {
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
   * @throws {CliError|ApplicationError} エラーハンドラーがない場合、またはエラーハンドラーがエラーをスローした場合
   * @private
   */
  _handleError(error, operation, context = {}) {
    // 特定のエラーコードや型はそのまま使う
    const knownErrorCodes = [
      'ERR_WORKFLOW_INIT',
      'ERR_WORKFLOW_INIT_UNEXPECTED',
    ];
    const isKnownAppError =
      error instanceof ApplicationError && knownErrorCodes.includes(error.code);
    const isKnownError = isKnownAppError; // 他の特定エラー型があれば追加

    const processedError = isKnownError
      ? error
      : new CliError(`Failed during ${operation}`, error, {
          // エラーコード生成ルールを統一 (コンポーネント名を含む)
          code: `ERR_CLI_WORKFLOWMANAGER_${operation.toUpperCase()}`,
          ...context,
        });

    emitErrorEvent(
      this.eventEmitter,
      this.logger,
      'CliWorkflowManager',
      operation,
      processedError,
      null,
      context
    );

    if (this.errorHandler) {
      return this.errorHandler.handle(
        processedError,
        'CliWorkflowManager',
        operation,
        context
      );
    } else {
      throw processedError;
    }
  }

  /**
   * ワークフローを初期化する
   * @param {string} projectId - プロジェクトID
   * @param {string} request - 元のリクエスト
   * @returns {Promise<object>} 初期化結果
   * @throws {CliError|ApplicationError} 初期化に失敗した場合
   */
  async initializeWorkflow(projectId, request) {
    const operation = 'initializeWorkflow';
    const traceId = this._traceIdGenerator();
    const requestId = this._requestIdGenerator();
    const context = { projectId, request, traceId, requestId };

    await this._emitEvent(
      'init_before',
      { projectId, request },
      traceId,
      requestId
    );
    this.logger.info(
      `Initializing workflow for project: ${projectId}`,
      context
    );

    try {
      const result = await this.integrationManager.initializeWorkflow(
        projectId,
        request
      );

      if (result && result.error) {
        throw new ApplicationError(
          `Workflow initialization failed: ${result.error}`,
          {
            code: 'ERR_WORKFLOW_INIT',
            context: { projectId, request, errorDetail: result.error },
          }
        );
      }
      if (!result || !result.project) {
        throw new ApplicationError(
          'Workflow initialization did not return expected result.',
          {
            code: 'ERR_WORKFLOW_INIT_UNEXPECTED',
            context: { projectId, request, result },
          }
        );
      }

      await this._emitEvent(
        'init_after',
        { projectId, request, result },
        traceId,
        requestId
      );
      this.logger.info(
        `Workflow initialized successfully for project: ${projectId}`,
        { traceId, requestId }
      );
      return result;
    } catch (error) {
      return this._handleError(error, operation, context);
    }
  }
}

module.exports = CliWorkflowManager;

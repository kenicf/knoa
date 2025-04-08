const { ApplicationError, CliError } = require('../lib/utils/errors');
const { emitErrorEvent } = require('../lib/utils/error-helpers');
// ID生成関数のインポートは不要になったため削除
// const { generateTraceId, generateRequestId } = require('../lib/utils/id-generators');

/**
 * CLIにおけるコンポーネント同期関連の操作を管理するクラス
 */
class CliComponentSyncer {
  /**
   * @param {object} options - オプション
   * @param {object} options.logger - Loggerインスタンス (必須)
   * @param {object} options.eventEmitter - EventEmitterインスタンス (必須)
   * @param {object} options.integrationManagerAdapter - IntegrationManagerAdapterインスタンス (必須)
   * @param {object} [options.errorHandler] - エラーハンドラー (オプション)
   * @param {Function} options.traceIdGenerator - トレースID生成関数 (必須)
   * @param {Function} options.requestIdGenerator - リクエストID生成関数 (必須)
   */
  constructor(options = {}) {
    // 分割代入とデフォルト値で依存関係を取得
    const {
      logger,
      eventEmitter,
      integrationManagerAdapter,
      errorHandler, // 任意
      traceIdGenerator,
      requestIdGenerator,
    } = options;

    // 必須依存関係のチェック
    if (!logger)
      throw new ApplicationError(
        'CliComponentSyncer requires logger instance.'
      );
    if (!eventEmitter)
      throw new ApplicationError(
        'CliComponentSyncer requires eventEmitter instance.'
      );
    if (!integrationManagerAdapter)
      throw new ApplicationError(
        'CliComponentSyncer requires integrationManagerAdapter instance.'
      );
    if (!traceIdGenerator)
      throw new ApplicationError(
        'CliComponentSyncer requires traceIdGenerator function.'
      );
    if (!requestIdGenerator)
      throw new ApplicationError(
        'CliComponentSyncer requires requestIdGenerator function.'
      );

    this.logger = logger;
    this.eventEmitter = eventEmitter;
    this.integrationManager = integrationManagerAdapter;
    this.errorHandler = errorHandler; // 任意なのでチェック不要
    this._traceIdGenerator = traceIdGenerator;
    this._requestIdGenerator = requestIdGenerator;

    this.logger.debug('CliComponentSyncer initialized');
  }

  /**
   * 標準化されたイベントを発行する内部ヘルパー
   * @param {string} action - アクション名 (例: 'sync_before')
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
        `Cannot emit event ${action}: eventEmitter or emitStandardizedAsync is missing.`
      );
      return;
    }

    // ID が引数で渡されなければ、インスタンスのジェネレーターを使用
    const finalTraceId = traceId || this._traceIdGenerator();
    const finalRequestId = requestId || this._requestIdGenerator();

    const eventData = {
      ...data,
      // IDをここで付与
      traceId: finalTraceId,
      requestId: finalRequestId,
      // timestamp は emitStandardizedAsync 内で付与される
    };

    try {
      // コンポーネント名を 'cli' に統一
      await this.eventEmitter.emitStandardizedAsync('cli', action, eventData);
    } catch (error) {
      this.logger.warn(`イベント発行中にエラー: cli:${action}`, { error });
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
    // 特定のエラーコードを持つ ApplicationError はそのまま使う
    const knownErrorCodes = ['ERR_SYNC_FAILED', 'ERR_SYNC_UNEXPECTED'];
    const isKnownAppError =
      error instanceof ApplicationError && knownErrorCodes.includes(error.code);
    // 他の特定エラー型があればここに追加 (例: error instanceof NotFoundError)
    const isKnownError = isKnownAppError;

    const processedError = isKnownError
      ? error
      : new CliError(`Failed during ${operation}`, error, {
          // エラーコード生成ルールを統一 (コンポーネント名を含む)
          code: `ERR_CLI_COMPONENTSYNCER_${operation.toUpperCase()}`,
          ...context, // 元のコンテキストを追加
        });

    // emitErrorEvent は eventEmitter がなくても動作する想定 (内部でチェック)
    emitErrorEvent(
      this.eventEmitter,
      this.logger,
      'CliComponentSyncer',
      operation,
      processedError,
      null, // OperationContext はここでは使わない
      context // details として渡す
    );

    if (this.errorHandler) {
      // errorHandler.handle の第4引数に context を渡す
      return this.errorHandler.handle(
        processedError,
        'CliComponentSyncer',
        operation,
        context // context を渡す
      );
    } else {
      throw processedError; // エラーハンドラーがなければスロー
    }
  }

  /**
   * コンポーネント間の同期を実行する
   * @returns {Promise<boolean>} 同期に成功したかどうか
   * @throws {CliError|ApplicationError} 同期に失敗した場合
   */
  async syncComponents() {
    const operation = 'syncComponents';
    // イベント発行をヘルパー経由に変更 (アクション名を簡略化)
    const traceId = this._traceIdGenerator();
    const requestId = this._requestIdGenerator();
    await this._emitEvent('sync_before', {}, traceId, requestId);
    this.logger.info('Syncing components...', {
      operation,
      traceId,
      requestId,
    });

    try {
      const result = await this.integrationManager.syncComponents();

      if (typeof result !== 'boolean') {
        // ApplicationError を使用し、エラーコードとコンテキストを渡す
        throw new ApplicationError(
          'Component sync did not return expected boolean result.',
          { code: 'ERR_SYNC_UNEXPECTED', context: { result } }
        );
      }
      if (!result) {
        // ApplicationError を使用し、エラーコードとコンテキストを渡す
        throw new ApplicationError('Component sync failed.', {
          code: 'ERR_SYNC_FAILED',
          context: {},
        });
      }

      // イベント発行をヘルパー経由に変更
      await this._emitEvent(
        'sync_after',
        { success: result },
        traceId,
        requestId
      );
      this.logger.info('Components synced successfully.', {
        traceId,
        requestId,
      });
      return result;
    } catch (error) {
      // エラー処理をヘルパーに委譲
      // エラーハンドラが値を返さない場合に false を返すように修正
      const handledResult = this._handleError(error, operation, {
        traceId,
        requestId,
      });
      // エラーハンドラーが値を返さなかった場合 (undefined) は false を返す
      return handledResult === undefined ? false : handledResult;
    }
  }
}

module.exports = CliComponentSyncer;

const { ApplicationError, CliError } = require('../lib/utils/errors'); // CliError をインポート
const { emitErrorEvent } = require('../lib/utils/error-helpers');

/**
 * CLIにおけるコンポーネント同期関連の操作を管理するクラス
 */
class CliComponentSyncer {
  /**
   * @param {object} options - オプション
   * @param {object} options.logger - Loggerインスタンス (必須)
   * @param {object} options.eventEmitter - EventEmitterインスタンス (必須)
   * @param {object} options.integrationManagerAdapter - IntegrationManagerAdapterインスタンス (必須)
   * @param {object} options.errorHandler - エラーハンドラー (オプション)
   */
  constructor(options = {}) {
    // 必須依存関係のチェック
    const requiredDependencies = [
      'logger',
      'eventEmitter',
      'integrationManagerAdapter',
    ];
    for (const dep of requiredDependencies) {
      if (!options[dep]) {
        throw new ApplicationError(
          `CliComponentSyncer requires ${dep} instance.`
        );
      }
    }

    this.logger = options.logger;
    this.eventEmitter = options.eventEmitter;
    this.integrationManager = options.integrationManagerAdapter;
    this.errorHandler = options.errorHandler;

    this.logger.debug('CliComponentSyncer initialized');
  }

  /**
   * コンポーネント間の同期を実行する
   * @returns {Promise<boolean>} 同期に成功したかどうか
   * @throws {ApplicationError} 同期に失敗した場合
   */
  async syncComponents() {
    const operation = 'syncComponents';
    this.logger.info('Syncing components...', { operation });
    await this.eventEmitter.emitStandardizedAsync(
      'cli_sync',
      `${operation}_before`
    );

    try {
      // integrationManagerAdapter を使用して同期を実行
      const result = await this.integrationManager.syncComponents();

      // integrationManager.syncComponents は boolean を返す想定
      if (typeof result !== 'boolean') {
        throw new ApplicationError(
          'Component sync did not return expected boolean result.',
          { code: 'ERR_SYNC_UNEXPECTED', context: { result } }
        );
      }
      if (!result) {
        throw new ApplicationError('Component sync failed.', {
          code: 'ERR_SYNC_FAILED',
          context: {},
        });
      }

      await this.eventEmitter.emitStandardizedAsync(
        'cli_sync',
        `${operation}_after`,
        { success: result }
      );
      this.logger.info('Components synced successfully.');
      return result;
    } catch (error) {
      // エラーを CliError でラップするか、そのまま使うかを決定
      const processedError =
        error instanceof ApplicationError && // すでに ApplicationError ならそのまま
        (error.code === 'ERR_SYNC_FAILED' ||
          error.code === 'ERR_SYNC_UNEXPECTED')
          ? error
          : new CliError('Failed to sync components', error, {
              // それ以外は CliError でラップ
              code: 'ERR_CLI_SYNC', // CliError のデフォルトは ERR_CLI なので明示的に指定
            });

      emitErrorEvent(
        this.eventEmitter,
        this.logger,
        'CliComponentSyncer',
        operation,
        processedError, // 処理後のエラーを使用
        null, // context 引数を明示的に渡す
        {} // details 引数を明示的に渡す
      );

      if (this.errorHandler) {
        // errorHandler.handle の第4引数に null を追加
        return (
          this.errorHandler.handle(
            processedError, // 処理後のエラーを使用
            'CliComponentSyncer',
            operation,
            null
          ) || false
        ); // エラー時は false を返すなど
      } else {
        throw processedError; // 処理後のエラーをスロー
      }
    }
  }
}

module.exports = CliComponentSyncer;

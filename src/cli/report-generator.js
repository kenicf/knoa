const {
  ApplicationError,
  CliError,
  StorageError,
} = require('../lib/utils/errors');
const { emitErrorEvent } = require('../lib/utils/error-helpers');
const path = require('path'); // ファイルパス操作に必要
// ID生成関数をインポート (EventEmitter から取得するため不要)
// const { generateTraceId, generateRequestId } = require('../lib/utils/id-generators');

/**
 * CLIにおけるレポート生成関連の操作を管理するクラス
 */
class CliReportGenerator {
  /**
   * @param {object} options - オプション
   * @param {object} options.logger - Loggerインスタンス (必須)
   * @param {object} options.eventEmitter - EventEmitterインスタンス (必須)
   * @param {object} options.integrationManagerAdapter - IntegrationManagerAdapterインスタンス (必須)
   * @param {object} options.storageService - StorageServiceインスタンス (必須)
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
      storageService,
      errorHandler, // 任意
      traceIdGenerator,
      requestIdGenerator,
    } = options;

    // 必須依存関係のチェック
    if (!logger)
      throw new ApplicationError(
        'CliReportGenerator requires logger instance.'
      );
    if (!eventEmitter)
      throw new ApplicationError(
        'CliReportGenerator requires eventEmitter instance.'
      );
    if (!integrationManagerAdapter)
      throw new ApplicationError(
        'CliReportGenerator requires integrationManagerAdapter instance.'
      );
    if (!storageService)
      throw new ApplicationError(
        'CliReportGenerator requires storageService instance.'
      );
    if (!traceIdGenerator)
      throw new ApplicationError(
        'CliReportGenerator requires traceIdGenerator function.'
      );
    if (!requestIdGenerator)
      throw new ApplicationError(
        'CliReportGenerator requires requestIdGenerator function.'
      );

    this.logger = logger;
    this.eventEmitter = eventEmitter;
    this.integrationManager = integrationManagerAdapter;
    this.storageService = storageService;
    this.errorHandler = errorHandler; // 任意なのでチェック不要
    this._traceIdGenerator = traceIdGenerator;
    this._requestIdGenerator = requestIdGenerator;

    this.logger.debug('CliReportGenerator initialized');
  }

  /**
   * 標準化されたイベントを発行する内部ヘルパー
   * @param {string} action - アクション名 (例: 'generate_before')
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
        `Cannot emit event report_${action}: eventEmitter or emitStandardizedAsync is missing.`
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
      // コンポーネント名を 'cli'、アクション名を 'report_action' 形式に統一
      await this.eventEmitter.emitStandardizedAsync(
        'cli',
        `report_${action}`,
        eventData
      );
    } catch (error) {
      this.logger.warn(`イベント発行中にエラー: cli:report_${action}`, {
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
   * @throws {CliError|ApplicationError|StorageError} エラーハンドラーがない場合、またはエラーハンドラーがエラーをスローした場合
   * @private
   */
  _handleError(error, operation, context = {}) {
    // 特定のエラーコードや型はそのまま使う
    const knownErrorCodes = [
      'ERR_REPORT_GENERATE',
      'ERR_REPORT_GENERATE_UNEXPECTED',
      'ERR_STORAGE', // StorageError のコード
      'ERR_CLI_FILE_WRITE', // StorageError のコード (writeText から)
    ];
    const isKnownAppError =
      error instanceof ApplicationError && knownErrorCodes.includes(error.code);
    const isKnownStorageError = error instanceof StorageError; // StorageError はそのまま
    const isKnownError = isKnownAppError || isKnownStorageError;

    const processedError = isKnownError
      ? error
      : new CliError(`Failed during ${operation}`, error, {
          // エラーコード生成ルールを統一 (コンポーネント名を含む)
          code: `ERR_CLI_REPORTGENERATOR_${operation.toUpperCase()}`,
          ...context,
        });

    emitErrorEvent(
      this.eventEmitter,
      this.logger,
      'CliReportGenerator',
      operation,
      processedError,
      null,
      context
    );

    if (this.errorHandler) {
      return this.errorHandler.handle(
        processedError,
        'CliReportGenerator',
        operation,
        context
      );
    } else {
      throw processedError;
    }
  }

  /**
   * 指定されたタイプのレポートを生成する
   * @param {string} reportType - レポートタイプ (例: 'task_summary', 'workflow_status')
   * @param {object} reportOptions - レポートオプション (yargsでパースされたオブジェクト)
   * @returns {Promise<string>} 生成されたレポート内容、またはファイルパス
   * @throws {CliError|ApplicationError|StorageError} レポート生成または書き込みに失敗した場合
   */
  async generateReport(reportType, reportOptions = {}) {
    const operation = 'generateReport';
    const outputPath = reportOptions.output;
    const format = reportOptions.format || 'text';
    const noCache = reportOptions.noCache || false;
    const traceId = this._traceIdGenerator();
    const requestId = this._requestIdGenerator();
    const context = {
      reportType,
      format,
      outputPath,
      noCache,
      traceId,
      requestId,
    };

    await this._emitEvent(
      'generate_before',
      { reportType, format, outputPath, noCache },
      traceId,
      requestId
    );
    this.logger.info(`Generating report: ${reportType}`, context);

    try {
      const reportContent = await this.integrationManager.generateReport(
        reportType,
        { format, noCache }
      );

      if (typeof reportContent === 'object' && reportContent.error) {
        throw new ApplicationError(
          `Report generation failed: ${reportContent.error}`,
          {
            code: 'ERR_REPORT_GENERATE',
            context: {
              reportType,
              format,
              noCache,
              errorDetail: reportContent.error,
            },
          }
        );
      }
      if (typeof reportContent !== 'string') {
        throw new ApplicationError(
          'Report generation did not return expected string content.',
          {
            code: 'ERR_REPORT_GENERATE_UNEXPECTED',
            context: { reportType, format, noCache, result: reportContent },
          }
        );
      }

      let resultPath = null;
      if (outputPath) {
        const writeSuccess = await this.storageService.writeText(
          '.',
          outputPath,
          reportContent
        );
        if (!writeSuccess) {
          throw new StorageError(`Failed to write report file: ${outputPath}`, {
            code: 'ERR_CLI_FILE_WRITE', // StorageError がこのコードを持つようにする
            context: { reportType, path: outputPath },
          });
        }
        resultPath = outputPath;
        this.logger.info(`Report saved successfully to: ${resultPath}`, {
          traceId,
          requestId,
        });
      } else {
        this.logger.info(`Report generated successfully: ${reportType}`, {
          traceId,
          requestId,
        });
      }

      await this._emitEvent(
        'generate_after',
        {
          reportType,
          format,
          outputPath: resultPath,
          reportLength: reportContent.length,
        },
        traceId,
        requestId
      );
      return outputPath ? resultPath : reportContent;
    } catch (error) {
      // エラーハンドラが値を返さない場合は null を返すなど、適切なデフォルト値を検討
      return this._handleError(error, operation, context);
    }
  }
}

module.exports = CliReportGenerator;

const {
  ApplicationError,
  CliError,
  StorageError, // FileWriteError の代わりに StorageError を使用
} = require('../lib/utils/errors');
const { emitErrorEvent } = require('../lib/utils/error-helpers');
const path = require('path'); // ファイルパス操作に必要

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
   * @param {object} options.errorHandler - エラーハンドラー (オプション)
   */
  constructor(options = {}) {
    // 必須依存関係のチェック
    const requiredDependencies = [
      'logger',
      'eventEmitter',
      'integrationManagerAdapter',
      'storageService',
    ];
    for (const dep of requiredDependencies) {
      if (!options[dep]) {
        throw new ApplicationError(
          `CliReportGenerator requires ${dep} instance.`
        );
      }
    }

    this.logger = options.logger;
    this.eventEmitter = options.eventEmitter;
    this.integrationManager = options.integrationManagerAdapter;
    this.storageService = options.storageService; // ファイル出力に使用
    this.errorHandler = options.errorHandler;

    this.logger.debug('CliReportGenerator initialized');
  }

  /**
   * 指定されたタイプのレポートを生成する
   * @param {string} reportType - レポートタイプ (例: 'task_summary', 'workflow_status')
   * @param {object} reportOptions - レポートオプション (yargsでパースされたオブジェクト)
   * @returns {Promise<string>} 生成されたレポート内容、またはファイルパス
   * @throws {ApplicationError} レポート生成に失敗した場合
   */
  async generateReport(reportType, reportOptions = {}) {
    const operation = 'generateReport';
    const outputPath = reportOptions.output; // yargs でパースされたオプションから取得
    const format = reportOptions.format || 'text'; // デフォルトは text
    const noCache = reportOptions.noCache || false;

    this.logger.info(`Generating report: ${reportType}`, {
      operation,
      reportType,
      format,
      outputPath,
      noCache,
    });
    await this.eventEmitter.emitStandardizedAsync(
      'cli_report',
      `${operation}_before`,
      { reportType, format, outputPath, noCache }
    );

    try {
      // integrationManagerAdapter を使用してレポートを生成
      const reportContent = await this.integrationManager.generateReport(
        reportType,
        { format, noCache } // 必要なオプションのみ渡す
      );

      // integrationManagerAdapter がエラーオブジェクトを返す場合があるためチェック
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
        // 成功時は文字列を期待
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
        // StorageService を使用してファイルに保存
        const writeSuccess = await this.storageService.writeText(
          '.', // カレントディレクトリ基準
          outputPath,
          reportContent
        );
        if (!writeSuccess) {
          // StorageError を使用するように修正 (コンストラクタ呼び出し修正)
          throw new StorageError(`Failed to write report file: ${outputPath}`, {
            // options オブジェクトとして渡す
            cause: null,
            context: { reportType, path: outputPath },
          });
        }
        resultPath = outputPath;
        this.logger.info(`Report saved successfully to: ${resultPath}`);
      } else {
        this.logger.info(`Report generated successfully: ${reportType}`);
        // 標準出力への表示は呼び出し元 (Facade or EntryPoint) で行う
      }

      await this.eventEmitter.emitStandardizedAsync(
        'cli_report',
        `${operation}_after`,
        {
          reportType,
          format,
          outputPath: resultPath,
          reportLength: reportContent.length,
        }
      );
      // outputPath が指定されている場合はパスを、そうでなければレポート内容を返す
      return outputPath ? resultPath : reportContent;
    } catch (error) {
      let cliError; // エラーオブジェクトを保持する変数
      const baseContext = { reportType, format, outputPath, noCache };

      // エラーの種類を判別し、適切なエラーオブジェクトを生成または選択
      if (error.code === 'ERR_STORAGE') {
        // error.code で判定するように変更
        // StorageError はそのまま使用
        cliError = error;
      } else if (
        error.code === 'ERR_REPORT_GENERATE' ||
        error.code === 'ERR_REPORT_GENERATE_UNEXPECTED'
      ) {
        // アダプターが返す特定のエラーもそのまま使用
        cliError = error;
      } else {
        // 上記以外のエラー (アダプターがスローしたエラーなど) は CliError でラップ
        cliError = new CliError(
          `Failed to generate report ${reportType}`,
          error, // cause
          {
            // context
            code: 'ERR_CLI_REPORT_GENERATE',
            ...baseContext,
          }
        );
      }

      // エラーイベントを発行
      emitErrorEvent(
        this.eventEmitter,
        this.logger,
        'CliReportGenerator',
        operation,
        cliError, // 適切に選択または生成されたエラーオブジェクトを使用
        null,
        baseContext
      );

      // errorHandler があれば委譲
      if (this.errorHandler) {
        return this.errorHandler.handle(
          cliError, // 適切に選択または生成されたエラーオブジェクトを使用
          'CliReportGenerator',
          operation,
          baseContext
        );
      } else {
        // errorHandler がなければスロー
        throw cliError; // 適切に選択または生成されたエラーオブジェクトをスロー
      }
    }
  }
}

module.exports = CliReportGenerator;

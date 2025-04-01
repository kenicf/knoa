const CliReportGenerator = require('../../src/cli/report-generator');
const {
  ApplicationError,
  CliError,
  StorageError, // FileWriteError を StorageError に変更
} = require('../../src/lib/utils/errors');
const {
  createMockLogger,
  createMockEventEmitter,
  createMockStorageService,
} = require('../helpers/mock-factory');
// expectStandardizedEventEmittedAsync をインポート
const {
  expectStandardizedEventEmittedAsync,
} = require('../helpers/test-helpers');
// emitErrorEvent もモック化
jest.mock('../../src/lib/utils/error-helpers', () => ({
  emitErrorEvent: jest.fn(),
}));
const { emitErrorEvent } = require('../../src/lib/utils/error-helpers');
const path = require('path'); // path.join のモック解除のため必要

describe('CliReportGenerator', () => {
  let mockLogger;
  let mockEventEmitter;
  let mockIntegrationManagerAdapter;
  let mockStorageService;
  let mockErrorHandler;
  let cliReportGenerator;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockEventEmitter = createMockEventEmitter();
    mockIntegrationManagerAdapter = {
      generateReport: jest.fn(),
    };
    mockStorageService = createMockStorageService();
    mockErrorHandler = {
      handle: jest.fn(),
    };

    // テスト対象インスタンスを作成
    cliReportGenerator = new CliReportGenerator({
      logger: mockLogger,
      eventEmitter: mockEventEmitter,
      integrationManagerAdapter: mockIntegrationManagerAdapter,
      storageService: mockStorageService,
      // errorHandler: mockErrorHandler,
    });

    emitErrorEvent.mockClear();
  });

  describe('constructor', () => {
    test('should throw ApplicationError if required dependencies are missing', () => {
      expect(() => new CliReportGenerator({})).toThrow(ApplicationError);
      // storageService も必須
      expect(
        () =>
          new CliReportGenerator({
            logger: mockLogger,
            eventEmitter: mockEventEmitter,
            integrationManagerAdapter: mockIntegrationManagerAdapter,
            // storageService: mockStorageService, // ← これがないとエラー
          })
      ).toThrow(ApplicationError);
    });
  });

  describe('generateReport', () => {
    const reportType = 'task_summary';
    const reportOptions = { format: 'markdown', noCache: true };
    const outputPath = 'reports/tasks.md';
    const operation = 'generateReport';
    const mockReportContent = '# Task Summary Report';

    test('should call integrationManager.generateReport, write to file, and return path if outputPath provided', async () => {
      mockIntegrationManagerAdapter.generateReport.mockResolvedValue(
        mockReportContent
      );
      mockStorageService.writeText.mockResolvedValue(true);

      const result = await cliReportGenerator.generateReport(reportType, {
        ...reportOptions,
        output: outputPath,
      });

      expect(mockIntegrationManagerAdapter.generateReport).toHaveBeenCalledWith(
        reportType,
        { format: 'markdown', noCache: true }
      );
      expect(mockStorageService.writeText).toHaveBeenCalledWith(
        '.',
        outputPath,
        mockReportContent
      );
      expect(result).toBe(outputPath);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Generating report'),
        expect.objectContaining({ reportType })
      );
      // ロガー検証修正
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Report saved successfully to: ${outputPath}`)
      );
      // expectStandardizedEventEmittedAsync に変更
      expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli_report',
        `${operation}_before`,
        { reportType, format: 'markdown', outputPath, noCache: true }
      );
      expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli_report',
        `${operation}_after`,
        {
          reportType,
          format: 'markdown',
          outputPath,
          reportLength: mockReportContent.length,
        }
      );
    });

    test('should call integrationManager.generateReport and return content if no outputPath provided', async () => {
      mockIntegrationManagerAdapter.generateReport.mockResolvedValue(
        mockReportContent
      );

      const result = await cliReportGenerator.generateReport(
        reportType,
        reportOptions
      ); // output なし

      expect(mockIntegrationManagerAdapter.generateReport).toHaveBeenCalledWith(
        reportType,
        { format: 'markdown', noCache: true }
      );
      expect(mockStorageService.writeText).not.toHaveBeenCalled();
      expect(result).toBe(mockReportContent);
      // ロガー検証修正
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Report generated successfully: ${reportType}`)
      );
      // expectStandardizedEventEmittedAsync に変更
      expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli_report',
        `${operation}_after`,
        {
          reportType,
          format: 'markdown',
          outputPath: null,
          reportLength: mockReportContent.length,
        }
      );
    });

    test('should use default format and noCache if not provided', async () => {
      mockIntegrationManagerAdapter.generateReport.mockResolvedValue(
        mockReportContent
      );
      await cliReportGenerator.generateReport(reportType, {}); // format, noCache なし
      expect(mockIntegrationManagerAdapter.generateReport).toHaveBeenCalledWith(
        reportType,
        { format: 'text', noCache: false }
      );
    });

    test('should throw GenerateError if adapter returns error object', async () => {
      const errorResult = { error: 'Internal report error' };
      mockIntegrationManagerAdapter.generateReport.mockResolvedValue(
        errorResult
      );
      await expect(
        cliReportGenerator.generateReport(reportType, reportOptions)
      ).rejects.toThrow(ApplicationError);
      // エラーコード検証修正
      await expect(
        cliReportGenerator.generateReport(reportType, reportOptions)
      ).rejects.toHaveProperty('code', 'ERR_REPORT_GENERATE');
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliReportGenerator',
        operation,
        expect.objectContaining({ code: 'ERR_REPORT_GENERATE' }),
        null,
        { reportType, format: 'markdown', outputPath: undefined, noCache: true }
      );
    });

    test('should throw UnexpectedResultError if adapter returns non-string', async () => {
      const unexpectedResult = { data: 'report' }; // 文字列でない
      mockIntegrationManagerAdapter.generateReport.mockResolvedValue(
        unexpectedResult
      );
      await expect(
        cliReportGenerator.generateReport(reportType, reportOptions)
      ).rejects.toThrow(ApplicationError);
      // エラーコード検証修正
      await expect(
        cliReportGenerator.generateReport(reportType, reportOptions)
      ).rejects.toHaveProperty('code', 'ERR_REPORT_GENERATE_UNEXPECTED');
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliReportGenerator',
        operation,
        expect.objectContaining({ code: 'ERR_REPORT_GENERATE_UNEXPECTED' }),
        null,
        { reportType, format: 'markdown', outputPath: undefined, noCache: true }
      );
    });

    test('should throw StorageError if storage service fails', async () => {
      mockIntegrationManagerAdapter.generateReport.mockResolvedValue(
        mockReportContent
      );
      mockStorageService.writeText.mockResolvedValue(false); // 書き込み失敗

      let caughtError;
      try {
        await cliReportGenerator.generateReport(reportType, {
          ...reportOptions,
          output: outputPath,
        });
      } catch (error) {
        caughtError = error;
      }

      // エラーがスローされたことを確認
      expect(caughtError).toBeDefined();
      // エラーの name を検証
      expect(caughtError).toHaveProperty('name', 'StorageError');
      // エラーコードを検証 (StorageError のデフォルトコード)
      expect(caughtError).toHaveProperty('code', 'ERR_STORAGE');

      // emitErrorEvent が1回だけ呼び出されたことを確認
      expect(emitErrorEvent).toHaveBeenCalledTimes(1);
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliReportGenerator',
        operation,
        expect.objectContaining({ code: 'ERR_STORAGE' }), // StorageError を期待
        null,
        { reportType, format: 'markdown', outputPath, noCache: true }
      );
    });

    test('should throw CliError and emit error event on adapter failure', async () => {
      const originalError = new Error('Generate API error');
      mockIntegrationManagerAdapter.generateReport.mockRejectedValue(
        originalError
      );
      await expect(
        cliReportGenerator.generateReport(reportType, reportOptions)
      ).rejects.toThrow(CliError); // CliError を期待
      // エラーコード検証
      await expect(
        cliReportGenerator.generateReport(reportType, reportOptions)
      ).rejects.toHaveProperty('code', 'ERR_CLI_REPORT_GENERATE');
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliReportGenerator',
        operation,
        expect.objectContaining({
          // CliError インスタンスであることを期待
          name: 'CliError',
          code: 'ERR_CLI_REPORT_GENERATE',
          cause: originalError,
        }),
        null,
        { reportType, format: 'markdown', outputPath: undefined, noCache: true }
      );
    });

    test('should call errorHandler.handle if provided on adapter failure', async () => {
      // errorHandler を設定してインスタンス再作成
      cliReportGenerator = new CliReportGenerator({
        logger: mockLogger,
        eventEmitter: mockEventEmitter,
        integrationManagerAdapter: mockIntegrationManagerAdapter,
        storageService: mockStorageService,
        errorHandler: mockErrorHandler,
      });
      const originalError = new Error('Generate API error');
      mockIntegrationManagerAdapter.generateReport.mockRejectedValue(
        originalError
      );
      const errorHandlerResult = 'Error Handled';
      mockErrorHandler.handle.mockReturnValue(errorHandlerResult);

      const result = await cliReportGenerator.generateReport(
        reportType,
        reportOptions
      );

      expect(mockErrorHandler.handle).toHaveBeenCalledTimes(1);
      // errorHandler.handle に CliError インスタンスが渡されることを検証
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.objectContaining({
          // CliError インスタンスであることを期待
          name: 'CliError',
          code: 'ERR_CLI_REPORT_GENERATE',
          cause: originalError,
        }),
        'CliReportGenerator',
        operation,
        { reportType, format: 'markdown', outputPath: undefined, noCache: true }
      );
      expect(result).toBe(errorHandlerResult);
      expect(emitErrorEvent).toHaveBeenCalledTimes(1); // エラーイベントは発行される
    });
  });
});

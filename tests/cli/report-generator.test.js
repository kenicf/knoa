const CliReportGenerator = require('../../src/cli/report-generator');
const {
  ApplicationError,
  CliError,
  StorageError, // FileWriteError を StorageError に変更
} = require('../../src/lib/utils/errors');
const { createMockDependencies } = require('../helpers/mock-factory'); // createMockDependencies をインポート
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

  let mockDependencies; // モック依存関係を保持する変数

  beforeEach(() => {
    mockDependencies = createMockDependencies(); // 共通モックを生成
    mockLogger = mockDependencies.logger; // 個別変数にも代入
    mockEventEmitter = mockDependencies.eventEmitter; // 個別変数にも代入
    mockIntegrationManagerAdapter = mockDependencies.integrationManagerAdapter; // 共通モックから取得
    mockStorageService = mockDependencies.storageService; // 共通モックから取得
    mockErrorHandler = mockDependencies.errorHandler; // 共通モックから取得

    // モックメソッドを再設定 (必要に応じて)
    mockIntegrationManagerAdapter.generateReport = jest.fn();
    mockStorageService.writeText = jest.fn(); // writeText もモック化
    mockErrorHandler.handle = jest.fn();

    // テスト対象インスタンスを作成
    cliReportGenerator = new CliReportGenerator({
      logger: mockLogger,
      eventEmitter: mockEventEmitter,
      integrationManagerAdapter: mockIntegrationManagerAdapter,
      storageService: mockStorageService,
      traceIdGenerator: mockDependencies.traceIdGenerator, // 注入
      requestIdGenerator: mockDependencies.requestIdGenerator, // 注入
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
        expect.objectContaining({
          reportType,
          outputPath,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
      // ロガー検証修正
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Report saved successfully to: ${outputPath}`),
        expect.objectContaining({
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
      // expectStandardizedEventEmittedAsync に変更
      expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'report_generate_before', // イベント名を修正
        { reportType, format: 'markdown', outputPath, noCache: true } // データ修正
      );
      expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'report_generate_after', // イベント名を修正
        {
          reportType,
          format: 'markdown',
          outputPath,
          reportLength: mockReportContent.length,
        } // データ修正
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
        expect.stringContaining(`Report generated successfully: ${reportType}`),
        expect.objectContaining({
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
      // expectStandardizedEventEmittedAsync に変更
      expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'report_generate_after', // イベント名を修正
        {
          reportType,
          format: 'markdown',
          outputPath: null,
          reportLength: mockReportContent.length,
        } // データ修正
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
      // emitErrorEvent の期待値を修正
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliReportGenerator',
        operation,
        expect.objectContaining({
          // processedError (ApplicationError)
          name: 'ApplicationError',
          code: 'ERR_REPORT_GENERATE', // ApplicationError に設定されるコード
          // cause は null
          context: expect.objectContaining({
            // エラーの context
            reportType,
            format: 'markdown',
            noCache: true,
            errorDetail: 'Internal report error',
          }),
        }),
        null, // OperationContext (ここでは未使用)
        expect.objectContaining({
          // details (元の context)
          reportType,
          format: 'markdown',
          outputPath: undefined, // outputPath は元の context に含まれる
          noCache: true,
          traceId: expect.any(String),
          requestId: expect.any(String),
        })
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
      // emitErrorEvent の期待値を修正
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliReportGenerator',
        operation,
        expect.objectContaining({
          // processedError (ApplicationError)
          name: 'ApplicationError',
          code: 'ERR_REPORT_GENERATE_UNEXPECTED', // ApplicationError に設定されるコード
          // cause は null
          context: expect.objectContaining({
            // エラーの context
            reportType,
            format: 'markdown',
            noCache: true,
            result: unexpectedResult,
          }),
        }),
        null, // OperationContext (ここでは未使用)
        expect.objectContaining({
          // details (元の context)
          reportType,
          format: 'markdown',
          outputPath: undefined, // outputPath は元の context に含まれる
          noCache: true,
          traceId: expect.any(String),
          requestId: expect.any(String),
        })
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
      expect(caughtError).toHaveProperty('code', 'ERR_CLI_FILE_WRITE'); // StorageService が返すコードに修正

      // emitErrorEvent が1回だけ呼び出されたことを確認
      expect(emitErrorEvent).toHaveBeenCalledTimes(1);
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliReportGenerator',
        operation,
        expect.objectContaining({
          // StorageError を期待
          name: 'StorageError',
          code: 'ERR_CLI_FILE_WRITE',
        }),
        null,
        expect.objectContaining({
          reportType,
          format: 'markdown',
          outputPath,
          noCache: true,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
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
      ).rejects.toHaveProperty(
        'code',
        'ERR_CLI_REPORTGENERATOR_GENERATEREPORT'
      ); // 修正: クラス名を含むエラーコード
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliReportGenerator',
        operation,
        expect.objectContaining({
          // CliError でラップされていることを確認
          name: 'CliError',
          code: 'ERR_CLI_REPORTGENERATOR_GENERATEREPORT', // 修正後のコード
          cause: originalError,
        }),
        null,
        expect.objectContaining({
          reportType,
          format: 'markdown',
          outputPath: undefined,
          noCache: true,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
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
        traceIdGenerator: mockDependencies.traceIdGenerator, // 注入
        requestIdGenerator: mockDependencies.requestIdGenerator, // 注入
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
          // CliError でラップされていることを確認
          name: 'CliError',
          code: 'ERR_CLI_REPORTGENERATOR_GENERATEREPORT', // 修正: クラス名を含むエラーコード
          cause: originalError,
        }),
        'CliReportGenerator',
        operation,
        expect.objectContaining({
          reportType,
          format: 'markdown',
          outputPath: undefined,
          noCache: true,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
      expect(result).toBe(errorHandlerResult);
      expect(emitErrorEvent).toHaveBeenCalledTimes(1); // エラーイベントは発行される
    });
  });
});

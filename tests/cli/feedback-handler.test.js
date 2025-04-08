const CliFeedbackHandler = require('../../src/cli/feedback-handler');
const {
  ApplicationError,
  ValidationError,
  CliError,
  NotFoundError,
  StorageError, // FileWriteError を削除し StorageError を追加
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
const path = require('path'); // レポート保存パス用

describe('CliFeedbackHandler', () => {
  let mockLogger;
  let mockEventEmitter;
  let mockIntegrationManagerAdapter;
  let mockFeedbackManagerAdapter;
  let mockStorageService;
  let mockValidator;
  let mockErrorHandler;
  let cliFeedbackHandler;

  let mockDependencies; // モック依存関係を保持する変数

  beforeEach(() => {
    mockDependencies = createMockDependencies(); // 共通モックを生成
    mockLogger = mockDependencies.logger; // 個別変数にも代入
    mockEventEmitter = mockDependencies.eventEmitter; // 個別変数にも代入
    mockIntegrationManagerAdapter = mockDependencies.integrationManagerAdapter; // 共通モックから取得
    mockFeedbackManagerAdapter = mockDependencies.feedbackManagerAdapter; // 共通モックから取得
    mockStorageService = mockDependencies.storageService; // 共通モックから取得
    mockValidator = mockDependencies.validator; // 共通モックから取得
    mockErrorHandler = mockDependencies.errorHandler; // 共通モックから取得

    // モックメソッドを再設定 (必要に応じて)
    mockIntegrationManagerAdapter.collectFeedback = jest.fn();
    mockIntegrationManagerAdapter.resolveFeedback = jest.fn();
    mockFeedbackManagerAdapter.getFeedbackByTaskId = jest.fn();
    mockFeedbackManagerAdapter.updateFeedbackStatus = jest.fn();
    mockFeedbackManagerAdapter.generateFeedbackMarkdown = jest.fn();
    mockFeedbackManagerAdapter.prioritizeFeedback = jest.fn();
    mockFeedbackManagerAdapter.linkFeedbackToGitCommit = jest.fn();
    mockFeedbackManagerAdapter.linkFeedbackToSession = jest.fn();
    mockFeedbackManagerAdapter.integrateFeedbackWithTask = jest.fn();
    mockFeedbackManagerAdapter.integrateFeedbackWithSession = jest.fn();
    mockStorageService.writeText = jest.fn(); // writeText もモック化
    mockValidator.validateFeedbackInput = jest
      .fn()
      .mockReturnValue({ isValid: true, errors: [] }); // デフォルトで成功済み
    // mockValidator と mockErrorHandler の再定義は不要 (createMockDependencies で生成済み)

    // テスト対象インスタンスを作成
    cliFeedbackHandler = new CliFeedbackHandler({
      logger: mockLogger,
      eventEmitter: mockEventEmitter,
      integrationManagerAdapter: mockIntegrationManagerAdapter,
      feedbackManagerAdapter: mockFeedbackManagerAdapter,
      storageService: mockStorageService, // storageService を追加
      validator: mockValidator,
      traceIdGenerator: mockDependencies.traceIdGenerator, // 注入
      requestIdGenerator: mockDependencies.requestIdGenerator, // 注入
      // errorHandler: mockErrorHandler,
    });

    emitErrorEvent.mockClear();
  });

  describe('constructor', () => {
    test('should throw ApplicationError if required dependencies are missing', () => {
      expect(() => new CliFeedbackHandler({})).toThrow(ApplicationError);
      // feedbackManagerAdapter も必須
      expect(
        () =>
          new CliFeedbackHandler({
            logger: mockLogger,
            eventEmitter: mockEventEmitter,
            integrationManagerAdapter: mockIntegrationManagerAdapter,
            // feedbackManagerAdapter: mockFeedbackManagerAdapter, // ← これがないとエラー
            storageService: mockStorageService,
            validator: mockValidator,
          })
      ).toThrow(ApplicationError);
    });
  });

  describe('collectFeedback', () => {
    const taskId = 'T1';
    const testCommand = 'npm test';
    const operation = 'collectFeedback';
    const mockSuccessResult = {
      feedback_loop: {
        task_id: taskId,
        verification_results: { passes_tests: true },
      },
    };

    test('should call integrationManager.collectFeedback and return result on success', async () => {
      mockIntegrationManagerAdapter.collectFeedback.mockResolvedValue(
        mockSuccessResult
      );
      const result = await cliFeedbackHandler.collectFeedback(
        taskId,
        testCommand
      );
      expect(
        mockIntegrationManagerAdapter.collectFeedback
      ).toHaveBeenCalledWith(taskId, testCommand);
      expect(result).toEqual(mockSuccessResult);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Collecting feedback'),
        expect.objectContaining({
          taskId,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
      // ロガー検証修正
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          `Feedback collected successfully for task: ${taskId}`
        ),
        expect.objectContaining({
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
      // expectStandardizedEventEmittedAsync に変更
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'feedback_collect_before', // イベント名を修正
        { taskId, testCommand } // データ修正
      );
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'feedback_collect_after', // イベント名を修正
        { taskId, testCommand, result: mockSuccessResult } // データ修正
      );
    });

    test('should throw CliError and emit error event on adapter failure', async () => {
      const originalError = new Error('Test execution failed');
      mockIntegrationManagerAdapter.collectFeedback.mockRejectedValue(
        originalError
      );
      await expect(
        cliFeedbackHandler.collectFeedback(taskId, testCommand)
      ).rejects.toThrow(CliError); // ApplicationError -> CliError
      // エラーコード検証修正
      await expect(
        cliFeedbackHandler.collectFeedback(taskId, testCommand)
      ).rejects.toHaveProperty(
        'code',
        'ERR_CLI_FEEDBACKHANDLER_COLLECTFEEDBACK'
      ); // 修正: クラス名を含むエラーコード
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliFeedbackHandler',
        operation,
        expect.objectContaining({
          // CliError でラップされていることを確認
          name: 'CliError',
          code: 'ERR_CLI_FEEDBACKHANDLER_COLLECTFEEDBACK', // 修正後のコード
          cause: originalError,
        }),
        null,
        expect.objectContaining({
          taskId,
          testCommand,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    });
    test('should throw CliError if adapter returns error object', async () => {
      // ApplicationError -> CliError
      const errorResult = { error: 'Internal feedback error' };
      mockIntegrationManagerAdapter.collectFeedback.mockResolvedValue(
        errorResult
      );
      await expect(
        cliFeedbackHandler.collectFeedback(taskId, testCommand)
      ).rejects.toThrow(CliError); // ApplicationError -> CliError
      // エラーコード検証修正
      await expect(
        cliFeedbackHandler.collectFeedback(taskId, testCommand)
      ).rejects.toHaveProperty('code', 'ERR_CLI_FEEDBACK_COLLECT_ADAPTER'); // Specific code
      // emitErrorEvent の期待値を修正
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliFeedbackHandler',
        operation,
        expect.objectContaining({
          // processedError (CliError)
          name: 'CliError',
          code: 'ERR_CLI_FEEDBACK_COLLECT_ADAPTER', // CliError に設定されるコード
          // cause は null
          context: expect.objectContaining({
            // エラーの context
            taskId,
            testCommand,
            errorDetail: 'Internal feedback error',
          }),
        }),
        null, // OperationContext (ここでは未使用)
        expect.objectContaining({
          // details (元の context)
          taskId,
          testCommand,
          traceId: expect.any(String),
          requestId: expect.any(String),
        })
      );
    });

    test('should call errorHandler.handle if provided on adapter failure', async () => {
      // errorHandler を設定してインスタンス再作成
      cliFeedbackHandler = new CliFeedbackHandler({
        logger: mockLogger,
        eventEmitter: mockEventEmitter,
        integrationManagerAdapter: mockIntegrationManagerAdapter,
        feedbackManagerAdapter: mockFeedbackManagerAdapter,
        storageService: mockStorageService,
        validator: mockValidator,
        errorHandler: mockErrorHandler, // errorHandler を提供
        traceIdGenerator: mockDependencies.traceIdGenerator, // 注入
        requestIdGenerator: mockDependencies.requestIdGenerator, // 注入
      });
      const originalError = new Error('Adapter failed');
      mockIntegrationManagerAdapter.collectFeedback.mockRejectedValue(
        originalError
      );
      const errorHandlerResult = { handled: true, fallback: null };
      mockErrorHandler.handle.mockReturnValue(errorHandlerResult);

      const result = await cliFeedbackHandler.collectFeedback(
        taskId,
        testCommand
      );

      expect(mockErrorHandler.handle).toHaveBeenCalledTimes(1);
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.objectContaining({
          // CliError でラップされていることを確認
          name: 'CliError',
          code: 'ERR_CLI_FEEDBACKHANDLER_COLLECTFEEDBACK', // 修正: クラス名を含むエラーコード
          cause: originalError,
        }),
        'CliFeedbackHandler',
        operation,
        expect.objectContaining({
          taskId,
          testCommand,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
      expect(result).toEqual(errorHandlerResult); // errorHandler の戻り値が返される
      expect(emitErrorEvent).toHaveBeenCalledTimes(1); // エラーイベントは発行される
    });
  });

  describe('resolveFeedback', () => {
    const feedbackId = 'T1'; // feedbackId は taskId と同じ想定
    const taskId = feedbackId;
    const operation = 'resolveFeedback';
    const mockSuccessResult = {
      feedback_loop: { task_id: taskId, feedback_status: 'resolved' },
    };

    test('should call integrationManager.resolveFeedback and return result on success', async () => {
      mockIntegrationManagerAdapter.resolveFeedback.mockResolvedValue(
        mockSuccessResult
      );
      const result = await cliFeedbackHandler.resolveFeedback(feedbackId);
      expect(
        mockIntegrationManagerAdapter.resolveFeedback
      ).toHaveBeenCalledWith(feedbackId);
      expect(result).toEqual(mockSuccessResult);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Resolving feedback'),
        expect.objectContaining({
          feedbackId,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
      // ロガー検証修正
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          `Feedback resolved successfully for: ${feedbackId}`
        ),
        expect.objectContaining({
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
      // expectStandardizedEventEmittedAsync に変更
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'feedback_resolve_before', // イベント名を修正
        { feedbackId } // データ修正
      );
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'feedback_resolve_after', // イベント名を修正
        { feedbackId, result: mockSuccessResult } // データ修正
      );
    });

    test('should throw CliError and emit error event on adapter failure', async () => {
      const originalError = new Error('Resolve API error');
      mockIntegrationManagerAdapter.resolveFeedback.mockRejectedValue(
        originalError
      );
      await expect(
        cliFeedbackHandler.resolveFeedback(feedbackId)
      ).rejects.toThrow(CliError); // ApplicationError -> CliError
      // エラーコード検証修正
      await expect(
        cliFeedbackHandler.resolveFeedback(feedbackId)
      ).rejects.toHaveProperty(
        'code',
        'ERR_CLI_FEEDBACKHANDLER_RESOLVEFEEDBACK'
      ); // 修正: クラス名を含むエラーコード
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliFeedbackHandler',
        operation,
        expect.objectContaining({
          // CliError でラップされていることを確認
          name: 'CliError',
          code: 'ERR_CLI_FEEDBACKHANDLER_RESOLVEFEEDBACK', // 修正後のコード
          cause: originalError,
        }),
        null,
        expect.objectContaining({
          feedbackId,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    }); // ← 修正済みの閉じ括弧

    test('should call errorHandler.handle if provided on adapter failure', async () => {
      // errorHandler を設定してインスタンス再作成
      cliFeedbackHandler = new CliFeedbackHandler({
        logger: mockLogger,
        eventEmitter: mockEventEmitter,
        integrationManagerAdapter: mockIntegrationManagerAdapter,
        feedbackManagerAdapter: mockFeedbackManagerAdapter,
        storageService: mockStorageService,
        validator: mockValidator,
        errorHandler: mockErrorHandler, // errorHandler を提供
        traceIdGenerator: mockDependencies.traceIdGenerator, // 注入
        requestIdGenerator: mockDependencies.requestIdGenerator, // 注入
      });
      const originalError = new Error('Adapter failed');
      mockIntegrationManagerAdapter.resolveFeedback.mockRejectedValue(
        originalError
      );
      const errorHandlerResult = { handled: true, fallback: null };
      mockErrorHandler.handle.mockReturnValue(errorHandlerResult);

      const result = await cliFeedbackHandler.resolveFeedback(feedbackId);

      expect(mockErrorHandler.handle).toHaveBeenCalledTimes(1);
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.objectContaining({
          // CliError でラップされていることを確認
          name: 'CliError',
          code: 'ERR_CLI_FEEDBACKHANDLER_RESOLVEFEEDBACK', // 修正: クラス名を含むエラーコード
          cause: originalError,
        }),
        'CliFeedbackHandler',
        operation,
        expect.objectContaining({
          feedbackId,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
      expect(result).toEqual(errorHandlerResult); // errorHandler の戻り値が返される
      expect(emitErrorEvent).toHaveBeenCalledTimes(1); // エラーイベントは発行される
    });

    test('should throw CliError if adapter returns error object', async () => {
      // ApplicationError -> CliError
      const errorResult = { error: 'Cannot resolve feedback' };
      mockIntegrationManagerAdapter.resolveFeedback.mockResolvedValue(
        errorResult
      );
      await expect(
        cliFeedbackHandler.resolveFeedback(feedbackId)
      ).rejects.toThrow(CliError); // ApplicationError -> CliError
      // エラーコード検証修正
      await expect(
        cliFeedbackHandler.resolveFeedback(feedbackId)
      ).rejects.toHaveProperty('code', 'ERR_CLI_FEEDBACK_RESOLVE_ADAPTER'); // Specific code
      // emitErrorEvent の期待値を修正
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliFeedbackHandler',
        operation,
        expect.objectContaining({
          // processedError (CliError)
          name: 'CliError',
          code: 'ERR_CLI_FEEDBACK_RESOLVE_ADAPTER', // CliError に設定されるコード
          // cause は null
          context: expect.objectContaining({
            // エラーの context
            feedbackId,
            errorDetail: 'Cannot resolve feedback',
          }),
        }),
        null, // OperationContext (ここでは未使用)
        expect.objectContaining({
          // details (元の context)
          feedbackId,
          traceId: expect.any(String),
          requestId: expect.any(String),
        })
      );
    });
  });

  // --- feedback.js 由来のメソッドのテスト ---
  describe('getFeedbackStatus', () => {
    const taskId = 'T1';
    const operation = 'getFeedbackStatus';
    const mockFeedback = {
      feedback_loop: { task_id: taskId, feedback_status: 'open' },
    };

    test('should call feedbackManager.getFeedbackByTaskId and return result', async () => {
      mockFeedbackManagerAdapter.getFeedbackByTaskId.mockReturnValue(
        mockFeedback
      ); // 同期想定
      const result = await cliFeedbackHandler.getFeedbackStatus(taskId);
      expect(
        mockFeedbackManagerAdapter.getFeedbackByTaskId
      ).toHaveBeenCalledWith(taskId);
      expect(result).toEqual(mockFeedback);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Getting feedback status'),
        expect.objectContaining({
          taskId,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
      // ロガー検証修正
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          `Feedback status retrieved for task: ${taskId}`
        ),
        expect.objectContaining({
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
      // expectStandardizedEventEmittedAsync に変更
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'feedback_status_get_before', // イベント名を修正
        { taskId } // データ修正
      );
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'feedback_status_get_after', // イベント名を修正
        { taskId, feedbackFound: true } // データ修正
      );
    });

    test('should throw NotFoundError if feedback not found', async () => {
      mockFeedbackManagerAdapter.getFeedbackByTaskId.mockReturnValue(null); // 見つからない
      await expect(
        cliFeedbackHandler.getFeedbackStatus(taskId)
      ).rejects.toThrow(NotFoundError); // アサーションを NotFoundError に戻す
      // エラーコード検証修正
      await expect(
        cliFeedbackHandler.getFeedbackStatus(taskId)
      ).rejects.toHaveProperty('code', 'ERR_CLI_FEEDBACK_NOT_FOUND'); // Specific code
      // _handleError 内で emitErrorEvent が呼ばれることを検証
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliFeedbackHandler',
        operation,
        expect.objectContaining({
          // NotFoundError を期待
          name: 'NotFoundError',
          code: 'ERR_CLI_FEEDBACK_NOT_FOUND',
          context: expect.objectContaining({ taskId }),
        }),
        null,
        expect.objectContaining({
          // 元の context
          taskId,
          traceId: expect.any(String),
          requestId: expect.any(String),
        })
      );
      // logger.warn は呼ばれないはずなので削除
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliFeedbackHandler',
        operation,
        expect.objectContaining({
          // NotFoundError を期待
          name: 'NotFoundError',
          code: 'ERR_CLI_FEEDBACK_NOT_FOUND',
        }),
        null,
        expect.objectContaining({
          taskId,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    });

    test('should throw CliError and emit error event on adapter failure', async () => {
      const originalError = new Error('Get status error');
      mockFeedbackManagerAdapter.getFeedbackByTaskId.mockImplementation(() => {
        throw originalError;
      });
      await expect(
        cliFeedbackHandler.getFeedbackStatus(taskId)
      ).rejects.toThrow(CliError); // ApplicationError -> CliError
      // エラーコード検証修正
      await expect(
        cliFeedbackHandler.getFeedbackStatus(taskId)
      ).rejects.toHaveProperty(
        'code',
        'ERR_CLI_FEEDBACKHANDLER_GETFEEDBACKSTATUS'
      ); // 修正: クラス名を含むエラーコード
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliFeedbackHandler',
        operation,
        expect.objectContaining({
          // CliError でラップされていることを確認
          name: 'CliError',
          code: 'ERR_CLI_FEEDBACKHANDLER_GETFEEDBACKSTATUS', // 修正後のコード
          cause: originalError,
        }),
        null,
        expect.objectContaining({
          taskId,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    });
  });

  describe('reopenFeedback', () => {
    const taskId = 'T1';
    const operation = 'reopenFeedback';
    const mockFeedback = {
      feedback_loop: { task_id: taskId, feedback_status: 'resolved' },
    };
    const mockUpdatedFeedback = {
      feedback_loop: { task_id: taskId, feedback_status: 'open' },
    };

    test('should get feedback, call updateFeedbackStatus, and return result', async () => {
      mockFeedbackManagerAdapter.getFeedbackByTaskId.mockReturnValue(
        mockFeedback
      );
      mockFeedbackManagerAdapter.updateFeedbackStatus.mockReturnValue(
        mockUpdatedFeedback
      );
      const result = await cliFeedbackHandler.reopenFeedback(taskId);
      expect(
        mockFeedbackManagerAdapter.getFeedbackByTaskId
      ).toHaveBeenCalledWith(taskId);
      expect(
        mockFeedbackManagerAdapter.updateFeedbackStatus
      ).toHaveBeenCalledWith(mockFeedback, 'open');
      expect(result).toEqual(mockUpdatedFeedback);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Reopening feedback'),
        expect.objectContaining({
          taskId,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
      // ロガー検証修正
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          `Feedback reopened successfully for task: ${taskId}`
        ),
        expect.objectContaining({
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
      // expectStandardizedEventEmittedAsync に変更
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'feedback_reopen_before', // イベント名を修正
        { taskId } // データ修正
      );
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'feedback_reopen_after', // イベント名を修正
        { taskId, result: mockUpdatedFeedback } // データ修正
      );
    });

    test('should throw NotFoundError if feedback not found', async () => {
      mockFeedbackManagerAdapter.getFeedbackByTaskId.mockReturnValue(null);
      await expect(cliFeedbackHandler.reopenFeedback(taskId)).rejects.toThrow(
        NotFoundError // アサーションを NotFoundError に戻す
      );
      // エラーコード検証修正
      await expect(
        cliFeedbackHandler.reopenFeedback(taskId)
      ).rejects.toHaveProperty('code', 'ERR_CLI_FEEDBACK_NOT_FOUND'); // Specific code
      expect(
        mockFeedbackManagerAdapter.updateFeedbackStatus
      ).not.toHaveBeenCalled();
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliFeedbackHandler',
        operation,
        expect.objectContaining({
          // NotFoundError を期待
          name: 'NotFoundError',
          code: 'ERR_CLI_FEEDBACK_NOT_FOUND',
        }),
        null,
        expect.objectContaining({
          taskId,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    });

    test('should throw CliError and emit error event on adapter failure (update)', async () => {
      const originalError = new Error('Update status error');
      mockFeedbackManagerAdapter.getFeedbackByTaskId.mockReturnValue(
        mockFeedback
      );
      mockFeedbackManagerAdapter.updateFeedbackStatus.mockImplementation(() => {
        throw originalError;
      });
      await expect(cliFeedbackHandler.reopenFeedback(taskId)).rejects.toThrow(
        CliError // ApplicationError -> CliError
      );
      // エラーコード検証修正
      await expect(
        cliFeedbackHandler.reopenFeedback(taskId)
      ).rejects.toHaveProperty(
        'code',
        'ERR_CLI_FEEDBACKHANDLER_REOPENFEEDBACK'
      ); // 修正: クラス名を含むエラーコード
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliFeedbackHandler',
        operation,
        expect.objectContaining({
          // CliError でラップされていることを確認
          name: 'CliError',
          code: 'ERR_CLI_FEEDBACKHANDLER_REOPENFEEDBACK', // 修正後のコード
          cause: originalError,
        }),
        null,
        expect.objectContaining({
          taskId,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    });
  });

  describe('generateFeedbackReport', () => {
    const taskId = 'T1';
    const operation = 'generateFeedbackReport';
    const mockReportContent = '# Feedback Report';

    test('should call generateFeedbackMarkdown and return content if no path', async () => {
      mockFeedbackManagerAdapter.generateFeedbackMarkdown.mockReturnValue(
        mockReportContent
      );
      const result = await cliFeedbackHandler.generateFeedbackReport(taskId);
      expect(
        mockFeedbackManagerAdapter.generateFeedbackMarkdown
      ).toHaveBeenCalledWith(taskId);
      expect(result).toBe(mockReportContent);
      expect(mockStorageService.writeText).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Generating feedback report'),
        expect.objectContaining({
          taskId,
          outputPath: null,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
      // ロガー検証修正
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          `Feedback report generated successfully for task: ${taskId}`
        ),
        expect.objectContaining({
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
      // expectStandardizedEventEmittedAsync に変更
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'feedback_report_generate_before', // イベント名を修正
        { taskId, outputPath: null } // データ修正
      );
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'feedback_report_generate_after', // イベント名を修正
        { taskId, outputPath: null, reportLength: mockReportContent.length } // データ修正
      );
    });

    test('should call generateFeedbackMarkdown, write to file, and return path if path provided', async () => {
      const outputPath = 'reports/feedback.md';
      mockFeedbackManagerAdapter.generateFeedbackMarkdown.mockReturnValue(
        mockReportContent
      );
      mockStorageService.writeText.mockResolvedValue(true);
      const result = await cliFeedbackHandler.generateFeedbackReport(
        taskId,
        outputPath
      );
      expect(
        mockFeedbackManagerAdapter.generateFeedbackMarkdown
      ).toHaveBeenCalledWith(taskId);
      expect(mockStorageService.writeText).toHaveBeenCalledWith(
        '.',
        outputPath,
        mockReportContent
      );
      expect(result).toBe(outputPath);
      // ロガー検証修正
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          `Feedback report saved successfully to: ${outputPath}`
        ),
        expect.objectContaining({
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
      // expectStandardizedEventEmittedAsync に変更
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'feedback_report_generate_after', // イベント名を修正
        {
          taskId,
          outputPath: outputPath,
          reportLength: mockReportContent.length,
        } // データ修正
      );
    });

    test('should throw CliError if adapter returns null', async () => {
      // GenerateError -> CliError
      mockFeedbackManagerAdapter.generateFeedbackMarkdown.mockReturnValue(null);
      await expect(
        cliFeedbackHandler.generateFeedbackReport(taskId)
      ).rejects.toThrow(CliError); // ApplicationError -> CliError
      // エラーコード検証修正
      await expect(
        cliFeedbackHandler.generateFeedbackReport(taskId)
      ).rejects.toHaveProperty('code', 'ERR_CLI_FEEDBACK_REPORT_GENERATE'); // Specific code
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliFeedbackHandler',
        operation,
        expect.objectContaining({
          // CliError を期待
          name: 'CliError',
          code: 'ERR_CLI_FEEDBACK_REPORT_GENERATE',
        }),
        null,
        expect.objectContaining({
          taskId,
          outputPath: null,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    });

    test('should throw StorageError if storage service fails', async () => {
      // テスト名を修正
      const outputPath = 'reports/feedback.md';
      mockFeedbackManagerAdapter.generateFeedbackMarkdown.mockReturnValue(
        mockReportContent
      );
      mockStorageService.writeText.mockResolvedValue(false); // 書き込み失敗

      let caughtError;
      try {
        await cliFeedbackHandler.generateFeedbackReport(taskId, outputPath);
      } catch (error) {
        caughtError = error;
      }

      // エラーがスローされたことを確認
      expect(caughtError).toBeDefined();
      // エラーの name を検証
      expect(caughtError).toHaveProperty('name', 'StorageError');
      // エラーコードを検証 (指定されたコード)
      expect(caughtError).toHaveProperty('code', 'ERR_CLI_FILE_WRITE');

      // emitErrorEvent が1回だけ呼び出されたことを確認
      expect(emitErrorEvent).toHaveBeenCalledTimes(1);
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliFeedbackHandler',
        operation,
        expect.objectContaining({
          // StorageError インスタンスかつ特定のコードを持つことを期待
          name: 'StorageError',
          code: 'ERR_CLI_FILE_WRITE',
        }),
        null,
        expect.objectContaining({
          taskId,
          outputPath,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    });
  });

  // --- prioritizeFeedback ---
  describe('prioritizeFeedback', () => {
    const taskId = 'T1';
    const operation = 'prioritizeFeedback';
    const mockFeedback = { feedback_loop: { task_id: taskId } };
    const mockUpdatedFeedback = {
      feedback_loop: { task_id: taskId, priority: 1 },
    };

    test('should get feedback, call prioritizeFeedback, and return result', async () => {
      mockFeedbackManagerAdapter.getFeedbackByTaskId.mockReturnValue(
        mockFeedback
      );
      mockFeedbackManagerAdapter.prioritizeFeedback.mockReturnValue(
        mockUpdatedFeedback
      );
      const result = await cliFeedbackHandler.prioritizeFeedback(taskId);
      expect(
        mockFeedbackManagerAdapter.getFeedbackByTaskId
      ).toHaveBeenCalledWith(taskId);
      expect(
        mockFeedbackManagerAdapter.prioritizeFeedback
      ).toHaveBeenCalledWith(mockFeedback);
      expect(result).toEqual(mockUpdatedFeedback);
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'feedback_prioritize_before', // イベント名を修正
        { taskId } // データ修正
      );
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'feedback_prioritize_after', // イベント名を修正
        { taskId, result: mockUpdatedFeedback } // データ修正
      );
    });

    test('should throw NotFoundError if feedback not found', async () => {
      mockFeedbackManagerAdapter.getFeedbackByTaskId.mockReturnValue(null);
      await expect(
        cliFeedbackHandler.prioritizeFeedback(taskId)
      ).rejects.toThrow(NotFoundError); // アサーションを NotFoundError に戻す
      await expect(
        cliFeedbackHandler.prioritizeFeedback(taskId)
      ).rejects.toHaveProperty('code', 'ERR_CLI_FEEDBACK_NOT_FOUND'); // Specific code
      expect(emitErrorEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        operation,
        expect.objectContaining({
          // NotFoundError を期待
          name: 'NotFoundError',
          code: 'ERR_CLI_FEEDBACK_NOT_FOUND',
        }),
        null,
        expect.objectContaining({
          taskId,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    });

    test('should throw CliError on adapter failure', async () => {
      const originalError = new Error('Prioritize error');
      mockFeedbackManagerAdapter.getFeedbackByTaskId.mockReturnValue(
        mockFeedback
      );
      mockFeedbackManagerAdapter.prioritizeFeedback.mockImplementation(() => {
        throw originalError;
      });
      await expect(
        cliFeedbackHandler.prioritizeFeedback(taskId)
      ).rejects.toThrow(CliError); // ApplicationError -> CliError
      await expect(
        cliFeedbackHandler.prioritizeFeedback(taskId)
      ).rejects.toHaveProperty(
        'code',
        'ERR_CLI_FEEDBACKHANDLER_PRIORITIZEFEEDBACK'
      ); // 修正: クラス名を含むエラーコード
      expect(emitErrorEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        operation,
        expect.objectContaining({
          // CliError でラップされていることを確認
          name: 'CliError',
          code: 'ERR_CLI_FEEDBACKHANDLER_PRIORITIZEFEEDBACK', // 修正後のコード
          cause: originalError,
        }),
        null,
        expect.objectContaining({
          taskId,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    });
  });

  // --- linkFeedbackToCommit ---
  describe('linkFeedbackToCommit', () => {
    const taskId = 'T1';
    const commitHash = 'abc123def';
    const operation = 'linkFeedbackToCommit';
    const mockFeedback = { feedback_loop: { task_id: taskId } };

    test('should get feedback and call linkFeedbackToGitCommit', async () => {
      mockFeedbackManagerAdapter.getFeedbackByTaskId.mockReturnValue(
        mockFeedback
      );
      await cliFeedbackHandler.linkFeedbackToCommit(taskId, commitHash);
      expect(
        mockFeedbackManagerAdapter.getFeedbackByTaskId
      ).toHaveBeenCalledWith(taskId);
      expect(
        mockFeedbackManagerAdapter.linkFeedbackToGitCommit
      ).toHaveBeenCalledWith(mockFeedback, commitHash);
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'feedback_link_commit_before', // イベント名を修正
        { taskId, commitHash } // データ修正
      );
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'feedback_link_commit_after', // イベント名を修正
        { taskId, commitHash } // データ修正
      );
    });

    test('should throw NotFoundError if feedback not found', async () => {
      mockFeedbackManagerAdapter.getFeedbackByTaskId.mockReturnValue(null);
      await expect(
        cliFeedbackHandler.linkFeedbackToCommit(taskId, commitHash)
      ).rejects.toThrow(NotFoundError); // アサーションを NotFoundError に戻す
      await expect(
        cliFeedbackHandler.linkFeedbackToCommit(taskId, commitHash)
      ).rejects.toHaveProperty('code', 'ERR_CLI_FEEDBACK_NOT_FOUND'); // Specific code
      expect(emitErrorEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        operation,
        expect.objectContaining({
          // NotFoundError を期待
          name: 'NotFoundError',
          code: 'ERR_CLI_FEEDBACK_NOT_FOUND',
        }),
        null,
        expect.objectContaining({
          taskId,
          commitHash,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    });

    test('should throw CliError on adapter failure', async () => {
      const originalError = new Error('Link commit error');
      mockFeedbackManagerAdapter.getFeedbackByTaskId.mockReturnValue(
        mockFeedback
      );
      mockFeedbackManagerAdapter.linkFeedbackToGitCommit.mockImplementation(
        () => {
          throw originalError;
        }
      );
      await expect(
        cliFeedbackHandler.linkFeedbackToCommit(taskId, commitHash)
      ).rejects.toThrow(CliError); // ApplicationError -> CliError
      await expect(
        cliFeedbackHandler.linkFeedbackToCommit(taskId, commitHash)
      ).rejects.toHaveProperty(
        'code',
        'ERR_CLI_FEEDBACKHANDLER_LINKFEEDBACKTOCOMMIT'
      ); // 修正: クラス名を含むエラーコード
      expect(emitErrorEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        operation,
        expect.objectContaining({
          // CliError でラップされていることを確認
          name: 'CliError',
          code: 'ERR_CLI_FEEDBACKHANDLER_LINKFEEDBACKTOCOMMIT', // 修正後のコード
          cause: originalError,
        }),
        null,
        expect.objectContaining({
          taskId,
          commitHash,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    });
  });

  // --- linkFeedbackToSession ---
  describe('linkFeedbackToSession', () => {
    const taskId = 'T1';
    const sessionId = 'S123';
    const operation = 'linkFeedbackToSession';
    const mockFeedback = { feedback_loop: { task_id: taskId } };

    test('should get feedback and call linkFeedbackToSession', async () => {
      mockFeedbackManagerAdapter.getFeedbackByTaskId.mockReturnValue(
        mockFeedback
      );
      await cliFeedbackHandler.linkFeedbackToSession(taskId, sessionId);
      expect(
        mockFeedbackManagerAdapter.getFeedbackByTaskId
      ).toHaveBeenCalledWith(taskId);
      expect(
        mockFeedbackManagerAdapter.linkFeedbackToSession
      ).toHaveBeenCalledWith(mockFeedback, sessionId);
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'feedback_link_session_before', // イベント名を修正
        { taskId, sessionId } // データ修正
      );
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'feedback_link_session_after', // イベント名を修正
        { taskId, sessionId } // データ修正
      );
    });

    test('should throw NotFoundError if feedback not found', async () => {
      mockFeedbackManagerAdapter.getFeedbackByTaskId.mockReturnValue(null);
      await expect(
        cliFeedbackHandler.linkFeedbackToSession(taskId, sessionId)
      ).rejects.toThrow(NotFoundError); // アサーションを NotFoundError に戻す
      await expect(
        cliFeedbackHandler.linkFeedbackToSession(taskId, sessionId)
      ).rejects.toHaveProperty('code', 'ERR_CLI_FEEDBACK_NOT_FOUND'); // Specific code
      expect(emitErrorEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        operation,
        expect.objectContaining({
          // NotFoundError を期待
          name: 'NotFoundError',
          code: 'ERR_CLI_FEEDBACK_NOT_FOUND',
        }),
        null,
        expect.objectContaining({
          taskId,
          sessionId,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    });

    test('should throw CliError on adapter failure', async () => {
      const originalError = new Error('Link session error');
      mockFeedbackManagerAdapter.getFeedbackByTaskId.mockReturnValue(
        mockFeedback
      );
      mockFeedbackManagerAdapter.linkFeedbackToSession.mockImplementation(
        () => {
          throw originalError;
        }
      );
      await expect(
        cliFeedbackHandler.linkFeedbackToSession(taskId, sessionId)
      ).rejects.toThrow(CliError); // ApplicationError -> CliError
      await expect(
        cliFeedbackHandler.linkFeedbackToSession(taskId, sessionId)
      ).rejects.toHaveProperty(
        'code',
        'ERR_CLI_FEEDBACKHANDLER_LINKFEEDBACKTOSESSION' // 修正: クラス名を含むエラーコード
      );
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter, // expect.anything() を具体的なモックに変更
        mockLogger, // expect.anything() を具体的なモックに変更
        'CliFeedbackHandler', // expect.anything() を具体的なクラス名に変更
        operation,
        expect.objectContaining({
          // CliError でラップされていることを確認
          name: 'CliError',
          code: 'ERR_CLI_FEEDBACKHANDLER_LINKFEEDBACKTOSESSION', // 修正後のコード
          cause: originalError,
        }),
        null,
        expect.objectContaining({
          taskId,
          sessionId,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    });
  });

  // --- integrateFeedbackWithTask ---
  describe('integrateFeedbackWithTask', () => {
    const taskId = 'T1';
    const operation = 'integrateFeedbackWithTask';

    test('should call integrateFeedbackWithTask and return true on success', async () => {
      mockFeedbackManagerAdapter.integrateFeedbackWithTask.mockResolvedValue(
        true
      );
      const result = await cliFeedbackHandler.integrateFeedbackWithTask(taskId);
      expect(
        mockFeedbackManagerAdapter.integrateFeedbackWithTask
      ).toHaveBeenCalledWith(taskId, taskId);
      expect(result).toBe(true);
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'feedback_integrate_task_before', // イベント名を修正
        { taskId } // データ修正
      );
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'feedback_integrate_task_after', // イベント名を修正
        { taskId, success: true } // データ修正
      );
    });

    test('should throw CliError if adapter returns false', async () => {
      // ApplicationError -> CliError
      mockFeedbackManagerAdapter.integrateFeedbackWithTask.mockResolvedValue(
        false
      );
      await expect(
        cliFeedbackHandler.integrateFeedbackWithTask(taskId)
      ).rejects.toThrow(CliError); // ApplicationError -> CliError
      await expect(
        cliFeedbackHandler.integrateFeedbackWithTask(taskId)
      ).rejects.toHaveProperty(
        'code',
        'ERR_CLI_FEEDBACK_INTEGRATE_TASK_FAILED'
      ); // Specific code
      expect(emitErrorEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        operation,
        expect.objectContaining({
          // CliError を期待
          name: 'CliError',
          code: 'ERR_CLI_FEEDBACK_INTEGRATE_TASK_FAILED',
        }),
        null,
        expect.objectContaining({
          taskId,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    });

    test('should throw CliError on adapter failure', async () => {
      const originalError = new Error('Integrate task error');
      mockFeedbackManagerAdapter.integrateFeedbackWithTask.mockRejectedValue(
        originalError
      );
      await expect(
        cliFeedbackHandler.integrateFeedbackWithTask(taskId)
      ).rejects.toThrow(CliError); // ApplicationError -> CliError
      await expect(
        cliFeedbackHandler.integrateFeedbackWithTask(taskId)
      ).rejects.toHaveProperty(
        'code',
        'ERR_CLI_FEEDBACKHANDLER_INTEGRATEFEEDBACKWITHTASK' // 修正: クラス名を含むエラーコード
      );
      expect(emitErrorEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        operation,
        expect.objectContaining({
          // CliError でラップされていることを確認
          name: 'CliError',
          code: 'ERR_CLI_FEEDBACKHANDLER_INTEGRATEFEEDBACKWITHTASK', // 修正後のコード
          cause: originalError,
        }),
        null,
        expect.objectContaining({
          taskId,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    });
  });

  // --- integrateFeedbackWithSession ---
  describe('integrateFeedbackWithSession', () => {
    const taskId = 'T1';
    const sessionId = 'S123';
    const operation = 'integrateFeedbackWithSession';

    test('should call integrateFeedbackWithSession and return true on success', async () => {
      mockFeedbackManagerAdapter.integrateFeedbackWithSession.mockResolvedValue(
        true
      );
      const result = await cliFeedbackHandler.integrateFeedbackWithSession(
        taskId,
        sessionId
      );
      expect(
        mockFeedbackManagerAdapter.integrateFeedbackWithSession
      ).toHaveBeenCalledWith(taskId, sessionId);
      expect(result).toBe(true);
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'feedback_integrate_session_before', // イベント名を修正
        { taskId, sessionId } // データ修正
      );
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'feedback_integrate_session_after', // イベント名を修正
        { taskId, sessionId, success: true } // データ修正
      );
    });

    test('should throw CliError if adapter returns false', async () => {
      // ApplicationError -> CliError
      mockFeedbackManagerAdapter.integrateFeedbackWithSession.mockResolvedValue(
        false
      );
      await expect(
        cliFeedbackHandler.integrateFeedbackWithSession(taskId, sessionId)
      ).rejects.toThrow(CliError); // ApplicationError -> CliError
      await expect(
        cliFeedbackHandler.integrateFeedbackWithSession(taskId, sessionId)
      ).rejects.toHaveProperty(
        'code',
        'ERR_CLI_FEEDBACK_INTEGRATE_SESSION_FAILED'
      ); // Specific code
      expect(emitErrorEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        operation,
        expect.objectContaining({
          // CliError を期待
          name: 'CliError',
          code: 'ERR_CLI_FEEDBACK_INTEGRATE_SESSION_FAILED',
        }),
        null,
        expect.objectContaining({
          taskId,
          sessionId,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    });

    test('should throw CliError on adapter failure', async () => {
      const originalError = new Error('Integrate session error');
      mockFeedbackManagerAdapter.integrateFeedbackWithSession.mockRejectedValue(
        originalError
      );
      await expect(
        cliFeedbackHandler.integrateFeedbackWithSession(taskId, sessionId)
      ).rejects.toThrow(CliError); // ApplicationError -> CliError
      await expect(
        cliFeedbackHandler.integrateFeedbackWithSession(taskId, sessionId)
      ).rejects.toHaveProperty(
        'code',
        'ERR_CLI_FEEDBACKHANDLER_INTEGRATEFEEDBACKWITHSESSION' // 修正: クラス名を含むエラーコード
      );
      expect(emitErrorEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        operation,
        expect.objectContaining({
          // CliError でラップされていることを確認
          name: 'CliError',
          code: 'ERR_CLI_FEEDBACKHANDLER_INTEGRATEFEEDBACKWITHSESSION', // 修正後のコード
          cause: originalError,
        }),
        null,
        expect.objectContaining({
          taskId,
          sessionId,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    });
  });
});

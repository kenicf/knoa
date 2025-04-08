const CliSessionManager = require('../../src/cli/session-manager');
const {
  ApplicationError,
  CliError,
  NotFoundError,
  StorageError, // FileReadError, FileWriteError を StorageError に変更
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

describe('CliSessionManager', () => {
  let mockLogger;
  let mockEventEmitter;
  let mockIntegrationManagerAdapter;
  let mockSessionManagerAdapter;
  let mockStorageService;
  let mockErrorHandler;
  let cliSessionManager;

  let mockDependencies; // モック依存関係を保持する変数

  beforeEach(() => {
    mockDependencies = createMockDependencies(); // 共通モックを生成
    mockLogger = mockDependencies.logger; // 個別変数にも代入
    mockEventEmitter = mockDependencies.eventEmitter; // 個別変数にも代入
    mockIntegrationManagerAdapter = mockDependencies.integrationManagerAdapter; // 共通モックから取得
    mockSessionManagerAdapter = mockDependencies.sessionManagerAdapter; // 共通モックから取得
    mockStorageService = mockDependencies.storageService; // 共通モックから取得
    mockErrorHandler = mockDependencies.errorHandler; // 共通モックから取得

    // モックメソッドを再設定 (必要に応じて)
    mockIntegrationManagerAdapter.startSession = jest.fn();
    mockIntegrationManagerAdapter.endSession = jest.fn();
    mockSessionManagerAdapter.getLatestSession = jest.fn();
    mockSessionManagerAdapter.getAllSessions = jest.fn();
    mockSessionManagerAdapter.getSession = jest.fn();
    mockSessionManagerAdapter.importSession = jest.fn();
    mockSessionManagerAdapter.createNewSession = jest.fn();
    mockSessionManagerAdapter.endSession = jest.fn();
    mockStorageService.writeText = jest.fn(); // writeText もモック化
    mockStorageService.readJSON = jest.fn();
    mockStorageService.writeJSON = jest.fn();
    mockErrorHandler = {
      handle: jest.fn(),
    };

    // テスト対象インスタンスを作成
    cliSessionManager = new CliSessionManager({
      logger: mockLogger,
      eventEmitter: mockEventEmitter,
      integrationManagerAdapter: mockIntegrationManagerAdapter,
      sessionManagerAdapter: mockSessionManagerAdapter,
      storageService: mockStorageService,
      traceIdGenerator: mockDependencies.traceIdGenerator, // 注入
      requestIdGenerator: mockDependencies.requestIdGenerator, // 注入
      // errorHandler: mockErrorHandler, // エラーハンドラーテスト時に有効化
    });

    emitErrorEvent.mockClear();
  });

  describe('constructor', () => {
    test('should throw ApplicationError if required dependencies are missing', () => {
      expect(() => new CliSessionManager({})).toThrow(ApplicationError);
      expect(() => new CliSessionManager({ logger: mockLogger })).toThrow(
        ApplicationError
      );
      // storageService も必須
      expect(
        () =>
          new CliSessionManager({
            logger: mockLogger,
            eventEmitter: mockEventEmitter,
            integrationManagerAdapter: mockIntegrationManagerAdapter,
            sessionManagerAdapter: mockSessionManagerAdapter,
            // storageService: mockStorageService, // ← これがないとエラー
          })
      ).toThrow(ApplicationError);
    });
  });

  describe('startSession', () => {
    const previousSessionId = 'S000';
    const mockSuccessResult = { session_id: 'S001', started: true };
    const operation = 'startSession';

    test('should call integrationManager.startSession and return result on success', async () => {
      mockIntegrationManagerAdapter.startSession.mockResolvedValue(
        mockSuccessResult
      );

      const result = await cliSessionManager.startSession(previousSessionId);

      expect(mockIntegrationManagerAdapter.startSession).toHaveBeenCalledTimes(
        1
      );
      expect(mockIntegrationManagerAdapter.startSession).toHaveBeenCalledWith(
        previousSessionId
      );
      expect(result).toEqual(mockSuccessResult);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Starting new session'),
        expect.objectContaining({
          previousSessionId,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
      // ロガー検証修正: 成功メッセージとIDを含むことを確認
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Session started successfully: S001'),
        expect.objectContaining({
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    });

    test('should emit _before and _after events on success', async () => {
      mockIntegrationManagerAdapter.startSession.mockResolvedValue(
        mockSuccessResult
      );
      await cliSessionManager.startSession(previousSessionId);
      // expectStandardizedEventEmittedAsync に変更
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'session_start_before', // 実装に合わせる
        { previousSessionId } // expectedData (traceId/requestId はヘルパーが検証)
      );
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'session_start_after', // 実装に合わせる
        { previousSessionId, result: mockSuccessResult } // expectedData
      );
    });

    test('should throw CliError and emit error event if integrationManager throws error', async () => {
      const originalError = new Error('API error');
      mockIntegrationManagerAdapter.startSession.mockRejectedValue(
        originalError
      );

      await expect(
        cliSessionManager.startSession(previousSessionId)
      ).rejects.toThrow(CliError);
      // エラーコード検証修正
      await expect(
        cliSessionManager.startSession(previousSessionId)
      ).rejects.toHaveProperty('code', 'ERR_CLI_SESSIONMANAGER_STARTSESSION'); // 修正: クラス名を含むエラーコード
      await expect(
        cliSessionManager.startSession(previousSessionId)
      ).rejects.toHaveProperty('cause', originalError);

      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliSessionManager',
        operation,
        expect.objectContaining({
          // CliError でラップされていることを確認
          name: 'CliError',
          code: 'ERR_CLI_SESSIONMANAGER_STARTSESSION', // 修正後のコード
          cause: originalError,
        }),
        null,
        expect.objectContaining({
          previousSessionId,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    });
    test('should throw CliError if integrationManager returns error object', async () => {
      const errorResult = { error: 'Internal server error' };
      mockIntegrationManagerAdapter.startSession.mockResolvedValue(errorResult);

      // エラーのスローとプロパティ検証を1つにまとめる
      await expect(
        cliSessionManager.startSession(previousSessionId)
      ).rejects.toThrow(
        // toThrowError を使用
        // エラーオブジェクトのプロパティを検証
        expect.objectContaining({
          name: 'CliError',
          code: 'ERR_CLI_SESSION_START_FAILED',
          context: expect.objectContaining({
            errorDetail: 'Internal server error',
            previousSessionId: 'S000',
          }),
        })
      );

      // emitErrorEvent の期待値を修正
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliSessionManager',
        operation,
        expect.objectContaining({
          // processedError (CliError)
          name: 'CliError',
          code: 'ERR_CLI_SESSION_START_FAILED', // CliError に設定されるコード
          // cause はここでは null (元エラーがないため)
          context: expect.objectContaining({
            errorDetail: 'Internal server error',
            previousSessionId: 'S000',
          }), // context の期待値を修正
        }),
        null, // OperationContext (ここでは未使用)
        expect.objectContaining({
          // details (元の context)
          previousSessionId,
          traceId: expect.any(String),
          requestId: expect.any(String),
        })
      );
    });

    test('should call errorHandler.handle if provided on adapter failure', async () => {
      // Arrange
      // errorHandler を設定してインスタンス再作成
      cliSessionManager = new CliSessionManager({
        logger: mockLogger,
        eventEmitter: mockEventEmitter,
        integrationManagerAdapter: mockIntegrationManagerAdapter,
        sessionManagerAdapter: mockSessionManagerAdapter,
        storageService: mockStorageService,
        errorHandler: mockErrorHandler, // errorHandler を提供
        traceIdGenerator: mockDependencies.traceIdGenerator,
        requestIdGenerator: mockDependencies.requestIdGenerator,
      });
      const originalError = new Error('API error');
      mockIntegrationManagerAdapter.startSession.mockRejectedValue(
        originalError
      );
      const errorHandlerResult = { handled: true, fallbackSession: null };
      mockErrorHandler.handle.mockReturnValue(errorHandlerResult);

      // Act
      const result = await cliSessionManager.startSession(previousSessionId);

      // Assert
      expect(mockErrorHandler.handle).toHaveBeenCalledTimes(1);
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.objectContaining({
          // CliError を期待
          name: 'CliError',
          code: 'ERR_CLI_SESSIONMANAGER_STARTSESSION', // 修正後のコード
          cause: originalError,
        }),
        'CliSessionManager',
        operation,
        expect.objectContaining({ previousSessionId })
      );
      expect(result).toEqual(errorHandlerResult); // errorHandler の戻り値が返る
      expect(emitErrorEvent).toHaveBeenCalledTimes(1); // エラーイベントは発行される
    });
  });

  describe('endSession', () => {
    const sessionId = 'S001';
    const mockSuccessResult = {
      session_id: sessionId,
      ended_at: new Date().toISOString(),
      handover_document: '# Handover',
    };
    const operation = 'endSession';
    const handoverDir = path.join('ai-context', 'sessions');
    const handoverFilename = 'session-handover.md';

    test('should call integrationManager.endSession and save handover doc on success (with sessionId)', async () => {
      mockIntegrationManagerAdapter.endSession.mockResolvedValue(
        mockSuccessResult
      );
      mockStorageService.writeText.mockResolvedValue(true); // 保存成功

      const result = await cliSessionManager.endSession(sessionId);

      expect(mockIntegrationManagerAdapter.endSession).toHaveBeenCalledTimes(1);
      expect(mockIntegrationManagerAdapter.endSession).toHaveBeenCalledWith(
        sessionId
      );
      expect(mockStorageService.writeText).toHaveBeenCalledTimes(1);
      expect(mockStorageService.writeText).toHaveBeenCalledWith(
        handoverDir,
        handoverFilename,
        mockSuccessResult.handover_document
      );
      expect(result).toEqual(mockSuccessResult);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Ending session'),
        expect.objectContaining({
          sessionId,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
      // ロガー検証修正: パスを含むことを確認
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          `Handover document saved to ${path.join(handoverDir, handoverFilename)}`
        ),
        expect.objectContaining({
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
      // ロガー検証修正: 1つの引数に両方の情報が含まれることを確認
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Session ended successfully: ${sessionId}`),
        expect.objectContaining({
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    });

    test('should get latest session ID if sessionId is not provided', async () => {
      const latestSession = { session_id: 'S_LATEST' };
      mockSessionManagerAdapter.getLatestSession.mockResolvedValue(
        latestSession
      );
      mockIntegrationManagerAdapter.endSession.mockResolvedValue({
        ...mockSuccessResult,
        session_id: latestSession.session_id,
      });
      mockStorageService.writeText.mockResolvedValue(true);

      await cliSessionManager.endSession(); // sessionId なしで呼び出し

      expect(mockSessionManagerAdapter.getLatestSession).toHaveBeenCalledTimes(
        1
      );
      expect(mockIntegrationManagerAdapter.endSession).toHaveBeenCalledWith(
        latestSession.session_id
      );
      expect(mockStorageService.writeText).toHaveBeenCalledTimes(1);
    });

    test('should throw NotFoundError if no active session found when sessionId is not provided', async () => {
      mockSessionManagerAdapter.getLatestSession.mockResolvedValue(null); // アクティブセッションなし

      // expect(...).rejects を使用してエラーを検証
      await expect(cliSessionManager.endSession()).rejects.toThrow(
        NotFoundError
      );
      await expect(cliSessionManager.endSession()).rejects.toHaveProperty(
        'code',
        'ERR_CLI_NO_ACTIVE_SESSION'
      );
      // 元のエラーコード検証は expect 内に含めたので削除

      expect(mockIntegrationManagerAdapter.endSession).not.toHaveBeenCalled();
      expect(mockStorageService.writeText).not.toHaveBeenCalled();
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliSessionManager',
        operation,
        expect.objectContaining({
          // NotFoundError を期待
          name: 'NotFoundError',
          code: 'ERR_CLI_NO_ACTIVE_SESSION',
        }),
        null,
        expect.objectContaining({
          sessionId: null,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    });

    test('should emit _before and _after events on success', async () => {
      mockIntegrationManagerAdapter.endSession.mockResolvedValue(
        mockSuccessResult
      );
      mockStorageService.writeText.mockResolvedValue(true);
      await cliSessionManager.endSession(sessionId);
      // expectStandardizedEventEmittedAsync に変更
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'session_end_before', // 実装に合わせる
        { sessionId }
      );
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'session_end_after', // 実装に合わせる
        { sessionId: sessionId, result: mockSuccessResult } // 変数名を修正
      );
    });

    test('should log warning but not throw if saving handover doc fails', async () => {
      mockIntegrationManagerAdapter.endSession.mockResolvedValue(
        mockSuccessResult
      );
      mockStorageService.writeText.mockResolvedValue(false); // 保存失敗

      const result = await cliSessionManager.endSession(sessionId);

      expect(result).toEqual(mockSuccessResult); // エラーはスローされない
      // ログレベルを warn から error に修正し、期待される引数を実装に合わせる
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to save handover document.'),
        expect.objectContaining({
          error: expect.objectContaining({
            // error プロパティを検証
            name: 'StorageError', // エラーの型
            code: 'ERR_CLI_HANDOVER_SAVE', // エラーコード
            context: expect.objectContaining({ sessionId }), // エラーコンテキスト
          }),
          traceId: expect.any(String),
          requestId: expect.any(String),
        })
      );
      // ロガー検証修正
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Session ended successfully: ${sessionId}`),
        expect.objectContaining({
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
      expect(emitErrorEvent).not.toHaveBeenCalled(); // エラーイベントは発行されない
    });

    test('should throw CliError and emit error event if integrationManager throws error', async () => {
      const originalError = new Error('End session API error');
      mockIntegrationManagerAdapter.endSession.mockRejectedValue(originalError);

      await expect(cliSessionManager.endSession(sessionId)).rejects.toThrow(
        CliError // ApplicationError -> CliError
      );
      // エラーコード検証修正
      await expect(
        cliSessionManager.endSession(sessionId)
      ).rejects.toHaveProperty('code', 'ERR_CLI_SESSIONMANAGER_ENDSESSION'); // 修正: クラス名を含むエラーコード
      await expect(
        cliSessionManager.endSession(sessionId)
      ).rejects.toHaveProperty('cause', originalError);

      expect(mockStorageService.writeText).not.toHaveBeenCalled();
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliSessionManager',
        operation,
        expect.objectContaining({
          // CliError でラップされていることを確認
          name: 'CliError',
          code: 'ERR_CLI_SESSIONMANAGER_ENDSESSION', // 修正後のコード
          cause: originalError,
        }),
        null,
        expect.objectContaining({
          sessionId,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    });
  });

  // --- listSessions, getCurrentSessionInfo, getSessionInfo のテスト ---
  describe('listSessions', () => {
    const operation = 'listSessions';
    const mockSessions = [{ session_id: 'S1' }, { session_id: 'S2' }];

    test('should call sessionManager.getAllSessions and return result', async () => {
      mockSessionManagerAdapter.getAllSessions.mockResolvedValue(mockSessions);
      const result = await cliSessionManager.listSessions();
      expect(mockSessionManagerAdapter.getAllSessions).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockSessions);
      // logger.info が2回呼び出されることを確認
      expect(mockLogger.info).toHaveBeenCalledTimes(2);
      // 1回目の呼び出しを検証
      expect(mockLogger.info).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('Listing all sessions...'), // メッセージを修正
        expect.objectContaining({
          // operation を削除
          traceId: expect.any(String),
          requestId: expect.any(String),
        })
      );
      // 2回目の呼び出しを検証
      expect(mockLogger.info).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining(`Found ${mockSessions.length} sessions.`), // メッセージを修正
        expect.objectContaining({
          // operation を削除
          traceId: expect.any(String),
          requestId: expect.any(String),
        })
      );
      // ロガー検証修正
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Found ${mockSessions.length} sessions.`),
        expect.objectContaining({
          // operation を削除
          traceId: expect.any(String),
          requestId: expect.any(String),
        })
      );
      // expectStandardizedEventEmittedAsync に変更
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'session_list_before', // 実装に合わせる
        {} // データなし
      );
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'session_list_after', // 実装に合わせる
        { count: mockSessions.length }
      );
    });

    test('should return empty array if no sessions found', async () => {
      mockSessionManagerAdapter.getAllSessions.mockResolvedValue(null);
      const result = await cliSessionManager.listSessions();
      expect(result).toEqual([]);
      // ロガー検証修正
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Found 0 sessions.'),
        expect.objectContaining({
          // operation を削除
          traceId: expect.any(String),
          requestId: expect.any(String),
        })
      );
      // expectStandardizedEventEmittedAsync に変更
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'session_list_after', // 実装に合わせる
        { count: 0 }
      );
    });

    test('should throw CliError and emit error event on failure', async () => {
      const originalError = new Error('DB error');
      mockSessionManagerAdapter.getAllSessions.mockRejectedValue(originalError);
      await expect(cliSessionManager.listSessions()).rejects.toThrow(
        CliError // ApplicationError -> CliError
      );
      // エラーコード検証修正
      await expect(cliSessionManager.listSessions()).rejects.toHaveProperty(
        'code',
        'ERR_CLI_SESSIONMANAGER_LISTSESSIONS' // 修正: クラス名を含むエラーコード
      );
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliSessionManager',
        operation,
        expect.objectContaining({
          // CliError でラップされていることを確認
          name: 'CliError',
          code: 'ERR_CLI_SESSIONMANAGER_LISTSESSIONS', // 修正後のコード
          cause: originalError,
        }),
        null,
        expect.objectContaining({
          // operation を削除
          traceId: expect.any(String),
          requestId: expect.any(String),
        })
      );
    });
  });

  describe('getCurrentSessionInfo', () => {
    const operation = 'getCurrentSessionInfo';
    const mockSession = { session_id: 'S_LATEST' };

    test('should call sessionManager.getLatestSession and return result', async () => {
      mockSessionManagerAdapter.getLatestSession.mockResolvedValue(mockSession);
      const result = await cliSessionManager.getCurrentSessionInfo();
      expect(mockSessionManagerAdapter.getLatestSession).toHaveBeenCalledTimes(
        1
      );
      expect(result).toEqual(mockSession);
      // logger.info が2回呼び出されることを確認
      expect(mockLogger.info).toHaveBeenCalledTimes(2);
      // 1回目の呼び出しを検証
      expect(mockLogger.info).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('Getting current session info...'), // メッセージ修正
        expect.objectContaining({
          // operation を削除
          traceId: expect.any(String),
          requestId: expect.any(String),
        })
      );
      // 2回目の呼び出しを検証
      expect(mockLogger.info).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining(
          `Current session found: ${mockSession.session_id}`
        ), // メッセージ修正
        expect.objectContaining({
          // operation を削除
          traceId: expect.any(String),
          requestId: expect.any(String),
        })
      );
      // ロガー検証修正
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          `Current session found: ${mockSession.session_id}`
        ),
        expect.objectContaining({
          // operation を削除
          traceId: expect.any(String),
          requestId: expect.any(String),
        })
      );
      // expectStandardizedEventEmittedAsync に変更
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'session_current_get_before', // 実装に合わせる
        {}
      );
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'session_current_get_after', // 実装に合わせる
        { sessionFound: true }
      );
    });

    test('should return null if no active session found', async () => {
      mockSessionManagerAdapter.getLatestSession.mockResolvedValue(null);
      const result = await cliSessionManager.getCurrentSessionInfo();
      expect(result).toBeNull();
      // ロガー検証修正
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('No active session found.'),
        expect.objectContaining({
          // operation を削除
          traceId: expect.any(String),
          requestId: expect.any(String),
        })
      );
      // expectStandardizedEventEmittedAsync に変更
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'session_current_get_after', // 実装に合わせる
        { sessionFound: false }
      );
    });

    test('should throw CliError and emit error event on failure', async () => {
      const originalError = new Error('Adapter error');
      mockSessionManagerAdapter.getLatestSession.mockRejectedValue(
        originalError
      );
      await expect(cliSessionManager.getCurrentSessionInfo()).rejects.toThrow(
        CliError // ApplicationError -> CliError
      );
      // エラーコード検証修正
      await expect(
        cliSessionManager.getCurrentSessionInfo()
      ).rejects.toHaveProperty(
        'code',
        'ERR_CLI_SESSIONMANAGER_GETCURRENTSESSIONINFO'
      ); // 修正: クラス名を含むエラーコード
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliSessionManager',
        operation,
        expect.objectContaining({
          // CliError でラップされていることを確認
          name: 'CliError',
          code: 'ERR_CLI_SESSIONMANAGER_GETCURRENTSESSIONINFO', // 修正後のコード
          cause: originalError,
        }),
        null,
        expect.objectContaining({
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    });
  });

  describe('getSessionInfo', () => {
    const sessionId = 'S123';
    const operation = 'getSessionInfo';
    const mockSession = { session_id: sessionId, data: '...' };

    test('should call sessionManager.getSession and return result', async () => {
      mockSessionManagerAdapter.getSession.mockResolvedValue(mockSession);
      const result = await cliSessionManager.getSessionInfo(sessionId);
      expect(mockSessionManagerAdapter.getSession).toHaveBeenCalledWith(
        sessionId
      );
      expect(result).toEqual(mockSession);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Getting session info'),
        expect.objectContaining({
          sessionId,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
      // ロガー検証修正
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Session info retrieved for: ${sessionId}`),
        expect.objectContaining({
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
      // expectStandardizedEventEmittedAsync に変更
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'session_info_get_before', // 実装に合わせる
        { sessionId }
      );
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'session_info_get_after', // 実装に合わせる
        { sessionId, sessionFound: true }
      );
    });

    test('should throw NotFoundError if session not found', async () => {
      mockSessionManagerAdapter.getSession.mockResolvedValue(null);

      // expect(...).rejects を使用してエラーを検証
      await expect(cliSessionManager.getSessionInfo(sessionId)).rejects.toThrow(
        NotFoundError
      );
      await expect(
        cliSessionManager.getSessionInfo(sessionId)
      ).rejects.toHaveProperty('code', 'ERR_CLI_SESSION_NOT_FOUND');

      // _handleError 内で emitErrorEvent が呼ばれることを検証
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliSessionManager',
        operation,
        expect.objectContaining({
          // NotFoundError を期待
          name: 'NotFoundError',
          code: 'ERR_CLI_SESSION_NOT_FOUND',
          context: expect.objectContaining({ sessionId }),
        }),
        null,
        expect.objectContaining({
          // 元の context
          sessionId,
          traceId: expect.any(String),
          requestId: expect.any(String),
        })
      );
      // logger.warn は呼ばれないはずなので削除
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliSessionManager',
        operation,
        expect.objectContaining({
          // NotFoundError を期待
          name: 'NotFoundError',
          code: 'ERR_CLI_SESSION_NOT_FOUND',
        }),
        null,
        expect.objectContaining({
          sessionId,
          traceId: expect.any(String),
          requestId: expect.any(String),
        })
      );
    });

    test('should throw CliError and emit error event on adapter failure', async () => {
      const originalError = new Error('DB connection error');
      mockSessionManagerAdapter.getSession.mockRejectedValue(originalError);
      await expect(cliSessionManager.getSessionInfo(sessionId)).rejects.toThrow(
        CliError // ApplicationError -> CliError
      );
      // エラーコード検証修正
      await expect(
        cliSessionManager.getSessionInfo(sessionId)
      ).rejects.toHaveProperty('code', 'ERR_CLI_SESSIONMANAGER_GETSESSIONINFO'); // 修正: クラス名を含むエラーコード
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliSessionManager',
        operation,
        expect.objectContaining({
          // CliError でラップされていることを確認
          name: 'CliError',
          code: 'ERR_CLI_SESSIONMANAGER_GETSESSIONINFO', // 修正後のコード
          cause: originalError,
        }),
        null,
        expect.objectContaining({
          sessionId,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    });
  });

  // --- exportSession, importSession のテスト ---
  describe('exportSession', () => {
    const sessionId = 'S123';
    const operation = 'exportSession';
    const mockSession = { session_id: sessionId, data: 'export data' };
    const defaultPath = `session-${sessionId}-export.json`;

    test('should get session, write to default path using StorageService, and return path', async () => {
      mockSessionManagerAdapter.getSession.mockResolvedValue(mockSession);
      mockStorageService.writeJSON.mockResolvedValue(true);

      const resultPath = await cliSessionManager.exportSession(sessionId);

      expect(mockSessionManagerAdapter.getSession).toHaveBeenCalledWith(
        sessionId
      );
      expect(mockStorageService.writeJSON).toHaveBeenCalledWith(
        '.',
        defaultPath,
        mockSession
      );
      expect(resultPath).toBe(defaultPath);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Exporting session'),
        expect.objectContaining({
          sessionId,
          outputPath: null,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
      // ロガー検証修正
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          `Session exported successfully to: ${defaultPath}`
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
        'session_export_before', // 実装に合わせる
        { sessionId, outputPath: null }
      );
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'session_export_after', // 実装に合わせる
        { sessionId, path: defaultPath }
      );
    });

    test('should use provided output path', async () => {
      const customPath = 'my/custom/export.json';
      mockSessionManagerAdapter.getSession.mockResolvedValue(mockSession);
      mockStorageService.writeJSON.mockResolvedValue(true);

      const resultPath = await cliSessionManager.exportSession(
        sessionId,
        customPath
      );

      expect(mockStorageService.writeJSON).toHaveBeenCalledWith(
        '.',
        customPath,
        mockSession
      );
      expect(resultPath).toBe(customPath);
      // expectStandardizedEventEmittedAsync に変更
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'session_export_after', // 実装に合わせる
        { sessionId, path: customPath }
      );
    });

    test('should throw NotFoundError if session not found', async () => {
      mockSessionManagerAdapter.getSession.mockResolvedValue(null);
      await expect(
        cliSessionManager.exportSession(sessionId)
      ).rejects.toHaveProperty('name', 'NotFoundError');
      // エラーコード検証修正
      await expect(
        cliSessionManager.exportSession(sessionId)
      ).rejects.toHaveProperty('code', 'ERR_CLI_SESSION_NOT_FOUND'); // Specific code
      expect(mockStorageService.writeJSON).not.toHaveBeenCalled();
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliSessionManager',
        operation,
        expect.objectContaining({
          // NotFoundError を期待
          name: 'NotFoundError',
          code: 'ERR_CLI_SESSION_NOT_FOUND',
        }),
        null,
        expect.objectContaining({
          sessionId,
          outputPath: null,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    });

    test('should throw StorageError if StorageService fails', async () => {
      // テスト名修正
      mockSessionManagerAdapter.getSession.mockResolvedValue(mockSession);
      // StorageService が StorageError をスローするようにモック (第2引数に options を渡し、cause も含める)
      const storageError = new StorageError('Write failed', {
        // 第2引数が options
        cause: null, // cause は options 内に含める
        code: 'ERR_CLI_FILE_WRITE',
        context: { sessionId, path: defaultPath },
      });
      mockStorageService.writeJSON.mockRejectedValue(storageError);

      await expect(cliSessionManager.exportSession(sessionId)).rejects.toThrow(
        StorageError // Expect StorageError
      );
      // エラーコード検証修正
      await expect(
        cliSessionManager.exportSession(sessionId)
      ).rejects.toHaveProperty('code', 'ERR_CLI_FILE_WRITE'); // Specific code
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliSessionManager',
        operation,
        expect.objectContaining({
          // StorageError を期待
          name: 'StorageError',
          code: 'ERR_CLI_FILE_WRITE',
        }),
        null,
        expect.objectContaining({
          sessionId,
          outputPath: null,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    });
  });

  describe('importSession', () => {
    const inputPath = 'import/session.json';
    const operation = 'importSession';
    const mockSessionData = { session_id: 'S_IMPORTED', data: 'imported data' };
    const mockImportResult = {
      session_id: 'S_IMPORTED',
      created_at: new Date().toISOString(),
    };

    test('should read file using StorageService, call sessionManager.importSession, and return result', async () => {
      mockStorageService.readJSON.mockResolvedValue(mockSessionData);
      mockSessionManagerAdapter.importSession.mockResolvedValue(
        mockImportResult
      );

      const result = await cliSessionManager.importSession(inputPath);

      expect(mockStorageService.readJSON).toHaveBeenCalledWith('.', inputPath);
      expect(mockSessionManagerAdapter.importSession).toHaveBeenCalledWith(
        mockSessionData
      );
      expect(result).toEqual(mockImportResult);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Importing session'),
        expect.objectContaining({
          inputPath,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
      // ロガー検証修正
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          `Session imported successfully: ${mockImportResult.session_id}`
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
        'session_import_before', // 実装に合わせる
        { inputPath }
      );
      await expectStandardizedEventEmittedAsync(
        mockEventEmitter,
        'cli',
        'session_import_after', // 実装に合わせる
        { inputPath, sessionId: mockImportResult.session_id }
      );
    });

    test('should throw StorageError if StorageService fails to read', async () => {
      // テスト名修正
      // StorageService が StorageError をスローするようにモック (第2引数に options を渡し、cause も含める)
      const storageError = new StorageError('Read failed', {
        // 第2引数が options
        cause: null, // cause は options 内に含める
        code: 'ERR_CLI_FILE_READ',
        context: { path: inputPath },
      });
      mockStorageService.readJSON.mockRejectedValue(storageError);

      await expect(cliSessionManager.importSession(inputPath)).rejects.toThrow(
        StorageError // Expect StorageError
      );
      // エラーコード検証修正
      await expect(
        cliSessionManager.importSession(inputPath)
      ).rejects.toHaveProperty('code', 'ERR_CLI_FILE_READ'); // Specific code
      expect(mockSessionManagerAdapter.importSession).not.toHaveBeenCalled();
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliSessionManager',
        operation,
        expect.objectContaining({
          // StorageError を期待
          name: 'StorageError',
          code: 'ERR_CLI_FILE_READ',
        }),
        null,
        expect.objectContaining({
          inputPath,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    });

    test('should throw CliError if importSession returns unexpected result', async () => {
      // ImportUnexpectedError -> CliError
      mockStorageService.readJSON.mockResolvedValue(mockSessionData);
      mockSessionManagerAdapter.importSession.mockResolvedValue({
        message: 'wrong format',
      }); // 期待しない結果

      await expect(cliSessionManager.importSession(inputPath)).rejects.toThrow(
        CliError // ApplicationError -> CliError
      );
      // エラーコード検証修正
      await expect(
        cliSessionManager.importSession(inputPath)
      ).rejects.toHaveProperty('code', 'ERR_CLI_SESSION_IMPORT_UNEXPECTED'); // Specific code
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliSessionManager',
        operation,
        expect.objectContaining({
          // CliError を期待
          name: 'CliError',
          code: 'ERR_CLI_SESSION_IMPORT_UNEXPECTED',
        }),
        null,
        expect.objectContaining({
          inputPath,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    });

    test('should throw CliError and emit error event on adapter failure', async () => {
      const originalError = new Error('Import conflict');
      mockStorageService.readJSON.mockResolvedValue(mockSessionData);
      mockSessionManagerAdapter.importSession.mockRejectedValue(originalError);

      await expect(cliSessionManager.importSession(inputPath)).rejects.toThrow(
        CliError // ApplicationError -> CliError
      );
      // エラーコード検証修正
      await expect(
        cliSessionManager.importSession(inputPath)
      ).rejects.toHaveProperty('code', 'ERR_CLI_SESSIONMANAGER_IMPORTSESSION'); // 修正: クラス名を含むエラーコード
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliSessionManager',
        operation,
        expect.objectContaining({
          // CliError でラップされていることを確認
          name: 'CliError',
          code: 'ERR_CLI_SESSIONMANAGER_IMPORTSESSION', // 修正後のコード
          cause: originalError,
        }),
        null,
        expect.objectContaining({
          inputPath,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }) // traceId, requestId を追加
      );
    });
  });
});

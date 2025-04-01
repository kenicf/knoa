const CliSessionManager = require('../../src/cli/session-manager');
const {
  ApplicationError,
  CliError,
  NotFoundError,
  StorageError, // FileReadError, FileWriteError を StorageError に変更
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

describe('CliSessionManager', () => {
  let mockLogger;
  let mockEventEmitter;
  let mockIntegrationManagerAdapter;
  let mockSessionManagerAdapter;
  let mockStorageService;
  let mockErrorHandler;
  let cliSessionManager;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockEventEmitter = createMockEventEmitter();
    mockIntegrationManagerAdapter = {
      startSession: jest.fn(),
      endSession: jest.fn(),
    };
    mockSessionManagerAdapter = {
      getLatestSession: jest.fn(),
      getAllSessions: jest.fn(),
      getSession: jest.fn(),
      importSession: jest.fn(),
      createNewSession: jest.fn(), // 追加
      endSession: jest.fn(), // 追加
    };
    mockStorageService = createMockStorageService(); // StorageService のモック
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
        expect.objectContaining({ previousSessionId }) // コンテキストをチェック
      );
      // ロガー検証修正: 成功メッセージとIDを含むことを確認
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Session started successfully: S001')
      );
    });

    test('should emit _before and _after events on success', async () => {
      mockIntegrationManagerAdapter.startSession.mockResolvedValue(
        mockSuccessResult
      );
      await cliSessionManager.startSession(previousSessionId);
      // expectStandardizedEventEmittedAsync に変更
      await expectStandardizedEventEmittedAsync(
        // await を追加
        mockEventEmitter,
        'cli_session',
        `${operation}_before`,
        { previousSessionId }
      );
      await expectStandardizedEventEmittedAsync(
        // await を追加
        mockEventEmitter,
        'cli_session',
        `${operation}_after`,
        { previousSessionId, result: mockSuccessResult }
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
      ).rejects.toHaveProperty('code', 'ERR_CLI_SESSION_START'); // Specific code
      await expect(
        cliSessionManager.startSession(previousSessionId)
      ).rejects.toHaveProperty('cause', originalError);

      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliSessionManager',
        operation,
        expect.any(CliError), // Verify it's a CliError instance
        null,
        { previousSessionId }
      );
    });
    test('should throw CliError if integrationManager returns error object', async () => {
      const errorResult = { error: 'Internal server error' };
      mockIntegrationManagerAdapter.startSession.mockResolvedValue(errorResult);

      await expect(
        cliSessionManager.startSession(previousSessionId)
      ).rejects.toThrow(CliError);
      // エラーコード検証修正
      await expect(
        cliSessionManager.startSession(previousSessionId)
      ).rejects.toHaveProperty('code', 'ERR_CLI_SESSION_START_FAILED'); // Specific code

      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliSessionManager',
        operation,
        expect.any(CliError), // Verify it's a CliError instance
        null,
        { previousSessionId }
      );
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
        expect.objectContaining({ sessionId }) // コンテキストをチェック
      );
      // ロガー検証修正: パスを含むことを確認
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          `Handover document saved to ${path.join(handoverDir, handoverFilename)}`
        )
      );
      // ロガー検証修正: 1つの引数に両方の情報が含まれることを確認
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Session ended successfully: ${sessionId}`)
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

      try {
        await cliSessionManager.endSession();
        // エラーがスローされなかった場合、テストを失敗させる
        throw new Error('Expected NotFoundError to be thrown, but it was not.');
      } catch (error) {
        expect(error.name).toBe('NotFoundError');
        expect(error.code).toBe('ERR_CLI_NO_ACTIVE_SESSION');
      }
      // 元のエラーコード検証は expect 内に含めたので削除

      expect(mockIntegrationManagerAdapter.endSession).not.toHaveBeenCalled();
      expect(mockStorageService.writeText).not.toHaveBeenCalled();
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliSessionManager',
        operation,
        expect.any(NotFoundError), // Verify it's a NotFoundError instance
        null, // context
        { sessionId: null }
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
        // await を追加
        mockEventEmitter,
        'cli_session',
        `${operation}_before`,
        { sessionId }
      );
      await expectStandardizedEventEmittedAsync(
        // await を追加
        mockEventEmitter,
        'cli_session',
        `${operation}_after`,
        { sessionId: sessionId, result: mockSuccessResult }
      );
    });

    test('should log warning but not throw if saving handover doc fails', async () => {
      mockIntegrationManagerAdapter.endSession.mockResolvedValue(
        mockSuccessResult
      );
      mockStorageService.writeText.mockResolvedValue(false); // 保存失敗

      const result = await cliSessionManager.endSession(sessionId);

      expect(result).toEqual(mockSuccessResult); // エラーはスローされない
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to save handover document'),
        expect.objectContaining({ operation }) // コンテキストをチェック
      );
      // ロガー検証修正
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Session ended successfully: ${sessionId}`)
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
      ).rejects.toHaveProperty('code', 'ERR_CLI_SESSION_END'); // Specific code
      await expect(
        cliSessionManager.endSession(sessionId)
      ).rejects.toHaveProperty('cause', originalError);

      expect(mockStorageService.writeText).not.toHaveBeenCalled();
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliSessionManager',
        operation,
        expect.any(CliError), // Verify it's a CliError instance
        null,
        { sessionId }
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
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Listing all sessions'),
        expect.objectContaining({ operation }) // コンテキストをチェック
      );
      // ロガー検証修正
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Found ${mockSessions.length} sessions.`)
      );
      // expectStandardizedEventEmittedAsync に変更
      await expectStandardizedEventEmittedAsync(
        // await を追加
        mockEventEmitter,
        'cli_session',
        `${operation}_before`
      );
      await expectStandardizedEventEmittedAsync(
        // await を追加
        mockEventEmitter,
        'cli_session',
        `${operation}_after`,
        { count: mockSessions.length }
      );
    });

    test('should return empty array if no sessions found', async () => {
      mockSessionManagerAdapter.getAllSessions.mockResolvedValue(null);
      const result = await cliSessionManager.listSessions();
      expect(result).toEqual([]);
      // ロガー検証修正
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Found 0 sessions.')
      );
      // expectStandardizedEventEmittedAsync に変更
      await expectStandardizedEventEmittedAsync(
        // await を追加
        mockEventEmitter,
        'cli_session',
        `${operation}_after`,
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
        'ERR_CLI_SESSION_LIST' // Specific code
      );
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliSessionManager',
        operation,
        expect.any(CliError) // Verify it's a CliError instance
        // null, {} // context, details は省略可能
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
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Getting current session info'),
        expect.objectContaining({ operation })
      );
      // ロガー検証修正
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          `Current session found: ${mockSession.session_id}`
        )
      );
      // expectStandardizedEventEmittedAsync に変更
      await expectStandardizedEventEmittedAsync(
        // await を追加
        mockEventEmitter,
        'cli_session',
        `${operation}_before`
      );
      await expectStandardizedEventEmittedAsync(
        // await を追加
        mockEventEmitter,
        'cli_session',
        `${operation}_after`,
        { sessionFound: true }
      );
    });

    test('should return null if no active session found', async () => {
      mockSessionManagerAdapter.getLatestSession.mockResolvedValue(null);
      const result = await cliSessionManager.getCurrentSessionInfo();
      expect(result).toBeNull();
      // ロガー検証修正
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('No active session found.')
      );
      // expectStandardizedEventEmittedAsync に変更
      await expectStandardizedEventEmittedAsync(
        // await を追加
        mockEventEmitter,
        'cli_session',
        `${operation}_after`,
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
      ).rejects.toHaveProperty('code', 'ERR_CLI_SESSION_CURRENT'); // Specific code
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliSessionManager',
        operation,
        expect.any(CliError) // Verify it's a CliError instance
        // null, {}
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
        expect.objectContaining({ sessionId })
      );
      // ロガー検証修正
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Session info retrieved for: ${sessionId}`)
      );
      // expectStandardizedEventEmittedAsync に変更
      await expectStandardizedEventEmittedAsync(
        // await を追加
        mockEventEmitter,
        'cli_session',
        `${operation}_before`,
        { sessionId }
      );
      await expectStandardizedEventEmittedAsync(
        // await を追加
        mockEventEmitter,
        'cli_session',
        `${operation}_after`,
        { sessionId, sessionFound: true }
      );
    });

    test('should throw NotFoundError if session not found', async () => {
      mockSessionManagerAdapter.getSession.mockResolvedValue(null);
      try {
        await cliSessionManager.getSessionInfo(sessionId);
        throw new Error('Expected function to throw, but it did not.'); // エラーがスローされなかった場合のフェイルセーフ
      } catch (error) {
        // console.log(...) を削除
        expect(error).toHaveProperty('name', 'NotFoundError');
        expect(error).toHaveProperty('code', 'ERR_CLI_SESSION_NOT_FOUND');
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Session not found'),
          expect.objectContaining({ sessionId })
        );
        expect(emitErrorEvent).toHaveBeenCalledWith(
          mockEventEmitter,
          mockLogger,
          'CliSessionManager',
          operation,
          expect.objectContaining({ name: 'NotFoundError' }), // name プロパティで検証
          null, // context
          { sessionId }
        );
      }
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
      ).rejects.toHaveProperty('code', 'ERR_CLI_SESSION_INFO'); // Specific code
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliSessionManager',
        operation,
        expect.any(CliError), // Verify it's a CliError instance
        null,
        { sessionId }
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
        expect.objectContaining({ sessionId })
      );
      // ロガー検証修正
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          `Session exported successfully to: ${defaultPath}`
        )
      );
      // expectStandardizedEventEmittedAsync に変更
      await expectStandardizedEventEmittedAsync(
        // await を追加
        mockEventEmitter,
        'cli_session',
        `${operation}_before`,
        { sessionId, outputPath: null }
      );
      await expectStandardizedEventEmittedAsync(
        // await を追加
        mockEventEmitter,
        'cli_session',
        `${operation}_after`,
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
        // await を追加
        mockEventEmitter,
        'cli_session',
        `${operation}_after`,
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
        expect.any(NotFoundError), // Verify it's a NotFoundError instance
        null, // context
        { sessionId, outputPath: null }
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
        expect.any(StorageError), // Verify it's a StorageError instance
        null, // context
        { sessionId, outputPath: null }
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
        expect.objectContaining({ inputPath })
      );
      // ロガー検証修正
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          `Session imported successfully: ${mockImportResult.session_id}`
        )
      );
      // expectStandardizedEventEmittedAsync に変更
      await expectStandardizedEventEmittedAsync(
        // await を追加
        mockEventEmitter,
        'cli_session',
        `${operation}_before`,
        { inputPath }
      );
      await expectStandardizedEventEmittedAsync(
        // await を追加
        mockEventEmitter,
        'cli_session',
        `${operation}_after`,
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
        expect.any(StorageError), // Verify it's a StorageError instance
        null, // context
        { inputPath }
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
        expect.any(CliError), // Verify it's a CliError instance
        null, // context
        { inputPath }
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
      ).rejects.toHaveProperty('code', 'ERR_CLI_SESSION_IMPORT'); // Specific code
      expect(emitErrorEvent).toHaveBeenCalledWith(
        mockEventEmitter,
        mockLogger,
        'CliSessionManager',
        operation,
        expect.any(CliError), // Verify it's a CliError instance
        null,
        { inputPath }
      );
    });
  });
});

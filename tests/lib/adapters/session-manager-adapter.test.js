/**
 * SessionManagerAdapterのテスト
 */

const SessionManagerAdapter = require('../../../src/lib/adapters/session-manager-adapter');
// const { EnhancedEventEmitter } = require('../../../src/lib/core/event-system'); // 未使用のためコメントアウト
const { ValidationError } = require('../../../src/lib/utils/errors'); // エラークラスは utils から取得
const { createMockLogger } = require('../../helpers/mock-factory'); // Logger モックを使用
const {
  expectStandardizedEventEmitted,
} = require('../../helpers/test-helpers'); // 標準化ヘルパーを使用

describe('SessionManagerAdapter', () => {
  let adapter;
  let mockSessionManager;
  let mockEventEmitter;
  let mockLogger;
  // let emittedEvents; // emitStandardized を直接検証するため不要に

  beforeEach(() => {
    // emittedEvents = []; // 不要

    // モックの作成
    mockSessionManager = {
      createNewSession: jest.fn().mockImplementation((previousSessionId) => ({
        session_handover: {
          session_id: 'session-test-1',
          previous_session_id: previousSessionId,
        },
      })),
      updateSession: jest.fn().mockImplementation((sessionId, updateData) => ({
        session_handover: { session_id: sessionId },
        ...updateData,
      })),
      endSession: jest.fn().mockImplementation((sessionId) => ({
        session_handover: { session_id: sessionId },
        ended: true,
        duration: 3600,
      })),
      addTaskToSession: jest.fn().mockImplementation((sessionId, taskId) => ({
        session_handover: { session_id: sessionId },
        tasks: [taskId],
      })),
      removeTaskFromSession: jest
        .fn()
        .mockImplementation((sessionId, _taskId) => ({
          // taskId -> _taskId
          session_handover: { session_id: sessionId },
          tasks: [],
        })),
      addGitCommitToSession: jest
        .fn()
        .mockImplementation((sessionId, commitHash) => ({
          session_handover: { session_id: sessionId },
          commits: [commitHash],
        })),
    };

    mockLogger = createMockLogger(); // mock-factory から取得

    // EventEmitter のモックを作成 (emitStandardized をスパイ)
    mockEventEmitter = {
      emitStandardized: jest.fn(),
      // on メソッドは後方互換性テスト削除のため不要
    };

    // イベントキャプチャは不要に
    // mockEventEmitter.on('*', (data, eventName) => {
    //   emittedEvents.push({ name: eventName, data });
    // });

    // アダプターの作成
    adapter = new SessionManagerAdapter(mockSessionManager, {
      eventEmitter: mockEventEmitter,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  // 基本機能のテスト
  describe('基本機能', () => {
    test('インスタンスが正しく作成される', () => {
      expect(adapter).toBeInstanceOf(SessionManagerAdapter);
      expect(adapter.manager).toBe(mockSessionManager);
      expect(adapter.eventEmitter).toBe(mockEventEmitter);
      expect(adapter.logger).toBe(mockLogger);
    });
  });

  // createNewSessionのテスト
  describe('createNewSession', () => {
    test('新しいセッションを作成し、session_created イベントを発行する', async () => {
      const previousSessionId = 'previous-session-1';
      const result = await adapter.createNewSession(previousSessionId);

      expect(mockSessionManager.createNewSession).toHaveBeenCalledWith(
        previousSessionId
      );
      expect(result).toEqual({
        session_handover: {
          session_id: 'session-test-1',
          previous_session_id: previousSessionId,
        },
      });

      // イベント発行のテスト (expectStandardizedEventEmitted を使用)
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'session',
        'session_created',
        {
          id: 'session-test-1',
          previousSessionId: previousSessionId,
          // timestamp, traceId, requestId はヘルパー内で検証
        }
      );
    });

    test('エラー時に適切に処理する', async () => {
      const error = new Error('セッション作成エラー');
      mockSessionManager.createNewSession.mockImplementationOnce(() => {
        throw error;
      });

      const result = await adapter.createNewSession('previous-session-1');
      expect(result).toMatchObject({
        error: true,
        message: 'セッション作成エラー',
        operation: 'createNewSession',
      });
      expect(result.timestamp).toBeDefined();
      expect(result.code).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('createNewSession'),
        error
      );
    });
  });

  // updateSessionのテスト
  describe('updateSession', () => {
    test('セッションを更新し、session_updated イベントを発行する', async () => {
      const sessionId = 'session-test-1';
      const updateData = { status: 'active' };

      const result = await adapter.updateSession(sessionId, updateData);

      expect(mockSessionManager.updateSession).toHaveBeenCalledWith(
        sessionId,
        updateData
      );
      expect(result).toEqual({
        session_handover: { session_id: sessionId },
        status: 'active',
      });

      // イベント発行のテスト
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'session',
        'session_updated',
        {
          id: sessionId,
          updates: updateData,
        }
      );
    });

    test('エラー時に適切に処理する', async () => {
      const error = new Error('セッション更新エラー');
      mockSessionManager.updateSession.mockImplementationOnce(() => {
        throw error;
      });

      const result = await adapter.updateSession('session-test-1', {
        status: 'active',
      });
      expect(result).toMatchObject({
        error: true,
        message: 'セッション更新エラー',
        operation: 'updateSession',
      });
      expect(result.timestamp).toBeDefined();
      expect(result.code).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('updateSession'),
        error
      );
    });
  });

  // endSessionのテスト
  describe('endSession', () => {
    test('セッションを終了し、session_ended イベントを発行する', async () => {
      const sessionId = 'session-test-1';

      const result = await adapter.endSession(sessionId);

      expect(mockSessionManager.endSession).toHaveBeenCalledWith(sessionId);
      expect(result).toEqual({
        session_handover: { session_id: sessionId },
        ended: true,
        duration: 3600,
      });

      // イベント発行のテスト
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'session',
        'session_ended',
        {
          id: sessionId,
          endTime: expect.any(String), // 実際の終了時間が入る
          duration: 3600,
        }
      );
    });

    test('エラー時に適切に処理する', async () => {
      const error = new Error('セッション終了エラー');
      mockSessionManager.endSession.mockImplementationOnce(() => {
        throw error;
      });

      const result = await adapter.endSession('session-test-1');
      expect(result).toMatchObject({
        error: true,
        message: 'セッション終了エラー',
        operation: 'endSession',
      });
      expect(result.timestamp).toBeDefined();
      expect(result.code).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('endSession'),
        error
      );
    });
  });

  // addTaskToSessionのテスト
  describe('addTaskToSession', () => {
    test('セッションにタスクを追加し、task_added イベントを発行する', async () => {
      const sessionId = 'session-test-1';
      const taskId = 'T001';

      const result = await adapter.addTaskToSession(sessionId, taskId);

      expect(mockSessionManager.addTaskToSession).toHaveBeenCalledWith(
        sessionId,
        taskId
      );
      expect(result).toEqual({
        session_handover: { session_id: sessionId },
        tasks: [taskId],
      });

      // イベント発行のテスト
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'session',
        'task_added',
        {
          sessionId: sessionId,
          taskId: taskId,
        }
      );
    });

    test('タスクIDが不正な形式の場合はエラーを返す', async () => {
      const result = await adapter.addTaskToSession(
        'session-test-1',
        'invalid-task-id'
      );
      expect(result).toMatchObject({
        error: true,
        message: expect.stringContaining('タスクIDはT000形式'),
        operation: 'addTaskToSession',
      });
      expect(result.timestamp).toBeDefined();
      expect(result.code).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('addTaskToSession'),
        expect.any(ValidationError)
      );
    });

    test('エラー時に適切に処理する', async () => {
      const error = new Error('タスク追加エラー');
      mockSessionManager.addTaskToSession.mockImplementationOnce(() => {
        throw error;
      });

      const result = await adapter.addTaskToSession('session-test-1', 'T001');
      expect(result).toMatchObject({
        error: true,
        message: 'タスク追加エラー',
        operation: 'addTaskToSession',
      });
      expect(result.timestamp).toBeDefined();
      expect(result.code).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('addTaskToSession'),
        error
      );
    });
  });

  // removeTaskFromSessionのテスト
  describe('removeTaskFromSession', () => {
    test('セッションからタスクを削除し、task_removed イベントを発行する', async () => {
      const sessionId = 'session-test-1';
      const taskId = 'T001';

      const result = await adapter.removeTaskFromSession(sessionId, taskId);

      expect(mockSessionManager.removeTaskFromSession).toHaveBeenCalledWith(
        sessionId,
        taskId
      );
      expect(result).toEqual({
        session_handover: { session_id: sessionId },
        tasks: [],
      });

      // イベント発行のテスト
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'session',
        'task_removed',
        {
          sessionId: sessionId,
          taskId: taskId,
        }
      );
    });

    test('タスクIDが不正な形式の場合はエラーを返す', async () => {
      const result = await adapter.removeTaskFromSession(
        'session-test-1',
        'invalid-task-id'
      );
      expect(result).toMatchObject({
        error: true,
        message: expect.stringContaining('タスクIDはT000形式'),
        operation: 'removeTaskFromSession',
      });
      expect(result.timestamp).toBeDefined();
      expect(result.code).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('removeTaskFromSession'),
        expect.any(ValidationError)
      );
    });

    test('エラー時に適切に処理する', async () => {
      const error = new Error('タスク削除エラー');
      mockSessionManager.removeTaskFromSession.mockImplementationOnce(() => {
        throw error;
      });

      const result = await adapter.removeTaskFromSession(
        'session-test-1',
        'T001'
      );
      expect(result).toMatchObject({
        error: true,
        message: 'タスク削除エラー',
        operation: 'removeTaskFromSession',
      });
      expect(result.timestamp).toBeDefined();
      expect(result.code).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('removeTaskFromSession'),
        error
      );
    });
  });

  // addGitCommitToSessionのテスト
  describe('addGitCommitToSession', () => {
    test('セッションにGitコミットを関連付け、git_commit_added イベントを発行する', async () => {
      const sessionId = 'session-test-1';
      const commitHash = 'abc123';

      const result = await adapter.addGitCommitToSession(sessionId, commitHash);

      expect(mockSessionManager.addGitCommitToSession).toHaveBeenCalledWith(
        sessionId,
        commitHash
      );
      expect(result).toEqual({
        session_handover: { session_id: sessionId },
        commits: [commitHash],
      });

      // イベント発行のテスト
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'session',
        'git_commit_added',
        {
          sessionId: sessionId,
          commitHash: commitHash,
        }
      );
    });

    test('エラー時に適切に処理する', async () => {
      const error = new Error('コミット関連付けエラー');
      mockSessionManager.addGitCommitToSession.mockImplementationOnce(() => {
        throw error;
      });

      const result = await adapter.addGitCommitToSession(
        'session-test-1',
        'abc123'
      );
      expect(result).toMatchObject({
        error: true,
        message: 'コミット関連付けエラー',
        operation: 'addGitCommitToSession',
      });
      expect(result.timestamp).toBeDefined();
      expect(result.code).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('addGitCommitToSession'),
        error
      );
    });
  });

  // 後方互換性のテストは削除

  // バリデーションのテスト
  describe('バリデーション', () => {
    test('必須パラメータがない場合はエラーを返す', async () => {
      // _validateParams はプライベートメソッドなので直接スパイせず、
      // 実際にエラーが発生するケースで検証する
      const result = await adapter.updateSession(undefined, {
        status: 'active',
      });
      expect(result).toMatchObject({
        error: true,
        message: expect.stringContaining(
          '必須パラメータ sessionId がありません'
        ),
        operation: 'updateSession',
      });
      expect(result.timestamp).toBeDefined();
      expect(result.code).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('updateSession'),
        expect.any(ValidationError)
      );
    });
  });
});

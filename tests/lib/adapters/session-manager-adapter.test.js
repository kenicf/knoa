/**
 * SessionManagerAdapterのテスト
 */

const SessionManagerAdapter = require('../../../src/lib/adapters/session-manager-adapter');
const { EnhancedEventEmitter } = require('../../../src/lib/core/event-system');
const { ValidationError } = require('../../../src/lib/utils/errors');

describe('SessionManagerAdapter', () => {
  let adapter;
  let mockSessionManager;
  let mockEventEmitter;
  let mockLogger;
  let emittedEvents;

  beforeEach(() => {
    emittedEvents = [];
    
    // モックの作成
    mockSessionManager = {
      createNewSession: jest.fn().mockImplementation(previousSessionId => ({
        session_handover: { 
          session_id: 'session-test-1',
          previous_session_id: previousSessionId
        }
      })),
      updateSession: jest.fn().mockImplementation((sessionId, updateData) => ({ 
        session_handover: { session_id: sessionId },
        ...updateData
      })),
      endSession: jest.fn().mockImplementation(sessionId => ({ 
        session_handover: { session_id: sessionId },
        ended: true,
        duration: 3600
      })),
      addTaskToSession: jest.fn().mockImplementation((sessionId, taskId) => ({
        session_handover: { session_id: sessionId },
        tasks: [taskId]
      })),
      removeTaskFromSession: jest.fn().mockImplementation((sessionId, taskId) => ({
        session_handover: { session_id: sessionId },
        tasks: []
      })),
      addGitCommitToSession: jest.fn().mockImplementation((sessionId, commitHash) => ({
        session_handover: { session_id: sessionId },
        commits: [commitHash]
      }))
    };
    
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };
    
    // 実際のEventEmitterを使用
    mockEventEmitter = new EnhancedEventEmitter({ logger: mockLogger });
    
    // イベントをキャプチャ
    mockEventEmitter.on('*', (data, eventName) => {
      emittedEvents.push({ name: eventName, data });
    });
    
    // アダプターの作成
    adapter = new SessionManagerAdapter(mockSessionManager, {
      eventEmitter: mockEventEmitter,
      logger: mockLogger
    });
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
    test('新しいセッションを作成し、イベントを発行する', async () => {
      const previousSessionId = 'previous-session-1';
      const result = await adapter.createNewSession(previousSessionId);
      
      // 基本的な機能のテスト
      expect(mockSessionManager.createNewSession).toHaveBeenCalledWith(previousSessionId);
      expect(result).toEqual({
        session_handover: { 
          session_id: 'session-test-1',
          previous_session_id: previousSessionId
        }
      });
      
      // イベント発行のテスト
      expect(emittedEvents.length).toBeGreaterThan(0);
      const sessionCreatedEvent = emittedEvents.find(e => e.name === 'session:session_created');
      expect(sessionCreatedEvent).toBeDefined();
      expect(sessionCreatedEvent.data.id).toBe('session-test-1');
      expect(sessionCreatedEvent.data.previousSessionId).toBe(previousSessionId);
      expect(sessionCreatedEvent.data.timestamp).toBeDefined();
    });
    
    test('エラー時に適切に処理する', async () => {
      mockSessionManager.createNewSession.mockImplementationOnce(() => {
        throw new Error('セッション作成エラー');
      });
      
      const result = await adapter.createNewSession('previous-session-1');
      // 修正された期待値 - 部分一致で検証
      expect(result).toMatchObject({
        error: true,
        message: 'セッション作成エラー',
        operation: 'createNewSession'
      });
      
      // タイムスタンプなどの動的な値が存在することを確認
      expect(result.timestamp).toBeDefined();
      expect(result.code).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // updateSessionのテスト
  describe('updateSession', () => {
    test('セッションを更新し、イベントを発行する', async () => {
      const sessionId = 'session-test-1';
      const updateData = { status: 'active' };
      
      const result = await adapter.updateSession(sessionId, updateData);
      
      // 基本的な機能のテスト
      expect(mockSessionManager.updateSession).toHaveBeenCalledWith(sessionId, updateData);
      expect(result).toEqual({ 
        session_handover: { session_id: sessionId },
        status: 'active'
      });
      
      // イベント発行のテスト
      const sessionUpdatedEvent = emittedEvents.find(e => e.name === 'session:session_updated');
      expect(sessionUpdatedEvent).toBeDefined();
      expect(sessionUpdatedEvent.data.id).toBe(sessionId);
      expect(sessionUpdatedEvent.data.updates).toEqual(updateData);
      expect(sessionUpdatedEvent.data.timestamp).toBeDefined();
    });
    
    test('エラー時に適切に処理する', async () => {
      mockSessionManager.updateSession.mockImplementationOnce(() => {
        throw new Error('セッション更新エラー');
      });
      
      const result = await adapter.updateSession('session-test-1', { status: 'active' });
      // 修正された期待値 - 部分一致で検証
      expect(result).toMatchObject({
        error: true,
        message: 'セッション更新エラー',
        operation: 'updateSession'
      });
      
      // タイムスタンプなどの動的な値が存在することを確認
      expect(result.timestamp).toBeDefined();
      expect(result.code).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // endSessionのテスト
  describe('endSession', () => {
    test('セッションを終了し、イベントを発行する', async () => {
      const sessionId = 'session-test-1';
      
      const result = await adapter.endSession(sessionId);
      
      // 基本的な機能のテスト
      expect(mockSessionManager.endSession).toHaveBeenCalledWith(sessionId);
      expect(result).toEqual({ 
        session_handover: { session_id: sessionId },
        ended: true,
        duration: 3600
      });
      
      // イベント発行のテスト
      const sessionEndedEvent = emittedEvents.find(e => e.name === 'session:session_ended');
      expect(sessionEndedEvent).toBeDefined();
      expect(sessionEndedEvent.data.id).toBe(sessionId);
      expect(sessionEndedEvent.data.endTime).toBeDefined();
      expect(sessionEndedEvent.data.duration).toBe(3600);
    });
    
    test('エラー時に適切に処理する', async () => {
      mockSessionManager.endSession.mockImplementationOnce(() => {
        throw new Error('セッション終了エラー');
      });
      
      const result = await adapter.endSession('session-test-1');
      // 修正された期待値 - 部分一致で検証
      expect(result).toMatchObject({
        error: true,
        message: 'セッション終了エラー',
        operation: 'endSession'
      });
      
      // タイムスタンプなどの動的な値が存在することを確認
      expect(result.timestamp).toBeDefined();
      expect(result.code).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // addTaskToSessionのテスト
  describe('addTaskToSession', () => {
    test('セッションにタスクを追加し、イベントを発行する', async () => {
      const sessionId = 'session-test-1';
      const taskId = 'T001';
      
      const result = await adapter.addTaskToSession(sessionId, taskId);
      
      // 基本的な機能のテスト
      expect(mockSessionManager.addTaskToSession).toHaveBeenCalledWith(sessionId, taskId);
      expect(result).toEqual({ 
        session_handover: { session_id: sessionId },
        tasks: [taskId]
      });
      
      // イベント発行のテスト
      const taskAddedEvent = emittedEvents.find(e => e.name === 'session:task_added');
      expect(taskAddedEvent).toBeDefined();
      expect(taskAddedEvent.data.sessionId).toBe(sessionId);
      expect(taskAddedEvent.data.taskId).toBe(taskId);
      expect(taskAddedEvent.data.timestamp).toBeDefined();
    });
    
    test('タスクIDが不正な形式の場合はエラーを返す', async () => {
      const result = await adapter.addTaskToSession('session-test-1', 'invalid-task-id');
      // 修正された期待値 - 部分一致で検証
      expect(result).toMatchObject({
        error: true,
        message: expect.stringContaining('タスクIDはT000形式である必要があります'),
        operation: 'addTaskToSession'
      });
      
      // タイムスタンプなどの動的な値が存在することを確認
      expect(result.timestamp).toBeDefined();
      expect(result.code).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });
    
    test('エラー時に適切に処理する', async () => {
      mockSessionManager.addTaskToSession.mockImplementationOnce(() => {
        throw new Error('タスク追加エラー');
      });
      
      const result = await adapter.addTaskToSession('session-test-1', 'T001');
      // 修正された期待値 - 部分一致で検証
      expect(result).toMatchObject({
        error: true,
        message: 'タスク追加エラー',
        operation: 'addTaskToSession'
      });
      
      // タイムスタンプなどの動的な値が存在することを確認
      expect(result.timestamp).toBeDefined();
      expect(result.code).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // removeTaskFromSessionのテスト
  describe('removeTaskFromSession', () => {
    test('セッションからタスクを削除し、イベントを発行する', async () => {
      const sessionId = 'session-test-1';
      const taskId = 'T001';
      
      const result = await adapter.removeTaskFromSession(sessionId, taskId);
      
      // 基本的な機能のテスト
      expect(mockSessionManager.removeTaskFromSession).toHaveBeenCalledWith(sessionId, taskId);
      expect(result).toEqual({ 
        session_handover: { session_id: sessionId },
        tasks: []
      });
      
      // イベント発行のテスト
      const taskRemovedEvent = emittedEvents.find(e => e.name === 'session:task_removed');
      expect(taskRemovedEvent).toBeDefined();
      expect(taskRemovedEvent.data.sessionId).toBe(sessionId);
      expect(taskRemovedEvent.data.taskId).toBe(taskId);
      expect(taskRemovedEvent.data.timestamp).toBeDefined();
    });
    
    test('タスクIDが不正な形式の場合はエラーを返す', async () => {
      const result = await adapter.removeTaskFromSession('session-test-1', 'invalid-task-id');
      // 修正された期待値 - 部分一致で検証
      expect(result).toMatchObject({
        error: true,
        message: expect.stringContaining('タスクIDはT000形式である必要があります'),
        operation: 'removeTaskFromSession'
      });
      
      // タイムスタンプなどの動的な値が存在することを確認
      expect(result.timestamp).toBeDefined();
      expect(result.code).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });
    
    test('エラー時に適切に処理する', async () => {
      mockSessionManager.removeTaskFromSession.mockImplementationOnce(() => {
        throw new Error('タスク削除エラー');
      });
      
      const result = await adapter.removeTaskFromSession('session-test-1', 'T001');
      // 修正された期待値 - 部分一致で検証
      expect(result).toMatchObject({
        error: true,
        message: 'タスク削除エラー',
        operation: 'removeTaskFromSession'
      });
      
      // タイムスタンプなどの動的な値が存在することを確認
      expect(result.timestamp).toBeDefined();
      expect(result.code).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // addGitCommitToSessionのテスト
  describe('addGitCommitToSession', () => {
    test('セッションにGitコミットを関連付け、イベントを発行する', async () => {
      const sessionId = 'session-test-1';
      const commitHash = 'abc123';
      
      const result = await adapter.addGitCommitToSession(sessionId, commitHash);
      
      // 基本的な機能のテスト
      expect(mockSessionManager.addGitCommitToSession).toHaveBeenCalledWith(sessionId, commitHash);
      expect(result).toEqual({ 
        session_handover: { session_id: sessionId },
        commits: [commitHash]
      });
      
      // イベント発行のテスト
      const commitAddedEvent = emittedEvents.find(e => e.name === 'session:git_commit_added');
      expect(commitAddedEvent).toBeDefined();
      expect(commitAddedEvent.data.sessionId).toBe(sessionId);
      expect(commitAddedEvent.data.commitHash).toBe(commitHash);
      expect(commitAddedEvent.data.timestamp).toBeDefined();
    });
    
    test('エラー時に適切に処理する', async () => {
      mockSessionManager.addGitCommitToSession.mockImplementationOnce(() => {
        throw new Error('コミット関連付けエラー');
      });
      
      const result = await adapter.addGitCommitToSession('session-test-1', 'abc123');
      // 修正された期待値 - 部分一致で検証
      expect(result).toMatchObject({
        error: true,
        message: 'コミット関連付けエラー',
        operation: 'addGitCommitToSession'
      });
      
      // タイムスタンプなどの動的な値が存在することを確認
      expect(result.timestamp).toBeDefined();
      expect(result.code).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // 後方互換性のテスト
  describe('後方互換性', () => {
    test('古いイベント名と新しいイベント名の両方が発行される', async () => {
      // 古いイベント名と新しいイベント名のリスナーを登録
      const oldEventListener = jest.fn();
      const newEventListener = jest.fn();
      
      mockEventEmitter.on('session:started', oldEventListener);
      mockEventEmitter.on('session:session_created', newEventListener);
      
      // セッションを作成
      await adapter.createNewSession('previous-session-1');
      
      // 両方のリスナーが呼び出されることを確認
      expect(oldEventListener).toHaveBeenCalled();
      expect(newEventListener).toHaveBeenCalled();
      
      // 警告ログが出力されることを確認（開発環境の場合）
      if (process.env.NODE_ENV === 'development') {
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('非推奨のイベント名'),
          expect.any(Object)
        );
      }
    });
  });

  // バリデーションのテスト
  describe('バリデーション', () => {
    test('必須パラメータがない場合はエラーを返す', async () => {
      // _validateParamsをスパイ
      jest.spyOn(adapter, '_validateParams').mockImplementationOnce(() => {
        throw new ValidationError('必須パラメータがありません');
      });
      
      const result = await adapter.updateSession(undefined, { status: 'active' });
      // 修正された期待値 - 部分一致で検証
      expect(result).toMatchObject({
        error: true,
        message: '必須パラメータがありません',
        operation: 'updateSession'
      });
      
      // タイムスタンプなどの動的な値が存在することを確認
      expect(result.timestamp).toBeDefined();
      expect(result.code).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});
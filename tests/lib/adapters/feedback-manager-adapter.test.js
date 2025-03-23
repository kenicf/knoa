/**
 * FeedbackManagerAdapterのテスト
 */

const FeedbackManagerAdapter = require('../../../src/lib/adapters/feedback-manager-adapter');
const { EnhancedEventEmitter } = require('../../../src/lib/core/event-system');
const { ValidationError } = require('../../../src/lib/utils/errors');

describe('FeedbackManagerAdapter', () => {
  let adapter;
  let mockFeedbackManager;
  let mockEventEmitter;
  let mockLogger;
  let emittedEvents;

  beforeEach(() => {
    emittedEvents = [];
    
    // モックの作成
    mockFeedbackManager = {
      createNewFeedback: jest.fn().mockImplementation((taskId, attempt) => ({
        id: 'F001',
        task_id: taskId,
        attempt: attempt || 1
      })),
      collectTestResults: jest.fn().mockImplementation((taskId, testCommand, testTypes) => ({
        task_id: taskId,
        results: [{ type: 'unit', passed: true }]
      })),
      prioritizeFeedback: jest.fn().mockImplementation(feedback => ({
        ...feedback,
        priorities: { high: ['issue1'], medium: ['issue2'] }
      })),
      updateFeedbackStatus: jest.fn().mockImplementation((feedback, newStatus) => ({
        ...feedback,
        status: newStatus
      })),
      integrateFeedbackWithSession: jest.fn().mockImplementation((feedbackId, sessionId) => true),
      integrateFeedbackWithTask: jest.fn().mockImplementation((feedbackId, taskId) => true)
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
    adapter = new FeedbackManagerAdapter(mockFeedbackManager, {
      eventEmitter: mockEventEmitter,
      logger: mockLogger
    });
  });

  // 基本機能のテスト
  describe('基本機能', () => {
    test('インスタンスが正しく作成される', () => {
      expect(adapter).toBeInstanceOf(FeedbackManagerAdapter);
      expect(adapter.manager).toBe(mockFeedbackManager);
      expect(adapter.eventEmitter).toBe(mockEventEmitter);
      expect(adapter.logger).toBe(mockLogger);
    });
  });

  // createNewFeedbackのテスト
  describe('createNewFeedback', () => {
    test('新しいフィードバックを作成し、イベントを発行する', async () => {
      const taskId = 'T001';
      const attempt = 2;
      
      const result = await adapter.createNewFeedback(taskId, attempt);
      
      // 基本的な機能のテスト
      expect(mockFeedbackManager.createNewFeedback).toHaveBeenCalledWith(taskId, attempt);
      expect(result).toEqual({
        id: 'F001',
        task_id: taskId,
        attempt: attempt
      });
      
      // イベント発行のテスト
      expect(emittedEvents.length).toBeGreaterThan(0);
      const feedbackCreatedEvent = emittedEvents.find(e => e.name === 'feedback:feedback_created');
      expect(feedbackCreatedEvent).toBeDefined();
      expect(feedbackCreatedEvent.data.id).toBe('F001');
      expect(feedbackCreatedEvent.data.taskId).toBe(taskId);
      expect(feedbackCreatedEvent.data.attempt).toBe(attempt);
      expect(feedbackCreatedEvent.data.timestamp).toBeDefined();
    });
    
    test('タスクIDが不正な形式の場合はエラーを返す', async () => {
      const result = await adapter.createNewFeedback('invalid-task-id', 1);
      // 修正された期待値 - 部分一致で検証
      expect(result).toMatchObject({
        error: true,
        message: expect.stringContaining('タスクIDはT000形式である必要があります'),
        operation: 'createNewFeedback'
      });
      
      // タイムスタンプなどの動的な値が存在することを確認
      expect(result.timestamp).toBeDefined();
      expect(result.code).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalled();
    });
    
    test('エラー時に適切に処理する', async () => {
      mockFeedbackManager.createNewFeedback.mockImplementationOnce(() => {
        throw new Error('フィードバック作成エラー');
      });
      
      const result = await adapter.createNewFeedback('T001', 1);
      // 修正された期待値 - 部分一致で検証
      expect(result).toMatchObject({
        error: true,
        message: 'フィードバック作成エラー',
        operation: 'createNewFeedback'
      });
      
      // タイムスタンプなどの動的な値が存在することを確認
      expect(result.timestamp).toBeDefined();
      expect(result.code).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // collectTestResultsのテスト
  describe('collectTestResults', () => {
    test('テスト結果を収集し、イベントを発行する', async () => {
      const taskId = 'T001';
      const testCommand = 'npm test';
      const testTypes = ['unit', 'integration'];
      
      const result = await adapter.collectTestResults(taskId, testCommand, testTypes);
      
      // 基本的な機能のテスト
      expect(mockFeedbackManager.collectTestResults).toHaveBeenCalledWith(taskId, testCommand, testTypes);
      expect(result).toEqual({
        task_id: taskId,
        results: [{ type: 'unit', passed: true }]
      });
      
      // イベント発行のテスト
      const testResultsEvent = emittedEvents.find(e => e.name === 'feedback:test_results_collected');
      expect(testResultsEvent).toBeDefined();
      expect(testResultsEvent.data.taskId).toBe(taskId);
      expect(testResultsEvent.data.testCommand).toBe(testCommand);
      expect(testResultsEvent.data.testTypes).toEqual(testTypes);
      expect(testResultsEvent.data.resultCount).toBe(1);
      expect(testResultsEvent.data.timestamp).toBeDefined();
    });
    
    test('エラー時に適切に処理する', async () => {
      mockFeedbackManager.collectTestResults.mockImplementationOnce(() => {
        throw new Error('テスト結果収集エラー');
      });
      
      const result = await adapter.collectTestResults('T001', 'npm test', ['unit']);
      // 修正された期待値 - 部分一致で検証
      expect(result).toMatchObject({
        error: true,
        message: 'テスト結果収集エラー',
        operation: 'collectTestResults'
      });
      
      // タイムスタンプなどの動的な値が存在することを確認
      expect(result.timestamp).toBeDefined();
      expect(result.code).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // prioritizeFeedbackのテスト
  describe('prioritizeFeedback', () => {
    test('フィードバックの優先順位付けを行い、イベントを発行する', async () => {
      const feedback = { id: 'F001', task_id: 'T001', status: 'open' };
      
      const result = await adapter.prioritizeFeedback(feedback);
      
      // 基本的な機能のテスト
      expect(mockFeedbackManager.prioritizeFeedback).toHaveBeenCalledWith(feedback);
      expect(result).toEqual({
        id: 'F001',
        task_id: 'T001',
        status: 'open',
        priorities: { high: ['issue1'], medium: ['issue2'] }
      });
      
      // イベント発行のテスト
      const prioritizedEvent = emittedEvents.find(e => e.name === 'feedback:feedback_prioritized');
      expect(prioritizedEvent).toBeDefined();
      expect(prioritizedEvent.data.id).toBe('F001');
      expect(prioritizedEvent.data.taskId).toBe('T001');
      expect(prioritizedEvent.data.priorities).toEqual({ high: ['issue1'], medium: ['issue2'] });
      expect(prioritizedEvent.data.timestamp).toBeDefined();
    });
    
    test('エラー時に適切に処理する', async () => {
      mockFeedbackManager.prioritizeFeedback.mockImplementationOnce(() => {
        throw new Error('優先順位付けエラー');
      });
      
      const result = await adapter.prioritizeFeedback({ id: 'F001', task_id: 'T001' });
      // 修正された期待値 - 部分一致で検証
      expect(result).toMatchObject({
        error: true,
        message: '優先順位付けエラー',
        operation: 'prioritizeFeedback'
      });
      
      // タイムスタンプなどの動的な値が存在することを確認
      expect(result.timestamp).toBeDefined();
      expect(result.code).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // updateFeedbackStatusのテスト
  describe('updateFeedbackStatus', () => {
    test('フィードバックの状態を更新し、イベントを発行する', async () => {
      const feedback = { id: 'F001', task_id: 'T001', status: 'open' };
      const newStatus = 'in_progress';
      
      const result = await adapter.updateFeedbackStatus(feedback, newStatus);
      
      // 基本的な機能のテスト
      expect(mockFeedbackManager.updateFeedbackStatus).toHaveBeenCalledWith(feedback, newStatus);
      expect(result).toEqual({
        id: 'F001',
        task_id: 'T001',
        status: 'in_progress'
      });
      
      // イベント発行のテスト
      const statusUpdatedEvent = emittedEvents.find(e => e.name === 'feedback:status_updated');
      expect(statusUpdatedEvent).toBeDefined();
      expect(statusUpdatedEvent.data.id).toBe('F001');
      expect(statusUpdatedEvent.data.taskId).toBe('T001');
      expect(statusUpdatedEvent.data.previousStatus).toBe('open');
      expect(statusUpdatedEvent.data.newStatus).toBe('in_progress');
      expect(statusUpdatedEvent.data.timestamp).toBeDefined();
    });
    
    test('不正な状態の場合はエラーを返す', async () => {
      const feedback = { id: 'F001', task_id: 'T001', status: 'open' };
      const newStatus = 'invalid_status';
      
      const result = await adapter.updateFeedbackStatus(feedback, newStatus);
      // 修正された期待値 - 部分一致で検証
      expect(result).toMatchObject({
        error: true,
        message: expect.stringContaining('不正な状態です'),
        operation: 'updateFeedbackStatus'
      });
      
      // タイムスタンプなどの動的な値が存在することを確認
      expect(result.timestamp).toBeDefined();
      expect(result.code).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });
    
    test('エラー時に適切に処理する', async () => {
      mockFeedbackManager.updateFeedbackStatus.mockImplementationOnce(() => {
        throw new Error('状態更新エラー');
      });
      
      const result = await adapter.updateFeedbackStatus(
        { id: 'F001', task_id: 'T001', status: 'open' }, 
        'in_progress'
      );
      // 修正された期待値 - 部分一致で検証
      expect(result).toMatchObject({
        error: true,
        message: '状態更新エラー',
        operation: 'updateFeedbackStatus'
      });
      
      // タイムスタンプなどの動的な値が存在することを確認
      expect(result.timestamp).toBeDefined();
      expect(result.code).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // integrateFeedbackWithSessionのテスト
  describe('integrateFeedbackWithSession', () => {
    test('フィードバックをセッションと統合し、イベントを発行する', async () => {
      const feedbackId = 'F001';
      const sessionId = 'session-test-1';
      
      const result = await adapter.integrateFeedbackWithSession(feedbackId, sessionId);
      
      // 基本的な機能のテスト
      expect(mockFeedbackManager.integrateFeedbackWithSession).toHaveBeenCalledWith(feedbackId, sessionId);
      expect(result).toBe(true);
      
      // イベント発行のテスト
      const integratedEvent = emittedEvents.find(e => e.name === 'feedback:integrated_with_session');
      expect(integratedEvent).toBeDefined();
      expect(integratedEvent.data.feedbackId).toBe(feedbackId);
      expect(integratedEvent.data.sessionId).toBe(sessionId);
      expect(integratedEvent.data.success).toBe(true);
      expect(integratedEvent.data.timestamp).toBeDefined();
    });
    
    test('エラー時に適切に処理する', async () => {
      mockFeedbackManager.integrateFeedbackWithSession.mockImplementationOnce(() => {
        throw new Error('セッション統合エラー');
      });
      
      const result = await adapter.integrateFeedbackWithSession('F001', 'session-test-1');
      // 修正された期待値 - 部分一致で検証
      expect(result).toMatchObject({
        error: true,
        message: 'セッション統合エラー',
        operation: 'integrateFeedbackWithSession'
      });
      
      // タイムスタンプなどの動的な値が存在することを確認
      expect(result.timestamp).toBeDefined();
      expect(result.code).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // integrateFeedbackWithTaskのテスト
  describe('integrateFeedbackWithTask', () => {
    test('フィードバックをタスクと統合し、イベントを発行する', async () => {
      const feedbackId = 'F001';
      const taskId = 'T001';
      
      const result = await adapter.integrateFeedbackWithTask(feedbackId, taskId);
      
      // 基本的な機能のテスト
      expect(mockFeedbackManager.integrateFeedbackWithTask).toHaveBeenCalledWith(feedbackId, taskId);
      expect(result).toBe(true);
      
      // イベント発行のテスト
      const integratedEvent = emittedEvents.find(e => e.name === 'feedback:integrated_with_task');
      expect(integratedEvent).toBeDefined();
      expect(integratedEvent.data.feedbackId).toBe(feedbackId);
      expect(integratedEvent.data.taskId).toBe(taskId);
      expect(integratedEvent.data.success).toBe(true);
      expect(integratedEvent.data.timestamp).toBeDefined();
    });
    
    test('エラー時に適切に処理する', async () => {
      mockFeedbackManager.integrateFeedbackWithTask.mockImplementationOnce(() => {
        throw new Error('タスク統合エラー');
      });
      
      const result = await adapter.integrateFeedbackWithTask('F001', 'T001');
      // 修正された期待値 - 部分一致で検証
      expect(result).toMatchObject({
        error: true,
        message: 'タスク統合エラー',
        operation: 'integrateFeedbackWithTask'
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
      
      mockEventEmitter.on('feedback:created', oldEventListener);
      mockEventEmitter.on('feedback:feedback_created', newEventListener);
      
      // フィードバックを作成
      await adapter.createNewFeedback('T001', 1);
      
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
      
      const result = await adapter.updateFeedbackStatus(undefined, 'in_progress');
      // 修正された期待値 - 部分一致で検証
      expect(result).toMatchObject({
        error: true,
        message: '必須パラメータがありません',
        operation: 'updateFeedbackStatus'
      });
      
      // タイムスタンプなどの動的な値が存在することを確認
      expect(result.timestamp).toBeDefined();
      expect(result.code).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});
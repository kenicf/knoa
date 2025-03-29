/**
 * StateManagerAdapterのテスト
 */

const StateManagerAdapter = require('../../../src/lib/adapters/state-manager-adapter');
const { EnhancedEventEmitter } = require('../../../src/lib/core/event-system');
const { ValidationError } = require('../../../src/lib/utils/errors');

describe('StateManagerAdapter', () => {
  let adapter;
  let mockStateManager;
  let mockEventEmitter;
  let mockLogger;
  let emittedEvents;

  beforeEach(() => {
    emittedEvents = [];

    // モックの作成
    mockStateManager = {
      getCurrentState: jest.fn().mockReturnValue('initialized'),
      setState: jest.fn().mockImplementation((state) => {
        return {
          state,
          previousState: 'initialized',
          timestamp: new Date().toISOString(),
        };
      }),
      transitionTo: jest.fn().mockImplementation((state, data) => {
        return {
          state,
          previousState: 'initialized',
          timestamp: new Date().toISOString(),
          data,
        };
      }),
      canTransitionTo: jest.fn().mockReturnValue(true),
      getStateHistory: jest.fn().mockReturnValue([
        { state: 'uninitialized', timestamp: '2025-03-01T00:00:00.000Z' },
        { state: 'initialized', timestamp: '2025-03-01T00:01:00.000Z' },
      ]),
      getPreviousState: jest.fn().mockReturnValue('uninitialized'),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // 実際のEventEmitterを使用
    mockEventEmitter = new EnhancedEventEmitter({ logger: mockLogger });

    // イベントをキャプチャ
    mockEventEmitter.on('*', (data, eventName) => {
      emittedEvents.push({ name: eventName, data });
    });

    // アダプターの作成
    adapter = new StateManagerAdapter(mockStateManager, {
      eventEmitter: mockEventEmitter,
      logger: mockLogger,
    });
  });

  // 基本機能のテスト
  describe('基本機能', () => {
    test('インスタンスが正しく作成される', () => {
      expect(adapter).toBeInstanceOf(StateManagerAdapter);
      expect(adapter.manager).toBe(mockStateManager);
      expect(adapter.eventEmitter).toBe(mockEventEmitter);
      expect(adapter.logger).toBe(mockLogger);
    });

    test('マネージャーが指定されていない場合はエラーが発生する', () => {
      expect(() => {
        new StateManagerAdapter(null, {
          eventEmitter: mockEventEmitter,
          logger: mockLogger,
        });
      }).toThrow('Manager is required');
    });
  });

  // getCurrentStateのテスト
  describe('getCurrentState', () => {
    test('現在の状態を取得する', () => {
      const state = adapter.getCurrentState();

      expect(mockStateManager.getCurrentState).toHaveBeenCalled();
      expect(state).toBe('initialized');
    });

    test('エラー時に適切に処理する', () => {
      mockStateManager.getCurrentState.mockImplementationOnce(() => {
        throw new Error('テストエラー');
      });

      const result = adapter.getCurrentState();

      expect(result).toMatchObject({
        error: true,
        message: 'テストエラー',
        operation: 'getCurrentState',
      });

      expect(result.timestamp).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // setStateのテスト
  describe('setState', () => {
    test('状態を設定し、イベントを発行する', () => {
      const state = 'session_started';
      const data = { sessionId: 'S001' };

      const result = adapter.setState(state, data);

      expect(mockStateManager.setState).toHaveBeenCalledWith(state, data);
      expect(result).toMatchObject({
        state: 'session_started',
        previousState: 'initialized',
      });

      // イベント発行のテスト
      const stateChangedEvent = emittedEvents.find(
        (e) => e.name === 'state:state_changed'
      );
      expect(stateChangedEvent).toBeDefined();
      expect(stateChangedEvent.data.state).toBe(state);
      expect(stateChangedEvent.data.previousState).toBe('initialized');
      expect(stateChangedEvent.data.timestamp).toBeDefined();
      expect(stateChangedEvent.data.sessionId).toBe('S001');
    });

    test('エラー時に適切に処理する', () => {
      mockStateManager.setState.mockImplementationOnce(() => {
        throw new Error('状態設定エラー');
      });

      const result = adapter.setState('session_started', { sessionId: 'S001' });

      expect(result).toMatchObject({
        error: true,
        message: '状態設定エラー',
        operation: 'setState',
      });

      expect(result.timestamp).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // transitionToのテスト
  describe('transitionTo', () => {
    test('状態を遷移し、イベントを発行する', () => {
      const state = 'task_in_progress';
      const data = { taskId: 'T001' };

      const result = adapter.transitionTo(state, data);

      expect(mockStateManager.transitionTo).toHaveBeenCalledWith(state, data);
      expect(result).toMatchObject({
        state: 'task_in_progress',
        previousState: 'initialized',
        data: { taskId: 'T001' },
      });

      // イベント発行のテスト
      const stateTransitionEvent = emittedEvents.find(
        (e) => e.name === 'state:state_transition'
      );
      expect(stateTransitionEvent).toBeDefined();
      expect(stateTransitionEvent.data.state).toBe(state);
      expect(stateTransitionEvent.data.previousState).toBe('initialized');
      expect(stateTransitionEvent.data.timestamp).toBeDefined();
      expect(stateTransitionEvent.data.taskId).toBe('T001');
    });

    test('エラー時に適切に処理する', () => {
      mockStateManager.transitionTo.mockImplementationOnce(() => {
        throw new Error('状態遷移エラー');
      });

      const result = adapter.transitionTo('task_in_progress', {
        taskId: 'T001',
      });

      expect(result).toMatchObject({
        error: true,
        message: '状態遷移エラー',
        operation: 'transitionTo',
      });

      expect(result.timestamp).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // canTransitionToのテスト
  describe('canTransitionTo', () => {
    test('遷移可能かどうかを判定する', () => {
      const state = 'task_in_progress';

      const result = adapter.canTransitionTo(state);

      expect(mockStateManager.canTransitionTo).toHaveBeenCalledWith(state);
      expect(result).toBe(true);
    });

    test('エラー時に適切に処理する', () => {
      mockStateManager.canTransitionTo.mockImplementationOnce(() => {
        throw new Error('遷移判定エラー');
      });

      const result = adapter.canTransitionTo('task_in_progress');

      expect(result).toMatchObject({
        error: true,
        message: '遷移判定エラー',
        operation: 'canTransitionTo',
      });

      expect(result.timestamp).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // getStateHistoryのテスト
  describe('getStateHistory', () => {
    test('状態履歴を取得する', () => {
      const history = adapter.getStateHistory();

      expect(mockStateManager.getStateHistory).toHaveBeenCalled();
      expect(history).toEqual([
        { state: 'uninitialized', timestamp: '2025-03-01T00:00:00.000Z' },
        { state: 'initialized', timestamp: '2025-03-01T00:01:00.000Z' },
      ]);
    });

    test('エラー時に適切に処理する', () => {
      mockStateManager.getStateHistory.mockImplementationOnce(() => {
        throw new Error('履歴取得エラー');
      });

      const result = adapter.getStateHistory();

      expect(result).toMatchObject({
        error: true,
        message: '履歴取得エラー',
        operation: 'getStateHistory',
      });

      expect(result.timestamp).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // getPreviousStateのテスト
  describe('getPreviousState', () => {
    test('前の状態を取得する', () => {
      const state = adapter.getPreviousState();

      expect(mockStateManager.getPreviousState).toHaveBeenCalled();
      expect(state).toBe('uninitialized');
    });

    test('エラー時に適切に処理する', () => {
      mockStateManager.getPreviousState.mockImplementationOnce(() => {
        throw new Error('前状態取得エラー');
      });

      const result = adapter.getPreviousState();

      expect(result).toMatchObject({
        error: true,
        message: '前状態取得エラー',
        operation: 'getPreviousState',
      });

      expect(result.timestamp).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // バリデーションのテスト
  describe('バリデーション', () => {
    test('setState: 状態が指定されていない場合はエラーを返す', () => {
      // _validateParamsをスパイ
      jest.spyOn(adapter, '_validateParams').mockImplementationOnce(() => {
        throw new ValidationError('状態は必須です');
      });

      const result = adapter.setState();

      expect(result).toMatchObject({
        error: true,
        message: '状態は必須です',
        operation: 'setState',
      });

      expect(result.timestamp).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    test('transitionTo: 状態が指定されていない場合はエラーを返す', () => {
      // _validateParamsをスパイ
      jest.spyOn(adapter, '_validateParams').mockImplementationOnce(() => {
        throw new ValidationError('状態は必須です');
      });

      const result = adapter.transitionTo();

      expect(result).toMatchObject({
        error: true,
        message: '状態は必須です',
        operation: 'transitionTo',
      });

      expect(result.timestamp).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // 後方互換性のテスト
  describe('後方互換性', () => {
    test('古いイベント名と新しいイベント名の両方が発行される', () => {
      // 古いイベント名と新しいイベント名のリスナーを登録
      const oldEventListener = jest.fn();
      const newEventListener = jest.fn();

      mockEventEmitter.on('state:changed', oldEventListener);
      mockEventEmitter.on('state:state_changed', newEventListener);

      // 状態を設定
      adapter.setState('session_started', { sessionId: 'S001' });

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

  // エラー処理のテスト
  describe('エラーイベント', () => {
    test('エラー時にapp:errorイベントを発行する', () => {
      // エラーイベントリスナーを設定
      const errorListener = jest.fn();
      mockEventEmitter.on('app:error', errorListener);

      // 後方互換性のイベントリスナーも設定
      const legacyErrorListener = jest.fn();
      mockEventEmitter.on('statemanager:error', legacyErrorListener);

      // グローバルエラーイベントリスナーも設定
      const globalErrorListener = jest.fn();
      mockEventEmitter.on('error', globalErrorListener);

      // エラーを発生させる
      mockStateManager.setState.mockImplementationOnce(() => {
        throw new Error('状態設定エラー');
      });

      // メソッドを呼び出す
      const result = adapter.setState('error_state', { reason: 'test' });

      // エラー結果を確認
      expect(result).toMatchObject({
        error: true,
        message: '状態設定エラー',
        operation: 'setState',
      });

      // エラーイベントが発行されたことを確認
      expect(errorListener).toHaveBeenCalled();

      // 後方互換性のイベントも発行されたことを確認
      expect(legacyErrorListener).toHaveBeenCalled();

      // グローバルエラーイベントも発行されたことを確認
      expect(globalErrorListener).toHaveBeenCalled();

      // エラーイベントのデータを確認
      const errorData = errorListener.mock.calls[0][0];
      expect(errorData.component).toBe('statemanager');
      expect(errorData.operation).toBe('setState');
      expect(errorData.message).toBe('状態設定エラー');
      expect(errorData.timestamp).toBeDefined();

      // エラーログが出力されたことを確認
      expect(mockLogger.error).toHaveBeenCalled();
    });

    test('回復可能なエラーと回復不可能なエラーを区別する', () => {
      // エラーイベントリスナーを設定
      const errorListener = jest.fn();
      mockEventEmitter.on('app:error', errorListener);

      // 回復可能なエラーを発生させる
      mockStateManager.setState.mockImplementationOnce(() => {
        const {
          ApplicationError,
        } = require('../../../src/lib/core/error-framework');
        throw new ApplicationError('回復可能なエラー', {
          recoverable: true,
        });
      });

      // メソッドを呼び出す
      const result1 = adapter.setState('recoverable_error', { reason: 'test' });

      // エラー結果を確認
      expect(result1).toMatchObject({
        error: true,
        message: '回復可能なエラー',
        operation: 'setState',
        recoverable: true,
      });

      // エラーイベントのデータを確認
      const errorData1 = errorListener.mock.calls[0][0];
      expect(errorData1.recoverable).toBe(true);

      // リスナーをリセット
      errorListener.mockClear();

      // 回復不可能なエラーを発生させる
      mockStateManager.setState.mockImplementationOnce(() => {
        const {
          ApplicationError,
        } = require('../../../src/lib/core/error-framework');
        throw new ApplicationError('回復不可能なエラー', {
          recoverable: false,
        });
      });

      // メソッドを呼び出す
      const result2 = adapter.setState('non_recoverable_error', {
        reason: 'test',
      });

      // エラー結果を確認
      expect(result2).toMatchObject({
        error: true,
        message: '回復不可能なエラー',
        operation: 'setState',
        recoverable: false,
      });

      // エラーイベントのデータを確認
      const errorData2 = errorListener.mock.calls[0][0];
      expect(errorData2.recoverable).toBe(false);
    });
  });
});

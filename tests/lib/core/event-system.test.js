/**
 * イベントシステムのテスト
 */

const { EnhancedEventEmitter, EventError } = require('../../../src/lib/core/event-system');
const { ApplicationError } = require('../../../src/lib/core/error-framework');

describe('イベントシステム', () => {
  describe('EnhancedEventEmitter', () => {
    let emitter;
    let mockLogger;
    
    beforeEach(() => {
      mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      };
      
      emitter = new EnhancedEventEmitter({
        logger: mockLogger
      });
    });
    
    test('通常のイベントリスナーを登録して呼び出せる', () => {
      const mockListener = jest.fn();
      emitter.on('test-event', mockListener);
      
      const testData = { foo: 'bar' };
      emitter.emit('test-event', testData);
      
      expect(mockListener).toHaveBeenCalledWith(testData);
    });
    
    test('複数のリスナーを登録して呼び出せる', () => {
      const mockListener1 = jest.fn();
      const mockListener2 = jest.fn();
      
      emitter.on('test-event', mockListener1);
      emitter.on('test-event', mockListener2);
      
      const testData = { foo: 'bar' };
      emitter.emit('test-event', testData);
      
      expect(mockListener1).toHaveBeenCalledWith(testData);
      expect(mockListener2).toHaveBeenCalledWith(testData);
    });
    
    test('リスナーを解除できる', () => {
      const mockListener = jest.fn();
      const removeListener = emitter.on('test-event', mockListener);
      
      // 最初の呼び出し
      emitter.emit('test-event', { first: true });
      expect(mockListener).toHaveBeenCalledTimes(1);
      
      // リスナーを解除
      removeListener();
      
      // 2回目の呼び出し
      emitter.emit('test-event', { second: true });
      expect(mockListener).toHaveBeenCalledTimes(1); // 変化なし
    });
    
    test('off()メソッドでリスナーを解除できる', () => {
      const mockListener = jest.fn();
      emitter.on('test-event', mockListener);
      
      // 最初の呼び出し
      emitter.emit('test-event', { first: true });
      expect(mockListener).toHaveBeenCalledTimes(1);
      
      // リスナーを解除
      emitter.off('test-event', mockListener);
      
      // 2回目の呼び出し
      emitter.emit('test-event', { second: true });
      expect(mockListener).toHaveBeenCalledTimes(1); // 変化なし
    });
    
    test('一度だけ実行されるリスナーを登録できる', () => {
      const mockListener = jest.fn();
      emitter.once('test-event', mockListener);
      
      // 最初の呼び出し
      emitter.emit('test-event', { first: true });
      expect(mockListener).toHaveBeenCalledTimes(1);
      
      // 2回目の呼び出し
      emitter.emit('test-event', { second: true });
      expect(mockListener).toHaveBeenCalledTimes(1); // 変化なし
    });
    
    test('ワイルドカードパターンのリスナーを登録して呼び出せる', () => {
      const mockListener = jest.fn();
      emitter.on('test:*', mockListener);
      
      // 一致するイベント
      emitter.emit('test:foo', { type: 'foo' });
      emitter.emit('test:bar', { type: 'bar' });
      
      // 一致しないイベント
      emitter.emit('other:foo', { type: 'other' });
      
      expect(mockListener).toHaveBeenCalledTimes(2);
      expect(mockListener).toHaveBeenNthCalledWith(1, { type: 'foo' }, 'test:foo');
      expect(mockListener).toHaveBeenNthCalledWith(2, { type: 'bar' }, 'test:bar');
    });
    
    test('ワイルドカードリスナーを解除できる', () => {
      const mockListener = jest.fn();
      const removeListener = emitter.on('test:*', mockListener);
      
      // 最初の呼び出し
      emitter.emit('test:foo', { first: true });
      expect(mockListener).toHaveBeenCalledTimes(1);
      
      // リスナーを解除
      removeListener();
      
      // 2回目の呼び出し
      emitter.emit('test:bar', { second: true });
      expect(mockListener).toHaveBeenCalledTimes(1); // 変化なし
    });
    
    test('非同期イベントを発行できる', async () => {
      const mockListener = jest.fn().mockResolvedValue('done');
      emitter.on('async-event', mockListener);
      
      const testData = { foo: 'bar' };
      await emitter.emitAsync('async-event', testData);
      
      expect(mockListener).toHaveBeenCalledWith(testData);
    });
    
    test('標準化されたイベントを発行できる', () => {
      const componentListener = jest.fn();
      const globalListener = jest.fn();
      
      emitter.on('component:action', componentListener);
      emitter.on('event', globalListener);
      
      const testData = { foo: 'bar' };
      emitter.emitStandardized('component', 'action', testData);
      
      expect(componentListener).toHaveBeenCalled();
      expect(globalListener).toHaveBeenCalled();
      
      const componentEvent = componentListener.mock.calls[0][0];
      expect(componentEvent.foo).toBe('bar');
      expect(componentEvent.component).toBe('component');
      expect(componentEvent.action).toBe('action');
      expect(componentEvent.timestamp).toBeDefined();
      
      const globalEvent = globalListener.mock.calls[0][0];
      expect(globalEvent.type).toBe('component:action');
      expect(globalEvent.foo).toBe('bar');
    });
    
    test('非同期で標準化されたイベントを発行できる', async () => {
      const componentListener = jest.fn().mockResolvedValue('done');
      const globalListener = jest.fn().mockResolvedValue('done');
      
      emitter.on('component:action', componentListener);
      emitter.on('event', globalListener);
      
      const testData = { foo: 'bar' };
      await emitter.emitStandardizedAsync('component', 'action', testData);
      
      expect(componentListener).toHaveBeenCalled();
      expect(globalListener).toHaveBeenCalled();
    });
    
    test('リスナー内のエラーをキャッチする', () => {
      const errorListener = jest.fn();
      emitter.on('error', errorListener);
      
      const mockListener = jest.fn().mockImplementation(() => {
        throw new Error('リスナーエラー');
      });
      
      emitter.on('test-event', mockListener);
      emitter.emit('test-event', { foo: 'bar' });
      
      expect(mockLogger.error).toHaveBeenCalled();
      expect(errorListener).toHaveBeenCalled();
      const errorEvent = errorListener.mock.calls[0][0];
      expect(errorEvent).toBeInstanceOf(EventError);
      expect(errorEvent.message).toContain('イベントリスナーでエラーが発生しました');
    });
    
    test('非同期リスナー内のエラーをキャッチする', async () => {
      const errorListener = jest.fn();
      emitter.on('error', errorListener);
      
      const mockListener = jest.fn().mockRejectedValue(new Error('非同期リスナーエラー'));
      
      emitter.on('async-event', mockListener);
      await emitter.emitAsync('async-event', { foo: 'bar' });
      
      expect(mockLogger.error).toHaveBeenCalled();
      expect(errorListener).toHaveBeenCalled();
    });
    
    test('登録されているイベント一覧を取得できる', () => {
      emitter.on('event1', () => {});
      emitter.on('event2', () => {});
      emitter.on('event3', () => {});
      
      const events = emitter.getRegisteredEvents();
      
      expect(events).toHaveLength(3);
      expect(events).toContain('event1');
      expect(events).toContain('event2');
      expect(events).toContain('event3');
    });
    
    test('登録されているワイルドカードパターン一覧を取得できる', () => {
      emitter.on('event1:*', () => {});
      emitter.on('event2:*', () => {});
      
      const patterns = emitter.getRegisteredWildcardPatterns();
      
      expect(patterns).toHaveLength(2);
      expect(patterns[0]).toContain('event1');
      expect(patterns[1]).toContain('event2');
    });
    
    test('特定イベントのリスナー数を取得できる', () => {
      emitter.on('test-event', () => {});
      emitter.on('test-event', () => {});
      emitter.on('test:*', () => {});
      
      expect(emitter.listenerCount('test-event')).toBe(2);
      expect(emitter.listenerCount('test:foo')).toBe(1); // ワイルドカードに一致
      expect(emitter.listenerCount('other-event')).toBe(0);
    });
    
    test('イベント履歴を有効にして取得できる', () => {
      const emitterWithHistory = new EnhancedEventEmitter({
        keepHistory: true,
        historyLimit: 5
      });
      
      emitterWithHistory.emit('event1', { id: 1 });
      emitterWithHistory.emit('event2', { id: 2 });
      emitterWithHistory.emit('event3', { id: 3 });
      
      const history = emitterWithHistory.getEventHistory();
      
      expect(history).toHaveLength(3);
      expect(history[0].event).toBe('event1');
      expect(history[0].data.id).toBe(1);
      expect(history[0].timestamp).toBeDefined();
      
      expect(history[2].event).toBe('event3');
    });
    
    test('イベント履歴の上限を超えると古いものから削除される', () => {
      const emitterWithHistory = new EnhancedEventEmitter({
        keepHistory: true,
        historyLimit: 2
      });
      
      emitterWithHistory.emit('event1', { id: 1 });
      emitterWithHistory.emit('event2', { id: 2 });
      emitterWithHistory.emit('event3', { id: 3 });
      
      const history = emitterWithHistory.getEventHistory();
      
      expect(history).toHaveLength(2);
      expect(history[0].event).toBe('event2');
      expect(history[1].event).toBe('event3');
    });
    
    test('イベント履歴が無効の場合はエラーをスローする', () => {
      expect(() => {
        emitter.getEventHistory();
      }).toThrow(EventError);
    });
    
    test('デバッグモードを設定できる', () => {
      emitter.setDebugMode(true);
      expect(mockLogger.debug).toHaveBeenCalled();
      
      const listener = jest.fn();
      emitter.on('debug-test', listener);
      emitter.emit('debug-test', { test: true });
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('イベント発行'),
        expect.any(Object)
      );
    });
    
    test('すべてのリスナーを削除できる', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const wildcardListener = jest.fn();
      
      emitter.on('event1', listener1);
      emitter.on('event2', listener2);
      emitter.on('event:*', wildcardListener);
      
      emitter.removeAllListeners();
      
      emitter.emit('event1', { test: true });
      emitter.emit('event2', { test: true });
      emitter.emit('event:test', { test: true });
      
      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
      expect(wildcardListener).not.toHaveBeenCalled();
    });
  });
  
  describe('EventError', () => {
    test('ApplicationErrorを継承している', () => {
      const error = new EventError('イベントエラー');
      
      expect(error).toBeInstanceOf(ApplicationError);
      expect(error.name).toBe('EventError');
      expect(error.code).toBe('ERR_EVENT');
      expect(error.recoverable).toBe(true);
    });
    
    test('オプションを正しく処理する', () => {
      const cause = new Error('原因エラー');
      const context = { event: 'test-event' };
      const error = new EventError('イベントエラー', {
        code: 'CUSTOM_EVENT_ERROR',
        context,
        cause,
        recoverable: false
      });
      
      expect(error.code).toBe('CUSTOM_EVENT_ERROR');
      expect(error.context).toBe(context);
      expect(error.cause).toBe(cause);
      expect(error.recoverable).toBe(false);
    });
  });
});
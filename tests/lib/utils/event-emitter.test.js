/**
 * イベントエミッタークラスのテスト
 */

const EventEmitter = require('../../../src/lib/utils/event-emitter');
const { EnhancedEventEmitter } = require('../../../src/lib/core/event-system');
const { 
  createMockLogger, 
  createMockEventEmitter,
  mockTimestamp 
} = require('../../helpers/mock-factory');
const { 
  expectEventEmitted,
  expectLogged
} = require('../../helpers/test-helpers');

describe('EventEmitter', () => {
  let eventEmitter;
  let mockLogger;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockLogger = createMockLogger();
    
    // 日付・時間関連のモックを設定
    mockTimestamp('2025-03-24T00:00:00.000Z');
    
    // EventEmitterのインスタンスを作成
    eventEmitter = new EventEmitter({
      logger: mockLogger,
      debugMode: true,
      keepHistory: true,
      historyLimit: 200
    });
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  describe('constructor', () => {
    test('デフォルト値で初期化される', () => {
      // Arrange
      const instance = new EventEmitter();
      
      // Assert
      expect(instance.logger).toEqual(console);
      expect(instance.debugMode).toBe(false);
      expect(instance._isStandardized).toBe(false);
    });
    
    test('カスタム値で初期化される', () => {
      // Arrange
      const customLogger = createMockLogger();
      const instance = new EventEmitter({
        logger: customLogger,
        debugMode: true
      });
      
      // Assert
      expect(instance.logger).toBe(customLogger);
      expect(instance.debugMode).toBe(true);
      expect(instance._isStandardized).toBe(false);
    });
    
    test('親クラスのコンストラクタを正しく呼び出す', () => {
      // Arrange
      const options = {
        logger: mockLogger,
        debugMode: true,
        keepHistory: true,
        historyLimit: 200
      };
      
      // Act
      const instance = new EventEmitter(options);
      
      // Assert
      expect(instance.logger).toBe(mockLogger);
      expect(instance.debugMode).toBe(true);
    });
  });
  
  describe('on', () => {
    test('親クラスのonメソッドを呼び出す', () => {
      // Arrange
      const event = 'test-event';
      const callback = jest.fn();
      
      // onメソッドをスパイ
      jest.spyOn(eventEmitter, 'on');
      
      // Act
      eventEmitter.on(event, callback);
      
      // Assert
      expect(eventEmitter.on).toHaveBeenCalledWith(event, callback);
    });
  });
  
  describe('off', () => {
    test('親クラスのoffメソッドを呼び出す', () => {
      // Arrange
      const event = 'test-event';
      const callback = jest.fn();
      
      // offメソッドをスパイ
      jest.spyOn(eventEmitter, 'off');
      
      // Act
      eventEmitter.off(event, callback);
      
      // Assert
      expect(eventEmitter.off).toHaveBeenCalledWith(event, callback);
    });
  });
  
  describe('emit', () => {
    test.each([
      ['標準形式', 'component:action', true],
      ['非標準形式', 'non-standard-event', false],
      ['コロンを含む非標準形式', 'non:standard:event', true],
      ['コロンなしのイベント（_isStandardized=false）', 'simpleevent', false]
    ])('%s のイベント名の場合、警告出力は %s', (_, event, shouldWarn) => {
      // Arrange
      const data = { key: 'value' };
      
      // 親クラスのemitをスパイ
      const superEmit = jest.spyOn(EnhancedEventEmitter.prototype, 'emit').mockImplementation(() => {});
      
      // Act
      eventEmitter.emit(event, data);
      
      // Assert
      expect(superEmit).toHaveBeenCalledWith(event, data);
      
      if (shouldWarn) {
        expect(mockLogger.warn).toHaveBeenCalledWith(`非標準のイベント名: ${event}`, { context: {} });
      } else {
        expect(mockLogger.warn).not.toHaveBeenCalled();
      }
    });
    test('_isStandardizedがtrueの場合、警告を出力しない', () => {
      // Arrange
      const event = 'non:standard:event';
      const data = { key: 'value' };
      
      // 親クラスのemitをスパイ
      const superEmit = jest.spyOn(EnhancedEventEmitter.prototype, 'emit').mockImplementation(() => {});
      
      // _isStandardizedをtrueに設定
      eventEmitter._isStandardized = true;
      
      // Act
      eventEmitter.emit(event, data);
      
      // Assert
      expect(superEmit).toHaveBeenCalledWith(event, data);
      expect(mockLogger.warn).not.toHaveBeenCalled();
      
      // 元に戻す
      eventEmitter._isStandardized = false;
    });

    test('コロンなしのイベント（_isStandardized=true）の場合、警告を出力しない', () => {
      // Arrange
      const event = 'simpleevent';
      const data = { key: 'value' };
      
      // 親クラスのemitをスパイ
      const superEmit = jest.spyOn(EnhancedEventEmitter.prototype, 'emit').mockImplementation(() => {});
      
      // _isStandardizedをtrueに設定
      eventEmitter._isStandardized = true;
      
      // Act
      eventEmitter.emit(event, data);
      
      // Assert
      expect(superEmit).toHaveBeenCalledWith(event, data);
      expect(mockLogger.warn).not.toHaveBeenCalled();
      
      // 元に戻す
      eventEmitter._isStandardized = false;
    });
  });
  
  describe('emitStandardized', () => {
    test('標準化されたイベントを発行する', () => {
      // Arrange
      const component = 'component';
      const action = 'action';
      const data = { key: 'value' };
      
      // 親クラスのemitメソッドをスパイ
      const superEmit = jest.spyOn(EnhancedEventEmitter.prototype, 'emit').mockImplementation(() => {});
      
      // Act
      eventEmitter.emitStandardized(component, action, data);
      
      // Assert
      // _isStandardizedがfalseに戻ることを確認
      expect(eventEmitter._isStandardized).toBe(false);
      
      // 標準化されたイベントが発行されることを確認
      expect(superEmit).toHaveBeenCalledWith(
        `${component}:${action}`,
        expect.objectContaining({
          ...data,
          timestamp: '2025-03-24T00:00:00.000Z',
          component,
          action
        })
      );
      
      // グローバルイベントも発行されることを確認
      expect(superEmit).toHaveBeenCalledWith(
        'event',
        expect.objectContaining({
          type: `${component}:${action}`,
          ...data,
          timestamp: '2025-03-24T00:00:00.000Z',
          component,
          action
        })
      );
    });

    test('dataパラメータのデフォルト値を使用して標準化されたイベントを発行する', () => {
      // Arrange
      const component = 'component';
      const action = 'action';
      
      // 親クラスのemitメソッドをスパイ
      const superEmit = jest.spyOn(EnhancedEventEmitter.prototype, 'emit').mockImplementation(() => {});
      
      // Act - dataパラメータを省略
      eventEmitter.emitStandardized(component, action);
      
      // Assert
      // _isStandardizedがfalseに戻ることを確認
      expect(eventEmitter._isStandardized).toBe(false);
      
      // 標準化されたイベントが発行されることを確認
      expect(superEmit).toHaveBeenCalledWith(
        `${component}:${action}`,
        expect.objectContaining({
          timestamp: '2025-03-24T00:00:00.000Z',
          component,
          action
        })
      );
      
      // グローバルイベントも発行されることを確認
      expect(superEmit).toHaveBeenCalledWith(
        'event',
        expect.objectContaining({
          type: `${component}:${action}`,
          timestamp: '2025-03-24T00:00:00.000Z',
          component,
          action
        })
      );
    });
    
    test('エラーが発生した場合でも_isStandardizedがfalseに戻る', () => {
      // Arrange
      const component = 'component';
      const action = 'action';
      const data = { key: 'value' };
      
      // 親クラスのemitメソッドをスパイしてエラーをスローするように設定
      jest.spyOn(EnhancedEventEmitter.prototype, 'emit').mockImplementation(() => {
        throw new Error('テストエラー');
      });
      
      // Act & Assert
      expect(() => {
        eventEmitter.emitStandardized(component, action, data);
      }).toThrow('テストエラー');
      
      // _isStandardizedがfalseに戻ることを確認
      expect(eventEmitter._isStandardized).toBe(false);
    });
  });
  
  describe('emitAsync', () => {
    test.each([
      ['標準形式', 'component:action', true],
      ['非標準形式', 'non-standard-event', false],
      ['コロンを含む非標準形式', 'non:standard:event', true],
      ['コロンなしのイベント（_isStandardized=false）', 'simpleevent', false]
    ])('%s のイベント名の場合、警告出力は %s', async (_, event, shouldWarn) => {
      // Arrange
      const data = { key: 'value' };
      
      // 親クラスのemitAsyncをスパイ
      const superEmitAsync = jest.spyOn(EnhancedEventEmitter.prototype, 'emitAsync').mockResolvedValue(true);
      
      // Act
      await eventEmitter.emitAsync(event, data);
      
      // Assert
      expect(superEmitAsync).toHaveBeenCalledWith(event, data);
      
      if (shouldWarn) {
        expect(mockLogger.warn).toHaveBeenCalledWith(`非標準のイベント名: ${event}`, { context: {} });
      } else {
        expect(mockLogger.warn).not.toHaveBeenCalled();
      }
    });
    
    test('_isStandardizedがtrueの場合、警告を出力しない', async () => {
      // Arrange
      const event = 'non:standard:event';
      const data = { key: 'value' };
      
      // 親クラスのemitAsyncをスパイ
      const superEmitAsync = jest.spyOn(EnhancedEventEmitter.prototype, 'emitAsync').mockResolvedValue(true);
      
      // _isStandardizedをtrueに設定
      eventEmitter._isStandardized = true;
      
      // Act
      await eventEmitter.emitAsync(event, data);
      
      // Assert
      expect(superEmitAsync).toHaveBeenCalledWith(event, data);
      expect(mockLogger.warn).not.toHaveBeenCalled();
      
      // 元に戻す
      eventEmitter._isStandardized = false;
    });

    test('コロンなしのイベント（_isStandardized=true）の場合、警告を出力しない', async () => {
      // Arrange
      const event = 'simpleevent';
      const data = { key: 'value' };
      
      // 親クラスのemitAsyncをスパイ
      const superEmitAsync = jest.spyOn(EnhancedEventEmitter.prototype, 'emitAsync').mockResolvedValue(true);
      
      // _isStandardizedをtrueに設定
      eventEmitter._isStandardized = true;
      
      // Act
      await eventEmitter.emitAsync(event, data);
      
      // Assert
      expect(superEmitAsync).toHaveBeenCalledWith(event, data);
      expect(mockLogger.warn).not.toHaveBeenCalled();
      
      // 元に戻す
      eventEmitter._isStandardized = false;
    });
  });
  
  describe('emitStandardizedAsync', () => {
    test('標準化された非同期イベントを発行する', async () => {
      // Arrange
      const component = 'component';
      const action = 'action';
      const data = { key: 'value' };
      
      // 親クラスのemitAsyncメソッドをスパイ
      const superEmitAsync = jest.spyOn(EnhancedEventEmitter.prototype, 'emitAsync').mockResolvedValue(undefined);
      
      // Act
      await eventEmitter.emitStandardizedAsync(component, action, data);
      
      // Assert
      // _isStandardizedがfalseに戻ることを確認
      expect(eventEmitter._isStandardized).toBe(false);
      
      // 標準化されたイベントが発行されることを確認
      expect(superEmitAsync).toHaveBeenCalledWith(
        `${component}:${action}`,
        expect.objectContaining({
          ...data,
          timestamp: '2025-03-24T00:00:00.000Z',
          component,
          action
        })
      );
      
      // グローバルイベントも発行されることを確認
      expect(superEmitAsync).toHaveBeenCalledWith(
        'event',
        expect.objectContaining({
          type: `${component}:${action}`,
          ...data,
          timestamp: '2025-03-24T00:00:00.000Z',
          component,
          action
        })
      );
    });
    
    test('dataパラメータのデフォルト値を使用して標準化された非同期イベントを発行する', async () => {
      // Arrange
      const component = 'component';
      const action = 'action';
      
      // 親クラスのemitAsyncメソッドをスパイ
      const superEmitAsync = jest.spyOn(EnhancedEventEmitter.prototype, 'emitAsync').mockResolvedValue(undefined);
      
      // Act - dataパラメータを省略
      await eventEmitter.emitStandardizedAsync(component, action);
      
      // Assert
      // _isStandardizedがfalseに戻ることを確認
      expect(eventEmitter._isStandardized).toBe(false);
      
      // 標準化されたイベントが発行されることを確認
      expect(superEmitAsync).toHaveBeenCalledWith(
        `${component}:${action}`,
        expect.objectContaining({
          timestamp: '2025-03-24T00:00:00.000Z',
          component,
          action
        })
      );
      
      // グローバルイベントも発行されることを確認
      expect(superEmitAsync).toHaveBeenCalledWith(
        'event',
        expect.objectContaining({
          type: `${component}:${action}`,
          timestamp: '2025-03-24T00:00:00.000Z',
          component,
          action
        })
      );
    });

    test('エラーが発生した場合でも_isStandardizedがfalseに戻る', async () => {
      // Arrange
      const component = 'component';
      const action = 'action';
      const data = { key: 'value' };
      
      // 親クラスのemitAsyncメソッドをスパイしてエラーをスローするように設定
      jest.spyOn(EnhancedEventEmitter.prototype, 'emitAsync').mockRejectedValue(new Error('テストエラー'));
      
      // Act & Assert
      await expect(
        eventEmitter.emitStandardizedAsync(component, action, data)
      ).rejects.toThrow('テストエラー');
      
      // _isStandardizedがfalseに戻ることを確認
      expect(eventEmitter._isStandardized).toBe(false);
    });
  });
  
  describe('getRegisteredEvents', () => {
    test('親クラスのgetRegisteredEventsメソッドを呼び出す', () => {
      // Arrange
      // 親クラスのgetRegisteredEventsメソッドをスパイ
      const superGetRegisteredEvents = jest.spyOn(EnhancedEventEmitter.prototype, 'getRegisteredEvents').mockReturnValue(['event1', 'event2']);
      
      // Act
      const result = eventEmitter.getRegisteredEvents();
      
      // Assert
      expect(superGetRegisteredEvents).toHaveBeenCalled();
      expect(result).toEqual(['event1', 'event2']);
    });
    
    test('実際の実装を呼び出す', () => {
      // Arrange
      // 親クラスのgetRegisteredEventsメソッドをスパイ（実際の実装を呼び出す）
      const superGetRegisteredEvents = jest.spyOn(EnhancedEventEmitter.prototype, 'getRegisteredEvents');
      
      // イベントリスナーを登録
      eventEmitter.on('test-event', () => {});
      
      // Act
      const result = eventEmitter.getRegisteredEvents();
      
      // Assert
      expect(superGetRegisteredEvents).toHaveBeenCalled();
      expect(result).toContain('test-event');
    });
  });
  
  describe('listenerCount', () => {
    test('親クラスのlistenerCountメソッドを呼び出す', () => {
      // Arrange
      const event = 'test-event';
      
      // 親クラスのlistenerCountメソッドをスパイ
      const superListenerCount = jest.spyOn(EnhancedEventEmitter.prototype, 'listenerCount').mockReturnValue(5);
      
      // Act
      const result = eventEmitter.listenerCount(event);
      
      // Assert
      expect(superListenerCount).toHaveBeenCalledWith(event);
      expect(result).toBe(5);
    });
    
    test('実際の実装を呼び出す', () => {
      // Arrange
      const event = 'test-event';
      const callback = jest.fn();
      
      // イベントリスナーを登録
      eventEmitter.on(event, callback);
      
      // 親クラスのlistenerCountメソッドをスパイ（実際の実装を呼び出す）
      const superListenerCount = jest.spyOn(EnhancedEventEmitter.prototype, 'listenerCount');
      
      // Act
      const result = eventEmitter.listenerCount(event);
      
      // Assert
      expect(superListenerCount).toHaveBeenCalledWith(event);
      expect(result).toBeGreaterThan(0); // 少なくとも1つのリスナーがあるはず
    });
  });
});
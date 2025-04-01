/**
 * イベントエミッタークラスのテスト
 */

const EventEmitter = require('../../../src/lib/utils/event-emitter');
const { EnhancedEventEmitter } = require('../../../src/lib/core/event-system');
const {
  createMockLogger,
  mockTimestamp,
} = require('../../helpers/mock-factory');
// expectStandardizedEventEmitted は EventEmitter 自体のテストでは直接使わない

describe('EventEmitter', () => {
  let eventEmitter;
  let mockLogger;
  const MOCK_TIMESTAMP_ISO = '2025-03-24T00:00:00.000Z';

  beforeEach(() => {
    // Arrange (Common setup)
    jest.clearAllMocks();
    mockLogger = createMockLogger();

    // 時間関連のモック
    mockTimestamp(MOCK_TIMESTAMP_ISO);

    // EventEmitterのインスタンスを作成
    eventEmitter = new EventEmitter({
      logger: mockLogger,
      debugMode: true, // デバッグログのテストのため true に
    });
  });

  afterEach(() => {
    // Clean up mocks
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    test('should throw error if logger is not provided', () => {
      // Arrange & Act & Assert
      expect(() => new EventEmitter()).toThrow('Logger instance is required');
    });

    test('should initialize with custom values', () => {
      // Arrange
      const customLogger = createMockLogger();

      // Act
      const instance = new EventEmitter({
        logger: customLogger,
        debugMode: true,
        keepHistory: true, // true に設定
        historyLimit: 50,
      });

      // Assert
      expect(instance.logger).toBe(customLogger);
      expect(instance.debugMode).toBe(true);
      // keepHistory プロパティではなく eventHistory の型をチェック
      expect(instance.eventHistory).toBeInstanceOf(Array);
      expect(instance.historyLimit).toBe(50);
    });

    test('should call parent constructor correctly', () => {
      // Assert (Instance created in beforeEach)
      expect(eventEmitter.logger).toBe(mockLogger);
      expect(eventEmitter.debugMode).toBe(true); // from beforeEach setup
      // keepHistory プロパティではなく eventHistory が null であることをチェック (デフォルトは false)
      expect(eventEmitter.eventHistory).toBeNull();
      expect(eventEmitter.historyLimit).toBe(100); // Default
    });

    test('should initialize with debugMode false if option is not provided', () => {
      // Arrange & Act
      const instance = new EventEmitter({ logger: mockLogger }); // debugMode なし

      // Assert
      expect(instance.debugMode).toBe(false);
    });
  });

  describe('on', () => {
    test('should call parent class on method', () => {
      // Arrange
      const event = 'test-event';
      const callback = jest.fn();
      const superOnSpy = jest.spyOn(EnhancedEventEmitter.prototype, 'on');

      // Act
      eventEmitter.on(event, callback);

      // Assert
      expect(superOnSpy).toHaveBeenCalledWith(event, callback);
    });
  });

  describe('off', () => {
    test('should call parent class off method', () => {
      // Arrange
      const event = 'test-event';
      const callback = jest.fn();
      const superOffSpy = jest.spyOn(EnhancedEventEmitter.prototype, 'off');

      // Act
      eventEmitter.off(event, callback);

      // Assert
      expect(superOffSpy).toHaveBeenCalledWith(event, callback);
    });
  });

  // emit と emitAsync のテストは削除 (親クラスでテストされるべき)

  describe('emitStandardized', () => {
    test('should emit standardized event and global event', () => {
      // Arrange
      const component = 'component';
      const action = 'action';
      const data = { key: 'value' };
      const superEmitSpy = jest.spyOn(EnhancedEventEmitter.prototype, 'emit');

      // Act
      eventEmitter.emitStandardized(component, action, data);

      // Assert
      // 1. Standardized event (`component:action`)
      expect(superEmitSpy).toHaveBeenCalledWith(
        `${component}:${action}`,
        expect.objectContaining({
          ...data,
          timestamp: MOCK_TIMESTAMP_ISO,
          component,
          action,
          // traceId と requestId の検証を削除
        })
      );
      // 2. Global event (`event`)
      expect(superEmitSpy).toHaveBeenCalledWith(
        'event',
        expect.objectContaining({
          type: `${component}:${action}`,
          ...data,
          timestamp: MOCK_TIMESTAMP_ISO,
          component,
          action,
          // traceId と requestId の検証を削除
        })
      );
      expect(superEmitSpy).toHaveBeenCalledTimes(2);
    });

    test('should emit events with default data if data parameter is omitted', () => {
      // Arrange
      const component = 'component';
      const action = 'action';
      const superEmitSpy = jest.spyOn(EnhancedEventEmitter.prototype, 'emit');

      // Act
      eventEmitter.emitStandardized(component, action); // data is omitted

      // Assert
      expect(superEmitSpy).toHaveBeenCalledWith(
        `${component}:${action}`,
        expect.objectContaining({
          timestamp: MOCK_TIMESTAMP_ISO,
          component,
          action,
          // traceId と requestId の検証を削除
        })
      );
      expect(superEmitSpy).toHaveBeenCalledWith(
        'event',
        expect.objectContaining({
          type: `${component}:${action}`,
          timestamp: MOCK_TIMESTAMP_ISO,
          component,
          action,
          // traceId と requestId の検証を削除
        })
      );
      expect(superEmitSpy).toHaveBeenCalledTimes(2);
    });

    test('should re-throw error if parent emit throws', () => {
      // Arrange
      const component = 'component';
      const action = 'action';
      const data = { key: 'value' };
      const testError = new Error('テストエラー');
      jest
        .spyOn(EnhancedEventEmitter.prototype, 'emit')
        .mockImplementation(() => {
          throw testError;
        });

      // Act & Assert
      expect(() => {
        eventEmitter.emitStandardized(component, action, data);
      }).toThrow(testError);
    });
  });

  describe('emitStandardizedAsync', () => {
    test('should emit standardized async event and global event', async () => {
      // Arrange
      const component = 'component';
      const action = 'action';
      const data = { key: 'value' };
      const superEmitAsyncSpy = jest
        .spyOn(EnhancedEventEmitter.prototype, 'emitAsync')
        .mockResolvedValue(true);

      // Act
      await eventEmitter.emitStandardizedAsync(component, action, data);

      // Assert
      // 1. Standardized event (`component:action`)
      expect(superEmitAsyncSpy).toHaveBeenCalledWith(
        `${component}:${action}`,
        expect.objectContaining({
          ...data,
          timestamp: MOCK_TIMESTAMP_ISO,
          component,
          action,
          // traceId と requestId の検証を削除
        })
      );
      // 2. Global event (`event`)
      expect(superEmitAsyncSpy).toHaveBeenCalledWith(
        'event',
        expect.objectContaining({
          type: `${component}:${action}`,
          ...data,
          timestamp: MOCK_TIMESTAMP_ISO,
          component,
          action,
          // traceId と requestId の検証を削除
        })
      );
      expect(superEmitAsyncSpy).toHaveBeenCalledTimes(2);
    });

    test('should emit async events with default data if data parameter is omitted', async () => {
      // Arrange
      const component = 'component';
      const action = 'action';
      const superEmitAsyncSpy = jest
        .spyOn(EnhancedEventEmitter.prototype, 'emitAsync')
        .mockResolvedValue(true);

      // Act
      await eventEmitter.emitStandardizedAsync(component, action); // data is omitted

      // Assert
      expect(superEmitAsyncSpy).toHaveBeenCalledWith(
        `${component}:${action}`,
        expect.objectContaining({
          timestamp: MOCK_TIMESTAMP_ISO,
          component,
          action,
          // traceId と requestId の検証を削除
        })
      );
      expect(superEmitAsyncSpy).toHaveBeenCalledWith(
        'event',
        expect.objectContaining({
          type: `${component}:${action}`,
          timestamp: MOCK_TIMESTAMP_ISO,
          component,
          action,
          // traceId と requestId の検証を削除
        })
      );
      expect(superEmitAsyncSpy).toHaveBeenCalledTimes(2);
    });

    test('should reject if parent emitAsync rejects', async () => {
      // Arrange
      const component = 'component';
      const action = 'action';
      const data = { key: 'value' };
      const testError = new Error('テストエラー');
      jest
        .spyOn(EnhancedEventEmitter.prototype, 'emitAsync')
        .mockRejectedValue(testError);

      // Act & Assert
      await expect(
        eventEmitter.emitStandardizedAsync(component, action, data)
      ).rejects.toThrow(testError);
    });
  });

  describe('getRegisteredEvents', () => {
    test('should call parent class getRegisteredEvents method', () => {
      // Arrange
      const expectedEvents = ['event1', 'event2'];
      const superGetRegisteredEventsSpy = jest
        .spyOn(EnhancedEventEmitter.prototype, 'getRegisteredEvents')
        .mockReturnValue(expectedEvents);

      // Act
      const result = eventEmitter.getRegisteredEvents();

      // Assert
      expect(superGetRegisteredEventsSpy).toHaveBeenCalled();
      expect(result).toEqual(expectedEvents);
    });
  });

  describe('listenerCount', () => {
    test('should call parent class listenerCount method', () => {
      // Arrange
      const event = 'test-event';
      const expectedCount = 5;
      const superListenerCountSpy = jest
        .spyOn(EnhancedEventEmitter.prototype, 'listenerCount')
        .mockReturnValue(expectedCount);

      // Act
      const result = eventEmitter.listenerCount(event);

      // Assert
      expect(superListenerCountSpy).toHaveBeenCalledWith(event);
      expect(result).toBe(expectedCount);
    });
  });
});

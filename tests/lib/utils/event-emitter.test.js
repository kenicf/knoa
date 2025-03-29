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
    // モックのセットアップ
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
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    test('logger がないとエラーをスローする', () => {
      expect(() => new EventEmitter()).toThrow('Logger instance is required');
    });

    test('カスタム値で初期化される', () => {
      // Arrange
      const customLogger = createMockLogger();
      const instance = new EventEmitter({
        logger: customLogger,
        debugMode: true,
      });

      // Assert
      expect(instance.logger).toBe(customLogger);
      expect(instance.debugMode).toBe(true);
    });

    test('親クラスのコンストラクタを正しく呼び出す', () => {
      // Assert (beforeEach でインスタンスが作成される際に検証される)
      expect(eventEmitter.logger).toBe(mockLogger);
      expect(eventEmitter.debugMode).toBe(true);
    });

    test('debugMode オプションがない場合、false で初期化される', () => {
      // Arrange & Act
      const instance = new EventEmitter({ logger: mockLogger }); // debugMode なし
      // Assert
      expect(instance.debugMode).toBe(false);
    });
  });

  describe('on', () => {
    test('親クラスのonメソッドを呼び出す', () => {
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
    test('親クラスのoffメソッドを呼び出す', () => {
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

  // emit メソッドのテストブロックは削除

  describe('emitStandardized', () => {
    test('標準化されたイベントとグローバルイベントを発行する', () => {
      // Arrange
      const component = 'component';
      const action = 'action';
      const data = { key: 'value' };
      const superEmit = jest.spyOn(EnhancedEventEmitter.prototype, 'emit');

      // Act
      eventEmitter.emitStandardized(component, action, data);

      // Assert
      // 標準化されたイベントの発行検証
      expect(superEmit).toHaveBeenCalledWith(
        `${component}:${action}`,
        expect.objectContaining({
          ...data,
          timestamp: MOCK_TIMESTAMP_ISO, // 正確なタイムスタンプを検証
          component,
          action,
        })
      );

      // グローバルイベントの発行検証
      expect(superEmit).toHaveBeenCalledWith(
        'event',
        expect.objectContaining({
          type: `${component}:${action}`,
          ...data,
          timestamp: MOCK_TIMESTAMP_ISO,
          component,
          action,
        })
      );
      expect(superEmit).toHaveBeenCalledTimes(2);
    });

    test('dataパラメータのデフォルト値を使用してイベントを発行する', () => {
      // Arrange
      const component = 'component';
      const action = 'action';
      const superEmit = jest.spyOn(EnhancedEventEmitter.prototype, 'emit');

      // Act
      eventEmitter.emitStandardized(component, action); // dataパラメータを省略

      // Assert
      // 標準化されたイベントの発行検証 (空のデータ)
      expect(superEmit).toHaveBeenCalledWith(
        `${component}:${action}`,
        expect.objectContaining({
          timestamp: MOCK_TIMESTAMP_ISO,
          component,
          action,
        })
      );
      // グローバルイベントの発行検証 (空のデータ)
      expect(superEmit).toHaveBeenCalledWith(
        'event',
        expect.objectContaining({
          type: `${component}:${action}`,
          timestamp: MOCK_TIMESTAMP_ISO,
          component,
          action,
        })
      );
      expect(superEmit).toHaveBeenCalledTimes(2);
    });

    test('エラーが発生した場合でも例外をスローする', () => {
      // Arrange
      const component = 'component';
      const action = 'action';
      const data = { key: 'value' };
      jest
        .spyOn(EnhancedEventEmitter.prototype, 'emit')
        .mockImplementation(() => {
          throw new Error('テストエラー');
        });

      // Act & Assert
      expect(() => {
        eventEmitter.emitStandardized(component, action, data);
      }).toThrow('テストエラー');
    });
  });

  // emitAsync メソッドのテストブロックは削除

  describe('emitStandardizedAsync', () => {
    test('標準化された非同期イベントとグローバルイベントを発行する', async () => {
      // Arrange
      const component = 'component';
      const action = 'action';
      const data = { key: 'value' };
      const superEmitAsync = jest
        .spyOn(EnhancedEventEmitter.prototype, 'emitAsync')
        .mockResolvedValue(true);

      // Act
      await eventEmitter.emitStandardizedAsync(component, action, data);

      // Assert
      // 標準化されたイベントの発行検証
      expect(superEmitAsync).toHaveBeenCalledWith(
        `${component}:${action}`,
        expect.objectContaining({
          ...data,
          timestamp: MOCK_TIMESTAMP_ISO,
          component,
          action,
        })
      );

      // グローバルイベントの発行検証
      expect(superEmitAsync).toHaveBeenCalledWith(
        'event',
        expect.objectContaining({
          type: `${component}:${action}`,
          ...data,
          timestamp: MOCK_TIMESTAMP_ISO,
          component,
          action,
        })
      );
      expect(superEmitAsync).toHaveBeenCalledTimes(2);
    });

    test('dataパラメータのデフォルト値を使用してイベントを発行する', async () => {
      // Arrange
      const component = 'component';
      const action = 'action';
      const superEmitAsync = jest
        .spyOn(EnhancedEventEmitter.prototype, 'emitAsync')
        .mockResolvedValue(true);

      // Act
      await eventEmitter.emitStandardizedAsync(component, action); // dataパラメータを省略

      // Assert
      // 標準化されたイベントの発行検証 (空のデータ)
      expect(superEmitAsync).toHaveBeenCalledWith(
        `${component}:${action}`,
        expect.objectContaining({
          timestamp: MOCK_TIMESTAMP_ISO,
          component,
          action,
        })
      );
      // グローバルイベントの発行検証 (空のデータ)
      expect(superEmitAsync).toHaveBeenCalledWith(
        'event',
        expect.objectContaining({
          type: `${component}:${action}`,
          timestamp: MOCK_TIMESTAMP_ISO,
          component,
          action,
        })
      );
      expect(superEmitAsync).toHaveBeenCalledTimes(2);
    });

    test('エラーが発生した場合でも例外をスローする', async () => {
      // Arrange
      const component = 'component';
      const action = 'action';
      const data = { key: 'value' };
      jest
        .spyOn(EnhancedEventEmitter.prototype, 'emitAsync')
        .mockRejectedValue(new Error('テストエラー'));

      // Act & Assert
      await expect(
        eventEmitter.emitStandardizedAsync(component, action, data)
      ).rejects.toThrow('テストエラー');
    });
  });

  describe('getRegisteredEvents', () => {
    test('親クラスのgetRegisteredEventsメソッドを呼び出す', () => {
      // Arrange
      const superGetRegisteredEvents = jest
        .spyOn(EnhancedEventEmitter.prototype, 'getRegisteredEvents')
        .mockReturnValue(['event1']);

      // Act
      const result = eventEmitter.getRegisteredEvents();

      // Assert
      expect(superGetRegisteredEvents).toHaveBeenCalled();
      expect(result).toEqual(['event1']);
    });
  });

  describe('listenerCount', () => {
    test('親クラスのlistenerCountメソッドを呼び出す', () => {
      // Arrange
      const event = 'test-event';
      const superListenerCount = jest
        .spyOn(EnhancedEventEmitter.prototype, 'listenerCount')
        .mockReturnValue(5);

      // Act
      const result = eventEmitter.listenerCount(event);

      // Assert
      expect(superListenerCount).toHaveBeenCalledWith(event);
      expect(result).toBe(5);
    });
  });
});

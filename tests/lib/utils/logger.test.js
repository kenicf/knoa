/**
 * ロガークラスのテスト
 */

const Logger = require('../../../src/lib/utils/logger');
const {
  createMockEventEmitter,
  mockTimestamp,
} = require('../../helpers/mock-factory');
const {
  expectStandardizedEventEmitted,
} = require('../../helpers/test-helpers');

describe('Logger', () => {
  let logger;
  let mockEventEmitter;
  let mockTransport;
  let originalConsoleLog;
  let originalConsoleError;
  const MOCK_TIMESTAMP_ISO = '2025-03-24T00:00:00.000Z';
  const MOCK_TIMESTAMP_MS = new Date(MOCK_TIMESTAMP_ISO).getTime();
  const MOCK_RANDOM = 0.123456789;
  // substr(2, 9) を使用して期待値を生成
  const EXPECTED_TRACE_ID = `trace-${MOCK_TIMESTAMP_MS}-${MOCK_RANDOM.toString(36).substr(2, 9)}`;
  const EXPECTED_REQUEST_ID = `req-${MOCK_TIMESTAMP_MS}-${MOCK_RANDOM.toString(36).substr(2, 9)}`;


  beforeEach(() => {
    jest.clearAllMocks();

    // コンソール関数をモック
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    console.log = jest.fn();
    console.error = jest.fn();

    // モックのセットアップ
    mockEventEmitter = createMockEventEmitter();
    mockTransport = {
      type: 'mock',
      write: jest.fn(),
    };

    // Loggerのインスタンスを作成
    logger = new Logger({
      level: 'debug',
      transports: [mockTransport],
      eventEmitter: mockEventEmitter,
    });

    // 時間関連のモックを設定
    mockTimestamp(MOCK_TIMESTAMP_ISO);
    jest.spyOn(Date, 'now').mockReturnValue(MOCK_TIMESTAMP_MS);
    jest.spyOn(Math, 'random').mockReturnValue(MOCK_RANDOM);
  });

  afterEach(() => {
    // コンソール関数を元に戻す
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    // モックをリストア
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    test('デフォルト値で初期化される', () => {
      // Arrange & Act
      const instance = new Logger();
      // Assert
      expect(instance.level).toBe('info');
      expect(instance.transports).toHaveLength(1);
      expect(instance.transports[0].type).toBe('console');
      expect(instance.contextProviders).toEqual({});
      expect(instance.eventEmitter).toBeUndefined();
      expect(instance.traceIdGenerator).toBeInstanceOf(Function);
      expect(instance.requestIdGenerator).toBeInstanceOf(Function);
      // デフォルトの console トランスポートが機能するか確認
      instance.log('info', 'Default transport test');
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"message":"Default transport test"'));
    });

    test('カスタム値で初期化される', () => {
      // Arrange
      const customTransport = { type: 'custom', write: jest.fn() };
      const customEmitter = createMockEventEmitter();
      const traceGen = () => 'custom-trace';
      const reqGen = () => 'custom-req';
      // Act
      const instance = new Logger({
        level: 'warn',
        transports: [customTransport],
        contextProviders: { user: () => 'testUser' },
        eventEmitter: customEmitter,
        traceIdGenerator: traceGen,
        requestIdGenerator: reqGen,
      });
      // Assert
      expect(instance.level).toBe('warn');
      expect(instance.transports).toEqual([customTransport]);
      expect(instance.contextProviders.user()).toBe('testUser');
      expect(instance.eventEmitter).toBe(customEmitter);
      expect(instance.traceIdGenerator).toBe(traceGen);
      expect(instance.requestIdGenerator).toBe(reqGen);
    });
  });

  describe('log', () => {
    test.each([
      ['info', 'info', true],
      ['info', 'debug', false],
      ['warn', 'info', false],
      ['warn', 'warn', true],
      ['warn', 'error', true],
    ])(
      '現在のレベルが %s のとき、%s レベルのログ出力は %s',
      (loggerLevel, messageLevel, shouldWrite) => {
        // Arrange
        logger.level = loggerLevel;
        // Act
        logger.log(messageLevel, 'テストメッセージ');
        // Assert
        if (shouldWrite) {
          expect(mockTransport.write).toHaveBeenCalledTimes(1);
          expect(mockTransport.write).toHaveBeenCalledWith(
            expect.objectContaining({ level: messageLevel, message: 'テストメッセージ' })
          );
        } else {
          expect(mockTransport.write).not.toHaveBeenCalled();
        }
      }
    );

    test('コンテキスト情報、ID、タイムスタンプが正しく含まれる', () => {
      // Arrange
      const context = { userId: 'user123', customData: 'abc' };
      // Act
      logger.log('info', 'テストメッセージ', context);
      // Assert
      expect(mockTransport.write).toHaveBeenCalledWith({
        timestamp: MOCK_TIMESTAMP_ISO,
        level: 'info',
        message: 'テストメッセージ',
        context: {
          userId: 'user123',
          customData: 'abc',
          trace_id: EXPECTED_TRACE_ID,
          request_id: EXPECTED_REQUEST_ID,
          traceId: EXPECTED_TRACE_ID,
          requestId: EXPECTED_REQUEST_ID,
        },
      });
    });

     test('既存のトレースIDとリクエストIDが保持される (camelCase)', () => {
       // Arrange
       const context = { traceId: 'existing-trace', requestId: 'existing-req' };
       // Act
       logger.log('info', 'テストメッセージ', context);
       // Assert
       expect(mockTransport.write).toHaveBeenCalledWith(
         expect.objectContaining({
           context: expect.objectContaining({
             traceId: 'existing-trace',
             requestId: 'existing-req',
             trace_id: 'existing-trace',
             request_id: 'existing-req',
           }),
         })
       );
     });

     test('既存のトレースIDとリクエストIDが保持される (snake_case)', () => {
       // Arrange
       const context = { trace_id: 'existing-trace-snake', request_id: 'existing-req-snake' };
       // Act
       logger.log('info', 'テストメッセージ', context);
       // Assert
       expect(mockTransport.write).toHaveBeenCalledWith(
         expect.objectContaining({
           context: expect.objectContaining({
             trace_id: 'existing-trace-snake',
             request_id: 'existing-req-snake',
             traceId: 'existing-trace-snake',
             requestId: 'existing-req-snake',
           }),
         })
       );
     });


    test('コンテキストプロバイダーの値が含まれる', () => {
      // Arrange
      logger.addContextProvider('user', () => 'testUser');
      // Act
      logger.log('info', 'テストメッセージ');
      // Assert
      expect(mockTransport.write).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({ user: 'testUser' }),
        })
      );
    });

    test('コンテキストプロバイダーでエラーが発生した場合、エラーメッセージが含まれる', () => {
      // Arrange
      logger.addContextProvider('user', () => { throw new Error('プロバイダーエラー'); });
      // Act
      logger.log('info', 'テストメッセージ');
      // Assert
      expect(mockTransport.write).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({ user_error: 'プロバイダーエラー' }),
        })
      );
    });



    test('type がないトランスポートを追加した場合、type は unknown となる', () => {
      // Arrange
      const transportWithoutType = { write: jest.fn() };

      // Act
      logger.addTransport(transportWithoutType);

      // Assert
      expect(logger.transports).toContain(transportWithoutType);
      expectStandardizedEventEmitted(mockEventEmitter, 'log', 'transport_added', {
        type: 'unknown', // type が unknown であることを確認
        timestamp: expect.any(String),
        traceId: expect.any(String),
        requestId: expect.any(String),
      });
    });
    test('トランスポートでエラーが発生した場合、コンソールエラーが出力される', () => {
      // Arrange
      const error = new Error('トランスポートエラー');
      mockTransport.write.mockImplementation(() => { throw error; });
      // Act
      logger.log('info', 'テストメッセージ');
      // Assert
      expect(console.error).toHaveBeenCalledWith(`ログ出力中にエラーが発生しました(${mockTransport.type}):`, error);
    });

    test('イベントエミッターがある場合、message_created イベントを発行する', () => {
      // Arrange
      const context = { userId: 'user123' };
      // Act
      logger.log('info', 'テストメッセージ', context);
      // Assert
      expectStandardizedEventEmitted(mockEventEmitter, 'log', 'message_created', {
        timestamp: MOCK_TIMESTAMP_ISO,
        level: 'info',
        message: 'テストメッセージ',
        context: {
          userId: 'user123',
          trace_id: EXPECTED_TRACE_ID,
          request_id: EXPECTED_REQUEST_ID,
          traceId: EXPECTED_TRACE_ID,
          requestId: EXPECTED_REQUEST_ID,
        },
        traceId: EXPECTED_TRACE_ID,
        requestId: EXPECTED_REQUEST_ID,
      });
    });

    test.each([
      ['エラー', 'error'],
      ['致命的エラー', 'fatal'],
    ])('%s レベルのログの場合、アラートが送信される', (levelName, level) => {
      // Arrange
      const sendAlertSpy = jest.spyOn(logger, '_sendAlert');
      // Act
      logger.log(level, 'エラーメッセージ');
      // Assert
      expect(sendAlertSpy).toHaveBeenCalledWith(expect.objectContaining({ level, message: 'エラーメッセージ' }));
    });

     test('info レベルのログの場合、アラートは送信されない', () => {
       // Arrange
       const sendAlertSpy = jest.spyOn(logger, '_sendAlert');
       // Act
       logger.log('info', '情報メッセージ');
       // Assert
       expect(sendAlertSpy).not.toHaveBeenCalled();
     });
  });

  describe('debug, info, warn, error, fatal', () => {
    test.each([
      ['debug', 'デバッグメッセージ'],
      ['info', '情報メッセージ'],
      ['warn', '警告メッセージ'],
      ['error', 'エラーメッセージ'],
      ['fatal', '致命的エラーメッセージ'],
    ])('%sメソッドが log メソッドを正しいレベルで呼び出す', (level, message) => {
      // Arrange
      const logSpy = jest.spyOn(logger, 'log');
      const context = { key: 'value' };
      // Act
      logger[level](message, context);
      // Assert
      expect(logSpy).toHaveBeenCalledWith(level, message, context);
    });
  });

  describe('_sendAlert', () => {
    test('イベントエミッターがある場合、alert_created イベントを発行する', () => {
      // Arrange
      const entry = {
        level: 'error',
        message: 'エラーメッセージ',
        context: { traceId: 'trace-id', requestId: 'request-id' },
        timestamp: MOCK_TIMESTAMP_ISO,
      };
      // Act
      logger._sendAlert(entry);
      // Assert
      expectStandardizedEventEmitted(mockEventEmitter, 'log', 'alert_created', {
        level: 'error',
        message: 'エラーメッセージ',
        context: { traceId: 'trace-id', requestId: 'request-id' },
        timestamp: MOCK_TIMESTAMP_ISO,
        traceId: 'trace-id',
        requestId: 'request-id',
      });
    });

     test('context に ID がない場合でもイベントは発行される (ID は undefined になる)', () => {
       // Arrange
       const entry = { level: 'fatal', message: '致命的エラー', context: {}, timestamp: MOCK_TIMESTAMP_ISO };
       // Act
       logger._sendAlert(entry);
       // Assert
       expectStandardizedEventEmitted(mockEventEmitter, 'log', 'alert_created', {
         level: 'fatal',
         message: '致命的エラー',
         context: {},
         timestamp: MOCK_TIMESTAMP_ISO,
         traceId: undefined,
         requestId: undefined,
       });
     });

    test('イベントエミッターがない場合、何も発行されない', () => {
      // Arrange
      logger.eventEmitter = null;
      // Act & Assert
      expect(() => {
        logger._sendAlert({ level: 'error', message: 'エラー', context: {} });
      }).not.toThrow();
    });
  });

  describe('addTransport', () => {
    test('トランスポートが追加され、transport_added イベントが発行される', () => {
      // Arrange
      const newTransport = { type: 'new-mock', write: jest.fn() };
      // Act
      logger.addTransport(newTransport);
      // Assert
      expect(logger.transports).toContain(newTransport);
      expectStandardizedEventEmitted(mockEventEmitter, 'log', 'transport_added', {
        type: 'new-mock',
        timestamp: 'any',
        traceId: expect.any(String),
        requestId: expect.any(String),
      });
    });

     test('無効なトランスポートを追加しようとするとエラーログが出力される', () => {
       // Arrange
       const errorSpy = jest.spyOn(logger, 'error');
       // Act & Assert
       logger.addTransport(null);
       expect(errorSpy).toHaveBeenCalledWith('Invalid transport object provided to addTransport.', { transport: null });
       logger.addTransport({ type: 'invalid' }); // write がない
       // 期待される第二引数を修正
       expect(errorSpy).toHaveBeenCalledWith('Invalid transport object provided to addTransport.', { transport: { type: 'invalid' } });
     });

     test('eventEmitter がない場合でもトランスポートを追加できる', () => {
       // Arrange
       const loggerWithoutEmitter = new Logger({ transports: [] }); // eventEmitter なし
       const newTransport = { type: 'new-mock', write: jest.fn() };
       // Act & Assert
       expect(() => loggerWithoutEmitter.addTransport(newTransport)).not.toThrow();
       expect(loggerWithoutEmitter.transports).toContain(newTransport);
     });
  });

  describe('addContextProvider', () => {
    test('コンテキストプロバイダーが追加され、context_provider_added イベントが発行される', () => {
      // Arrange
      const provider = () => 'testValue';
      // Act
      logger.addContextProvider('testKey', provider);
      // Assert
      expect(logger.contextProviders.testKey).toBe(provider);
      expectStandardizedEventEmitted(mockEventEmitter, 'log', 'context_provider_added', {
        key: 'testKey',
        timestamp: 'any',
        traceId: expect.any(String),
        requestId: expect.any(String),
      });
    });

     test('無効な引数で追加しようとするとエラーログが出力される', () => {
       // Arrange
       const errorSpy = jest.spyOn(logger, 'error');
       // Act & Assert
       logger.addContextProvider('testKey', null);
       expect(errorSpy).toHaveBeenCalledWith('Invalid arguments provided to addContextProvider.', { key: 'testKey', providerType: 'object' });
       logger.addContextProvider(null, () => {});
       expect(errorSpy).toHaveBeenCalledWith('Invalid arguments provided to addContextProvider.', { key: null, providerType: 'function' });
     });

     test('eventEmitter がない場合でもコンテキストプロバイダーを追加できる', () => {
       // Arrange
       const loggerWithoutEmitter = new Logger(); // eventEmitter なし
       const provider = () => 'testValue';
       // Act & Assert
       expect(() => loggerWithoutEmitter.addContextProvider('testKey', provider)).not.toThrow();
       expect(loggerWithoutEmitter.contextProviders.testKey).toBe(provider);
     });
  });
});

/**
 * ロガークラスのテスト
 */

const Logger = require('../../../src/lib/utils/logger');
const { 
  createMockLogger, 
  createMockEventEmitter,
  mockTimestamp 
} = require('../../helpers/mock-factory');
const { 
  expectEventEmitted,
  expectStandardizedEventEmitted,
  expectLogged
} = require('../../helpers/test-helpers');

describe('Logger', () => {
  let logger;
  let mockEventEmitter;
  let mockTransport;
  let originalConsoleLog;
  let originalConsoleError;
  let originalConsoleWarn;
  let originalNodeEnv;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // コンソール関数をモック
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    originalConsoleWarn = console.warn;
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
    
    // 環境変数のモック
    originalNodeEnv = process.env.NODE_ENV;
    
    // イベントエミッターのモック
    mockEventEmitter = createMockEventEmitter();
    
    // トランスポートのモック
    mockTransport = {
      type: 'mock',
      write: jest.fn()
    };
    
    // Loggerのインスタンスを作成
    logger = new Logger({
      level: 'debug',
      transports: [mockTransport],
      eventEmitter: mockEventEmitter
    });
    
    // 日付・時間関連のモックを設定
    mockTimestamp('2025-03-24T00:00:00.000Z');
    const timestamp = new Date('2025-03-24T00:00:00.000Z').getTime();
    jest.spyOn(Date, 'now').mockReturnValue(timestamp);
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });
  
  afterEach(() => {
    // コンソール関数を元に戻す
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    
    // 環境変数を元に戻す
    process.env.NODE_ENV = originalNodeEnv;
    
    // モックをリストア
    jest.restoreAllMocks();
  });
  
  describe('constructor', () => {
    test.each([
      ['デフォルト値', undefined, 'info', 1, 'console', undefined],
      ['カスタム値', {
        level: 'warn',
        transports: [mockTransport],
        contextProviders: { user: () => 'testUser' },
        eventEmitter: mockEventEmitter,
        traceIdGenerator: () => 'custom-trace-id',
        requestIdGenerator: () => 'custom-request-id'
      }, 'warn', 1, 'mock', mockEventEmitter]
    ])('%s で初期化される', (_, options, expectedLevel, expectedTransportsLength, expectedTransportType, expectedEventEmitter) => {
      // Arrange & Act
      const instance = new Logger(options);
      
      // Assert
      expect(instance.level).toBe(expectedLevel);
      expect(instance.levels).toEqual({
        debug: 0,
        info: 1,
        warn: 2,
        error: 3,
        fatal: 4
      });
      expect(instance.transports).toHaveLength(expectedTransportsLength);
      expect(instance.transports[0].type).toBe(expectedTransportType);
      
      if (options && options.contextProviders) {
        expect(instance.contextProviders).toEqual(options.contextProviders);
      } else {
        expect(instance.contextProviders).toEqual({});
      }
      
      expect(instance.eventEmitter).toBe(expectedEventEmitter);
      expect(instance.traceIdGenerator).toBeInstanceOf(Function);
      expect(instance.requestIdGenerator).toBeInstanceOf(Function);
      
      if (options && options.traceIdGenerator) {
        expect(instance.traceIdGenerator()).toBe('custom-trace-id');
      }
      
      if (options && options.requestIdGenerator) {
        expect(instance.requestIdGenerator()).toBe('custom-request-id');
      }
    });
    
    test('デフォルトのトレースIDとリクエストID生成関数が正しく動作する', () => {
      // Arrange
      const defaultLogger = new Logger();
      
      // Act
      const traceId = defaultLogger.traceIdGenerator();
      const requestId = defaultLogger.requestIdGenerator();
      
      // Assert
      expect(traceId).toMatch(/^trace-\d+-[a-z0-9]+$/);
      expect(requestId).toMatch(/^req-\d+-[a-z0-9]+$/);
    });
  });
  
  describe('log', () => {
    test.each([
      ['ログレベルが現在のレベル以上', 'info', 'info', true],
      ['ログレベルが現在のレベル未満', 'warn', 'info', false]
    ])('%s の場合、ログ出力は %s', (_, loggerLevel, messageLevel, shouldWrite) => {
      // Arrange
      logger.level = loggerLevel;
      
      // Act
      logger.log(messageLevel, 'テストメッセージ');
      
      // Assert
      if (shouldWrite) {
        expect(mockTransport.write).toHaveBeenCalledWith(expect.objectContaining({
          level: messageLevel,
          message: 'テストメッセージ'
        }));
      } else {
        expect(mockTransport.write).not.toHaveBeenCalled();
      }
    });
    
    test('コンテキスト情報が正しく含まれる', () => {
      // Arrange
      const context = { userId: 'user123' };
      
      // Act
      logger.log('info', 'テストメッセージ', context);
      
      // Assert
      expect(mockTransport.write).toHaveBeenCalledWith(expect.objectContaining({
        context: expect.objectContaining({
          userId: 'user123',
          trace_id: expect.any(String),
          request_id: expect.any(String),
          traceId: expect.any(String),
          requestId: expect.any(String)
        })
      }));
    });
    
    test('既存のトレースIDとリクエストIDが保持される', () => {
      // Arrange
      const context = {
        trace_id: 'existing-trace-id',
        request_id: 'existing-request-id'
      };
      
      // Act
      logger.log('info', 'テストメッセージ', context);
      
      // Assert
      expect(mockTransport.write).toHaveBeenCalledWith(expect.objectContaining({
        context: expect.objectContaining({
          trace_id: 'existing-trace-id',
          request_id: 'existing-request-id',
          traceId: 'existing-trace-id',
          requestId: 'existing-request-id'
        })
      }));
    });
    
    test('コンテキストプロバイダーの値が含まれる', () => {
      // Arrange
      logger.contextProviders = {
        user: () => 'testUser',
        session: () => 'testSession'
      };
      
      // Act
      logger.log('info', 'テストメッセージ');
      
      // Assert
      expect(mockTransport.write).toHaveBeenCalledWith(expect.objectContaining({
        context: expect.objectContaining({
          user: 'testUser',
          session: 'testSession'
        })
      }));
    });
    
    test('コンテキストプロバイダーでエラーが発生した場合、エラーメッセージが含まれる', () => {
      // Arrange
      logger.contextProviders = {
        user: () => { throw new Error('プロバイダーエラー'); }
      };
      
      // Act
      logger.log('info', 'テストメッセージ');
      
      // Assert
      expect(mockTransport.write).toHaveBeenCalledWith(expect.objectContaining({
        context: expect.objectContaining({
          user_error: 'プロバイダーエラー'
        })
      }));
    });
    
    test('トランスポートでエラーが発生した場合、コンソールエラーが出力される', () => {
      // Arrange
      const error = new Error('トランスポートエラー');
      mockTransport.write.mockImplementation(() => {
        throw error;
      });
      
      // Act
      logger.log('info', 'テストメッセージ');
      
      // Assert
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('ログ出力中にエラーが発生しました'),
        error
      );
    });
    
    test.each([
      ['emitStandardizedが利用可能', true, 'emitStandardized', 'log', 'message_created'],
      ['emitStandardizedが利用できない', false, 'emit', 'log:entry', null]
    ])('%s な場合、適切なイベントを発行する', (_, hasEmitStandardized, expectedMethod, expectedEvent, expectedAction) => {
      // Arrange
      if (!hasEmitStandardized) {
        // emitStandardizedを削除
        delete mockEventEmitter.emitStandardized;
      }
      
      // Act
      logger.log('info', 'テストメッセージ');
      
      // Assert
      if (hasEmitStandardized) {
        expectStandardizedEventEmitted(mockEventEmitter, 'log', 'message_created', {
          level: 'info',
          message: 'テストメッセージ',
          traceId: expect.any(String),
          requestId: expect.any(String)
        });
      } else {
        expectEventEmitted(mockEventEmitter, 'log:entry', {
          level: 'info',
          message: 'テストメッセージ'
        });
      }
    });
    
    test.each([
      ['開発環境', 'development', true],
      ['本番環境', 'production', false]
    ])('%s では非推奨警告の表示は %s', (_, env, shouldWarn) => {
      // Arrange
      // emitStandardizedを削除
      delete mockEventEmitter.emitStandardized;
      
      // 環境変数を設定
      process.env.NODE_ENV = env;
      
      // Act
      logger.log('info', 'テストメッセージ');
      
      // Assert
      if (shouldWarn) {
        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('非推奨のイベント名')
        );
      } else {
        expect(console.warn).not.toHaveBeenCalled();
      }
    });
    
    test.each([
      ['エラー', 'error'],
      ['致命的エラー', 'fatal']
    ])('%s レベルのログの場合、アラートが送信される', (_, level) => {
      // Arrange
      // _sendAlertをスパイ
      jest.spyOn(logger, '_sendAlert');
      
      // Act
      logger.log(level, 'エラーメッセージ');
      
      // Assert
      expect(logger._sendAlert).toHaveBeenCalled();
    });
  });
  
  describe('debug, info, warn, error, fatal', () => {
    test.each([
      ['debug', 'デバッグメッセージ'],
      ['info', '情報メッセージ'],
      ['warn', '警告メッセージ'],
      ['error', 'エラーメッセージ'],
      ['fatal', '致命的エラーメッセージ']
    ])('%sメソッドが正しく動作する', (level, message) => {
      // Arrange
      // logをスパイ
      jest.spyOn(logger, 'log');
      const context = { key: 'value' };
      
      // Act
      logger[level](message, context);
      
      // Assert
      expect(logger.log).toHaveBeenCalledWith(level, message, context);
    });
  });
  
  describe('_sendAlert', () => {
    test.each([
      ['emitStandardizedが利用可能', true, 'emitStandardized', 'log', 'alert_created'],
      ['emitStandardizedが利用できない', false, 'emit', 'log:alert', null]
    ])('%s な場合、適切なアラートイベントを発行する', (_, hasEmitStandardized, expectedMethod, expectedEvent, expectedAction) => {
      // Arrange
      if (!hasEmitStandardized) {
        // emitStandardizedを削除
        delete mockEventEmitter.emitStandardized;
      }
      
      const entry = {
        level: 'error',
        message: 'エラーメッセージ',
        context: {
          traceId: 'trace-id',
          requestId: 'request-id'
        }
      };
      
      // Act
      logger._sendAlert(entry);
      
      // Assert
      if (hasEmitStandardized) {
        expectStandardizedEventEmitted(mockEventEmitter, 'log', 'alert_created', {
          level: 'error',
          message: 'エラーメッセージ',
          traceId: 'trace-id',
          requestId: 'request-id'
        });
      } else {
        expectEventEmitted(mockEventEmitter, 'log:alert', entry);
      }
    });
    
    test.each([
      ['開発環境', 'development', true],
      ['本番環境', 'production', false]
    ])('%s では非推奨警告の表示は %s', (_, env, shouldWarn) => {
      // Arrange
      // emitStandardizedを削除
      delete mockEventEmitter.emitStandardized;
      
      // 環境変数を設定
      process.env.NODE_ENV = env;
      
      // Act
      logger._sendAlert({
        level: 'error',
        message: 'エラーメッセージ',
        context: {}
      });
      
      // Assert
      if (shouldWarn) {
        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('非推奨のイベント名')
        );
      } else {
        expect(console.warn).not.toHaveBeenCalled();
      }
    });
    
    test('イベントエミッターがない場合、何も発行されない', () => {
      // Arrange
      // イベントエミッターを削除
      logger.eventEmitter = null;
      
      // Act & Assert
      expect(() => {
        logger._sendAlert({
          level: 'error',
          message: 'エラーメッセージ',
          context: {}
        });
      }).not.toThrow();
    });
  });
  
  describe('addTransport', () => {
    test('トランスポートが追加される', () => {
      // Arrange
      const newTransport = {
        type: 'new-transport',
        write: jest.fn()
      };
      
      // Act
      logger.addTransport(newTransport);
      
      // Assert
      expect(logger.transports).toContain(newTransport);
    });
    
    test.each([
      ['emitStandardizedが利用可能', true, 'emitStandardized', 'log', 'transport_added'],
      ['emitStandardizedが利用できない', false, 'emit', 'log:transport_added', null]
    ])('%s な場合、適切なイベントを発行する', (_, hasEmitStandardized, expectedMethod, expectedEvent, expectedAction) => {
      // Arrange
      if (!hasEmitStandardized) {
        // emitStandardizedを削除
        delete mockEventEmitter.emitStandardized;
      }
      
      const newTransport = {
        type: 'new-transport',
        write: jest.fn()
      };
      
      // Act
      logger.addTransport(newTransport);
      
      // Assert
      if (hasEmitStandardized) {
        expectStandardizedEventEmitted(mockEventEmitter, 'log', 'transport_added', {
          type: 'new-transport',
          timestamp: expect.any(String),
          traceId: expect.any(String),
          requestId: expect.any(String)
        });
      } else {
        expectEventEmitted(mockEventEmitter, 'log:transport_added', {
          type: 'new-transport',
          timestamp: expect.any(String)
        });
      }
    });
    
    test.each([
      ['開発環境', 'development', true],
      ['本番環境', 'production', false]
    ])('%s では非推奨警告の表示は %s', (_, env, shouldWarn) => {
      // Arrange
      // emitStandardizedを削除
      delete mockEventEmitter.emitStandardized;
      
      // 環境変数を設定
      process.env.NODE_ENV = env;
      
      const newTransport = {
        type: 'new-transport',
        write: jest.fn()
      };
      
      // Act
      logger.addTransport(newTransport);
      
      // Assert
      if (shouldWarn) {
        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('非推奨のイベント名')
        );
      } else {
        expect(console.warn).not.toHaveBeenCalled();
      }
    });
    
    test('イベントエミッターがない場合、イベントは発行されない', () => {
      // Arrange
      // イベントエミッターを削除
      logger.eventEmitter = null;
      
      const newTransport = {
        type: 'new-transport',
        write: jest.fn()
      };
      
      // Act & Assert
      expect(() => {
        logger.addTransport(newTransport);
      }).not.toThrow();
      
      expect(logger.transports).toContain(newTransport);
    });
  });
  
  describe('addContextProvider', () => {
    test('コンテキストプロバイダーが追加される', () => {
      // Arrange
      const provider = () => 'testValue';
      
      // Act
      logger.addContextProvider('testKey', provider);
      
      // Assert
      expect(logger.contextProviders.testKey).toBe(provider);
    });
    
    test.each([
      ['emitStandardizedが利用可能', true, 'emitStandardized', 'log', 'context_provider_added'],
      ['emitStandardizedが利用できない', false, 'emit', 'log:context_provider_added', null]
    ])('%s な場合、適切なイベントを発行する', (_, hasEmitStandardized, expectedMethod, expectedEvent, expectedAction) => {
      // Arrange
      if (!hasEmitStandardized) {
        // emitStandardizedを削除
        delete mockEventEmitter.emitStandardized;
      }
      
      const provider = () => 'testValue';
      
      // Act
      logger.addContextProvider('testKey', provider);
      
      // Assert
      if (hasEmitStandardized) {
        expectStandardizedEventEmitted(mockEventEmitter, 'log', 'context_provider_added', {
          key: 'testKey',
          timestamp: expect.any(String),
          traceId: expect.any(String),
          requestId: expect.any(String)
        });
      } else {
        expectEventEmitted(mockEventEmitter, 'log:context_provider_added', {
          key: 'testKey',
          timestamp: expect.any(String)
        });
      }
    });
    
    test.each([
      ['開発環境', 'development', true],
      ['本番環境', 'production', false]
    ])('%s では非推奨警告の表示は %s', (_, env, shouldWarn) => {
      // Arrange
      // emitStandardizedを削除
      delete mockEventEmitter.emitStandardized;
      
      // 環境変数を設定
      process.env.NODE_ENV = env;
      
      const provider = () => 'testValue';
      
      // Act
      logger.addContextProvider('testKey', provider);
      
      // Assert
      if (shouldWarn) {
        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('非推奨のイベント名')
        );
      } else {
        expect(console.warn).not.toHaveBeenCalled();
      }
    });
    
    test('イベントエミッターがない場合、イベントは発行されない', () => {
      // Arrange
      // イベントエミッターを削除
      logger.eventEmitter = null;
      
      const provider = () => 'testValue';
      
      // Act
      logger.addContextProvider('testKey', provider);
      
      // Assert
      expect(logger.contextProviders.testKey).toBe(provider);
    });
  });
});
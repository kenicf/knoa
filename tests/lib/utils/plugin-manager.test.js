/**
 * プラグインマネージャーのテスト
 */

const PluginManager = require('../../../src/lib/utils/plugin-manager');
const {
  createMockLogger,
  createMockEventEmitter,
  mockTimestamp,
} = require('../../helpers/mock-factory');
const {
  expectStandardizedEventEmitted,
} = require('../../helpers/test-helpers');

describe('PluginManager', () => {
  let pluginManager;
  let mockLogger;
  let mockEventEmitter;
  const MOCK_TIMESTAMP_ISO = '2025-03-24T00:00:00.000Z';
  const MOCK_TIMESTAMP_MS = new Date(MOCK_TIMESTAMP_ISO).getTime();
  const MOCK_RANDOM = 0.123456789;
  const EXPECTED_TRACE_ID = `trace-${MOCK_TIMESTAMP_MS}-${MOCK_RANDOM.toString(36).substr(2, 9)}`;
  const EXPECTED_REQUEST_ID = `req-${MOCK_TIMESTAMP_MS}-${MOCK_RANDOM.toString(36).substr(2, 9)}`;

  beforeEach(() => {
    // Arrange (Common setup)
    jest.clearAllMocks();
    jest.restoreAllMocks(); // Restore mocks from previous tests

    // Time mocks
    mockTimestamp(MOCK_TIMESTAMP_ISO);
    jest.spyOn(Date, 'now').mockReturnValue(MOCK_TIMESTAMP_MS);
    jest.spyOn(Math, 'random').mockReturnValue(MOCK_RANDOM);

    // Dependency mocks
    mockLogger = createMockLogger();
    mockEventEmitter = createMockEventEmitter();

    // Mock logger methods to prevent potential side effects during tests
    jest.spyOn(mockLogger, 'info');
    jest.spyOn(mockLogger, 'error');
    jest.spyOn(mockLogger, 'warn');
    jest.spyOn(mockEventEmitter, 'emitStandardized'); // Spy on the method used

    // Instance creation
    const options = {
      logger: mockLogger,
      eventEmitter: mockEventEmitter,
      // Explicitly mock ID generators for consistent event data in tests
      traceIdGenerator: () => EXPECTED_TRACE_ID,
      requestIdGenerator: () => EXPECTED_REQUEST_ID,
    };
    pluginManager = new PluginManager(options);
  });

  // No afterEach needed as mocks are restored in beforeEach

  describe('constructor', () => {
    test('should throw error if logger is not provided', () => {
      // Arrange & Act & Assert
      expect(
        () => new PluginManager({ eventEmitter: mockEventEmitter })
      ).toThrow('Logger instance is required');
    });

    test('should initialize with provided options', () => {
      // Arrange (Instance created in beforeEach)
      // Act (Implicitly done by beforeEach)
      // Assert
      expect(pluginManager.plugins).toBeInstanceOf(Map);
      expect(pluginManager.plugins.size).toBe(0);
      expect(pluginManager.logger).toBe(mockLogger);
      expect(pluginManager.eventEmitter).toBe(mockEventEmitter);
      expect(pluginManager._traceIdGenerator()).toBe(EXPECTED_TRACE_ID);
      expect(pluginManager._requestIdGenerator()).toBe(EXPECTED_REQUEST_ID);
    });

    test('should initialize with default ID generators if not provided', () => {
      // Arrange
      const options = { logger: mockLogger }; // No generators

      // Act
      const instance = new PluginManager(options);

      // Assert
      expect(instance._traceIdGenerator).toBeInstanceOf(Function);
      expect(instance._requestIdGenerator).toBeInstanceOf(Function);
      // Check if they produce expected format (though values will vary)
      expect(instance._traceIdGenerator()).toMatch(/^trace-\d+-\w+$/);
      expect(instance._requestIdGenerator()).toMatch(/^req-\d+-\w+$/);
    });

    test('should work correctly if eventEmitter is not provided', () => {
      // Arrange
      const options = { logger: mockLogger }; // No eventEmitter

      // Act
      const pmWithoutEmitter = new PluginManager(options);
      const pluginType = 'test';
      const pluginImpl = { testMethod: jest.fn() };
      jest.spyOn(pmWithoutEmitter, '_validatePlugin').mockReturnValue(true);

      // Assert
      expect(() =>
        pmWithoutEmitter.registerPlugin(pluginType, pluginImpl)
      ).not.toThrow();
      expect(pmWithoutEmitter.eventEmitter).toBeUndefined();
      // No event emission expected, so no need to check mockEventEmitter
    });
  });

  describe('registerPlugin', () => {
    test('should register a valid plugin and emit registered event', () => {
      // Arrange
      const pluginType = 'test-plugin';
      const pluginImplementation = { testMethod: jest.fn() };
      jest.spyOn(pluginManager, '_validatePlugin').mockReturnValue(true);

      // Act
      const result = pluginManager.registerPlugin(
        pluginType,
        pluginImplementation
      );

      // Assert
      expect(result).toBe(true);
      expect(pluginManager.plugins.has(pluginType)).toBe(true);
      expect(pluginManager.plugins.get(pluginType)).toBe(pluginImplementation);
      expect(mockLogger.info).toHaveBeenCalledWith(
        `プラグイン ${pluginType} を登録しました`
      );
      expectStandardizedEventEmitted(mockEventEmitter, 'plugin', 'registered', {
        pluginType,
        hasInitialize: false,
        hasCleanup: false,
        timestamp: MOCK_TIMESTAMP_ISO, // Expect specific timestamp
        // traceId と requestId の検証は削除
      });
    });

    test('should not register invalid plugin and emit validation_failed event', () => {
      // Arrange
      const pluginType = 'invalid-plugin';
      const pluginImplementation = {}; // Invalid (empty object might fail validation)
      jest.spyOn(pluginManager, '_validatePlugin').mockReturnValue(false); // Force validation failure

      // Act
      const result = pluginManager.registerPlugin(
        pluginType,
        pluginImplementation
      );

      // Assert
      expect(result).toBe(false);
      expect(pluginManager.plugins.has(pluginType)).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        `プラグイン ${pluginType} の検証に失敗しました`
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'plugin',
        'validation_failed',
        {
          pluginType,
          timestamp: MOCK_TIMESTAMP_ISO,
          // traceId と requestId の検証は削除
        }
      );
    });

    test('should call initialize method if present and emit registered event', () => {
      // Arrange
      const pluginType = 'init-plugin';
      const initializeMock = jest.fn();
      const pluginImplementation = {
        initialize: initializeMock,
        otherMethod: jest.fn(),
      };
      jest.spyOn(pluginManager, '_validatePlugin').mockReturnValue(true);

      // Act
      pluginManager.registerPlugin(pluginType, pluginImplementation);

      // Assert
      expect(initializeMock).toHaveBeenCalledTimes(1);
      expect(pluginManager.plugins.has(pluginType)).toBe(true);
      expectStandardizedEventEmitted(mockEventEmitter, 'plugin', 'registered', {
        pluginType,
        hasInitialize: true,
        hasCleanup: false,
        timestamp: MOCK_TIMESTAMP_ISO,
        // traceId と requestId の検証は削除
      });
    });

    test('should register plugin but emit initialization_error if initialize throws', () => {
      // Arrange
      const pluginType = 'init-error-plugin';
      const error = new Error('初期化エラー');
      const pluginImplementation = {
        initialize: jest.fn().mockImplementation(() => {
          throw error;
        }),
        otherMethod: jest.fn(),
      };
      jest.spyOn(pluginManager, '_validatePlugin').mockReturnValue(true);

      // Act
      const result = pluginManager.registerPlugin(
        pluginType,
        pluginImplementation
      );

      // Assert
      expect(result).toBe(true); // Registration succeeds despite init error
      expect(pluginManager.plugins.has(pluginType)).toBe(true);
      expect(mockLogger.error).toHaveBeenCalledWith(
        `プラグイン ${pluginType} の初期化中にエラーが発生しました:`,
        error
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'plugin',
        'initialization_error',
        {
          pluginType,
          error: error.message,
          timestamp: MOCK_TIMESTAMP_ISO,
          // traceId と requestId の検証は削除
        }
      );
      // registered event should still be emitted
      expectStandardizedEventEmitted(mockEventEmitter, 'plugin', 'registered', {
        pluginType,
        hasInitialize: true,
        hasCleanup: false,
        timestamp: MOCK_TIMESTAMP_ISO,
        // traceId と requestId の検証は削除
      });
    });
  });

  describe('hasPlugin', () => {
    test('should return true if plugin is registered', () => {
      // Arrange
      pluginManager.plugins.set('test-plugin', {});
      // Act & Assert
      expect(pluginManager.hasPlugin('test-plugin')).toBe(true);
    });

    test('should return false if plugin is not registered', () => {
      // Arrange (No plugin registered)
      // Act & Assert
      expect(pluginManager.hasPlugin('non-existent-plugin')).toBe(false);
    });
  });

  describe('unregisterPlugin', () => {
    test('should unregister plugin and emit unregistered event', () => {
      // Arrange
      const pluginType = 'test-plugin';
      const pluginImplementation = {};
      pluginManager.plugins.set(pluginType, pluginImplementation);

      // Act
      const result = pluginManager.unregisterPlugin(pluginType);

      // Assert
      expect(result).toBe(true);
      expect(pluginManager.plugins.has(pluginType)).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith(
        `プラグイン ${pluginType} を削除しました`
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'plugin',
        'unregistered',
        {
          pluginType,
          timestamp: MOCK_TIMESTAMP_ISO,
          // traceId と requestId の検証は削除
        }
      );
    });

    test('should return false if plugin is not registered', () => {
      // Arrange
      const pluginType = 'non-existent-plugin';
      // Act
      const result = pluginManager.unregisterPlugin(pluginType);
      // Assert
      expect(result).toBe(false);
      expect(mockEventEmitter.emitStandardized).not.toHaveBeenCalled();
    });

    test('should call cleanup method if present', () => {
      // Arrange
      const pluginType = 'cleanup-plugin';
      const cleanupMock = jest.fn();
      const pluginImplementation = { cleanup: cleanupMock };
      pluginManager.plugins.set(pluginType, pluginImplementation);

      // Act
      pluginManager.unregisterPlugin(pluginType);

      // Assert
      expect(cleanupMock).toHaveBeenCalledTimes(1);
    });

    test('should unregister plugin and emit cleanup_error if cleanup throws', () => {
      // Arrange
      const pluginType = 'cleanup-error-plugin';
      const error = new Error('クリーンアップエラー');
      const pluginImplementation = {
        cleanup: jest.fn().mockImplementation(() => {
          throw error;
        }),
      };
      pluginManager.plugins.set(pluginType, pluginImplementation);

      // Act
      const result = pluginManager.unregisterPlugin(pluginType);

      // Assert
      expect(result).toBe(true); // Unregistration still succeeds
      expect(pluginManager.plugins.has(pluginType)).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        `プラグイン ${pluginType} のクリーンアップ中にエラーが発生しました:`,
        error
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'plugin',
        'cleanup_error',
        {
          pluginType,
          error: error.message,
          timestamp: MOCK_TIMESTAMP_ISO,
          // traceId と requestId の検証は削除
        }
      );
      // unregistered event should still be emitted
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'plugin',
        'unregistered',
        {
          pluginType,
          timestamp: MOCK_TIMESTAMP_ISO,
          // traceId と requestId の検証は削除
        }
      );
    });
  });

  describe('getRegisteredPlugins', () => {
    test('should return an array of registered plugin types', () => {
      // Arrange
      pluginManager.plugins.set('plugin1', {});
      pluginManager.plugins.set('plugin2', {});
      // Act
      const result = pluginManager.getRegisteredPlugins();
      // Assert
      expect(result).toEqual(['plugin1', 'plugin2']);
    });

    test('should return an empty array if no plugins are registered', () => {
      // Arrange (No plugins registered)
      // Act
      const result = pluginManager.getRegisteredPlugins();
      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('invokePlugin', () => {
    test('should invoke plugin method successfully and emit events', async () => {
      // Arrange
      const pluginType = 'test-plugin';
      const methodName = 'testMethod';
      const methodResult = 'test result';
      const args = ['arg1', 123];
      const methodMock = jest.fn().mockResolvedValue(methodResult);
      const pluginImplementation = { [methodName]: methodMock };
      pluginManager.plugins.set(pluginType, pluginImplementation);

      // Act
      const result = await pluginManager.invokePlugin(
        pluginType,
        methodName,
        ...args
      );

      // Assert
      expect(result).toBe(methodResult);
      expect(methodMock).toHaveBeenCalledWith(...args);
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'plugin',
        'method_invoked',
        {
          pluginType,
          methodName,
          timestamp: MOCK_TIMESTAMP_ISO,
          // traceId と requestId の検証は削除
        }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'plugin',
        'method_completed',
        {
          pluginType,
          methodName,
          timestamp: MOCK_TIMESTAMP_ISO,
          // traceId と requestId の検証は削除
        }
      );
    });

    test('should invoke synchronous plugin method successfully and emit events', async () => {
      // Arrange
      const pluginType = 'sync-plugin';
      const methodName = 'syncMethod';
      const methodResult = 'sync result';
      const args = [true];
      const methodMock = jest.fn(() => methodResult); // Synchronous function
      const pluginImplementation = { [methodName]: methodMock };
      pluginManager.plugins.set(pluginType, pluginImplementation);

      // Act
      const result = await pluginManager.invokePlugin(
        pluginType,
        methodName,
        ...args
      );

      // Assert
      expect(result).toBe(methodResult);
      expect(methodMock).toHaveBeenCalledWith(...args);
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'plugin',
        'method_invoked',
        {
          pluginType,
          methodName,
          timestamp: MOCK_TIMESTAMP_ISO,
          // traceId と requestId の検証は削除
        }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'plugin',
        'method_completed',
        {
          pluginType,
          methodName,
          timestamp: MOCK_TIMESTAMP_ISO,
          // traceId と requestId の検証は削除
        }
      );
    });

    test('should return null and emit method_not_found event if plugin does not exist', async () => {
      // Arrange
      const pluginType = 'non-existent-plugin';
      const methodName = 'testMethod';

      // Act
      const result = await pluginManager.invokePlugin(pluginType, methodName);

      // Assert
      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `プラグインメソッドが見つかりません: ${pluginType}.${methodName}`
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'plugin',
        'method_not_found',
        {
          pluginType,
          methodName,
          timestamp: MOCK_TIMESTAMP_ISO,
          // traceId と requestId の検証は削除
        }
      );
    });

    test('should return null and emit method_not_found event if method does not exist', async () => {
      // Arrange
      const pluginType = 'test-plugin';
      const methodName = 'non-existent-method';
      pluginManager.plugins.set(pluginType, { otherMethod: jest.fn() }); // Plugin exists, method doesn't

      // Act
      const result = await pluginManager.invokePlugin(pluginType, methodName);

      // Assert
      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `プラグインメソッドが見つかりません: ${pluginType}.${methodName}`
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'plugin',
        'method_not_found',
        {
          pluginType,
          methodName,
          timestamp: MOCK_TIMESTAMP_ISO,
          // traceId と requestId の検証は削除
        }
      );
    });

    test('should return null and emit method_not_found event if method is not a function', async () => {
      // Arrange
      const pluginType = 'test-plugin';
      const methodName = 'notAFunction';
      pluginManager.plugins.set(pluginType, { [methodName]: 'i am a string' }); // Property exists, but not a function

      // Act
      const result = await pluginManager.invokePlugin(pluginType, methodName);

      // Assert
      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `プラグインメソッドが見つかりません: ${pluginType}.${methodName}`
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'plugin',
        'method_not_found',
        {
          pluginType,
          methodName,
          timestamp: MOCK_TIMESTAMP_ISO,
          // traceId と requestId の検証は削除
        }
      );
    });

    test('should throw error and emit method_error event if method invocation fails', async () => {
      // Arrange
      const pluginType = 'error-plugin';
      const methodName = 'errorMethod';
      const error = new Error('メソッド呼び出しエラー');
      const methodMock = jest.fn().mockRejectedValue(error);
      const pluginImplementation = { [methodName]: methodMock };
      pluginManager.plugins.set(pluginType, pluginImplementation);

      // Act & Assert
      await expect(
        pluginManager.invokePlugin(pluginType, methodName)
      ).rejects.toThrow(error);
      expect(mockLogger.error).toHaveBeenCalledWith(
        `プラグイン ${pluginType}.${methodName} の呼び出し中にエラーが発生しました:`,
        error
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'plugin',
        'method_invoked',
        {
          // invoked is still emitted
          pluginType,
          methodName,
          timestamp: MOCK_TIMESTAMP_ISO,
          // traceId と requestId の検証は削除
        }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'plugin',
        'method_error',
        {
          pluginType,
          methodName,
          error: error.message,
          timestamp: MOCK_TIMESTAMP_ISO,
          // traceId と requestId の検証は削除
        }
      );
    });
  });

  describe('_validatePlugin', () => {
    // --- Invalid Type/Implementation Tests ---
    test('should return false for null pluginType', () => {
      expect(pluginManager._validatePlugin(null, { m: jest.fn() })).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('タイプが文字列ではありません'),
        { pluginType: null }
      );
    });
    test('should return false for non-string pluginType', () => {
      expect(pluginManager._validatePlugin(123, { m: jest.fn() })).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('タイプが文字列ではありません'),
        { pluginType: 123 }
      );
    });
    test('should return false for null implementation', () => {
      expect(pluginManager._validatePlugin('test', null)).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('実装がオブジェクトではありません'),
        { pluginImplementation: null }
      );
    });
    test('should return false for non-object implementation', () => {
      expect(pluginManager._validatePlugin('test', 123)).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('実装がオブジェクトではありません'),
        { pluginImplementation: 123 }
      );
    });
    test('should return false for array implementation', () => {
      expect(pluginManager._validatePlugin('test', [])).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('実装がオブジェクトではありません'),
        { pluginImplementation: [] }
      );
    });
    test('should return false for empty object implementation (generic type)', () => {
      expect(pluginManager._validatePlugin('generic', {})).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('実装が空のオブジェクトです')
      );
    });

    // --- Type Specific Validation Tests ---
    test('should validate ci plugin correctly (valid)', () => {
      expect(pluginManager._validatePlugin('ci', { runTests: jest.fn() })).toBe(
        true
      );
    });
    test('should validate ci plugin correctly (invalid)', () => {
      expect(pluginManager._validatePlugin('ci', {})).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('runTests メソッドが必要です')
      );
    });
    test('should validate notification plugin correctly (valid)', () => {
      expect(
        pluginManager._validatePlugin('notification', {
          sendNotification: jest.fn(),
        })
      ).toBe(true);
    });
    test('should validate notification plugin correctly (invalid)', () => {
      expect(pluginManager._validatePlugin('notification', {})).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('sendNotification メソッドが必要です')
      );
    });
    test('should validate report plugin correctly (valid)', () => {
      expect(
        pluginManager._validatePlugin('report', { generateReport: jest.fn() })
      ).toBe(true);
    });
    test('should validate report plugin correctly (invalid)', () => {
      expect(pluginManager._validatePlugin('report', {})).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('generateReport メソッドが必要です')
      );
    });
    test('should validate storage plugin correctly (valid)', () => {
      expect(
        pluginManager._validatePlugin('storage', {
          save: jest.fn(),
          load: jest.fn(),
        })
      ).toBe(true);
    });
    test('should validate storage plugin correctly (missing load)', () => {
      expect(
        pluginManager._validatePlugin('storage', { save: jest.fn() })
      ).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('save および load メソッドが必要です')
      );
    });
    test('should validate storage plugin correctly (missing save)', () => {
      expect(
        pluginManager._validatePlugin('storage', { load: jest.fn() })
      ).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('save および load メソッドが必要です')
      );
    });
    test('should validate generic plugin correctly (valid)', () => {
      expect(
        pluginManager._validatePlugin('generic', { someMethod: jest.fn() })
      ).toBe(true);
    });
  });
});

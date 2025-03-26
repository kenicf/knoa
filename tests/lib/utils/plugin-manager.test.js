/**
 * プラグインマネージャーのテスト
 */

const PluginManager = require('../../../src/lib/utils/plugin-manager');
const { 
  createMockLogger, 
  createMockEventEmitter, 
  createMockErrorHandler, 
  mockTimestamp 
} = require('../../helpers/mock-factory');

/**
 * PluginManagerのテスト用オプションを作成
 * @param {Object} overrides - 上書きするオプション
 * @returns {Object} テスト用オプション
 */
function createPluginManagerTestOptions(overrides = {}) {
  return {
    logger: createMockLogger(),
    eventEmitter: createMockEventEmitter(),
    ...overrides
  };
}

describe('PluginManager', () => {
  let pluginManager;
  let mockLogger;
  let mockEventEmitter;

  beforeEach(() => {
    // モックのリセット
    jest.clearAllMocks();
    jest.restoreAllMocks();
    
    // 時間のモック
    mockTimestamp('2025-03-24T00:00:00.000Z');
    
    // 共通モックファクトリを使用
    mockLogger = createMockLogger();
    mockEventEmitter = createMockEventEmitter();
    
    // モックの設定
    jest.spyOn(mockLogger, 'info');
    jest.spyOn(mockLogger, 'error');
    jest.spyOn(mockEventEmitter, 'emit');
    
    // PluginManagerのインスタンス作成
    const options = {
      logger: mockLogger,
      eventEmitter: mockEventEmitter
    };
    pluginManager = new PluginManager(options);
  });

  describe('constructor', () => {
    test('デフォルト値で初期化される', () => {
      // Arrange
      const defaultPluginManager = new PluginManager();
      
      // Assert
      expect(defaultPluginManager.plugins).toBeInstanceOf(Map);
      expect(defaultPluginManager.plugins.size).toBe(0);
      expect(defaultPluginManager.logger).toBe(console);
      expect(defaultPluginManager.eventEmitter).toBeUndefined();
    });

    test('指定されたオプションで初期化される', () => {
      // Assert
      expect(pluginManager.plugins).toBeInstanceOf(Map);
      expect(pluginManager.plugins.size).toBe(0);
      // オブジェクトの参照ではなく、同じプロパティを持つかどうかを確認
      expect(pluginManager.logger).toBeTruthy();
      expect(pluginManager.logger.info).toBeTruthy();
      expect(pluginManager.logger.error).toBeTruthy();
      expect(pluginManager.eventEmitter).toBe(mockEventEmitter);
    });

    test('イベントエミッターが未指定でもエラーなく動作する', () => {
      // Arrange
      const options = { logger: mockLogger };
      const pm = new PluginManager(options);
      
      // Assert
      expect(pm.eventEmitter).toBeUndefined();
      expect(() => pm.registerPlugin('test', { testMethod: jest.fn() })).not.toThrow();
    });

    test('イベントエミッターが未指定でも各メソッドが正しく動作する', async () => {
      // Arrange
      const options = { logger: mockLogger };
      const pm = new PluginManager(options);
      const pluginType = 'test-plugin';
      const methodName = 'testMethod';
      const methodMock = jest.fn().mockReturnValue('result');
      const pluginImplementation = {
        [methodName]: methodMock,
        initialize: jest.fn(),
        cleanup: jest.fn()
      };
      
      // Act & Assert - registerPlugin
      jest.spyOn(pm, '_validatePlugin').mockReturnValue(true);
      expect(pm.registerPlugin(pluginType, pluginImplementation)).toBe(true);
      expect(pluginImplementation.initialize).toHaveBeenCalled();
      
      // Act & Assert - invokePlugin
      const result = await pm.invokePlugin(pluginType, methodName);
      expect(result).toBe('result');
      expect(methodMock).toHaveBeenCalled();
      
      // Act & Assert - unregisterPlugin
      expect(pm.unregisterPlugin(pluginType)).toBe(true);
      expect(pluginImplementation.cleanup).toHaveBeenCalled();
      expect(pm.plugins.has(pluginType)).toBe(false);
      
      // Act & Assert - error cases
      const error = new Error('テストエラー');
      const errorPlugin = {
        initialize: jest.fn().mockImplementation(() => { throw error; }),
        cleanup: jest.fn().mockImplementation(() => { throw error; }),
        errorMethod: jest.fn().mockImplementation(() => { throw error; })
      };
      
      // registerPlugin with error in initialize
      pm.registerPlugin('error-plugin', errorPlugin);
      expect(pm.plugins.has('error-plugin')).toBe(true);
      
      // unregisterPlugin with error in cleanup
      expect(pm.unregisterPlugin('error-plugin')).toBe(true);
      expect(pm.plugins.has('error-plugin')).toBe(false);
      
      // invokePlugin with error
      pm.plugins.set('error-plugin', errorPlugin);
      await expect(pm.invokePlugin('error-plugin', 'errorMethod')).rejects.toThrow(error);
      
      // 無効なプラグインの登録
      jest.spyOn(pm, '_validatePlugin').mockReturnValue(false);
      expect(pm.registerPlugin('invalid-plugin', {})).toBe(false);
      
      // 存在しないプラグインのメソッド呼び出し
      expect(await pm.invokePlugin('non-existent', 'method')).toBeNull();
      
      // 存在しないメソッドの呼び出し
      pm.plugins.set('test-plugin', {});
      expect(await pm.invokePlugin('test-plugin', 'non-existent-method')).toBeNull();
    });
  });

  describe('registerPlugin', () => {
    test('有効なプラグインを登録する', () => {
      // Arrange
      const pluginType = 'test-plugin';
      const pluginImplementation = {
        testMethod: jest.fn()
      };
      
      // プラグイン検証をモック
      jest.spyOn(pluginManager, '_validatePlugin').mockReturnValue(true);
      
      // Act
      const result = pluginManager.registerPlugin(pluginType, pluginImplementation);
      
      // Assert
      expect(result).toBe(true);
      expect(pluginManager.plugins.has(pluginType)).toBe(true);
      expect(pluginManager.plugins.get(pluginType)).toBe(pluginImplementation);
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('登録しました'));
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('plugin:registered', expect.objectContaining({
        pluginType,
        hasInitialize: false,
        hasCleanup: false,
        timestamp: '2025-03-24T00:00:00.000Z'
      }));
    });

    test('無効なプラグインは登録されない', () => {
      // Arrange
      const pluginType = 'test-plugin';
      const pluginImplementation = {};
      
      // プラグイン検証をモック
      jest.spyOn(pluginManager, '_validatePlugin').mockReturnValue(false);
      
      // Act
      const result = pluginManager.registerPlugin(pluginType, pluginImplementation);
      
      // Assert
      expect(result).toBe(false);
      expect(pluginManager.plugins.has(pluginType)).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(`プラグイン ${pluginType} の検証に失敗しました`);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('plugin:validation_failed', expect.objectContaining({
        pluginType,
        timestamp: '2025-03-24T00:00:00.000Z'
      }));
    });

    test('initialize メソッドがあれば呼び出される', () => {
      // Arrange
      const pluginType = 'test-plugin';
      const initializeMock = jest.fn();
      const pluginImplementation = {
        initialize: initializeMock
      };
      
      // プラグイン検証をモック
      jest.spyOn(pluginManager, '_validatePlugin').mockReturnValue(true);
      
      // Act
      pluginManager.registerPlugin(pluginType, pluginImplementation);
      
      // Assert
      expect(initializeMock).toHaveBeenCalled();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('plugin:registered', expect.objectContaining({
        pluginType,
        hasInitialize: true,
        hasCleanup: false,
        timestamp: '2025-03-24T00:00:00.000Z'
      }));
    });

    test('initialize メソッドでエラーが発生しても登録は成功する', () => {
      // Arrange
      const pluginType = 'test-plugin';
      const error = new Error('初期化エラー');
      const pluginImplementation = {
        initialize: jest.fn().mockImplementation(() => {
          throw error;
        })
      };
      
      // プラグイン検証をモック
      jest.spyOn(pluginManager, '_validatePlugin').mockReturnValue(true);
      
      // Act
      const result = pluginManager.registerPlugin(pluginType, pluginImplementation);
      
      // Assert
      expect(result).toBe(true);
      expect(pluginManager.plugins.has(pluginType)).toBe(true);
      expect(mockLogger.error).toHaveBeenCalledWith(`プラグイン ${pluginType} の初期化中にエラーが発生しました:`, error);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('plugin:initialization_error', expect.objectContaining({
        pluginType,
        error: error.message,
        timestamp: '2025-03-24T00:00:00.000Z'
      }));
    });
  });

  describe('hasPlugin', () => {
    test('登録されているプラグインを確認する', () => {
      // Arrange
      const pluginType = 'test-plugin';
      const pluginImplementation = {};
      pluginManager.plugins.set(pluginType, pluginImplementation);
      
      // Act
      const result = pluginManager.hasPlugin(pluginType);
      
      // Assert
      expect(result).toBe(true);
    });

    test('登録されていないプラグインを確認する', () => {
      // Act
      const result = pluginManager.hasPlugin('non-existent-plugin');
      
      // Assert
      expect(result).toBe(false);
    });
  });

  describe('unregisterPlugin', () => {
    test('登録されているプラグインを削除する', () => {
      // Arrange
      const pluginType = 'test-plugin';
      const pluginImplementation = {};
      pluginManager.plugins.set(pluginType, pluginImplementation);
      
      // Act
      const result = pluginManager.unregisterPlugin(pluginType);
      
      // Assert
      expect(result).toBe(true);
      expect(pluginManager.plugins.has(pluginType)).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith(`プラグイン ${pluginType} を削除しました`);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('plugin:unregistered', expect.objectContaining({
        pluginType,
        timestamp: '2025-03-24T00:00:00.000Z'
      }));
    });

    test('登録されていないプラグインを削除しようとすると失敗する', () => {
      // Act
      const result = pluginManager.unregisterPlugin('non-existent-plugin');
      
      // Assert
      expect(result).toBe(false);
      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });

    test('cleanup メソッドがあれば呼び出される', () => {
      // Arrange
      const pluginType = 'test-plugin';
      const cleanupMock = jest.fn();
      const pluginImplementation = {
        cleanup: cleanupMock
      };
      pluginManager.plugins.set(pluginType, pluginImplementation);
      
      // Act
      pluginManager.unregisterPlugin(pluginType);
      
      // Assert
      expect(cleanupMock).toHaveBeenCalled();
    });

    test('cleanup メソッドでエラーが発生しても削除は成功する', () => {
      // Arrange
      const pluginType = 'test-plugin';
      const error = new Error('クリーンアップエラー');
      const pluginImplementation = {
        cleanup: jest.fn().mockImplementation(() => {
          throw error;
        })
      };
      pluginManager.plugins.set(pluginType, pluginImplementation);
      
      // Act
      const result = pluginManager.unregisterPlugin(pluginType);
      
      // Assert
      expect(result).toBe(true);
      expect(pluginManager.plugins.has(pluginType)).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(`プラグイン ${pluginType} のクリーンアップ中にエラーが発生しました:`, error);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('plugin:cleanup_error', expect.objectContaining({
        pluginType,
        error: error.message,
        timestamp: '2025-03-24T00:00:00.000Z'
      }));
    });
  });

  describe('getRegisteredPlugins', () => {
    test('登録されているプラグイン一覧を取得する', () => {
      // Arrange
      pluginManager.plugins.set('plugin1', {});
      pluginManager.plugins.set('plugin2', {});
      pluginManager.plugins.set('plugin3', {});
      
      // Act
      const result = pluginManager.getRegisteredPlugins();
      
      // Assert
      expect(result).toEqual(['plugin1', 'plugin2', 'plugin3']);
    });

    test('プラグインが登録されていない場合は空配列を返す', () => {
      // Act
      const result = pluginManager.getRegisteredPlugins();
      
      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('invokePlugin', () => {
    test('プラグインメソッドを正常に呼び出す', async () => {
      // Arrange
      const pluginType = 'test-plugin';
      const methodName = 'testMethod';
      const methodResult = 'test result';
      const methodMock = jest.fn().mockResolvedValue(methodResult);
      const pluginImplementation = {
        [methodName]: methodMock
      };
      pluginManager.plugins.set(pluginType, pluginImplementation);
      
      // Act
      const result = await pluginManager.invokePlugin(pluginType, methodName, 'arg1', 'arg2');
      
      // Assert
      expect(result).toBe(methodResult);
      expect(methodMock).toHaveBeenCalledWith('arg1', 'arg2');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('plugin:method_invoked', expect.objectContaining({
        pluginType,
        methodName,
        timestamp: '2025-03-24T00:00:00.000Z'
      }));
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('plugin:method_completed', expect.objectContaining({
        pluginType,
        methodName,
        timestamp: '2025-03-24T00:00:00.000Z'
      }));
    });

    test('存在しないプラグインを呼び出すとnullを返す', async () => {
      // Act
      const result = await pluginManager.invokePlugin('non-existent-plugin', 'testMethod');
      
      // Assert
      expect(result).toBeNull();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('plugin:method_not_found', expect.objectContaining({
        pluginType: 'non-existent-plugin',
        methodName: 'testMethod',
        timestamp: '2025-03-24T00:00:00.000Z'
      }));
    });

    test('存在しないメソッドを呼び出すとnullを返す', async () => {
      // Arrange
      const pluginType = 'test-plugin';
      const pluginImplementation = {};
      pluginManager.plugins.set(pluginType, pluginImplementation);
      
      // Act
      const result = await pluginManager.invokePlugin(pluginType, 'non-existent-method');
      
      // Assert
      expect(result).toBeNull();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('plugin:method_not_found', expect.objectContaining({
        pluginType,
        methodName: 'non-existent-method',
        timestamp: '2025-03-24T00:00:00.000Z'
      }));
    });

    test('メソッド呼び出し中にエラーが発生すると例外がスローされる', async () => {
      // Arrange
      const pluginType = 'test-plugin';
      const methodName = 'testMethod';
      const error = new Error('メソッド呼び出しエラー');
      const methodMock = jest.fn().mockRejectedValue(error);
      const pluginImplementation = {
        [methodName]: methodMock
      };
      pluginManager.plugins.set(pluginType, pluginImplementation);
      
      // Act & Assert
      await expect(pluginManager.invokePlugin(pluginType, methodName)).rejects.toThrow(error);
      expect(mockLogger.error).toHaveBeenCalledWith(`プラグイン ${pluginType}.${methodName} の呼び出し中にエラーが発生しました:`, error);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('plugin:method_error', expect.objectContaining({
        pluginType,
        methodName,
        error: error.message,
        timestamp: '2025-03-24T00:00:00.000Z'
      }));
    });

    test('同期メソッドを正常に呼び出す', async () => {
      // Arrange
      const pluginType = 'test-plugin';
      const methodName = 'syncMethod';
      const methodResult = 'sync result';
      const methodMock = jest.fn(() => methodResult);
      const pluginImplementation = {
        [methodName]: methodMock
      };
      pluginManager.plugins.set(pluginType, pluginImplementation);
      
      // Act
      const result = await pluginManager.invokePlugin(pluginType, methodName);
      
      // Assert
      expect(result).toBe(methodResult);
      expect(methodMock).toHaveBeenCalled();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('plugin:method_invoked', expect.objectContaining({
        pluginType,
        methodName,
        timestamp: '2025-03-24T00:00:00.000Z'
      }));
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('plugin:method_completed', expect.objectContaining({
        pluginType,
        methodName,
        timestamp: '2025-03-24T00:00:00.000Z'
      }));
    });
  });

  describe('_validatePlugin', () => {
    test('プラグインタイプが無効な場合はfalseを返す', () => {
      // Arrange
      const invalidTypes = [null, undefined, '', 123, {}, []];
      
      // Act & Assert
      invalidTypes.forEach(type => {
        expect(pluginManager._validatePlugin(type, {})).toBe(false);
      });
    });

    test('プラグイン実装が無効な場合はfalseを返す', () => {
      // Arrange
      const invalidImplementations = [null, undefined, '', 123, [], {}];
      
      // Act & Assert
      invalidImplementations.forEach(impl => {
        expect(pluginManager._validatePlugin('test-plugin', impl)).toBe(false);
      });
    });

    test('ciプラグインの検証', () => {
      // Arrange
      const validImpl = { runTests: jest.fn() };
      const invalidImpl = { someOtherMethod: jest.fn() };
      
      // Act & Assert
      expect(pluginManager._validatePlugin('ci', validImpl)).toBe(true);
      expect(pluginManager._validatePlugin('ci', invalidImpl)).toBe(false);
    });

    test('notificationプラグインの検証', () => {
      // Arrange
      const validImpl = { sendNotification: jest.fn() };
      const invalidImpl = { someOtherMethod: jest.fn() };
      
      // Act & Assert
      expect(pluginManager._validatePlugin('notification', validImpl)).toBe(true);
      expect(pluginManager._validatePlugin('notification', invalidImpl)).toBe(false);
    });

    test('reportプラグインの検証', () => {
      // Arrange
      const validImpl = { generateReport: jest.fn() };
      const invalidImpl = { someOtherMethod: jest.fn() };
      
      // Act & Assert
      expect(pluginManager._validatePlugin('report', validImpl)).toBe(true);
      expect(pluginManager._validatePlugin('report', invalidImpl)).toBe(false);
    });

    test('storageプラグインの検証', () => {
      // Arrange
      const validImpl = { save: jest.fn(), load: jest.fn() };
      const invalidImpl1 = { save: jest.fn() }; // loadがない
      const invalidImpl2 = { load: jest.fn() }; // saveがない
      
      // Act & Assert
      expect(pluginManager._validatePlugin('storage', validImpl)).toBe(true);
      expect(pluginManager._validatePlugin('storage', invalidImpl1)).toBe(false);
      expect(pluginManager._validatePlugin('storage', invalidImpl2)).toBe(false);
    });

    test('汎用プラグインの検証', () => {
      // Arrange
      const impl = { someMethod: jest.fn() };
      
      // Act & Assert
      expect(pluginManager._validatePlugin('generic', impl)).toBe(true);
    });
  });
});
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
    
    // PluginManagerのインスタンス作成
    pluginManager = new PluginManager(createPluginManagerTestOptions());
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
      expect(pluginManager.logger).toBe(mockLogger);
      expect(pluginManager.eventEmitter).toBe(mockEventEmitter);
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
        hasCleanup: false
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
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('検証に失敗しました'), expect.any(String));
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('plugin:validation_failed', expect.objectContaining({
        pluginType
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
        hasCleanup: false
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
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('初期化中にエラーが発生しました'), expect.any(String));
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('plugin:initialization_error', expect.objectContaining({
        pluginType,
        error: error.message
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
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('削除しました'));
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('plugin:unregistered', expect.objectContaining({
        pluginType
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
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('クリーンアップ中にエラーが発生しました'), expect.any(String));
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('plugin:cleanup_error', expect.objectContaining({
        pluginType,
        error: error.message
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
        methodName
      }));
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('plugin:method_completed', expect.objectContaining({
        pluginType,
        methodName
      }));
    });

    test('存在しないプラグインを呼び出すとnullを返す', async () => {
      // Act
      const result = await pluginManager.invokePlugin('non-existent-plugin', 'testMethod');
      
      // Assert
      expect(result).toBeNull();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('plugin:method_not_found', expect.objectContaining({
        pluginType: 'non-existent-plugin',
        methodName: 'testMethod'
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
        methodName: 'non-existent-method'
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
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('呼び出し中にエラーが発生しました'), expect.any(String));
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('plugin:method_error', expect.objectContaining({
        pluginType,
        methodName,
        error: error.message
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
      const invalidImplementations = [null, undefined, '', 123, []];
      
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
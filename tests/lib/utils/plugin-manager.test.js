/**
 * プラグインマネージャーのテスト
 */

const PluginManager = require('../../../src/lib/utils/plugin-manager');
const {
  createMockLogger,
  createMockEventEmitter,
  mockTimestamp,
} = require('../../helpers/mock-factory');
const { expectStandardizedEventEmitted } = require('../../helpers/test-helpers');

describe('PluginManager', () => {
  let pluginManager;
  let mockLogger;
  let mockEventEmitter;
  const MOCK_TIMESTAMP_ISO = '2025-03-24T00:00:00.000Z';
  const MOCK_TIMESTAMP_MS = new Date(MOCK_TIMESTAMP_ISO).getTime();
  const MOCK_RANDOM = 0.123456789;
  const EXPECTED_TRACE_ID = `trace-${MOCK_TIMESTAMP_MS}-4fzzxw8a5`;
  const EXPECTED_REQUEST_ID = `req-${MOCK_TIMESTAMP_MS}-4fzzxw8a5`;


  beforeEach(() => {
    // モックのリセット
    jest.clearAllMocks();
    jest.restoreAllMocks();

    // 時間のモック
    mockTimestamp(MOCK_TIMESTAMP_ISO);
    jest.spyOn(Date, 'now').mockReturnValue(MOCK_TIMESTAMP_MS);
    jest.spyOn(Math, 'random').mockReturnValue(MOCK_RANDOM);


    // 共通モックファクトリを使用
    mockLogger = createMockLogger();
    mockEventEmitter = createMockEventEmitter();

    // モックの設定
    jest.spyOn(mockLogger, 'info');
    jest.spyOn(mockLogger, 'error');
    jest.spyOn(mockLogger, 'warn');
    jest.spyOn(mockEventEmitter, 'emitStandardized');

    // PluginManagerのインスタンス作成
    const options = {
      logger: mockLogger,
      eventEmitter: mockEventEmitter,
    };
    pluginManager = new PluginManager(options);
  });

  describe('constructor', () => {
    test('logger がないとエラーをスローする', () => {
      expect(() => new PluginManager({ eventEmitter: mockEventEmitter })).toThrow('Logger instance is required');
    });

    test('指定されたオプションで初期化される', () => {
      // Assert (beforeEach で初期化済み)
      expect(pluginManager.plugins).toBeInstanceOf(Map);
      expect(pluginManager.plugins.size).toBe(0);
      expect(pluginManager.logger).toBe(mockLogger);
      expect(pluginManager.eventEmitter).toBe(mockEventEmitter);
    });


    test('オプションなしの場合、デフォルト値で初期化される (logger は必須)', () => {
      // Arrange & Act & Assert
      // logger がないとエラーになるため、最低限 logger は渡す
      const instance = new PluginManager({ logger: mockLogger });
      expect(instance.plugins).toBeInstanceOf(Map);
      expect(instance.plugins.size).toBe(0);
      expect(instance.logger).toBe(mockLogger);
      expect(instance.eventEmitter).toBeUndefined();
    });

    test('eventEmitter が未指定でもエラーなく動作し、イベントは発行されない', () => {
      // Arrange
      const options = { logger: mockLogger };
      const pmWithoutEmitter = new PluginManager(options);
      const pluginType = 'test';
      const pluginImpl = { testMethod: jest.fn(), initialize: jest.fn(), cleanup: jest.fn() };
      jest.spyOn(pmWithoutEmitter, '_validatePlugin').mockReturnValue(true); // 検証は成功させる

      // Act & Assert
      expect(() => pmWithoutEmitter.registerPlugin(pluginType, pluginImpl)).not.toThrow();
      expect(mockEventEmitter.emitStandardized).not.toHaveBeenCalled(); // イベント発行されない

      expect(() => pmWithoutEmitter.invokePlugin(pluginType, 'testMethod')).not.toThrow();
      expect(mockEventEmitter.emitStandardized).not.toHaveBeenCalled(); // イベント発行されない

      expect(() => pmWithoutEmitter.unregisterPlugin(pluginType)).not.toThrow();
      expect(mockEventEmitter.emitStandardized).not.toHaveBeenCalled(); // イベント発行されない
    });
  });

  describe('registerPlugin', () => {
    test('有効なプラグインを登録し、registered イベントを発行する', () => {
      // Arrange
      const pluginType = 'test-plugin';
      const pluginImplementation = { testMethod: jest.fn() };
      jest.spyOn(pluginManager, '_validatePlugin').mockReturnValue(true);

      // Act
      const result = pluginManager.registerPlugin(pluginType, pluginImplementation);

      // Assert
      expect(result).toBe(true);
      expect(pluginManager.plugins.has(pluginType)).toBe(true);
      expect(pluginManager.plugins.get(pluginType)).toBe(pluginImplementation);
      expect(mockLogger.info).toHaveBeenCalledWith(`プラグイン ${pluginType} を登録しました`);
      expectStandardizedEventEmitted(mockEventEmitter, 'plugin', 'registered', {
        pluginType,
        hasInitialize: false,
        hasCleanup: false,
        timestamp: 'any',
        traceId: expect.any(String),
        requestId: expect.any(String),
      });
    });

    test('無効なプラグインは登録されず、validation_failed イベントを発行する', () => {
      // Arrange
      const pluginType = 'test-plugin';
      const pluginImplementation = {};
      jest.spyOn(pluginManager, '_validatePlugin').mockReturnValue(false);

      // Act
      const result = pluginManager.registerPlugin(pluginType, pluginImplementation);

      // Assert
      expect(result).toBe(false);
      expect(pluginManager.plugins.has(pluginType)).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(`プラグイン ${pluginType} の検証に失敗しました`);
      expectStandardizedEventEmitted(mockEventEmitter, 'plugin', 'validation_failed', {
        pluginType,
        timestamp: 'any',
        traceId: expect.any(String),
        requestId: expect.any(String),
      });
    });

    test('initialize メソッドがあれば呼び出され、registered イベントを発行する', () => {
      // Arrange
      const pluginType = 'test-plugin';
      const initializeMock = jest.fn();
      const pluginImplementation = { initialize: initializeMock };
      jest.spyOn(pluginManager, '_validatePlugin').mockReturnValue(true);

      // Act
      pluginManager.registerPlugin(pluginType, pluginImplementation);

      // Assert
      expect(initializeMock).toHaveBeenCalled();
      expectStandardizedEventEmitted(mockEventEmitter, 'plugin', 'registered', {
        pluginType,
        hasInitialize: true,
        hasCleanup: false,
        timestamp: 'any',
        traceId: expect.any(String),
        requestId: expect.any(String),
      });
    });

    test('initialize メソッドでエラーが発生しても登録は成功し、initialization_error イベントを発行する', () => {
      // Arrange
      const pluginType = 'test-plugin';
      const error = new Error('初期化エラー');
      const pluginImplementation = {
        initialize: jest.fn().mockImplementation(() => { throw error; }),
      };
      jest.spyOn(pluginManager, '_validatePlugin').mockReturnValue(true);

      // Act
      const result = pluginManager.registerPlugin(pluginType, pluginImplementation);

      // Assert
      expect(result).toBe(true);
      expect(pluginManager.plugins.has(pluginType)).toBe(true);
      expect(mockLogger.error).toHaveBeenCalledWith(
        `プラグイン ${pluginType} の初期化中にエラーが発生しました:`,
        error
      );
      expectStandardizedEventEmitted(mockEventEmitter, 'plugin', 'initialization_error', {
        pluginType,
        error: error.message,
        timestamp: 'any',
        traceId: expect.any(String),
        requestId: expect.any(String),
      });
      // registered イベントも発行される
      expectStandardizedEventEmitted(mockEventEmitter, 'plugin', 'registered', {
        pluginType,
        hasInitialize: true,
        hasCleanup: false,
        timestamp: 'any',
        traceId: expect.any(String),
        requestId: expect.any(String),
      });
    });
  });

  describe('hasPlugin', () => {
    test('登録されているプラグインを確認する', () => {
      // Arrange
      pluginManager.plugins.set('test-plugin', {});
      // Act & Assert
      expect(pluginManager.hasPlugin('test-plugin')).toBe(true);
    });

    test('登録されていないプラグインを確認する', () => {
      // Act & Assert
      expect(pluginManager.hasPlugin('non-existent-plugin')).toBe(false);
    });
  });

  describe('unregisterPlugin', () => {
    test('登録されているプラグインを削除し、unregistered イベントを発行する', () => {
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
      expectStandardizedEventEmitted(mockEventEmitter, 'plugin', 'unregistered', {
        pluginType,
        timestamp: 'any',
        traceId: expect.any(String),
        requestId: expect.any(String),
      });
    });

    test('登録されていないプラグインを削除しようとすると失敗する', () => {
      // Act
      const result = pluginManager.unregisterPlugin('non-existent-plugin');
      // Assert
      expect(result).toBe(false);
      expect(mockEventEmitter.emitStandardized).not.toHaveBeenCalled();
    });

    test('cleanup メソッドがあれば呼び出される', () => {
      // Arrange
      const pluginType = 'test-plugin';
      const cleanupMock = jest.fn();
      const pluginImplementation = { cleanup: cleanupMock };
      pluginManager.plugins.set(pluginType, pluginImplementation);

      // Act
      pluginManager.unregisterPlugin(pluginType);

      // Assert
      expect(cleanupMock).toHaveBeenCalled();
    });

    test('cleanup メソッドでエラーが発生しても削除は成功し、cleanup_error イベントを発行する', () => {
      // Arrange
      const pluginType = 'test-plugin';
      const error = new Error('クリーンアップエラー');
      const pluginImplementation = {
        cleanup: jest.fn().mockImplementation(() => { throw error; }),
      };
      pluginManager.plugins.set(pluginType, pluginImplementation);

      // Act
      const result = pluginManager.unregisterPlugin(pluginType);

      // Assert
      expect(result).toBe(true);
      expect(pluginManager.plugins.has(pluginType)).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        `プラグイン ${pluginType} のクリーンアップ中にエラーが発生しました:`,
        error
      );
      expectStandardizedEventEmitted(mockEventEmitter, 'plugin', 'cleanup_error', {
        pluginType,
        error: error.message,
        timestamp: 'any',
        traceId: expect.any(String),
        requestId: expect.any(String),
      });
      // unregistered イベントも発行される
      expectStandardizedEventEmitted(mockEventEmitter, 'plugin', 'unregistered', {
        pluginType,
        timestamp: 'any',
        traceId: expect.any(String),
        requestId: expect.any(String),
      });
    });
  });

  describe('getRegisteredPlugins', () => {
    test('登録されているプラグイン一覧を取得する', () => {
      // Arrange
      pluginManager.plugins.set('plugin1', {});
      pluginManager.plugins.set('plugin2', {});
      // Act & Assert
      expect(pluginManager.getRegisteredPlugins()).toEqual(['plugin1', 'plugin2']);
    });

    test('プラグインが登録されていない場合は空配列を返す', () => {
      // Act & Assert
      expect(pluginManager.getRegisteredPlugins()).toEqual([]);
    });
  });

  describe('invokePlugin', () => {
    test('プラグインメソッドを正常に呼び出し、イベントを発行する', async () => {
      // Arrange
      const pluginType = 'test-plugin';
      const methodName = 'testMethod';
      const methodResult = 'test result';
      const methodMock = jest.fn().mockResolvedValue(methodResult);
      const pluginImplementation = { [methodName]: methodMock };
      pluginManager.plugins.set(pluginType, pluginImplementation);

      // Act
      const result = await pluginManager.invokePlugin(pluginType, methodName, 'arg1', 'arg2');

      // Assert
      expect(result).toBe(methodResult);
      expect(methodMock).toHaveBeenCalledWith('arg1', 'arg2');
      expectStandardizedEventEmitted(mockEventEmitter, 'plugin', 'method_invoked', {
        pluginType,
        methodName,
        timestamp: 'any',
        traceId: expect.any(String),
        requestId: expect.any(String),
      });
      expectStandardizedEventEmitted(mockEventEmitter, 'plugin', 'method_completed', {
        pluginType,
        methodName,
        timestamp: 'any',
        traceId: expect.any(String),
        requestId: expect.any(String),
      });
    });

    test('存在しないプラグインを呼び出すとnullを返し、method_not_found イベントを発行する', async () => {
      // Act
      const result = await pluginManager.invokePlugin('non-existent-plugin', 'testMethod');
      // Assert
      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(`プラグインメソッドが見つかりません: non-existent-plugin.testMethod`);
      expectStandardizedEventEmitted(mockEventEmitter, 'plugin', 'method_not_found', {
        pluginType: 'non-existent-plugin',
        methodName: 'testMethod',
        timestamp: 'any',
        traceId: expect.any(String),
        requestId: expect.any(String),
      });
    });

    test('存在しないメソッドを呼び出すとnullを返し、method_not_found イベントを発行する', async () => {
      // Arrange
      const pluginType = 'test-plugin';
      pluginManager.plugins.set(pluginType, {});

      // Act
      const result = await pluginManager.invokePlugin(pluginType, 'non-existent-method');

      // Assert
      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(`プラグインメソッドが見つかりません: ${pluginType}.non-existent-method`);
      expectStandardizedEventEmitted(mockEventEmitter, 'plugin', 'method_not_found', {
        pluginType,
        methodName: 'non-existent-method',
        timestamp: 'any',
        traceId: expect.any(String),
        requestId: expect.any(String),
      });
    });

    test('メソッド呼び出し中にエラーが発生すると例外がスローされ、method_error イベントを発行する', async () => {
      // Arrange
      const pluginType = 'test-plugin';
      const methodName = 'testMethod';
      const error = new Error('メソッド呼び出しエラー');
      const methodMock = jest.fn().mockRejectedValue(error);
      const pluginImplementation = { [methodName]: methodMock };
      pluginManager.plugins.set(pluginType, pluginImplementation);

      // Act & Assert
      await expect(pluginManager.invokePlugin(pluginType, methodName)).rejects.toThrow(error);
      expect(mockLogger.error).toHaveBeenCalledWith(
        `プラグイン ${pluginType}.${methodName} の呼び出し中にエラーが発生しました:`,
        error
      );
      expectStandardizedEventEmitted(mockEventEmitter, 'plugin', 'method_invoked', { // invoked は呼ばれる
        pluginType,
        methodName,
        timestamp: 'any',
        traceId: expect.any(String),
        requestId: expect.any(String),
      });
      expectStandardizedEventEmitted(mockEventEmitter, 'plugin', 'method_error', {
        pluginType,
        methodName,
        error: error.message,
        timestamp: 'any',
        traceId: expect.any(String),
        requestId: expect.any(String),
      });
    });

    test('同期メソッドを正常に呼び出し、イベントを発行する', async () => {
      // Arrange
      const pluginType = 'test-plugin';
      const methodName = 'syncMethod';
      const methodResult = 'sync result';
      const methodMock = jest.fn(() => methodResult); // 同期関数
      const pluginImplementation = { [methodName]: methodMock };
      pluginManager.plugins.set(pluginType, pluginImplementation);

      // Act
      const result = await pluginManager.invokePlugin(pluginType, methodName);

      // Assert
      expect(result).toBe(methodResult);
      expect(methodMock).toHaveBeenCalled();
      expectStandardizedEventEmitted(mockEventEmitter, 'plugin', 'method_invoked', {
        pluginType,
        methodName,
        timestamp: 'any',
        traceId: expect.any(String),
        requestId: expect.any(String),
      });
      expectStandardizedEventEmitted(mockEventEmitter, 'plugin', 'method_completed', {
        pluginType,
        methodName,
        timestamp: 'any',
        traceId: expect.any(String),
        requestId: expect.any(String),
      });
    });
  });

  describe('_validatePlugin', () => {
    test('プラグインタイプが無効な場合はfalseを返す', () => {
      // Arrange
      const invalidTypes = [null, undefined, '', 123, {}, []];
      // Act & Assert
      invalidTypes.forEach((type) => {
        expect(pluginManager._validatePlugin(type, { m: jest.fn() })).toBe(false);
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('プラグインタイプの検証に失敗: タイプが文字列ではありません'), { pluginType: type });
        mockLogger.warn.mockClear();
      });
    });

    test('プラグイン実装が無効な場合 (null, undefined, string, number) はfalseを返す', () => {
      // Arrange
      const invalidImplementations = [null, undefined, '', 123]; // 配列を除外
      // Act & Assert
      invalidImplementations.forEach((impl) => {
        expect(pluginManager._validatePlugin('test-plugin', impl)).toBe(false);
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`プラグイン実装の検証に失敗 (test-plugin): 実装がオブジェクトではありません`), { pluginImplementation: impl });
        mockLogger.warn.mockClear();
      });
    });

    test('プラグイン実装が無効な場合 (配列) はfalseを返す', () => {
       // Arrange
       const invalidImpl = [];
       // Act
       expect(pluginManager._validatePlugin('test-plugin', invalidImpl)).toBe(false);
       // Assert
       expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`プラグイン実装の検証に失敗 (test-plugin): 実装がオブジェクトではありません`), { pluginImplementation: invalidImpl });
    });

    test('プラグイン実装が無効な場合 (空オブジェクト) はfalseを返す', () => {
       // Arrange
       const invalidImpl = {};
       // Act
       expect(pluginManager._validatePlugin('generic', invalidImpl)).toBe(false);
       // Assert
       expect(pluginManager._validatePlugin('generic', {})).toBe(false);
       expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`プラグイン検証失敗 (generic): 実装が空のオブジェクトです`));
    });

    // --- test.each を個別の test に分割 ---
    test('ci プラグインの検証 (有効)', () => {
        const impl = { runTests: jest.fn() };
        expect(pluginManager._validatePlugin('ci', impl)).toBe(true);
    });
    test('ci プラグインの検証 (無効)', () => {
        const impl = { someOtherMethod: jest.fn() };
        expect(pluginManager._validatePlugin('ci', impl)).toBe(false);
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`プラグイン検証失敗 (ci): runTests メソッドが必要です`));
    });
    test('notification プラグインの検証 (有効)', () => {
        const impl = { sendNotification: jest.fn() };
        expect(pluginManager._validatePlugin('notification', impl)).toBe(true);
    });
    test('notification プラグインの検証 (無効)', () => {
        const impl = {};
        expect(pluginManager._validatePlugin('notification', impl)).toBe(false);
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`プラグイン検証失敗 (notification): sendNotification メソッドが必要です`));
    });
    test('report プラグインの検証 (有効)', () => {
        const impl = { generateReport: jest.fn() };
        expect(pluginManager._validatePlugin('report', impl)).toBe(true);
    });
    test('report プラグインの検証 (無効)', () => {
        const impl = {};
        expect(pluginManager._validatePlugin('report', impl)).toBe(false);
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`プラグイン検証失敗 (report): generateReport メソッドが必要です`));
    });
    test('storage プラグインの検証 (有効)', () => {
        const impl = { save: jest.fn(), load: jest.fn() };
        expect(pluginManager._validatePlugin('storage', impl)).toBe(true);
    });
    test('storage プラグインの検証 (save のみ)', () => {
        const impl = { save: jest.fn() };
        expect(pluginManager._validatePlugin('storage', impl)).toBe(false);
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`プラグイン検証失敗 (storage): save および load メソッドが必要です`));
    });
    test('storage プラグインの検証 (load のみ)', () => {
        const impl = { load: jest.fn() };
        expect(pluginManager._validatePlugin('storage', impl)).toBe(false);
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`プラグイン検証失敗 (storage): save および load メソッドが必要です`));
    });
    test('generic プラグインの検証 (有効)', () => {
        const impl = { someMethod: jest.fn() };
        expect(pluginManager._validatePlugin('generic', impl)).toBe(true);
    });
    // -----------------------------------------
  });
});



  describe('EventEmitter なしの場合', () => {
    let pluginManagerWithoutEmitter;
    let mockPlugin;
    let mockLogger; // mockLogger をここで宣言

    beforeEach(() => {
      mockLogger = createMockLogger(); // mockLogger を初期化
      pluginManagerWithoutEmitter = new PluginManager({ logger: mockLogger });
      mockPlugin = { name: 'test', initialize: jest.fn(), cleanup: jest.fn(), testMethod: jest.fn().mockResolvedValue('result') };
    });

    test('registerPlugin はイベントを発行せずにプラグインを登録する', () => {
      const result = pluginManagerWithoutEmitter.registerPlugin('test-plugin', mockPlugin);
      expect(result).toBe(true);
      expect(pluginManagerWithoutEmitter.hasPlugin('test-plugin')).toBe(true);
      expect(mockPlugin.initialize).toHaveBeenCalled();
      // emitStandardized が呼ばれないことを確認 (アサーションは難しいが、エラーが出ないことを確認)
    });

    test('unregisterPlugin はイベントを発行せずにプラグインを削除する', () => {
      pluginManagerWithoutEmitter.registerPlugin('test-plugin', mockPlugin);
      const result = pluginManagerWithoutEmitter.unregisterPlugin('test-plugin');
      expect(result).toBe(true);
      expect(pluginManagerWithoutEmitter.hasPlugin('test-plugin')).toBe(false);
      expect(mockPlugin.cleanup).toHaveBeenCalled();
    });

    test('invokePlugin はイベントを発行せずにメソッドを呼び出す', async () => {
      pluginManagerWithoutEmitter.registerPlugin('test-plugin', mockPlugin);
      const result = await pluginManagerWithoutEmitter.invokePlugin('test-plugin', 'testMethod', 'arg1');
      expect(result).toBe('result');
      expect(mockPlugin.testMethod).toHaveBeenCalledWith('arg1');
    });

     test('invokePlugin でメソッドが見つからない場合、イベントは発行されない', async () => {
        pluginManagerWithoutEmitter.registerPlugin('test-plugin', mockPlugin);
        const result = await pluginManagerWithoutEmitter.invokePlugin('test-plugin', 'nonExistentMethod');
        expect(result).toBeNull();
        expect(mockLogger.warn).toHaveBeenCalledWith('プラグインメソッドが見つかりません: test-plugin.nonExistentMethod');
     });

     test('invokePlugin でエラーが発生した場合、イベントは発行されない', async () => {
        const error = new Error('Method error');
        mockPlugin.testMethod.mockRejectedValue(error);
        pluginManagerWithoutEmitter.registerPlugin('test-plugin', mockPlugin);
        await expect(pluginManagerWithoutEmitter.invokePlugin('test-plugin', 'testMethod')).rejects.toThrow(error);
     });

     test('registerPlugin で initialize エラーが発生した場合、イベントは発行されない', () => {
        const error = new Error('Init error');
        mockPlugin.initialize.mockImplementation(() => { throw error; });
        const result = pluginManagerWithoutEmitter.registerPlugin('test-plugin', mockPlugin);
        expect(result).toBe(true); // 登録自体は成功する
        expect(mockLogger.error).toHaveBeenCalledWith('プラグイン test-plugin の初期化中にエラーが発生しました:', error);
     });

     test('unregisterPlugin で cleanup エラーが発生した場合、イベントは発行されない', () => {
        const error = new Error('Cleanup error');
        mockPlugin.cleanup.mockImplementation(() => { throw error; });
        pluginManagerWithoutEmitter.registerPlugin('test-plugin', mockPlugin);
        const result = pluginManagerWithoutEmitter.unregisterPlugin('test-plugin');
        expect(result).toBe(true); // 削除自体は成功する
        expect(mockLogger.error).toHaveBeenCalledWith('プラグイン test-plugin のクリーンアップ中にエラーが発生しました:', error);
     });

     test('registerPlugin で検証失敗した場合、イベントは発行されない', () => {
        const invalidPlugin = {}; // 無効なプラグイン
        const result = pluginManagerWithoutEmitter.registerPlugin('invalid-plugin', invalidPlugin);
        expect(result).toBe(false);
        expect(mockLogger.error).toHaveBeenCalledWith('プラグイン invalid-plugin の検証に失敗しました');
     });

  });

/**
 * キャッシュマネージャークラスのテスト
 */

const CacheManager = require('../../../src/lib/utils/cache-manager');
const { 
  createMockLogger, 
  createMockEventEmitter,
  mockTimestamp 
} = require('../../helpers/mock-factory');
const { 
  expectEventEmitted,
  expectStandardizedEventEmitted
} = require('../../helpers/test-helpers');

describe('CacheManager', () => {
  let cacheManager;
  let mockEventEmitter;
  let mockLogger;
  let originalNodeEnv;
  
  beforeEach(() => {
    // 環境変数のモック
    originalNodeEnv = process.env.NODE_ENV;
    
    // イベントエミッターとロガーのモック
    mockEventEmitter = createMockEventEmitter();
    mockLogger = createMockLogger();
    
    // 日付・時間関連のモックを設定
    mockTimestamp('2025-03-24T00:00:00.000Z');
    const timestamp = new Date('2025-03-24T00:00:00.000Z').getTime();
    jest.spyOn(Date, 'now').mockReturnValue(timestamp);
    
    // CacheManagerのインスタンスを作成
    cacheManager = new CacheManager({
      eventEmitter: mockEventEmitter,
      logger: mockLogger,
      ttlMs: 1000,
      maxSize: 10
    });
    
    // モックをリセット
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    // 環境変数をリセット
    process.env.NODE_ENV = originalNodeEnv;
    jest.restoreAllMocks();
  });
  
  describe('constructor', () => {
    test('デフォルト値で初期化される', () => {
      // Arrange
      const instance = new CacheManager();
      
      // Assert
      expect(instance.ttlMs).toBe(300000);
      expect(instance.maxSize).toBe(1000);
      expect(instance.logger).toEqual(console);
      expect(instance.cache).toBeInstanceOf(Map);
      expect(instance.hitCount).toBe(0);
      expect(instance.missCount).toBe(0);
    });
    
    test('カスタム値で初期化される', () => {
      // Arrange
      const customLogger = createMockLogger();
      const instance = new CacheManager({
        ttlMs: 2000,
        maxSize: 20,
        logger: customLogger
      });
      
      // Assert
      expect(instance.ttlMs).toBe(2000);
      expect(instance.maxSize).toBe(20);
      expect(instance.logger).toBe(customLogger);
      expect(instance.cache).toBeInstanceOf(Map);
      expect(instance.hitCount).toBe(0);
      expect(instance.missCount).toBe(0);
    });
    
    test('emitStandardizedが利用可能な場合、標準化されたイベントを発行する', () => {
      // Arrange & Act
      new CacheManager({
        eventEmitter: mockEventEmitter,
        ttlMs: 2000,
        maxSize: 20
      });
      
      // Assert
      expectStandardizedEventEmitted(mockEventEmitter, 'cache', 'system_initialized', {
        ttlMs: 2000,
        maxSize: 20
      });
    });
    
    test('emitStandardizedが利用できない場合、従来のイベントを発行する', () => {
      // Arrange
      // emitStandardizedを削除
      delete mockEventEmitter.emitStandardized;
      
      // Act
      new CacheManager({
        eventEmitter: mockEventEmitter,
        ttlMs: 2000,
        maxSize: 20
      });
      
      // Assert
      expectEventEmitted(mockEventEmitter, 'cache:initialized', {
        ttlMs: 2000,
        maxSize: 20,
        timestamp: expect.any(String)
      });
    });
    
    test('開発環境では非推奨警告を表示する', () => {
      // Arrange
      // emitStandardizedを削除
      delete mockEventEmitter.emitStandardized;
      
      // 開発環境に設定
      process.env.NODE_ENV = 'development';
      
      // コンソール警告をモック
      const originalConsoleWarn = console.warn;
      console.warn = jest.fn();
      
      // Act
      new CacheManager({
        eventEmitter: mockEventEmitter,
        ttlMs: 2000,
        maxSize: 20
      });
      
      // Assert
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('非推奨のイベント名')
      );
      
      // コンソール警告を元に戻す
      console.warn = originalConsoleWarn;
    });
    
    test('本番環境では非推奨警告を表示しない', () => {
      // Arrange
      // emitStandardizedを削除
      delete mockEventEmitter.emitStandardized;
      
      // 本番環境に設定
      process.env.NODE_ENV = 'production';
      
      // コンソール警告をモック
      const originalConsoleWarn = console.warn;
      console.warn = jest.fn();
      
      // Act
      new CacheManager({
        eventEmitter: mockEventEmitter,
        ttlMs: 2000,
        maxSize: 20
      });
      
      // Assert
      expect(console.warn).not.toHaveBeenCalled();
      
      // コンソール警告を元に戻す
      console.warn = originalConsoleWarn;
    });
    
    test('イベントエミッターがない場合、イベントは発行されない', () => {
      // Arrange & Act
      new CacheManager({
        ttlMs: 2000,
        maxSize: 20
      });
      
      // Assert
      // エラーが発生しないことを確認
      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
      expect(mockEventEmitter.emitStandardized).not.toHaveBeenCalled();
    });
  });
  
  describe('get', () => {
    test('キャッシュミス の場合、適切な値を返す', () => {
      // Arrange
      const key = 'non-existent-key';
      
      // Act
      const result = cacheManager.get(key);
      
      // Assert
      expect(result).toBeNull();
      expect(cacheManager.missCount).toBe(1);
      expect(cacheManager.hitCount).toBe(0);
    });
    
    test('キャッシュヒット の場合、適切な値を返す', () => {
      // Arrange
      const key = 'test-key';
      const value = 'test-value';
      cacheManager.set(key, value);
      
      // モックをリセット
      jest.clearAllMocks();
      
      // Act
      const result = cacheManager.get(key);
      
      // Assert
      expect(result).toBe(value);
      expect(cacheManager.hitCount).toBe(1);
      expect(cacheManager.missCount).toBe(0);
      
      // イベントが発行されていることを確認
      expectStandardizedEventEmitted(mockEventEmitter, 'cache', 'item_accessed', {
        key
      });
    });

    test('emitStandardizedが利用できない場合、従来のイベントを発行する（get）', () => {
      // Arrange
      const key = 'test-key';
      const value = 'test-value';
      cacheManager.set(key, value);
      
      // emitStandardizedを削除
      delete mockEventEmitter.emitStandardized;
      
      // モックをリセット
      jest.clearAllMocks();
      
      // Act
      const result = cacheManager.get(key);
      
      // Assert
      expect(result).toBe(value);
      expect(cacheManager.hitCount).toBe(1);
      
      // 従来のイベントが発行されていることを確認
      expectEventEmitted(mockEventEmitter, 'cache:hit', {
        key,
        timestamp: expect.any(String)
      });
    });
    
    test('開発環境では非推奨警告を表示する（get）', () => {
      // Arrange
      const key = 'test-key';
      const value = 'test-value';
      cacheManager.set(key, value);
      
      // emitStandardizedを削除
      delete mockEventEmitter.emitStandardized;
      
      // 開発環境に設定
      process.env.NODE_ENV = 'development';
      
      // コンソール警告をモック
      const originalConsoleWarn = console.warn;
      console.warn = jest.fn();
      
      // Act
      const result = cacheManager.get(key);
      
      // Assert
      expect(result).toBe(value);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('非推奨のイベント名 cache:hit')
      );
      
      // コンソール警告を元に戻す
      console.warn = originalConsoleWarn;
    });
    
    test('期限切れの場合、nullを返す', () => {
      // Arrange
      const key = 'test-key';
      const value = 'test-value';
      
      // キャッシュに値を設定
      cacheManager.cache.set(key, {
        value,
        timestamp: Date.now() - 2000, // 2秒前（期限切れ）
        ttl: 1000 // 1秒
      });
      
      // Act
      const result = cacheManager.get(key);
      
      // Assert
      expect(result).toBeNull();
      expect(cacheManager.missCount).toBe(1);
      expect(cacheManager.hitCount).toBe(0);
      
      // キャッシュから削除されていることを確認
      expect(cacheManager.cache.has(key)).toBe(false);
    });
    
    test('イベントエミッターがない場合もエラーなく動作する', () => {
      // Arrange
      const key = 'test-key';
      const value = 'test-value';
      
      // イベントエミッターを削除
      cacheManager.eventEmitter = null;
      
      // キャッシュに値を設定
      cacheManager.cache.set(key, {
        value,
        timestamp: Date.now(),
        ttl: 1000
      });
      
      // Act
      const result = cacheManager.get(key);
      
      // Assert
      expect(result).toBe(value);
    });
    
    test('イベントエミッターがない場合、キャッシュミス時もエラーなく動作する', () => {
      // Arrange
      const key = 'non-existent-key';
      
      // イベントエミッターを削除
      cacheManager.eventEmitter = null;
      
      // Act
      const result = cacheManager.get(key);
      
      // Assert
      expect(result).toBeNull();
      expect(cacheManager.missCount).toBe(1);
    });
    
    test('イベントエミッターがない場合、期限切れ時もエラーなく動作する', () => {
      // Arrange
      const key = 'test-key';
      const value = 'test-value';
      
      // イベントエミッターを削除
      cacheManager.eventEmitter = null;
      
      // キャッシュに期限切れの値を設定
      cacheManager.cache.set(key, {
        value,
        timestamp: Date.now() - 2000, // 2秒前（期限切れ）
        ttl: 1000 // 1秒
      });
      
      // Act
      const result = cacheManager.get(key);
      
      // Assert
      expect(result).toBeNull();
      expect(cacheManager.missCount).toBe(1);
      expect(cacheManager.cache.has(key)).toBe(false);
    });
  });
  
  describe('set', () => {
    test('キャッシュにデータを設定する', () => {
      // Arrange
      const key = 'test-key';
      const value = 'test-value';
      
      // Act
      cacheManager.set(key, value);
      
      // Assert
      // キャッシュに値が設定されていることを確認
      expect(cacheManager.cache.has(key)).toBe(true);
      const cached = cacheManager.cache.get(key);
      expect(cached.value).toBe(value);
      expect(cached.timestamp).toBe(Date.now());
      expect(cached.ttl).toBe(1000);
      
      // イベントが発行されていることを確認
      expectStandardizedEventEmitted(mockEventEmitter, 'cache', 'item_set', {
        key,
        ttl: 1000
      });
    });
    
    test('カスタムTTLでデータを設定する', () => {
      // Arrange
      const key = 'test-key';
      const value = 'test-value';
      const customTtl = 5000;
      
      // Act
      cacheManager.set(key, value, customTtl);
      
      // Assert
      const cached = cacheManager.cache.get(key);
      expect(cached.ttl).toBe(customTtl);
      
      expectStandardizedEventEmitted(mockEventEmitter, 'cache', 'item_set', {
        key,
        ttl: customTtl
      });
    });
    
    test('キャッシュサイズが上限に達した場合、最も古いエントリを削除する', () => {
      // Arrange
      // キャッシュサイズを小さく設定
      cacheManager.maxSize = 2;
      
      // 2つのエントリを追加
      cacheManager.set('key1', 'value1');
      
      // 1秒後に2つ目のエントリを追加
      const timestamp = Date.now() + 1000;
      jest.spyOn(Date, 'now').mockReturnValue(timestamp);
      cacheManager.set('key2', 'value2');
      
      // モックをリセット
      jest.clearAllMocks();
      
      // Act
      // 3つ目のエントリを追加（最も古いkey1が削除される）
      const timestamp2 = Date.now() + 1000;
      jest.spyOn(Date, 'now').mockReturnValue(timestamp2);
      cacheManager.set('key3', 'value3');
      
      // Assert
      expect(cacheManager.cache.has('key1')).toBe(false);
      expect(cacheManager.cache.has('key2')).toBe(true);
      expect(cacheManager.cache.has('key3')).toBe(true);
      
      // _evictOldestが呼ばれたことを確認
      expectStandardizedEventEmitted(mockEventEmitter, 'cache', 'item_evicted', {
        key: 'key1'
      });
    });
    
    test('emitStandardizedが利用できない場合、従来のイベントを発行する', () => {
      // Arrange
      // emitStandardizedを削除
      delete mockEventEmitter.emitStandardized;
      
      const key = 'test-key';
      const value = 'test-value';
      
      // Act
      cacheManager.set(key, value);
      
      // Assert
      expectEventEmitted(mockEventEmitter, 'cache:item_set', {
        key,
        ttl: 1000,
        timestamp: expect.any(String)
      });
    });
    
    test('開発環境では非推奨警告を表示する（set）', () => {
      // Arrange
      // emitStandardizedを削除
      delete mockEventEmitter.emitStandardized;
      
      // 開発環境に設定
      process.env.NODE_ENV = 'development';
      
      // コンソール警告をモック
      const originalConsoleWarn = console.warn;
      console.warn = jest.fn();
      
      const key = 'test-key';
      const value = 'test-value';
      
      // Act
      cacheManager.set(key, value);
      
      // Assert
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('非推奨のイベント名 cache:set')
      );
      
      // コンソール警告を元に戻す
      console.warn = originalConsoleWarn;
    });
    
    test('イベントエミッターがない場合、set時もエラーなく動作する', () => {
      // Arrange
      const key = 'test-key';
      const value = 'test-value';
      
      // イベントエミッターを削除
      cacheManager.eventEmitter = null;
      
      // Act
      cacheManager.set(key, value);
      
      // Assert
      expect(cacheManager.cache.has(key)).toBe(true);
      const cached = cacheManager.cache.get(key);
      expect(cached.value).toBe(value);
      expect(cached.timestamp).toBe(Date.now());
      expect(cached.ttl).toBe(1000);
    });
  });
  
  describe('invalidate', () => {
    test('文字列パターン に一致するキャッシュを無効化する', () => {
      // Arrange
      cacheManager.set('user:123', 'user data');
      cacheManager.set('user:456', 'user data');
      cacheManager.set('product:789', 'product data');
      
      // モックをリセット
      jest.clearAllMocks();
      
      // Act
      cacheManager.invalidate('user:');
      
      // Assert
      expect(cacheManager.cache.has('user:123')).toBe(false);
      expect(cacheManager.cache.has('user:456')).toBe(false);
      expect(cacheManager.cache.has('product:789')).toBe(true);
      
      // イベントが発行されていることを確認
      expectStandardizedEventEmitted(mockEventEmitter, 'cache', 'items_invalidated', {
        pattern: 'user:',
        count: 2
      });
    });
    
    test('正規表現パターン に一致するキャッシュを無効化する', () => {
      // Arrange
      cacheManager.set('user:123', 'user data');
      cacheManager.set('user:456', 'user data');
      cacheManager.set('product:789', 'product data');
      
      // モックをリセット
      jest.clearAllMocks();
      
      // Act
      cacheManager.invalidate(/^user:/);
      
      // Assert
      expect(cacheManager.cache.has('user:123')).toBe(false);
      expect(cacheManager.cache.has('user:456')).toBe(false);
      expect(cacheManager.cache.has('product:789')).toBe(true);
      
      // イベントが発行されていることを確認
      expectStandardizedEventEmitted(mockEventEmitter, 'cache', 'items_invalidated', {
        pattern: '/^user:/',
        count: 2
      });
    });
    
    test('一致しないパターン に一致するキャッシュを無効化する', () => {
      // Arrange
      cacheManager.set('user:123', 'user data');
      cacheManager.set('user:456', 'user data');
      
      // モックをリセット
      jest.clearAllMocks();
      
      // Act
      cacheManager.invalidate('product:');
      
      // Assert
      expect(cacheManager.cache.has('user:123')).toBe(true);
      expect(cacheManager.cache.has('user:456')).toBe(true);
      
      // イベントが発行されていることを確認
      expectStandardizedEventEmitted(mockEventEmitter, 'cache', 'items_invalidated', {
        pattern: 'product:',
        count: 0
      });
    });
    
    test('emitStandardizedが利用できない場合、従来のイベントを発行する（invalidate）', () => {
      // Arrange
      cacheManager.set('user:123', 'user data');
      cacheManager.set('user:456', 'user data');
      
      // emitStandardizedを削除
      delete mockEventEmitter.emitStandardized;
      
      // モックをリセット
      jest.clearAllMocks();
      
      // Act
      const count = cacheManager.invalidate('user:');
      
      // Assert
      expect(count).toBe(2);
      expect(cacheManager.cache.has('user:123')).toBe(false);
      expect(cacheManager.cache.has('user:456')).toBe(false);
      
      // 従来のイベントが発行されていることを確認
      expectEventEmitted(mockEventEmitter, 'cache:invalidated', {
        pattern: 'user:',
        count: 2,
        timestamp: expect.any(String)
      });
    });
    
    test('開発環境では非推奨警告を表示する（invalidate）', () => {
      // Arrange
      cacheManager.set('user:123', 'user data');
      
      // emitStandardizedを削除
      delete mockEventEmitter.emitStandardized;
      
      // 開発環境に設定
      process.env.NODE_ENV = 'development';
      
      // コンソール警告をモック
      const originalConsoleWarn = console.warn;
      console.warn = jest.fn();
      
      // モックをリセット
      jest.clearAllMocks();
      
      // Act
      cacheManager.invalidate('user:');
      
      // Assert
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('非推奨のイベント名 cache:invalidated')
      );
      
      // コンソール警告を元に戻す
      console.warn = originalConsoleWarn;
    });
    
    test('イベントエミッターがない場合もエラーなく動作する', () => {
      // Arrange
      cacheManager.set('user:123', 'user data');
      
      // イベントエミッターを削除
      cacheManager.eventEmitter = null;
      
      // Act & Assert
      expect(() => {
        cacheManager.invalidate('user:');
      }).not.toThrow();
      
      expect(cacheManager.cache.has('user:123')).toBe(false);
    });
  });
  
  describe('clear', () => {
    test('すべてのキャッシュをクリアする', () => {
      // Arrange
      cacheManager.set('key1', 'value1');
      cacheManager.set('key2', 'value2');
      
      // モックをリセット
      jest.clearAllMocks();
      
      // Act
      cacheManager.clear();
      
      // Assert
      expect(cacheManager.cache.size).toBe(0);
      
      // イベントが発行されていることを確認
      expectStandardizedEventEmitted(mockEventEmitter, 'cache', 'cleared', {
        count: 2
      });
    });
    
    test('キャッシュが空の場合、イベントは発行されない', () => {
      // Arrange
      // キャッシュは空
      
      // Act
      cacheManager.clear();
      
      // Assert
      expect(mockEventEmitter.emitStandardized).not.toHaveBeenCalled();
    });
    
    test('emitStandardizedが利用できない場合、従来のイベントを発行する（clear）', () => {
      // Arrange
      cacheManager.set('key1', 'value1');
      cacheManager.set('key2', 'value2');
      
      // emitStandardizedを削除
      delete mockEventEmitter.emitStandardized;
      
      // モックをリセット
      jest.clearAllMocks();
      
      // Act
      cacheManager.clear();
      
      // Assert
      expect(cacheManager.cache.size).toBe(0);
      
      // 従来のイベントが発行されていることを確認
      expectEventEmitted(mockEventEmitter, 'cache:cleared', {
        size: 2,
        timestamp: expect.any(String)
      });
    });
    
    test('開発環境では非推奨警告を表示する（clear）', () => {
      // Arrange
      cacheManager.set('key1', 'value1');
      
      // emitStandardizedを削除
      delete mockEventEmitter.emitStandardized;
      
      // 開発環境に設定
      process.env.NODE_ENV = 'development';
      
      // コンソール警告をモック
      const originalConsoleWarn = console.warn;
      console.warn = jest.fn();
      
      // モックをリセット
      jest.clearAllMocks();
      
      // Act
      cacheManager.clear();
      
      // Assert
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('非推奨のイベント名 cache:cleared')
      );
      
      // コンソール警告を元に戻す
      console.warn = originalConsoleWarn;
    });
    
    test('イベントエミッターがない場合もエラーなく動作する', () => {
      // Arrange
      cacheManager.set('key1', 'value1');
      
      // イベントエミッターを削除
      cacheManager.eventEmitter = null;
      
      // Act & Assert
      expect(() => {
        cacheManager.clear();
      }).not.toThrow();
      
      expect(cacheManager.cache.size).toBe(0);
    });
  });
  
  describe('getStats', () => {
    test('キャッシュの統計情報を取得する', () => {
      // Arrange
      cacheManager.set('key1', 'value1');
      cacheManager.get('key1'); // ヒット
      cacheManager.get('key2'); // ミス
      
      // Act
      const stats = cacheManager.getStats();
      
      // Assert
      expect(stats).toEqual({
        size: 1,
        maxSize: 10,
        hitCount: 1,
        missCount: 1,
        hitRate: 0.5
      });
    });
    
    test('リクエストがない場合、ヒット率は0', () => {
      // Arrange
      cacheManager.set('key1', 'value1');
      
      // Act
      const stats = cacheManager.getStats();
      
      // Assert
      expect(stats.hitRate).toBe(0);
    });
  });
  
  describe('_evictOldest', () => {
    test('最も古いエントリを削除する', () => {
      // Arrange
      // 1つ目のエントリを追加
      cacheManager.set('key1', 'value1');
      
      // 1秒後に2つ目のエントリを追加
      const timestamp = Date.now() + 1000;
      jest.spyOn(Date, 'now').mockReturnValue(timestamp);
      cacheManager.set('key2', 'value2');
      
      // モックをリセット
      jest.clearAllMocks();
      
      // Act
      cacheManager._evictOldest();
      
      // Assert
      expect(cacheManager.cache.has('key1')).toBe(false);
      expect(cacheManager.cache.has('key2')).toBe(true);
      
      // イベントが発行されていることを確認
      expectStandardizedEventEmitted(mockEventEmitter, 'cache', 'item_evicted', {
        key: 'key1'
      });
    });
    
    test('キャッシュが空の場合、何も削除しない', () => {
      // Arrange
      // キャッシュは空
      
      // Act
      cacheManager._evictOldest();
      
      // Assert
      expect(mockEventEmitter.emitStandardized).not.toHaveBeenCalled();
    });
    
    test('emitStandardizedが利用できない場合、従来のイベントを発行する（_evictOldest）', () => {
      // Arrange
      // 1つ目のエントリを追加
      cacheManager.set('key1', 'value1');
      
      // 1秒後に2つ目のエントリを追加
      const timestamp = Date.now() + 1000;
      jest.spyOn(Date, 'now').mockReturnValue(timestamp);
      cacheManager.set('key2', 'value2');
      
      // emitStandardizedを削除
      delete mockEventEmitter.emitStandardized;
      
      // モックをリセット
      jest.clearAllMocks();
      
      // Act
      cacheManager._evictOldest();
      
      // Assert
      expect(cacheManager.cache.has('key1')).toBe(false);
      expect(cacheManager.cache.has('key2')).toBe(true);
      
      // 従来のイベントが発行されていることを確認
      expectEventEmitted(mockEventEmitter, 'cache:evicted', {
        key: 'key1',
        timestamp: expect.any(String)
      });
    });
    
    test('開発環境では非推奨警告を表示する（_evictOldest）', () => {
      // Arrange
      cacheManager.set('key1', 'value1');
      
      // emitStandardizedを削除
      delete mockEventEmitter.emitStandardized;
      
      // 開発環境に設定
      process.env.NODE_ENV = 'development';
      
      // コンソール警告をモック
      const originalConsoleWarn = console.warn;
      console.warn = jest.fn();
      
      // モックをリセット
      jest.clearAllMocks();
      
      // Act
      cacheManager._evictOldest();
      
      // Assert
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('非推奨のイベント名 cache:evicted')
      );
      
      // コンソール警告を元に戻す
      console.warn = originalConsoleWarn;
    });
    
    test('イベントエミッターがない場合もエラーなく動作する', () => {
      // Arrange
      cacheManager.set('key1', 'value1');
      
      // イベントエミッターを削除
      cacheManager.eventEmitter = null;
      
      // Act & Assert
      expect(() => {
        cacheManager._evictOldest();
      }).not.toThrow();
      
      expect(cacheManager.cache.has('key1')).toBe(false);
    });
  });
});
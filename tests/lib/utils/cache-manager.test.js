/**
 * キャッシュマネージャークラスのテスト
 */

const CacheManager = require('../../../src/lib/utils/cache-manager');
const {
  createMockLogger,
  createMockEventEmitter,
  mockTimestamp,
} = require('../../helpers/mock-factory');
const {
  expectStandardizedEventEmitted,
} = require('../../helpers/test-helpers');

describe('CacheManager', () => {
  let cacheManager;
  let mockEventEmitter;
  let mockLogger;
  const MOCK_TIMESTAMP_ISO = '2025-03-24T00:00:00.000Z';
  const MOCK_TIMESTAMP_MS = new Date(MOCK_TIMESTAMP_ISO).getTime();

  beforeEach(() => {
    // モックのセットアップ
    mockEventEmitter = createMockEventEmitter();
    mockLogger = createMockLogger();

    // 時間関連のモック
    mockTimestamp(MOCK_TIMESTAMP_ISO);
    jest.spyOn(Date, 'now').mockReturnValue(MOCK_TIMESTAMP_MS);

    // CacheManagerのインスタンスを作成
    cacheManager = new CacheManager({
      eventEmitter: mockEventEmitter,
      logger: mockLogger,
      ttlMs: 1000, // テストしやすいように短く設定
      maxSize: 10,
    });

    // モックのリセット (インスタンス作成後にリセット)
    jest.clearAllMocks();
    // Date.now のモックは維持
    jest.spyOn(Date, 'now').mockReturnValue(MOCK_TIMESTAMP_MS);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    test('logger がないとエラーをスローする', () => {
      expect(() => new CacheManager({ eventEmitter: mockEventEmitter })).toThrow('Logger and EventEmitter instances are required');
    });
    test('eventEmitter がないとエラーをスローする', () => {
      expect(() => new CacheManager({ logger: mockLogger })).toThrow('Logger and EventEmitter instances are required');
    });

    test('カスタム値で初期化される', () => {
      // Arrange
      const customLogger = createMockLogger();
      const customEventEmitter = createMockEventEmitter();
      const instance = new CacheManager({
        ttlMs: 2000,
        maxSize: 20,
        logger: customLogger,
        eventEmitter: customEventEmitter,
      });

      // Assert
      expect(instance.ttlMs).toBe(2000);
      expect(instance.maxSize).toBe(20);
      expect(instance.logger).toBe(customLogger);
      expect(instance.eventEmitter).toBe(customEventEmitter);
      expect(instance.cache).toBeInstanceOf(Map);
      expect(instance.hitCount).toBe(0);
      expect(instance.missCount).toBe(0);
    });

    test('初期化時に system_initialized イベントを発行する', () => {
      // Assert (beforeEach での呼び出しを検証)
      expectStandardizedEventEmitted(
          mockEventEmitter,
          'cache',
          'system_initialized',
          {
            ttlMs: 1000,
            maxSize: 10,
            timestamp: 'any', // タイムスタンプの存在と形式を検証
          }
        );
    });


    test('オプションなしの場合、デフォルト値で初期化される (logger, eventEmitter は必須)', () => {
      // Arrange & Act
      const instance = new CacheManager({ logger: mockLogger, eventEmitter: mockEventEmitter });

      // Assert
      expect(instance.cache).toBeInstanceOf(Map);
      expect(instance.ttlMs).toBe(300000); // デフォルトTTL
      expect(instance.maxSize).toBe(1000); // デフォルトサイズ
      expect(instance.hitCount).toBe(0);
      expect(instance.missCount).toBe(0);
      expect(instance.logger).toBe(mockLogger);
      expect(instance.eventEmitter).toBe(mockEventEmitter);
      // 初期化イベントも確認
      expectStandardizedEventEmitted(mockEventEmitter, 'cache', 'system_initialized', {
        ttlMs: 300000,
        maxSize: 1000,
        timestamp: 'any',
        traceId: expect.any(String),
        requestId: expect.any(String),
      });
    });
  });

  describe('get', () => {
    test('キャッシュミス の場合、nullを返し、item_missed イベントを発行する', () => {
      // Arrange
      const key = 'non-existent-key';

      // Act
      const result = cacheManager.get(key);

      // Assert
      expect(result).toBeNull();
      expect(cacheManager.missCount).toBe(1);
      expect(cacheManager.hitCount).toBe(0);
      expectStandardizedEventEmitted(mockEventEmitter, 'cache', 'item_missed', { key, timestamp: 'any' });
    });

    test('キャッシュヒット の場合、値を返し、item_accessed イベントを発行する', () => {
      // Arrange
      const key = 'test-key';
      const value = 'test-value';
      cacheManager.set(key, value);
      mockEventEmitter.emitStandardized.mockClear();

      // Act
      const result = cacheManager.get(key);

      // Assert
      expect(result).toBe(value);
      expect(cacheManager.hitCount).toBe(1);
      expect(cacheManager.missCount).toBe(0);
      expectStandardizedEventEmitted(mockEventEmitter, 'cache', 'item_accessed', { key, timestamp: 'any' });
    });

    test('期限切れの場合、nullを返し、item_expired イベントを発行する', () => {
      // Arrange
      const key = 'test-key';
      const value = 'test-value';
      const ttl = 500;
      cacheManager.set(key, value, ttl);
      mockEventEmitter.emitStandardized.mockClear();

      // 時間を進める (Date.now のモックを更新)
      const expiredTime = MOCK_TIMESTAMP_MS + ttl + 1; // TTL 経過後の時刻
      jest.spyOn(Date, 'now').mockReturnValue(expiredTime);

      // Act
      const result = cacheManager.get(key);

      // Assert
      expect(result).toBeNull();
      expect(cacheManager.missCount).toBe(1); // 期限切れもミスとしてカウントされることを明示
      expect(cacheManager.hitCount).toBe(0);
      expect(cacheManager.cache.has(key)).toBe(false); // キャッシュから削除されていることを確認
      // cache.delete が呼ばれたことの確認は、内部実装への依存度が高いため省略
      expectStandardizedEventEmitted(mockEventEmitter, 'cache', 'item_expired', { key, ttl, timestamp: 'any' });
    });
  });

  describe('set', () => {
    test('キャッシュにデータを設定し、item_set イベントを発行する', () => {
      // Arrange
      const key = 'test-key';
      const value = 'test-value';

      // Act
      cacheManager.set(key, value);

      // Assert
      expect(cacheManager.cache.has(key)).toBe(true);
      const cached = cacheManager.cache.get(key);
      expect(cached.value).toBe(value);
      expect(cached.timestamp).toBe(MOCK_TIMESTAMP_MS);
      expect(cached.ttl).toBe(1000);
      expectStandardizedEventEmitted(mockEventEmitter, 'cache', 'item_set', { key, ttl: 1000, timestamp: 'any' });
    });

    test('カスタムTTLでデータを設定し、item_set イベントを発行する', () => {
      // Arrange
      const key = 'test-key';
      const value = 'test-value';
      const customTtl = 5000;

      // Act
      cacheManager.set(key, value, customTtl);

      // Assert
      const cached = cacheManager.cache.get(key);
      expect(cached.ttl).toBe(customTtl);
      expectStandardizedEventEmitted(mockEventEmitter, 'cache', 'item_set', { key, ttl: customTtl, timestamp: 'any' });
    });

    test('キャッシュサイズが上限に達した場合、最も古いエントリを削除し、item_evicted イベントを発行する', () => {
      // Arrange
      cacheManager.maxSize = 2;
      const initialTimestamp = MOCK_TIMESTAMP_MS;
      cacheManager.set('key1', 'value1'); // 1つ目

      const secondTimestamp = initialTimestamp + 100;
      jest.spyOn(Date, 'now').mockReturnValue(secondTimestamp);
      cacheManager.set('key2', 'value2'); // 2つ目
      mockEventEmitter.emitStandardized.mockClear();

      // Act: 3つ目を追加 (key1が削除されるはず)
      const thirdTimestamp = secondTimestamp + 100;
      jest.spyOn(Date, 'now').mockReturnValue(thirdTimestamp);
      cacheManager.set('key3', 'value3');

      // Assert
      expect(cacheManager.cache.size).toBe(2);
      expect(cacheManager.cache.has('key1')).toBe(false);
      expect(cacheManager.cache.has('key2')).toBe(true);
      expect(cacheManager.cache.has('key3')).toBe(true);
      expectStandardizedEventEmitted(mockEventEmitter, 'cache', 'item_evicted', { key: 'key1', timestamp: 'any' });
      expectStandardizedEventEmitted(mockEventEmitter, 'cache', 'item_set', { key: 'key3', ttl: 1000, timestamp: 'any' });
    });

    test('キャッシュサイズが上限ちょうどの場合、新しいエントリを追加し、最も古いエントリを削除する', () => {
        // Arrange
        cacheManager.maxSize = 2;
        const initialTimestamp = MOCK_TIMESTAMP_MS;
        cacheManager.set('key1', 'value1'); // 1つ目
        const secondTimestamp = initialTimestamp + 100;
        jest.spyOn(Date, 'now').mockReturnValue(secondTimestamp);
        cacheManager.set('key2', 'value2'); // 2つ目 (これで上限)
        mockEventEmitter.emitStandardized.mockClear();

        // Act: 3つ目を追加 (key1が削除されるはず)
        const thirdTimestamp = secondTimestamp + 100;
        jest.spyOn(Date, 'now').mockReturnValue(thirdTimestamp);
        cacheManager.set('key3', 'value3');

        // Assert
        expect(cacheManager.cache.size).toBe(2);
        expect(cacheManager.cache.has('key1')).toBe(false);
        expect(cacheManager.cache.has('key2')).toBe(true);
        expect(cacheManager.cache.has('key3')).toBe(true);
        expectStandardizedEventEmitted(mockEventEmitter, 'cache', 'item_evicted', { key: 'key1', timestamp: 'any' });
        expectStandardizedEventEmitted(mockEventEmitter, 'cache', 'item_set', { key: 'key3', ttl: 1000, timestamp: 'any' });
      });
  });

  describe('invalidate', () => {
    test('文字列パターン に一致するキャッシュを無効化し、items_invalidated イベントを発行する', () => {
      // Arrange
      cacheManager.set('user:123', 'user data');
      cacheManager.set('user:456', 'user data');
      cacheManager.set('product:789', 'product data');
      mockEventEmitter.emitStandardized.mockClear();

      // Act
      const count = cacheManager.invalidate('user:');

      // Assert
      expect(count).toBe(2);
      expect(cacheManager.cache.has('user:123')).toBe(false);
      expect(cacheManager.cache.has('user:456')).toBe(false);
      expect(cacheManager.cache.has('product:789')).toBe(true);
      expectStandardizedEventEmitted(mockEventEmitter, 'cache', 'items_invalidated', { pattern: 'user:', count: 2, timestamp: 'any' });
    });

    test('正規表現パターン に一致するキャッシュを無効化し、items_invalidated イベントを発行する', () => {
      // Arrange
      cacheManager.set('user:123', 'user data');
      cacheManager.set('user:456', 'user data');
      cacheManager.set('product:789', 'product data');
      mockEventEmitter.emitStandardized.mockClear();

      // Act
      const count = cacheManager.invalidate(/^user:/);

      // Assert
      expect(count).toBe(2);
      expect(cacheManager.cache.has('user:123')).toBe(false);
      expect(cacheManager.cache.has('user:456')).toBe(false);
      expect(cacheManager.cache.has('product:789')).toBe(true);
      expectStandardizedEventEmitted(mockEventEmitter, 'cache', 'items_invalidated', { pattern: '/^user:/', count: 2, timestamp: 'any' });
    });

    test('一致しないパターン の場合、何も無効化せず、イベントも発行しない (count=0)', () => {
      // Arrange
      cacheManager.set('user:123', 'user data');
      mockEventEmitter.emitStandardized.mockClear();

      // Act
      const count = cacheManager.invalidate('product:');

      // Assert
      expect(count).toBe(0);
      expect(cacheManager.cache.has('user:123')).toBe(true);
      expect(mockEventEmitter.emitStandardized).not.toHaveBeenCalled();
    });

    test.each([null, undefined, 123, {}])('不正なパターン (%p) を渡した場合、警告ログを出力し 0 を返す', (invalidPattern) => {
        // Arrange
        cacheManager.set('user:123', 'user data');
        mockEventEmitter.emitStandardized.mockClear();

        // Act
        const count = cacheManager.invalidate(invalidPattern);

        // Assert
        expect(count).toBe(0);
        expect(mockLogger.warn).toHaveBeenCalledWith(
            'Invalid keyPattern provided to invalidate. Must be a string or RegExp.',
            { keyPattern: invalidPattern }
        );
        expect(cacheManager.cache.has('user:123')).toBe(true); // キャッシュは変更されない
        expect(mockEventEmitter.emitStandardized).not.toHaveBeenCalled(); // イベントは発行されない
    });

    test('RegExp コンストラクタでエラーになるパターンを渡した場合、エラーログを出力し 0 を返す', () => {
       // Arrange
       const invalidStringPattern = '[invalidRegex'; // 不正な正規表現文字列
       cacheManager.set('user:123', 'user data');
       mockEventEmitter.emitStandardized.mockClear();

       // Act
       const count = cacheManager.invalidate(invalidStringPattern);

       // Assert
       expect(count).toBe(0); // count が 0 であることを確認
       // エラーログが出力されることを確認 (実装に合わせて修正)
       expect(mockLogger.error).toHaveBeenCalledWith(
          `キャッシュ無効化中にエラーが発生しました (パターン: ${invalidStringPattern})`,
          expect.any(SyntaxError) // エラーオブジェクトのみが渡される
       );
       expect(cacheManager.cache.has('user:123')).toBe(true); // キャッシュは変更されない
       expect(mockEventEmitter.emitStandardized).not.toHaveBeenCalled(); // イベントは発行されない
    });
  });

  describe('clear', () => {
    test('すべてのキャッシュをクリアし、cleared イベントを発行する', () => {
      // Arrange
      cacheManager.set('key1', 'value1');
      cacheManager.set('key2', 'value2');
      mockEventEmitter.emitStandardized.mockClear();

      // Act
      cacheManager.clear();

      // Assert
      expect(cacheManager.cache.size).toBe(0);
      expectStandardizedEventEmitted(mockEventEmitter, 'cache', 'cleared', { count: 2, timestamp: 'any' });
    });

    test('キャッシュが空の場合、イベントは発行されない', () => {
      // Arrange (キャッシュは空)
      mockEventEmitter.emitStandardized.mockClear();

      // Act
      cacheManager.clear();

      // Assert
      expect(cacheManager.cache.size).toBe(0);
      expect(mockEventEmitter.emitStandardized).not.toHaveBeenCalled();
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
      expect(stats).toEqual({ size: 1, maxSize: 10, hitCount: 1, missCount: 1, hitRate: 0.5 });
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
    test('最も古いエントリを削除し、item_evicted イベントを発行する', () => {
      // Arrange
      const initialTimestamp = MOCK_TIMESTAMP_MS;
      cacheManager.set('key1', 'value1'); // 古い方
      const secondTimestamp = initialTimestamp + 100;
      jest.spyOn(Date, 'now').mockReturnValue(secondTimestamp);
      cacheManager.set('key2', 'value2'); // 新しい方
      mockEventEmitter.emitStandardized.mockClear();

      // Act
      cacheManager._evictOldest(); // key1 が削除されるはず

      // Assert
      expect(cacheManager.cache.has('key1')).toBe(false);
      expect(cacheManager.cache.has('key2')).toBe(true);
      expectStandardizedEventEmitted(mockEventEmitter, 'cache', 'item_evicted', { key: 'key1', timestamp: 'any' });
    });

    test('キャッシュが空の場合、何も削除せず、イベントも発行しない', () => {
      // Arrange (キャッシュは空)
      mockEventEmitter.emitStandardized.mockClear();

      // Act
      cacheManager._evictOldest();

      // Assert
      expect(mockEventEmitter.emitStandardized).not.toHaveBeenCalled();
    });
  });
});

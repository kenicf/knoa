/**
 * キャッシュマネージャークラスのテスト
 */

const CacheManager = require('../../../src/lib/utils/cache-manager');
const {
  createMockLogger,
  createMockEventEmitter, // Use the updated factory
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
  // Get expected IDs from the mock factory setup (or define them consistently)
  // Remove global expected IDs - they will be generated per test using the instance
  // const mockDeps = require('../../helpers/mock-factory').createMockDependencies();
  // const EXPECTED_TRACE_ID = mockDeps.eventEmitter._traceIdGenerator();
  // const EXPECTED_REQUEST_ID = mockDeps.eventEmitter._requestIdGenerator();

  // --- Constructor Test ---
  // beforeEach の外で constructor のイベント発行をテスト
  test('constructor: 初期化時に system_initialized イベントを発行する', () => {
    // Arrange
    const logger = createMockLogger();
    // Use the updated factory that returns a spied instance
    const eventEmitter = createMockEventEmitter();
    mockTimestamp(MOCK_TIMESTAMP_ISO); // 時刻モックを設定
    // Get expected IDs directly from the emitter instance used in this test
    // const expectedTraceId = eventEmitter._traceIdGenerator(); // 削除
    // const expectedRequestId = eventEmitter._requestIdGenerator(); // 削除

    // Act
    new CacheManager({
      logger,
      eventEmitter,
      ttlMs: 5000,
      maxSize: 50,
    });

    // Assert
    // Re-add traceId and requestId expectations using the obtained IDs
    expectStandardizedEventEmitted(
      eventEmitter,
      'cache',
      'system_initialized',
      {
        ttlMs: 5000,
        maxSize: 50,
        timestamp: 'any',
        traceId: expect.any(String), // expect.any(String) に変更
        requestId: expect.any(String), // expect.any(String) に変更
      }
    );
    jest.restoreAllMocks(); // このテストケース用のモックを解除
  });

  beforeEach(() => {
    // Arrange (Common setup for most tests)
    mockEventEmitter = createMockEventEmitter(); // Use the updated factory
    mockLogger = createMockLogger();

    // 時間関連のモック
    mockTimestamp(MOCK_TIMESTAMP_ISO); // 各テスト前に時刻をモック
    jest.spyOn(Date, 'now').mockReturnValue(MOCK_TIMESTAMP_MS);

    // CacheManagerのインスタンスを作成
    cacheManager = new CacheManager({
      eventEmitter: mockEventEmitter,
      logger: mockLogger,
      ttlMs: 1000, // テストしやすいように短く設定
      maxSize: 10,
    });
  });

  afterEach(() => {
    // 各テスト後にすべてのモックをリストア
    jest.restoreAllMocks();
  });

  describe('constructor (Instance checks)', () => {
    test('logger がないとエラーをスローする', () => {
      // Assert
      expect(
        () => new CacheManager({ eventEmitter: createMockEventEmitter() }) // Use factory here too
      ).toThrow('Logger and EventEmitter instances are required');
    });

    test('eventEmitter がないとエラーをスローする', () => {
      // Assert
      expect(() => new CacheManager({ logger: mockLogger })).toThrow(
        'Logger and EventEmitter instances are required'
      );
    });

    test('カスタム値で初期化される', () => {
      // Arrange
      const customLogger = createMockLogger();
      const customEventEmitter = createMockEventEmitter(); // Use factory

      // Act
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

    test('オプションなしの場合、デフォルト値で初期化される (logger, eventEmitter は必須)', () => {
      // Arrange & Act
      const instance = new CacheManager({
        logger: mockLogger,
        eventEmitter: mockEventEmitter,
      });

      // Assert
      expect(instance.cache).toBeInstanceOf(Map);
      expect(instance.ttlMs).toBe(300000); // デフォルトTTL
      expect(instance.maxSize).toBe(1000); // デフォルトサイズ
      expect(instance.hitCount).toBe(0);
      expect(instance.missCount).toBe(0);
      expect(instance.logger).toBe(mockLogger);
      expect(instance.eventEmitter).toBe(mockEventEmitter);
    });
  });

  describe('get', () => {
    test('should return null and emit item_missed event for cache miss', () => {
      // Arrange
      const key = 'non-existent-key';
      // const expectedTraceId = mockEventEmitter._traceIdGenerator(); // 削除
      // const expectedRequestId = mockEventEmitter._requestIdGenerator(); // 削除

      // Act
      const result = cacheManager.get(key);

      // Assert
      expect(result).toBeNull();
      expect(cacheManager.missCount).toBe(1);
      expect(cacheManager.hitCount).toBe(0);
      // Re-add traceId and requestId expectations
      expectStandardizedEventEmitted(mockEventEmitter, 'cache', 'item_missed', {
        key,
        timestamp: 'any',
        traceId: expect.any(String), // expect.any(String) に変更
        requestId: expect.any(String), // expect.any(String) に変更
      });
    });

    test('should return value and emit item_accessed event for cache hit', () => {
      // Arrange
      const key = 'test-key';
      const value = 'test-value';
      cacheManager.set(key, value);
      mockEventEmitter.emitStandardized.mockClear(); // Clear set event
      // const expectedTraceId = mockEventEmitter._traceIdGenerator(); // 削除
      // const expectedRequestId = mockEventEmitter._requestIdGenerator(); // 削除

      // Act
      const result = cacheManager.get(key);

      // Assert
      expect(result).toBe(value);
      expect(cacheManager.hitCount).toBe(1);
      expect(cacheManager.missCount).toBe(0);
      // Re-add traceId and requestId expectations
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'cache',
        'item_accessed',
        {
          key,
          timestamp: 'any',
          traceId: expect.any(String), // expect.any(String) に変更
          requestId: expect.any(String), // expect.any(String) に変更
        }
      );
    });

    test('should return null and emit item_expired event for expired cache', () => {
      // Arrange
      const key = 'test-key';
      const value = 'test-value';
      const ttl = 500;
      cacheManager.set(key, value, ttl);
      mockEventEmitter.emitStandardized.mockClear(); // Clear set event
      // const expectedTraceId = mockEventEmitter._traceIdGenerator(); // 削除
      // const expectedRequestId = mockEventEmitter._requestIdGenerator(); // 削除

      // Act: Advance time beyond TTL
      const expiredTime = MOCK_TIMESTAMP_MS + ttl + 1;
      jest.spyOn(Date, 'now').mockReturnValue(expiredTime);
      const result = cacheManager.get(key);

      // Assert
      expect(result).toBeNull();
      expect(cacheManager.missCount).toBe(1);
      expect(cacheManager.hitCount).toBe(0);
      expect(cacheManager.cache.has(key)).toBe(false);
      // Re-add traceId and requestId expectations
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'cache',
        'item_expired',
        {
          key,
          ttl,
          timestamp: 'any',
          traceId: expect.any(String), // expect.any(String) に変更
          requestId: expect.any(String), // expect.any(String) に変更
        }
      );
    });
  });

  describe('set', () => {
    test('should set data in cache and emit item_set event', () => {
      // Arrange
      const key = 'test-key';
      const value = 'test-value';
      // const expectedTraceId = mockEventEmitter._traceIdGenerator(); // 削除
      // const expectedRequestId = mockEventEmitter._requestIdGenerator(); // 削除

      // Act
      cacheManager.set(key, value);

      // Assert
      expect(cacheManager.cache.has(key)).toBe(true);
      const cached = cacheManager.cache.get(key);
      expect(cached.value).toBe(value);
      expect(cached.timestamp).toBe(MOCK_TIMESTAMP_MS);
      expect(cached.ttl).toBe(1000); // Default TTL from beforeEach
      // Re-add traceId and requestId expectations
      expectStandardizedEventEmitted(mockEventEmitter, 'cache', 'item_set', {
        key,
        ttl: 1000,
        timestamp: 'any',
        traceId: expect.any(String), // expect.any(String) に変更
        requestId: expect.any(String), // expect.any(String) に変更
      });
    });

    test('should set data with custom TTL and emit item_set event', () => {
      // Arrange
      const key = 'test-key';
      const value = 'test-value';
      const customTtl = 5000;
      // const expectedTraceId = mockEventEmitter._traceIdGenerator(); // 削除
      // const expectedRequestId = mockEventEmitter._requestIdGenerator(); // 削除

      // Act
      cacheManager.set(key, value, customTtl);

      // Assert
      const cached = cacheManager.cache.get(key);
      expect(cached.ttl).toBe(customTtl);
      // Re-add traceId and requestId expectations
      expectStandardizedEventEmitted(mockEventEmitter, 'cache', 'item_set', {
        key,
        ttl: customTtl,
        timestamp: 'any',
        traceId: expect.any(String), // expect.any(String) に変更
        requestId: expect.any(String), // expect.any(String) に変更
      });
    });

    test('should evict oldest entry and emit item_evicted event when cache size exceeds limit', () => {
      // Arrange
      cacheManager.maxSize = 2;
      const initialTimestamp = MOCK_TIMESTAMP_MS;
      cacheManager.set('key1', 'value1'); // Oldest

      const secondTimestamp = initialTimestamp + 100;
      jest.spyOn(Date, 'now').mockReturnValue(secondTimestamp);
      cacheManager.set('key2', 'value2');
      mockEventEmitter.emitStandardized.mockClear(); // Clear previous set events
      // const expectedTraceIdEvict = mockEventEmitter._traceIdGenerator(); // 削除
      // const expectedRequestIdEvict = mockEventEmitter._requestIdGenerator(); // 削除
      // const expectedTraceIdSet = mockEventEmitter._traceIdGenerator(); // 削除
      // const expectedRequestIdSet = mockEventEmitter._requestIdGenerator(); // 削除

      // Act: Add third item, exceeding maxSize
      const thirdTimestamp = secondTimestamp + 100;
      jest.spyOn(Date, 'now').mockReturnValue(thirdTimestamp);
      cacheManager.set('key3', 'value3');

      // Assert
      expect(cacheManager.cache.size).toBe(2);
      expect(cacheManager.cache.has('key1')).toBe(false); // Evicted
      expect(cacheManager.cache.has('key2')).toBe(true);
      expect(cacheManager.cache.has('key3')).toBe(true);
      // Re-add traceId and requestId expectations
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'cache',
        'item_evicted',
        {
          key: 'key1',
          timestamp: 'any',
          traceId: expect.any(String), // expect.any(String) に変更
          requestId: expect.any(String), // expect.any(String) に変更
        }
      );
      expectStandardizedEventEmitted(mockEventEmitter, 'cache', 'item_set', {
        key: 'key3',
        ttl: 1000,
        timestamp: 'any',
        traceId: expect.any(String), // expect.any(String) に変更
        requestId: expect.any(String), // expect.any(String) に変更
      });
    });

    test('should evict oldest entry when adding new item at max size', () => {
      // Arrange
      cacheManager.maxSize = 2;
      const initialTimestamp = MOCK_TIMESTAMP_MS;
      cacheManager.set('key1', 'value1'); // Oldest
      const secondTimestamp = initialTimestamp + 100;
      jest.spyOn(Date, 'now').mockReturnValue(secondTimestamp);
      cacheManager.set('key2', 'value2'); // Cache is now full
      mockEventEmitter.emitStandardized.mockClear();
      // const expectedTraceIdEvict = mockEventEmitter._traceIdGenerator(); // 削除
      // const expectedRequestIdEvict = mockEventEmitter._requestIdGenerator(); // 削除
      // const expectedTraceIdSet = mockEventEmitter._traceIdGenerator(); // 削除
      // const expectedRequestIdSet = mockEventEmitter._requestIdGenerator(); // 削除

      // Act: Add third item
      const thirdTimestamp = secondTimestamp + 100;
      jest.spyOn(Date, 'now').mockReturnValue(thirdTimestamp);
      cacheManager.set('key3', 'value3');

      // Assert
      expect(cacheManager.cache.size).toBe(2);
      expect(cacheManager.cache.has('key1')).toBe(false); // Evicted
      expect(cacheManager.cache.has('key2')).toBe(true);
      expect(cacheManager.cache.has('key3')).toBe(true);
      // Re-add traceId and requestId expectations
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'cache',
        'item_evicted',
        {
          key: 'key1',
          timestamp: 'any',
          traceId: expect.any(String), // expect.any(String) に変更
          requestId: expect.any(String), // expect.any(String) に変更
        }
      );
      expectStandardizedEventEmitted(mockEventEmitter, 'cache', 'item_set', {
        key: 'key3',
        ttl: 1000,
        timestamp: 'any',
        traceId: expect.any(String), // expect.any(String) に変更
        requestId: expect.any(String), // expect.any(String) に変更
      });
    });
  });

  describe('invalidate', () => {
    test('should invalidate cache matching string pattern and emit items_invalidated event', () => {
      // Arrange
      cacheManager.set('user:123', 'user data');
      cacheManager.set('user:456', 'user data');
      cacheManager.set('product:789', 'product data');
      mockEventEmitter.emitStandardized.mockClear();
      // const expectedTraceId = mockEventEmitter._traceIdGenerator(); // 削除
      // const expectedRequestId = mockEventEmitter._requestIdGenerator(); // 削除

      // Act
      const count = cacheManager.invalidate('user:');

      // Assert
      expect(count).toBe(2);
      expect(cacheManager.cache.has('user:123')).toBe(false);
      expect(cacheManager.cache.has('user:456')).toBe(false);
      expect(cacheManager.cache.has('product:789')).toBe(true);
      // Re-add traceId and requestId expectations
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'cache',
        'items_invalidated',
        {
          pattern: 'user:',
          count: 2,
          timestamp: 'any',
          traceId: expect.any(String), // expect.any(String) に変更
          requestId: expect.any(String), // expect.any(String) に変更
        }
      );
    });

    test('should invalidate cache matching regex pattern and emit items_invalidated event', () => {
      // Arrange
      cacheManager.set('user:123', 'user data');
      cacheManager.set('user:456', 'user data');
      cacheManager.set('product:789', 'product data');
      mockEventEmitter.emitStandardized.mockClear();
      // const expectedTraceId = mockEventEmitter._traceIdGenerator(); // 削除
      // const expectedRequestId = mockEventEmitter._requestIdGenerator(); // 削除

      // Act
      const count = cacheManager.invalidate(/^user:/);

      // Assert
      expect(count).toBe(2);
      expect(cacheManager.cache.has('user:123')).toBe(false);
      expect(cacheManager.cache.has('user:456')).toBe(false);
      expect(cacheManager.cache.has('product:789')).toBe(true);
      // Re-add traceId and requestId expectations
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'cache',
        'items_invalidated',
        {
          pattern: '/^user:/',
          count: 2,
          timestamp: 'any',
          traceId: expect.any(String), // expect.any(String) に変更
          requestId: expect.any(String), // expect.any(String) に変更
        }
      );
    });

    test('should not invalidate or emit event if pattern does not match', () => {
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

    // --- Invalid pattern tests (split from test.each) ---
    test('should log warning and return 0 for null pattern', () => {
      // Arrange
      const invalidPattern = null;
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
      expect(cacheManager.cache.has('user:123')).toBe(true);
      expect(mockEventEmitter.emitStandardized).not.toHaveBeenCalled();
    });
    test('should log warning and return 0 for undefined pattern', () => {
      // Arrange
      const invalidPattern = undefined;
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
      expect(cacheManager.cache.has('user:123')).toBe(true);
      expect(mockEventEmitter.emitStandardized).not.toHaveBeenCalled();
    });
    test('should log warning and return 0 for number pattern', () => {
      // Arrange
      const invalidPattern = 123;
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
      expect(cacheManager.cache.has('user:123')).toBe(true);
      expect(mockEventEmitter.emitStandardized).not.toHaveBeenCalled();
    });
    test('should log warning and return 0 for object pattern', () => {
      // Arrange
      const invalidPattern = {};
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
      expect(cacheManager.cache.has('user:123')).toBe(true);
      expect(mockEventEmitter.emitStandardized).not.toHaveBeenCalled();
    });
    // --- End of split tests ---

    test('should log error and return 0 if RegExp constructor fails', () => {
      // Arrange
      const invalidStringPattern = '[invalidRegex'; // Invalid regex string
      cacheManager.set('user:123', 'user data');
      mockEventEmitter.emitStandardized.mockClear();

      // Act
      const count = cacheManager.invalidate(invalidStringPattern);

      // Assert
      expect(count).toBe(0);
      expect(mockLogger.error).toHaveBeenCalledWith(
        `キャッシュ無効化中にエラーが発生しました (パターン: ${invalidStringPattern})`,
        expect.any(SyntaxError)
      );
      expect(cacheManager.cache.has('user:123')).toBe(true);
      expect(mockEventEmitter.emitStandardized).not.toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    test('should clear all cache entries and emit cleared event', () => {
      // Arrange
      cacheManager.set('key1', 'value1');
      cacheManager.set('key2', 'value2');
      mockEventEmitter.emitStandardized.mockClear();
      // const expectedTraceId = mockEventEmitter._traceIdGenerator(); // 削除
      // const expectedRequestId = mockEventEmitter._requestIdGenerator(); // 削除

      // Act
      cacheManager.clear();

      // Assert
      expect(cacheManager.cache.size).toBe(0);
      // Re-add traceId and requestId expectations
      expectStandardizedEventEmitted(mockEventEmitter, 'cache', 'cleared', {
        count: 2,
        timestamp: 'any',
        traceId: expect.any(String), // expect.any(String) に変更
        requestId: expect.any(String), // expect.any(String) に変更
      });
    });

    test('should not emit event if cache is already empty', () => {
      // Arrange (Cache is empty)
      mockEventEmitter.emitStandardized.mockClear();

      // Act
      cacheManager.clear();

      // Assert
      expect(cacheManager.cache.size).toBe(0);
      expect(mockEventEmitter.emitStandardized).not.toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    test('should return correct cache statistics', () => {
      // Arrange
      cacheManager.set('key1', 'value1');
      cacheManager.get('key1'); // Hit
      cacheManager.get('key2'); // Miss

      // Act
      const stats = cacheManager.getStats();

      // Assert
      expect(stats).toEqual({
        size: 1,
        maxSize: 10,
        hitCount: 1,
        missCount: 1,
        hitRate: 0.5,
      });
    });

    test('should return hitRate 0 if no requests were made', () => {
      // Arrange
      cacheManager.set('key1', 'value1');

      // Act
      const stats = cacheManager.getStats();

      // Assert
      expect(stats.hitRate).toBe(0);
      expect(stats.hitCount).toBe(0);
      expect(stats.missCount).toBe(0);
    });
  });

  describe('_evictOldest', () => {
    test('should remove the oldest entry and emit item_evicted event', () => {
      // Arrange
      const initialTimestamp = MOCK_TIMESTAMP_MS;
      cacheManager.set('key1', 'value1'); // Oldest
      const secondTimestamp = initialTimestamp + 100;
      jest.spyOn(Date, 'now').mockReturnValue(secondTimestamp);
      cacheManager.set('key2', 'value2'); // Newest
      mockEventEmitter.emitStandardized.mockClear();
      // const expectedTraceId = mockEventEmitter._traceIdGenerator(); // 削除
      // const expectedRequestId = mockEventEmitter._requestIdGenerator(); // 削除

      // Act
      cacheManager._evictOldest(); // Should remove key1

      // Assert
      expect(cacheManager.cache.has('key1')).toBe(false);
      expect(cacheManager.cache.has('key2')).toBe(true);
      // Re-add traceId and requestId expectations
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'cache',
        'item_evicted',
        {
          key: 'key1',
          timestamp: 'any',
          traceId: expect.any(String), // expect.any(String) に変更
          requestId: expect.any(String), // expect.any(String) に変更
        }
      );
    });

    test('should do nothing and not emit event if cache is empty', () => {
      // Arrange (Cache is empty)
      mockEventEmitter.emitStandardized.mockClear();

      // Act
      cacheManager._evictOldest();

      // Assert
      expect(mockEventEmitter.emitStandardized).not.toHaveBeenCalled();
    });
  });
});

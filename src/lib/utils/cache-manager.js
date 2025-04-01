/**
 * キャッシュ管理クラス
 *
 * パフォーマンスを向上させるためのキャッシュ機能を提供します。
 */

// TODO: Step 5 で emitStandardizedEvent ヘルパーを利用するか検討
// const { emitStandardizedEvent } = require('./event-helpers');

/**
 * キャッシュマネージャークラス
 */
class CacheManager {
  /**
   * コンストラクタ
   * @param {Object} options - オプション
   * @param {Object} options.logger - ロガーインスタンス (必須)
   * @param {Object} options.eventEmitter - イベントエミッターインスタンス (必須)
   * @param {number} [options.ttlMs=300000] - デフォルトTTL (ミリ秒)
   * @param {number} [options.maxSize=1000] - 最大キャッシュサイズ
   * @param {Function} [options.traceIdGenerator] - トレースID生成関数 ★★★ 追加 ★★★
   * @param {Function} [options.requestIdGenerator] - リクエストID生成関数 ★★★ 追加 ★★★
   */
  constructor(options = {}) {
    // 依存関係の設定 (必須化)
    if (!options.logger || !options.eventEmitter) {
      throw new Error(
        'Logger and EventEmitter instances are required in CacheManager options.'
      );
    }
    this.logger = options.logger;
    this.eventEmitter = options.eventEmitter;

    // キャッシュ設定
    this.cache = new Map();
    this.ttlMs = options.ttlMs || 300000; // デフォルト5分
    this.maxSize = options.maxSize || 1000; // 最大キャッシュサイズ
    this.hitCount = 0;
    this.missCount = 0;

    // ★★★ ID ジェネレーターを保存 ★★★
    this._traceIdGenerator =
      options.traceIdGenerator ||
      (() => `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    this._requestIdGenerator =
      options.requestIdGenerator ||
      (() => `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

    // キャッシュ初期化イベント
    // emitStandardized を直接呼び出すように変更
    // ★★★ _emitEvent を使うように変更 ★★★
    this._emitEvent('system_initialized', {
      ttlMs: this.ttlMs,
      maxSize: this.maxSize,
    });
  }

  /**
   * キャッシュからデータを取得
   * @param {string} key - キー
   * @returns {*} 値（存在しない場合はnull）
   */
  get(key) {
    const cached = this.cache.get(key);
    if (!cached) {
      this.missCount++;

      // cache:miss イベントを標準化
      this._emitEvent('item_missed', { key }); // ★★★ _emitEvent を使用 ★★★

      return null;
    }

    // TTLチェック (エントリ固有のTTLを使用)
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      this.missCount++;

      // cache:expired イベントを標準化
      this._emitEvent('item_expired', {
        // ★★★ _emitEvent を使用 ★★★
        key,
        ttl: cached.ttl, // エントリ固有のTTLを使用
      });

      return null;
    }

    this.hitCount++;

    // cache:hit イベントを標準化 (item_accessed)
    this._emitEvent('item_accessed', { key }); // ★★★ _emitEvent を使用 ★★★

    return cached.value;
  }

  /**
   * キャッシュにデータを設定
   * @param {string} key - キー
   * @param {*} value - 値
   * @param {number} [ttl] - このエントリの特定のTTL（ミリ秒）
   */
  set(key, value, ttl = this.ttlMs) {
    // キャッシュサイズチェック
    // ★★★ set する前にチェックし、evict してから set する ★★★
    if (!this.cache.has(key) && this.cache.size >= this.maxSize) {
      this._evictOldest();
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl,
    });

    // cache:set イベントを標準化 (item_set)
    this._emitEvent('item_set', { key, ttl }); // ★★★ _emitEvent を使用 ★★★
  }

  /**
   * 特定パターンに一致するキーのキャッシュを無効化
   * @param {string|RegExp} keyPattern - キーパターン
   * @returns {number} 無効化されたエントリ数
   */
  invalidate(keyPattern) {
    // keyPattern の型チェックを追加
    if (typeof keyPattern !== 'string' && !(keyPattern instanceof RegExp)) {
      this.logger.warn(
        'Invalid keyPattern provided to invalidate. Must be a string or RegExp.',
        { keyPattern }
      );
      return 0;
    }

    let count = 0;
    try {
      const pattern =
        keyPattern instanceof RegExp
          ? keyPattern
          : // eslint-disable-next-line security/detect-non-literal-regexp
            new RegExp(keyPattern);

      for (const key of this.cache.keys()) {
        // pattern.test に文字列以外が渡される可能性を考慮 (より安全に)
        if (typeof key === 'string' && pattern.test(key)) {
          this.cache.delete(key);
          count++;
        }
      }
    } catch (error) {
      // RegExp コンストラクタや test メソッドでエラーが発生した場合
      this.logger.error(
        `キャッシュ無効化中にエラーが発生しました (パターン: ${keyPattern})`,
        error
      );
      return 0; // エラー時は 0 を返す
    }

    if (count > 0) {
      // cache:invalidated イベントを標準化 (items_invalidated)
      // keyPattern が安全に文字列化できる場合のみ pattern プロパティを設定
      const patternString =
        typeof keyPattern === 'string' || keyPattern instanceof RegExp
          ? keyPattern.toString()
          : '[Invalid Pattern]';
      this._emitEvent('items_invalidated', {
        // ★★★ _emitEvent を使用 ★★★
        pattern: patternString,
        count,
      });
    }

    return count;
  }

  /**
   * すべてのキャッシュをクリア
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();

    if (size > 0) {
      // cache:cleared イベントを標準化
      this._emitEvent('cleared', { count: size }); // ★★★ _emitEvent を使用 ★★★
    }
  }

  /**
   * キャッシュの統計情報を取得
   * @returns {Object} 統計情報
   */
  getStats() {
    const totalRequests = this.hitCount + this.missCount;
    const hitRate = totalRequests > 0 ? this.hitCount / totalRequests : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: hitRate,
    };
  }

  /**
   * 最も古いエントリを削除
   * @private
   */
  _evictOldest() {
    let oldestKey = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);

      // cache:evicted イベントを標準化 (item_evicted)
      this._emitEvent('item_evicted', { key: oldestKey }); // ★★★ _emitEvent を使用 ★★★
    }
  }

  /**
   * イベントを発行
   * @param {string} eventName - イベント名 (例: 'item_missed')
   * @param {Object} data - イベントデータ
   * @private
   */
  _emitEvent(eventName, data) {
    // ★★★ _emitEvent を追加 ★★★
    if (
      !this.eventEmitter ||
      typeof this.eventEmitter.emitStandardized !== 'function'
    ) {
      return;
    }

    try {
      // ID ジェネレーターを使用して ID を生成
      const traceId = this._traceIdGenerator();
      const requestId = this._requestIdGenerator();

      const standardizedData = {
        ...data,
        timestamp: new Date().toISOString(),
        traceId,
        requestId,
      };

      // Add logging to check event emission
      this.logger.debug(
        `Emitting standardized event: cache:${eventName}`,
        standardizedData
      );

      this.eventEmitter.emitStandardized(
        'cache', // component name
        eventName, // action name
        standardizedData
      );
    } catch (error) {
      this.logger.warn(
        `イベント発行中にエラーが発生しました: cache:${eventName}`,
        error
      );
    }
  }
}

module.exports = CacheManager;

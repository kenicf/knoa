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

    // キャッシュ初期化イベント
    // emitStandardized を直接呼び出すように変更
    this.eventEmitter.emitStandardized('cache', 'system_initialized', {
      ttlMs: this.ttlMs,
      maxSize: this.maxSize,
      // timestamp, traceId, requestId は emitStandardized 内で付与される想定
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
      this.eventEmitter.emitStandardized('cache', 'item_missed', { key });

      return null;
    }

    // TTLチェック (エントリ固有のTTLを使用)
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      this.missCount++;

      // cache:expired イベントを標準化
      this.eventEmitter.emitStandardized('cache', 'item_expired', {
        key,
        ttl: cached.ttl, // エントリ固有のTTLを使用
      });

      return null;
    }

    this.hitCount++;

    // cache:hit イベントを標準化 (item_accessed)
    this.eventEmitter.emitStandardized('cache', 'item_accessed', {
      key,
      // timestamp, traceId, requestId は emitStandardized 内で付与される想定
    });

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
    if (this.cache.size >= this.maxSize) {
      this._evictOldest();
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl,
    });

    // cache:set イベントを標準化 (item_set)
    this.eventEmitter.emitStandardized('cache', 'item_set', {
      key,
      ttl,
      // timestamp, traceId, requestId は emitStandardized 内で付与される想定
    });
  }

  /**
   * 特定パターンに一致するキーのキャッシュを無効化
   * @param {string|RegExp} keyPattern - キーパターン
   * @returns {number} 無効化されたエントリ数
   */
  invalidate(keyPattern) {
    // keyPattern の型チェックを追加
    if (typeof keyPattern !== 'string' && !(keyPattern instanceof RegExp)) {
        this.logger.warn('Invalid keyPattern provided to invalidate. Must be a string or RegExp.', { keyPattern });
        return 0;
    }

    let count = 0;
    try {
      const pattern =
        keyPattern instanceof RegExp ? keyPattern : new RegExp(keyPattern);

      for (const key of this.cache.keys()) {
        // pattern.test に文字列以外が渡される可能性を考慮 (より安全に)
        if (typeof key === 'string' && pattern.test(key)) {
          this.cache.delete(key);
          count++;
        }
      }
    } catch (error) {
       // RegExp コンストラクタや test メソッドでエラーが発生した場合
       this.logger.error(`キャッシュ無効化中にエラーが発生しました (パターン: ${keyPattern})`, error);
       return 0; // エラー時は 0 を返す
    }

    if (count > 0) {
      // cache:invalidated イベントを標準化 (items_invalidated)
      // keyPattern が安全に文字列化できる場合のみ pattern プロパティを設定
      const patternString = (typeof keyPattern === 'string' || keyPattern instanceof RegExp) ? keyPattern.toString() : '[Invalid Pattern]';
      this.eventEmitter.emitStandardized('cache', 'items_invalidated', {
        pattern: patternString,
        count,
        // timestamp, traceId, requestId は emitStandardized 内で付与される想定
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
      this.eventEmitter.emitStandardized('cache', 'cleared', {
        count: size,
        // timestamp, traceId, requestId は emitStandardized 内で付与される想定
      });
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
      this.eventEmitter.emitStandardized('cache', 'item_evicted', {
        key: oldestKey,
        // timestamp, traceId, requestId は emitStandardized 内で付与される想定
      });
    }
  }
}

module.exports = CacheManager;

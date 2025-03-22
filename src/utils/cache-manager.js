/**
 * キャッシュ管理クラス
 * 
 * パフォーマンスを向上させるためのキャッシュ機能を提供します。
 */

/**
 * キャッシュマネージャークラス
 */
class CacheManager {
  /**
   * コンストラクタ
   * @param {Object} options - オプション
   */
  constructor(options = {}) {
    this.cache = new Map();
    this.ttlMs = options.ttlMs || 300000; // デフォルト5分
    this.maxSize = options.maxSize || 1000; // 最大キャッシュサイズ
    this.hitCount = 0;
    this.missCount = 0;
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
      return null;
    }
    
    // TTLチェック
    if (Date.now() - cached.timestamp > this.ttlMs) {
      this.cache.delete(key);
      this.missCount++;
      return null;
    }
    
    this.hitCount++;
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
      ttl
    });
  }
  
  /**
   * 特定パターンに一致するキーのキャッシュを無効化
   * @param {string|RegExp} keyPattern - キーパターン
   * @returns {number} 無効化されたエントリ数
   */
  invalidate(keyPattern) {
    let count = 0;
    const pattern = keyPattern instanceof RegExp ? keyPattern : new RegExp(keyPattern);
    
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }
    
    return count;
  }
  
  /**
   * すべてのキャッシュをクリア
   */
  clear() {
    this.cache.clear();
  }
  
  /**
   * キャッシュの統計情報を取得
   * @returns {Object} 統計情報
   */
  getStats() {
    const totalRequests = this.hitCount + this.missCount;
    const hitRate = totalRequests > 0 ? (this.hitCount / totalRequests) : 0;
    
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: hitRate,
      itemCount: this.cache.size
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
    }
  }
}

module.exports = CacheManager;
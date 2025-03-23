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
    // 依存関係の設定
    this.logger = options.logger || console;
    this.eventEmitter = options.eventEmitter;
    
    // キャッシュ設定
    this.cache = new Map();
    this.ttlMs = options.ttlMs || 300000; // デフォルト5分
    this.maxSize = options.maxSize || 1000; // 最大キャッシュサイズ
    this.hitCount = 0;
    this.missCount = 0;
    
    // キャッシュ初期化イベント
    if (this.eventEmitter) {
      const timestamp = new Date().toISOString();
      const traceId = `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // 新しい標準化されたイベント名を使用
      if (typeof this.eventEmitter.emitStandardized === 'function') {
        this.eventEmitter.emitStandardized('cache', 'system_initialized', {
          ttlMs: this.ttlMs,
          maxSize: this.maxSize,
          timestamp,
          traceId,
          requestId
        });
      } else {
        // 後方互換性のため
        this.eventEmitter.emit('cache:initialized', {
          ttlMs: this.ttlMs,
          maxSize: this.maxSize,
          timestamp
        });
        
        // 開発環境では警告を表示
        if (process.env.NODE_ENV === 'development') {
          console.warn('非推奨のイベント名 cache:initialized が使用されています。代わりに cache:system_initialized を使用してください。');
        }
      }
    }
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
      
      if (this.eventEmitter) {
        this.eventEmitter.emit('cache:miss', { key });
      }
      
      return null;
    }
    
    // TTLチェック
    if (Date.now() - cached.timestamp > this.ttlMs) {
      this.cache.delete(key);
      this.missCount++;
      
      if (this.eventEmitter) {
        this.eventEmitter.emit('cache:expired', { key, ttl: this.ttlMs });
      }
      
      return null;
    }
    
    this.hitCount++;
    
    if (this.eventEmitter) {
      this.eventEmitter.emit('cache:hit', { key });
    }
    
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
    
    if (this.eventEmitter) {
      const timestamp = new Date().toISOString();
      const traceId = `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // 新しい標準化されたイベント名を使用
      if (typeof this.eventEmitter.emitStandardized === 'function') {
        this.eventEmitter.emitStandardized('cache', 'item_set', {
          key,
          ttl,
          timestamp,
          traceId,
          requestId
        });
      } else {
        // 後方互換性のため
        this.eventEmitter.emit('cache:set', {
          key,
          ttl,
          timestamp
        });
        
        // 開発環境では警告を表示
        if (process.env.NODE_ENV === 'development') {
          console.warn('非推奨のイベント名 cache:set が使用されています。代わりに cache:item_set を使用してください。');
        }
      }
    }
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
    
    if (count > 0 && this.eventEmitter) {
      this.eventEmitter.emit('cache:invalidated', {
        pattern: keyPattern.toString(),
        count
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
    
    if (size > 0 && this.eventEmitter) {
      this.eventEmitter.emit('cache:cleared', { size });
    }
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
      
      if (this.eventEmitter) {
        this.eventEmitter.emit('cache:evicted', { key: oldestKey });
      }
    }
  }
}

module.exports = CacheManager;
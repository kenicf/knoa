/**
 * ロック管理クラス
 * 
 * 複数のユーザーやプロセスが同時に操作する場合の競合を解決するためのロック機構を提供します。
 */

const { LockTimeoutError } = require('./errors');

/**
 * ロック管理クラス
 */
class LockManager {
  /**
   * コンストラクタ
   * @param {Object} options - オプション
   */
  constructor(options = {}) {
    this.locks = new Map();
    this.lockTimeout = options.lockTimeout || 30000; // デフォルト30秒
    this.retryInterval = options.retryInterval || 100; // 再試行間隔 100ms
    this.maxRetries = options.maxRetries || 50; // 最大再試行回数
  }
  
  /**
   * リソースのロックを取得
   * @param {string} resourceId - リソースID
   * @param {string} lockerId - ロック取得者ID
   * @param {number} [timeout] - タイムアウト(ms)
   * @returns {Promise<boolean>} ロック取得成功したかどうか
   */
  async acquireLock(resourceId, lockerId, timeout = this.lockTimeout) {
    const startTime = Date.now();
    let retries = 0;
    
    while (Date.now() - startTime < timeout && retries < this.maxRetries) {
      const lockAcquired = this._tryAcquireLock(resourceId, lockerId);
      if (lockAcquired) {
        return true;
      }
      
      retries++;
      await this._sleep(this.retryInterval);
    }
    
    throw new LockTimeoutError(`リソース ${resourceId} のロック取得がタイムアウトしました`);
  }
  
  /**
   * リソースのロックを解放
   * @param {string} resourceId - リソースID
   * @param {string} lockerId - ロック解放者ID
   * @returns {boolean} ロック解放成功したかどうか
   */
  releaseLock(resourceId, lockerId) {
    const lock = this.locks.get(resourceId);
    
    if (!lock) {
      return true; // 既にロックされていない
    }
    
    if (lock.lockerId !== lockerId) {
      throw new Error(`リソース ${resourceId} のロックは別のプロセスが保持しています`);
    }
    
    this.locks.delete(resourceId);
    return true;
  }
  
  /**
   * リソースのロックを試行
   * @param {string} resourceId - リソースID
   * @param {string} lockerId - ロック取得者ID
   * @returns {boolean} ロック取得成功したかどうか
   * @private
   */
  _tryAcquireLock(resourceId, lockerId) {
    const now = Date.now();
    const lock = this.locks.get(resourceId);
    
    // ロックがない、または期限切れの場合は新しいロックを設定
    if (!lock || now - lock.timestamp > this.lockTimeout) {
      this.locks.set(resourceId, {
        lockerId,
        timestamp: now
      });
      return true;
    }
    
    // 同じプロセスによるロックの場合は成功
    if (lock.lockerId === lockerId) {
      // タイムスタンプを更新
      lock.timestamp = now;
      return true;
    }
    
    return false;
  }
  
  /**
   * 指定時間スリープ
   * @param {number} ms - スリープ時間(ms)
   * @returns {Promise<void>}
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * 現在のロック状態を取得
   * @returns {Map} ロック状態
   */
  getLockStatus() {
    const result = new Map();
    const now = Date.now();
    
    for (const [resourceId, lock] of this.locks.entries()) {
      result.set(resourceId, {
        lockerId: lock.lockerId,
        timestamp: lock.timestamp,
        age: now - lock.timestamp,
        isExpired: (now - lock.timestamp) > this.lockTimeout
      });
    }
    
    return result;
  }
}

module.exports = LockManager;
/**
 * ロック管理クラス
 *
 * 複数のユーザーやプロセスが同時に操作する場合の競合を解決するためのロック機構を提供します。
 */

const { TimeoutError } = require('./errors'); // TimeoutError を直接インポート

/**
 * ロック管理クラス
 */
class LockManager {
  /**
   * コンストラクタ
   * @param {Object} options - オプション
   * @param {Object} options.logger - ロガーインスタンス (必須)
   * @param {number} [options.lockTimeout=30000] - デフォルトロックタイムアウト (ミリ秒)
   * @param {number} [options.retryInterval=100] - 再試行間隔 (ミリ秒)
   * @param {number} [options.maxRetries=50] - 最大再試行回数
   */
  constructor(options = {}) {
    // logger を必須にする
    if (!options.logger) {
      throw new Error('Logger instance is required in LockManager options.');
    }
    this.logger = options.logger;
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
        this.logger.debug(
          `Lock acquired for resource: ${resourceId} by ${lockerId}`
        );
        return true;
      }

      retries++;
      this.logger.debug(
        `Retrying lock acquisition for resource: ${resourceId} (Attempt ${retries})`
      );
      await this._sleep(this.retryInterval);
    }

    // TimeoutError を使用し、エラーコードとコンテキストを指定
    const error = new TimeoutError(
      `リソース ${resourceId} のロック取得がタイムアウトしました`,
      {
        code: 'ERR_LOCK_TIMEOUT',
        context: {
          resourceId,
          lockerId,
          timeout,
          errorType: 'LockTimeoutError', // 元のエラータイプをコンテキストに残す
        },
      }
    );
    this.logger.warn(`Lock acquisition timed out for resource: ${resourceId}`, {
      error,
    });
    throw error;
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
      this.logger.debug(
        `Lock not found for resource: ${resourceId}, assuming released.`
      );
      return true; // 既にロックされていない
    }

    if (lock.lockerId !== lockerId) {
      // LockError を使用する方が適切かもしれないが、既存の挙動を維持
      const error = new Error(
        `リソース ${resourceId} のロックは別のプロセス (${lock.lockerId}) が保持しています`
      );
      this.logger.error(`Attempted to release lock held by another locker`, {
        resourceId,
        attemptedLockerId: lockerId,
        actualLockerId: lock.lockerId,
        error,
      });
      throw error;
    }

    this.locks.delete(resourceId);
    this.logger.debug(
      `Lock released for resource: ${resourceId} by ${lockerId}`
    );
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
      if (lock && now - lock.timestamp > this.lockTimeout) {
        this.logger.warn(
          `Overwriting expired lock for resource: ${resourceId} held by ${lock.lockerId}`
        );
      }
      this.locks.set(resourceId, {
        lockerId,
        timestamp: now,
      });
      return true;
    }

    // 同じプロセスによるロックの場合は成功
    if (lock.lockerId === lockerId) {
      // タイムスタンプを更新
      lock.timestamp = now;
      return true;
    }

    // 別のプロセスが有効なロックを保持している
    return false;
  }

  /**
   * 指定時間スリープ
   * @param {number} ms - スリープ時間(ms)
   * @returns {Promise<void>}
   * @private
   */
  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
        isExpired: now - lock.timestamp > this.lockTimeout,
      });
    }

    return result;
  }
}

module.exports = LockManager;

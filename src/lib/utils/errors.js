/**
 * エラークラス定義
 *
 * 統合マネージャーで使用する各種エラークラスを定義します。
 * 主に src/lib/core/error-framework.js で定義されているエラークラスを再エクスポートします。
 */

const {
  ApplicationError,
  ValidationError, // コアの ValidationError を直接利用
  StateError, // コアの StateError を直接利用
  DataConsistencyError, // コアの DataConsistencyError を直接利用
  TimeoutError,
  LockError,
  ConfigurationError, // 必要に応じて追加
  AuthorizationError, // 必要に応じて追加
  NotFoundError, // 必要に応じて追加
  ExternalServiceError, // 必要に応じて追加
} = require('../core/error-framework');

// GitError と StorageError はこのモジュール固有のため残す
/**
 * Gitエラークラス
 */
class GitError extends ApplicationError {
  /**
   * コンストラクタ
   * @param {string} message - エラーメッセージ
   * @param {Error} cause - 原因となったエラー
   * @param {Object} [context] - 追加コンテキスト
   */
  constructor(message, cause, context = {}) {
    super(message, { cause, code: 'ERR_GIT', context });
    this.name = 'GitError';
  }
}

/**
 * ストレージエラークラス
 */
class StorageError extends ApplicationError {
  /**
   * コンストラクタ
   * @param {string} message - エラーメッセージ
   * @param {Error} cause - 原因となったエラー
   * @param {Object} [context] - 追加コンテキスト
   */
  constructor(message, cause, context = {}) {
    super(message, { cause, code: 'ERR_STORAGE', context });
    this.name = 'StorageError';
  }
}

module.exports = {
  // コアエラークラスを再エクスポート
  ApplicationError,
  ValidationError,
  StateError,
  DataConsistencyError,
  TimeoutError,
  LockError,
  ConfigurationError,
  AuthorizationError,
  NotFoundError,
  ExternalServiceError,
  // このモジュール固有のエラー
  GitError,
  StorageError,
};

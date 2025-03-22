/**
 * エラークラス定義
 * 
 * 統合マネージャーで使用する各種エラークラスを定義します。
 */

/**
 * バリデーションエラー
 */
class ValidationError extends Error {
  /**
   * コンストラクタ
   * @param {string} message - エラーメッセージ
   */
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * 状態エラー
 */
class StateError extends Error {
  /**
   * コンストラクタ
   * @param {string} message - エラーメッセージ
   */
  constructor(message) {
    super(message);
    this.name = 'StateError';
  }
}

/**
 * データ整合性エラー
 */
class DataConsistencyError extends Error {
  /**
   * コンストラクタ
   * @param {string} message - エラーメッセージ
   */
  constructor(message) {
    super(message);
    this.name = 'DataConsistencyError';
  }
}

/**
 * ロックタイムアウトエラー
 */
class LockTimeoutError extends Error {
  /**
   * コンストラクタ
   * @param {string} message - エラーメッセージ
   */
  constructor(message) {
    super(message);
    this.name = 'LockTimeoutError';
  }
}

module.exports = {
  ValidationError,
  StateError,
  DataConsistencyError,
  LockTimeoutError
};
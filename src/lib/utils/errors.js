/**
 * エラークラス定義
 * 
 * 統合マネージャーで使用する各種エラークラスを定義します。
 * src/lib/core/error-framework.js で定義されているエラークラスを継承し、
 * 後方互換性を維持しています。
 */

const {
  ApplicationError,
  ValidationError: CoreValidationError,
  StateError: CoreStateError,
  DataConsistencyError: CoreDataConsistencyError,
  TimeoutError,
  LockError
} = require('../core/error-framework');

/**
 * バリデーションエラー
 * 後方互換性のためのラッパークラス
 */
class ValidationError extends CoreValidationError {
  /**
   * コンストラクタ
   * @param {string} message - エラーメッセージ
   * @param {Object} options - オプション
   */
  constructor(message, options = {}) {
    super(message, options);
  }
}

/**
 * 状態エラー
 * 後方互換性のためのラッパークラス
 */
class StateError extends CoreStateError {
  /**
   * コンストラクタ
   * @param {string} message - エラーメッセージ
   * @param {Object} options - オプション
   */
  constructor(message, options = {}) {
    super(message, options);
  }
}

/**
 * データ整合性エラー
 * 後方互換性のためのラッパークラス
 */
class DataConsistencyError extends CoreDataConsistencyError {
  /**
   * コンストラクタ
   * @param {string} message - エラーメッセージ
   * @param {Object} options - オプション
   */
  constructor(message, options = {}) {
    super(message, options);
  }
}

/**
 * ロックタイムアウトエラー
 * 後方互換性のためのクラス
 */
class LockTimeoutError extends TimeoutError {
  /**
   * コンストラクタ
   * @param {string} message - エラーメッセージ
   * @param {Object} options - オプション
   */
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: 'ERR_LOCK_TIMEOUT',
      context: {
        ...(options.context || {}),
        errorType: 'LockTimeoutError'
      }
    });
    this.name = 'LockTimeoutError';
  }
}

module.exports = {
  ValidationError,
  StateError,
  DataConsistencyError,
  LockTimeoutError,
  // 新しいエラークラスも公開
  ApplicationError,
  LockError,
  TimeoutError
};
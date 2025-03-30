/**
 * エラー処理フレームワーク
 *
 * アプリケーション全体で一貫したエラー処理を提供するためのフレームワーク。
 * エラーの階層構造、コンテキスト情報、回復メカニズムを提供します。
 */

/**
 * アプリケーションの基本エラークラス
 * すべてのカスタムエラーの基底クラス
 */
class ApplicationError extends Error {
  /**
   * コンストラクタ
   * @param {string} message - エラーメッセージ
   * @param {Object} options - オプション
   * @param {string} options.code - エラーコード
   * @param {Object} options.context - エラーコンテキスト情報
   * @param {Error} options.cause - 元のエラー（原因）
   * @param {boolean} options.recoverable - 回復可能かどうか
   */
  constructor(message, options = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = options.code || 'ERR_APPLICATION';
    this.context = options.context || {};
    this.cause = options.cause;
    this.recoverable =
      options.recoverable !== undefined ? options.recoverable : true;
    this.timestamp = new Date().toISOString();
  }

  /**
   * エラーをJSON形式に変換
   * @returns {Object} JSON形式のエラー情報
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      cause: this.cause
        ? this.cause.toJSON
          ? this.cause.toJSON()
          : this.cause.message
        : undefined,
      recoverable: this.recoverable,
      timestamp: this.timestamp,
    };
  }

  /**
   * エラーの文字列表現を取得
   * @returns {string} エラーの文字列表現
   */
  toString() {
    return `[${this.code}] ${this.name}: ${this.message}`;
  }
}

/**
 * バリデーションエラー
 * 入力データの検証に失敗した場合に使用
 */
class ValidationError extends ApplicationError {
  /**
   * コンストラクタ
   * @param {string} message - エラーメッセージ
   * @param {Object} options - オプション
   */
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || 'ERR_VALIDATION',
      recoverable:
        options.recoverable !== undefined ? options.recoverable : true,
    });
  }
}

/**
 * 状態エラー
 * システムの状態が不正な場合に使用
 */
class StateError extends ApplicationError {
  /**
   * コンストラクタ
   * @param {string} message - エラーメッセージ
   * @param {Object} options - オプション
   */
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || 'ERR_STATE',
      recoverable:
        options.recoverable !== undefined ? options.recoverable : false,
    });
  }
}

/**
 * データ整合性エラー
 * データの整合性が取れない場合に使用
 */
class DataConsistencyError extends ApplicationError {
  /**
   * コンストラクタ
   * @param {string} message - エラーメッセージ
   * @param {Object} options - オプション
   */
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || 'ERR_DATA_CONSISTENCY',
      recoverable:
        options.recoverable !== undefined ? options.recoverable : false,
    });
  }
}

/**
 * ストレージエラー
 * ファイルシステム操作に失敗した場合に使用
 */
class StorageError extends ApplicationError {
  /**
   * コンストラクタ
   * @param {string} message - エラーメッセージ
   * @param {Object} options - オプション
   */
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || 'ERR_STORAGE',
      recoverable:
        options.recoverable !== undefined ? options.recoverable : true,
    });
  }
}

/**
 * Gitエラー
 * Git操作に失敗した場合に使用
 */
class GitError extends ApplicationError {
  /**
   * コンストラクタ
   * @param {string} message - エラーメッセージ
   * @param {Object} options - オプション
   */
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || 'ERR_GIT',
      recoverable:
        options.recoverable !== undefined ? options.recoverable : true,
    });
  }
}

/**
 * ロックエラー
 * リソースのロックに失敗した場合に使用
 */
class LockError extends ApplicationError {
  /**
   * コンストラクタ
   * @param {string} message - エラーメッセージ
   * @param {Object} options - オプション
   */
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || 'ERR_LOCK',
      recoverable:
        options.recoverable !== undefined ? options.recoverable : true,
    });
  }
}

/**
 * タイムアウトエラー
 * 操作がタイムアウトした場合に使用
 */
class TimeoutError extends ApplicationError {
  /**
   * コンストラクタ
   * @param {string} message - エラーメッセージ
   * @param {Object} options - オプション
   */
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || 'ERR_TIMEOUT',
      recoverable:
        options.recoverable !== undefined ? options.recoverable : true,
    });
  }
}

/**
 * 設定エラー
 * 設定が不正な場合に使用
 */
class ConfigurationError extends ApplicationError {
  /**
   * コンストラクタ
   * @param {string} message - エラーメッセージ
   * @param {Object} options - オプション
   */
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || 'ERR_CONFIGURATION',
      recoverable:
        options.recoverable !== undefined ? options.recoverable : false,
    });
  }
}

/**
 * 認可エラー
 * 必要な権限がない場合に使用
 */
class AuthorizationError extends ApplicationError {
  /**
   * コンストラクタ
   * @param {string} message - エラーメッセージ
   * @param {Object} options - オプション
   */
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || 'ERR_AUTHORIZATION',
      recoverable:
        options.recoverable !== undefined ? options.recoverable : false, // 通常は回復不能
    });
  }
}

/**
 * Not Foundエラー
 * リソースが見つからない場合に使用
 */
class NotFoundError extends ApplicationError {
  /**
   * コンストラクタ
   * @param {string} message - エラーメッセージ
   * @param {Object} options - オプション
   */
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || 'ERR_NOT_FOUND',
      recoverable:
        options.recoverable !== undefined ? options.recoverable : true, // 場合によっては回復可能
    });
  }
}

/**
 * 外部サービスエラー
 * 外部APIなどの呼び出しに失敗した場合に使用
 */
class ExternalServiceError extends ApplicationError {
  /**
   * コンストラクタ
   * @param {string} message - エラーメッセージ
   * @param {Object} options - オプション
   */
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || 'ERR_EXTERNAL_SERVICE',
      recoverable:
        options.recoverable !== undefined ? options.recoverable : true, // リトライで回復可能な場合あり
    });
  }
}

/**
 * 依存関係エラー
 * 依存関係の解決に失敗した場合に使用
 */
class DependencyError extends ApplicationError {
  /**
   * コンストラクタ
   * @param {string} message - エラーメッセージ
   * @param {Object} options - オプション
   */
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || 'ERR_DEPENDENCY',
      recoverable:
        options.recoverable !== undefined ? options.recoverable : false,
    });
  }
}

/**
 * ネットワークエラー
 * ネットワーク操作に失敗した場合に使用
 */
class NetworkError extends ApplicationError {
  /**
   * コンストラクタ
   * @param {string} message - エラーメッセージ
   * @param {Object} options - オプション
   */
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: options.code || 'ERR_NETWORK',
      recoverable:
        options.recoverable !== undefined ? options.recoverable : true,
    });
  }
}

/**
 * エラーハンドラークラス
 * エラーの処理と回復を担当
 */
class ErrorHandler {
  /**
   * コンストラクタ
   * @param {Object} logger - ロガーインスタンス
   * @param {Object} eventEmitter - イベントエミッターインスタンス
   */
  constructor(logger, eventEmitter) {
    this.logger = logger || console;
    this.eventEmitter = eventEmitter;
    this.recoveryStrategies = new Map();
  }

  /**
   * エラーを処理
   * @param {Error} error - 処理するエラー
   * @param {string} component - エラーが発生したコンポーネント
   * @param {string} operation - エラーが発生した操作
   * @returns {Error} 処理されたエラー
   */
  async handle(error, component, operation) {
    // アプリケーションエラーでなければラップする
    if (!(error instanceof ApplicationError)) {
      error = new ApplicationError(error.message, {
        cause: error,
        context: { component, operation },
      });
    }

    // エラーをログに記録
    this.logger.error(`[${component}] ${operation} failed:`, {
      error_name: error.name,
      error_message: error.message,
      error_code: error.code,
      stack: error.stack,
      context: error.context,
    });

    // 標準化されたエラーイベントを発行
    if (this.eventEmitter) {
      // 標準化されたイベント発行を使用
      if (typeof this.eventEmitter.emitStandardized === 'function') {
        this.eventEmitter.emitStandardized('error', 'occurred', {
          error,
          component,
          operation,
          errorCode: error.code,
          recoverable: error.recoverable,
          timestamp: new Date().toISOString(),
        });
      } else {
        // 後方互換性のために従来のイベント発行も維持
        this.eventEmitter.emit('error', {
          error,
          component,
          operation,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // 回復可能なエラーの場合は回復を試みる
    if (error.recoverable && this.recoveryStrategies.has(error.code)) {
      try {
        return this.recoveryStrategies.get(error.code)(
          error,
          component,
          operation
        );
      } catch (recoveryError) {
        this.logger.error(`Recovery failed for ${error.code}:`, recoveryError);
      }
    }

    return error;
  }

  /**
   * 回復戦略を登録
   * @param {string} errorCode - エラーコード
   * @param {Function} strategy - 回復戦略関数
   */
  registerRecoveryStrategy(errorCode, strategy) {
    this.recoveryStrategies.set(
      errorCode,
      async (error, component, operation) => {
        try {
          // 回復処理の開始をイベントで通知
          if (this.eventEmitter) {
            this.eventEmitter.emit('error:recovery_started', {
              error,
              component,
              operation,
              errorCode,
            });
          }

          // 回復戦略を実行
          const result = await Promise.resolve(
            strategy(error, component, operation)
          );

          // 回復成功をイベントで通知
          if (this.eventEmitter) {
            this.eventEmitter.emit('error:recovery_succeeded', {
              error,
              component,
              operation,
              errorCode,
              result,
            });
          }

          return result;
        } catch (recoveryError) {
          // 回復失敗をイベントで通知
          if (this.eventEmitter) {
            this.eventEmitter.emit('error:recovery_failed', {
              error,
              recoveryError,
              component,
              operation,
              errorCode,
            });
          }

          this.logger.error(`Recovery failed for ${errorCode}:`, recoveryError);
          throw recoveryError;
        }
      }
    );
  }

  /**
   * 回復戦略を削除
   * @param {string} errorCode - エラーコード
   */
  removeRecoveryStrategy(errorCode) {
    this.recoveryStrategies.delete(errorCode);
  }
}

module.exports = {
  ApplicationError,
  ValidationError,
  StateError,
  DataConsistencyError,
  StorageError,
  GitError,
  LockError,
  TimeoutError,
  ConfigurationError,
  AuthorizationError, // 追加
  NotFoundError, // 追加
  ExternalServiceError, // 追加
  DependencyError,
  NetworkError,
  ErrorHandler,
};

/**
 * エラー移行ヘルパー
 *
 * 既存のエラークラスから新しいエラー処理フレームワークへの移行を支援します。
 */

const oldErrors = require('../../utils/errors');
const newErrors = require('./error-handler');

/**
 * 古いエラークラスを新しいエラークラスに変換
 * @param {Error} error - 変換するエラー
 * @returns {Error} 変換されたエラー
 */
function convertError(error) {
  if (error instanceof oldErrors.ValidationError) {
    return new newErrors.ValidationError(error.message, {
      cause: error,
      context: { original_error: error },
    });
  } else if (error instanceof oldErrors.StateError) {
    return new newErrors.StateError(error.message, {
      cause: error,
      context: { original_error: error },
    });
  } else if (error instanceof oldErrors.DataConsistencyError) {
    return new newErrors.DataConsistencyError(error.message, {
      cause: error,
      context: { original_error: error },
    });
  } else if (error instanceof oldErrors.LockTimeoutError) {
    return new newErrors.TimeoutError(error.message, {
      cause: error,
      context: { original_error: error, lock_related: true },
    });
  } else {
    return new newErrors.ApplicationError(error.message, {
      cause: error,
      context: { original_error: error },
    });
  }
}

/**
 * 古いエラークラスを新しいエラークラスに置き換えるためのプロキシ
 */
const migrationProxy = {
  ValidationError: function (message) {
    // eslint-disable-next-line no-console
    console.warn(
      'Deprecated: Using old ValidationError. Please use the new error framework.'
    );
    return new newErrors.ValidationError(message);
  },

  StateError: function (message) {
    // eslint-disable-next-line no-console
    console.warn(
      'Deprecated: Using old StateError. Please use the new error framework.'
    );
    return new newErrors.StateError(message);
  },

  DataConsistencyError: function (message) {
    // eslint-disable-next-line no-console
    console.warn(
      'Deprecated: Using old DataConsistencyError. Please use the new error framework.'
    );
    return new newErrors.DataConsistencyError(message);
  },

  LockTimeoutError: function (message) {
    // eslint-disable-next-line no-console
    console.warn(
      'Deprecated: Using old LockTimeoutError. Please use the new error framework.'
    );
    return new newErrors.TimeoutError(message, {
      context: { lock_related: true },
    });
  },
};

/**
 * 既存のコードを移行するためのヘルパー関数
 * @param {Function} fn - 移行する関数
 * @param {Object} options - オプション
 * @param {string} options.component - コンポーネント名
 * @param {string} options.operation - 操作名
 * @param {Object} options.errorHandler - エラーハンドラーインスタンス
 * @returns {Function} 移行された関数
 */
function migrateFunction(fn, options = {}) {
  const { component, operation, errorHandler } = options;

  return async function (...args) {
    try {
      return await fn.apply(this, args);
    } catch (error) {
      // 古いエラークラスを新しいエラークラスに変換
      const convertedError = convertError(error);

      // エラーハンドラーが提供されている場合は処理を委譲
      if (errorHandler) {
        return await errorHandler.handle(convertedError, component, operation);
      }

      // エラーハンドラーがない場合は変換されたエラーをスロー
      throw convertedError;
    }
  };
}

/**
 * 既存のクラスのメソッドを移行するためのヘルパー関数
 * @param {Object} classInstance - 移行するクラスのインスタンス
 * @param {string[]} methodNames - 移行するメソッド名の配列
 * @param {Object} options - オプション
 * @param {string} options.component - コンポーネント名
 * @param {Object} options.errorHandler - エラーハンドラーインスタンス
 */
function migrateClassMethods(classInstance, methodNames, options = {}) {
  const { component, errorHandler } = options;

  for (const methodName of methodNames) {
    // methodName が classInstance 自身のプロパティであり、かつ関数であることを確認
    if (
      Object.prototype.hasOwnProperty.call(classInstance, methodName) &&
      // eslint-disable-next-line security/detect-object-injection
      typeof classInstance[methodName] === 'function'
    ) {
      // eslint-disable-next-line security/detect-object-injection
      const originalMethod = classInstance[methodName];
      // eslint-disable-next-line security/detect-object-injection
      classInstance[methodName] = migrateFunction(originalMethod, {
        component,
        operation: methodName,
        errorHandler,
      });
    }
  }
}

module.exports = {
  convertError,
  migrationProxy,
  migrateFunction,
  migrateClassMethods,
};

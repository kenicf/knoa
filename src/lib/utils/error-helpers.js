/**
 * エラーヘルパー関数
 * エラーハンドリングと標準化されたエラーイベント発行をサポートします。
 */

/**
 * 標準化されたエラーイベントを発行
 * @param {Object} eventEmitter - イベントエミッターインスタンス (emitStandardizedを持つ想定)
 * @param {Object} logger - ロガーインスタンス
 * @param {string} component - コンポーネント名
 * @param {string} operation - 操作名
 * @param {Error} error - エラーオブジェクト
 * @param {Object|null} [context=null] - 操作コンテキスト (setErrorメソッドを持つ想定)
 * @param {Object} [details={}] - 追加詳細情報
 */
function emitErrorEvent(
  eventEmitter,
  logger,
  component,
  operation,
  error,
  context = null,
  details = {}
) {
  // ロガーへのエラー出力
  if (logger && typeof logger.error === 'function') {
    logger.error(`Error in ${component}.${operation}:`, { error, details }); // context を削除し、error と details を渡す
  }

  // コンテキストにエラー状態を設定
  if (context && typeof context.setError === 'function') {
    // setError の存在も確認
    context.setError(error, component, operation, details);
  }

  // イベントエミッターがない、または emitStandardized がなければ何もしない
  if (!eventEmitter || typeof eventEmitter.emitStandardized !== 'function') {
    if (eventEmitter && logger) {
      // eventEmitter はあるが emitStandardized がない場合
      logger.warn(
        `emitErrorEvent: eventEmitter does not have emitStandardized method. Component: ${component}, Operation: ${operation}`
      );
    }
    return;
  }

  // 標準化されたエラーイベントデータ (timestamp は emitStandardized で付与されるため削除)
  const errorData = {
    component,
    operation,
    message: error.message,
    code: error.code || 'ERR_UNKNOWN',
    // stack: error.stack, // 必要に応じてスタックトレースを含める
    details,
    _contextId: context && context.id ? context.id : null, // context.id があれば含める
  };

  try {
    // 標準化されたエラーイベントの発行
    eventEmitter.emitStandardized('app', 'error', errorData);
  } catch (emitError) {
    // イベント発行自体のエラーはロガーに出力
    if (logger && typeof logger.error === 'function') {
      logger.error('Failed to emit app:error event', {
        error: emitError,
        originalError: errorData,
      });
    } else {
      // フォールバック
      // eslint-disable-next-line no-console
      console.error(
        'Failed to emit app:error event:',
        emitError,
        'Original error data:',
        errorData
      );
    }
  }
}

module.exports = {
  emitErrorEvent,
};

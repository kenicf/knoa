/**
 * エラーヘルパー関数
 * エラーハンドリングと標準化されたエラーイベント発行をサポートします。
 */

/**
 * 標準化されたエラーイベントを発行
 * @param {Object} eventEmitter - イベントエミッターインスタンス
 * @param {Object} logger - ロガーインスタンス
 * @param {string} component - コンポーネント名
 * @param {string} operation - 操作名
 * @param {Error} error - エラーオブジェクト
 * @param {OperationContext} context - 操作コンテキスト
 * @param {Object} details - 追加詳細情報
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
    logger.error(`Error in ${component}.${operation}:`, error, details);
  }

  if (!eventEmitter) {
    return;
  }

  // コンテキストにエラー状態を設定
  if (context) {
    context.setError(error, component, operation, details);
  }

  // 標準化されたエラーイベントデータ
  const errorData = {
    component,
    operation,
    message: error.message,
    code: error.code || 'ERR_UNKNOWN',
    timestamp: new Date().toISOString(),
    details,
    _context: context ? context.id : null,
  };

  // エラーイベントの発行
  eventEmitter.emit('app:error', errorData);
}

module.exports = {
  emitErrorEvent,
};

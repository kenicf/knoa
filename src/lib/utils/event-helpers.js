/**
 * イベントヘルパー関数
 *
 * イベント駆動アーキテクチャの統一をサポートするためのヘルパー関数を提供します。
 */

/**
 * 標準化されたイベントデータを生成
 * @param {Object} data - 元のイベントデータ
 * @param {string} component - コンポーネント名
 * @returns {Object} 標準化されたイベントデータ
 */
function createStandardizedEventData(data = {}, component) {
  // TODO: Step 5 で ID 生成ロジックを集約する
  const traceId =
    data.traceId ||
    data.trace_id ||
    `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const requestId =
    data.requestId ||
    data.request_id ||
    `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  return {
    ...data,
    timestamp: data.timestamp || new Date().toISOString(),
    traceId,
    requestId,
    component,
  };
}

// createEventBridge 関数を削除

/**
 * 標準化されたイベントを発行 (emitStandardized を使用)
 * @param {Object} eventEmitter - イベントエミッターインスタンス (emitStandardizedを持つ想定)
 * @param {string} component - コンポーネント名
 * @param {string} action - アクション名
 * @param {Object} [data={}] - イベントデータ
 * @returns {boolean} 発行結果
 */
function emitStandardizedEvent(eventEmitter, component, action, data = {}) {
  if (!eventEmitter || typeof eventEmitter.emitStandardized !== 'function') {
    // emitStandardized がない場合はエラーログを出力するか、エラーをスローする方が適切かもしれない
    if (eventEmitter && eventEmitter.logger) {
      eventEmitter.logger.error(
        `emitStandardizedEvent requires an eventEmitter with emitStandardized method. Component: ${component}, Action: ${action}`
      );
    } else {
      // eslint-disable-next-line no-console
      console.error(
        `emitStandardizedEvent requires an eventEmitter with emitStandardized method. Component: ${component}, Action: ${action}`
      );
    }
    return false;
  }

  try {
    // 標準化されたイベントデータを生成
    const standardizedData = createStandardizedEventData(data, component);

    // 標準化されたイベント名
    const standardEvent = `${component}:${action}`;

    // デバッグ情報
    const debugInfo = {
      component,
      action,
      standardEvent,
      timestamp: standardizedData.timestamp,
    };

    // 標準化されたイベント発行
    eventEmitter.emitStandardized(component, action, standardizedData);

    if (eventEmitter.debugMode && eventEmitter.logger) {
      eventEmitter.logger.debug(
        `標準化されたイベントを発行: ${standardEvent}`,
        debugInfo
      );
    }

    // 古いイベント名のサポートロジックを削除

    return true;
  } catch (error) {
    if (eventEmitter.logger) {
      eventEmitter.logger.error(
        `イベント発行中にエラーが発生しました: ${component}:${action}`,
        error
      );
    } else {
      // ロガーがない場合のフォールバック
      // eslint-disable-next-line no-console
      console.error(
        `イベント発行中にエラーが発生しました: ${component}:${action}`,
        error
      );
    }
    return false;
  }
}

module.exports = {
  createStandardizedEventData,
  // createEventBridge を削除
  emitStandardizedEvent,
};

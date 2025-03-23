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
  const traceId = data.traceId || data.trace_id || `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const requestId = data.requestId || data.request_id || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    ...data,
    timestamp: data.timestamp || new Date().toISOString(),
    traceId,
    requestId,
    component
  };
}

/**
 * イベントブリッジ - 新旧両方のイベント名をサポート
 * @param {Object} eventEmitter - イベントエミッターインスタンス
 * @param {string} oldEventName - 古いイベント名
 * @param {string} component - 新しいコンポーネント名
 * @param {string} action - 新しいアクション名
 */
function createEventBridge(eventEmitter, oldEventName, component, action) {
  // 新しい形式のイベントを発行したときに、古い形式のイベントも発行
  eventEmitter.on(`${component}:${action}`, (data) => {
    eventEmitter.emit(oldEventName, data);
    // 警告ログを出力（開発環境のみ）
    if (process.env.NODE_ENV === 'development') {
      console.warn(`非推奨のイベント名 ${oldEventName} が使用されています。代わりに ${component}:${action} を使用してください。`);
    }
  });
}

/**
 * 標準化されたイベントを発行
 * @param {Object} eventEmitter - イベントエミッターインスタンス
 * @param {string} component - コンポーネント名
 * @param {string} action - アクション名
 * @param {Object} data - イベントデータ
 * @param {boolean} [bridgeOldEvents=true] - 古いイベント名もサポートするかどうか
 * @returns {boolean} 発行結果
 */
function emitStandardizedEvent(eventEmitter, component, action, data = {}, bridgeOldEvents = true) {
  if (!eventEmitter) {
    return false;
  }
  
  try {
    // イベント名の定数マッピングをインポート
    const { EVENT_MAP } = require('../core/event-constants');
    
    // 標準化されたイベントデータを生成
    const standardizedData = createStandardizedEventData(data, component);
    
    // 標準化されたイベント名
    const standardEvent = `${component}:${action}`;
    
    // デバッグ情報
    const debugInfo = {
      component,
      action,
      standardEvent,
      timestamp: standardizedData.timestamp
    };
    
    // 標準化されたイベント発行
    if (typeof eventEmitter.emitStandardized === 'function') {
      eventEmitter.emitStandardized(component, action, standardizedData);
      
      if (eventEmitter.debugMode) {
        eventEmitter.logger.debug(`標準化されたイベントを発行: ${standardEvent}`, debugInfo);
      }
    } else {
      // 後方互換性のため
      eventEmitter.emit(standardEvent, standardizedData);
      
      if (eventEmitter.debugMode) {
        eventEmitter.logger.debug(`イベントを発行: ${standardEvent}`, debugInfo);
      }
    }
    
    // 古いイベント名のサポート（オプション）
    if (bridgeOldEvents) {
      const oldEventName = EVENT_MAP[standardEvent];
      
      if (oldEventName) {
        eventEmitter.emit(oldEventName, standardizedData);
        
        // デバッグ情報を拡張
        debugInfo.oldEventName = oldEventName;
        debugInfo.bridged = true;
        
        if (eventEmitter.debugMode) {
          eventEmitter.logger.debug(`古いイベント名でも発行: ${oldEventName}`, debugInfo);
        }
        
        // 警告ログを出力（開発環境のみ）
        if (process.env.NODE_ENV === 'development' && eventEmitter.logger) {
          eventEmitter.logger.warn(`非推奨のイベント名 ${oldEventName} が使用されています。代わりに ${standardEvent} を使用してください。`, debugInfo);
        }
      } else if (eventEmitter.debugMode) {
        eventEmitter.logger.debug(`古いイベント名のマッピングが見つかりません: ${standardEvent}`, debugInfo);
      }
    }
    
    return true;
  } catch (error) {
    if (eventEmitter.logger) {
      eventEmitter.logger.error(`イベント発行中にエラーが発生しました: ${component}:${action}`, error);
    } else {
      console.error(`イベント発行中にエラーが発生しました: ${component}:${action}`, error);
    }
    return false;
  }
}

module.exports = {
  createStandardizedEventData,
  createEventBridge,
  emitStandardizedEvent
};
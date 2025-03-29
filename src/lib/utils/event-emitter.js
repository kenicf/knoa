/**
 * イベントエミッタークラス
 *
 * コンポーネント間の疎結合な連携を実現するためのイベント駆動アーキテクチャを提供します。
 * src/lib/core/event-system.js で定義されているEnhancedEventEmitterを拡張します。
 */

const { EnhancedEventEmitter } = require('../core/event-system');

/**
 * イベントエミッタークラス
 * EnhancedEventEmitter を継承し、標準化されたイベント発行メソッドを追加します。
 */
class EventEmitter extends EnhancedEventEmitter {
  /**
   * コンストラクタ
   * @param {Object} options - オプション
   * @param {Object} options.logger - ロガーインスタンス (必須)
   * @param {boolean} [options.debugMode=false] - デバッグモード
   * @param {boolean} [options.keepHistory=false] - イベント履歴を保持するかどうか
   * @param {number} [options.historyLimit=100] - 保持するイベント履歴の上限
   */
  constructor(options) {
    // logger を必須にする
    if (!options || !options.logger) {
      throw new Error('Logger instance is required in EventEmitter options.');
    }
    super(options.logger, {
      debugMode: options.debugMode || false,
      keepHistory: options.keepHistory || false,
      historyLimit: options.historyLimit || 100,
    });
  }

  // on, off, emit, emitAsync, getRegisteredEvents, listenerCount は
  // 親クラス EnhancedEventEmitter の実装をそのまま利用するため、オーバーライドを削除

  /**
   * 標準化されたイベントを発行
   * @param {string} component - コンポーネント名
   * @param {string} action - アクション名
   * @param {*} [data={}] - イベントデータ
   * @param {Object} [options={}] - オプション (現在は未使用)
   * @returns {boolean} リスナーが呼び出されたかどうか
   */
  emitStandardized(component, action, data = {}, options = {}) {
    const standardEvent = `${component}:${action}`;
    const timestamp = new Date().toISOString();
    // TODO: traceId, requestId を OperationContext などから取得する仕組みを検討
    const standardizedData = {
      ...data,
      timestamp,
      component,
      action,
      // traceId: context.traceId, // 例
      // requestId: context.requestId, // 例
    };

    // 標準化されたイベントを発行
    const result = super.emit(standardEvent, standardizedData);

    // グローバルイベントも発行 (type を含める)
    super.emit('event', { type: standardEvent, ...standardizedData });

    return result;
  }

  /**
   * 標準化された非同期イベントを発行
   * @param {string} component - コンポーネント名
   * @param {string} action - アクション名
   * @param {*} [data={}] - イベントデータ
   * @param {Object} [options={}] - オプション (現在は未使用)
   * @returns {Promise<boolean>} リスナーが呼び出されたかどうか
   */
  async emitStandardizedAsync(component, action, data = {}, options = {}) {
    const standardEvent = `${component}:${action}`;
    const timestamp = new Date().toISOString();
    // TODO: traceId, requestId を OperationContext などから取得する仕組みを検討
    const standardizedData = {
      ...data,
      timestamp,
      component,
      action,
      // traceId: context.traceId, // 例
      // requestId: context.requestId, // 例
    };

    // 標準化されたイベントを発行
    const result = await super.emitAsync(standardEvent, standardizedData);

    // グローバルイベントも発行 (type を含める)
    await super.emitAsync('event', { type: standardEvent, ...standardizedData });

    return result;
  }
}

module.exports = EventEmitter;

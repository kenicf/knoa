/**
 * イベントエミッタークラス
 * 
 * コンポーネント間の疎結合な連携を実現するためのイベント駆動アーキテクチャを提供します。
 * src/lib/core/event-system.js で定義されているEnhancedEventEmitterとの互換性を維持しています。
 */

const { EnhancedEventEmitter } = require('../core/event-system');

/**
 * イベントエミッタークラス
 * 後方互換性のためのラッパークラス
 */
class EventEmitter extends EnhancedEventEmitter {
  /**
   * コンストラクタ
   * @param {Object} options - オプション
   */
  constructor(options = {}) {
    super(options.logger || console, {
      debugMode: options.debugMode || false,
      keepHistory: options.keepHistory || false,
      historyLimit: options.historyLimit || 100
    });
    
    // 無限ループを防ぐためのフラグ
    this._isStandardized = false;
  }

  /**
   * イベントリスナーを登録（後方互換性のためのメソッド）
   * @param {string} event - イベント名
   * @param {Function} callback - コールバック関数
   * @returns {Function} リスナー解除関数
   */
  on(event, callback) {
    return super.on(event, callback);
  }
  
  /**
   * イベントリスナーを解除（後方互換性のためのメソッド）
   * @param {string} event - イベント名
   * @param {Function} callback - コールバック関数
   */
  off(event, callback) {
    return super.off(event, callback);
  }
  
  /**
   * イベントを発行（後方互換性のためのメソッド）
   * @param {string} event - イベント名
   * @param {*} data - イベントデータ
   */
  emit(event, data) {
    // 無限ループを防ぐために、直接親クラスのemitを呼び出す
    if (event.includes(':') && !this._isStandardized) {
      // 非標準形式の場合は警告を出力
      this.logger.warn(`非標準のイベント名: ${event}`, { context: {} });
    }
    
    // 直接親クラスのemitを呼び出す
    return super.emit(event, data);
  }
  
  /**
   * 標準化されたイベントを発行
   * @param {string} component - コンポーネント名
   * @param {string} action - アクション名
   * @param {*} data - イベントデータ
   * @param {Object} options - オプション
   * @returns {boolean} リスナーが呼び出されたかどうか
   */
  emitStandardized(component, action, data = {}, options = {}) {
    this._isStandardized = true;
    try {
      const standardEvent = `${component}:${action}`;
      const timestamp = new Date().toISOString();
      const standardizedData = { ...data, timestamp, component, action };
      
      // 標準化されたイベントを発行
      const result = super.emit(standardEvent, standardizedData);
      
      // グローバルイベントも発行
      super.emit('event', { type: standardEvent, ...standardizedData });
      
      return result;
    } finally {
      this._isStandardized = false;
    }
  }
  
  /**
   * 非同期イベントを発行（後方互換性のためのメソッド）
   * @param {string} event - イベント名
   * @param {*} data - イベントデータ
   * @returns {Promise<void>}
   */
  async emitAsync(event, data) {
    // 無限ループを防ぐために、直接親クラスのemitAsyncを呼び出す
    if (event.includes(':') && !this._isStandardized) {
      // 非標準形式の場合は警告を出力
      this.logger.warn(`非標準のイベント名: ${event}`, { context: {} });
    }
    
    // 直接親クラスのemitAsyncを呼び出す
    return await super.emitAsync(event, data);
  }
  
  /**
   * 標準化された非同期イベントを発行
   * @param {string} component - コンポーネント名
   * @param {string} action - アクション名
   * @param {*} data - イベントデータ
   * @param {Object} options - オプション
   * @returns {Promise<boolean>} リスナーが呼び出されたかどうか
   */
  async emitStandardizedAsync(component, action, data = {}, options = {}) {
    this._isStandardized = true;
    try {
      const standardEvent = `${component}:${action}`;
      const timestamp = new Date().toISOString();
      const standardizedData = { ...data, timestamp, component, action };
      
      // 標準化されたイベントを発行
      const result = await super.emitAsync(standardEvent, standardizedData);
      
      // グローバルイベントも発行
      await super.emitAsync('event', { type: standardEvent, ...standardizedData });
      
      return result;
    } finally {
      this._isStandardized = false;
    }
  }
  
  /**
   * 登録されているイベント一覧を取得（後方互換性のためのメソッド）
   * @returns {Array<string>} イベント名の配列
   */
  getRegisteredEvents() {
    return super.getRegisteredEvents();
  }
  
  /**
   * 特定イベントのリスナー数を取得（後方互換性のためのメソッド）
   * @param {string} event - イベント名
   * @returns {number} リスナー数
   */
  listenerCount(event) {
    return super.listenerCount(event);
  }
}

module.exports = EventEmitter;
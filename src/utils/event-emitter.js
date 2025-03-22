/**
 * イベントエミッタークラス
 * 
 * コンポーネント間の疎結合な連携を実現するためのイベント駆動アーキテクチャを提供します。
 */

/**
 * イベントエミッタークラス
 */
class EventEmitter {
  /**
   * コンストラクタ
   */
  constructor() {
    this.listeners = new Map();
  }
  
  /**
   * イベントリスナーを登録
   * @param {string} event - イベント名
   * @param {Function} callback - コールバック関数
   * @returns {Function} リスナー解除関数
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    
    this.listeners.get(event).push(callback);
    
    // リスナー解除関数を返す
    return () => this.off(event, callback);
  }
  
  /**
   * イベントリスナーを解除
   * @param {string} event - イベント名
   * @param {Function} callback - コールバック関数
   */
  off(event, callback) {
    if (!this.listeners.has(event)) {
      return;
    }
    
    const eventListeners = this.listeners.get(event);
    this.listeners.set(
      event,
      eventListeners.filter(listener => listener !== callback)
    );
  }
  
  /**
   * イベントを発行
   * @param {string} event - イベント名
   * @param {*} data - イベントデータ
   */
  emit(event, data) {
    if (!this.listeners.has(event)) {
      return;
    }
    
    for (const listener of this.listeners.get(event)) {
      try {
        listener(data);
      } catch (error) {
        console.error(`イベントリスナー(${event})でエラーが発生しました:`, error);
      }
    }
  }
  
  /**
   * 非同期イベントを発行
   * @param {string} event - イベント名
   * @param {*} data - イベントデータ
   * @returns {Promise<void>}
   */
  async emitAsync(event, data) {
    if (!this.listeners.has(event)) {
      return;
    }
    
    const listeners = this.listeners.get(event);
    const promises = [];
    
    for (const listener of listeners) {
      promises.push(
        (async () => {
          try {
            await listener(data);
          } catch (error) {
            console.error(`非同期イベントリスナー(${event})でエラーが発生しました:`, error);
          }
        })()
      );
    }
    
    await Promise.all(promises);
  }
  
  /**
   * 登録されているイベント一覧を取得
   * @returns {Array<string>} イベント名の配列
   */
  getRegisteredEvents() {
    return Array.from(this.listeners.keys());
  }
  
  /**
   * 特定イベントのリスナー数を取得
   * @param {string} event - イベント名
   * @returns {number} リスナー数
   */
  listenerCount(event) {
    return this.listeners.has(event) ? this.listeners.get(event).length : 0;
  }
}

module.exports = EventEmitter;
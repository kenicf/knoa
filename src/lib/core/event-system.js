/**
 * イベントシステム
 * 
 * コンポーネント間の疎結合な連携を実現するためのイベント駆動アーキテクチャを提供します。
 * 標準的なイベントエミッターの機能に加え、ワイルドカードパターンのサポート、
 * イベント名の標準化、非同期イベント処理などの拡張機能を提供します。
 */

const { ApplicationError } = require('./error-framework');

/**
 * イベントエラークラス
 */
class EventError extends ApplicationError {
  /**
   * コンストラクタ
   * @param {string} message - エラーメッセージ
   * @param {Object} options - オプション
   */
  constructor(message, options = {}) {
    super(message, { 
      ...options, 
      code: options.code || 'ERR_EVENT',
      recoverable: options.recoverable !== undefined ? options.recoverable : true
    });
  }
}

/**
 * 拡張イベントエミッタークラス
 */
class EnhancedEventEmitter {
  /**
   * コンストラクタ
   * @param {Object} options - オプション
   * @param {boolean} options.debugMode - デバッグモードを有効にするかどうか
   * @param {Object} options.logger - ロガーインスタンス
   */
  constructor(options = {}) {
    this.listeners = new Map();
    this.wildcardListeners = [];
    this.debugMode = options.debugMode || false;
    this.logger = options.logger || console;
    this.eventHistory = options.keepHistory ? [] : null;
    this.historyLimit = options.historyLimit || 100;
  }

  /**
   * イベントリスナーを登録
   * @param {string} event - イベント名（ワイルドカード '*' をサポート）
   * @param {Function} callback - コールバック関数
   * @returns {Function} リスナー解除関数
   */
  on(event, callback) {
    if (event.includes('*')) {
      // ワイルドカードリスナーとして登録
      const pattern = new RegExp('^' + event.replace(/\*/g, '.*') + '$');
      const wildcardListener = { pattern, callback };
      this.wildcardListeners.push(wildcardListener);
      
      if (this.debugMode) {
        this.logger.debug(`ワイルドカードリスナーを登録: ${event}`, { pattern: pattern.toString() });
      }
      
      return () => this.offWildcard(wildcardListener);
    } else {
      // 通常のリスナーとして登録
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      
      this.listeners.get(event).push(callback);
      
      if (this.debugMode) {
        this.logger.debug(`リスナーを登録: ${event}`, { 
          listenerCount: this.listeners.get(event).length 
        });
      }
      
      return () => this.off(event, callback);
    }
  }

  /**
   * 一度だけ実行されるイベントリスナーを登録
   * @param {string} event - イベント名
   * @param {Function} callback - コールバック関数
   * @returns {Function} リスナー解除関数
   */
  once(event, callback) {
    const onceWrapper = (data) => {
      this.off(event, onceWrapper);
      callback(data);
    };
    
    return this.on(event, onceWrapper);
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
    const filteredListeners = eventListeners.filter(listener => listener !== callback);
    
    if (filteredListeners.length === 0) {
      this.listeners.delete(event);
      
      if (this.debugMode) {
        this.logger.debug(`すべてのリスナーを削除: ${event}`);
      }
    } else {
      this.listeners.set(event, filteredListeners);
      
      if (this.debugMode) {
        this.logger.debug(`リスナーを削除: ${event}`, { 
          removedCount: eventListeners.length - filteredListeners.length,
          remainingCount: filteredListeners.length 
        });
      }
    }
  }

  /**
   * ワイルドカードリスナーを解除
   * @param {Object} wildcardListener - ワイルドカードリスナーオブジェクト
   */
  offWildcard(wildcardListener) {
    const index = this.wildcardListeners.indexOf(wildcardListener);
    if (index !== -1) {
      this.wildcardListeners.splice(index, 1);
      
      if (this.debugMode) {
        this.logger.debug(`ワイルドカードリスナーを削除`, { 
          pattern: wildcardListener.pattern.toString() 
        });
      }
    }
  }

  /**
   * イベントを発行
   * @param {string} event - イベント名
   * @param {*} data - イベントデータ
   */
  emit(event, data) {
    // イベント履歴に追加
    if (this.eventHistory !== null) {
      this.eventHistory.push({
        event,
        data,
        timestamp: new Date().toISOString()
      });
      
      // 履歴の上限を超えた場合、古いものから削除
      if (this.eventHistory.length > this.historyLimit) {
        this.eventHistory.shift();
      }
    }
    
    if (this.debugMode) {
      this.logger.debug(`イベント発行: ${event}`, { data });
    }
    
    // 通常のリスナーを呼び出し
    if (this.listeners.has(event)) {
      for (const listener of this.listeners.get(event)) {
        try {
          listener(data);
        } catch (error) {
          this.logger.error(`イベントリスナー(${event})でエラーが発生しました:`, error);
          
          // エラーイベントを発行
          if (event !== 'error') {
            this.emit('error', new EventError(`イベントリスナーでエラーが発生しました: ${event}`, {
              cause: error,
              context: { event, data }
            }));
          }
        }
      }
    }
    
    // ワイルドカードリスナーを呼び出し
    for (const { pattern, callback } of this.wildcardListeners) {
      if (pattern.test(event)) {
        try {
          callback(data, event);
        } catch (error) {
          this.logger.error(`ワイルドカードリスナー(${pattern})でエラーが発生しました:`, error);
          
          // エラーイベントを発行
          if (event !== 'error') {
            this.emit('error', new EventError(`ワイルドカードリスナーでエラーが発生しました: ${pattern}`, {
              cause: error,
              context: { event, data, pattern: pattern.toString() }
            }));
          }
        }
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
    // イベント履歴に追加
    if (this.eventHistory !== null) {
      this.eventHistory.push({
        event,
        data,
        timestamp: new Date().toISOString(),
        async: true
      });
      
      // 履歴の上限を超えた場合、古いものから削除
      if (this.eventHistory.length > this.historyLimit) {
        this.eventHistory.shift();
      }
    }
    
    if (this.debugMode) {
      this.logger.debug(`非同期イベント発行: ${event}`, { data });
    }
    
    const promises = [];
    
    // 通常のリスナーを非同期で呼び出し
    if (this.listeners.has(event)) {
      for (const listener of this.listeners.get(event)) {
        promises.push((async () => {
          try {
            await Promise.resolve(listener(data));
          } catch (error) {
            this.logger.error(`非同期イベントリスナー(${event})でエラーが発生しました:`, error);
            
            // エラーイベントを発行
            if (event !== 'error') {
              this.emit('error', new EventError(`非同期イベントリスナーでエラーが発生しました: ${event}`, {
                cause: error,
                context: { event, data }
              }));
            }
          }
        })());
      }
    }
    
    // ワイルドカードリスナーを非同期で呼び出し
    for (const { pattern, callback } of this.wildcardListeners) {
      if (pattern.test(event)) {
        promises.push((async () => {
          try {
            await Promise.resolve(callback(data, event));
          } catch (error) {
            this.logger.error(`非同期ワイルドカードリスナー(${pattern})でエラーが発生しました:`, error);
            
            // エラーイベントを発行
            if (event !== 'error') {
              this.emit('error', new EventError(`非同期ワイルドカードリスナーでエラーが発生しました: ${pattern}`, {
                cause: error,
                context: { event, data, pattern: pattern.toString() }
              }));
            }
          }
        })());
      }
    }
    
    await Promise.all(promises);
  }

  /**
   * イベントをシステム全体で標準化された名前で発行
   * @param {string} component - コンポーネント名
   * @param {string} action - アクション名
   * @param {Object} data - イベントデータ
   */
  emitStandardized(component, action, data = {}) {
    const standardEvent = `${component}:${action}`;
    const timestamp = new Date().toISOString();
    const standardizedData = { 
      ...data, 
      timestamp, 
      component, 
      action 
    };
    
    this.emit(standardEvent, standardizedData);
    
    // グローバルイベントも発行
    this.emit('event', { 
      type: standardEvent, 
      ...standardizedData 
    });
  }

  /**
   * 非同期イベントをシステム全体で標準化された名前で発行
   * @param {string} component - コンポーネント名
   * @param {string} action - アクション名
   * @param {Object} data - イベントデータ
   * @returns {Promise<void>}
   */
  async emitStandardizedAsync(component, action, data = {}) {
    const standardEvent = `${component}:${action}`;
    const timestamp = new Date().toISOString();
    const standardizedData = { 
      ...data, 
      timestamp, 
      component, 
      action 
    };
    
    await this.emitAsync(standardEvent, standardizedData);
    
    // グローバルイベントも発行
    await this.emitAsync('event', { 
      type: standardEvent, 
      ...standardizedData 
    });
  }

  /**
   * 登録されているイベント一覧を取得
   * @returns {Array<string>} イベント名の配列
   */
  getRegisteredEvents() {
    return Array.from(this.listeners.keys());
  }

  /**
   * 登録されているワイルドカードパターン一覧を取得
   * @returns {Array<string>} ワイルドカードパターンの配列
   */
  getRegisteredWildcardPatterns() {
    return this.wildcardListeners.map(({ pattern }) => pattern.toString());
  }

  /**
   * 特定イベントのリスナー数を取得
   * @param {string} event - イベント名
   * @returns {number} リスナー数
   */
  listenerCount(event) {
    let count = this.listeners.has(event) ? this.listeners.get(event).length : 0;
    
    // ワイルドカードリスナーもカウント
    for (const { pattern } of this.wildcardListeners) {
      if (pattern.test(event)) {
        count++;
      }
    }
    
    return count;
  }

  /**
   * イベント履歴を取得
   * @param {number} limit - 取得する履歴の最大数
   * @returns {Array<Object>} イベント履歴
   */
  getEventHistory(limit = this.historyLimit) {
    if (this.eventHistory === null) {
      throw new EventError('イベント履歴が有効になっていません');
    }
    
    return this.eventHistory.slice(-limit);
  }

  /**
   * デバッグモードを設定
   * @param {boolean} enabled - 有効にするかどうか
   */
  setDebugMode(enabled) {
    this.debugMode = enabled;
    this.logger.debug(`デバッグモードを${enabled ? '有効' : '無効'}にしました`);
  }

  /**
   * すべてのリスナーを削除
   */
  removeAllListeners() {
    this.listeners.clear();
    this.wildcardListeners = [];
    
    if (this.debugMode) {
      this.logger.debug('すべてのリスナーを削除しました');
    }
  }
}

module.exports = {
  EnhancedEventEmitter,
  EventError
};
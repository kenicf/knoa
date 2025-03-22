/**
 * イベントシステム
 *
 * コンポーネント間の疎結合な連携を実現するためのイベント駆動アーキテクチャを提供します。
 * 標準的なイベントエミッターの機能に加え、ワイルドカードパターンのサポート、
 * イベント名の標準化、非同期イベント処理などの拡張機能を提供します。
 *
 * イベント名の標準化とイベントカタログの機能を強化し、
 * イベント駆動アーキテクチャへの移行を支援します。
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
   * @param {Object} logger - ロガーインスタンス
   * @param {Object} options - 追加オプション
   * @param {boolean} options.debugMode - デバッグモードを有効にするかどうか
   * @param {boolean} options.keepHistory - イベント履歴を保持するかどうか
   * @param {number} options.historyLimit - イベント履歴の最大数
   */
  constructor(logger, options = {}) {
    this.listeners = new Map();
    this.wildcardListeners = [];
    this.debugMode = options.debugMode || false;
    
    // ロガーの設定（デフォルトのロガーを提供）
    this.logger = logger || {
      debug: console.debug.bind(console),
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console)
    };
    
    // イベント履歴の設定（デフォルトで有効）
    this.eventHistory = options.keepHistory !== false ? [] : null;
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
          // ロガーが存在する場合のみログ出力
          if (this.logger && typeof this.logger.error === 'function') {
            this.logger.error(`イベントリスナー(${event})でエラーが発生しました:`, error);
          } else {
            console.error(`イベントリスナー(${event})でエラーが発生しました:`, error);
          }
          
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
            // ロガーが存在する場合のみログ出力
            if (this.logger && typeof this.logger.error === 'function') {
              this.logger.error(`非同期イベントリスナー(${event})でエラーが発生しました:`, error);
            } else {
              console.error(`非同期イベントリスナー(${event})でエラーが発生しました:`, error);
            }
            
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
            // ロガーが存在する場合のみログ出力
            if (this.logger && typeof this.logger.error === 'function') {
              this.logger.error(`非同期ワイルドカードリスナー(${pattern})でエラーが発生しました:`, error);
            } else {
              console.error(`非同期ワイルドカードリスナー(${pattern})でエラーが発生しました:`, error);
            }
            
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
   * イベント名が標準形式に準拠しているか検証
   * @param {string} eventName - 検証するイベント名
   * @returns {boolean} 準拠している場合はtrue
   */
  validateEventName(eventName) {
    // グローバルイベントは例外
    if (eventName === 'event' || eventName === 'error') {
      return true;
    }
    
    const pattern = /^[a-z][a-z0-9]*:[a-z][a-z0-9]*$/;
    return pattern.test(eventName);
  }
  
  /**
   * 標準化されたイベント名を生成
   * @param {string} component - コンポーネント名
   * @param {string} action - アクション名
   * @returns {string} 標準化されたイベント名
   */
  createStandardEventName(component, action) {
    const normalizedComponent = component.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalizedAction = action.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${normalizedComponent}:${normalizedAction}`;
  }

  /**
   * イベントをシステム全体で標準化された名前で発行
   * @param {string} component - コンポーネント名
   * @param {string} action - アクション名
   * @param {Object} data - イベントデータ
   * @param {Object} options - オプション
   * @param {boolean} options.validateName - イベント名を検証するかどうか
   */
  emitStandardized(component, action, data = {}, options = {}) {
    const standardEvent = this.createStandardEventName(component, action);
    
    // イベント名の検証（オプション）
    if (options.validateName !== false) {
      const isValid = this.validateEventName(standardEvent);
      if (!isValid) {
        this.logger.warn(`非標準のイベント名: ${standardEvent}`);
      }
    }
    
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
    
    if (this.debugMode) {
      this.logger.debug(`[EVENT] ${standardEvent}`, standardizedData);
    }
  }

  /**
   * 非同期イベントをシステム全体で標準化された名前で発行
   * @param {string} component - コンポーネント名
   * @param {string} action - アクション名
   * @param {Object} data - イベントデータ
   * @param {Object} options - オプション
   * @param {boolean} options.validateName - イベント名を検証するかどうか
   * @returns {Promise<void>}
   */
  async emitStandardizedAsync(component, action, data = {}, options = {}) {
    const standardEvent = this.createStandardEventName(component, action);
    
    // イベント名の検証（オプション）
    if (options.validateName !== false && !this.validateEventName(standardEvent)) {
      this.logger.warn(`非標準のイベント名: ${standardEvent}`);
    }
    
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
    
    if (this.debugMode) {
      this.logger.debug(`[ASYNC EVENT] ${standardEvent}`, standardizedData);
    }
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
      this.logger.warn('イベント履歴が有効になっていません');
      return [];
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

  /**
   * イベントカタログを設定
   * @param {EventCatalog} catalog - イベントカタログ
   */
  setCatalog(catalog) {
    this.catalog = catalog;
  }
  
  /**
   * イベントカタログからイベント定義を取得
   * @param {string} eventName - イベント名
   * @returns {Object|null} イベント定義またはnull
   */
  getEventDefinition(eventName) {
    return this.catalog ? this.catalog.getEventDefinition(eventName) : null;
  }
  
  /**
   * カタログに登録されているイベントを発行
   * @param {string} eventName - カタログに登録されているイベント名
   * @param {Object} data - イベントデータ
   * @throws {EventError} イベントがカタログに登録されていない場合
   */
  emitCataloged(eventName, data = {}) {
    if (!this.catalog) {
      throw new EventError('イベントカタログが設定されていません');
    }
    
    const definition = this.catalog.getEventDefinition(eventName);
    if (!definition) {
      throw new EventError(`イベント "${eventName}" はカタログに登録されていません`);
    }
    
    // イベント名からコンポーネントとアクションを抽出
    const [component, action] = eventName.split(':');
    
    // 標準化されたイベントを発行
    this.emitStandardized(component, action, data);
  }
}

/**
 * イベントカタログクラス
 * システム全体で使用されるイベントの定義と説明を管理
 */
class EventCatalog {
  /**
   * コンストラクタ
   */
  constructor() {
    this.events = new Map();
    this.categories = new Set();
  }
  
  /**
   * イベント定義を登録
   * @param {string} eventName - イベント名
   * @param {Object} definition - イベント定義
   * @param {string} definition.description - イベントの説明
   * @param {Object} definition.schema - イベントデータのスキーマ
   * @param {string} definition.category - イベントのカテゴリ
   * @param {string[]} definition.examples - 使用例
   */
  registerEvent(eventName, definition) {
    this.events.set(eventName, {
      name: eventName,
      description: definition.description || '',
      schema: definition.schema || {},
      category: definition.category || 'uncategorized',
      examples: definition.examples || []
    });
    
    this.categories.add(definition.category || 'uncategorized');
  }
  
  /**
   * イベント定義を取得
   * @param {string} eventName - イベント名
   * @returns {Object|null} イベント定義またはnull
   */
  getEventDefinition(eventName) {
    return this.events.get(eventName) || null;
  }
  
  /**
   * カテゴリ別のイベント一覧を取得
   * @param {string} category - カテゴリ名
   * @returns {Array<Object>} イベント定義の配列
   */
  getEventsByCategory(category) {
    const result = [];
    for (const [name, definition] of this.events.entries()) {
      if (definition.category === category) {
        result.push(definition);
      }
    }
    return result;
  }
  
  /**
   * すべてのイベント定義を取得
   * @returns {Array<Object>} イベント定義の配列
   */
  getAllEvents() {
    return Array.from(this.events.values());
  }
  
  /**
   * すべてのカテゴリを取得
   * @returns {Array<string>} カテゴリの配列
   */
  getAllCategories() {
    return Array.from(this.categories);
  }
}

module.exports = {
  EnhancedEventEmitter,
  EventError,
  EventCatalog
};
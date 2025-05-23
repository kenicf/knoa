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
const OperationContext = require('./operation-context');

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
      recoverable:
        options.recoverable !== undefined ? options.recoverable : true,
    });
  }
}

/**
 * 拡張イベントエミッタークラス
 */
class EnhancedEventEmitter {
  /**
   * コンストラクタ
   * @param {Object|Object} loggerOrOptions - ロガーインスタンスまたはオプション
   * @param {Object} options - 追加オプション
   * @param {boolean} options.debugMode - デバッグモードを有効にするかどうか
   * @param {boolean} options.keepHistory - イベント履歴を保持するかどうか
   * @param {number} options.historyLimit - イベント履歴の最大数
   */
  constructor(loggerOrOptions, options = {}) {
    this.listeners = new Map();
    this.wildcardListeners = [];

    // 引数の処理
    let logger;
    let opts;

    if (
      loggerOrOptions &&
      typeof loggerOrOptions === 'object' &&
      loggerOrOptions.logger
    ) {
      // 最初の引数がオプションオブジェクトの場合
      logger = loggerOrOptions.logger;
      opts = loggerOrOptions;
    } else {
      // 最初の引数がロガーの場合
      logger = loggerOrOptions;
      opts = options;
    }

    this.debugMode = opts.debugMode || false;

    // ロガーの設定（デフォルトのロガーを提供）
    this.logger = logger || {
      // eslint-disable-next-line no-console
      debug: console.debug.bind(console),
      // eslint-disable-next-line no-console
      info: console.info.bind(console),
      // eslint-disable-next-line no-console
      warn: console.warn.bind(console),
      // eslint-disable-next-line no-console
      error: console.error.bind(console),
    };

    // イベント履歴の設定（デフォルトで有効）
    this.eventHistory = opts.keepHistory !== false ? [] : null;
    this.historyLimit = opts.historyLimit || 100;

    // エラー状態の初期化
    this.errorOccurred = false;
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
      // 特殊文字をエスケープしてからワイルドカードを正規表現に変換
      const escapedEvent = event.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // eslint-disable-next-line security/detect-non-literal-regexp
      const pattern = new RegExp(
        '^' + escapedEvent.replace(/\\\*/g, '.*') + '$'
      );
      const wildcardListener = { pattern, callback };
      this.wildcardListeners.push(wildcardListener);

      if (this.debugMode) {
        this.logger.debug(`ワイルドカードリスナーを登録: ${event}`, {
          pattern: pattern.toString(),
        });
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
          listenerCount: this.listeners.get(event).length,
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
    const filteredListeners = eventListeners.filter(
      (listener) => listener !== callback
    );

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
          remainingCount: filteredListeners.length,
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
          pattern: wildcardListener.pattern.toString(),
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
        timestamp: new Date().toISOString(),
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
            this.logger.error(
              `イベントリスナー(${event})でエラーが発生しました:`,
              error
            );
          } else {
            // eslint-disable-next-line no-console
            console.error(
              `イベントリスナー(${event})でエラーが発生しました:`,
              error
            );
          }

          // エラーイベントを発行
          if (event !== 'error') {
            this.emit(
              'error',
              new EventError(
                `イベントリスナーでエラーが発生しました: ${event}`,
                {
                  cause: error,
                  context: { event, data },
                }
              )
            );
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
          this.logger.error(
            `ワイルドカードリスナー(${pattern})でエラーが発生しました:`,
            error
          );

          // エラーイベントを発行
          if (event !== 'error') {
            this.emit(
              'error',
              new EventError(
                `ワイルドカードリスナーでエラーが発生しました: ${pattern}`,
                {
                  cause: error,
                  context: { event, data, pattern: pattern.toString() },
                }
              )
            );
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
        async: true,
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
        promises.push(
          (async () => {
            try {
              await Promise.resolve(listener(data));
            } catch (error) {
              // ロガーが存在する場合のみログ出力
              if (this.logger && typeof this.logger.error === 'function') {
                this.logger.error(
                  `非同期イベントリスナー(${event})でエラーが発生しました:`,
                  error
                );
              } else {
                // eslint-disable-next-line no-console
                console.error(
                  `非同期イベントリスナー(${event})でエラーが発生しました:`,
                  error
                );
              }

              // エラーイベントを発行
              if (event !== 'error') {
                this.emit(
                  'error',
                  new EventError(
                    `非同期イベントリスナーでエラーが発生しました: ${event}`,
                    {
                      cause: error,
                      context: { event, data },
                    }
                  )
                );
              }
            }
          })()
        );
      }
    }

    // ワイルドカードリスナーを非同期で呼び出し
    for (const { pattern, callback } of this.wildcardListeners) {
      if (pattern.test(event)) {
        promises.push(
          (async () => {
            try {
              await Promise.resolve(callback(data, event));
            } catch (error) {
              // ロガーが存在する場合のみログ出力
              if (this.logger && typeof this.logger.error === 'function') {
                this.logger.error(
                  `非同期ワイルドカードリスナー(${pattern})でエラーが発生しました:`,
                  error
                );
              } else {
                // eslint-disable-next-line no-console
                console.error(
                  `非同期ワイルドカードリスナー(${pattern})でエラーが発生しました:`,
                  error
                );
              }

              // エラーイベントを発行
              if (event !== 'error') {
                this.emit(
                  'error',
                  new EventError(
                    `非同期ワイルドカードリスナーでエラーが発生しました: ${pattern}`,
                    {
                      cause: error,
                      context: { event, data, pattern: pattern.toString() },
                    }
                  )
                );
              }
            }
          })()
        );
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

    // 標準形式のパターン：
    // - component:action
    // - component:entity_action
    // - component:entity_action_state
    const pattern = /^[a-z][a-z0-9]*:[a-z][a-z0-9_]*$/;
    return pattern.test(eventName);
  }

  /**
   * 標準化されたイベント名を生成
   * @param {string} component - コンポーネント名
   * @param {string} action - アクション名
   * @returns {string} 標準化されたイベント名
   */
  createStandardEventName(component, action) {
    // コンポーネント名とアクション名を小文字に変換し、ハイフンとアンダースコアを除去
    const formattedComponent = component.toLowerCase().replace(/[-_]/g, '');
    const formattedAction = action.toLowerCase().replace(/[-_]/g, '');
    return `${formattedComponent}:${formattedAction}`;
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
    // 標準化されたイベント名を生成
    const standardEvent = `${component}:${action}`;

    // イベント名の検証（オプション）
    if (options.validateName !== false) {
      const isValid = this.validateEventName(standardEvent);
      if (!isValid && this.logger && typeof this.logger.warn === 'function') {
        this.logger.warn(`非標準のイベント名: ${standardEvent}`);
      }
    }

    const timestamp = new Date().toISOString();
    const standardizedData = {
      ...data,
      timestamp,
      component,
      action,
    };

    // コンポーネント固有のイベントを発行
    this.emit(standardEvent, standardizedData);

    // グローバルイベントも発行
    this.emit('event', {
      type: standardEvent,
      ...standardizedData,
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
    // 標準化されたイベント名を生成
    const standardEvent = `${component}:${action}`;

    // イベント名の検証（オプション）
    if (
      options.validateName !== false &&
      !this.validateEventName(standardEvent) &&
      this.logger &&
      typeof this.logger.warn === 'function'
    ) {
      this.logger.warn(`非標準のイベント名: ${standardEvent}`);
    }

    const timestamp = new Date().toISOString();
    const standardizedData = {
      ...data,
      timestamp,
      component,
      action,
    };

    // コンポーネント固有のイベントを発行
    await this.emitAsync(standardEvent, standardizedData);

    // グローバルイベントも発行
    await this.emitAsync('event', {
      type: standardEvent,
      ...standardizedData,
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
    let count = this.listeners.has(event)
      ? this.listeners.get(event).length
      : 0;

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
      if (this.logger && typeof this.logger.warn === 'function') {
        this.logger.warn('イベント履歴が有効になっていません');
      }
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
    if (this.logger && typeof this.logger.debug === 'function') {
      this.logger.debug(
        `デバッグモードを${enabled ? '有効' : '無効'}にしました`
      );
    }
  }

  /**
   * エラー状態をリセット
   */
  resetErrorState() {
    this.errorOccurred = false;
    if (this.debugMode && this.logger) {
      this.logger.debug('エラー状態をリセットしました');
    }
  }

  /**
   * 新しい操作コンテキストを作成
   * @param {Object} metadata - コンテキストメタデータ
   * @param {OperationContext} parentContext - 親コンテキスト（オプション）
   * @returns {OperationContext} 新しい操作コンテキスト
   */
  createContext(metadata = {}, parentContext = null) {
    return new OperationContext({
      logger: this.logger,
      metadata,
      parentContext,
    });
  }

  /**
   * コンテキスト付きイベント発行
   * @param {string} event - イベント名
   * @param {*} data - イベントデータ
   * @param {OperationContext} context - 操作コンテキスト
   */
  emitWithContext(event, data, context) {
    // コンテキストにエラーがある場合はイベント発行をスキップ
    if (context && context.hasError()) {
      if (this.debugMode) {
        this.logger.debug(
          `イベント ${event} はコンテキスト ${context.id} でエラーが発生しているためスキップされました`
        );
      }
      return;
    }

    // コンテキスト情報をデータに追加
    const enhancedData = {
      ...data,
      _context: context ? context.id : null,
    };

    // 通常のイベント発行
    this.emit(event, enhancedData);
  }

  /**
   * 標準化されたイベントをコンテキスト付きで発行
   * @param {string} component - コンポーネント名
   * @param {string} action - アクション名
   * @param {Object} data - イベントデータ
   * @param {OperationContext} context - 操作コンテキスト
   * @param {Object} options - オプション
   */
  emitStandardizedWithContext(
    component,
    action,
    data = {},
    context,
    options = {}
  ) {
    // コンテキストにエラーがある場合はイベント発行をスキップ
    if (context && context.hasError()) {
      if (this.debugMode) {
        this.logger.debug(
          `イベント ${component}:${action} はコンテキスト ${context.id} でエラーが発生しているためスキップされました`
        );
      }
      return;
    }

    // コンテキスト情報をデータに追加
    const enhancedData = {
      ...data,
      _context: context ? context.id : null,
    };

    // 標準化されたイベント発行
    this.emitStandardized(component, action, enhancedData, options);
  }

  /**
   * エラーイベントを発行
   * @param {Error} error - エラーオブジェクト
   * @param {string} component - コンポーネント名
   * @param {string} operation - 操作名
   * @param {OperationContext} context - 操作コンテキスト
   * @param {Object} details - 追加詳細情報
   */
  emitError(error, component, operation, context, details = {}) {
    // エラー状態を設定
    this.errorOccurred = true;

    // コンテキストにエラー状態を設定
    if (context && typeof context.setError === 'function') {
      try {
        context.setError(error, component, operation, details);
      } catch (err) {
        // コンテキストのエラー設定に失敗した場合はログに出力
        if (this.logger && typeof this.logger.warn === 'function') {
          this.logger.warn(
            `コンテキストのエラー設定に失敗しました: ${err.message}`
          );
        }
      }
    }

    // エラーログを出力
    if (this.logger && typeof this.logger.error === 'function') {
      this.logger.error(`Error in ${component}.${operation}:`, error, details);
    }

    // エラーイベントを発行
    const errorData = {
      component,
      operation,
      message: error.message,
      code: error.code || 'ERR_UNKNOWN',
      name: error.name || 'Error',
      timestamp: new Date().toISOString(),
      recoverable: error.recoverable !== undefined ? error.recoverable : true,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      details,
      _context: context && context.id ? context.id : null,
    };

    // 標準化されたイベント名でエラーイベントを発行
    this.emit('app:error', errorData);

    // 後方互換性のために古いイベント名でも発行
    if (component) {
      this.emit(`${component}:error`, errorData);
    }

    // グローバルエラーイベントも発行
    this.emit('error', {
      type: 'app:error',
      ...errorData,
    });
  }

  /**
   * すべてのリスナーを削除
   */
  removeAllListeners() {
    this.listeners.clear();
    this.wildcardListeners = [];

    if (
      this.debugMode &&
      this.logger &&
      typeof this.logger.debug === 'function'
    ) {
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
   * カタログに登録されたイベントを発行
   * @param {string} eventName - イベント名
   * @param {Object} data - イベントデータ
   * @returns {boolean} 成功したかどうか
   */
  emitCataloged(eventName, data = {}) {
    if (!this.catalog) {
      // カタログがない場合はエラーをスロー
      throw new EventError('イベントカタログが設定されていません', {
        code: 'ERR_EVENT_CATALOG_NOT_SET',
      });
    }

    const eventDef = this.catalog.getEventDefinition(eventName);
    if (!eventDef) {
      // 未登録イベントの場合はエラーをスロー
      throw new EventError(`未登録のイベント: ${eventName}`, {
        code: 'ERR_EVENT_NOT_REGISTERED',
        context: { eventName },
      });
    }

    const [component, action] = eventName.split(':');
    this.emitStandardized(component, action, data);

    return true;
  }
}

/**
 * イベントカタログクラス
 * イベント名と定義を管理するためのカタログ
 */
class EventCatalog {
  /**
   * コンストラクタ
   */
  constructor() {
    this.events = new Map();
    this.categories = new Map();
  }

  /**
   * イベントを登録
   * @param {string} eventName - イベント名（component:action形式）
   * @param {Object} definition - イベント定義
   * @returns {boolean} 成功したかどうか
   */
  registerEvent(eventName, definition) {
    if (!eventName.includes(':')) {
      // イベント名形式が不正な場合は警告ログを出力して失敗
      if (this.logger && typeof this.logger.warn === 'function') {
        this.logger.warn(`不正なイベント名形式: ${eventName}`);
      }
      return false;
    }

    const [category] = eventName.split(':');
    // デフォルト値を持つ完全な定義オブジェクトを作成
    const fullDefinition = {
      name: eventName,
      description: definition.description || '',
      category: definition.category || category || 'uncategorized', // カテゴリがなければイベント名から推測、それもなければ 'uncategorized'
      schema: definition.schema || {},
      examples: definition.examples || [],
      ...definition, // 渡された定義で上書き
    };
    this.events.set(eventName, fullDefinition);

    const currentCategory = fullDefinition.category; // デフォルト値適用後のカテゴリを使用
    // カテゴリが存在しない場合は初期化
    if (!this.categories.has(currentCategory)) {
      this.categories.set(currentCategory, []);
    }
    // 初期化後に push する
    this.categories.get(currentCategory).push(eventName);
    return true;
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
   * カテゴリに属するイベント一覧を取得
   * @param {string} category - カテゴリ名
   * @returns {Array<string>} イベント名の配列
   */
  getEventsByCategory(category) {
    if (!this.categories.has(category)) {
      return [];
    }

    return this.categories.get(category).map((eventName) => ({
      name: eventName,
      definition: this.events.get(eventName),
    }));
  }

  /**
   * すべてのイベントを取得
   * @returns {Array<Object>} イベント一覧
   */
  getAllEvents() {
    return Array.from(this.events.entries()).map(([name, definition]) => ({
      name,
      definition,
    }));
  }

  /**
   * すべてのカテゴリを取得
   * @returns {Array<string>} カテゴリ名の配列
   */
  getAllCategories() {
    return Array.from(this.categories.keys());
  }
}

module.exports = {
  EventError,
  EnhancedEventEmitter,
  EventCatalog,
};

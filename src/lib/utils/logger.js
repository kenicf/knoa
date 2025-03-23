/**
 * ロガークラス
 * 
 * デバッグと監視のためのロギングシステムを提供します。
 */

/**
 * ロガークラス
 */
class Logger {
  /**
   * コンストラクタ
   * @param {Object} options - オプション
   */
  constructor(options = {}) {
    this.level = options.level || 'info';
    this.levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
      fatal: 4
    };
    
    this.transports = options.transports || [
      {
        type: 'console',
        write: (entry) => console.log(JSON.stringify(entry))
      }
    ];
    
    // コンテキスト情報取得関数
    this.contextProviders = options.contextProviders || {};
    
    // イベントエミッター
    this.eventEmitter = options.eventEmitter;
    
    // トレースID生成
    this.traceIdGenerator = options.traceIdGenerator || (() => `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    this.requestIdGenerator = options.requestIdGenerator || (() => `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  }
  
  /**
   * ログ出力
   * @param {string} level - ログレベル
   * @param {string} message - メッセージ
   * @param {Object} [context] - コンテキスト情報
   */
  log(level, message, context = {}) {
    if (this.levels[level] < this.levels[this.level]) {
      return;
    }
    
    // 基本情報
    const timestamp = new Date().toISOString();
    const traceId = context.trace_id || context.traceId || this.traceIdGenerator();
    const requestId = context.request_id || context.requestId || this.requestIdGenerator();
    
    const entry = {
      timestamp,
      level,
      message,
      context: {
        ...context,
        trace_id: traceId,
        request_id: requestId,
        traceId,
        requestId
      }
    };
    
    // 追加コンテキスト情報
    for (const [key, provider] of Object.entries(this.contextProviders)) {
      try {
        entry.context[key] = provider();
      } catch (error) {
        entry.context[`${key}_error`] = error.message;
      }
    }
    
    // 各トランスポートにログを出力
    for (const transport of this.transports) {
      try {
        transport.write(entry);
      } catch (error) {
        console.error(`ログ出力中にエラーが発生しました(${transport.type}):`, error);
      }
    }
    
    // イベント発行
    if (this.eventEmitter) {
      // 新しい標準化されたイベント名を使用
      if (typeof this.eventEmitter.emitStandardized === 'function') {
        this.eventEmitter.emitStandardized('log', 'message_created', {
          ...entry,
          traceId,
          requestId
        });
      } else {
        // 後方互換性のため
        this.eventEmitter.emit('log:entry', entry);
        
        // 開発環境では警告を表示
        if (process.env.NODE_ENV === 'development') {
          console.warn('非推奨のイベント名 log:entry が使用されています。代わりに log:message_created を使用してください。');
        }
      }
    }
    
    // 重大度に応じて通知
    if (level === 'error' || level === 'fatal') {
      this._sendAlert(entry);
    }
  }
  
  /**
   * デバッグログ
   * @param {string} message - メッセージ
   * @param {Object} [context] - コンテキスト情報
   */
  debug(message, context) {
    this.log('debug', message, context);
  }
  
  /**
   * 情報ログ
   * @param {string} message - メッセージ
   * @param {Object} [context] - コンテキスト情報
   */
  info(message, context) {
    this.log('info', message, context);
  }
  
  /**
   * 警告ログ
   * @param {string} message - メッセージ
   * @param {Object} [context] - コンテキスト情報
   */
  warn(message, context) {
    this.log('warn', message, context);
  }
  
  /**
   * エラーログ
   * @param {string} message - メッセージ
   * @param {Object} [context] - コンテキスト情報
   */
  error(message, context) {
    this.log('error', message, context);
  }
  
  /**
   * 致命的エラーログ
   * @param {string} message - メッセージ
   * @param {Object} [context] - コンテキスト情報
   */
  fatal(message, context) {
    this.log('fatal', message, context);
  }
  
  /**
   * アラートを送信
   * @param {Object} entry - ログエントリ
   * @private
   */
  _sendAlert(entry) {
    // アラート送信ロジック（通知システムとの連携）
    // 実際の実装はプラグインや設定によって異なる
    if (this.eventEmitter) {
      // 新しい標準化されたイベント名を使用
      if (typeof this.eventEmitter.emitStandardized === 'function') {
        this.eventEmitter.emitStandardized('log', 'alert_created', {
          ...entry,
          traceId: entry.context.traceId || entry.context.trace_id,
          requestId: entry.context.requestId || entry.context.request_id
        });
      } else {
        // 後方互換性のため
        this.eventEmitter.emit('log:alert', entry);
        
        // 開発環境では警告を表示
        if (process.env.NODE_ENV === 'development') {
          console.warn('非推奨のイベント名 log:alert が使用されています。代わりに log:alert_created を使用してください。');
        }
      }
    }
  }
  
  /**
   * トランスポートを追加
   * @param {Object} transport - トランスポート
   */
  addTransport(transport) {
    this.transports.push(transport);
    
    if (this.eventEmitter) {
      const timestamp = new Date().toISOString();
      const traceId = this.traceIdGenerator();
      const requestId = this.requestIdGenerator();
      
      // 新しい標準化されたイベント名を使用
      if (typeof this.eventEmitter.emitStandardized === 'function') {
        this.eventEmitter.emitStandardized('log', 'transport_added', {
          type: transport.type,
          timestamp,
          traceId,
          requestId
        });
      } else {
        // 後方互換性のため
        this.eventEmitter.emit('log:transport_added', {
          type: transport.type,
          timestamp
        });
        
        // 開発環境では警告を表示
        if (process.env.NODE_ENV === 'development') {
          console.warn('非推奨のイベント名 log:transport_added が使用されています。代わりに log:transport_added を使用してください。');
        }
      }
    }
  }
  
  /**
   * コンテキストプロバイダを追加
   * @param {string} key - キー
   * @param {Function} provider - プロバイダ関数
   */
  addContextProvider(key, provider) {
    this.contextProviders[key] = provider;
    
    if (this.eventEmitter) {
      const timestamp = new Date().toISOString();
      const traceId = this.traceIdGenerator();
      const requestId = this.requestIdGenerator();
      
      // 新しい標準化されたイベント名を使用
      if (typeof this.eventEmitter.emitStandardized === 'function') {
        this.eventEmitter.emitStandardized('log', 'context_provider_added', {
          key,
          timestamp,
          traceId,
          requestId
        });
      } else {
        // 後方互換性のため
        this.eventEmitter.emit('log:context_provider_added', {
          key,
          timestamp
        });
        
        // 開発環境では警告を表示
        if (process.env.NODE_ENV === 'development') {
          console.warn('非推奨のイベント名 log:context_provider_added が使用されています。代わりに log:context_provider_added を使用してください。');
        }
      }
    }
  }
}

module.exports = Logger;
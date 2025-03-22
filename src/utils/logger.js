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
    const entry = {
      timestamp,
      level,
      message,
      context: { ...context }
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
  }
  
  /**
   * トランスポートを追加
   * @param {Object} transport - トランスポート
   */
  addTransport(transport) {
    this.transports.push(transport);
  }
  
  /**
   * コンテキストプロバイダを追加
   * @param {string} key - キー
   * @param {Function} provider - プロバイダ関数
   */
  addContextProvider(key, provider) {
    this.contextProviders[key] = provider;
  }
}

module.exports = Logger;
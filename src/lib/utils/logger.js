/**
 * ロガークラス
 *
 * デバッグと監視のためのロギングシステムを提供します。
 */

// TODO: Step 5 で emitStandardizedEvent ヘルパーを利用するか検討
// const { emitStandardizedEvent } = require('./event-helpers');

/**
 * ロガークラス
 */
class Logger {
  /**
   * コンストラクタ
   * @param {Object} options - オプション
   * @param {string} [options.level='info'] - ログレベル
   * @param {Array} [options.transports] - ログ出力先トランスポート
   * @param {Object} [options.contextProviders={}] - コンテキストプロバイダ
   * @param {Object} [options.eventEmitter] - イベントエミッターインスタンス
   * @param {Function} [options.traceIdGenerator] - トレースID生成関数
   * @param {Function} [options.requestIdGenerator] - リクエストID生成関数
   */
  constructor(options = {}) {
    this.level = options.level || 'info';
    this.levels = Object.freeze({
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
      fatal: 4,
    });

    this.transports = options.transports || [
      {
        type: 'console',
        // console.log は ESLint で警告が出るため、本番環境では適切なトランスポートに置き換えるべき
        write: (entry) => console.log(JSON.stringify(entry)),
      },
    ];

    // コンテキスト情報取得関数
    this.contextProviders = options.contextProviders || {};

    // イベントエミッター (必須ではないかもしれないが、現状維持)
    this.eventEmitter = options.eventEmitter;

    // トレースID生成 (TODO: Step 5 で集約)
    this.traceIdGenerator =
      options.traceIdGenerator ||
      (() => `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    this.requestIdGenerator =
      options.requestIdGenerator ||
      (() => `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  }

  /**
   * ログ出力
   * @param {string} level - ログレベル
   * @param {string} message - メッセージ
   * @param {Object} [context] - コンテキスト情報
   */
  log(level, message, context = {}) {
    // level が levels オブジェクト自身のプロパティであることを確認
    if (
      !Object.prototype.hasOwnProperty.call(this.levels, level) ||
      // eslint-disable-next-line security/detect-object-injection
      this.levels[level] < this.levels[this.level]
    ) {
      return;
    }

    // 基本情報
    const timestamp = new Date().toISOString();
    // ID生成ロジックはここで実行 (Step 5 で見直し)
    const traceId =
      context.trace_id || context.traceId || this.traceIdGenerator();
    const requestId =
      context.request_id || context.requestId || this.requestIdGenerator();

    const entry = {
      timestamp,
      level,
      message,
      context: {
        ...context,
        // traceId/requestId を優先し、古い snake_case は削除も検討
        trace_id: traceId,
        request_id: requestId,
        traceId,
        requestId,
      },
    };

    // 追加コンテキスト情報
    for (const [key, provider] of Object.entries(this.contextProviders)) {
      // 安全でないキーへの代入を防ぐ
      if (key !== '__proto__' && key !== 'constructor') {
        try {
          // eslint-disable-next-line security/detect-object-injection
          entry.context[key] = provider();
        } catch (error) {
          entry.context[`${key}_error`] = error.message;
        }
      }
    }

    // 各トランスポートにログを出力
    for (const transport of this.transports) {
      try {
        transport.write(entry);
      } catch (error) {
        // ロガー自身の内部エラーは console.error で出力
        console.error(
          `ログ出力中にエラーが発生しました(${transport.type}):`,
          error
        );
      }
    }

    // イベント発行 (emitStandardized に統一)
    if (
      this.eventEmitter &&
      typeof this.eventEmitter.emitStandardized === 'function'
    ) {
      this.eventEmitter.emitStandardized('log', 'message_created', {
        ...entry,
        // emitStandardized 側で traceId/requestId が付与される想定だが、
        // Logger 内部で生成したものを渡す
        traceId,
        requestId,
      });
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
    if (
      this.eventEmitter &&
      typeof this.eventEmitter.emitStandardized === 'function'
    ) {
      // emitStandardized に統一
      this.eventEmitter.emitStandardized('log', 'alert_created', {
        ...entry,
        // Logger 内部で生成した traceId/requestId を渡す
        traceId: entry.context.traceId || entry.context.trace_id,
        requestId: entry.context.requestId || entry.context.request_id,
      });
    }
  }

  /**
   * トランスポートを追加
   * @param {Object} transport - トランスポート
   */
  addTransport(transport) {
    if (!transport || typeof transport.write !== 'function') {
      this.error('Invalid transport object provided to addTransport.', {
        transport,
      });
      return;
    }
    this.transports.push(transport);

    if (
      this.eventEmitter &&
      typeof this.eventEmitter.emitStandardized === 'function'
    ) {
      // ID生成はここで行う (Step 5 で見直し)
      const timestamp = new Date().toISOString();
      const traceId = this.traceIdGenerator();
      const requestId = this.requestIdGenerator();

      // emitStandardized に統一
      this.eventEmitter.emitStandardized('log', 'transport_added', {
        type: transport.type || 'unknown', // タイプがない場合を考慮
        timestamp,
        traceId,
        requestId,
      });
    }
  }

  /**
   * コンテキストプロバイダを追加
   * @param {string} key - キー
   * @param {Function} provider - プロバイダ関数
   */
  addContextProvider(key, provider) {
    if (!key || typeof provider !== 'function') {
      this.error('Invalid arguments provided to addContextProvider.', {
        key,
        providerType: typeof provider,
      });
      return;
    }
    this.contextProviders[key] = provider;

    if (
      this.eventEmitter &&
      typeof this.eventEmitter.emitStandardized === 'function'
    ) {
      // ID生成はここで行う (Step 5 で見直し)
      const timestamp = new Date().toISOString();
      const traceId = this.traceIdGenerator();
      const requestId = this.requestIdGenerator();

      // emitStandardized に統一
      this.eventEmitter.emitStandardized('log', 'context_provider_added', {
        key,
        timestamp,
        traceId,
        requestId,
      });
    }
  }
}

module.exports = Logger;

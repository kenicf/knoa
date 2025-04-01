/**
 * アダプターベースクラス
 *
 * すべてのアダプターの基底クラスとして機能し、共通の機能を提供します。
 */

const { ValidationError } = require('../../lib/utils/errors');

/**
 * アダプターベースクラス
 */
class BaseAdapter {
  /**
   * コンストラクタ
   * @param {Object} manager - 管理クラスのインスタンス（必須）
   * @param {Object} options - 追加オプション
   * @param {Object} options.logger - ロガー
   * @param {Object} options.errorHandler - エラーハンドラー
   * @param {Object} options.eventEmitter - イベントエミッター
   */
  constructor(manager, options = {}) {
    if (!manager) {
      throw new Error('Manager is required');
    }

    this.manager = manager;
    this.logger = options.logger || console;
    this.errorHandler = options.errorHandler;
    this.eventEmitter = options.eventEmitter;
  }

  /**
   * 操作コンテキストを作成
   * @param {string} operation - 操作名
   * @param {Object} metadata - メタデータ
   * @param {OperationContext} parentContext - 親コンテキスト（オプション）
   * @returns {OperationContext} 操作コンテキスト
   */
  _createContext(operation, metadata = {}, parentContext = null) {
    if (!this.eventEmitter) {
      return null;
    }

    return this.eventEmitter.createContext(
      {
        component: this.constructor.name,
        operation,
        ...metadata,
      },
      parentContext
    );
  }

  /**
   * エラー処理メソッド
   * @param {Error} error - エラーオブジェクト
   * @param {string} operation - 操作名
   * @param {OperationContext} context - 操作コンテキスト
   * @param {Object} details - 追加詳細情報
   * @returns {Object} 処理されたエラー情報
   * @protected
   */
  _handleError(error, operation, context = null, details = {}) {
    // ApplicationErrorでない場合はラップする
    const { ApplicationError } = require('../../lib/core/error-framework');
    if (!(error instanceof ApplicationError)) {
      const wrappedError = new ApplicationError(error.message, {
        cause: error,
        context: {
          component: this.constructor.name,
          operation,
          ...details,
        },
      });
      error = wrappedError;
    }

    // エラーハンドラーが存在する場合はそちらに委譲
    if (this.errorHandler && typeof this.errorHandler.handle === 'function') {
      return this.errorHandler.handle(error, this.constructor.name, operation, {
        context: context ? context.id : null,
        ...details,
      });
    }

    // エラーイベントを発行 (修正: _emitErrorEvent を使用)
    this._emitErrorEvent(error, operation, context, details);

    // イベントエミッターがない場合の直接ログ出力は _emitErrorEvent 内で行われるため削除

    // 構造化されたエラー情報を返す
    return {
      error: true,
      message: error.message,
      code: error.code || 'UNKNOWN_ERROR',
      operation,
      name: error.name || 'Error',
      timestamp: new Date().toISOString(),
      context: context ? context.id : null,
      recoverable: error.recoverable !== undefined ? error.recoverable : true,
      details:
        typeof details === 'object' ? JSON.stringify(details) : String(details),
    };
  }

  /**
   * パラメータ検証メソッド
   * @param {Object} params - 検証するパラメータ
   * @param {Array<string>} required - 必須パラメータのリスト
   * @throws {ValidationError} 検証エラー
   * @protected
   */
  _validateParams(params, required = []) {
    if (!params) {
      throw new ValidationError('Parameters are required');
    }

    for (const param of required) {
      // params オブジェクト自身がプロパティを持っているかを確認 (プロトタイプ汚染対策)
      if (!Object.prototype.hasOwnProperty.call(params, param)) {
        throw new ValidationError(`Parameter '${param}' is required`);
      }
    }
  }

  /**
   * イベントを発行（修正版）
   * @param {string} component - コンポーネント名
   * @param {string} action - アクション名
   * @param {Object} data - イベントデータ
   * @param {OperationContext} context - 操作コンテキスト
   * @param {boolean} [bridgeOldEvents=true] - 古いイベント名もサポートするかどうか
   * @protected
   */
  _emitEvent(
    component,
    action,
    data = {},
    context = null,
    bridgeOldEvents = true
  ) {
    if (!this.eventEmitter) {
      return;
    }

    // コンテキストにエラーがある場合はイベント発行をスキップ
    if (context && context.hasError()) {
      if (this.eventEmitter.debugMode) {
        this.logger.debug(
          `イベント ${component}:${action} はコンテキスト ${context.id} でエラーが発生しているためスキップされました`
        );
      }
      return;
    }

    // グローバルなエラー状態をチェック
    if (this.eventEmitter.errorOccurred) {
      if (this.eventEmitter.debugMode) {
        this.logger.debug(
          `イベント ${component}:${action} はエラー発生のためスキップされました`
        );
      }
      return;
    }

    try {
      // イベント名の定数マッピングをインポート
      const { EVENT_MAP } = require('../../lib/core/event-constants');

      // 標準化されたイベント名
      const standardEvent = `${component}:${action}`;

      // コンテキスト情報をデータに追加
      const enhancedData = {
        ...data,
        _context: context ? context.id : null,
        timestamp: data.timestamp || new Date().toISOString(),
      };

      // コンテキスト付きイベント発行が利用可能な場合はそちらを使用
      if (
        context &&
        typeof this.eventEmitter.emitStandardizedWithContext === 'function'
      ) {
        this.eventEmitter.emitStandardizedWithContext(
          component,
          action,
          enhancedData,
          context,
          { bridgeOldEvents }
        );
      } else {
        // 標準化されたイベント発行
        this.eventEmitter.emit(standardEvent, enhancedData);

        // グローバルイベントも発行
        this.eventEmitter.emit('event', {
          type: standardEvent,
          ...enhancedData,
        });
      }

      // 古いイベント名のサポート（オプション）
      if (bridgeOldEvents) {
        // EVENT_MAP 自身がプロパティを持っているかを確認 (プロトタイプ汚染対策)
        if (Object.prototype.hasOwnProperty.call(EVENT_MAP, standardEvent)) {
          // eslint-disable-next-line security/detect-object-injection
          const oldEventName = EVENT_MAP[standardEvent];
          this.eventEmitter.emit(oldEventName, enhancedData);

          // 警告ログを出力（開発環境のみ）
          if (
            process.env.NODE_ENV === 'development' &&
            this.eventEmitter.logger
          ) {
            this.eventEmitter.logger.warn(
              `非推奨のイベント名 ${oldEventName} が使用されています。代わりに ${standardEvent} を使用してください。`,
              {
                oldEventName,
                standardEvent,
                timestamp: enhancedData.timestamp,
              }
            );
          }
        }
      }
    } catch (error) {
      this.logger.warn(
        `イベント発行中にエラーが発生しました: ${component}:${action}`,
        error
      );

      // エラー処理
      if (context) {
        this._handleError(error, `emit_${action}`, context, {
          component,
          action,
          data,
        });
      }
    }
  }

  /**
   * エラーイベントを発行
   * @param {Error} error - エラーオブジェクト
   * @param {string} operation - 操作名
   * @param {OperationContext} context - 操作コンテキスト
   * @param {Object} details - 追加詳細情報
   * @protected
   */
  _emitErrorEvent(error, operation, context = null, details = {}) {
    if (!this.eventEmitter) {
      return;
    }

    const component = this.constructor.name
      .replace('Adapter', '')
      .toLowerCase();

    if (typeof this.eventEmitter.emitError === 'function') {
      this.eventEmitter.emitError(
        error,
        component,
        operation,
        context,
        details
      );
    } else {
      // 後方互換性のため
      const { emitErrorEvent } = require('../../lib/utils/error-helpers');
      emitErrorEvent(
        this.eventEmitter,
        this.logger,
        component,
        operation,
        error,
        context,
        details
      );
    }
  }
}

module.exports = BaseAdapter;

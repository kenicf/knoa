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
   * @param {Function} [options.traceIdGenerator] - トレースID生成関数
   * @param {Function} [options.requestIdGenerator] - リクエストID生成関数
   */
  constructor(options = {}) {
    // デフォルト引数を追加
    // logger を必須にする
    if (!options.logger) {
      // options が undefined でもエラーになるように修正
      throw new Error('Logger instance is required in EventEmitter options.');
    }
    // ID ジェネレーターを取得またはデフォルトを設定
    const traceIdGenerator =
      options.traceIdGenerator ||
      (() => `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    const requestIdGenerator =
      options.requestIdGenerator ||
      (() => `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

    // super() に keepHistory と historyLimit を渡すように修正
    super(options.logger, {
      debugMode: options.debugMode || false,
      keepHistory: options.keepHistory || false, // オプションを渡す
      historyLimit: options.historyLimit || 100, // オプションを渡す
    });
    // ID ジェネレーターをインスタンスプロパティとして保存
    this._traceIdGenerator = traceIdGenerator;
    this._requestIdGenerator = requestIdGenerator;
  }

  // on, off, emit, emitAsync, getRegisteredEvents, listenerCount は
  // 親クラス EnhancedEventEmitter の実装をそのまま利用するため、オーバーライドを削除

  /**
   * 標準化されたイベントを発行
   * @param {string} component - コンポーネント名
   * @param {string} action - アクション名
   * @param {*} [data={}] - イベントデータ
   * @returns {boolean} リスナーが呼び出されたかどうか
   */
  emitStandardized(component, action, data = {}) {
    const standardEvent = `${component}:${action}`;
    const timestamp = new Date().toISOString();
    // ID ジェネレーターを使用して ID を生成
    const traceId = this._traceIdGenerator();
    const requestId = this._requestIdGenerator();
    const standardizedData = {
      ...data,
      timestamp,
      component,
      action,
      traceId, // 生成した ID を追加
      requestId, // 生成した ID を追加
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
   * @returns {Promise<boolean>} リスナーが呼び出されたかどうか (非同期)
   */
  async emitStandardizedAsync(component, action, data = {}) {
    const standardEvent = `${component}:${action}`;
    const timestamp = new Date().toISOString();
    // ID ジェネレーターを使用して ID を生成
    const traceId = this._traceIdGenerator();
    const requestId = this._requestIdGenerator();
    const standardizedData = {
      ...data,
      timestamp,
      component,
      action,
      traceId, // 生成した ID を追加
      requestId, // 生成した ID を追加
    };

    // 標準化されたイベントを発行
    const result = await super.emitAsync(standardEvent, standardizedData);

    // グローバルイベントも発行 (type を含める)
    await super.emitAsync('event', {
      type: standardEvent,
      ...standardizedData,
    });

    return result;
  }
}

module.exports = EventEmitter;

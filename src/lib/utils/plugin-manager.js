/**
 * プラグインマネージャー
 *
 * 拡張性を確保するためのプラグイン機構を提供します。
 */

// TODO: Step 5 で emitStandardizedEvent ヘルパーを利用するか検討
// const { emitStandardizedEvent } = require('./event-helpers');

/**
 * プラグインマネージャークラス
 */
class PluginManager {
  /**
   * コンストラクタ
   * @param {Object} options - オプション
   * @param {Object} options.logger - ロガーインスタンス (必須)
   * @param {Object} [options.eventEmitter] - イベントエミッターインスタンス
   */
  constructor(options = {}) {
    // logger を必須にする
    if (!options.logger) {
      throw new Error('Logger instance is required in PluginManager options.');
    }
    this.plugins = new Map();
    this.logger = options.logger;
    this.eventEmitter = options.eventEmitter; // EventEmitter はオプショナルのまま

    // TODO: Step 5 で ID 生成を集約
    this._traceIdGenerator =
      options.traceIdGenerator ||
      (() => `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    this._requestIdGenerator =
      options.requestIdGenerator ||
      (() => `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  }

  /**
   * プラグインを登録
   * @param {string} pluginType - プラグインタイプ
   * @param {Object} pluginImplementation - プラグイン実装
   * @returns {boolean} 登録成功したかどうか
   */
  registerPlugin(pluginType, pluginImplementation) {
    if (!this._validatePlugin(pluginType, pluginImplementation)) {
      this.logger.error(`プラグイン ${pluginType} の検証に失敗しました`);

      if (this.eventEmitter && typeof this.eventEmitter.emitStandardized === 'function') {
        const traceId = this._traceIdGenerator();
        const requestId = this._requestIdGenerator();
        this.eventEmitter.emitStandardized('plugin', 'validation_failed', {
          pluginType,
          timestamp: new Date().toISOString(), // emitStandardized内で付与されるが明示的に追加
          traceId,
          requestId,
        });
      }

      return false;
    }

    this.plugins.set(pluginType, pluginImplementation);
    this.logger.info(`プラグイン ${pluginType} を登録しました`);

    // 初期化メソッドがあれば呼び出す
    if (typeof pluginImplementation.initialize === 'function') {
      try {
        pluginImplementation.initialize();
      } catch (error) {
        this.logger.error(
          `プラグイン ${pluginType} の初期化中にエラーが発生しました:`,
          error
        );

        if (this.eventEmitter && typeof this.eventEmitter.emitStandardized === 'function') {
           const traceId = this._traceIdGenerator();
           const requestId = this._requestIdGenerator();
          this.eventEmitter.emitStandardized('plugin', 'initialization_error', {
            pluginType,
            error: error.message,
            timestamp: new Date().toISOString(),
            traceId,
            requestId,
          });
        }
      }
    }

    if (this.eventEmitter && typeof this.eventEmitter.emitStandardized === 'function') {
       const traceId = this._traceIdGenerator();
       const requestId = this._requestIdGenerator();
      this.eventEmitter.emitStandardized('plugin', 'registered', {
        pluginType,
        hasInitialize: typeof pluginImplementation.initialize === 'function',
        hasCleanup: typeof pluginImplementation.cleanup === 'function',
        timestamp: new Date().toISOString(),
        traceId,
        requestId,
      });
    }

    return true;
  }

  /**
   * プラグインメソッドを呼び出し
   * @param {string} pluginType - プラグインタイプ
   * @param {string} methodName - メソッド名
   * @param  {...any} args - 引数
   * @returns {Promise<*>} メソッドの戻り値
   */
  async invokePlugin(pluginType, methodName, ...args) {
    const plugin = this.plugins.get(pluginType);
    const traceId = this._traceIdGenerator(); // 各イベントで共通のIDを使用
    const requestId = this._requestIdGenerator();

    if (!plugin || typeof plugin[methodName] !== 'function') {
      if (this.eventEmitter && typeof this.eventEmitter.emitStandardized === 'function') {
        this.eventEmitter.emitStandardized('plugin', 'method_not_found', {
          pluginType,
          methodName,
          timestamp: new Date().toISOString(),
          traceId,
          requestId,
        });
      }
      // エラーを返すか、nullを返すか検討 (既存の挙動はnull)
      this.logger.warn(`プラグインメソッドが見つかりません: ${pluginType}.${methodName}`);
      return null;
    }

    try {
      if (this.eventEmitter && typeof this.eventEmitter.emitStandardized === 'function') {
        this.eventEmitter.emitStandardized('plugin', 'method_invoked', {
          pluginType,
          methodName,
          timestamp: new Date().toISOString(),
          traceId,
          requestId,
        });
      }

      const result = await plugin[methodName](...args);

      if (this.eventEmitter && typeof this.eventEmitter.emitStandardized === 'function') {
        this.eventEmitter.emitStandardized('plugin', 'method_completed', {
          pluginType,
          methodName,
          // result を含めるか検討
          timestamp: new Date().toISOString(),
          traceId,
          requestId,
        });
      }

      return result;
    } catch (error) {
      this.logger.error(
        `プラグイン ${pluginType}.${methodName} の呼び出し中にエラーが発生しました:`,
        error
      );

      if (this.eventEmitter && typeof this.eventEmitter.emitStandardized === 'function') {
        this.eventEmitter.emitStandardized('plugin', 'method_error', {
          pluginType,
          methodName,
          error: error.message,
          timestamp: new Date().toISOString(),
          traceId,
          requestId,
        });
      }

      throw error; // エラーを再スロー
    }
  }

  /**
   * 特定タイプのプラグインが存在するか確認
   * @param {string} pluginType - プラグインタイプ
   * @returns {boolean} プラグインが存在するかどうか
   */
  hasPlugin(pluginType) {
    return this.plugins.has(pluginType);
  }

  /**
   * プラグインを削除
   * @param {string} pluginType - プラグインタイプ
   * @returns {boolean} 削除成功したかどうか
   */
  unregisterPlugin(pluginType) {
    const plugin = this.plugins.get(pluginType);

    if (!plugin) {
      return false;
    }

    // クリーンアップメソッドがあれば呼び出す
    if (typeof plugin.cleanup === 'function') {
      try {
        plugin.cleanup();
      } catch (error) {
        this.logger.error(
          `プラグイン ${pluginType} のクリーンアップ中にエラーが発生しました:`,
          error
        );

        if (this.eventEmitter && typeof this.eventEmitter.emitStandardized === 'function') {
           const traceId = this._traceIdGenerator();
           const requestId = this._requestIdGenerator();
          this.eventEmitter.emitStandardized('plugin', 'cleanup_error', {
            pluginType,
            error: error.message,
            timestamp: new Date().toISOString(),
            traceId,
            requestId,
          });
        }
        // クリーンアップエラーが発生しても削除処理は続行する
      }
    }

    const deleted = this.plugins.delete(pluginType);
    if (deleted) {
        this.logger.info(`プラグイン ${pluginType} を削除しました`);

        if (this.eventEmitter && typeof this.eventEmitter.emitStandardized === 'function') {
           const traceId = this._traceIdGenerator();
           const requestId = this._requestIdGenerator();
          this.eventEmitter.emitStandardized('plugin', 'unregistered', {
            pluginType,
            timestamp: new Date().toISOString(),
            traceId,
            requestId,
          });
        }
    }


    return deleted;
  }

  /**
   * 登録されているプラグイン一覧を取得
   * @returns {Array<string>} プラグインタイプの配列
   */
  getRegisteredPlugins() {
    return Array.from(this.plugins.keys());
  }

  /**
   * プラグインを検証
   * @param {string} pluginType - プラグインタイプ
   * @param {Object} pluginImplementation - プラグイン実装
   * @returns {boolean} 検証結果
   * @private
   */
  _validatePlugin(pluginType, pluginImplementation) {
    if (!pluginType || typeof pluginType !== 'string') {
       this.logger.warn('プラグインタイプの検証に失敗: タイプが文字列ではありません。', { pluginType });
      return false;
    }

    // 配列もオブジェクトとして扱わないように Array.isArray() を追加
    if (!pluginImplementation || typeof pluginImplementation !== 'object' || Array.isArray(pluginImplementation)) {
       this.logger.warn(`プラグイン実装の検証に失敗 (${pluginType}): 実装がオブジェクトではありません。`, { pluginImplementation });
      return false;
    }

    // プラグインタイプに応じた必須メソッドを検証
    switch (pluginType) {
      case 'ci':
        if (typeof pluginImplementation.runTests !== 'function') {
           this.logger.warn(`プラグイン検証失敗 (${pluginType}): runTests メソッドが必要です。`);
           return false;
        }
        break;
      case 'notification':
         if (typeof pluginImplementation.sendNotification !== 'function') {
           this.logger.warn(`プラグイン検証失敗 (${pluginType}): sendNotification メソッドが必要です。`);
           return false;
        }
        break;
      case 'report':
         if (typeof pluginImplementation.generateReport !== 'function') {
           this.logger.warn(`プラグイン検証失敗 (${pluginType}): generateReport メソッドが必要です。`);
           return false;
        }
        break;
      case 'storage':
        if (
          typeof pluginImplementation.save !== 'function' ||
          typeof pluginImplementation.load !== 'function'
        ) {
           this.logger.warn(`プラグイン検証失敗 (${pluginType}): save および load メソッドが必要です。`);
           return false;
        }
        break;
      default:
        // 汎用プラグインの場合は最低限のチェックのみ
        if (Object.keys(pluginImplementation).length === 0) {
            this.logger.warn(`プラグイン検証失敗 (${pluginType}): 実装が空のオブジェクトです。`);
            return false;
        }
        break;
    }
     return true; // すべてのチェックをパスした場合
  }
}

module.exports = PluginManager;

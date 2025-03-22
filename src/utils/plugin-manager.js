/**
 * プラグインマネージャー
 * 
 * 拡張性を確保するためのプラグイン機構を提供します。
 */

/**
 * プラグインマネージャークラス
 */
class PluginManager {
  /**
   * コンストラクタ
   * @param {Object} options - オプション
   */
  constructor(options = {}) {
    this.plugins = new Map();
    this.logger = options.logger || console;
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
      return false;
    }
    
    this.plugins.set(pluginType, pluginImplementation);
    this.logger.info(`プラグイン ${pluginType} を登録しました`);
    
    // 初期化メソッドがあれば呼び出す
    if (typeof pluginImplementation.initialize === 'function') {
      try {
        pluginImplementation.initialize();
      } catch (error) {
        this.logger.error(`プラグイン ${pluginType} の初期化中にエラーが発生しました:`, error);
      }
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
    
    if (!plugin || typeof plugin[methodName] !== 'function') {
      return null;
    }
    
    try {
      return await plugin[methodName](...args);
    } catch (error) {
      this.logger.error(`プラグイン ${pluginType}.${methodName} の呼び出し中にエラーが発生しました:`, error);
      throw error;
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
        this.logger.error(`プラグイン ${pluginType} のクリーンアップ中にエラーが発生しました:`, error);
      }
    }
    
    this.plugins.delete(pluginType);
    this.logger.info(`プラグイン ${pluginType} を削除しました`);
    
    return true;
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
      return false;
    }
    
    if (!pluginImplementation || typeof pluginImplementation !== 'object') {
      return false;
    }
    
    // プラグインタイプに応じた必須メソッドを検証
    switch (pluginType) {
      case 'ci':
        return typeof pluginImplementation.runTests === 'function';
      case 'notification':
        return typeof pluginImplementation.sendNotification === 'function';
      case 'report':
        return typeof pluginImplementation.generateReport === 'function';
      case 'storage':
        return typeof pluginImplementation.save === 'function' && 
               typeof pluginImplementation.load === 'function';
      default:
        // 汎用プラグインの場合は最低限のチェックのみ
        return true;
    }
  }
}

module.exports = PluginManager;
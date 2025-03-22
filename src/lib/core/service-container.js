/**
 * サービスコンテナ
 * 
 * 依存性注入のためのサービスコンテナを提供します。
 * サービスの登録、取得、ファクトリー関数のサポート、循環参照の検出などの機能を提供します。
 */

/**
 * サービスコンテナクラス
 */
class ServiceContainer {
  /**
   * コンストラクタ
   */
  constructor() {
    this.services = new Map();
    this.factories = new Map();
    this.resolving = new Set(); // 循環参照検出用
  }

  /**
   * サービスを登録
   * @param {string} name - サービス名
   * @param {any} instance - サービスインスタンス
   * @returns {ServiceContainer} このインスタンス（チェーン呼び出し用）
   */
  register(name, instance) {
    this.services.set(name, instance);
    return this;
  }

  /**
   * ファクトリー関数を登録
   * @param {string} name - サービス名
   * @param {Function} factory - ファクトリー関数
   * @returns {ServiceContainer} このインスタンス（チェーン呼び出し用）
   */
  registerFactory(name, factory) {
    this.factories.set(name, factory);
    return this;
  }

  /**
   * サービスを取得
   * @param {string} name - サービス名
   * @returns {any} サービスインスタンス
   * @throws {Error} サービスが見つからない場合、または循環参照が検出された場合
   */
  get(name) {
    // サービスが既に登録されているか確認
    if (this.services.has(name)) {
      return this.services.get(name);
    }
    
    // ファクトリーが登録されているか確認
    if (this.factories.has(name)) {
      // 循環参照のチェック
      if (this.resolving.has(name)) {
        throw new Error(`循環参照が検出されました: ${Array.from(this.resolving).join(' -> ')} -> ${name}`);
      }
      
      // 解決中のサービスとしてマーク
      this.resolving.add(name);
      
      try {
        // ファクトリー関数を実行してインスタンスを作成
        const factory = this.factories.get(name);
        const instance = factory(this);
        
        // インスタンスをキャッシュ
        this.services.set(name, instance);
        
        return instance;
      } finally {
        // 解決中のマークを解除
        this.resolving.delete(name);
      }
    }
    
    throw new Error(`サービス '${name}' が見つかりません`);
  }

  /**
   * サービスが登録されているか確認
   * @param {string} name - サービス名
   * @returns {boolean} 登録されているかどうか
   */
  has(name) {
    return this.services.has(name) || this.factories.has(name);
  }

  /**
   * サービスを削除
   * @param {string} name - サービス名
   * @returns {boolean} 削除されたかどうか
   */
  remove(name) {
    const serviceRemoved = this.services.delete(name);
    const factoryRemoved = this.factories.delete(name);
    return serviceRemoved || factoryRemoved;
  }

  /**
   * すべてのサービスをクリア
   */
  clear() {
    this.services.clear();
    this.factories.clear();
    this.resolving.clear();
  }

  /**
   * 登録されているすべてのサービス名を取得
   * @returns {Array<string>} サービス名の配列
   */
  getRegisteredServiceNames() {
    return [
      ...new Set([
        ...Array.from(this.services.keys()),
        ...Array.from(this.factories.keys())
      ])
    ];
  }
}

module.exports = ServiceContainer;
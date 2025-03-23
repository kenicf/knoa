/**
 * 操作コンテキスト
 * イベント連鎖の状態を追跡し、エラー状態を管理します。
 */

class OperationContext {
  /**
   * コンストラクタ
   * @param {Object} options - オプション
   * @param {string} options.id - コンテキストID（省略時は自動生成）
   * @param {Object} options.logger - ロガーインスタンス
   * @param {OperationContext} options.parentContext - 親コンテキスト
   * @param {Object} options.metadata - メタデータ
   */
  constructor(options = {}) {
    this.id = options.id || `ctx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.startTime = new Date();
    this.errorOccurred = false;
    this.errorDetails = null;
    this.parentContext = options.parentContext || null;
    this.metadata = options.metadata || {};
    this.logger = options.logger || console;
  }
  
  /**
   * エラー状態を設定
   * @param {Error} error - エラーオブジェクト
   * @param {string} component - コンポーネント名
   * @param {string} operation - 操作名
   * @param {Object} details - 追加詳細情報
   */
  setError(error, component, operation, details = {}) {
    this.errorOccurred = true;
    this.errorDetails = {
      message: error.message,
      code: error.code || 'ERR_UNKNOWN',
      component,
      operation,
      timestamp: new Date().toISOString(),
      details
    };
    
    // ロガーへのエラー出力
    if (this.logger && typeof this.logger.error === 'function') {
      this.logger.error(`Error in ${component}.${operation}:`, error, details);
    }
    
    // 親コンテキストにもエラーを伝播
    if (this.parentContext && typeof this.parentContext.setError === 'function') {
      this.parentContext.setError(error, component, operation, details);
    }
  }
  
  /**
   * エラー状態をチェック
   * @returns {boolean} エラーが発生している場合はtrue
   */
  hasError() {
    return this.errorOccurred;
  }
  
  /**
   * コンテキスト情報を取得
   * @returns {Object} コンテキスト情報
   */
  getInfo() {
    return {
      id: this.id,
      startTime: this.startTime,
      duration: new Date() - this.startTime,
      hasError: this.errorOccurred,
      errorDetails: this.errorDetails,
      metadata: this.metadata
    };
  }
  
  /**
   * 子コンテキストを作成
   * @param {Object} metadata - メタデータ
   * @returns {OperationContext} 子コンテキスト
   */
  createChildContext(metadata = {}) {
    return new OperationContext({
      logger: this.logger,
      parentContext: this,
      metadata: {
        ...this.metadata,
        ...metadata
      }
    });
  }
}

module.exports = OperationContext;
/**
 * アダプターベースクラス
 * 
 * すべてのアダプターの基底クラスとして機能し、共通の機能を提供します。
 */

const { ValidationError } = require('../../utils/errors');

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
   */
  constructor(manager, options = {}) {
    if (!manager) {
      throw new Error('Manager is required');
    }
    
    this.manager = manager;
    this.logger = options.logger || console;
    this.errorHandler = options.errorHandler;
  }
  
  /**
   * エラー処理メソッド
   * @param {Error} error - エラーオブジェクト
   * @param {string} operation - 操作名
   * @param {Object} context - コンテキスト情報
   * @returns {Error} 処理されたエラー
   * @protected
   */
  _handleError(error, operation, context = {}) {
    if (this.errorHandler && typeof this.errorHandler.handle === 'function') {
      return this.errorHandler.handle(error, this.constructor.name, operation, context);
    }
    
    this.logger.error(`Error in ${this.constructor.name}.${operation}:`, error);
    throw error;
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
      if (params[param] === undefined) {
        throw new ValidationError(`Parameter '${param}' is required`);
      }
    }
  }
}

module.exports = BaseAdapter;
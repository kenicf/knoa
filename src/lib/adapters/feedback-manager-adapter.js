/**
 * フィードバック管理アダプター
 * 
 * フィードバック管理コンポーネントをラップし、統合マネージャーとのインターフェースを提供します。
 */

const { ValidationError } = require('../../utils/errors');
const BaseAdapter = require('./base-adapter');

/**
 * フィードバック管理アダプター
 */
class FeedbackManagerAdapter extends BaseAdapter {
  /**
   * コンストラクタ
   * @param {Object} feedbackManager - フィードバック管理インスタンス
   * @param {Object} options - 追加オプション
   * @param {Object} options.logger - ロガー
   * @param {Object} options.errorHandler - エラーハンドラー
   */
  constructor(feedbackManager, options = {}) {
    super(feedbackManager, options);
  }
  
  /**
   * フィードバックの検証
   * @param {Object} feedback - フィードバックオブジェクト
   * @returns {Object} 検証結果 {isValid, errors, warnings}
   */
  validateFeedback(feedback) {
    try {
      const isValid = this.manager.validateFeedback(feedback);
      return { isValid, errors: [], warnings: [] };
    } catch (error) {
      return this._handleError(error, 'validateFeedback', { feedback });
    }
  }
  
  /**
   * 保留中のフィードバックを取得
   * @returns {Promise<Object|null>} 保留中のフィードバック
   */
  async getPendingFeedback() {
    try {
      return await this.manager.getPendingFeedback();
    } catch (error) {
      return this._handleError(error, 'getPendingFeedback');
    }
  }
  
  /**
   * タスクIDでフィードバックを取得
   * @param {string} taskId - タスクID
   * @returns {Promise<Object|null>} フィードバック
   */
  async getFeedbackByTaskId(taskId) {
    try {
      this._validateParams({ taskId }, ['taskId']);
      
      if (!taskId.match(/^T[0-9]{3}$/)) {
        throw new ValidationError('タスクIDはT000形式である必要があります');
      }
      
      return await this.manager.getFeedbackByTaskId(taskId);
    } catch (error) {
      return this._handleError(error, 'getFeedbackByTaskId', { taskId });
    }
  }
  
  /**
   * 新しいフィードバックを作成
   * @param {string} taskId - タスクID
   * @param {number} attempt - 実装の試行回数
   * @returns {Promise<Object>} 新しいフィードバック
   */
  async createNewFeedback(taskId, attempt) {
    try {
      this._validateParams({ taskId, attempt }, ['taskId']);
      
      if (!taskId.match(/^T[0-9]{3}$/)) {
        throw new ValidationError('タスクIDはT000形式である必要があります');
      }
      
      return await this.manager.createNewFeedback(taskId, attempt || 1);
    } catch (error) {
      return this._handleError(error, 'createNewFeedback', { taskId, attempt });
    }
  }
  
  /**
   * テスト結果を自動収集
   * @param {string} taskId - タスクID
   * @param {string} testCommand - テストコマンド
   * @param {Array} testTypes - テストの種類
   * @returns {Promise<Object>} 更新されたフィードバック
   */
  async collectTestResults(taskId, testCommand, testTypes) {
    try {
      this._validateParams({ taskId, testCommand }, ['taskId', 'testCommand']);
      
      return await this.manager.collectTestResults(taskId, testCommand, testTypes || []);
    } catch (error) {
      return this._handleError(error, 'collectTestResults', { taskId, testCommand, testTypes });
    }
  }
  
  /**
   * フィードバックの優先順位付け
   * @param {Object} feedback - フィードバック
   * @returns {Promise<Object>} 優先順位付けされたフィードバック
   */
  async prioritizeFeedback(feedback) {
    try {
      this._validateParams({ feedback }, ['feedback']);
      
      return await this.manager.prioritizeFeedback(feedback);
    } catch (error) {
      return this._handleError(error, 'prioritizeFeedback', { feedback });
    }
  }
  
  /**
   * フィードバックの状態を更新
   * @param {Object} feedback - フィードバック
   * @param {string} newStatus - 新しい状態
   * @returns {Promise<Object>} 更新されたフィードバック
   */
  async updateFeedbackStatus(feedback, newStatus) {
    try {
      this._validateParams({ feedback, newStatus }, ['feedback', 'newStatus']);
      
      if (!['open', 'in_progress', 'resolved', 'wontfix'].includes(newStatus)) {
        throw new ValidationError(`不正な状態です: ${newStatus}`);
      }
      
      return await this.manager.updateFeedbackStatus(feedback, newStatus);
    } catch (error) {
      return this._handleError(error, 'updateFeedbackStatus', { feedback, newStatus });
    }
  }
  
  /**
   * フィードバックをセッションと統合
   * @param {string} feedbackId - フィードバックID
   * @param {string} sessionId - セッションID
   * @returns {Promise<boolean>} 統合結果
   */
  async integrateFeedbackWithSession(feedbackId, sessionId) {
    try {
      this._validateParams({ feedbackId, sessionId }, ['feedbackId', 'sessionId']);
      
      return await this.manager.integrateFeedbackWithSession(feedbackId, sessionId);
    } catch (error) {
      return this._handleError(error, 'integrateFeedbackWithSession', { feedbackId, sessionId });
    }
  }
  
  /**
   * フィードバックをタスクと統合
   * @param {string} feedbackId - フィードバックID
   * @param {string} taskId - タスクID
   * @returns {Promise<boolean>} 統合結果
   */
  async integrateFeedbackWithTask(feedbackId, taskId) {
    try {
      this._validateParams({ feedbackId, taskId }, ['feedbackId', 'taskId']);
      
      return await this.manager.integrateFeedbackWithTask(feedbackId, taskId);
    } catch (error) {
      return this._handleError(error, 'integrateFeedbackWithTask', { feedbackId, taskId });
    }
  }
  
  /**
   * フィードバックマークダウンを生成
   * @param {string} taskId - タスクID
   * @returns {Promise<string>} マークダウン形式のフィードバック
   */
  async generateFeedbackMarkdown(taskId) {
    try {
      this._validateParams({ taskId }, ['taskId']);
      
      return await this.manager.generateFeedbackMarkdown(taskId);
    } catch (error) {
      return this._handleError(error, 'generateFeedbackMarkdown', { taskId });
    }
  }
}

module.exports = FeedbackManagerAdapter;
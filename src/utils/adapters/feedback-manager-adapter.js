/**
 * フィードバック管理アダプター
 * 
 * 既存のフィードバック管理コンポーネントをラップし、統合マネージャーとのインターフェースを提供します。
 */

const { ValidationError } = require('../errors');
const Validator = require('../validator');

/**
 * フィードバック管理インターフェース
 * @interface
 */
class FeedbackManagerInterface {
  /**
   * フィードバックの検証
   * @param {Object} feedback - フィードバックオブジェクト
   * @returns {Object} 検証結果 {isValid, errors, warnings}
   */
  validateFeedback(feedback) {}
  
  /**
   * 保留中のフィードバックを取得
   * @returns {Promise<Object|null>} 保留中のフィードバック
   */
  async getPendingFeedback() {}
  
  /**
   * タスクIDでフィードバックを取得
   * @param {string} taskId - タスクID
   * @returns {Promise<Object|null>} フィードバック
   */
  async getFeedbackByTaskId(taskId) {}
  
  /**
   * 新しいフィードバックを作成
   * @param {string} taskId - タスクID
   * @param {number} attempt - 実装の試行回数
   * @returns {Promise<Object>} 新しいフィードバック
   */
  async createNewFeedback(taskId, attempt) {}
  
  /**
   * テスト結果を自動収集
   * @param {string} taskId - タスクID
   * @param {string} testCommand - テストコマンド
   * @param {Array} testTypes - テストの種類
   * @returns {Promise<Object>} 更新されたフィードバック
   */
  async collectTestResults(taskId, testCommand, testTypes) {}
  
  /**
   * フィードバックの優先順位付け
   * @param {Object} feedback - フィードバック
   * @returns {Promise<Object>} 優先順位付けされたフィードバック
   */
  async prioritizeFeedback(feedback) {}
  
  /**
   * フィードバックの状態を更新
   * @param {Object} feedback - フィードバック
   * @param {string} newStatus - 新しい状態
   * @returns {Promise<Object>} 更新されたフィードバック
   */
  async updateFeedbackStatus(feedback, newStatus) {}
  
  /**
   * フィードバックをセッションと統合
   * @param {string} feedbackId - フィードバックID
   * @param {string} sessionId - セッションID
   * @returns {Promise<boolean>} 統合結果
   */
  async integrateFeedbackWithSession(feedbackId, sessionId) {}
  
  /**
   * フィードバックをタスクと統合
   * @param {string} feedbackId - フィードバックID
   * @param {string} taskId - タスクID
   * @returns {Promise<boolean>} 統合結果
   */
  async integrateFeedbackWithTask(feedbackId, taskId) {}
  
  /**
   * フィードバックマークダウンを生成
   * @param {string} taskId - タスクID
   * @returns {Promise<string>} マークダウン形式のフィードバック
   */
  async generateFeedbackMarkdown(taskId) {}
}

/**
 * フィードバック管理アダプター
 */
class FeedbackManagerAdapter extends FeedbackManagerInterface {
  /**
   * コンストラクタ
   * @param {Object} originalFeedbackManager - 元のフィードバック管理インスタンス
   */
  constructor(originalFeedbackManager) {
    super();
    this.originalFeedbackManager = originalFeedbackManager;
  }
  
  /**
   * フィードバックの検証
   * @param {Object} feedback - フィードバックオブジェクト
   * @returns {Object} 検証結果 {isValid, errors, warnings}
   */
  validateFeedback(feedback) {
    return this.originalFeedbackManager.validateFeedback(feedback);
  }
  
  /**
   * 保留中のフィードバックを取得
   * @returns {Promise<Object|null>} 保留中のフィードバック
   */
  async getPendingFeedback() {
    try {
      return this.originalFeedbackManager.getPendingFeedback();
    } catch (error) {
      console.error('保留中のフィードバックの取得に失敗しました:', error);
      throw error;
    }
  }
  
  /**
   * タスクIDでフィードバックを取得
   * @param {string} taskId - タスクID
   * @returns {Promise<Object|null>} フィードバック
   */
  async getFeedbackByTaskId(taskId) {
    try {
      if (!taskId || typeof taskId !== 'string') {
        throw new ValidationError('タスクIDは必須の文字列です');
      }
      
      if (!taskId.match(/^T[0-9]{3}$/)) {
        throw new ValidationError('タスクIDはT000形式である必要があります');
      }
      
      return this.originalFeedbackManager.getFeedbackByTaskId(taskId);
    } catch (error) {
      console.error(`タスクID ${taskId} のフィードバックの取得に失敗しました:`, error);
      throw error;
    }
  }
  
  /**
   * 新しいフィードバックを作成
   * @param {string} taskId - タスクID
   * @param {number} attempt - 実装の試行回数
   * @returns {Promise<Object>} 新しいフィードバック
   */
  async createNewFeedback(taskId, attempt = 1) {
    try {
      if (!taskId || typeof taskId !== 'string') {
        throw new ValidationError('タスクIDは必須の文字列です');
      }
      
      if (!taskId.match(/^T[0-9]{3}$/)) {
        throw new ValidationError('タスクIDはT000形式である必要があります');
      }
      
      if (attempt !== undefined && (!Number.isInteger(attempt) || attempt < 1)) {
        throw new ValidationError('attemptは1以上の整数である必要があります');
      }
      
      const feedback = this.originalFeedbackManager.createNewFeedback(taskId, attempt);
      
      if (!feedback) {
        throw new Error('フィードバックの作成に失敗しました');
      }
      
      // フィードバックを保存
      this.originalFeedbackManager.saveFeedback(feedback, true);
      
      return feedback;
    } catch (error) {
      console.error('新しいフィードバックの作成に失敗しました:', error);
      throw error;
    }
  }
  
  /**
   * テスト結果を自動収集
   * @param {string} taskId - タスクID
   * @param {string} testCommand - テストコマンド
   * @param {Array} testTypes - テストの種類
   * @returns {Promise<Object>} 更新されたフィードバック
   */
  async collectTestResults(taskId, testCommand, testTypes = ["unit"]) {
    try {
      if (!taskId || typeof taskId !== 'string') {
        throw new ValidationError('タスクIDは必須の文字列です');
      }
      
      if (!taskId.match(/^T[0-9]{3}$/)) {
        throw new ValidationError('タスクIDはT000形式である必要があります');
      }
      
      if (!testCommand || typeof testCommand !== 'string') {
        throw new ValidationError('テストコマンドは必須の文字列です');
      }
      
      if (testTypes !== undefined && !Array.isArray(testTypes)) {
        throw new ValidationError('testTypesは配列である必要があります');
      }
      
      const feedback = await this.originalFeedbackManager.collectTestResults(taskId, testCommand, testTypes);
      
      if (!feedback) {
        throw new Error('テスト結果の収集に失敗しました');
      }
      
      return feedback;
    } catch (error) {
      console.error('テスト結果の自動収集に失敗しました:', error);
      throw error;
    }
  }
  
  /**
   * フィードバックの優先順位付け
   * @param {Object} feedback - フィードバック
   * @returns {Promise<Object>} 優先順位付けされたフィードバック
   */
  async prioritizeFeedback(feedback) {
    try {
      const validation = this.validateFeedback(feedback);
      if (!validation.isValid) {
        throw new ValidationError(validation.errors.join(', '));
      }
      
      const prioritizedFeedback = this.originalFeedbackManager.prioritizeFeedback(feedback);
      
      // フィードバックを保存
      this.originalFeedbackManager.saveFeedback(prioritizedFeedback, true);
      
      return prioritizedFeedback;
    } catch (error) {
      console.error('フィードバックの優先順位付けに失敗しました:', error);
      throw error;
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
      const validation = this.validateFeedback(feedback);
      if (!validation.isValid) {
        throw new ValidationError(validation.errors.join(', '));
      }
      
      if (!newStatus || typeof newStatus !== 'string') {
        throw new ValidationError('新しい状態は必須の文字列です');
      }
      
      if (!['open', 'in_progress', 'resolved', 'wontfix'].includes(newStatus)) {
        throw new ValidationError('新しい状態は open, in_progress, resolved, wontfix のいずれかである必要があります');
      }
      
      const updatedFeedback = this.originalFeedbackManager.updateFeedbackStatus(feedback, newStatus);
      
      // フィードバックを保存
      const isPending = newStatus !== 'resolved' && newStatus !== 'wontfix';
      this.originalFeedbackManager.saveFeedback(updatedFeedback, isPending);
      
      // resolvedまたはwontfixの場合は履歴に移動
      if (newStatus === 'resolved' || newStatus === 'wontfix') {
        this.originalFeedbackManager.moveFeedbackToHistory(feedback.feedback_loop.task_id);
      }
      
      return updatedFeedback;
    } catch (error) {
      console.error('フィードバックの状態更新に失敗しました:', error);
      throw error;
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
      if (!feedbackId || typeof feedbackId !== 'string') {
        throw new ValidationError('フィードバックIDは必須の文字列です');
      }
      
      if (!sessionId || typeof sessionId !== 'string') {
        throw new ValidationError('セッションIDは必須の文字列です');
      }
      
      return await this.originalFeedbackManager.integrateFeedbackWithSession(feedbackId, sessionId);
    } catch (error) {
      console.error(`フィードバック ${feedbackId} とセッション ${sessionId} の統合に失敗しました:`, error);
      throw error;
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
      if (!feedbackId || typeof feedbackId !== 'string') {
        throw new ValidationError('フィードバックIDは必須の文字列です');
      }
      
      if (!taskId || typeof taskId !== 'string') {
        throw new ValidationError('タスクIDは必須の文字列です');
      }
      
      if (!taskId.match(/^T[0-9]{3}$/)) {
        throw new ValidationError('タスクIDはT000形式である必要があります');
      }
      
      return await this.originalFeedbackManager.integrateFeedbackWithTask(feedbackId, taskId);
    } catch (error) {
      console.error(`フィードバック ${feedbackId} とタスク ${taskId} の統合に失敗しました:`, error);
      throw error;
    }
  }
  
  /**
   * フィードバックマークダウンを生成
   * @param {string} taskId - タスクID
   * @returns {Promise<string>} マークダウン形式のフィードバック
   */
  async generateFeedbackMarkdown(taskId) {
    try {
      if (!taskId || typeof taskId !== 'string') {
        throw new ValidationError('タスクIDは必須の文字列です');
      }
      
      if (!taskId.match(/^T[0-9]{3}$/)) {
        throw new ValidationError('タスクIDはT000形式である必要があります');
      }
      
      return this.originalFeedbackManager.generateFeedbackMarkdown(taskId);
    } catch (error) {
      console.error(`タスク ${taskId} のフィードバックマークダウン生成に失敗しました:`, error);
      throw error;
    }
  }
}

module.exports = FeedbackManagerAdapter;
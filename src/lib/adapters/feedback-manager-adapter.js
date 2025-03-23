/**
 * フィードバック管理アダプター
 * 
 * フィードバック管理コンポーネントをラップし、統合マネージャーとのインターフェースを提供します。
 */

const { ValidationError } = require('../../lib/utils/errors');
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
   * @param {OperationContext} context - 操作コンテキスト（オプション）
   * @returns {Object} 検証結果 {isValid, errors, warnings}
   */
  validateFeedback(feedback, context = null) {
    try {
      // コンテキストがない場合は作成
      const operationContext = context || this._createContext('validateFeedback', { feedback });
      
      const isValid = this.manager.validateFeedback(feedback);
      return { isValid, errors: [], warnings: [] };
    } catch (error) {
      return this._handleError(error, 'validateFeedback', context, { feedback });
    }
  }
  
  /**
   * 保留中のフィードバックを取得
   * @param {OperationContext} context - 操作コンテキスト（オプション）
   * @returns {Promise<Object|null>} 保留中のフィードバック
   */
  async getPendingFeedback(context = null) {
    try {
      // コンテキストがない場合は作成
      const operationContext = context || this._createContext('getPendingFeedback');
      
      const feedback = await this.manager.getPendingFeedback();
      
      // イベント発行（オプション）
      if (feedback) {
        this._emitEvent('feedback', 'pending_feedback_retrieved', {
          feedbackCount: feedback.feedback_loop ? feedback.feedback_loop.feedback_items.length : 0,
          timestamp: new Date().toISOString()
        }, operationContext);
      }
      
      return feedback;
    } catch (error) {
      return this._handleError(error, 'getPendingFeedback', context);
    }
  }
  
  /**
   * タスクIDでフィードバックを取得
   * @param {string} taskId - タスクID
   * @param {OperationContext} context - 操作コンテキスト（オプション）
   * @returns {Promise<Object|null>} フィードバック
   */
  async getFeedbackByTaskId(taskId, context = null) {
    try {
      // コンテキストがない場合は作成
      const operationContext = context || this._createContext('getFeedbackByTaskId', { taskId });
      
      this._validateParams({ taskId }, ['taskId']);
      
      if (!taskId.match(/^T[0-9]{3}$/)) {
        throw new ValidationError('タスクIDはT000形式である必要があります');
      }
      
      const feedback = await this.manager.getFeedbackByTaskId(taskId);
      
      // イベント発行（オプション）
      if (feedback) {
        this._emitEvent('feedback', 'feedback_retrieved', {
          taskId,
          feedbackId: feedback.id,
          timestamp: new Date().toISOString()
        }, operationContext);
      }
      
      return feedback;
    } catch (error) {
      return this._handleError(error, 'getFeedbackByTaskId', context, { taskId });
    }
  }
  
  /**
   * 新しいフィードバックを作成
   * @param {string} taskId - タスクID
   * @param {number} attempt - 実装の試行回数
   * @param {OperationContext} context - 操作コンテキスト（オプション）
   * @returns {Promise<Object>} 新しいフィードバック
   */
  async createNewFeedback(taskId, attempt, context = null) {
    try {
      // コンテキストがない場合は作成
      const operationContext = context || this._createContext('createNewFeedback', { taskId, attempt });
      
      this._validateParams({ taskId, attempt }, ['taskId']);
      
      if (!taskId.match(/^T[0-9]{3}$/)) {
        throw new ValidationError('タスクIDはT000形式である必要があります');
      }
      
      const feedback = await this.manager.createNewFeedback(taskId, attempt || 1);
      
      // イベント発行
      this._emitEvent('feedback', 'feedback_created', {
        id: feedback.id,
        taskId,
        attempt: attempt || 1,
        timestamp: new Date().toISOString()
      }, operationContext);
      
      return feedback;
    } catch (error) {
      return this._handleError(error, 'createNewFeedback', context, { taskId, attempt });
    }
  }
  
  /**
   * テスト結果を自動収集
   * @param {string} taskId - タスクID
   * @param {string} testCommand - テストコマンド
   * @param {Array} testTypes - テストの種類
   * @param {OperationContext} context - 操作コンテキスト（オプション）
   * @returns {Promise<Object>} 更新されたフィードバック
   */
  async collectTestResults(taskId, testCommand, testTypes, context = null) {
    try {
      // コンテキストがない場合は作成
      const operationContext = context || this._createContext('collectTestResults', { taskId, testCommand, testTypes });
      
      this._validateParams({ taskId, testCommand }, ['taskId', 'testCommand']);
      
      const results = await this.manager.collectTestResults(taskId, testCommand, testTypes || []);
      
      // イベント発行
      this._emitEvent('feedback', 'test_results_collected', {
        taskId,
        testCommand,
        testTypes: testTypes || [],
        resultCount: results.results ? results.results.length : 0,
        timestamp: new Date().toISOString()
      }, operationContext);
      
      return results;
    } catch (error) {
      return this._handleError(error, 'collectTestResults', context, { taskId, testCommand, testTypes });
    }
  }
  
  /**
   * フィードバックの優先順位付け
   * @param {Object} feedback - フィードバック
   * @param {OperationContext} context - 操作コンテキスト（オプション）
   * @returns {Promise<Object>} 優先順位付けされたフィードバック
   */
  async prioritizeFeedback(feedback, context = null) {
    try {
      // コンテキストがない場合は作成
      const operationContext = context || this._createContext('prioritizeFeedback', {
        feedbackId: feedback.id,
        taskId: feedback.task_id
      });
      
      this._validateParams({ feedback }, ['feedback']);
      
      const prioritizedFeedback = await this.manager.prioritizeFeedback(feedback);
      
      // イベント発行
      this._emitEvent('feedback', 'feedback_prioritized', {
        id: feedback.id || prioritizedFeedback.id,
        taskId: feedback.task_id || prioritizedFeedback.task_id,
        priorities: prioritizedFeedback.priorities,
        timestamp: new Date().toISOString()
      }, operationContext);
      
      return prioritizedFeedback;
    } catch (error) {
      return this._handleError(error, 'prioritizeFeedback', context, { feedback });
    }
  }
  
  /**
   * フィードバックの状態を更新
   * @param {Object} feedback - フィードバック
   * @param {string} newStatus - 新しい状態
   * @param {OperationContext} context - 操作コンテキスト（オプション）
   * @returns {Promise<Object>} 更新されたフィードバック
   */
  async updateFeedbackStatus(feedback, newStatus, context = null) {
    try {
      // コンテキストがない場合は作成
      const operationContext = context || this._createContext('updateFeedbackStatus', {
        feedbackId: feedback.id,
        taskId: feedback.task_id,
        newStatus
      });
      
      this._validateParams({ feedback, newStatus }, ['feedback', 'newStatus']);
      
      if (!['open', 'in_progress', 'resolved', 'wontfix'].includes(newStatus)) {
        throw new ValidationError(`不正な状態です: ${newStatus}`);
      }
      
      const updatedFeedback = await this.manager.updateFeedbackStatus(feedback, newStatus);
      
      // イベント発行
      this._emitEvent('feedback', 'status_updated', {
        id: feedback.id,
        taskId: feedback.task_id,
        previousStatus: feedback.status,
        newStatus,
        timestamp: new Date().toISOString()
      }, operationContext);
      
      return updatedFeedback;
    } catch (error) {
      return this._handleError(error, 'updateFeedbackStatus', context, { feedback, newStatus });
    }
  }
  
  /**
   * フィードバックをセッションと統合
   * @param {string} feedbackId - フィードバックID
   * @param {string} sessionId - セッションID
   * @param {OperationContext} context - 操作コンテキスト（オプション）
   * @returns {Promise<boolean>} 統合結果
   */
  async integrateFeedbackWithSession(feedbackId, sessionId, context = null) {
    try {
      // コンテキストがない場合は作成
      const operationContext = context || this._createContext('integrateFeedbackWithSession', {
        feedbackId,
        sessionId
      });
      
      this._validateParams({ feedbackId, sessionId }, ['feedbackId', 'sessionId']);
      
      const result = await this.manager.integrateFeedbackWithSession(feedbackId, sessionId);
      
      // イベント発行
      this._emitEvent('feedback', 'integrated_with_session', {
        feedbackId,
        sessionId,
        success: !!result,
        timestamp: new Date().toISOString()
      }, operationContext);
      
      return result;
    } catch (error) {
      return this._handleError(error, 'integrateFeedbackWithSession', context, { feedbackId, sessionId });
    }
  }
  
  /**
   * フィードバックをタスクと統合
   * @param {string} feedbackId - フィードバックID
   * @param {string} taskId - タスクID
   * @param {OperationContext} context - 操作コンテキスト（オプション）
   * @returns {Promise<boolean>} 統合結果
   */
  async integrateFeedbackWithTask(feedbackId, taskId, context = null) {
    try {
      // コンテキストがない場合は作成
      const operationContext = context || this._createContext('integrateFeedbackWithTask', {
        feedbackId,
        taskId
      });
      
      this._validateParams({ feedbackId, taskId }, ['feedbackId', 'taskId']);
      
      const result = await this.manager.integrateFeedbackWithTask(feedbackId, taskId);
      
      // イベント発行
      this._emitEvent('feedback', 'integrated_with_task', {
        feedbackId,
        taskId,
        success: !!result,
        timestamp: new Date().toISOString()
      }, operationContext);
      
      return result;
    } catch (error) {
      return this._handleError(error, 'integrateFeedbackWithTask', context, { feedbackId, taskId });
    }
  }
  
  /**
   * フィードバックマークダウンを生成
   * @param {string} taskId - タスクID
   * @param {OperationContext} context - 操作コンテキスト（オプション）
   * @returns {Promise<string>} マークダウン形式のフィードバック
   */
  async generateFeedbackMarkdown(taskId, context = null) {
    try {
      // コンテキストがない場合は作成
      const operationContext = context || this._createContext('generateFeedbackMarkdown', { taskId });
      
      this._validateParams({ taskId }, ['taskId']);
      
      const markdown = await this.manager.generateFeedbackMarkdown(taskId);
      
      // イベント発行（オプション）
      if (markdown) {
        this._emitEvent('feedback', 'markdown_generated', {
          taskId,
          contentLength: markdown.length,
          timestamp: new Date().toISOString()
        }, operationContext);
      }
      
      return markdown;
    } catch (error) {
      return this._handleError(error, 'generateFeedbackMarkdown', context, { taskId });
    }
  }
}

module.exports = FeedbackManagerAdapter;
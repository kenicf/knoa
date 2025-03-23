/**
 * フィードバックリポジトリクラス
 * 
 * フィードバック管理のためのリポジトリクラス。
 * フィードバックの検索、状態管理、履歴管理などの機能を提供します。
 */

const { Repository, NotFoundError } = require('./repository');

/**
 * フィードバックリポジトリクラス
 */
class FeedbackRepository extends Repository {
  /**
   * コンストラクタ
   * @param {Object} storageService - ストレージサービス
   * @param {Object} validator - バリデータ
   * @param {Object} options - オプション
   */
  constructor(storageService, validator, options = {}) {
    super(storageService, 'feedback', {
      ...options,
      directory: options.directory || 'ai-context/feedback',
      currentFile: options.currentFile || 'pending-feedback.json',
      historyDirectory: options.historyDirectory || 'feedback-history',
      validator
    });
    
    // フィードバックの状態遷移の定義
    this.feedbackStateTransitions = options.feedbackStateTransitions || {
      open: ["in_progress", "resolved", "wontfix"],
      in_progress: ["resolved", "wontfix", "open"],
      resolved: ["open"],
      wontfix: ["open"]
    };
    
    // フィードバックの種類と優先度の重み付け
    this.feedbackTypeWeights = options.feedbackTypeWeights || {
      security: 5,
      functional: 5,
      performance: 4,
      ux: 3,
      code_quality: 2
    };
  }

  /**
   * 保留中のフィードバックを取得
   * @returns {Promise<Array>} 保留中のフィードバックの配列
   */
  async getPendingFeedback() {
    try {
      if (this.storage.fileExists(this.directory, this.currentFile)) {
        const data = await this.storage.readJSON(this.directory, this.currentFile);
        return Array.isArray(data) ? data : [];
      }
      return [];
    } catch (error) {
      throw new Error(`Failed to get pending feedback: ${error.message}`);
    }
  }

  /**
   * フィードバックを保存
   * @param {Object} feedback - フィードバックオブジェクト
   * @returns {Promise<boolean>} 保存結果
   */
  async saveFeedback(feedback) {
    try {
      if (!this._validateFeedback(feedback)) {
        throw new Error('Invalid feedback');
      }
      
      // 保留中のフィードバックを取得
      let pendingFeedback;
      try {
        pendingFeedback = await this.getPendingFeedback();
      } catch (error) {
        // エラーメッセージを簡略化
        throw new Error(`Read error`);
      }
      
      // 既存のフィードバックを検索
      const existingIndex = pendingFeedback.findIndex(f => f.feedback_id === feedback.feedback_id);
      
      let updatedFeedback;
      if (existingIndex >= 0) {
        // 既存のフィードバックを更新
        updatedFeedback = [feedback];
      } else {
        // 新しいフィードバックを追加
        updatedFeedback = [...pendingFeedback, feedback];
      }
      
      // 保存
      await this.storage.writeJSON(this.directory, this.currentFile, updatedFeedback);
      
      return true;
    } catch (error) {
      throw new Error(`Failed to save feedback: ${error.message}`);
    }
  }

  /**
   * フィードバックを履歴に移動
   * @param {Object} feedback - フィードバックオブジェクト
   * @returns {Promise<boolean>} 移動結果
   */
  async moveFeedbackToHistory(feedback) {
    try {
      if (!this._validateFeedback(feedback)) {
        throw new Error('Invalid feedback');
      }
      
      const taskId = feedback.feedback_loop.task_id;
      const attempt = feedback.feedback_loop.implementation_attempt;
      const filename = `feedback-${taskId}-${attempt}.json`;
      
      // 履歴に保存
      await this.storage.writeJSON(`${this.directory}/${this.historyDirectory}`, filename, feedback);
      
      // 保留中のフィードバックから削除
      const pendingFeedback = await this.getPendingFeedback();
      const updatedPendingFeedback = pendingFeedback.filter(f => 
        !f.feedback_loop || 
        f.feedback_loop.task_id !== taskId ||
        f.feedback_loop.implementation_attempt !== attempt
      );
      
      await this.storage.writeJSON(this.directory, this.currentFile, updatedPendingFeedback);
      
      return true;
    } catch (error) {
      throw new Error(`Failed to move feedback to history: ${error.message}`);
    }
  }

  /**
   * タスクIDによるフィードバック履歴の取得
   * @param {string} taskId - タスクID
   * @returns {Promise<Array>} フィードバック履歴の配列
   */
  async getFeedbackHistoryByTaskId(taskId) {
    try {
      const historyDir = `${this.directory}/${this.historyDirectory}`;
      // listFiles メソッドが Promise を返す場合は await を追加
      const files = await this.storage.listFiles(historyDir, `feedback-${taskId}-.*\\.json`);
      
      const feedbackHistory = [];
      
      for (const file of files) {
        const feedback = await this.storage.readJSON(historyDir, file);
        if (feedback) {
          feedbackHistory.push(feedback);
        }
      }
      
      // タイムスタンプでソート（新しい順）
      feedbackHistory.sort((a, b) => {
        const timestampA = a.timestamp || a.feedback_loop?.timestamp || '';
        const timestampB = b.timestamp || b.feedback_loop?.timestamp || '';
        return timestampB.localeCompare(timestampA);
      });
      
      return feedbackHistory;
    } catch (error) {
      throw new Error(`Failed to get feedback history for task ${taskId}: ${error.message}`);
    }
  }

  /**
   * フィードバックの状態を更新
   * @param {string} feedbackId - フィードバックID
   * @param {string} newStatus - 新しい状態
   * @param {Object} resolutionDetails - 解決詳細
   * @returns {Promise<Object>} 更新されたフィードバック
   */
  async updateFeedbackStatus(feedbackId, newStatus, resolutionDetails = {}) {
    try {
      // 保留中のフィードバックを取得
      const pendingFeedback = await this.getPendingFeedback();
      
      // フィードバックを検索
      const index = pendingFeedback.findIndex(f => f.feedback_id === feedbackId);
      if (index === -1) {
        throw new NotFoundError(`Feedback with id ${feedbackId} not found`);
      }
      
      const feedback = pendingFeedback[index];
      
      // 状態遷移の検証
      const currentStatus = feedback.feedback_loop.status;
      
      // バリデータの validateStatusTransition メソッドを使用
      if (this.validator && typeof this.validator.validateStatusTransition === 'function') {
        const validationResult = this.validator.validateStatusTransition(currentStatus, newStatus);
        if (!validationResult.isValid) {
          throw new Error(`Transition from ${currentStatus} to ${newStatus} is not allowed`);
        }
      } else {
        // バリデータがない場合は内部チェック
        if (currentStatus !== newStatus && !this.feedbackStateTransitions[currentStatus]?.includes(newStatus)) {
          throw new Error(`Transition from ${currentStatus} to ${newStatus} is not allowed`);
        }
      }
      
      // フィードバックを更新
      feedback.feedback_loop.status = newStatus;
      feedback.feedback_loop.resolution_details = resolutionDetails;
      feedback.feedback_loop.updated_at = new Date().toISOString();
      
      // 保存
      pendingFeedback[index] = feedback;
      await this.storage.writeJSON(this.directory, this.currentFile, pendingFeedback);
      
      return feedback;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new Error(`Failed to update feedback status: ${error.message}`);
    }
  }

  /**
   * フィードバックの優先度を計算
   * @param {Object} feedback - フィードバックオブジェクト
   * @returns {number} 優先度スコア
   */
  calculatePriority(feedback) {
    try {
      if (!feedback || !feedback.feedback_loop) {
        return 1; // 無効なフィードバックの場合は最小優先度を返す
      }
      
      let score = 0;
      
      // フィードバックタイプによる重み付け
      const feedbackType = feedback.feedback_loop.feedback_type;
      if (feedbackType && this.feedbackTypeWeights[feedbackType]) {
        score += this.feedbackTypeWeights[feedbackType];
      }
      
      // テスト結果による重み付け
      const testResults = feedback.feedback_loop.test_results;
      if (testResults) {
        // 失敗したテストの数
        const failedTests = testResults.failed_tests || [];
        score += failedTests.length * 2;
        
        // 成功率
        const successRate = testResults.success_rate || 0;
        score += (100 - successRate) / 10;
      }
      
      // フィードバック項目による重み付け
      const feedbackItems = feedback.feedback_loop.feedback_items || [];
      score += feedbackItems.length;
      
      // 重要度の高いフィードバック項目
      const highPriorityItems = feedbackItems.filter(item => item.priority === 'high');
      score += highPriorityItems.length * 2;
      
      return Math.min(10, Math.max(1, Math.round(score)));
    } catch (error) {
      console.error(`Error calculating priority: ${error.message}`);
      return 1;
    }
  }

  /**
   * フィードバックの検証
   * @param {Object} feedback - フィードバックオブジェクト
   * @returns {boolean} 検証結果
   * @private
   */
  _validateFeedback(feedback) {
    // 基本的な構造チェック
    if (!feedback || !feedback.feedback_loop) {
      return false;
    }

    const loop = feedback.feedback_loop;
    
    // 必須フィールドのチェック
    const requiredFields = ['task_id', 'test_execution', 'verification_results', 'feedback_items', 'status'];
    for (const field of requiredFields) {
      if (!loop[field]) {
        return false;
      }
    }
    
    // タスクIDの形式チェック
    const taskPattern = /^T[0-9]{3}$/;
    if (!taskPattern.test(loop.task_id)) {
      return false;
    }
    
    // 状態のチェック
    const validStatuses = Object.keys(this.feedbackStateTransitions);
    if (!validStatuses.includes(loop.status)) {
      return false;
    }
    
    return true;
  }

  /**
   * フィードバックの統計情報を取得
   * @returns {Promise<Object>} 統計情報
   */
  async getFeedbackStats() {
    try {
      // 保留中のフィードバック
      let pendingFeedback;
      try {
        pendingFeedback = await this.getPendingFeedback();
      } catch (error) {
        // エラーメッセージを簡略化
        throw new Error(`Read error`);
      }
      
      // 履歴のフィードバック
      const historyDir = `${this.directory}/${this.historyDirectory}`;
      // listFiles メソッドが Promise を返す場合は await を追加
      const files = await this.storage.listFiles(historyDir, `feedback-.*\\.json`);
      
      const historyFeedback = [];
      for (const file of files) {
        const feedback = await this.storage.readJSON(historyDir, file);
        if (feedback) {
          historyFeedback.push(feedback);
        }
      }
      
      // 状態別のカウント
      const statusCounts = {
        open: 0,
        in_progress: 0,
        resolved: 0,
        wontfix: 0
      };
      
      for (const feedback of pendingFeedback) {
        const status = feedback.feedback_loop.status;
        if (statusCounts[status] !== undefined) {
          statusCounts[status]++;
        }
      }
      
      // タイプ別のカウント
      const typeCounts = {};
      
      for (const feedback of [...pendingFeedback, ...historyFeedback]) {
        const type = feedback.feedback_loop.feedback_type;
        if (type) {
          typeCounts[type] = (typeCounts[type] || 0) + 1;
        }
      }
      
      // タスク別のカウント
      const taskCounts = {};
      
      for (const feedback of [...pendingFeedback, ...historyFeedback]) {
        const taskId = feedback.feedback_loop.task_id;
        if (taskId) {
          taskCounts[taskId] = (taskCounts[taskId] || 0) + 1;
        }
      }
      
      return {
        total: pendingFeedback.length + historyFeedback.length,
        pending: pendingFeedback.length,
        history: historyFeedback.length,
        statusCounts,
        typeCounts,
        taskCounts
      };
    } catch (error) {
      throw new Error(`Failed to get feedback stats: ${error.message}`);
    }
  }

  /**
   * フィードバックの検索
   * @param {Object} criteria - 検索条件
   * @returns {Promise<Array>} 検索結果
   */
  async searchFeedback(criteria = {}) {
    try {
      // 保留中のフィードバック
      let pendingFeedback;
      try {
        pendingFeedback = await this.getPendingFeedback();
      } catch (error) {
        // エラーメッセージを簡略化
        throw new Error(`Read error`);
      }
      
      // 履歴のフィードバック
      const historyDir = `${this.directory}/${this.historyDirectory}`;
      // listFiles メソッドが Promise を返す場合は await を追加
      const files = await this.storage.listFiles(historyDir, `feedback-.*\\.json`);
      
      const historyFeedback = [];
      for (const file of files) {
        const feedback = await this.storage.readJSON(historyDir, file);
        if (feedback) {
          historyFeedback.push(feedback);
        }
      }
      
      // すべてのフィードバック
      const allFeedback = [...pendingFeedback, ...historyFeedback];
      
      // 検索条件に基づいてフィルタリング
      return allFeedback.filter(feedback => {
        const loop = feedback.feedback_loop;
        
        // タスクID
        if (criteria.taskId && loop.task_id !== criteria.taskId) {
          return false;
        }
        
        // 状態
        if (criteria.status && loop.status !== criteria.status) {
          return false;
        }
        
        // タイプ
        if (criteria.type && loop.feedback_type !== criteria.type) {
          return false;
        }
        
        // 日付範囲
        if (criteria.startDate || criteria.endDate) {
          const timestamp = new Date(loop.timestamp || feedback.timestamp);
          
          if (criteria.startDate && timestamp < new Date(criteria.startDate)) {
            return false;
          }
          
          if (criteria.endDate && timestamp > new Date(criteria.endDate)) {
            return false;
          }
        }
        
        // テキスト検索
        if (criteria.text) {
          const searchText = criteria.text.toLowerCase();
          const feedbackText = JSON.stringify(feedback).toLowerCase();
          
          if (!feedbackText.includes(searchText)) {
            return false;
          }
        }
        
        return true;
      });
    } catch (error) {
      throw new Error(`Failed to search feedback: ${error.message}`);
    }
  }
}

module.exports = { FeedbackRepository };
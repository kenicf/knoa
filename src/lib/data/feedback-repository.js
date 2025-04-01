/**
 * フィードバックリポジトリクラス
 *
 * フィードバック管理のためのリポジトリクラス。
 * フィードバックの検索、状態管理、履歴管理などの機能を提供します。
 */

const { Repository, NotFoundError, ValidationError } = require('./repository'); // ValidationError をインポート
const {
  FEEDBACK_STATE_TRANSITIONS,
  FEEDBACK_TYPE_WEIGHTS,
} = require('../core/constants'); // 定数をインポート

/**
 * フィードバックリポジトリクラス
 */
class FeedbackRepository extends Repository {
  /**
   * コンストラクタ
   * @param {Object} options - オプション
   * @param {Object} options.storageService - ストレージサービス (必須)
   * @param {Object} options.feedbackValidator - フィードバックバリデーター (必須)
   * @param {Object} options.logger - ロガーインスタンス (必須)
   * @param {Object} [options.eventEmitter] - イベントエミッターインスタンス
   * @param {Object} [options.errorHandler] - エラーハンドラーインスタンス
   * @param {string} [options.directory] - ディレクトリパス
   * @param {string} [options.currentFile] - 現在のファイル名
   * @param {string} [options.historyDirectory] - 履歴ディレクトリ名
   * @param {Object} [options.feedbackStateTransitions] - 状態遷移定義 (現在は constants.js から取得)
   * @param {Object} [options.feedbackTypeWeights] - タイプ別重み付け (現在は constants.js から取得)
   */
  constructor(options = {}) {
    // 必須依存関係のチェック
    if (!options.storageService) {
      throw new Error('FeedbackRepository requires a storageService instance');
    }
    if (!options.feedbackValidator) {
      throw new Error(
        'FeedbackRepository requires a feedbackValidator instance'
      );
    }
    if (!options.logger) {
      throw new Error('FeedbackRepository requires a logger instance');
    }

    // 基底クラスのコンストラクタ呼び出し
    super({
      storageService: options.storageService,
      entityName: 'feedback',
      logger: options.logger,
      eventEmitter: options.eventEmitter, // 任意
      errorHandler: options.errorHandler, // 任意
      ...options, // directory, currentFile, historyDirectory など他のオプションも渡す
      directory: options.directory || 'ai-context/feedback',
      currentFile: options.currentFile || 'pending-feedback.json',
      historyDirectory: options.historyDirectory || 'feedback-history',
      // validator は基底クラスに渡さない (FeedbackRepository 固有の検証を行うため)
    });

    this.feedbackValidator = options.feedbackValidator; // feedbackValidator を保持

    // フィードバックの状態遷移と重み付けは constants.js からインポートして使用
  }

  /**
   * 保留中のフィードバックを取得
   * @returns {Promise<Array>} 保留中のフィードバックの配列
   */
  async getPendingFeedback() {
    const operation = 'getPendingFeedback';
    try {
      if (this.storage.fileExists(this.directory, this.currentFile)) {
        const data = await this.storage.readJSON(
          this.directory,
          this.currentFile
        );
        return Array.isArray(data) ? data : [];
      }
      return [];
    } catch (error) {
      if (this.errorHandler) {
        // エラーハンドラーに処理を委譲し、デフォルト値として空配列を返すことを期待
        return (
          this.errorHandler.handle(
            error,
            'FeedbackRepository',
            operation,
            {}
          ) || []
        );
      }
      this.logger.error(`Failed to ${operation}`, { error });
      throw new Error(`Failed to get pending feedback: ${error.message}`); // 元のエラーメッセージを維持
    }
  }

  /**
   * フィードバックを保存
   * @param {Object} feedback - フィードバックオブジェクト
   * @returns {Promise<boolean>} 保存結果
   */
  async saveFeedback(feedback) {
    const operation = 'saveFeedback';
    let isNew = false; // 新規作成か更新かを追跡
    try {
      // バリデータを使用して検証
      const validationResult = this.feedbackValidator.validate(feedback);
      if (!validationResult.isValid) {
        throw new ValidationError(
          'Invalid feedback data',
          validationResult.errors
        );
      }

      // 保留中のフィードバックを取得 (エラーハンドリングは getPendingFeedback に任せる)
      const pendingFeedback = await this.getPendingFeedback();

      // 既存のフィードバックを検索
      const existingIndex = pendingFeedback.findIndex(
        (f) => f.feedback_id === feedback.feedback_id
      );

      let updatedFeedbackList;
      if (existingIndex >= 0) {
        // 既存のフィードバックを更新
        // eslint-disable-next-line security/detect-object-injection
        pendingFeedback[existingIndex] = feedback;
        updatedFeedbackList = pendingFeedback;
      } else {
        // 新しいフィードバックを追加
        isNew = true;
        updatedFeedbackList = [...pendingFeedback, feedback];
      }

      // 保存
      await this.storage.writeJSON(
        this.directory,
        this.currentFile,
        updatedFeedbackList
      );

      // イベント発行
      if (this.eventEmitter) {
        const eventAction = isNew ? 'created' : 'updated';
        this.eventEmitter.emitStandardized('feedback', eventAction, {
          feedback,
        });
      }

      return true;
    } catch (error) {
      if (this.errorHandler) {
        // 保存失敗時は false を返すことを期待
        return (
          this.errorHandler.handle(error, 'FeedbackRepository', operation, {
            feedbackId: feedback?.feedback_id,
          }) || false
        );
      }
      if (error instanceof ValidationError) {
        this.logger.warn(`Validation Error during ${operation}`, {
          feedbackId: feedback?.feedback_id,
          error: error.message,
          errors: error.errors,
        });
        throw error; // バリデーションエラーはそのままスロー
      }
      this.logger.error(`Failed to ${operation}`, {
        feedbackId: feedback?.feedback_id,
        error,
      });
      throw new Error(`Failed to save feedback: ${error.message}`); // 元のエラーメッセージを維持
    }
  }

  /**
   * フィードバックを履歴に移動
   * @param {Object} feedback - フィードバックオブジェクト
   * @returns {Promise<boolean>} 移動結果
   */
  async moveFeedbackToHistory(feedback) {
    const operation = 'moveFeedbackToHistory';
    try {
      // バリデータを使用して検証
      const validationResult = this.feedbackValidator.validate(feedback);
      if (!validationResult.isValid) {
        throw new ValidationError(
          'Invalid feedback data for history move',
          validationResult.errors
        );
      }

      const taskId = feedback.feedback_loop.task_id;
      const attempt = feedback.feedback_loop.implementation_attempt;
      const filename = `feedback-${taskId}-${attempt}.json`;

      // 履歴に保存
      await this.storage.writeJSON(
        `${this.directory}/${this.historyDirectory}`,
        filename,
        feedback
      );

      // 保留中のフィードバックから削除
      const pendingFeedback = await this.getPendingFeedback(); // エラーハンドリングは getPendingFeedback に任せる
      const updatedPendingFeedback = pendingFeedback.filter(
        (f) =>
          !f.feedback_loop ||
          f.feedback_loop.task_id !== taskId ||
          f.feedback_loop.implementation_attempt !== attempt
      );

      await this.storage.writeJSON(
        this.directory,
        this.currentFile,
        updatedPendingFeedback
      );

      // イベント発行
      if (this.eventEmitter) {
        this.eventEmitter.emitStandardized('feedback', 'archived', {
          feedbackId: feedback?.feedback_id,
          taskId,
          attempt,
        });
      }

      return true;
    } catch (error) {
      if (this.errorHandler) {
        // 移動失敗時は false を返すことを期待
        return (
          this.errorHandler.handle(error, 'FeedbackRepository', operation, {
            feedbackId: feedback?.feedback_id,
          }) || false
        );
      }
      if (error instanceof ValidationError) {
        this.logger.warn(`Validation Error during ${operation}`, {
          feedbackId: feedback?.feedback_id,
          error: error.message,
          errors: error.errors,
        });
        throw error;
      }
      this.logger.error(`Failed to ${operation}`, {
        feedbackId: feedback?.feedback_id,
        error,
      });
      throw new Error(`Failed to move feedback to history: ${error.message}`); // 元のエラーメッセージを維持
    }
  }

  /**
   * タスクIDによるフィードバック履歴の取得
   * @param {string} taskId - タスクID
   * @returns {Promise<Array>} フィードバック履歴の配列
   */
  async getFeedbackHistoryByTaskId(taskId) {
    const operation = 'getFeedbackHistoryByTaskId';
    try {
      const historyDir = `${this.directory}/${this.historyDirectory}`;
      let files = [];
      try {
        files = await this.storage.listFiles(
          historyDir,
          `feedback-${taskId}-.*\\.json`
        );
      } catch (listError) {
        this.logger.warn(
          `Error listing feedback history files for task ${taskId}, returning empty array.`,
          { error: listError }
        );
        return [];
      }

      const feedbackHistory = [];
      for (const file of files) {
        try {
          const feedback = await this.storage.readJSON(historyDir, file);
          if (feedback) feedbackHistory.push(feedback);
        } catch (readError) {
          this.logger.warn(
            `Error reading feedback history file ${file}, skipping.`,
            { error: readError }
          );
        }
      }

      feedbackHistory.sort((a, b) => {
        /* ... (元のコードと同じ) ... */
        const timestampA = a.timestamp || a.feedback_loop?.timestamp || '';
        const timestampB = b.timestamp || b.feedback_loop?.timestamp || '';
        return timestampB.localeCompare(timestampA);
      });

      return feedbackHistory;
    } catch (error) {
      // ループ外の予期せぬエラー
      if (this.errorHandler) {
        return (
          this.errorHandler.handle(error, 'FeedbackRepository', operation, {
            taskId,
          }) || []
        );
      }
      this.logger.error(`Failed to ${operation}`, { taskId, error });
      throw new Error(
        `Failed to get feedback history for task ${taskId}: ${error.message}`
      ); // 元のエラーメッセージを維持
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
    const operation = 'updateFeedbackStatus';
    try {
      // 保留中のフィードバックを取得 (エラーハンドリングは getPendingFeedback に任せる)
      const pendingFeedback = await this.getPendingFeedback();

      // フィードバックを検索
      const index = pendingFeedback.findIndex(
        (f) => f.feedback_id === feedbackId
      );
      if (index === -1) {
        throw new NotFoundError(`Feedback with id ${feedbackId} not found`);
      }

      // eslint-disable-next-line security/detect-object-injection
      const feedback = { ...pendingFeedback[index] }; // 更新用にコピー
      const originalStatus = feedback.feedback_loop.status; // 更新前の状態を保持

      // 状態遷移の検証
      if (
        this.feedbackValidator &&
        typeof this.feedbackValidator.validateStatusTransition === 'function'
      ) {
        const validationResult =
          this.feedbackValidator.validateStatusTransition(
            originalStatus,
            newStatus
          );
        if (!validationResult.isValid) {
          throw new ValidationError(
            validationResult.error ||
              `Transition from ${originalStatus} to ${newStatus} is not allowed`
          );
        }
      } else {
        // バリデータがない場合のフォールバック
        if (
          originalStatus !== newStatus &&
          (!Object.prototype.hasOwnProperty.call(
            FEEDBACK_STATE_TRANSITIONS, // インポートした定数を使用
            originalStatus
          ) ||
            !FEEDBACK_STATE_TRANSITIONS[originalStatus]?.includes(newStatus))
        ) {
          throw new ValidationError(
            `Transition from ${originalStatus} to ${newStatus} is not allowed`
          );
        }
      }

      // フィードバックを更新
      feedback.feedback_loop.status = newStatus;
      feedback.feedback_loop.resolution_details = resolutionDetails;
      feedback.feedback_loop.updated_at = new Date().toISOString();

      // 更新されたフィードバックでリストを更新
      // eslint-disable-next-line security/detect-object-injection
      pendingFeedback[index] = feedback;

      // 保存
      await this.storage.writeJSON(
        this.directory,
        this.currentFile,
        pendingFeedback
      );

      // イベント発行
      if (this.eventEmitter) {
        this.eventEmitter.emitStandardized('feedback', 'status_updated', {
          feedbackId,
          oldStatus: originalStatus,
          newStatus,
          resolutionDetails,
          feedback, // 更新後のフィードバック全体を含めるか検討
        });
      }

      return feedback; // 更新後のフィードバックを返す
    } catch (error) {
      if (this.errorHandler) {
        // 更新失敗時は null を返すか、エラーをスローするかはハンドラー次第
        return this.errorHandler.handle(
          error,
          'FeedbackRepository',
          operation,
          { feedbackId, newStatus, resolutionDetails }
        );
      }
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        this.logger.warn(`Error during ${operation}`, {
          feedbackId,
          newStatus,
          error: error.message,
          errors: error.errors,
        });
        throw error;
      }
      this.logger.error(`Failed to ${operation}`, {
        feedbackId,
        newStatus,
        error,
      });
      throw new Error(`Failed to update feedback status: ${error.message}`); // 元のエラーメッセージを維持
    }
  }

  /**
   * フィードバックの優先度を計算
   * @param {Object} feedback - フィードバックオブジェクト
   * @returns {number} 優先度スコア
   */
  calculatePriority(feedback) {
    const operation = 'calculatePriority';
    try {
      // バリデータに計算ロジックがあればそれを使用
      if (
        this.feedbackValidator &&
        typeof this.feedbackValidator.calculatePriority === 'function'
      ) {
        return this.feedbackValidator.calculatePriority(feedback);
      }

      // フォールバックとして内部ロジックを使用
      if (!feedback || !feedback.feedback_loop) return 1;
      let score = 0;
      const loop = feedback.feedback_loop;
      const feedbackType = loop.feedback_type;
      // eslint-disable-next-line security/detect-object-injection
      if (feedbackType && FEEDBACK_TYPE_WEIGHTS[feedbackType])
        // インポートした定数を使用
        // eslint-disable-next-line security/detect-object-injection
        score += FEEDBACK_TYPE_WEIGHTS[feedbackType]; // インポートした定数を使用
      const testResults = loop.test_results;
      if (testResults) {
        const failedTests = testResults.failed_tests || [];
        score += failedTests.length * 2;
        const successRate = testResults.success_rate || 0;
        score += (100 - successRate) / 10;
      }
      const feedbackItems = loop.feedback_items || [];
      score += feedbackItems.length;
      const highPriorityItems = feedbackItems.filter(
        (item) => item.priority === 'high'
      );
      score += highPriorityItems.length * 2;
      return Math.min(10, Math.max(1, Math.round(score)));
    } catch (error) {
      this.logger.error(`Error during ${operation}`, {
        feedbackId: feedback?.feedback_id,
        error,
      });
      // errorHandler があれば通知する選択肢もある
      return 1; // デフォルトの最低優先度を返す
    }
  }

  // _validateFeedback メソッドは削除

  /**
   * フィードバックの統計情報を取得
   * @returns {Promise<Object>} 統計情報
   */
  async getFeedbackStats() {
    const operation = 'getFeedbackStats';
    try {
      // 保留中のフィードバック (エラーハンドリングは getPendingFeedback に任せる)
      const pendingFeedback = await this.getPendingFeedback();

      // 履歴のフィードバック (エラーハンドリングは getFeedbackHistoryByTaskId に類似)
      const historyDir = `${this.directory}/${this.historyDirectory}`;
      let files = [];
      try {
        files = await this.storage.listFiles(historyDir, `feedback-.*\\.json`);
      } catch (listError) {
        this.logger.warn(
          `Error listing feedback history files for stats, continuing with pending only.`,
          { error: listError }
        );
      }

      const historyFeedback = [];
      for (const file of files) {
        try {
          const feedback = await this.storage.readJSON(historyDir, file);
          if (feedback) historyFeedback.push(feedback);
        } catch (readError) {
          this.logger.warn(
            `Error reading feedback history file ${file} for stats, skipping.`,
            { error: readError }
          );
        }
      }

      // 統計計算 (省略)
      const statusCounts = { open: 0, in_progress: 0, resolved: 0, wontfix: 0 };
      pendingFeedback.forEach((f) => {
        if (statusCounts[f.feedback_loop.status] !== undefined)
          statusCounts[f.feedback_loop.status]++;
      });
      const typeCounts = {};
      [...pendingFeedback, ...historyFeedback].forEach((f) => {
        if (f.feedback_loop.feedback_type)
          typeCounts[f.feedback_loop.feedback_type] =
            (typeCounts[f.feedback_loop.feedback_type] || 0) + 1;
      });
      const taskCounts = {};
      [...pendingFeedback, ...historyFeedback].forEach((f) => {
        if (f.feedback_loop.task_id)
          taskCounts[f.feedback_loop.task_id] =
            (taskCounts[f.feedback_loop.task_id] || 0) + 1;
      });

      return {
        total: pendingFeedback.length + historyFeedback.length,
        pending: pendingFeedback.length,
        history: historyFeedback.length,
        statusCounts,
        typeCounts,
        taskCounts,
      };
    } catch (error) {
      // getPendingFeedback 内の Read error など
      if (this.errorHandler) {
        return (
          this.errorHandler.handle(
            error,
            'FeedbackRepository',
            operation,
            {}
          ) || {
            total: 0,
            pending: 0,
            history: 0,
            statusCounts: {},
            typeCounts: {},
            taskCounts: {},
          }
        );
      }
      this.logger.error(`Failed to ${operation}`, { error });
      throw new Error(`Failed to get feedback stats: ${error.message}`); // 元のエラーメッセージを維持
    }
  }

  /**
   * フィードバックの検索
   * @param {Object} criteria - 検索条件
   * @returns {Promise<Array>} 検索結果
   */
  async searchFeedback(criteria = {}) {
    const operation = 'searchFeedback';
    try {
      // 保留中のフィードバック (エラーハンドリングは getPendingFeedback に任せる)
      const pendingFeedback = await this.getPendingFeedback();

      // 履歴のフィードバック (エラーハンドリングは getFeedbackHistoryByTaskId に類似)
      const historyDir = `${this.directory}/${this.historyDirectory}`;
      let files = [];
      try {
        files = await this.storage.listFiles(historyDir, `feedback-.*\\.json`);
      } catch (listError) {
        this.logger.warn(
          `Error listing feedback history files for search, continuing with pending only.`,
          { criteria, error: listError }
        );
      }

      const historyFeedback = [];
      for (const file of files) {
        try {
          const feedback = await this.storage.readJSON(historyDir, file);
          if (feedback) historyFeedback.push(feedback);
        } catch (readError) {
          this.logger.warn(
            `Error reading feedback history file ${file} for search, skipping.`,
            { criteria, error: readError }
          );
        }
      }

      // すべてのフィードバック
      const allFeedback = [...pendingFeedback, ...historyFeedback];

      // 検索条件に基づいてフィルタリング (省略)
      return allFeedback.filter((feedback) => {
        /* ... (元のコードと同じ) ... */
        const loop = feedback.feedback_loop;
        if (!loop) return false;
        if (criteria.taskId && loop.task_id !== criteria.taskId) return false;
        if (criteria.status && loop.status !== criteria.status) return false;
        if (criteria.type && loop.feedback_type !== criteria.type) return false;
        if (criteria.startDate || criteria.endDate) {
          const timestamp = new Date(loop.timestamp || feedback.timestamp);
          if (criteria.startDate && timestamp < new Date(criteria.startDate))
            return false;
          if (criteria.endDate && timestamp > new Date(criteria.endDate))
            return false;
        }
        if (criteria.text) {
          const searchText = criteria.text.toLowerCase();
          const feedbackText = JSON.stringify(feedback).toLowerCase();
          if (!feedbackText.includes(searchText)) return false;
        }
        return true;
      });
    } catch (error) {
      // getPendingFeedback 内の Read error など
      if (this.errorHandler) {
        return (
          this.errorHandler.handle(error, 'FeedbackRepository', operation, {
            criteria,
          }) || []
        );
      }
      this.logger.error(`Failed to ${operation}`, { criteria, error });
      throw new Error(`Failed to search feedback: ${error.message}`); // 元のエラーメッセージを維持
    }
  }
}

module.exports = { FeedbackRepository };

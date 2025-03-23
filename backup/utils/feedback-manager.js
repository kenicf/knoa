/**
 * フィードバック管理ユーティリティ
 * 
 * フィードバックの検証、テスト結果の自動収集、優先順位付け、状態管理、
 * Gitコミットとの関連付け、履歴管理などの機能を提供します。
 */

// スキーマの読み込み
const feedbackSchema = require('../schemas/feedback.schema.json');

// フィードバックの状態遷移の定義
const FEEDBACK_STATE_TRANSITIONS = {
  open: ["in_progress", "resolved", "wontfix"],
  in_progress: ["resolved", "wontfix", "open"],
  resolved: ["open"],
  wontfix: ["open"]
};

// フィードバックの種類と優先度の重み付け
const FEEDBACK_TYPE_WEIGHTS = {
  security: 5,
  functional: 5,
  performance: 4,
  ux: 3,
  code_quality: 2
};

/**
 * フィードバック管理クラス
 */
class FeedbackManager {
  /**
   * コンストラクタ
   * @param {Object} storageService - ストレージサービス（必須）
   * @param {Object} gitService - Gitサービス（必須）
   * @param {Object} logger - ロガー（必須）
   * @param {Object} eventEmitter - イベントエミッター（必須）
   * @param {Object} errorHandler - エラーハンドラー（必須）
   * @param {Object} handlebars - テンプレートエンジン（必須）
   * @param {Object} options - 追加オプション
   * @param {string} options.feedbackDir - フィードバックディレクトリのパス
   * @param {string} options.templateDir - テンプレートディレクトリのパス
   */
  constructor(storageService, gitService, logger, eventEmitter, errorHandler, handlebars, options = {}) {
    // 依存関係のバリデーション
    if (!storageService) throw new Error('FeedbackManager requires a storageService instance');
    if (!gitService) throw new Error('FeedbackManager requires a gitService instance');
    if (!logger) throw new Error('FeedbackManager requires a logger instance');
    if (!eventEmitter) throw new Error('FeedbackManager requires an eventEmitter instance');
    if (!errorHandler) throw new Error('FeedbackManager requires an errorHandler instance');
    if (!handlebars) throw new Error('FeedbackManager requires a handlebars instance');
    
    // 依存関係の設定
    this.storageService = storageService;
    this.gitService = gitService;
    this.logger = logger;
    this.eventEmitter = eventEmitter;
    this.errorHandler = errorHandler;
    this.handlebars = handlebars;
    
    // オプションの設定
    this.feedbackDir = options.feedbackDir || 'ai-context/feedback';
    this.templateDir = options.templateDir || 'src/templates/docs';
    
    // ディレクトリの存在確認はstorageServiceに委譲
    this.storageService.ensureDirectoryExists(`${this.feedbackDir}/feedback-history`);
    
    this.logger.info('FeedbackManager initialized', { 
      feedbackDir: this.feedbackDir,
      templateDir: this.templateDir
    });
  }

  /**
   * フィードバックの検証
   * @param {Object} feedback - フィードバックオブジェクト
   * @returns {boolean} 検証結果
   */
  validateFeedback(feedback) {
    // 基本的な構造チェック
    if (!feedback || !feedback.feedback_loop) {
      this.logger.error('フィードバックオブジェクトが不正です');
      return false;
    }

    const loop = feedback.feedback_loop;
    
    // 必須フィールドのチェック
    const requiredFields = ['task_id', 'test_execution', 'verification_results', 'feedback_items', 'status'];
    for (const field of requiredFields) {
      if (!loop[field]) {
        this.logger.error(`必須フィールド ${field} がありません`);
        return false;
      }
    }
    
    // タスクIDの形式チェック
    const taskPattern = /^T[0-9]{3}$/;
    if (!taskPattern.test(loop.task_id)) {
      this.logger.error(`不正なタスクID形式です: ${loop.task_id}`);
      return false;
    }
    
    // 状態のチェック
    const validStatuses = Object.keys(FEEDBACK_STATE_TRANSITIONS);
    if (!validStatuses.includes(loop.status)) {
      this.logger.error(`不正な状態です: ${loop.status}`);
      return false;
    }
    
    return true;
  }

  /**
   * 保留中のフィードバックを取得
   * @returns {Array} 保留中のフィードバックの配列
   */
  getPendingFeedback() {
    try {
      if (this.storageService.fileExists(this.feedbackDir, 'pending-feedback.json')) {
        return this.storageService.readJSON(this.feedbackDir, 'pending-feedback.json');
      }
      return [];
    } catch (error) {
      this.errorHandler.handle(error, 'FeedbackManager', 'getPendingFeedback');
      return [];
    }
  }

  /**
   * フィードバックを保存
   * @param {Object} feedback - フィードバックオブジェクト
   * @returns {boolean} 保存結果
   */
  saveFeedback(feedback) {
    try {
      if (!this.validateFeedback(feedback)) {
        this.logger.error('不正なフィードバックは保存できません');
        return false;
      }
      
      // 保留中のフィードバックを取得
      const pendingFeedback = this.getPendingFeedback();
      
      // 既存のフィードバックを検索
      const existingIndex = pendingFeedback.findIndex(f => 
        f.feedback_loop.task_id === feedback.feedback_loop.task_id &&
        f.feedback_loop.implementation_attempt === feedback.feedback_loop.implementation_attempt
      );
      
      if (existingIndex >= 0) {
        // 既存のフィードバックを更新
        pendingFeedback[existingIndex] = feedback;
      } else {
        // 新しいフィードバックを追加
        pendingFeedback.push(feedback);
      }
      
      // 保存
      this.storageService.writeJSON(this.feedbackDir, 'pending-feedback.json', pendingFeedback);
      
      // イベント発行
      this.eventEmitter.emit('feedback:saved', { 
        taskId: feedback.feedback_loop.task_id,
        status: feedback.feedback_loop.status
      });
      
      return true;
    } catch (error) {
      this.errorHandler.handle(error, 'FeedbackManager', 'saveFeedback');
      return false;
    }
  }

  /**
   * フィードバックを履歴に移動
   * @param {Object} feedback - フィードバックオブジェクト
   * @returns {boolean} 移動結果
   */
  moveFeedbackToHistory(feedback) {
    try {
      if (!this.validateFeedback(feedback)) {
        this.logger.error('不正なフィードバックは履歴に移動できません');
        return false;
      }
      
      const taskId = feedback.feedback_loop.task_id;
      const attempt = feedback.feedback_loop.implementation_attempt;
      const filename = `feedback-${taskId}-${attempt}.json`;
      
      // 履歴に保存
      this.storageService.writeJSON(`${this.feedbackDir}/feedback-history`, filename, feedback);
      
      // 保留中のフィードバックから削除
      const pendingFeedback = this.getPendingFeedback();
      const updatedPendingFeedback = pendingFeedback.filter(f => 
        f.feedback_loop.task_id !== taskId ||
        f.feedback_loop.implementation_attempt !== attempt
      );
      
      this.storageService.writeJSON(this.feedbackDir, 'pending-feedback.json', updatedPendingFeedback);
      
      // イベント発行
      this.eventEmitter.emit('feedback:archived', { 
        taskId,
        attempt,
        filename
      });
      
      return true;
    } catch (error) {
      this.errorHandler.handle(error, 'FeedbackManager', 'moveFeedbackToHistory');
      return false;
    }
  }

  // 他のメソッドも同様に修正...
}

module.exports = { FeedbackManager };
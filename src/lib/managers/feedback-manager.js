/**
 * フィードバック管理ユーティリティ
 * 
 * フィードバックの検証、テスト結果の自動収集、優先順位付け、状態管理、
 * Gitコミットとの関連付け、履歴管理などの機能を提供します。
 */

// スキーマの読み込み
const feedbackSchema = require('../../schemas/feedback.schema.json');

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
   * @param {Object} options - オプションオブジェクト
   * @param {Object} options.storageService - ストレージサービス（必須）
   * @param {Object} options.gitService - Gitサービス（必須）
   * @param {Object} options.logger - ロガー
   * @param {Object} options.eventEmitter - イベントエミッター
   * @param {Object} options.errorHandler - エラーハンドラー
   * @param {Object} options.handlebars - テンプレートエンジン
   * @param {Object} options.config - 設定オプション
   * @param {string} options.config.feedbackDir - フィードバックディレクトリのパス
   * @param {string} options.config.templateDir - テンプレートディレクトリのパス
   */
  constructor(options = {}) {
    // 必須依存関係の検証
    if (!options.storageService) throw new Error('FeedbackManager requires a storageService instance');
    if (!options.gitService) throw new Error('FeedbackManager requires a gitService instance');
    
    // 依存関係の設定
    this.storageService = options.storageService;
    this.gitService = options.gitService;
    this.logger = options.logger || console;
    this.eventEmitter = options.eventEmitter;
    this.errorHandler = options.errorHandler;
    this.handlebars = options.handlebars;
    
    // 設定オプションの設定
    this.config = options.config || {};
    this.feedbackDir = this.config.feedbackDir || 'ai-context/feedback';
    this.templateDir = this.config.templateDir || 'src/templates/docs';
    
    // ディレクトリの存在確認はstorageServiceに委譲
    this.storageService.ensureDirectoryExists(`${this.feedbackDir}/feedback-history`);
    
    this.logger.info('FeedbackManager initialized', { 
      feedbackDir: this.feedbackDir,
      templateDir: this.templateDir
    });
    
    // イベントエミッターが存在する場合はイベントを発行
    if (this.eventEmitter) {
      this.eventEmitter.emit('feedback:manager:initialized', {
        feedbackDir: this.feedbackDir,
        templateDir: this.templateDir
      });
    }
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
    
    // 状態の検証
    if (!['open', 'in_progress', 'resolved', 'wontfix'].includes(loop.status)) {
      this.logger.error(`不正な状態です: ${loop.status}`);
      return false;
    }
    
    // フィードバック項目の検証
    if (!Array.isArray(loop.feedback_items) || loop.feedback_items.length === 0) {
      this.logger.error('フィードバック項目がないか、配列ではありません');
      return false;
    }
    
    // 検証結果の検証
    if (!Array.isArray(loop.verification_results)) {
      this.logger.error('検証結果が配列ではありません');
      return false;
    }
    
    return true;
  }

  /**
   * 保留中のフィードバックを取得
   * @returns {Promise<Object|null>} 保留中のフィードバック
   */
  async getPendingFeedback() {
    try {
      const pendingFeedbackPath = `${this.feedbackDir}/pending-feedback.json`;
      
      if (!this.storageService.fileExists(pendingFeedbackPath)) {
        return null;
      }
      
      const feedback = await this.storageService.readJSON(pendingFeedbackPath);
      
      if (!feedback || !this.validateFeedback(feedback)) {
        return null;
      }
      
      return feedback;
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error, 'FeedbackManager', 'getPendingFeedback');
      } else {
        this.logger.error('保留中のフィードバックの取得に失敗しました:', error);
      }
      return null;
    }
  }

  /**
   * タスクIDでフィードバックを取得
   * @param {string} taskId - タスクID
   * @returns {Promise<Object|null>} フィードバック
   */
  async getFeedbackByTaskId(taskId) {
    try {
      // タスクIDの検証
      const taskPattern = /^T[0-9]{3}$/;
      if (!taskId || !taskPattern.test(taskId)) {
        throw new Error(`不正なタスクID形式です: ${taskId}`);
      }
      
      // 履歴ディレクトリからフィードバックを検索
      const historyDir = `${this.feedbackDir}/feedback-history`;
      const files = await this.storageService.listFiles(historyDir);
      
      // タスクIDを含むファイル名を検索
      const feedbackFile = files.find(file => file.includes(`feedback-${taskId}`));
      
      if (!feedbackFile) {
        return null;
      }
      
      // ファイルからフィードバックを読み込み
      const feedback = await this.storageService.readJSON(`${historyDir}`, feedbackFile);
      
      if (!feedback || !this.validateFeedback(feedback)) {
        return null;
      }
      
      return feedback;
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error, 'FeedbackManager', 'getFeedbackByTaskId', { taskId });
      } else {
        this.logger.error(`タスクID ${taskId} のフィードバックの取得に失敗しました:`, error);
      }
      return null;
    }
  }
}

module.exports = {
  FeedbackManager,
  FEEDBACK_STATE_TRANSITIONS,
  FEEDBACK_TYPE_WEIGHTS
};
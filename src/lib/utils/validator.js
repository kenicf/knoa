/**
 * バリデーターユーティリティ
 * 
 * 入力検証、アクセス制御、データ保護などのセキュリティ機能を提供します。
 */

const { ValidationError } = require('./errors');

/**
 * バリデーターユーティリティクラス
 */
class Validator {
  /**
   * コンストラクタ
   * @param {Object} options - オプション
   */
  constructor(options = {}) {
    this.logger = options.logger || console;
  }

  /**
   * タスク入力を検証
   * @param {Object} taskData - タスクデータ
   * @returns {ValidationResult} 検証結果
   */
  validateTaskInput(taskData) {
    const errors = [];
    
    // 必須フィールドのチェック
    if (!taskData.title || typeof taskData.title !== 'string') {
      errors.push('タイトルは必須の文字列です');
    }
    
    if (taskData.title && taskData.title.length > 200) {
      errors.push('タイトルは200文字以内にしてください');
    }
    
    if (!taskData.description || typeof taskData.description !== 'string') {
      errors.push('説明は必須の文字列です');
    }
    
    // ステータスのチェック
    const validStatuses = ['pending', 'in_progress', 'completed', 'blocked'];
    if (taskData.status && !validStatuses.includes(taskData.status)) {
      errors.push(`ステータスは ${validStatuses.join(', ')} のいずれかである必要があります`);
    }
    
    // 優先度のチェック
    if (taskData.priority !== undefined) {
      if (typeof taskData.priority !== 'number' || taskData.priority < 1 || taskData.priority > 5) {
        errors.push('優先度は1から5の整数である必要があります');
      }
    }
    
    // 見積もり時間のチェック
    if (taskData.estimated_hours !== undefined) {
      if (typeof taskData.estimated_hours !== 'number' || taskData.estimated_hours < 0) {
        errors.push('見積もり時間は0以上の数値である必要があります');
      }
    }
    
    // 進捗率のチェック
    if (taskData.progress_percentage !== undefined) {
      if (typeof taskData.progress_percentage !== 'number' || 
          taskData.progress_percentage < 0 || 
          taskData.progress_percentage > 100) {
        errors.push('進捗率は0から100の数値である必要があります');
      }
    }
    
    // 依存関係のチェック
    if (taskData.dependencies) {
      if (!Array.isArray(taskData.dependencies)) {
        errors.push('依存関係は配列である必要があります');
      } else {
        for (const dependency of taskData.dependencies) {
          if (!dependency.task_id || typeof dependency.task_id !== 'string') {
            errors.push('依存関係のタスクIDは必須の文字列です');
          }
          
          if (dependency.task_id && !dependency.task_id.match(/^T[0-9]{3}$/)) {
            errors.push('依存関係のタスクIDはT000形式である必要があります');
          }
          
          if (dependency.type && !['strong', 'weak'].includes(dependency.type)) {
            errors.push('依存関係のタイプはstrongまたはweakである必要があります');
          }
        }
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * セッション入力を検証
   * @param {Object} sessionData - セッションデータ
   * @returns {ValidationResult} 検証結果
   */
  validateSessionInput(sessionData) {
    const errors = [];
    
    // 基本的な構造チェック
    if (!sessionData || !sessionData.session_handover) {
      errors.push('セッションオブジェクトが不正です');
      return { isValid: false, errors };
    }
    
    const handover = sessionData.session_handover;
    
    // 必須フィールドのチェック
    const requiredFields = ['project_id', 'session_id', 'session_timestamp', 'project_state_summary'];
    for (const field of requiredFields) {
      if (!handover[field]) {
        errors.push(`必須フィールド ${field} がありません`);
      }
    }
    
    // project_state_summaryのチェック
    if (handover.project_state_summary) {
      const stateSummary = handover.project_state_summary;
      if (!Array.isArray(stateSummary.completed_tasks) || 
          !Array.isArray(stateSummary.current_tasks) || 
          !Array.isArray(stateSummary.pending_tasks)) {
        errors.push('project_state_summary の必須フィールドがありません');
      }
      
      // タスクIDの形式チェック
      const taskPattern = /^T[0-9]{3}$/;
      const allTasks = [
        ...stateSummary.completed_tasks,
        ...stateSummary.current_tasks,
        ...stateSummary.pending_tasks,
        ...(stateSummary.blocked_tasks || [])
      ];
      
      for (const taskId of allTasks) {
        if (!taskPattern.test(taskId)) {
          errors.push(`不正なタスクID形式です: ${taskId}`);
        }
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * フィードバック入力を検証
   * @param {Object} feedbackData - フィードバックデータ
   * @returns {ValidationResult} 検証結果
   */
  validateFeedbackInput(feedbackData) {
    const errors = [];
    
    // 基本的な構造チェック
    if (!feedbackData || !feedbackData.feedback_loop) {
      errors.push('フィードバックオブジェクトが不正です');
      return { isValid: false, errors };
    }
    
    const loop = feedbackData.feedback_loop;
    
    // 必須フィールドのチェック
    const requiredFields = ['task_id', 'verification_results'];
    for (const field of requiredFields) {
      if (!loop[field]) {
        errors.push(`必須フィールド ${field} がありません`);
      }
    }
    
    // タスクIDの形式チェック
    if (loop.task_id && !loop.task_id.match(/^T[0-9]{3}$/)) {
      errors.push(`不正なタスクID形式です: ${loop.task_id}`);
    }
    
    // verification_resultsのチェック
    if (loop.verification_results) {
      const vr = loop.verification_results;
      
      // passes_testsのチェック
      if (typeof vr.passes_tests !== 'boolean') {
        errors.push('passes_testsはブール値である必要があります');
      }
    }
    
    // feedback_statusのチェック
    if (loop.feedback_status && !['open', 'in_progress', 'resolved', 'wontfix'].includes(loop.feedback_status)) {
      errors.push('feedback_statusは open, in_progress, resolved, wontfix のいずれかである必要があります');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * 文字列をサニタイズ
   * @param {string} str - サニタイズする文字列
   * @returns {string} サニタイズされた文字列
   */
  sanitizeString(str) {
    if (typeof str !== 'string') {
      return '';
    }
    
    // 基本的なサニタイズ処理
    return str
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * 後方互換性のための静的メソッド
   * @param {Object} taskData - タスクデータ
   * @returns {ValidationResult} 検証結果
   */
  static validateTaskInput(taskData) {
    const validator = new Validator();
    return validator.validateTaskInput(taskData);
  }

  /**
   * 後方互換性のための静的メソッド
   * @param {Object} sessionData - セッションデータ
   * @returns {ValidationResult} 検証結果
   */
  static validateSessionInput(sessionData) {
    const validator = new Validator();
    return validator.validateSessionInput(sessionData);
  }

  /**
   * 後方互換性のための静的メソッド
   * @param {Object} feedbackData - フィードバックデータ
   * @returns {ValidationResult} 検証結果
   */
  static validateFeedbackInput(feedbackData) {
    const validator = new Validator();
    return validator.validateFeedbackInput(feedbackData);
  }

  /**
   * 後方互換性のための静的メソッド
   * @param {string} str - サニタイズする文字列
   * @returns {string} サニタイズされた文字列
   */
  static sanitizeString(str) {
    const validator = new Validator();
    return validator.sanitizeString(str);
  }
}

module.exports = Validator;
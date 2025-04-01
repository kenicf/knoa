/**
 * タスクデータ検証クラス
 */

// constants.js から PROGRESS_STATES をインポート
const { PROGRESS_STATES } = require('../../core/constants');

class TaskValidator {
  /**
   * コンストラクタ
   * @param {Object} options - オプション
   * @param {Object} options.logger - ロガー (必須)
   */
  constructor(options = {}) {
    if (!options.logger) {
      throw new Error('TaskValidator requires a logger instance');
    }
    this.logger = options.logger;
    // 必要に応じて他の依存関係 (例: TaskRepository) を注入
  }

  /**
   * タスクデータを検証する
   * @param {Object} task - 検証するタスクデータ
   * @returns {Object} 検証結果（isValid: boolean, errors: string[]）
   */
  validate(task) {
    const errors = [];

    // 基本的な構造チェック
    if (!task) {
      errors.push('タスクオブジェクトが不正です');
      return { isValid: false, errors };
    }

    // 必須フィールドのチェック
    const requiredFields = ['id', 'title', 'description', 'priority', 'status'];
    /* eslint-disable security/detect-object-injection -- field は固定配列由来のため、このループ内では安全と判断 */
    for (const field of requiredFields) {
      if (
        task[field] === undefined ||
        task[field] === null ||
        task[field] === ''
      ) {
        errors.push(`必須フィールド ${field} がありません`);
      }
    }
    /* eslint-enable security/detect-object-injection */

    // タスクIDの形式チェック
    if (task.id && !task.id.match(/^T[0-9]{3}$/)) {
      errors.push(`不正なタスクID形式です: ${task.id}`);
    }

    // タイトルの長さチェック (追加)
    if (task.title && task.title.length > 200) {
      errors.push('タイトルは200文字以内にしてください');
    }

    // 優先度のチェック
    if (task.priority && typeof task.priority !== 'number') {
      errors.push(`優先度は数値である必要があります: ${task.priority}`);
    } else if (task.priority && (task.priority < 1 || task.priority > 5)) {
      errors.push(`不正な優先度です (1-5): ${task.priority}`);
    }

    // 状態のチェック
    if (
      task.status &&
      ![
        'not_started',
        'in_progress',
        'completed',
        'pending',
        'blocked',
      ].includes(task.status) // pending, blocked も追加
    ) {
      errors.push(`不正な状態です: ${task.status}`);
    }

    // 進捗状態のチェック
    if (
      task.progress_state &&
      !Object.prototype.hasOwnProperty.call(
        PROGRESS_STATES,
        task.progress_state
      ) // インポートした定数を使用し、hasOwnProperty でチェック
    ) {
      errors.push(`不正な進捗状態です: ${task.progress_state}`);
    }

    // 進捗率のチェック
    if (task.progress_percentage !== undefined) {
      const progress = Number(task.progress_percentage);
      if (isNaN(progress) || progress < 0 || progress > 100) {
        errors.push(`不正な進捗率です: ${task.progress_percentage}`);
      }
    }

    // 依存関係のチェック (形式のみ)
    if (task.dependencies && !Array.isArray(task.dependencies)) {
      errors.push('依存関係は配列である必要があります');
    } else if (task.dependencies) {
      task.dependencies.forEach((dep, index) => {
        if (!dep || typeof dep !== 'object') {
          errors.push(`依存関係[${index}]がオブジェクトではありません`);
        } else if (
          !dep.task_id ||
          typeof dep.task_id !== 'string' ||
          !dep.task_id.match(/^T[0-9]{3}$/)
        ) {
          errors.push(`依存関係[${index}]のtask_idが不正です: ${dep.task_id}`);
        } else if (dep.type && !['strong', 'weak'].includes(dep.type)) {
          errors.push(`依存関係[${index}]のtypeが不正です: ${dep.type}`);
        }
      });
    }

    // estimated_hours のチェック
    if (task.estimated_hours !== undefined) {
      const hours = Number(task.estimated_hours);
      if (isNaN(hours) || hours < 0) {
        errors.push(`不正な見積もり時間です: ${task.estimated_hours}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * タスク階層を検証する (基本チェックのみ)
   * @param {Object} hierarchy - 検証するタスク階層データ
   * @returns {Object} 検証結果（isValid: boolean, errors: string[]）
   */
  validateHierarchy(hierarchy) {
    const errors = [];
    if (!hierarchy) {
      errors.push('階層データが不正です');
      // hierarchy が null や undefined の場合、以降のチェックは不要なのでここで返す
      return { isValid: false, errors };
    }
    // epics が存在し、かつ配列でない場合にエラー
    if (hierarchy.epics !== undefined && !Array.isArray(hierarchy.epics)) {
      errors.push('epicsは配列である必要があります');
    }
    // stories が存在し、かつ配列でない場合にエラー
    if (hierarchy.stories !== undefined && !Array.isArray(hierarchy.stories)) {
      errors.push('storiesは配列である必要があります');
    }
    // TODO: より詳細な検証ロジックを追加 (IDの存在確認、循環参照チェックなど)
    return { isValid: errors.length === 0, errors };
  }

  // 必要に応じて他の検証メソッドを追加
}

module.exports = { TaskValidator };

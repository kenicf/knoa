/**
 * タスク管理ユーティリティ
 *
 * タスクの検証、依存関係管理、進捗管理、Git連携などの機能を提供します。
 */

// 進捗状態の定義
const PROGRESS_STATES = {
  not_started: {
    description: 'タスクがまだ開始されていない状態',
    default_percentage: 0,
  },
  planning: {
    description: 'タスクの計画段階',
    default_percentage: 10,
  },
  in_development: {
    description: '開発中の状態',
    default_percentage: 30,
  },
  implementation_complete: {
    description: '実装が完了した状態',
    default_percentage: 60,
  },
  in_review: {
    description: 'レビュー中の状態',
    default_percentage: 70,
  },
  review_complete: {
    description: 'レビューが完了した状態',
    default_percentage: 80,
  },
  in_testing: {
    description: 'テスト中の状態',
    default_percentage: 90,
  },
  completed: {
    description: 'タスクが完了した状態',
    default_percentage: 100,
  },
};

// 状態遷移の定義
const STATE_TRANSITIONS = {
  not_started: ['planning', 'in_development'],
  planning: ['in_development'],
  in_development: ['implementation_complete', 'in_review'],
  implementation_complete: ['in_review'],
  in_review: ['review_complete', 'in_development'],
  review_complete: ['in_testing'],
  in_testing: ['completed', 'in_development'],
  completed: [],
};

/**
 * タスク管理クラス
 */
class TaskManager {
  /**
   * コンストラクタ
   * @param {Object} options - オプションオブジェクト
   * @param {Object} options.storageService - ストレージサービス（必須）
   * @param {Object} options.gitService - Gitサービス（必須）
   * @param {Object} options.logger - ロガー
   * @param {Object} options.eventEmitter - イベントエミッター
   * @param {Object} options.errorHandler - エラーハンドラー
   * @param {Object} options.config - 設定オプション
   * @param {string} options.config.tasksDir - タスクディレクトリのパス
   * @param {string} options.config.currentTasksFile - 現在のタスクファイル名
   */
  constructor(options = {}) {
    // 必須依存関係の検証
    if (!options.storageService)
      throw new Error('TaskManager requires a storageService instance');
    if (!options.gitService)
      throw new Error('TaskManager requires a gitService instance');

    // 依存関係の設定
    this.storageService = options.storageService;
    this.gitService = options.gitService;
    this.logger = options.logger || console;
    this.eventEmitter = options.eventEmitter;
    this.errorHandler = options.errorHandler;

    // 設定オプションの設定
    this.config = options.config || {};
    this.tasksDir = this.config.tasksDir || 'ai-context/tasks';
    this.currentTasksFile =
      this.config.currentTasksFile || 'current-tasks.json';

    // ディレクトリの存在確認はstorageServiceに委譲
    this.storageService.ensureDirectoryExists(this.tasksDir);

    this.logger.info('TaskManager initialized', {
      tasksDir: this.tasksDir,
    });

    // イベントエミッターが存在する場合はイベントを発行
    if (this.eventEmitter) {
      this.eventEmitter.emit('task:manager:initialized', {
        tasksDir: this.tasksDir,
        currentTasksFile: this.currentTasksFile,
      });
    }
  }

  /**
   * タスクを検証する
   * @param {Object} task - 検証するタスク
   * @returns {Object} 検証結果（isValid: boolean, errors: string[]）
   */
  validateTask(task) {
    const errors = [];

    // 基本的な構造チェック
    if (!task) {
      errors.push('タスクオブジェクトが不正です');
      return { isValid: false, errors };
    }

    // 必須フィールドのチェック
    const requiredFields = ['id', 'title', 'description', 'priority', 'status'];
    for (const field of requiredFields) {
      if (!task[field]) {
        errors.push(`必須フィールド ${field} がありません`);
      }
    }

    // タスクIDの形式チェック
    if (task.id && !task.id.match(/^T[0-9]{3}$/)) {
      errors.push(`不正なタスクID形式です: ${task.id}`);
    }

    // 優先度のチェック
    if (task.priority && !['high', 'medium', 'low'].includes(task.priority)) {
      errors.push(`不正な優先度です: ${task.priority}`);
    }

    // 状態のチェック
    if (
      task.status &&
      !['not_started', 'in_progress', 'completed'].includes(task.status)
    ) {
      errors.push(`不正な状態です: ${task.status}`);
    }

    // 進捗状態のチェック
    if (
      task.progress_state &&
      !Object.keys(PROGRESS_STATES).includes(task.progress_state)
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

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * すべてのタスクを取得する
   * @returns {Promise<Object>} タスクコレクション
   */
  async getAllTasks() {
    try {
      const tasksPath = `${this.tasksDir}/${this.currentTasksFile}`;

      if (!this.storageService.fileExists(tasksPath)) {
        return { tasks: [] };
      }

      const tasks = await this.storageService.readJSON(tasksPath);

      return tasks || { tasks: [] };
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error, 'TaskManager', 'getAllTasks');
      } else {
        this.logger.error('タスクの取得に失敗しました:', error);
      }
      return { tasks: [] };
    }
  }

  /**
   * IDでタスクを取得する
   * @param {string} taskId - タスクID
   * @returns {Promise<Object|null>} タスク、存在しない場合はnull
   */
  async getTaskById(taskId) {
    try {
      // タスクIDの検証
      if (!taskId || !taskId.match(/^T[0-9]{3}$/)) {
        throw new Error(`不正なタスクID形式です: ${taskId}`);
      }

      const tasks = await this.getAllTasks();

      if (!tasks || !Array.isArray(tasks.tasks)) {
        return null;
      }

      return tasks.tasks.find((task) => task.id === taskId) || null;
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error, 'TaskManager', 'getTaskById', {
          taskId,
        });
      } else {
        this.logger.error(`タスクID ${taskId} の取得に失敗しました:`, error);
      }
      return null;
    }
  }
}

module.exports = {
  TaskManager,
  PROGRESS_STATES,
  STATE_TRANSITIONS,
};

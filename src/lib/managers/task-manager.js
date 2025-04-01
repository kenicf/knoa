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
  planning: { description: 'タスクの計画段階', default_percentage: 10 },
  in_development: { description: '開発中の状態', default_percentage: 30 },
  implementation_complete: {
    description: '実装が完了した状態',
    default_percentage: 60,
  },
  in_review: { description: 'レビュー中の状態', default_percentage: 70 },
  review_complete: {
    description: 'レビューが完了した状態',
    default_percentage: 80,
  },
  in_testing: { description: 'テスト中の状態', default_percentage: 90 },
  completed: { description: 'タスクが完了した状態', default_percentage: 100 },
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
   * @param {Object} options.taskRepository - タスクリポジトリ（必須）
   * @param {Object} options.gitService - Gitサービス（必須）
   * @param {Object} options.logger - ロガー（必須）
   * @param {Object} options.eventEmitter - イベントエミッター（必須）
   * @param {Object} options.errorHandler - エラーハンドラー（必須）
   * @param {Object} options.taskValidator - タスクバリデーター（必須）
   * @param {Object} options.config - 設定オプション
   */
  constructor(options = {}) {
    // 必須依存関係の検証
    if (!options.taskRepository)
      throw new Error('TaskManager requires a taskRepository instance');
    if (!options.gitService)
      throw new Error('TaskManager requires a gitService instance');
    if (!options.logger)
      throw new Error('TaskManager requires a logger instance');
    if (!options.eventEmitter)
      throw new Error('TaskManager requires an eventEmitter instance');
    if (!options.errorHandler)
      throw new Error('TaskManager requires an errorHandler instance');
    if (!options.taskValidator)
      // taskValidator の検証を追加
      throw new Error('TaskManager requires a taskValidator instance');

    // 依存関係の設定
    this.taskRepository = options.taskRepository;
    this.gitService = options.gitService;
    this.logger = options.logger;
    this.eventEmitter = options.eventEmitter;
    this.errorHandler = options.errorHandler;
    this.taskValidator = options.taskValidator; // taskValidator を設定

    // 設定オプションの設定 (必要であれば)
    this.config = options.config || {};

    this.logger.info('TaskManager initialized');

    // イベントエミッターが存在する場合はイベントを発行
    // 標準化されたイベント発行ヘルパーを使用することを推奨
    // emitStandardizedEvent(this.eventEmitter, 'task_manager', 'initialized');
    this.eventEmitter.emitStandardized('task_manager', 'initialized'); // 直接呼び出し
  }

  /**
   * すべてのタスクを取得する
   * @returns {Promise<Array>} タスクの配列
   */
  async getAllTasks() {
    try {
      // TaskRepository を使用してすべてのタスクデータを取得
      const taskData = await this.taskRepository.getAll();
      // taskData が null や undefined でないこと、および tasks プロパティが配列であることを確認
      return taskData && Array.isArray(taskData.tasks) ? taskData.tasks : [];
    } catch (error) {
      // エラーハンドリング: errorHandler があれば委譲、なければログ出力
      this.errorHandler.handle(error, 'TaskManager', 'getAllTasks');
      // エラー時は空配列を返す（あるいはエラーを再スローする）
      return [];
    }
  }

  /**
   * IDでタスクを取得する
   * @param {string} taskId - タスクID
   * @returns {Promise<Object|null>} タスク、存在しない場合はnull
   */
  async getTaskById(taskId) {
    try {
      // タスクIDの検証 (リポジトリ側でも検証されるが、Manager層でも行うのが一般的)
      if (!taskId || !taskId.match(/^T[0-9]{3}$/)) {
        // ValidationError を使用する (Repository からインポートが必要)
        // const { ValidationError } = require('../data/repository'); // ファイル先頭に追加
        // throw new ValidationError(`不正なタスクID形式です: ${taskId}`);
        // 現状は Error のままにしておく (リファクタリングフェーズで検討)
        throw new Error(`不正なタスクID形式です: ${taskId}`);
      }

      // TaskRepository を使用してIDでタスクを取得
      const task = await this.taskRepository.getById(taskId);
      return task; // getById は見つからない場合 null を返す
    } catch (error) {
      // NotFoundError はそのままスローするか、null を返すか検討
      // if (error instanceof NotFoundError) {
      //   return null;
      // }
      // それ以外のエラーは errorHandler に委譲
      this.errorHandler.handle(error, 'TaskManager', 'getTaskById', { taskId });
      // エラー時は null を返す（あるいはエラーを再スローする）
      return null;
    }
  }

  /**
   * 新しいタスクを作成する
   * @param {Object} taskData - 作成するタスクのデータ
   * @returns {Promise<Object>} 作成されたタスクオブジェクト
   * @throws {ValidationError} バリデーションエラーの場合
   * @throws {DataConsistencyError} ID重複の場合
   * @throws {Error} その他の作成エラーの場合
   */
  async createTask(taskData) {
    // バリデーション (将来的には TaskValidator を使用)
    const validationResult = this.taskValidator.validate(taskData);
    if (!validationResult.isValid) {
      // ValidationError を使用する (Repository からインポートが必要)
      // const { ValidationError } = require('../data/repository'); // ファイル先頭に追加
      // throw new ValidationError('Invalid task data', validationResult.errors);
      // 現状は Error のままにしておく
      throw new Error(
        `Invalid task data: ${validationResult.errors.join(', ')}`
      );
    }

    try {
      // TaskRepository を使用してタスクを作成
      const createdTask = await this.taskRepository.create(taskData);

      // イベント発行
      this.eventEmitter.emitStandardized('task_manager', 'task_created', {
        task: createdTask,
      });

      this.logger.info(`Task created: ${createdTask.id}`, {
        taskId: createdTask.id,
      });
      return createdTask;
    } catch (error) {
      // Repository からスローされる可能性のあるエラーをハンドル
      // (ValidationError, DataConsistencyError, NotFoundError は Repository 側で処理される想定だが念のため)
      // if (error instanceof ValidationError || error instanceof DataConsistencyError || error instanceof NotFoundError) {
      //   this.errorHandler.handle(error, 'TaskManager', 'createTask', { taskData });
      //   throw error; // 特定のエラーは再スローするなども検討
      // }

      // その他のエラーをハンドル
      this.errorHandler.handle(error, 'TaskManager', 'createTask', {
        taskData,
      });
      // エラーを再スローするか、null や特定の値を返すか検討 (ここでは再スロー)
      throw new Error(`Failed to create task: ${error.message}`);
    }
  }

  /**
   * タスクを更新する
   * @param {string} taskId - 更新するタスクのID
   * @param {Object} updateData - 更新データ
   * @returns {Promise<Object>} 更新されたタスクオブジェクト
   * @throws {ValidationError} バリデーションエラーの場合
   * @throws {NotFoundError} タスクが見つからない場合
   * @throws {Error} その他の更新エラーの場合
   */
  async updateTask(taskId, updateData) {
    // 更新データとIDを結合してバリデーション (将来的には TaskValidator を使用)
    const taskToValidate = { ...updateData, id: taskId };
    const validationResult = this.taskValidator.validate(taskToValidate);
    if (!validationResult.isValid) {
      // throw new ValidationError('Invalid task data', validationResult.errors);
      throw new Error(
        `Invalid task data: ${validationResult.errors.join(', ')}`
      );
    }

    try {
      // TaskRepository を使用してタスクを更新
      const updatedTask = await this.taskRepository.update(taskId, updateData);

      // イベント発行
      this.eventEmitter.emitStandardized('task_manager', 'task_updated', {
        taskId,
        updateData,
      });

      this.logger.info(`Task updated: ${taskId}`, { taskId });
      return updatedTask;
    } catch (error) {
      // Repository からスローされる可能性のあるエラーをハンドル
      // if (error instanceof ValidationError || error instanceof NotFoundError) {
      //   this.errorHandler.handle(error, 'TaskManager', 'updateTask', { taskId, updateData });
      //   throw error;
      // }

      // その他のエラーをハンドル
      this.errorHandler.handle(error, 'TaskManager', 'updateTask', {
        taskId,
        updateData,
      });
      throw new Error(`Failed to update task ${taskId}: ${error.message}`);
    }
  }
}

module.exports = {
  TaskManager,
  PROGRESS_STATES,
  STATE_TRANSITIONS,
};

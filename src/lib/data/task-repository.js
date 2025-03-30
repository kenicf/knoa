/**
 * タスクリポジトリクラス
 *
 * タスク管理のためのリポジトリクラス。
 * タスクの検索、状態管理、依存関係管理、Git連携などの機能を提供します。
 */

const { Repository, NotFoundError, ValidationError } = require('./repository');

/**
 * タスクリポジトリクラス
 */
class TaskRepository extends Repository {
  /**
   * コンストラクタ
   * @param {Object} storageService - ストレージサービス
   * @param {Object} validator - バリデータ
   * @param {Object} options - オプション
   */
  constructor(storageService, validator, options = {}) {
    super(storageService, 'task', {
      ...options,
      directory: options.directory || 'ai-context/tasks',
      currentFile: options.currentFile || 'current-tasks.json',
      historyDirectory: options.historyDirectory || 'task-history',
      validator,
    });

    // 進捗状態の定義
    this.progressStates = {
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
    this.stateTransitions = {
      not_started: ['planning', 'in_development'],
      planning: ['in_development'],
      in_development: ['implementation_complete', 'in_review'],
      implementation_complete: ['in_review'],
      in_review: ['review_complete', 'in_development'],
      review_complete: ['in_testing'],
      in_testing: ['completed', 'in_development'],
      completed: [],
    };
  }

  /**
   * ステータスによるタスクの取得
   * @param {string} status - タスクステータス
   * @returns {Promise<Array>} タスクの配列
   */
  async getTasksByStatus(status) {
    try {
      const tasks = await this.getAll();
      if (!tasks || !Array.isArray(tasks.tasks)) {
        return [];
      }
      return tasks.tasks.filter((task) => task.status === status);
    } catch (error) {
      // テストケースに合わせて、エラーメッセージをそのまま使用
      throw new Error(
        `Failed to get tasks by status ${status}: ${error.message.replace('Failed to get all tasks: ', '')}`
      );
    }
  }

  /**
   * 依存関係によるタスクの取得
   * @param {string} dependencyId - 依存タスクID
   * @returns {Promise<Array>} タスクの配列
   */
  async getTasksByDependency(dependencyId) {
    try {
      const tasks = await this.getAll();
      if (!tasks || !Array.isArray(tasks.tasks)) {
        return [];
      }
      return tasks.tasks.filter(
        (task) =>
          task.dependencies &&
          task.dependencies.some((dep) => dep.task_id === dependencyId)
      );
    } catch (error) {
      throw new Error(
        `Failed to get tasks by dependency ${dependencyId}: ${error.message}`
      );
    }
  }

  /**
   * 優先度によるタスクの取得
   * @param {number} priority - 優先度
   * @returns {Promise<Array>} タスクの配列
   */
  async getTasksByPriority(priority) {
    try {
      const tasks = await this.getAll();
      if (!tasks || !Array.isArray(tasks.tasks)) {
        return [];
      }
      return tasks.tasks.filter((task) => task.priority === priority);
    } catch (error) {
      throw new Error(
        `Failed to get tasks by priority ${priority}: ${error.message}`
      );
    }
  }

  /**
   * 進捗状態によるタスクの取得
   * @param {string} progressState - 進捗状態
   * @returns {Promise<Array>} タスクの配列
   */
  async getTasksByProgressState(progressState) {
    try {
      const tasks = await this.getAll();
      if (!tasks || !Array.isArray(tasks.tasks)) {
        return [];
      }
      return tasks.tasks.filter(
        (task) => task.progress_state === progressState
      );
    } catch (error) {
      throw new Error(
        `Failed to get tasks by progress state ${progressState}: ${error.message}`
      );
    }
  }

  /**
   * タスクの進捗状態を更新
   * @param {string} id - タスクID
   * @param {string} newState - 新しい進捗状態
   * @param {number} customPercentage - カスタム進捗率
   * @returns {Promise<Object>} 更新されたタスク
   */
  async updateTaskProgress(id, newState, customPercentage) {
    try {
      // タスクを取得
      const task = await this.getById(id);
      if (!task) {
        throw new NotFoundError(`Task with id ${id} not found`);
      }

      // 依存関係のチェック
      const dependencyCheck = await this.checkDependencies(id);
      if (!dependencyCheck.isValid) {
        throw new Error(dependencyCheck.errors.join(', '));
      }

      // 進捗状態の検証
      // progressStates 自身がプロパティを持っているかを確認
      if (
        !Object.prototype.hasOwnProperty.call(this.progressStates, newState)
      ) {
        throw new Error(`Invalid progress state: ${newState}`);
      }

      // 現在の状態から新しい状態への遷移が許可されているかチェック
      const currentState = task.progress_state || 'not_started';
      if (
        currentState !== newState &&
        // stateTransitions 自身がプロパティを持っているかを確認
        (!Object.prototype.hasOwnProperty.call(
          this.stateTransitions,
          currentState
        ) ||
          // eslint-disable-next-line security/detect-object-injection
          !this.stateTransitions[currentState].includes(newState))
      ) {
        throw new Error(
          `Transition from ${currentState} to ${newState} is not allowed`
        );
      }

      // タスクのコピーを作成
      const updatedTask = { ...task };

      // 進捗状態を更新
      updatedTask.progress_state = newState;

      // 進捗率を更新
      if (customPercentage !== undefined) {
        updatedTask.progress_percentage = customPercentage;
      } else {
        // progressStates 自身がプロパティを持っているかを確認
        if (
          Object.prototype.hasOwnProperty.call(this.progressStates, newState)
        ) {
          updatedTask.progress_percentage =
            // eslint-disable-next-line security/detect-object-injection -- hasOwnProperty でキーの存在をチェック済みのため抑制
            this.progressStates[newState].default_percentage;
        } else {
          // newState が不正な場合はエラーにするか、デフォルト値を設定するか検討
          // ここでは念のため 0 を設定
          updatedTask.progress_percentage = 0;
        }
      }

      // タスクのステータスを更新
      if (newState === 'completed') {
        updatedTask.status = 'completed';
      } else if (newState === 'not_started') {
        updatedTask.status = 'pending';
      } else {
        updatedTask.status = 'in_progress';
      }

      // タスクを更新
      return await this.update(id, updatedTask);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new Error(`Failed to update task progress: ${error.message}`);
    }
  }

  /**
   * タスクにコミット情報を関連付ける
   * @param {string} taskId - タスクID
   * @param {string} commitHash - コミットハッシュ
   * @returns {Promise<Object>} 更新されたタスク
   */
  async associateCommitWithTask(taskId, commitHash) {
    try {
      // タスクを取得
      const task = await this.getById(taskId);
      if (!task) {
        throw new NotFoundError(`Task with id ${taskId} not found`);
      }

      // git_commitsフィールドがなければ作成
      if (!task.git_commits) {
        task.git_commits = [];
      }

      // 既に関連付けられていなければ追加
      if (!task.git_commits.includes(commitHash)) {
        task.git_commits.push(commitHash);
        return await this.update(taskId, task);
      }

      // 重複の場合は更新せずに既存のタスクを返す
      // この場合、update メソッドは呼ばれない
      return task;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new Error(`Failed to associate commit with task: ${error.message}`);
    }
  }

  /**
   * 依存関係をチェック
   * @param {string} taskId - チェックするタスクのID
   * @returns {Promise<Object>} チェック結果（isValid: boolean, errors: string[]）
   */
  async checkDependencies(taskId) {
    try {
      const errors = [];
      const visited = new Set();
      const recursionStack = new Set();

      // 全タスクを取得
      const allTasks = await this.getAll();
      const tasks = allTasks.tasks || [];

      // 循環依存をチェックする深さ優先探索
      const checkCircularDependency = (currentId) => {
        if (recursionStack.has(currentId)) {
          errors.push('循環依存が検出されました');
          return true;
        }

        if (visited.has(currentId)) {
          return false;
        }

        visited.add(currentId);
        recursionStack.add(currentId);

        const task = tasks.find((t) => t.id === currentId);
        if (!task) {
          errors.push(`タスク ${currentId} が見つかりません`);
          return false;
        }

        if (!task.dependencies) {
          return false;
        }

        for (const dep of task.dependencies) {
          if (checkCircularDependency(dep.task_id)) {
            return true;
          }
        }

        recursionStack.delete(currentId);
        return false;
      };

      checkCircularDependency(taskId);

      // 強い依存関係のタスクが完了しているかチェック
      const task = tasks.find((t) => t.id === taskId);
      if (task && task.dependencies) {
        for (const dep of task.dependencies) {
          if (dep.type === 'strong') {
            const depTask = tasks.find((t) => t.id === dep.task_id);
            if (!depTask) {
              errors.push(`依存タスク ${dep.task_id} が見つかりません`);
            } else if (depTask.status !== 'completed') {
              errors.push(
                `強い依存関係のタスク ${dep.task_id} がまだ完了していません`
              );
            }
          }
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
      };
    } catch (error) {
      throw new Error(`Failed to check dependencies: ${error.message}`);
    }
  }

  /**
   * タスク階層を取得
   * @returns {Promise<Object>} タスク階層
   */
  async getTaskHierarchy() {
    try {
      const tasks = await this.getAll();
      if (!tasks || !tasks.task_hierarchy) {
        return { epics: [], stories: [] };
      }

      return tasks.task_hierarchy;
    } catch (error) {
      throw new Error(`Failed to get task hierarchy: ${error.message}`);
    }
  }

  /**
   * タスク階層を更新
   * @param {Object} hierarchy - タスク階層
   * @returns {Promise<Object>} 更新されたタスク階層
   */
  async updateTaskHierarchy(hierarchy) {
    try {
      // 階層のバリデーション
      if (
        this.validator &&
        typeof this.validator.validateHierarchy === 'function'
      ) {
        const validation = this.validator.validateHierarchy(hierarchy);
        if (!validation.isValid) {
          throw new ValidationError(
            'Invalid task hierarchy',
            validation.errors
          );
        }
      }

      const tasks = await this.getAll();

      // タスク階層を更新
      tasks.task_hierarchy = hierarchy;

      // 保存
      await this.storage.writeJSON(this.directory, this.currentFile, tasks);

      return hierarchy;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new Error(`Failed to update task hierarchy: ${error.message}`);
    }
  }

  /**
   * 現在のフォーカスタスクを取得
   * @returns {Promise<string|null>} 現在のフォーカスタスクID
   */
  async getCurrentFocus() {
    try {
      const tasks = await this.getAll();
      return tasks.current_focus || null;
    } catch (error) {
      throw new Error(`Failed to get current focus: ${error.message}`);
    }
  }

  /**
   * 現在のフォーカスタスクを設定
   * @param {string} taskId - タスクID
   * @returns {Promise<string>} 設定されたタスクID
   */
  async setCurrentFocus(taskId) {
    try {
      // タスクの存在確認
      const task = await this.getById(taskId);
      if (!task) {
        throw new NotFoundError(`Task with id ${taskId} not found`);
      }

      const tasks = await this.getAll();

      // 現在のフォーカスを更新
      tasks.current_focus = taskId;

      // 保存
      await this.storage.writeJSON(this.directory, this.currentFile, tasks);

      return taskId;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new Error(`Failed to set current focus: ${error.message}`);
    }
  }
}

module.exports = { TaskRepository };

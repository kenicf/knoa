/**
 * タスクリポジトリクラス
 *
 * タスク管理のためのリポジトリクラス。
 * タスクの検索、状態管理、依存関係管理、Git連携などの機能を提供します。
 */

const {
  Repository,
  NotFoundError,
  ValidationError,
  DataConsistencyError,
} = require('./repository'); // DataConsistencyError もインポート
const { PROGRESS_STATES, STATE_TRANSITIONS } = require('../core/constants'); // 定数をインポート

/**
 * タスクリポジトリクラス
 */
class TaskRepository extends Repository {
  /**
   * コンストラクタ
   * @param {Object} options - オプション
   * @param {Object} options.storageService - ストレージサービス (必須)
   * @param {Object} options.taskValidator - タスクバリデーター (必須)
   * @param {Object} options.logger - ロガーインスタンス (必須)
   * @param {Object} [options.eventEmitter] - イベントエミッターインスタンス
   * @param {Object} [options.errorHandler] - エラーハンドラーインスタンス
   * @param {string} [options.directory] - ディレクトリパス
   * @param {string} [options.currentFile] - 現在のファイル名
   * @param {string} [options.historyDirectory] - 履歴ディレクトリ名
   */
  constructor(options = {}) {
    // 必須依存関係のチェック
    if (!options.storageService) {
      throw new Error('TaskRepository requires a storageService instance');
    }
    if (!options.taskValidator) {
      throw new Error('TaskRepository requires a taskValidator instance');
    }
    if (!options.logger) {
      throw new Error('TaskRepository requires a logger instance');
    }

    // 基底クラスのコンストラクタ呼び出し
    super({
      storageService: options.storageService,
      entityName: 'task',
      logger: options.logger,
      eventEmitter: options.eventEmitter, // 任意
      errorHandler: options.errorHandler, // 任意
      ...options, // directory, currentFile, historyDirectory など他のオプションも渡す
      directory: options.directory || 'ai-context/tasks',
      currentFile: options.currentFile || 'current-tasks.json',
      historyDirectory: options.historyDirectory || 'task-history',
    });

    this.taskValidator = options.taskValidator; // taskValidator を保持

    // 進捗状態と状態遷移の定義は constants.js からインポートして使用
  }

  /**
   * タスクの作成 (バリデーション追加)
   * @param {Object} data - タスクデータ
   * @returns {Promise<Object>} 作成されたタスク
   */
  async create(data) {
    const operation = 'create';
    try {
      // バリデーションを実行
      const validationResult = this.taskValidator.validate(data);
      if (!validationResult.isValid) {
        throw new ValidationError('Invalid task data', validationResult.errors);
      }
      // 基底クラスの create を呼び出す
      return await super.create(data);
    } catch (error) {
      if (this.errorHandler) {
        return this.errorHandler.handle(error, 'TaskRepository', operation, {
          data,
        });
      }
      // errorHandler がない場合は、特定のエラーはそのままスロー、それ以外はログ出力して再スロー
      if (
        error instanceof ValidationError ||
        error instanceof DataConsistencyError
      ) {
        this.logger.warn(
          `Validation or Consistency Error during ${operation}`,
          { error: error.message, errors: error.errors, context: error.context }
        );
        throw error;
      }
      this.logger.error(`Failed to ${operation} ${this.entityName}`, {
        data,
        error,
      });
      throw new Error(
        `Failed to ${operation} ${this.entityName}: ${error.message}`
      );
    }
  }

  /**
   * タスクの更新 (バリデーション追加)
   * @param {string} id - エンティティID
   * @param {Object} data - 更新データ
   * @returns {Promise<Object>} 更新されたエンティティ
   */
  async update(id, data) {
    const operation = 'update';
    try {
      // 更新データでタスク全体を検証 (部分更新の場合、既存データとマージしてから検証が必要になる場合がある)
      // ここでは、更新データのみで検証可能と仮定するか、getById で取得してから検証する
      const existingTask = await this.getById(id);
      if (!existingTask) {
        throw new NotFoundError(
          `Task with id ${id} not found for update validation`
        );
      }
      const dataToValidate = { ...existingTask, ...data }; // 既存データとマージして検証
      const validationResult = this.taskValidator.validate(dataToValidate);
      if (!validationResult.isValid) {
        throw new ValidationError(
          'Invalid task data for update',
          validationResult.errors
        );
      }
      // 基底クラスの update を呼び出す
      return await super.update(id, data);
    } catch (error) {
      if (this.errorHandler) {
        return this.errorHandler.handle(error, 'TaskRepository', operation, {
          id,
          data,
        });
      }
      // errorHandler がない場合は、特定のエラーはそのままスロー、それ以外はログ出力して再スロー
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        this.logger.warn(`Validation or Not Found Error during ${operation}`, {
          id,
          error: error.message,
          errors: error.errors,
        });
        throw error;
      }
      this.logger.error(
        `Failed to ${operation} ${this.entityName} with id ${id}`,
        { data, error }
      );
      throw new Error(
        `Failed to ${operation} ${this.entityName} with id ${id}: ${error.message}`
      );
    }
  }

  /**
   * ステータスによるタスクの取得
   * @param {string} status - タスクステータス
   * @returns {Promise<Array>} タスクの配列
   */
  async getTasksByStatus(status) {
    const operation = 'getTasksByStatus';
    try {
      const tasks = await this.getAll();
      if (!tasks || !Array.isArray(tasks.tasks)) {
        return [];
      }
      return tasks.tasks.filter((task) => task.status === status);
    } catch (error) {
      if (this.errorHandler) {
        // getAll でエラーが発生した場合、基底クラスの errorHandler が処理するはずだが、念のためここでもハンドル
        return this.errorHandler.handle(error, 'TaskRepository', operation, {
          status,
        });
      }
      this.logger.error(`Failed to ${operation}`, { status, error });
      // 元のエラーメッセージ形式を維持
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
    const operation = 'getTasksByDependency';
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
      if (this.errorHandler) {
        return this.errorHandler.handle(error, 'TaskRepository', operation, {
          dependencyId,
        });
      }
      this.logger.error(`Failed to ${operation}`, { dependencyId, error });
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
    const operation = 'getTasksByPriority';
    try {
      const tasks = await this.getAll();
      if (!tasks || !Array.isArray(tasks.tasks)) {
        return [];
      }
      return tasks.tasks.filter((task) => task.priority === priority);
    } catch (error) {
      if (this.errorHandler) {
        return this.errorHandler.handle(error, 'TaskRepository', operation, {
          priority,
        });
      }
      this.logger.error(`Failed to ${operation}`, { priority, error });
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
    const operation = 'getTasksByProgressState';
    try {
      const tasks = await this.getAll();
      if (!tasks || !Array.isArray(tasks.tasks)) {
        return [];
      }
      return tasks.tasks.filter(
        (task) => task.progress_state === progressState
      );
    } catch (error) {
      if (this.errorHandler) {
        return this.errorHandler.handle(error, 'TaskRepository', operation, {
          progressState,
        });
      }
      this.logger.error(`Failed to ${operation}`, { progressState, error });
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
    const operation = 'updateTaskProgress';
    try {
      // タスクを取得
      const task = await this.getById(id);
      if (!task) {
        throw new NotFoundError(`Task with id ${id} not found`);
      }

      // 依存関係のチェック
      const dependencyCheck = await this.checkDependencies(id);
      if (!dependencyCheck.isValid) {
        // 依存関係エラーは ValidationError または専用のエラークラスが適切かもしれない
        throw new ValidationError(
          'Dependency check failed',
          dependencyCheck.errors
        );
      }

      // 進捗状態の検証
      // 進捗状態の検証 (インポートした定数を使用)
      if (!Object.prototype.hasOwnProperty.call(PROGRESS_STATES, newState)) {
        throw new ValidationError(`Invalid progress state: ${newState}`);
      }

      // 現在の状態から新しい状態への遷移が許可されているかチェック
      const currentState = task.progress_state || 'not_started';
      if (
        currentState !== newState &&
        (!Object.prototype.hasOwnProperty.call(
          STATE_TRANSITIONS,
          currentState
        ) ||
          !STATE_TRANSITIONS[currentState].includes(newState))
      ) {
        throw new ValidationError( // StateError があればそちらを使うのがより適切
          `Transition from ${currentState} to ${newState} is not allowed`
        );
      }

      // タスクのコピーを作成
      const updatedTaskData = { ...task }; // 変数名変更

      // 進捗状態を更新
      updatedTaskData.progress_state = newState;

      // 進捗率を更新
      if (customPercentage !== undefined) {
        if (
          typeof customPercentage !== 'number' ||
          customPercentage < 0 ||
          customPercentage > 100
        ) {
          throw new ValidationError('Invalid custom percentage provided');
        }
        updatedTaskData.progress_percentage = customPercentage;
      } else {
        updatedTaskData.progress_percentage =
          PROGRESS_STATES[newState].default_percentage; // インポートした定数を使用
      }

      // タスクのステータスを更新
      if (newState === 'completed') {
        updatedTaskData.status = 'completed';
      } else if (newState === 'not_started') {
        updatedTaskData.status = 'pending';
      } else {
        updatedTaskData.status = 'in_progress';
      }

      // タスクを更新 (基底クラスの update を呼び出す)
      // update メソッド内でバリデーションが再度行われる
      return await this.update(id, updatedTaskData);
    } catch (error) {
      if (this.errorHandler) {
        return this.errorHandler.handle(error, 'TaskRepository', operation, {
          id,
          newState,
          customPercentage,
        });
      }
      // 特定のエラーはそのままスロー
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        this.logger.warn(`Error during ${operation}`, {
          id,
          newState,
          error: error.message,
          errors: error.errors,
        });
        throw error;
      }
      // checkDependencies 内のエラーは Error 型の可能性があるため、ここでラップするか検討
      this.logger.error(`Failed to ${operation}`, { id, newState, error });
      throw new Error(`Failed to update task progress: ${error.message}`); // 元のエラーメッセージを維持
    }
  }

  /**
   * タスクにコミット情報を関連付ける
   * @param {string} taskId - タスクID
   * @param {string} commitHash - コミットハッシュ
   * @returns {Promise<Object>} 更新されたタスク
   */
  async associateCommitWithTask(taskId, commitHash) {
    const operation = 'associateCommitWithTask';
    let task; // try ブロックの外で task を宣言
    try {
      task = await this.getById(taskId);
      if (!task) {
        throw new NotFoundError(`Task with id ${taskId} not found`);
      }

      // git_commitsフィールドがなければ作成
      const updatedTaskData = { ...task }; // 更新用データを作成
      if (!updatedTaskData.git_commits) {
        updatedTaskData.git_commits = [];
      }

      // 既に関連付けられていなければ追加
      if (!updatedTaskData.git_commits.includes(commitHash)) {
        updatedTaskData.git_commits.push(commitHash);
        // update メソッドを呼び出して保存とバリデーションを行う
        // ★★★ 内側の try...catch を削除 ★★★
        return await this.update(taskId, updatedTaskData);
      }
      return task;
    } catch (error) {
      if (this.errorHandler) {
        return this.errorHandler.handle(error, 'TaskRepository', operation, {
          taskId,
          commitHash,
        });
      }
      if (error instanceof NotFoundError) {
        this.logger.warn(`Error during ${operation}`, {
          taskId,
          commitHash,
          error: error.message,
        });
        throw error;
      }
      this.logger.error(`Failed to ${operation}`, {
        taskId,
        commitHash,
        error,
      });
      // 修正: エラーメッセージに error.message を含める
      throw new Error(`Failed to associate commit with task: ${error.message}`);
    }
  }

  /**
   * 依存関係をチェック
   * @param {string} taskId - チェックするタスクのID
   * @returns {Promise<Object>} チェック結果（isValid: boolean, errors: string[]）
   */
  async checkDependencies(taskId) {
    const operation = 'checkDependencies';
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
        if (visited.has(currentId)) return false;

        visited.add(currentId);
        recursionStack.add(currentId);

        const task = tasks.find((t) => t.id === currentId);
        // タスクが見つからない場合のエラー処理を追加
        if (!task) {
          errors.push(`依存チェック中: タスク ${currentId} が見つかりません`);
          recursionStack.delete(currentId); // スタックから削除
          return false; // 循環ではないがエラー
        }

        if (task.dependencies) {
          for (const dep of task.dependencies) {
            // 依存先タスクIDの存在チェックを追加
            const depTaskExists = tasks.some((t) => t.id === dep.task_id);
            if (!depTaskExists) {
              errors.push(
                `タスク ${currentId} の依存先タスク ${dep.task_id} が見つかりません`
              );
              // 依存先がない場合は循環チェックを続行できないが、エラーとして記録
            } else if (checkCircularDependency(dep.task_id)) {
              // 循環が見つかったらスタックを削除せずに true を返す
              return true;
            }
          }
        }
        recursionStack.delete(currentId);
        return false;
      };

      // 循環依存チェックを実行
      checkCircularDependency(taskId);

      // 強い依存関係のタスクが完了しているかチェック
      const task = tasks.find((t) => t.id === taskId);
      if (task && task.dependencies) {
        for (const dep of task.dependencies) {
          if (dep.type === 'strong') {
            const depTask = tasks.find((t) => t.id === dep.task_id);
            if (!depTask) {
              // このエラーは上のチェックで捕捉されるはずだが念のため
              errors.push(
                `強い依存関係のタスク ${dep.task_id} が見つかりません`
              );
            } else if (depTask.status !== 'completed') {
              errors.push(
                `強い依存関係のタスク ${dep.task_id} がまだ完了していません (現在の状態: ${depTask.status})`
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
      // getAll でのエラーは基底クラスで処理されるはず
      if (this.errorHandler) {
        // checkDependencies 自体の予期せぬエラーをハンドル
        return this.errorHandler.handle(error, 'TaskRepository', operation, {
          taskId,
        });
      }
      this.logger.error(`Failed to ${operation}`, { taskId, error });
      throw new Error(`Failed to check dependencies: ${error.message}`); // 元のエラーメッセージを維持
    }
  }

  /**
   * タスク階層を取得
   * @returns {Promise<Object>} タスク階層
   */
  async getTaskHierarchy() {
    const operation = 'getTaskHierarchy';
    try {
      const tasks = await this.getAll();
      // task_hierarchy が存在しない場合も考慮
      return tasks?.task_hierarchy || { epics: [], stories: [] };
    } catch (error) {
      if (this.errorHandler) {
        return this.errorHandler.handle(error, 'TaskRepository', operation, {});
      }
      this.logger.error(`Failed to ${operation}`, { error });
      throw new Error(`Failed to get task hierarchy: ${error.message}`); // 元のエラーメッセージを維持
    }
  }

  /**
   * タスク階層を更新
   * @param {Object} hierarchy - タスク階層
   * @returns {Promise<Object>} 更新されたタスク階層
   */
  async updateTaskHierarchy(hierarchy) {
    const operation = 'updateTaskHierarchy';
    try {
      // 階層のバリデーション (TaskValidator を使用)
      if (
        this.taskValidator &&
        typeof this.taskValidator.validateHierarchy === 'function'
      ) {
        const validation = this.taskValidator.validateHierarchy(hierarchy);
        if (!validation.isValid) {
          throw new ValidationError(
            'Invalid task hierarchy',
            validation.errors
          );
        }
      } else {
        this.logger.warn(
          'Task hierarchy validation skipped: validateHierarchy method not found on validator.'
        );
      }

      const tasks = await this.getAll();

      // タスク階層を更新
      const updatedTasks = { ...tasks, task_hierarchy: hierarchy }; // 新しいオブジェクトを作成

      // 保存
      await this.storage.writeJSON(
        this.directory,
        this.currentFile,
        updatedTasks
      );

      return hierarchy;
    } catch (error) {
      if (this.errorHandler) {
        return this.errorHandler.handle(error, 'TaskRepository', operation, {
          hierarchy,
        });
      }
      if (error instanceof ValidationError) {
        this.logger.warn(`Validation Error during ${operation}`, {
          error: error.message,
          errors: error.errors,
        });
        throw error;
      }
      this.logger.error(`Failed to ${operation}`, { hierarchy, error });
      throw new Error(`Failed to update task hierarchy: ${error.message}`); // 元のエラーメッセージを維持
    }
  }

  /**
   * 現在のフォーカスタスクを取得
   * @returns {Promise<string|null>} 現在のフォーカスタスクID
   */
  async getCurrentFocus() {
    const operation = 'getCurrentFocus';
    try {
      const tasks = await this.getAll();
      return tasks?.current_focus || null;
    } catch (error) {
      if (this.errorHandler) {
        return this.errorHandler.handle(error, 'TaskRepository', operation, {});
      }
      this.logger.error(`Failed to ${operation}`, { error });
      throw new Error(`Failed to get current focus: ${error.message}`); // 元のエラーメッセージを維持
    }
  }

  /**
   * 現在のフォーカスタスクを設定
   * @param {string} taskId - タスクID
   * @returns {Promise<string>} 設定されたタスクID
   */
  async setCurrentFocus(taskId) {
    const operation = 'setCurrentFocus';
    try {
      // タスクの存在確認
      const task = await this.getById(taskId);
      if (!task) {
        throw new NotFoundError(`Task with id ${taskId} not found`);
      }

      const tasks = await this.getAll();

      // 現在のフォーカスを更新
      const updatedTasks = { ...tasks, current_focus: taskId }; // 新しいオブジェクトを作成

      // 保存
      await this.storage.writeJSON(
        this.directory,
        this.currentFile,
        updatedTasks
      );

      return taskId;
    } catch (error) {
      if (this.errorHandler) {
        return this.errorHandler.handle(error, 'TaskRepository', operation, {
          taskId,
        });
      }
      if (error instanceof NotFoundError) {
        this.logger.warn(`Error during ${operation}`, {
          taskId,
          error: error.message,
        });
        throw error;
      }
      this.logger.error(`Failed to ${operation}`, { taskId, error });
      throw new Error(`Failed to set current focus: ${error.message}`); // 元のエラーメッセージを維持
    }
  }
}

module.exports = { TaskRepository };

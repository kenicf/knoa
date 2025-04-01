const {
  ApplicationError, // これは基底クラスとして残す場合がある
  ValidationError,
  NotFoundError, // 追加
  StorageError, // 追加
  CliError, // 追加
} = require('../lib/utils/errors'); // インポート元を統一
const { emitErrorEvent } = require('../lib/utils/error-helpers');

/**
 * CLIにおけるタスク関連の操作を管理するクラス
 */
class CliTaskManager {
  /**
   * @param {object} options - オプション
   * @param {object} options.logger - Loggerインスタンス (必須)
   * @param {object} options.eventEmitter - EventEmitterインスタンス (必須)
   * @param {object} options.integrationManagerAdapter - IntegrationManagerAdapterインスタンス (必須)
   * @param {object} options.taskManagerAdapter - TaskManagerAdapterインスタンス (必須)
   * @param {object} options.storageService - StorageServiceインスタンス (必須)
   * @param {object} options.validator - Validatorインスタンス (必須)
   * @param {object} options.errorHandler - エラーハンドラー (オプション)
   */
  constructor(options = {}) {
    // 必須依存関係のチェック
    const requiredDependencies = [
      'logger',
      'eventEmitter',
      'integrationManagerAdapter',
      'taskManagerAdapter',
      'storageService',
      'validator',
    ];
    for (const dep of requiredDependencies) {
      if (!options[dep]) {
        throw new ApplicationError(`CliTaskManager requires ${dep} instance.`);
      }
    }

    this.logger = options.logger;
    this.eventEmitter = options.eventEmitter;
    this.integrationManager = options.integrationManagerAdapter;
    this.taskManager = options.taskManagerAdapter;
    this.storageService = options.storageService;
    this.validator = options.validator; // タスク入力検証用
    this.errorHandler = options.errorHandler;

    this.logger.debug('CliTaskManager initialized');
  }

  /**
   * 新しいタスクを作成する
   * @param {string} title - タスクタイトル
   * @param {string} description - タスク説明
   * @param {object} taskOptions - その他のタスクオプション (status, priority, estimatedHours, dependencies)
   * @returns {Promise<object>} 作成されたタスク情報
   * @throws {ApplicationError|ValidationError} タスク作成に失敗した場合
   */
  async createTask(title, description, taskOptions = {}) {
    const operation = 'createTask';
    this.logger.info(`Creating new task: ${title}`, {
      operation,
      title,
      description,
      taskOptions,
    });
    await this.eventEmitter.emitStandardizedAsync(
      'cli_task',
      `${operation}_before`,
      { title, description, taskOptions }
    );

    try {
      // タスクデータの構築と検証
      const taskData = {
        title,
        description,
        status: taskOptions.status || 'pending',
        priority: taskOptions.priority || 3,
        estimated_hours: taskOptions.estimatedHours, // undefined でも可
        dependencies: [],
      };

      if (taskOptions.dependencies) {
        const deps =
          typeof taskOptions.dependencies === 'string'
            ? taskOptions.dependencies.split(',').map((d) => d.trim())
            : taskOptions.dependencies; // 配列の場合も考慮

        taskData.dependencies = deps.map((taskId) => ({
          task_id: taskId,
          type: 'strong',
        }));
      }

      const validationResult = this.validator.validateTaskInput(taskData);
      if (!validationResult.isValid) {
        throw new ValidationError('Invalid task data provided', {
          context: { errors: validationResult.errors },
        });
      }

      // integrationManagerAdapter を使用してタスクを作成
      const result = await this.integrationManager.createTask(taskData);

      if (result && result.error) {
        // CliError を使用
        throw new CliError(`Task creation failed: ${result.error}`, null, {
          code: 'ERR_TASK_CREATE', // 元のコードを維持
          context: { taskData, errorDetail: result.error },
        });
      }
      if (!result || !result.id) {
        // CliError を使用
        throw new CliError(
          'Task creation did not return expected result.',
          null,
          { code: 'ERR_TASK_CREATE_UNEXPECTED', context: { taskData, result } } // 元のコードを維持
        );
      }

      await this.eventEmitter.emitStandardizedAsync(
        'cli_task',
        `${operation}_after`,
        { result }
      );
      this.logger.info(`Task created successfully: ${result.id}`);
      return result;
    } catch (error) {
      // エラーラップロジック修正
      const cliError =
        error instanceof ValidationError || // ValidationError はそのまま
        (error instanceof CliError && // 特定の CliError もそのまま
          (error.code === 'ERR_TASK_CREATE' ||
            error.code === 'ERR_TASK_CREATE_UNEXPECTED'))
          ? error
          : new CliError(`Failed to create task "${title}"`, error, {
              // それ以外は CliError でラップ
              code: 'ERR_CLI_TASK_CREATE',
              context: { title, description, taskOptions },
            });
      emitErrorEvent(
        this.eventEmitter,
        this.logger,
        'CliTaskManager',
        operation,
        cliError,
        null,
        { title, description, taskOptions }
      );

      if (this.errorHandler) {
        return this.errorHandler.handle(cliError, 'CliTaskManager', operation, {
          title,
          description,
          taskOptions,
        });
      } else {
        throw cliError;
      }
    }
  }

  /**
   * タスクの状態と進捗を更新する (integration.js の update-task に相当)
   * @param {string} taskId - タスクID
   * @param {string} status - 新しい状態
   * @param {number|undefined} progress - 進捗率 (0-100)
   * @returns {Promise<object>} 更新されたタスク情報
   * @throws {ApplicationError|ValidationError} 更新に失敗した場合
   */
  async updateTask(taskId, status, progress) {
    const operation = 'updateTask';
    this.logger.info(`Updating task: ${taskId}`, {
      operation,
      taskId,
      status,
      progress,
    });
    await this.eventEmitter.emitStandardizedAsync(
      'cli_task',
      `${operation}_before`,
      { taskId, status, progress }
    );

    try {
      // 状態の検証 (簡易)
      const validStatuses = ['pending', 'in_progress', 'completed', 'blocked'];
      if (!validStatuses.includes(status)) {
        throw new ValidationError(`Invalid status: ${status}`, {
          context: { field: 'status' },
        });
      }
      // 進捗率の検証 (簡易)
      if (
        progress !== undefined &&
        (typeof progress !== 'number' || progress < 0 || progress > 100)
      ) {
        throw new ValidationError(
          'Progress must be a number between 0 and 100',
          { context: { field: 'progress' } }
        );
      }

      // integrationManagerAdapter を使用して更新
      const result = await this.integrationManager.updateTaskStatus(
        taskId,
        status,
        progress
      );

      if (result && result.error) {
        // CliError を使用
        throw new CliError(`Task update failed: ${result.error}`, null, {
          code: 'ERR_TASK_UPDATE', // 元のコードを維持
          context: { taskId, status, progress, errorDetail: result.error },
        });
      }
      if (!result || !result.id) {
        // CliError を使用
        throw new CliError(
          'Task update did not return expected result.',
          null,
          {
            code: 'ERR_TASK_UPDATE_UNEXPECTED', // 元のコードを維持
            context: { taskId, status, progress, result },
          }
        );
      }

      await this.eventEmitter.emitStandardizedAsync(
        'cli_task',
        `${operation}_after`,
        { taskId, status, progress, result }
      );
      this.logger.info(`Task updated successfully: ${taskId}`);
      return result;
    } catch (error) {
      // エラーラップロジック修正
      const cliError =
        error instanceof ValidationError || // ValidationError はそのまま
        (error instanceof CliError && // 特定の CliError もそのまま
          (error.code === 'ERR_TASK_UPDATE' ||
            error.code === 'ERR_TASK_UPDATE_UNEXPECTED'))
          ? error
          : new CliError(`Failed to update task ${taskId}`, error, {
              // それ以外は CliError でラップ
              code: 'ERR_CLI_TASK_UPDATE',
              context: { taskId, status, progress },
            });
      emitErrorEvent(
        this.eventEmitter,
        this.logger,
        'CliTaskManager',
        operation,
        cliError,
        null,
        { taskId, status, progress }
      );

      if (this.errorHandler) {
        return this.errorHandler.handle(cliError, 'CliTaskManager', operation, {
          taskId,
          status,
          progress,
        });
      } else {
        throw cliError;
      }
    }
  }

  /**
   * タスク一覧を取得する
   * @returns {Promise<object>} タスク一覧データ (taskManagerAdapter.getAllTasks の戻り値)
   * @throws {ApplicationError} 取得に失敗した場合
   */
  async listTasks() {
    const operation = 'listTasks';
    this.logger.info('Listing all tasks...', { operation });
    await this.eventEmitter.emitStandardizedAsync(
      'cli_task',
      `${operation}_before`
    );

    try {
      const tasks = await this.taskManager.getAllTasks();
      const taskCount = tasks?.decomposed_tasks?.length || 0;
      await this.eventEmitter.emitStandardizedAsync(
        'cli_task',
        `${operation}_after`,
        { count: taskCount }
      );
      this.logger.info(`Found ${taskCount} tasks.`);
      return tasks || { decomposed_tasks: [] }; // null や undefined の場合も考慮
    } catch (error) {
      // CliError でラップ (常に)
      const cliError = new CliError('Failed to list tasks', error, {
        code: 'ERR_CLI_TASK_LIST',
      });
      emitErrorEvent(
        this.eventEmitter,
        this.logger,
        'CliTaskManager',
        operation,
        cliError
      );
      if (this.errorHandler) {
        return (
          this.errorHandler.handle(cliError, 'CliTaskManager', operation) || {
            decomposed_tasks: [],
          }
        );
      } else {
        throw cliError;
      }
    }
  }

  /**
   * 指定されたIDのタスク情報を取得する
   * @param {string} taskId - タスクID
   * @returns {Promise<object|null>} タスク情報、または null
   * @throws {ApplicationError} 取得に失敗した場合
   */
  async getTaskInfo(taskId) {
    const operation = 'getTaskInfo';
    this.logger.info(`Getting task info for: ${taskId}`, { operation, taskId });
    await this.eventEmitter.emitStandardizedAsync(
      'cli_task',
      `${operation}_before`,
      { taskId }
    );

    try {
      const task = await this.taskManager.getTaskById(taskId);
      await this.eventEmitter.emitStandardizedAsync(
        'cli_task',
        `${operation}_after`,
        { taskId, taskFound: !!task }
      );
      if (task) {
        this.logger.info(`Task info retrieved for: ${taskId}`);
      } else {
        // logger.warn にコンテキストオブジェクトを渡すように修正
        this.logger.warn(`Task not found: ${taskId}`, { taskId });
        // NotFoundError を使用し、CLI固有コードを設定
        throw new NotFoundError(`Task not found: ${taskId}`, {
          code: 'ERR_CLI_TASK_NOT_FOUND', // CLI固有コード
          context: { taskId },
        });
      }
      return task;
    } catch (error) {
      // エラーラップロジック修正
      const cliError =
        error instanceof NotFoundError &&
        error.code === 'ERR_CLI_TASK_NOT_FOUND'
          ? error // NotFoundError はそのまま
          : new CliError(`Failed to get task info for ${taskId}`, error, {
              // それ以外は CliError でラップ
              code: 'ERR_CLI_TASK_INFO',
              context: { taskId },
            });
      emitErrorEvent(
        this.eventEmitter,
        this.logger,
        'CliTaskManager',
        operation,
        cliError,
        null,
        { taskId }
      );
      if (this.errorHandler) {
        return this.errorHandler.handle(cliError, 'CliTaskManager', operation, {
          taskId,
        });
      } else {
        throw cliError;
      }
    }
  }

  /**
   * タスクの進捗率を更新する (task.js の progress に相当)
   * @param {string} taskId - タスクID
   * @param {number} progress - 進捗率 (0-100)
   * @returns {Promise<object>} 更新されたタスク情報
   * @throws {ApplicationError|ValidationError} 更新に失敗した場合
   */
  async updateTaskProgress(taskId, progress) {
    const operation = 'updateTaskProgress';
    this.logger.info(`Updating task progress: ${taskId} to ${progress}%`, {
      operation,
      taskId,
      progress,
    });
    await this.eventEmitter.emitStandardizedAsync(
      'cli_task',
      `${operation}_before`,
      { taskId, progress }
    );

    try {
      // 進捗率の検証
      if (typeof progress !== 'number' || progress < 0 || progress > 100) {
        throw new ValidationError(
          'Progress must be a number between 0 and 100',
          { context: { field: 'progress' } }
        );
      }

      // 進捗状態を決定
      let progressState = 'not_started';
      if (progress === 100) {
        progressState = 'completed';
      } else if (progress > 0) {
        progressState = 'in_progress';
      }

      // taskManagerAdapter を使用して更新
      const result = await this.taskManager.updateTaskProgress(
        taskId,
        progress,
        progressState
      );

      if (!result || !result.id) {
        // CliError を使用
        throw new CliError(
          'Task progress update did not return expected result.',
          null,
          {
            code: 'ERR_TASK_PROGRESS_UNEXPECTED', // 元のコードを維持
            context: { taskId, progress, result },
          }
        );
      }

      await this.eventEmitter.emitStandardizedAsync(
        'cli_task',
        `${operation}_after`,
        { taskId, progress, result }
      );
      this.logger.info(`Task progress updated successfully for: ${taskId}`);
      return result;
    } catch (error) {
      // エラーラップロジック修正
      const cliError =
        error instanceof ValidationError || // ValidationError はそのまま
        (error instanceof CliError &&
          error.code === 'ERR_TASK_PROGRESS_UNEXPECTED') // 特定の CliError もそのまま
          ? error
          : new CliError( // それ以外は CliError でラップ
              `Failed to update task progress for ${taskId}`,
              error,
              {
                code: 'ERR_CLI_TASK_PROGRESS',
                context: { taskId, progress },
              }
            );
      emitErrorEvent(
        this.eventEmitter,
        this.logger,
        'CliTaskManager',
        operation,
        cliError,
        null,
        { taskId, progress }
      );
      if (this.errorHandler) {
        return this.errorHandler.handle(cliError, 'CliTaskManager', operation, {
          taskId,
          progress,
        });
      } else {
        throw cliError;
      }
    }
  }

  /**
   * タスクを削除する
   * @param {string} taskId - タスクID
   * @returns {Promise<boolean>} 削除に成功したかどうか
   * @throws {ApplicationError} 削除に失敗した場合
   */
  async deleteTask(taskId) {
    const operation = 'deleteTask';
    this.logger.info(`Deleting task: ${taskId}`, { operation, taskId });
    await this.eventEmitter.emitStandardizedAsync(
      'cli_task',
      `${operation}_before`,
      { taskId }
    );

    try {
      const result = await this.taskManager.deleteTask(taskId);
      await this.eventEmitter.emitStandardizedAsync(
        'cli_task',
        `${operation}_after`,
        { taskId, success: result }
      );
      if (result) {
        this.logger.info(`Task deleted successfully: ${taskId}`);
      } else {
        this.logger.warn(`Failed to delete task or task not found: ${taskId}`);
        // deleteTask が false を返す場合、エラーとするか警告に留めるか検討
        // CliError を使用し、CLI固有コードを設定
        throw new CliError(`Failed to delete task ${taskId}`, null, {
          code: 'ERR_CLI_TASK_DELETE_FAILED',
          context: { taskId },
        });
      }
      return result;
    } catch (error) {
      // エラーラップロジック修正
      const cliError =
        error instanceof CliError && error.code === 'ERR_CLI_TASK_DELETE_FAILED'
          ? error // 特定の CliError はそのまま
          : new CliError(`Failed to delete task ${taskId}`, error, {
              // それ以外は CliError でラップ
              code: 'ERR_CLI_TASK_DELETE',
              context: { taskId },
            });
      emitErrorEvent(
        this.eventEmitter,
        this.logger,
        'CliTaskManager',
        operation,
        cliError,
        null,
        { taskId }
      );
      if (this.errorHandler) {
        return (
          this.errorHandler.handle(cliError, 'CliTaskManager', operation, {
            taskId,
          }) || false
        ); // エラー時は false を返すなど
      } else {
        throw cliError;
      }
    }
  }

  /**
   * タスクにGitコミットを関連付ける
   * @param {string} taskId - タスクID
   * @param {string} commitHash - コミットハッシュ
   * @returns {Promise<object>} 更新されたタスク情報
   * @throws {ApplicationError} 関連付けに失敗した場合
   */
  async linkTaskToCommit(taskId, commitHash) {
    const operation = 'linkTaskToCommit';
    this.logger.info(`Linking commit ${commitHash} to task ${taskId}`, {
      operation,
      taskId,
      commitHash,
    });
    await this.eventEmitter.emitStandardizedAsync(
      'cli_task',
      `${operation}_before`,
      { taskId, commitHash }
    );

    try {
      const task = await this.taskManager.addGitCommitToTask(
        taskId,
        commitHash
      );
      if (!task || !task.id) {
        // CliError を使用
        throw new CliError(
          'Linking commit to task did not return expected result.',
          null,
          {
            code: 'ERR_CLI_TASK_LINK_COMMIT_UNEXPECTED', // 元のコードを維持
            context: { taskId, commitHash, result: task },
          }
        );
      }
      await this.eventEmitter.emitStandardizedAsync(
        'cli_task',
        `${operation}_after`,
        { taskId, commitHash, task }
      );
      this.logger.info(
        `Commit ${commitHash} linked to task ${taskId} successfully.`
      );
      return task;
    } catch (error) {
      // エラーラップロジック修正
      const cliError =
        error instanceof CliError &&
        error.code === 'ERR_CLI_TASK_LINK_COMMIT_UNEXPECTED'
          ? error // 特定の CliError はそのまま
          : new CliError( // それ以外は CliError でラップ
              `Failed to link commit ${commitHash} to task ${taskId}`,
              error,
              {
                code: 'ERR_CLI_TASK_LINK_COMMIT',
                context: { taskId, commitHash },
              }
            );
      emitErrorEvent(
        this.eventEmitter,
        this.logger,
        'CliTaskManager',
        operation,
        cliError,
        null,
        { taskId, commitHash }
      );
      if (this.errorHandler) {
        return this.errorHandler.handle(cliError, 'CliTaskManager', operation, {
          taskId,
          commitHash,
        });
      } else {
        throw cliError;
      }
    }
  }

  /**
   * タスク情報をファイルにエクスポートする
   * @param {string} taskId - タスクID
   * @param {string|null} outputPath - 出力ファイルパス (nullの場合はデフォルトパス)
   * @returns {Promise<string>} エクスポートされたファイルパス
   * @throws {ApplicationError} エクスポートに失敗した場合
   */
  async exportTask(taskId, outputPath = null) {
    const operation = 'exportTask';
    this.logger.info(`Exporting task: ${taskId}`, {
      operation,
      taskId,
      outputPath,
    });
    await this.eventEmitter.emitStandardizedAsync(
      'cli_task',
      `${operation}_before`,
      { taskId, outputPath }
    );

    try {
      const task = await this.taskManager.getTaskById(taskId);
      if (!task) {
        // NotFoundError を使用し、CLI固有コードを設定
        throw new NotFoundError(`Task not found: ${taskId}`, {
          code: 'ERR_CLI_TASK_NOT_FOUND', // CLI固有コード
          context: { taskId },
        });
      }

      const finalPath = outputPath || `task-${taskId}-export.json`;
      const writeSuccess = await this.storageService.writeJSON(
        '.',
        finalPath,
        task
      );

      if (!writeSuccess) {
        // StorageError を使用 (コンストラクタ呼び出し修正)
        throw new StorageError(
          `Failed to write task export file: ${finalPath}`,
          {
            // options オブジェクト
            code: 'ERR_CLI_FILE_WRITE', // CLI固有コードを維持
            context: { taskId, path: finalPath },
          }
        );
      }

      await this.eventEmitter.emitStandardizedAsync(
        'cli_task',
        `${operation}_after`,
        { taskId, path: finalPath }
      );
      this.logger.info(`Task exported successfully to: ${finalPath}`);
      return finalPath;
    } catch (error) {
      // エラーラップロジック修正
      const cliError =
        (error instanceof NotFoundError &&
          error.code === 'ERR_CLI_TASK_NOT_FOUND') ||
        (error instanceof StorageError && error.code === 'ERR_CLI_FILE_WRITE')
          ? error // 特定のエラーはそのまま
          : new CliError(`Failed to export task ${taskId}`, error, {
              // それ以外は CliError でラップ
              code: 'ERR_CLI_TASK_EXPORT',
              context: { taskId, outputPath },
            });
      emitErrorEvent(
        this.eventEmitter,
        this.logger,
        'CliTaskManager',
        operation,
        cliError,
        null,
        { taskId, outputPath }
      );
      if (this.errorHandler) {
        return this.errorHandler.handle(cliError, 'CliTaskManager', operation, {
          taskId,
          outputPath,
        });
      } else {
        throw cliError;
      }
    }
  }

  /**
   * ファイルからタスク情報をインポートする
   * @param {string} inputPath - 入力ファイルパス
   * @returns {Promise<object>} インポートされたタスク情報
   * @throws {ApplicationError} インポートに失敗した場合
   */
  async importTask(inputPath) {
    const operation = 'importTask';
    this.logger.info(`Importing task from: ${inputPath}`, {
      operation,
      inputPath,
    });
    await this.eventEmitter.emitStandardizedAsync(
      'cli_task',
      `${operation}_before`,
      { inputPath }
    );

    try {
      const taskData = await this.storageService.readJSON('.', inputPath);
      if (taskData === null) {
        // StorageError を使用 (コンストラクタ呼び出し修正)
        throw new StorageError(
          `Failed to read or parse task import file: ${inputPath}`,
          {
            // options オブジェクト
            code: 'ERR_CLI_FILE_READ', // CLI固有コードを維持
            context: { path: inputPath },
          }
        );
      }

      // TODO: インポート前に taskData のバリデーションを行うべきか検討
      // const validationResult = this.validator.validateTaskInput(taskData);
      // if (!validationResult.isValid) { ... }

      const task = await this.taskManager.importTask(taskData);

      if (!task || !task.id) {
        // CliError を使用
        throw new CliError(
          'Task import did not return expected result.',
          null,
          {
            code: 'ERR_CLI_TASK_IMPORT_UNEXPECTED', // 元のコードを維持
            context: { inputPath, result: task },
          }
        );
      }

      await this.eventEmitter.emitStandardizedAsync(
        'cli_task',
        `${operation}_after`,
        { inputPath, taskId: task.id }
      );
      this.logger.info(`Task imported successfully: ${task.id}`);
      return task;
    } catch (error) {
      // エラーラップロジック修正
      const cliError =
        (error instanceof StorageError && error.code === 'ERR_CLI_FILE_READ') ||
        (error instanceof CliError &&
          error.code === 'ERR_CLI_TASK_IMPORT_UNEXPECTED')
          ? error // 特定のエラーはそのまま
          : new CliError(`Failed to import task from ${inputPath}`, error, {
              // それ以外は CliError でラップ
              code: 'ERR_CLI_TASK_IMPORT',
              context: { inputPath },
            });
      emitErrorEvent(
        this.eventEmitter,
        this.logger,
        'CliTaskManager',
        operation,
        cliError,
        null,
        { inputPath }
      );
      if (this.errorHandler) {
        return this.errorHandler.handle(cliError, 'CliTaskManager', operation, {
          inputPath,
        });
      } else {
        throw cliError;
      }
    }
  }
}

module.exports = CliTaskManager;

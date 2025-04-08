const {
  ApplicationError,
  ValidationError,
  NotFoundError,
  StorageError,
  CliError,
} = require('../lib/utils/errors');
const { emitErrorEvent } = require('../lib/utils/error-helpers');
// ID生成関数をインポート (EventEmitter から取得するため不要)
// const { generateTraceId, generateRequestId } = require('../lib/utils/id-generators');

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
   * @param {object} [options.errorHandler] - エラーハンドラー (オプション)
   * @param {Function} options.traceIdGenerator - トレースID生成関数 (必須)
   * @param {Function} options.requestIdGenerator - リクエストID生成関数 (必須)
   */
  constructor(options = {}) {
    // 分割代入で依存関係を取得
    const {
      logger,
      eventEmitter,
      integrationManagerAdapter,
      taskManagerAdapter,
      storageService,
      validator,
      errorHandler, // 任意
      traceIdGenerator,
      requestIdGenerator,
    } = options;

    // 必須依存関係のチェック
    if (!logger)
      throw new ApplicationError('CliTaskManager requires logger instance.');
    if (!eventEmitter)
      throw new ApplicationError(
        'CliTaskManager requires eventEmitter instance.'
      );
    if (!integrationManagerAdapter)
      throw new ApplicationError(
        'CliTaskManager requires integrationManagerAdapter instance.'
      );
    if (!taskManagerAdapter)
      throw new ApplicationError(
        'CliTaskManager requires taskManagerAdapter instance.'
      );
    if (!storageService)
      throw new ApplicationError(
        'CliTaskManager requires storageService instance.'
      );
    if (!validator)
      throw new ApplicationError('CliTaskManager requires validator instance.');
    if (!traceIdGenerator)
      throw new ApplicationError(
        'CliTaskManager requires traceIdGenerator function.'
      );
    if (!requestIdGenerator)
      throw new ApplicationError(
        'CliTaskManager requires requestIdGenerator function.'
      );

    this.logger = logger;
    this.eventEmitter = eventEmitter;
    this.integrationManager = integrationManagerAdapter;
    this.taskManager = taskManagerAdapter;
    this.storageService = storageService;
    this.validator = validator;
    this.errorHandler = errorHandler; // 任意なのでチェック不要
    this._traceIdGenerator = traceIdGenerator;
    this._requestIdGenerator = requestIdGenerator;

    this.logger.debug('CliTaskManager initialized');
  }

  /**
   * 標準化されたイベントを発行する内部ヘルパー
   * @param {string} action - アクション名 (例: 'create_before')
   * @param {object} [data={}] - イベントデータ
   * @param {string} [traceId] - トレースID (指定されなければ生成)
   * @param {string} [requestId] - リクエストID (指定されなければ生成)
   * @returns {Promise<void>}
   * @private
   */
  async _emitEvent(action, data = {}, traceId, requestId) {
    if (
      !this.eventEmitter ||
      typeof this.eventEmitter.emitStandardizedAsync !== 'function'
    ) {
      this.logger.warn(
        `Cannot emit event task_${action}: eventEmitter or emitStandardizedAsync is missing.`
      );
      return;
    }
    const finalTraceId = traceId || this._traceIdGenerator();
    const finalRequestId = requestId || this._requestIdGenerator();
    const eventData = {
      ...data,
      traceId: finalTraceId,
      requestId: finalRequestId,
    };
    try {
      // コンポーネント名を 'cli'、アクション名を 'task_action' 形式に統一
      await this.eventEmitter.emitStandardizedAsync(
        'cli',
        `task_${action}`,
        eventData
      );
    } catch (error) {
      this.logger.warn(`イベント発行中にエラー: cli:task_${action}`, { error });
    }
  }

  /**
   * エラー処理を行う内部ヘルパー
   * @param {Error} error - 発生したエラー
   * @param {string} operation - 操作名
   * @param {object} [context={}] - エラーコンテキスト
   * @returns {*} エラーハンドラーの戻り値、またはエラーを再スロー
   * @throws {CliError|ApplicationError|NotFoundError|StorageError|ValidationError} エラーハンドラーがない場合、またはエラーハンドラーがエラーをスローした場合
   * @private
   */
  _handleError(error, operation, context = {}) {
    // 特定のエラーコードや型はそのまま使う
    const knownErrorCodes = [
      'ERR_TASK_CREATE',
      'ERR_TASK_CREATE_UNEXPECTED',
      'ERR_TASK_UPDATE',
      'ERR_TASK_UPDATE_UNEXPECTED',
      // 'ERR_CLI_TASK_NOT_FOUND', // isKnownError でチェック
      'ERR_TASK_PROGRESS_UNEXPECTED',
      'ERR_CLI_TASK_DELETE_FAILED',
      'ERR_CLI_TASK_LINK_COMMIT_UNEXPECTED',
      // 'ERR_CLI_FILE_WRITE', // isKnownError でチェック
      // 'ERR_CLI_FILE_READ', // isKnownError でチェック
      'ERR_CLI_TASK_IMPORT_UNEXPECTED',
    ];
    const isKnownCliError =
      error instanceof CliError && knownErrorCodes.includes(error.code);
    const isKnownError =
      error instanceof NotFoundError ||
      error instanceof StorageError ||
      error instanceof ValidationError ||
      isKnownCliError;

    const processedError = isKnownError
      ? error
      : new CliError(`Failed during ${operation}`, error, {
          // エラーコード生成ルールを統一 (コンポーネント名を含む)
          code: `ERR_CLI_TASKMANAGER_${operation.toUpperCase()}`,
          ...context,
        });

    emitErrorEvent(
      this.eventEmitter,
      this.logger,
      'CliTaskManager',
      operation,
      processedError,
      null,
      context
    );

    if (this.errorHandler) {
      return this.errorHandler.handle(
        processedError,
        'CliTaskManager',
        operation,
        context
      );
    } else {
      throw processedError;
    }
  }

  /**
   * 新しいタスクを作成する
   * @param {string} title - タスクタイトル
   * @param {string} description - タスク説明
   * @param {object} [taskOptions={}] - その他のタスクオプション (status, priority, estimatedHours, dependencies)
   * @returns {Promise<object>} 作成されたタスク情報
   * @throws {CliError|ValidationError} タスク作成に失敗した場合
   */
  async createTask(title, description, taskOptions = {}) {
    const operation = 'createTask';
    const traceId = this._traceIdGenerator();
    const requestId = this._requestIdGenerator();
    const context = { title, description, taskOptions, traceId, requestId };
    await this._emitEvent(
      'create_before',
      { title, description, taskOptions },
      traceId,
      requestId
    );
    this.logger.info(`Creating new task: ${title}`, context);

    try {
      const taskData = {
        title,
        description,
        status: taskOptions.status || 'pending',
        priority: taskOptions.priority || 3,
        estimated_hours: taskOptions.estimatedHours,
        dependencies: [],
      };

      if (taskOptions.dependencies) {
        const deps =
          typeof taskOptions.dependencies === 'string'
            ? taskOptions.dependencies.split(',').map((d) => d.trim())
            : taskOptions.dependencies;
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

      const result = await this.integrationManager.createTask(taskData);

      if (result && result.error) {
        throw new CliError(`Task creation failed: ${result.error}`, null, {
          code: 'ERR_TASK_CREATE',
          context: { taskData, errorDetail: result.error },
        });
      }
      if (!result || !result.id) {
        throw new CliError(
          'Task creation did not return expected result.',
          null,
          {
            code: 'ERR_TASK_CREATE_UNEXPECTED',
            context: { taskData, result },
          }
        );
      }

      await this._emitEvent('create_after', { result }, traceId, requestId);
      this.logger.info(`Task created successfully: ${result.id}`, {
        traceId,
        requestId,
      });
      return result;
    } catch (error) {
      return this._handleError(error, operation, context);
    }
  }

  /**
   * タスクの状態と進捗を更新する
   * @param {string} taskId - タスクID
   * @param {string} status - 新しい状態
   * @param {number|undefined} progress - 進捗率 (0-100)
   * @returns {Promise<object>} 更新されたタスク情報
   * @throws {CliError|ValidationError} 更新に失敗した場合
   */
  async updateTask(taskId, status, progress) {
    const operation = 'updateTask';
    const traceId = this._traceIdGenerator();
    const requestId = this._requestIdGenerator();
    const context = { taskId, status, progress, traceId, requestId };
    await this._emitEvent(
      'update_before',
      { taskId, status, progress },
      traceId,
      requestId
    );
    this.logger.info(`Updating task: ${taskId}`, context);

    try {
      const validStatuses = ['pending', 'in_progress', 'completed', 'blocked'];
      if (!validStatuses.includes(status)) {
        throw new ValidationError(`Invalid status: ${status}`, {
          context: { field: 'status' },
        });
      }
      if (
        progress !== undefined &&
        (typeof progress !== 'number' || progress < 0 || progress > 100)
      ) {
        throw new ValidationError(
          'Progress must be a number between 0 and 100',
          { context: { field: 'progress' } }
        );
      }

      const result = await this.integrationManager.updateTaskStatus(
        taskId,
        status,
        progress
      );

      if (result && result.error) {
        throw new CliError(`Task update failed: ${result.error}`, null, {
          code: 'ERR_TASK_UPDATE',
          context: { taskId, status, progress, errorDetail: result.error },
        });
      }
      if (!result || !result.id) {
        throw new CliError(
          'Task update did not return expected result.',
          null,
          {
            code: 'ERR_TASK_UPDATE_UNEXPECTED',
            context: { taskId, status, progress, result },
          }
        );
      }

      await this._emitEvent(
        'update_after',
        { taskId, status, progress, result },
        traceId,
        requestId
      );
      this.logger.info(`Task updated successfully: ${taskId}`, {
        traceId,
        requestId,
      });
      return result;
    } catch (error) {
      return this._handleError(error, operation, context);
    }
  }

  /**
   * タスク一覧を取得する
   * @returns {Promise<object>} タスク一覧データ
   * @throws {CliError} 取得に失敗した場合
   */
  async listTasks() {
    const operation = 'listTasks';
    const traceId = this._traceIdGenerator();
    const requestId = this._requestIdGenerator();
    const context = { traceId, requestId };
    await this._emitEvent('list_before', {}, traceId, requestId);
    this.logger.info('Listing all tasks...', { ...context, operation });

    try {
      const tasks = await this.taskManager.getAllTasks();
      const count = tasks?.decomposed_tasks?.length || 0;
      await this._emitEvent('list_after', { count }, traceId, requestId);
      this.logger.info(`Found ${count} tasks.`, { traceId, requestId });
      return tasks || { decomposed_tasks: [] };
    } catch (error) {
      const handledResult = this._handleError(error, operation, context);
      return handledResult === undefined
        ? { decomposed_tasks: [] }
        : handledResult;
    }
  }

  /**
   * 指定されたIDのタスク情報を取得する
   * @param {string} taskId - タスクID
   * @returns {Promise<object>} タスク情報
   * @throws {CliError|NotFoundError} 取得に失敗した場合、またはタスクが見つからない場合
   */
  async getTaskInfo(taskId) {
    const operation = 'getTaskInfo';
    const traceId = this._traceIdGenerator();
    const requestId = this._requestIdGenerator();
    const context = { taskId, traceId, requestId };
    await this._emitEvent('info_get_before', { taskId }, traceId, requestId);
    this.logger.info(`Getting task info for: ${taskId}`, context);

    try {
      const task = await this.taskManager.getTaskById(taskId);
      if (!task) {
        throw new NotFoundError(`Task not found: ${taskId}`, {
          code: 'ERR_CLI_TASK_NOT_FOUND',
          context: { taskId },
        });
      }
      await this._emitEvent(
        'info_get_after',
        { taskId, taskFound: true },
        traceId,
        requestId
      );
      this.logger.info(`Task info retrieved for: ${taskId}`, {
        traceId,
        requestId,
      });
      return task;
    } catch (error) {
      return this._handleError(error, operation, context);
    }
  }

  /**
   * タスクの進捗率を更新する
   * @param {string} taskId - タスクID
   * @param {number} progress - 進捗率 (0-100)
   * @returns {Promise<object>} 更新されたタスク情報
   * @throws {CliError|ValidationError} 更新に失敗した場合
   */
  async updateTaskProgress(taskId, progress) {
    const operation = 'updateTaskProgress';
    const traceId = this._traceIdGenerator();
    const requestId = this._requestIdGenerator();
    const context = { taskId, progress, traceId, requestId };
    await this._emitEvent(
      'progress_update_before',
      { taskId, progress },
      traceId,
      requestId
    );
    this.logger.info(
      `Updating task progress: ${taskId} to ${progress}%`,
      context
    );

    try {
      if (typeof progress !== 'number' || progress < 0 || progress > 100) {
        throw new ValidationError(
          'Progress must be a number between 0 and 100',
          { context: { field: 'progress' } }
        );
      }

      let progressState = 'not_started';
      if (progress === 100) progressState = 'completed';
      else if (progress > 0) progressState = 'in_progress';

      const result = await this.taskManager.updateTaskProgress(
        taskId,
        progress,
        progressState
      );

      if (!result || !result.id) {
        throw new CliError(
          'Task progress update did not return expected result.',
          null,
          {
            code: 'ERR_TASK_PROGRESS_UNEXPECTED',
            context: { taskId, progress, result },
          }
        );
      }

      await this._emitEvent(
        'progress_update_after',
        { taskId, progress, result },
        traceId,
        requestId
      );
      this.logger.info(`Task progress updated successfully for: ${taskId}`, {
        traceId,
        requestId,
      });
      return result;
    } catch (error) {
      return this._handleError(error, operation, context);
    }
  }

  /**
   * タスクを削除する
   * @param {string} taskId - タスクID
   * @returns {Promise<boolean>} 削除に成功したかどうか
   * @throws {CliError} 削除に失敗した場合
   */
  async deleteTask(taskId) {
    const operation = 'deleteTask';
    const traceId = this._traceIdGenerator();
    const requestId = this._requestIdGenerator();
    const context = { taskId, traceId, requestId };
    await this._emitEvent('delete_before', { taskId }, traceId, requestId);
    this.logger.info(`Deleting task: ${taskId}`, context);

    try {
      const result = await this.taskManager.deleteTask(taskId);
      if (!result) {
        // deleteTask が false を返す場合はエラーとして扱う
        throw new CliError(`Failed to delete task ${taskId}`, null, {
          code: 'ERR_CLI_TASK_DELETE_FAILED',
          context: { taskId },
        });
      }
      await this._emitEvent(
        'delete_after',
        { taskId, success: result },
        traceId,
        requestId
      );
      this.logger.info(`Task deleted successfully: ${taskId}`, {
        traceId,
        requestId,
      });
      return result;
    } catch (error) {
      const handledResult = this._handleError(error, operation, context);
      return handledResult === undefined ? false : handledResult;
    }
  }

  /**
   * タスクにGitコミットを関連付ける
   * @param {string} taskId - タスクID
   * @param {string} commitHash - コミットハッシュ
   * @returns {Promise<object>} 更新されたタスク情報
   * @throws {CliError|NotFoundError} 関連付けに失敗した場合
   */
  async linkTaskToCommit(taskId, commitHash) {
    const operation = 'linkTaskToCommit';
    const traceId = this._traceIdGenerator();
    const requestId = this._requestIdGenerator();
    const context = { taskId, commitHash, traceId, requestId };
    await this._emitEvent(
      'link_commit_before',
      { taskId, commitHash },
      traceId,
      requestId
    );
    this.logger.info(`Linking commit ${commitHash} to task ${taskId}`, context);

    try {
      // getTaskById で存在確認を行う方がより安全かもしれないが、現状は adapter に任せる
      const task = await this.taskManager.addGitCommitToTask(
        taskId,
        commitHash
      );
      if (!task || !task.id) {
        // addGitCommitToTask が null や期待しない値を返す場合のエラー
        throw new CliError(
          'Linking commit to task did not return expected result.',
          null,
          {
            code: 'ERR_CLI_TASK_LINK_COMMIT_UNEXPECTED',
            context: { taskId, commitHash, result: task },
          }
        );
      }
      await this._emitEvent(
        'link_commit_after',
        { taskId, commitHash, task },
        traceId,
        requestId
      );
      this.logger.info(
        `Commit ${commitHash} linked to task ${taskId} successfully.`,
        { traceId, requestId }
      );
      return task;
    } catch (error) {
      // addGitCommitToTask が NotFoundError をスローする可能性も考慮
      return this._handleError(error, operation, context);
    }
  }

  /**
   * タスク情報をファイルにエクスポートする
   * @param {string} taskId - タスクID
   * @param {string|null} [outputPath=null] - 出力ファイルパス (nullの場合はデフォルトパス)
   * @returns {Promise<string>} エクスポートされたファイルパス
   * @throws {CliError|NotFoundError|StorageError} エクスポートに失敗した場合
   */
  async exportTask(taskId, outputPath = null) {
    const operation = 'exportTask';
    const traceId = this._traceIdGenerator();
    const requestId = this._requestIdGenerator();
    const context = { taskId, outputPath, traceId, requestId };
    await this._emitEvent(
      'export_before',
      { taskId, outputPath },
      traceId,
      requestId
    );
    this.logger.info(`Exporting task: ${taskId}`, context);

    try {
      const task = await this.taskManager.getTaskById(taskId);
      if (!task) {
        throw new NotFoundError(`Task not found: ${taskId}`, {
          code: 'ERR_CLI_TASK_NOT_FOUND',
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
        throw new StorageError(
          `Failed to write task export file: ${finalPath}`,
          {
            code: 'ERR_CLI_FILE_WRITE',
            context: { taskId, path: finalPath },
          }
        );
      }

      await this._emitEvent(
        'export_after',
        { taskId, path: finalPath },
        traceId,
        requestId
      );
      this.logger.info(`Task exported successfully to: ${finalPath}`, {
        traceId,
        requestId,
      });
      return finalPath;
    } catch (error) {
      return this._handleError(error, operation, context);
    }
  }

  /**
   * ファイルからタスク情報をインポートする
   * @param {string} inputPath - 入力ファイルパス
   * @returns {Promise<object>} インポートされたタスク情報
   * @throws {CliError|StorageError|ValidationError} インポートに失敗した場合
   */
  async importTask(inputPath) {
    const operation = 'importTask';
    const traceId = this._traceIdGenerator();
    const requestId = this._requestIdGenerator();
    const context = { inputPath, traceId, requestId };
    await this._emitEvent('import_before', { inputPath }, traceId, requestId);
    this.logger.info(`Importing task from: ${inputPath}`, context);

    try {
      const taskData = await this.storageService.readJSON('.', inputPath);
      if (taskData === null) {
        throw new StorageError(
          `Failed to read or parse task import file: ${inputPath}`,
          {
            code: 'ERR_CLI_FILE_READ',
            context: { path: inputPath },
          }
        );
      }

      // インポートデータのバリデーション
      const validationResult = this.validator.validateTaskInput(taskData);
      if (!validationResult.isValid) {
        throw new ValidationError('Invalid task data in import file', {
          context: { errors: validationResult.errors, path: inputPath },
        });
      }

      const task = await this.taskManager.importTask(taskData);

      if (!task || !task.id) {
        throw new CliError(
          'Task import did not return expected result.',
          null,
          {
            code: 'ERR_CLI_TASK_IMPORT_UNEXPECTED',
            context: { inputPath, result: task },
          }
        );
      }

      await this._emitEvent(
        'import_after',
        { inputPath, taskId: task.id },
        traceId,
        requestId
      );
      this.logger.info(`Task imported successfully: ${task.id}`, {
        traceId,
        requestId,
      });
      return task;
    } catch (error) {
      return this._handleError(error, operation, context);
    }
  }
}

module.exports = CliTaskManager;

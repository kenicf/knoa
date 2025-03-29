/**
 * タスク管理アダプター
 *
 * タスク管理コンポーネントをラップし、統合マネージャーとのインターフェースを提供します。
 */

const { ValidationError } = require('../../lib/utils/errors');
const BaseAdapter = require('./base-adapter');

/**
 * タスク管理アダプター
 */
class TaskManagerAdapter extends BaseAdapter {
  /**
   * コンストラクタ
   * @param {Object} taskManager - タスク管理インスタンス
   * @param {Object} options - 追加オプション
   * @param {Object} options.logger - ロガー
   * @param {Object} options.errorHandler - エラーハンドラー
   */
  constructor(taskManager, options = {}) {
    super(taskManager, options);
  }

  /**
   * タスクを検証
   * @param {Object} task - 検証するタスク
   * @returns {Object} 検証結果
   */
  validateTask(task) {
    try {
      this._validateParams({ task }, ['task']);

      return this.manager.validateTask(task);
    } catch (error) {
      return this._handleError(error, 'validateTask', { task });
    }
  }

  /**
   * すべてのタスクを取得
   * @returns {Promise<Object>} タスクコレクション
   */
  async getAllTasks() {
    try {
      return await this.manager.getAllTasks();
    } catch (error) {
      return this._handleError(error, 'getAllTasks');
    }
  }

  /**
   * IDでタスクを取得
   * @param {string} taskId - タスクID
   * @returns {Promise<Object|null>} タスク、存在しない場合はnull
   */
  async getTaskById(taskId) {
    try {
      this._validateParams({ taskId }, ['taskId']);

      if (!taskId.match(/^T[0-9]{3}$/)) {
        throw new ValidationError('タスクIDはT000形式である必要があります');
      }

      return await this.manager.getTaskById(taskId);
    } catch (error) {
      return this._handleError(error, 'getTaskById', { taskId });
    }
  }

  /**
   * タスクを作成
   * @param {Object} taskData - タスク入力データ
   * @param {OperationContext} context - 操作コンテキスト（オプション）
   * @returns {Promise<Object>} 作成されたタスク
   */
  async createTask(taskData, context = null) {
    try {
      // コンテキストがない場合は作成
      const operationContext =
        context || this._createContext('createTask', { taskData });

      this._validateParams({ taskData }, ['taskData']);

      if (!taskData.title) {
        throw new ValidationError('タスクにはタイトルが必要です');
      }

      const task = await this.manager.createTask(taskData);

      // イベント発行
      this._emitEvent(
        'task',
        'task_created',
        {
          id: task.id,
          title: task.title,
          status: task.status,
          description: task.description,
        },
        operationContext
      );

      return task;
    } catch (error) {
      return this._handleError(error, 'createTask', context, { taskData });
    }
  }

  /**
   * タスクを更新
   * @param {Object} task - 更新するタスク
   * @param {OperationContext} context - 操作コンテキスト（オプション）
   * @returns {Promise<Object>} 更新されたタスク
   */
  async updateTask(task, context = null) {
    try {
      // コンテキストがない場合は作成
      const operationContext =
        context || this._createContext('updateTask', { taskId: task.id });

      this._validateParams({ task }, ['task']);

      if (!task.id) {
        throw new ValidationError('タスクにはIDが必要です');
      }

      const updatedTask = await this.manager.updateTask(task);

      // イベント発行
      this._emitEvent(
        'task',
        'task_updated',
        {
          id: updatedTask.id,
          updates: task, // 更新内容
          current: updatedTask, // 更新後の値
        },
        operationContext
      );

      return updatedTask;
    } catch (error) {
      return this._handleError(error, 'updateTask', context, { task });
    }
  }

  /**
   * タスク進捗を更新
   * @param {string} taskId - タスクID
   * @param {number} progress - 進捗率
   * @param {string} state - 進捗状態
   * @param {Object} [tasks] - 既存のタスクコレクション（最適化用）
   * @param {OperationContext} context - 操作コンテキスト（オプション）
   * @returns {Promise<Object>} 更新結果
   */
  async updateTaskProgress(taskId, progress, state, tasks, context = null) {
    try {
      // コンテキストがない場合は作成
      const operationContext =
        context ||
        this._createContext('updateTaskProgress', {
          taskId,
          progress,
          state,
        });

      this._validateParams({ taskId, progress, state }, [
        'taskId',
        'progress',
        'state',
      ]);

      if (!taskId.match(/^T[0-9]{3}$/)) {
        throw new ValidationError('タスクIDはT000形式である必要があります');
      }

      if (typeof progress !== 'number' || progress < 0 || progress > 100) {
        throw new ValidationError(
          '進捗率は0から100の間の数値である必要があります'
        );
      }

      const result = await this.manager.updateTaskProgress(
        taskId,
        progress,
        state,
        tasks
      );

      // イベント発行
      this._emitEvent(
        'task',
        'task_progress_updated',
        {
          id: taskId,
          progress,
          state,
          previousProgress: result.previousProgress,
          previousState: result.previousState,
        },
        operationContext
      );

      return result;
    } catch (error) {
      return this._handleError(error, 'updateTaskProgress', context, {
        taskId,
        progress,
        state,
      });
    }
  }

  /**
   * タスクにGitコミットを関連付け
   * @param {string} taskId - タスクID
   * @param {string} commitHash - コミットハッシュ
   * @param {OperationContext} context - 操作コンテキスト（オプション）
   * @returns {Promise<Object>} 更新されたタスク
   */
  async addGitCommitToTask(taskId, commitHash, context = null) {
    try {
      // コンテキストがない場合は作成
      const operationContext =
        context ||
        this._createContext('addGitCommitToTask', {
          taskId,
          commitHash,
        });

      this._validateParams({ taskId, commitHash }, ['taskId', 'commitHash']);

      if (!taskId.match(/^T[0-9]{3}$/)) {
        throw new ValidationError('タスクIDはT000形式である必要があります');
      }

      const task = await this.manager.addGitCommitToTask(taskId, commitHash);

      // イベント発行
      this._emitEvent(
        'task',
        'git_commit_added',
        {
          taskId,
          commitHash,
          timestamp: new Date().toISOString(),
        },
        operationContext
      );

      return task;
    } catch (error) {
      return this._handleError(error, 'addGitCommitToTask', context, {
        taskId,
        commitHash,
      });
    }
  }

  /**
   * タスクを初期化
   * @param {Object} projectInfo - プロジェクト情報
   * @param {OperationContext} context - 操作コンテキスト（オプション）
   * @returns {Promise<Object>} 初期化されたタスクコレクション
   */
  async initializeTasks(projectInfo, context = null) {
    try {
      // コンテキストがない場合は作成
      const operationContext =
        context ||
        this._createContext('initializeTasks', {
          projectId: projectInfo.id,
        });

      this._validateParams({ projectInfo }, ['projectInfo']);

      const tasks = await this.manager.initializeTasks(projectInfo);

      // イベント発行
      this._emitEvent(
        'task',
        'tasks_initialized',
        {
          projectId: projectInfo.id,
          taskCount: tasks.tasks ? tasks.tasks.length : 0,
          timestamp: new Date().toISOString(),
        },
        operationContext
      );

      return tasks;
    } catch (error) {
      return this._handleError(error, 'initializeTasks', context, {
        projectInfo,
      });
    }
  }
}

module.exports = TaskManagerAdapter;

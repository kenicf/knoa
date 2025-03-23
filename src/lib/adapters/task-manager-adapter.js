/**
 * タスク管理アダプター
 * 
 * タスク管理コンポーネントをラップし、統合マネージャーとのインターフェースを提供します。
 */

const { ValidationError } = require('../../utils/errors');
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
   * @returns {Promise<Object>} 作成されたタスク
   */
  async createTask(taskData) {
    try {
      this._validateParams({ taskData }, ['taskData']);
      
      if (!taskData.title) {
        throw new ValidationError('タスクにはタイトルが必要です');
      }
      
      return await this.manager.createTask(taskData);
    } catch (error) {
      return this._handleError(error, 'createTask', { taskData });
    }
  }
  
  /**
   * タスクを更新
   * @param {Object} task - 更新するタスク
   * @returns {Promise<Object>} 更新されたタスク
   */
  async updateTask(task) {
    try {
      this._validateParams({ task }, ['task']);
      
      if (!task.id) {
        throw new ValidationError('タスクにはIDが必要です');
      }
      
      return await this.manager.updateTask(task);
    } catch (error) {
      return this._handleError(error, 'updateTask', { task });
    }
  }
  
  /**
   * タスク進捗を更新
   * @param {string} taskId - タスクID
   * @param {number} progress - 進捗率
   * @param {string} state - 進捗状態
   * @param {Object} [tasks] - 既存のタスクコレクション（最適化用）
   * @returns {Promise<Object>} 更新結果
   */
  async updateTaskProgress(taskId, progress, state, tasks) {
    try {
      this._validateParams({ taskId, progress, state }, ['taskId', 'progress', 'state']);
      
      if (!taskId.match(/^T[0-9]{3}$/)) {
        throw new ValidationError('タスクIDはT000形式である必要があります');
      }
      
      if (typeof progress !== 'number' || progress < 0 || progress > 100) {
        throw new ValidationError('進捗率は0から100の間の数値である必要があります');
      }
      
      return await this.manager.updateTaskProgress(taskId, progress, state, tasks);
    } catch (error) {
      return this._handleError(error, 'updateTaskProgress', { taskId, progress, state });
    }
  }
  
  /**
   * タスクにGitコミットを関連付け
   * @param {string} taskId - タスクID
   * @param {string} commitHash - コミットハッシュ
   * @returns {Promise<Object>} 更新されたタスク
   */
  async addGitCommitToTask(taskId, commitHash) {
    try {
      this._validateParams({ taskId, commitHash }, ['taskId', 'commitHash']);
      
      if (!taskId.match(/^T[0-9]{3}$/)) {
        throw new ValidationError('タスクIDはT000形式である必要があります');
      }
      
      return await this.manager.addGitCommitToTask(taskId, commitHash);
    } catch (error) {
      return this._handleError(error, 'addGitCommitToTask', { taskId, commitHash });
    }
  }
  
  /**
   * タスクを初期化
   * @param {Object} projectInfo - プロジェクト情報
   * @returns {Promise<Object>} 初期化されたタスクコレクション
   */
  async initializeTasks(projectInfo) {
    try {
      this._validateParams({ projectInfo }, ['projectInfo']);
      
      return await this.manager.initializeTasks(projectInfo);
    } catch (error) {
      return this._handleError(error, 'initializeTasks', { projectInfo });
    }
  }
}

module.exports = TaskManagerAdapter;
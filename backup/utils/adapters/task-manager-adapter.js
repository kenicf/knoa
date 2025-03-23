/**
 * タスク管理アダプター
 * 
 * 既存のタスク管理コンポーネントをラップし、統合マネージャーとのインターフェースを提供します。
 */

const { ValidationError } = require('../errors');
const Validator = require('../validator');

/**
 * タスク管理インターフェース
 * @interface
 */
class TaskManagerInterface {
  /**
   * タスクを検証
   * @param {Task} task - 検証するタスク
   * @returns {ValidationResult} 検証結果
   */
  validateTask(task) {}
  
  /**
   * すべてのタスクを取得
   * @returns {Promise<TaskCollection>} タスクコレクション
   */
  async getAllTasks() {}
  
  /**
   * IDでタスクを取得
   * @param {string} taskId - タスクID
   * @returns {Promise<Task|null>} タスク、存在しない場合はnull
   */
  async getTaskById(taskId) {}
  
  /**
   * タスクを作成
   * @param {TaskInput} taskData - タスク入力データ
   * @returns {Promise<Task>} 作成されたタスク
   */
  async createTask(taskData) {}
  
  /**
   * タスクを更新
   * @param {Task} task - 更新するタスク
   * @returns {Promise<Task>} 更新されたタスク
   */
  async updateTask(task) {}
  
  /**
   * タスク進捗を更新
   * @param {string} taskId - タスクID
   * @param {number} progress - 進捗率
   * @param {string} state - 進捗状態
   * @param {TaskCollection} [tasks] - 既存のタスクコレクション（最適化用）
   * @returns {Promise<UpdateResult>} 更新結果
   */
  async updateTaskProgress(taskId, progress, state, tasks) {}
  
  /**
   * タスクにGitコミットを関連付け
   * @param {string} taskId - タスクID
   * @param {string} commitHash - コミットハッシュ
   * @returns {Promise<Task>} 更新されたタスク
   */
  async addGitCommitToTask(taskId, commitHash) {}
  
  /**
   * タスクを初期化
   * @param {Object} projectInfo - プロジェクト情報
   * @returns {Promise<TaskCollection>} 初期化されたタスクコレクション
   */
  async initializeTasks(projectInfo) {}
}

/**
 * タスク管理アダプター
 */
class TaskManagerAdapter extends TaskManagerInterface {
  /**
   * コンストラクタ
   * @param {Object} originalTaskManager - 元のタスク管理インスタンス
   */
  constructor(originalTaskManager) {
    super();
    this.originalTaskManager = originalTaskManager;
  }
  
  /**
   * タスクを検証
   * @param {Task} task - 検証するタスク
   * @returns {ValidationResult} 検証結果
   */
  validateTask(task) {
    return this.originalTaskManager.validateTask(task);
  }
  
  /**
   * すべてのタスクを取得
   * @returns {Promise<TaskCollection>} タスクコレクション
   */
  async getAllTasks() {
    try {
      // ファイルからタスクを読み込む
      const fs = require('fs');
      const path = require('path');
      const tasksPath = path.join(process.cwd(), 'ai-context', 'tasks', 'current-tasks.json');
      
      if (fs.existsSync(tasksPath)) {
        const tasksData = fs.readFileSync(tasksPath, 'utf8');
        return JSON.parse(tasksData);
      }
      
      return {
        project: '',
        original_request: '',
        decomposed_tasks: [],
        current_focus: null
      };
    } catch (error) {
      console.error('タスクの取得に失敗しました:', error);
      throw error;
    }
  }
  
  /**
   * IDでタスクを取得
   * @param {string} taskId - タスクID
   * @returns {Promise<Task|null>} タスク、存在しない場合はnull
   */
  async getTaskById(taskId) {
    try {
      const tasks = await this.getAllTasks();
      return tasks.decomposed_tasks.find(task => task.id === taskId) || null;
    } catch (error) {
      console.error(`タスク ${taskId} の取得に失敗しました:`, error);
      throw error;
    }
  }
  
  /**
   * タスクを作成
   * @param {TaskInput} taskData - タスク入力データ
   * @returns {Promise<Task>} 作成されたタスク
   */
  async createTask(taskData) {
    try {
      // 入力検証
      const validation = Validator.validateTaskInput(taskData);
      if (!validation.isValid) {
        throw new ValidationError(validation.errors.join(', '));
      }
      
      const tasks = await this.getAllTasks();
      
      // 新しいタスクIDを生成
      const taskIds = tasks.decomposed_tasks.map(task => parseInt(task.id.substring(1)));
      const nextId = taskIds.length > 0 ? Math.max(...taskIds) + 1 : 1;
      const taskId = `T${nextId.toString().padStart(3, '0')}`;
      
      // 新しいタスクを作成
      const newTask = {
        id: taskId,
        title: taskData.title,
        description: taskData.description,
        status: taskData.status || 'pending',
        dependencies: taskData.dependencies || [],
        priority: taskData.priority || 3,
        estimated_hours: taskData.estimated_hours || 0,
        progress_percentage: taskData.progress_percentage || 0,
        progress_state: taskData.progress_state || 'not_started',
        git_commits: []
      };
      
      // タスクを追加
      tasks.decomposed_tasks.push(newTask);
      
      // タスクを保存
      const fs = require('fs');
      const path = require('path');
      const tasksPath = path.join(process.cwd(), 'ai-context', 'tasks', 'current-tasks.json');
      fs.writeFileSync(tasksPath, JSON.stringify(tasks, null, 2), 'utf8');
      
      return newTask;
    } catch (error) {
      console.error('タスクの作成に失敗しました:', error);
      throw error;
    }
  }
  
  /**
   * タスクを更新
   * @param {Task} task - 更新するタスク
   * @returns {Promise<Task>} 更新されたタスク
   */
  async updateTask(task) {
    try {
      // 入力検証
      const validation = this.validateTask(task);
      if (!validation.isValid) {
        throw new ValidationError(validation.errors.join(', '));
      }
      
      const tasks = await this.getAllTasks();
      const taskIndex = tasks.decomposed_tasks.findIndex(t => t.id === task.id);
      
      if (taskIndex === -1) {
        throw new Error(`タスク ${task.id} が見つかりません`);
      }
      
      // タスクを更新
      tasks.decomposed_tasks[taskIndex] = task;
      
      // タスクを保存
      const fs = require('fs');
      const path = require('path');
      const tasksPath = path.join(process.cwd(), 'ai-context', 'tasks', 'current-tasks.json');
      fs.writeFileSync(tasksPath, JSON.stringify(tasks, null, 2), 'utf8');
      
      return task;
    } catch (error) {
      console.error(`タスク ${task.id} の更新に失敗しました:`, error);
      throw error;
    }
  }
  
  /**
   * タスク進捗を更新
   * @param {string} taskId - タスクID
   * @param {number} progress - 進捗率
   * @param {string} state - 進捗状態
   * @param {TaskCollection} [tasks] - 既存のタスクコレクション（最適化用）
   * @returns {Promise<UpdateResult>} 更新結果
   */
  async updateTaskProgress(taskId, progress, state, tasks) {
    try {
      // 入力検証
      if (!taskId || typeof taskId !== 'string') {
        throw new ValidationError('タスクIDは必須の文字列です');
      }
      
      if (progress !== null && (typeof progress !== 'number' || progress < 0 || progress > 100)) {
        throw new ValidationError('進捗率は0〜100の数値である必要があります');
      }
      
      // タスクコレクションが渡されていない場合は取得
      const taskCollection = tasks || await this.getAllTasks();
      
      // 元のメソッドを呼び出し
      const result = this.originalTaskManager.updateTaskProgress(taskId, progress, state, taskCollection.decomposed_tasks);
      
      if (!result.success) {
        throw new Error(result.message);
      }
      
      // 更新されたタスクをタスクコレクションに反映
      const taskIndex = taskCollection.decomposed_tasks.findIndex(t => t.id === taskId);
      if (taskIndex !== -1) {
        taskCollection.decomposed_tasks[taskIndex] = result.updatedTask;
      }
      
      // タスクを保存
      const fs = require('fs');
      const path = require('path');
      const tasksPath = path.join(process.cwd(), 'ai-context', 'tasks', 'current-tasks.json');
      fs.writeFileSync(tasksPath, JSON.stringify(taskCollection, null, 2), 'utf8');
      
      return result;
    } catch (error) {
      console.error(`タスク ${taskId} の進捗更新に失敗しました:`, error);
      throw error;
    }
  }
  
  /**
   * タスクにGitコミットを関連付け
   * @param {string} taskId - タスクID
   * @param {string} commitHash - コミットハッシュ
   * @returns {Promise<Task>} 更新されたタスク
   */
  async addGitCommitToTask(taskId, commitHash) {
    try {
      const tasks = await this.getAllTasks();
      
      // 元のメソッドを呼び出し
      const result = this.originalTaskManager.addGitCommitToTask(taskId, commitHash, tasks.decomposed_tasks);
      
      if (!result.success) {
        throw new Error(result.message);
      }
      
      // 更新されたタスクをタスクコレクションに反映
      const taskIndex = tasks.decomposed_tasks.findIndex(t => t.id === taskId);
      if (taskIndex !== -1) {
        tasks.decomposed_tasks[taskIndex] = result.updatedTask;
      }
      
      // タスクを保存
      const fs = require('fs');
      const path = require('path');
      const tasksPath = path.join(process.cwd(), 'ai-context', 'tasks', 'current-tasks.json');
      fs.writeFileSync(tasksPath, JSON.stringify(tasks, null, 2), 'utf8');
      
      return result.updatedTask;
    } catch (error) {
      console.error(`タスク ${taskId} へのコミット ${commitHash} の関連付けに失敗しました:`, error);
      throw error;
    }
  }
  
  /**
   * タスクを初期化
   * @param {Object} projectInfo - プロジェクト情報
   * @returns {Promise<TaskCollection>} 初期化されたタスクコレクション
   */
  async initializeTasks(projectInfo) {
    try {
      // 入力検証
      if (!projectInfo.project || typeof projectInfo.project !== 'string') {
        throw new ValidationError('プロジェクト名は必須の文字列です');
      }
      
      if (!projectInfo.original_request || typeof projectInfo.original_request !== 'string') {
        throw new ValidationError('元のリクエストは必須の文字列です');
      }
      
      // タスクコレクションを初期化
      const taskCollection = {
        project: projectInfo.project,
        original_request: projectInfo.original_request,
        task_hierarchy: projectInfo.task_hierarchy || {
          epics: [],
          stories: []
        },
        decomposed_tasks: projectInfo.decomposed_tasks || [],
        current_focus: projectInfo.current_focus || null
      };
      
      // タスクを保存
      const fs = require('fs');
      const path = require('path');
      const tasksPath = path.join(process.cwd(), 'ai-context', 'tasks', 'current-tasks.json');
      
      // ディレクトリが存在しない場合は作成
      const tasksDir = path.join(process.cwd(), 'ai-context', 'tasks');
      if (!fs.existsSync(tasksDir)) {
        fs.mkdirSync(tasksDir, { recursive: true });
      }
      
      fs.writeFileSync(tasksPath, JSON.stringify(taskCollection, null, 2), 'utf8');
      
      return taskCollection;
    } catch (error) {
      console.error('タスクの初期化に失敗しました:', error);
      throw error;
    }
  }
}

module.exports = TaskManagerAdapter;
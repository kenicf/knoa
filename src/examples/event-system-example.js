/**
 * イベントシステムの使用例
 *
 * このファイルでは、イベントシステムの基本的な使い方と
 * イベント駆動アーキテクチャの実装例を示します。
 */

const {
  EnhancedEventEmitter,
  EventCatalog,
} = require('../lib/core/event-system');
const eventCatalog = require('../lib/core/event-catalog');
const { EventMigrationHelper } = require('../lib/core/event-migration-helper');

// ロガーの作成
const logger = {
  debug: (...args) => console.log('[DEBUG]', ...args),
  info: (...args) => console.log('[INFO]', ...args),
  warn: (...args) => console.log('[WARN]', ...args),
  error: (...args) => console.log('[ERROR]', ...args),
};

// イベントエミッターの作成
const eventEmitter = new EnhancedEventEmitter({
  debugMode: true,
  keepHistory: true,
  historyLimit: 100,
  logger,
});

// イベントカタログを設定
eventEmitter.setCatalog(eventCatalog);

// 移行ヘルパーの作成
const migrationHelper = new EventMigrationHelper(eventEmitter, {
  debugMode: true,
  logger,
});

// ===== 従来のクラスベースの実装 =====

/**
 * タスク管理クラス（従来の実装）
 */
class TaskManager {
  constructor() {
    this.tasks = new Map();
    this.nextId = 1;
  }

  /**
   * タスクを作成
   * @param {Object} data - タスクデータ
   * @returns {Object} 作成されたタスク
   */
  createTask(data) {
    const id = `T${String(this.nextId++).padStart(3, '0')}`;
    const task = {
      id,
      title: data.title || 'Untitled Task',
      description: data.description || '',
      status: data.status || 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.tasks.set(id, task);
    logger.info(`タスク作成: ${id} - ${task.title}`);

    return task;
  }

  /**
   * タスクを更新
   * @param {string} id - タスクID
   * @param {Object} updates - 更新データ
   * @returns {Object} 更新されたタスク
   */
  updateTask(id, updates) {
    if (!this.tasks.has(id)) {
      throw new Error(`タスク ${id} が見つかりません`);
    }

    const task = this.tasks.get(id);
    const previousStatus = task.status;

    // 更新を適用
    Object.assign(task, updates, {
      updated_at: new Date().toISOString(),
    });

    logger.info(`タスク更新: ${id} - ${task.title}`);

    // ステータスが変更された場合
    if (previousStatus !== task.status) {
      logger.info(
        `タスクステータス変更: ${id} - ${previousStatus} → ${task.status}`
      );
    }

    return task;
  }

  /**
   * タスクを削除
   * @param {string} id - タスクID
   * @returns {boolean} 削除に成功した場合はtrue
   */
  deleteTask(id) {
    if (!this.tasks.has(id)) {
      throw new Error(`タスク ${id} が見つかりません`);
    }

    this.tasks.delete(id);
    logger.info(`タスク削除: ${id}`);

    return true;
  }

  /**
   * タスクを取得
   * @param {string} id - タスクID
   * @returns {Object} タスク
   */
  getTask(id) {
    if (!this.tasks.has(id)) {
      throw new Error(`タスク ${id} が見つかりません`);
    }

    return this.tasks.get(id);
  }

  /**
   * すべてのタスクを取得
   * @returns {Array<Object>} タスクの配列
   */
  getAllTasks() {
    return Array.from(this.tasks.values());
  }
}

/**
 * セッション管理クラス（従来の実装）
 */
class SessionManager {
  constructor() {
    this.sessions = new Map();
    this.currentSession = null;
  }

  /**
   * セッションを開始
   * @param {Object} data - セッションデータ
   * @returns {Object} 作成されたセッション
   */
  startSession(data) {
    const id = `session-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    const session = {
      id,
      project_id: data.project_id || 'default',
      start_time: new Date().toISOString(),
      end_time: null,
      status: 'active',
      ...data,
    };

    this.sessions.set(id, session);
    this.currentSession = session;

    logger.info(`セッション開始: ${id}`);

    return session;
  }

  /**
   * セッションを終了
   * @param {string} id - セッションID
   * @returns {Object} 終了したセッション
   */
  endSession(id) {
    if (!this.sessions.has(id)) {
      throw new Error(`セッション ${id} が見つかりません`);
    }

    const session = this.sessions.get(id);
    session.end_time = new Date().toISOString();
    session.status = 'completed';

    if (this.currentSession && this.currentSession.id === id) {
      this.currentSession = null;
    }

    logger.info(`セッション終了: ${id}`);

    return session;
  }

  /**
   * 現在のセッションを取得
   * @returns {Object|null} 現在のセッション
   */
  getCurrentSession() {
    return this.currentSession;
  }
}

// ===== イベント駆動アーキテクチャへの移行 =====

// メソッドとイベントのマッピング
const taskMethodToEventMap = {
  createTask: 'task:created',
  updateTask: 'task:updated',
  deleteTask: 'task:deleted',
  getTask: 'task:accessed',
  getAllTasks: 'task:listAccessed',
};

const sessionMethodToEventMap = {
  startSession: 'session:started',
  endSession: 'session:ended',
  getCurrentSession: 'session:accessed',
};

// 移行ラッパーの作成
const taskManager = new TaskManager();
const wrappedTaskManager = migrationHelper.createMigrationWrapper(
  taskManager,
  'task',
  taskMethodToEventMap
);

const sessionManager = new SessionManager();
const wrappedSessionManager = migrationHelper.createMigrationWrapper(
  sessionManager,
  'session',
  sessionMethodToEventMap
);

// ===== イベントリスナーの登録 =====

// タスク作成イベントのリスナー
eventEmitter.on('task:created', (data) => {
  logger.info(`[EVENT] タスク作成イベント受信: ${data.id} - ${data.title}`);

  // 他のコンポーネントに通知
  eventEmitter.emitStandardized('notification', 'created', {
    type: 'task',
    message: `新しいタスク「${data.title}」が作成されました`,
    task_id: data.id,
  });
});

// タスク更新イベントのリスナー
eventEmitter.on('task:updated', (data) => {
  logger.info(`[EVENT] タスク更新イベント受信: ${data.id}`);

  // ステータス変更の検出
  if (data.updates && data.updates.status) {
    eventEmitter.emitStandardized('task', 'statusChanged', {
      id: data.id,
      previousStatus: data.result ? data.result.status : 'unknown',
      newStatus: data.updates.status,
    });
  }
});

// タスクステータス変更イベントのリスナー
eventEmitter.on('task:statusChanged', (data) => {
  logger.info(
    `[EVENT] タスクステータス変更イベント受信: ${data.id} - ${data.previousStatus} → ${data.newStatus}`
  );

  // ステータスが「completed」に変更された場合
  if (data.newStatus === 'completed') {
    eventEmitter.emitStandardized('notification', 'created', {
      type: 'task_completed',
      message: `タスク ${data.id} が完了しました`,
      task_id: data.id,
    });
  }
});

// セッション開始イベントのリスナー
eventEmitter.on('session:started', (data) => {
  logger.info(`[EVENT] セッション開始イベント受信: ${data.id}`);

  // システム初期化イベントを発行
  eventEmitter.emitStandardized('system', 'initialized', {
    component: 'session',
    session_id: data.id,
    startup_time: 100,
  });
});

// セッション終了イベントのリスナー
eventEmitter.on('session:ended', (data) => {
  logger.info(`[EVENT] セッション終了イベント受信: ${data.id}`);

  // セッション統計情報を計算
  const startTime = new Date(data.result.start_time);
  const endTime = new Date(data.result.end_time);
  const duration = (endTime - startTime) / 1000; // 秒単位

  logger.info(`セッション統計: 期間=${duration}秒`);
});

// グローバルイベントリスナー
eventEmitter.on('event', (data) => {
  logger.debug(`[GLOBAL] イベント発行: ${data.type}`);
});

// エラーイベントリスナー
eventEmitter.on('error', (error) => {
  logger.error(`[ERROR] イベント処理エラー: ${error.message}`);
});

// ワイルドカードリスナー
eventEmitter.on('notification:*', (data, eventName) => {
  logger.info(`[NOTIFICATION] ${eventName}: ${data.message}`);
});

// ===== 使用例 =====

// タスクの作成
const task1 = wrappedTaskManager.createTask({
  title: 'イベントシステムの実装',
  description: 'イベント駆動アーキテクチャを実装する',
  status: 'in_progress',
});

// タスクの更新
wrappedTaskManager.updateTask(task1.id, {
  status: 'completed',
});

// セッションの開始
const session = wrappedSessionManager.startSession({
  project_id: 'knoa',
  user_id: 'user-001',
});

// セッションの終了
wrappedSessionManager.endSession(session.id);

// カタログに登録されているイベントを発行
try {
  eventEmitter.emitCataloged('system:initialized', {
    version: '1.0.0',
    components: ['task', 'session', 'feedback'],
    startup_time: 1200,
  });
} catch (error) {
  logger.error(`カタログイベント発行エラー: ${error.message}`);
}

// 移行レポートの生成
const report = migrationHelper.generateMigrationReport();
logger.info('移行レポート:', report);

// 移行ガイドの生成
const guide = migrationHelper.generateMigrationGuide();
logger.info('移行ガイド生成完了');

// イベント履歴の取得
const history = eventEmitter.getEventHistory();
logger.info(`イベント履歴: ${history.length}件`);

// 実行結果の表示
console.log('\n===== 実行結果 =====\n');
console.log('作成されたタスク:', task1);
console.log('セッション:', session);
console.log('イベント履歴件数:', history.length);
console.log('移行率:', report.migrationProgress.migrationPercentage + '%');
console.log('\nイベントシステムの実装が完了しました。');

module.exports = {
  eventEmitter,
  taskManager: wrappedTaskManager,
  sessionManager: wrappedSessionManager,
  migrationHelper,
};

/**
 * イベント標準化のテストスクリプト
 * 
 * このスクリプトは、イベント駆動アーキテクチャの統一の一環として、
 * 標準化されたイベント発行の実装をテストします。
 */

const { EnhancedEventEmitter } = require('./src/lib/core/event-system');
const Logger = require('./src/lib/utils/logger');
const CacheManager = require('./src/lib/utils/cache-manager');
const eventCatalog = require('./src/lib/core/event-catalog');

// 環境変数の設定
process.env.NODE_ENV = 'development';

// イベントリスナーの設定
function setupEventListeners(eventEmitter) {
  // すべてのイベントをリッスン
  eventEmitter.on('*', (data, eventName) => {
    console.log(`[イベント受信] ${eventName}:`, JSON.stringify(data, null, 2));
  });
  
  // 特定のイベントをリッスン
  eventEmitter.on('log:message_created', (data) => {
    console.log(`[ログイベント] ${data.level}: ${data.message}`);
  });
  
  eventEmitter.on('cache:item_set', (data) => {
    console.log(`[キャッシュイベント] キー "${data.key}" が設定されました`);
  });
  
  eventEmitter.on('storage:file_read_before', (data) => {
    console.log(`[ストレージイベント] ファイル "${data.filename}" の読み込み前`);
  });
  
  eventEmitter.on('storage:file_read_after', (data) => {
    console.log(`[ストレージイベント] ファイル "${data.filename}" の読み込み後: ${data.success ? '成功' : '失敗'}`);
  });
  
  eventEmitter.on('integration:system_initialized', (data) => {
    console.log(`[統合マネージャーイベント] システム初期化: 同期間隔=${data.syncInterval}ms`);
  });
  
  eventEmitter.on('integration:workflow_initialized', (data) => {
    console.log(`[統合マネージャーイベント] ワークフロー初期化: プロジェクト=${data.projectId}, タスク数=${data.taskCount}`);
  });
  
  eventEmitter.on('session:session_started', (data) => {
    console.log(`[セッションイベント] セッション開始: ID=${data.sessionId}`);
  });
  
  // 古いイベント名もリッスン（後方互換性のテスト）
  eventEmitter.on('log:entry', (data) => {
    console.log(`[旧ログイベント] ${data.level}: ${data.message}`);
  });
  
  eventEmitter.on('cache:set', (data) => {
    console.log(`[旧キャッシュイベント] キー "${data.key}" が設定されました`);
  });
  
  eventEmitter.on('storage:file:read:before', (data) => {
    console.log(`[旧ストレージイベント] ファイル読み込み前: ${data.filename}`);
  });
  
  eventEmitter.on('integration:manager:initialized', (data) => {
    console.log(`[旧統合マネージャーイベント] 初期化: 同期間隔=${data.syncInterval}ms`);
  });
  
  eventEmitter.on('workflow:initialized', (data) => {
    console.log(`[旧ワークフローイベント] 初期化: プロジェクト=${data.projectId}`);
  });
  
  eventEmitter.on('session:started', (data) => {
    console.log(`[旧セッションイベント] 開始: ID=${data.sessionId}`);
  });
}

// メインテスト関数
async function runTest() {
  console.log('=== イベント標準化テスト開始 ===');
  
  // イベントエミッターの作成
  const eventEmitter = new EnhancedEventEmitter({
    debugMode: true,
    logger: console
  });
  
  // イベントカタログの設定
  eventEmitter.setCatalog(eventCatalog);
  
  // イベントリスナーの設定
  setupEventListeners(eventEmitter);
  
  // Loggerのテスト
  console.log('\n--- Loggerテスト ---');
  const logger = new Logger({
    level: 'debug',
    eventEmitter
  });
  
  logger.info('これは情報ログです', { user: 'testuser' });
  logger.error('これはエラーログです', { error: 'テストエラー' });
  logger.addTransport({ type: 'file', write: () => {} });
  logger.addContextProvider('session', () => 'test-session');
  
  // CacheManagerのテスト
  console.log('\n--- CacheManagerテスト ---');
  const cacheManager = new CacheManager({
    ttlMs: 60000,
    maxSize: 100,
    eventEmitter
  });
  
  cacheManager.set('user:123', { name: 'テストユーザー' });
  cacheManager.get('user:123');
  
  // StorageServiceのテスト
  console.log('\n--- StorageServiceテスト ---');
  const StorageService = require('./src/lib/utils/storage');
  const fs = require('fs');
  const path = require('path');
  
  // テスト用ディレクトリの作成
  const testDir = './test-event-dir';
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  
  const storageService = new StorageService({
    basePath: process.cwd(),
    eventEmitter,
    logger
  });
  
  // JSONファイルの書き込みと読み込み
  const testData = { test: true, timestamp: new Date().toISOString() };
  storageService.writeJSON(testDir, 'test-data.json', testData);
  const readData = storageService.readJSON(testDir, 'test-data.json');
  console.log('読み込んだデータ:', readData);
  // アダプターのテスト
  console.log('\n--- アダプターテスト ---');
  const TaskManagerAdapter = require('./src/lib/adapters/task-manager-adapter');
  const SessionManagerAdapter = require('./src/lib/adapters/session-manager-adapter');
  const FeedbackManagerAdapter = require('./src/lib/adapters/feedback-manager-adapter');
  
  // モックオブジェクトの作成
  const mockTaskManager = {
    initializeTasks: async () => ({ tasks: [{ id: 'T001' }, { id: 'T002' }] }),
    createTask: async (taskData) => ({ id: 'T003', title: taskData.title, status: 'pending' }),
    updateTask: async (task) => ({ ...task, updated: true }),
    updateTaskProgress: async (taskId, progress, state) => ({
      id: taskId,
      progress,
      state,
      previousProgress: 0,
      previousState: 'pending'
    }),
    addGitCommitToTask: async (taskId, commitHash) => ({ id: taskId, commits: [commitHash] })
  };
  
  const mockSessionManager = {
    getLatestSession: async () => null,
    createNewSession: async () => ({
      session_handover: { session_id: 'session-test-1' }
    }),
    updateSession: async (sessionId, updateData) => ({
      session_handover: { session_id: sessionId },
      ...updateData
    }),
    endSession: async (sessionId) => ({
      session_handover: { session_id: sessionId },
      ended: true,
      duration: 3600
    }),
    addTaskToSession: async (sessionId, taskId) => ({
      session_handover: { session_id: sessionId },
      tasks: [taskId]
    }),
    removeTaskFromSession: async (sessionId, taskId) => ({
      session_handover: { session_id: sessionId },
      tasks: []
    }),
    addGitCommitToSession: async (sessionId, commitHash) => ({
      session_handover: { session_id: sessionId },
      commits: [commitHash]
    })
  };
  
  const mockFeedbackManager = {
    getPendingFeedback: async () => null,
    createNewFeedback: async (taskId, attempt) => ({
      id: 'F001',
      task_id: taskId,
      attempt: attempt || 1
    }),
    collectTestResults: async (taskId, testCommand, testTypes) => ({
      task_id: taskId,
      results: [{ type: 'unit', passed: true }]
    }),
    prioritizeFeedback: async (feedback) => ({
      ...feedback,
      priorities: { high: ['issue1'], medium: ['issue2'] }
    }),
    updateFeedbackStatus: async (feedback, newStatus) => ({
      ...feedback,
      status: newStatus
    }),
    integrateFeedbackWithSession: async (feedbackId, sessionId) => true,
    integrateFeedbackWithTask: async (feedbackId, taskId) => true
  };
  
  // アダプターのインスタンス作成
  const taskManagerAdapter = new TaskManagerAdapter(mockTaskManager, {
    eventEmitter,
    logger
  });
  
  const sessionManagerAdapter = new SessionManagerAdapter(mockSessionManager, {
    eventEmitter,
    logger
  });
  
  const feedbackManagerAdapter = new FeedbackManagerAdapter(mockFeedbackManager, {
    eventEmitter,
    logger
  });
  
  // TaskManagerAdapterのテスト
  console.log('\n--- TaskManagerAdapterテスト ---');
  await taskManagerAdapter.createTask({ title: 'テストタスク' });
  await taskManagerAdapter.updateTask({ id: 'T001', title: '更新されたタスク' });
  await taskManagerAdapter.updateTaskProgress('T001', 50, 'in_progress');
  await taskManagerAdapter.addGitCommitToTask('T001', 'abc123');
  await taskManagerAdapter.initializeTasks({ id: 'test-project' });
  
  // SessionManagerAdapterのテスト
  console.log('\n--- SessionManagerAdapterテスト ---');
  await sessionManagerAdapter.createNewSession('previous-session-1');
  await sessionManagerAdapter.updateSession('session-test-1', { status: 'active' });
  await sessionManagerAdapter.endSession('session-test-1');
  await sessionManagerAdapter.addTaskToSession('session-test-1', 'T001');
  await sessionManagerAdapter.removeTaskFromSession('session-test-1', 'T001');
  await sessionManagerAdapter.addGitCommitToSession('session-test-1', 'abc123');
  
  // FeedbackManagerAdapterのテスト
  console.log('\n--- FeedbackManagerAdapterテスト ---');
  await feedbackManagerAdapter.createNewFeedback('T001', 1);
  await feedbackManagerAdapter.collectTestResults('T001', 'npm test', ['unit']);
  await feedbackManagerAdapter.prioritizeFeedback({ id: 'F001', task_id: 'T001', status: 'open' });
  await feedbackManagerAdapter.updateFeedbackStatus({ id: 'F001', task_id: 'T001', status: 'open' }, 'in_progress');
  await feedbackManagerAdapter.integrateFeedbackWithSession('F001', 'session-test-1');
  await feedbackManagerAdapter.integrateFeedbackWithTask('F001', 'T001');
  
  // IntegrationManagerのテスト
  console.log('\n--- IntegrationManagerテスト ---');
  const IntegrationManager = require('./src/lib/managers/integration-manager');
  
  const mockStateManager = {
    setState: (key, value) => console.log(`状態を設定: ${key}=${value}`),
    getState: (key) => 'initialized'
  };
  
  const mockLockManager = {
    acquire: async () => ({ release: async () => {} }),
    acquireLock: async () => true,
    releaseLock: async () => true
  };
  
  // IntegrationManagerのインスタンス作成
  const integrationManager = new IntegrationManager({
    taskManager: mockTaskManager,
    sessionManager: mockSessionManager,
    feedbackManager: mockFeedbackManager,
    stateManager: mockStateManager,
    lockManager: mockLockManager,
    eventEmitter,
    logger,
    config: {
      syncInterval: 30000,
      enablePeriodicSync: false
    }
  });
  
  // ワークフローの初期化
  await integrationManager.initializeWorkflow('test-project', 'テストリクエスト');
  
  // 新しいセッションの開始
  await integrationManager.startNewSession();
  
  // テスト用ディレクトリの削除
  try {
    fs.unlinkSync(path.join(testDir, 'test-data.json'));
    fs.rmdirSync(testDir);
  } catch (error) {
    console.error('テストディレクトリの削除に失敗しました:', error);
  }
  
  console.log('\n=== イベント標準化テスト完了 ===');
}

// テスト実行
runTest().catch(error => {
  console.error('テスト実行中にエラーが発生しました:', error);
  process.exit(1);
});
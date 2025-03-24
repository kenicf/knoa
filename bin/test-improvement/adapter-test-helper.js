/**
 * アダプターテスト用ヘルパー
 */

const { EnhancedEventEmitter } = require('../../../src/lib/core/event-system');

/**
 * 共通のモックロガーを作成
 * @returns {Object} モックロガー
 */
function createMockLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };
}

/**
 * イベントエミッターとイベントキャプチャを作成
 * @param {Object} options - オプション
 * @returns {Object} イベントエミッターとキャプチャされたイベント
 */
function createEventEmitterWithCapture(options = {}) {
  const emittedEvents = [];
  const logger = options.logger || createMockLogger();
  
  // 実際のEventEmitterを使用
  const eventEmitter = new EnhancedEventEmitter({ logger });
  
  // イベントをキャプチャ
  eventEmitter.on('*', (data, eventName) => {
    emittedEvents.push({ name: eventName, data });
  });
  
  return {
    eventEmitter,
    emittedEvents,
    resetEvents: () => { emittedEvents.length = 0; }
  };
}

/**
 * StateManagerのモックを作成
 * @returns {Object} モックStateManager
 */
function createMockStateManager() {
  return {
    getCurrentState: jest.fn().mockReturnValue('initialized'),
    setState: jest.fn().mockImplementation((state, data) => {
      return { state, previousState: 'initialized', timestamp: new Date().toISOString(), ...data };
    }),
    transitionTo: jest.fn().mockImplementation((state, data) => {
      return { state, previousState: 'initialized', timestamp: new Date().toISOString(), ...data };
    }),
    canTransitionTo: jest.fn().mockReturnValue(true),
    getStateHistory: jest.fn().mockReturnValue([
      { state: 'uninitialized', timestamp: '2025-03-01T00:00:00.000Z' },
      { state: 'initialized', timestamp: '2025-03-01T00:01:00.000Z' }
    ]),
    getPreviousState: jest.fn().mockReturnValue('uninitialized')
  };
}

/**
 * IntegrationManagerのモックを作成
 * @returns {Object} モックIntegrationManager
 */
function createMockIntegrationManager() {
  return {
    initializeWorkflow: jest.fn().mockImplementation(projectData => ({ 
      projectId: projectData?.id || 'P001', 
      initialized: true, 
      timestamp: new Date().toISOString() 
    })),
    startSession: jest.fn().mockImplementation(options => ({ 
      sessionId: 'S001', 
      started: true, 
      timestamp: new Date().toISOString(),
      options 
    })),
    endSession: jest.fn().mockImplementation(sessionId => ({ 
      sessionId: sessionId || 'S001', 
      ended: true, 
      duration: 3600,
      timestamp: new Date().toISOString() 
    })),
    createTask: jest.fn().mockImplementation(taskData => ({ 
      id: 'T001', 
      ...(taskData || {}), 
      created: true,
      timestamp: new Date().toISOString() 
    })),
    updateTaskStatus: jest.fn().mockImplementation((taskId, status) => ({ 
      id: taskId || 'T001', 
      status: status || 'in_progress', 
      previousStatus: 'pending',
      timestamp: new Date().toISOString() 
    })),
    collectFeedback: jest.fn().mockImplementation((taskId, feedbackData) => ({
      id: 'F001',
      taskId: taskId || 'T001',
      ...(feedbackData || {}),
      timestamp: new Date().toISOString()
    })),
    resolveFeedback: jest.fn().mockImplementation((feedbackId) => ({
      id: feedbackId || 'F001',
      resolved: true,
      timestamp: new Date().toISOString()
    })),
    syncComponents: jest.fn().mockImplementation(() => ({
      synced: true,
      timestamp: new Date().toISOString()
    })),
    generateReport: jest.fn().mockImplementation(() => ({
      content: '# 統合レポート\n\nこれはテスト用の統合レポートです。',
      timestamp: new Date().toISOString()
    })),
    getWorkflowStatus: jest.fn().mockImplementation(() => ({ 
      state: 'task_in_progress', 
      activeComponents: ['session', 'task'],
      timestamp: new Date().toISOString() 
    }))
  };
}

/**
 * SessionManagerのモックを作成
 * @returns {Object} モックSessionManager
 */
function createMockSessionManager() {
  return {
    createNewSession: jest.fn().mockImplementation(previousSessionId => ({
      session_id: 'S001',
      created_at: new Date().toISOString(),
      previous_session_id: previousSessionId
    })),
    getSession: jest.fn().mockImplementation(sessionId => ({
      session_id: sessionId || 'S001',
      created_at: new Date().toISOString(),
      tasks: ['T001', 'T002']
    })),
    getAllSessions: jest.fn().mockReturnValue([
      { session_id: 'S001', created_at: new Date().toISOString() },
      { session_id: 'S002', created_at: new Date(Date.now() - 86400000).toISOString(), ended_at: new Date().toISOString() }
    ]),
    endSession: jest.fn().mockImplementation(sessionId => ({
      session_id: sessionId || 'S001',
      ended_at: new Date().toISOString(),
      duration: 3600
    })),
    getLatestSession: jest.fn().mockReturnValue({
      session_id: 'S001',
      created_at: new Date().toISOString()
    }),
    addTaskToSession: jest.fn().mockImplementation((sessionId, taskId) => ({
      session_id: sessionId || 'S001',
      task_id: taskId || 'T001',
      added_at: new Date().toISOString()
    })),
    removeTaskFromSession: jest.fn().mockImplementation((sessionId, taskId) => ({
      session_id: sessionId || 'S001',
      task_id: taskId || 'T001',
      removed_at: new Date().toISOString()
    })),
    generateHandoverDocument: jest.fn().mockReturnValue('# セッション引継ぎドキュメント\n\nこれはテスト用の引継ぎドキュメントです。')
  };
}

/**
 * FeedbackManagerのモックを作成
 * @returns {Object} モックFeedbackManager
 */
function createMockFeedbackManager() {
  return {
    collectTestResults: jest.fn().mockImplementation((taskId, results) => ({
      id: 'F001',
      task_id: taskId,
      results,
      created_at: new Date().toISOString()
    })),
    getFeedbackByTaskId: jest.fn().mockImplementation(taskId => [
      { id: 'F001', task_id: taskId, content: 'テストフィードバック1', status: 'open' },
      { id: 'F002', task_id: taskId, content: 'テストフィードバック2', status: 'resolved' }
    ]),
    updateFeedbackStatus: jest.fn().mockImplementation((feedbackId, status) => ({
      id: feedbackId,
      status,
      updated_at: new Date().toISOString()
    })),
    generateFeedbackMarkdown: jest.fn().mockReturnValue('# フィードバックレポート\n\nこれはテスト用のフィードバックレポートです。'),
    prioritizeFeedback: jest.fn().mockImplementation(taskId => ({
      task_id: taskId,
      prioritized: true,
      timestamp: new Date().toISOString()
    })),
    linkFeedbackToGitCommit: jest.fn().mockImplementation((feedbackId, commitHash) => ({
      id: feedbackId,
      commit_hash: commitHash,
      linked_at: new Date().toISOString()
    })),
    linkFeedbackToSession: jest.fn().mockImplementation((feedbackId, sessionId) => ({
      id: feedbackId,
      session_id: sessionId,
      linked_at: new Date().toISOString()
    })),
    integrateFeedbackWithTask: jest.fn().mockImplementation((feedbackId, taskId) => ({
      id: feedbackId,
      task_id: taskId,
      integrated_at: new Date().toISOString()
    })),
    integrateFeedbackWithSession: jest.fn().mockImplementation((feedbackId, sessionId) => ({
      id: feedbackId,
      session_id: sessionId,
      integrated_at: new Date().toISOString()
    }))
  };
}

/**
 * TaskManagerのモックを作成
 * @returns {Object} モックTaskManager
 */
function createMockTaskManager() {
  return {
    createTask: jest.fn().mockImplementation(data => ({ id: 'T001', ...data })),
    getAllTasks: jest.fn().mockImplementation(() => ({
      decomposed_tasks: [
        { id: 'T001', title: 'タスク1', status: 'in_progress', progress_percentage: 50 },
        { id: 'T002', title: 'タスク2', status: 'pending', progress_percentage: 0 }
      ]
    })),
    getTaskById: jest.fn().mockImplementation(taskId => ({ 
      id: taskId, 
      title: 'テストタスク', 
      description: 'テスト説明',
      status: 'in_progress',
      priority: 3,
      progress_percentage: 50
    })),
    updateTask: jest.fn().mockImplementation(task => ({ ...task, updated: true })),
    updateTaskProgress: jest.fn().mockImplementation((taskId, progress, state) => ({ 
      id: taskId, 
      progress_percentage: progress, 
      progress_state: state
    })),
    deleteTask: jest.fn().mockImplementation(() => true),
    addGitCommitToTask: jest.fn().mockImplementation((taskId, commitHash) => ({ 
      id: taskId, 
      git_commits: [{ hash: commitHash, message: 'テストコミット' }] 
    }))
  };
}

/**
 * エラーを発生させるモックを作成
 * @param {Object} mockObject - 元のモックオブジェクト
 * @param {string} methodName - エラーを発生させるメソッド名
 * @param {Object} options - エラーオプション
 * @returns {Object} エラーを発生させるモック
 */
function createErrorMock(mockObject, methodName, options = {}) {
  const { ApplicationError } = require('../../../src/lib/core/error-framework');
  const errorMock = { ...mockObject };
  
  errorMock[methodName] = jest.fn().mockImplementation(() => {
    const errorMessage = options.message || 'テストエラー';
    const errorCode = options.code || 'ERR_TEST';
    const recoverable = options.recoverable !== undefined ? options.recoverable : true;
    
    throw new ApplicationError(errorMessage, {
      code: errorCode,
      recoverable,
      context: options.context || { operation: methodName }
    });
  });
  
  return errorMock;
}

/**
 * テスト用のセットアップを行う
 * @param {Object} options - オプション
 * @returns {Object} セットアップされたテスト環境
 */
function setupAdapterTest(options = {}) {
  // モックの作成
  const mockLogger = createMockLogger();
  const { eventEmitter, emittedEvents, resetEvents } = createEventEmitterWithCapture({ logger: mockLogger });
  
  // マネージャーの種類に応じたモックを作成
  let mockManager;
  if (options.managerType === 'state') {
    mockManager = createMockStateManager();
  } else if (options.managerType === 'integration') {
    mockManager = createMockIntegrationManager();
  } else if (options.managerType === 'session') {
    mockManager = createMockSessionManager();
  } else if (options.managerType === 'feedback') {
    mockManager = createMockFeedbackManager();
  } else if (options.managerType === 'task') {
    mockManager = createMockTaskManager();
  } else {
    mockManager = options.mockManager || {};
  }
  
  // エラーハンドラーのモックを作成
  const mockErrorHandler = {
    handle: jest.fn().mockImplementation((error) => error),
    registerRecoveryStrategy: jest.fn(),
    removeRecoveryStrategy: jest.fn()
  };
  
  // アダプターの作成
  const AdapterClass = options.AdapterClass;
  const adapter = new AdapterClass(mockManager, {
    eventEmitter,
    logger: mockLogger,
    errorHandler: options.useErrorHandler ? mockErrorHandler : undefined
  });
  
  // beforeEach関数を返す
  const resetMocks = () => {
    // すべてのモックをリセット
    jest.clearAllMocks();
    resetEvents();
    
    // イベントリスナーをリセット
    if (options.resetListeners && eventEmitter.removeAllListeners) {
      eventEmitter.removeAllListeners();
    }
  };
  
  return {
    adapter,
    mockManager,
    mockLogger,
    eventEmitter,
    emittedEvents,
    mockErrorHandler,
    resetMocks
  };
}

module.exports = {
  createMockLogger,
  createEventEmitterWithCapture,
  createMockStateManager,
  createMockIntegrationManager,
  createMockSessionManager,
  createMockFeedbackManager,
  createMockTaskManager,
  createErrorMock,
  setupAdapterTest
};
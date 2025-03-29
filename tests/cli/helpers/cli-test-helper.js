/**
 * CLIテスト用ヘルパー
 */

/**
 * CLIテスト用のモックを作成
 * @returns {Object} モックオブジェクト
 */
function createMocks() {
  // モックの作成
  const mockAdapters = {
    taskManagerAdapter: {
      createTask: jest
        .fn()
        .mockImplementation((data) => ({ id: 'T001', ...data })),
      getAllTasks: jest.fn().mockImplementation(() => ({
        decomposed_tasks: [
          {
            id: 'T001',
            title: 'タスク1',
            status: 'in_progress',
            progress_percentage: 50,
          },
          {
            id: 'T002',
            title: 'タスク2',
            status: 'pending',
            progress_percentage: 0,
          },
        ],
      })),
      getTaskById: jest.fn().mockImplementation((taskId) => ({
        id: taskId,
        title: 'テストタスク',
        description: 'テスト説明',
        status: 'in_progress',
        priority: 3,
        progress_percentage: 50,
      })),
      updateTask: jest
        .fn()
        .mockImplementation((task) => ({ ...task, updated: true })),
      updateTaskProgress: jest
        .fn()
        .mockImplementation((taskId, progress, state) => ({
          id: taskId,
          progress_percentage: progress,
          progress_state: state,
        })),
      deleteTask: jest.fn().mockImplementation(() => true),
      addGitCommitToTask: jest
        .fn()
        .mockImplementation((taskId, commitHash) => ({
          id: taskId,
          git_commits: [{ hash: commitHash, message: 'テストコミット' }],
        })),
      importTask: jest.fn().mockImplementation((taskData) => taskData),
    },
    sessionManagerAdapter: {
      createNewSession: jest.fn().mockImplementation(() => ({
        session_id: 'S001',
        created_at: new Date().toISOString(),
      })),
      getLatestSession: jest.fn().mockImplementation(() => ({
        session_id: 'S001',
        created_at: new Date().toISOString(),
      })),
      getSession: jest.fn().mockImplementation((sessionId) => ({
        session_id: sessionId,
        created_at: new Date().toISOString(),
        tasks: ['T001', 'T002'],
      })),
      endSession: jest.fn().mockImplementation((sessionId) => ({
        session_id: sessionId,
        ended_at: new Date().toISOString(),
        handover_document:
          '# セッション引継ぎドキュメント\n\nこれはテスト用の引継ぎドキュメントです。',
      })),
      getAllSessions: jest.fn().mockImplementation(() => [
        { session_id: 'S001', created_at: new Date().toISOString() },
        {
          session_id: 'S002',
          created_at: new Date(Date.now() - 86400000).toISOString(),
          ended_at: new Date().toISOString(),
        },
      ]),
      importSession: jest.fn().mockImplementation((sessionData) => sessionData),
    },
    feedbackManagerAdapter: {
      collectTestResults: jest.fn().mockImplementation((taskId, results) => ({
        id: 'F001',
        task_id: taskId,
        results,
        created_at: new Date().toISOString(),
      })),
      getFeedbackByTaskId: jest.fn().mockImplementation((taskId) => [
        {
          id: 'F001',
          task_id: taskId,
          content: 'テストフィードバック1',
          status: 'open',
        },
        {
          id: 'F002',
          task_id: taskId,
          content: 'テストフィードバック2',
          status: 'resolved',
        },
      ]),
      updateFeedbackStatus: jest
        .fn()
        .mockImplementation((feedbackId, status) => ({
          id: feedbackId,
          status,
          updated_at: new Date().toISOString(),
        })),
      generateFeedbackMarkdown: jest
        .fn()
        .mockImplementation(
          () =>
            '# フィードバックレポート\n\nこれはテスト用のフィードバックレポートです。'
        ),
    },
    integrationManagerAdapter: {
      initializeWorkflow: jest.fn().mockImplementation((projectData) => ({
        projectId: projectData.id,
        initialized: true,
        timestamp: new Date().toISOString(),
      })),
      startSession: jest.fn().mockImplementation(() => ({
        sessionId: 'S001',
        started: true,
        timestamp: new Date().toISOString(),
      })),
      endSession: jest.fn().mockImplementation((sessionId) => ({
        sessionId,
        ended: true,
        timestamp: new Date().toISOString(),
      })),
      createTask: jest.fn().mockImplementation((taskData) => ({
        id: 'T001',
        ...taskData,
        created: true,
        timestamp: new Date().toISOString(),
      })),
      updateTaskStatus: jest.fn().mockImplementation((taskId, status) => ({
        id: taskId,
        status,
        previousStatus: 'pending',
        timestamp: new Date().toISOString(),
      })),
      collectFeedback: jest.fn().mockImplementation((taskId, feedbackData) => ({
        id: 'F001',
        taskId,
        ...feedbackData,
        timestamp: new Date().toISOString(),
      })),
      generateReport: jest.fn().mockImplementation(() => ({
        content: '# 統合レポート\n\nこれはテスト用の統合レポートです。',
        timestamp: new Date().toISOString(),
      })),
      getWorkflowStatus: jest.fn().mockImplementation(() => ({
        state: 'task_in_progress',
        activeComponents: ['session', 'task'],
        timestamp: new Date().toISOString(),
      })),
    },
    stateManagerAdapter: {
      getCurrentState: jest.fn().mockReturnValue('initialized'),
      setState: jest.fn().mockImplementation((state) => ({
        state,
        previousState: 'initialized',
        timestamp: new Date().toISOString(),
      })),
      transitionTo: jest.fn().mockImplementation((state) => ({
        state,
        previousState: 'initialized',
        timestamp: new Date().toISOString(),
      })),
      canTransitionTo: jest.fn().mockReturnValue(true),
      getStateHistory: jest.fn().mockReturnValue([
        {
          state: 'uninitialized',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
        },
        { state: 'initialized', timestamp: new Date().toISOString() },
      ]),
      getPreviousState: jest.fn().mockReturnValue('uninitialized'),
    },
  };

  // モックのServiceContainerを作成
  const mockContainer = {
    get: jest.fn((name) => mockAdapters[name]),
  };

  // モックのfs, path, colorsを作成
  const mockFs = {
    writeFileSync: jest.fn(),
    readFileSync: jest.fn().mockImplementation((path, encoding) => {
      if (path.endsWith('.json')) {
        return JSON.stringify({
          id: 'mock-data',
          content: 'This is mock data',
        });
      }
      return 'Mock file content';
    }),
    existsSync: jest.fn().mockReturnValue(true),
  };

  const mockPath = {
    join: jest.fn((...args) => args.join('/')),
  };

  const mockColors = {
    cyan: jest.fn((text) => text),
    green: jest.fn((text) => text),
    yellow: jest.fn((text) => text),
    red: jest.fn((text) => text),
    blue: jest.fn((text) => text),
  };

  // モックのyargsを作成
  const mockYargs = {
    usage: jest.fn().mockReturnThis(),
    command: jest.fn().mockReturnThis(),
    option: jest.fn().mockReturnThis(),
    help: jest.fn().mockReturnThis(),
    parse: jest.fn().mockReturnValue({}),
  };

  // モックのconfigを作成
  const mockConfig = {
    session: {
      sessionsDir: 'ai-context/sessions',
    },
    task: {
      tasksDir: 'ai-context/tasks',
    },
    feedback: {
      feedbackDir: 'ai-context/feedback',
    },
  };

  return {
    container: mockContainer,
    adapters: mockAdapters,
    fs: mockFs,
    path: mockPath,
    colors: mockColors,
    yargs: mockYargs,
    config: mockConfig,
  };
}

/**
 * コンソール出力をキャプチャするためのヘルパー
 * @returns {Object} キャプチャ用のオブジェクト
 */
function captureConsole() {
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const consoleOutput = [];
  const consoleErrors = [];

  console.log = jest.fn((...args) => {
    consoleOutput.push(args.join(' '));
  });

  console.error = jest.fn((...args) => {
    consoleErrors.push(args.join(' '));
  });

  return {
    consoleOutput,
    consoleErrors,
    restore: () => {
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
    },
  };
}

module.exports = {
  createMocks,
  captureConsole,
};

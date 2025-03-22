/**
 * テスト用のモックファクトリー
 * 
 * 依存関係のモックを簡単に作成するためのヘルパー関数を提供します。
 */

/**
 * 依存関係のモックを作成
 * @returns {Object} モックされた依存関係のオブジェクト
 */
function createMockDependencies() {
  return {
    storageService: {
      ensureDirectoryExists: jest.fn(),
      readJSON: jest.fn(),
      writeJSON: jest.fn(),
      readText: jest.fn(),
      writeText: jest.fn(),
      fileExists: jest.fn(),
      listFiles: jest.fn(),
      getFilePath: jest.fn((directory, filename) => `${directory}/${filename}`)
    },
    gitService: {
      getCurrentCommitHash: jest.fn(),
      extractTaskIdsFromCommitMessage: jest.fn(),
      getCommitsBetween: jest.fn(),
      getChangedFilesInCommit: jest.fn(),
      getCommitDiffStats: jest.fn()
    },
    logger: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    },
    eventEmitter: {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
      emitAsync: jest.fn(),
      emitStandardized: jest.fn(),
      emitStandardizedAsync: jest.fn()
    },
    errorHandler: {
      handle: jest.fn()
    },
    handlebars: {
      compile: jest.fn().mockReturnValue(jest.fn())
    },
    // IntegrationManagerのテストに必要なモック
    taskManagerAdapter: {
      createTask: jest.fn(),
      getAllTasks: jest.fn(),
      getTaskById: jest.fn(),
      updateTask: jest.fn()
    },
    sessionManagerAdapter: {
      createNewSession: jest.fn(),
      getSessionById: jest.fn(),
      saveSession: jest.fn()
    },
    feedbackManagerAdapter: {
      getPendingFeedback: jest.fn(),
      saveFeedback: jest.fn(),
      moveFeedbackToHistory: jest.fn()
    },
    stateManager: {
      states: {
        UNINITIALIZED: 'uninitialized',
        INITIALIZED: 'initialized',
        SESSION_STARTED: 'session_started',
        TASK_IN_PROGRESS: 'task_in_progress',
        FEEDBACK_COLLECTED: 'feedback_collected',
        SESSION_ENDED: 'session_ended'
      },
      getCurrentState: jest.fn(),
      transitionTo: jest.fn()
    },
    cacheManager: {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn()
    },
    lockManager: {
      acquireLock: jest.fn(),
      releaseLock: jest.fn(),
      isLocked: jest.fn()
    },
    pluginManager: {
      loadPlugins: jest.fn(),
      getPlugin: jest.fn(),
      executePlugin: jest.fn()
    },
    validator: {
      validate: jest.fn()
    }
  };
}

/**
 * カスタマイズされた依存関係のモックを作成
 * @param {Object} overrides - 上書きするモックオブジェクト
 * @returns {Object} カスタマイズされたモックされた依存関係のオブジェクト
 */
function createCustomMockDependencies(overrides = {}) {
  const defaultMocks = createMockDependencies();
  return {
    ...defaultMocks,
    ...overrides
  };
}

module.exports = {
  createMockDependencies,
  createCustomMockDependencies
};
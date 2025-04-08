/**
 * テスト用モックファクトリ
 */

/**
 * モックロガーを作成
 * @returns {Object} モックロガー
 */
function createMockLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    fatal: jest.fn(), // fatal メソッドを追加
  };
}

/**
 * モックイベントエミッターを作成
 * @returns {Object} モックイベントエミッター
 */
function createMockEventEmitter() {
  // デフォルトのID生成ロジックを模倣するモック関数
  const mockTraceIdGenerator = jest.fn(
    () => `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  );
  const mockRequestIdGenerator = jest.fn(
    () => `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  );

  return {
    emit: jest.fn(),
    emitStandardized: jest.fn().mockImplementation(function (
      component,
      action,
      data = {}
    ) {
      // 実際の EventEmitter のように ID を付与する処理を模倣
      const traceId = this._traceIdGenerator();
      const requestId = this._requestIdGenerator();
      const standardizedData = {
        ...data,
        timestamp: new Date().toISOString(), // timestamp も付与
        component,
        action,
        traceId,
        requestId,
      };
      // 実際の emit 処理は行わないが、呼び出しは記録される
      // 必要であれば、内部で別の jest.fn() を呼び出して記録しても良い
      // console.log('Mock emitStandardized called:', component, action, standardizedData); // デバッグ用
      return true; // 実際の emitStandardized の戻り値に合わせる (リスナーがいれば true)
    }),
    emitStandardizedAsync: jest.fn().mockImplementation(async function (
      component,
      action,
      data = {}
    ) {
      // 実際の EventEmitter のように ID を付与する処理を模倣
      const traceId = this._traceIdGenerator();
      const requestId = this._requestIdGenerator();
      const standardizedData = {
        ...data,
        timestamp: new Date().toISOString(), // timestamp も付与
        component,
        action,
        traceId,
        requestId,
      };
      // console.log('Mock emitStandardizedAsync called:', component, action, standardizedData); // デバッグ用
      // 非同期処理を模倣 (即時解決)
      await Promise.resolve();
      return true; // 実際の emitStandardizedAsync の戻り値に合わせる
    }),
    on: jest.fn(),
    once: jest.fn(),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn(),
    listenerCount: jest.fn().mockReturnValue(0),
    getRegisteredEvents: jest.fn().mockReturnValue([]),
    getHistory: jest.fn().mockReturnValue([]),
    // テストコードが期待するIDジェネレーターメソッドを追加
    _traceIdGenerator: mockTraceIdGenerator,
    _requestIdGenerator: mockRequestIdGenerator,
    // logger と debugMode もテストで参照されることがあるため追加
    logger: createMockLogger(), // 簡易的なモックロガーを設定
    debugMode: false,
  };
}

/**
 * モックエラーハンドラーを作成
 * @param {Object} options - オプション
 * @param {Object} options.defaultReturnValues - 操作に応じたデフォルト戻り値
 * @returns {Object} モックエラーハンドラー
 */
function createMockErrorHandler(options = {}) {
  const { defaultReturnValues = {} } = options;

  // デフォルト値の設定
  const defaults = {
    // GitService operations
    getCurrentCommitHash: '',
    getCurrentBranch: '',
    extractTaskIdsFromCommitMessage: [],
    getCommitsBetween: [],
    getChangedFilesInCommit: [],
    getCommitDiffStats: { files: [], lines_added: 0, lines_deleted: 0 },
    getCommitHistory: [],
    getFileHistory: [],
    getCommitDetails: null,
    stageFiles: true,
    createCommit: 'new-commit-hash',
    getBranches: [],
    // StorageService operations
    readJSON: null,
    writeJSON: false,
    readText: null,
    writeText: false,
    writeFile: false,
    updateJSON: null,
    fileExists: false,
    listFiles: [],
    deleteFile: false,
    deleteDirectory: false,
    copyFile: false,
    ensureDirectoryExists: true,
    // Other potential operations (add as needed)
    ...defaultReturnValues,
  };

  // モックハンドラー関数
  const mockHandle = jest
    .fn()
    .mockImplementation((error, component, operation, _context) => {
      // context -> _context
      // 操作に応じたデフォルト値を返す
      // eslint-disable-next-line security/detect-object-injection
      return defaults[operation] !== undefined ? defaults[operation] : null;
    });

  return {
    handle: mockHandle,
    register: jest.fn(),
    unregister: jest.fn(),
  };
}

/**
 * モック StorageService を作成
 * @returns {Object} モック StorageService
 */
function createMockStorageService() {
  return {
    readJSON: jest.fn().mockResolvedValue(null), // デフォルトは null を返す
    writeJSON: jest.fn().mockResolvedValue(true), // デフォルトは成功
    readText: jest.fn().mockResolvedValue(null),
    writeText: jest.fn().mockResolvedValue(true),
    writeFile: jest.fn().mockResolvedValue(true),
    updateJSON: jest.fn().mockResolvedValue(null),
    fileExists: jest.fn().mockResolvedValue(false),
    listFiles: jest.fn().mockResolvedValue([]),
    deleteFile: jest.fn().mockResolvedValue(true),
    deleteDirectory: jest.fn().mockResolvedValue(true),
    copyFile: jest.fn().mockResolvedValue(true),
    ensureDirectoryExists: jest.fn().mockResolvedValue(true),
    // 必要に応じて他のメソッドも追加
  };
}

/**
 * モック Validator を作成
 * @returns {Object} モック Validator
 */
function createMockValidator() {
  return {
    validateTaskInput: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
    validateSessionInput: jest
      .fn()
      .mockReturnValue({ isValid: true, errors: [] }),
    validateFeedbackInput: jest
      .fn()
      .mockReturnValue({ isValid: true, errors: [] }),
    sanitizeString: jest.fn((str) => String(str || '')), // 基本的なサニタイズ動作
    // 必要に応じて他のメソッドも追加
  };
}

/**
 * 時間をモック
 * @param {string} isoString - ISO形式の時間文字列
 */
function mockTimestamp(isoString) {
  // Dateのモック
  const mockDate = new Date(isoString);
  const OriginalDate = Date; // 元の Date を保持
  global.Date = class extends OriginalDate {
    // 元の Date を継承
    constructor(...args) {
      // 引数がある場合は元のコンストラクタを呼び出す
      if (args.length > 0) {
        super(...args);
      } else {
        // 引数がない場合はモック時刻を返す
        return mockDate;
      }
    }

    static now() {
      return mockDate.getTime();
    }
  };
  // 元の Date の静的メソッドをコピー (念のため)
  Object.getOwnPropertyNames(OriginalDate)
    .filter(
      (prop) =>
        typeof OriginalDate[prop] === 'function' &&
        prop !== 'now' &&
        prop !== 'call' &&
        prop !== 'apply' &&
        prop !== 'bind'
    )
    .forEach((prop) => {
      global.Date[prop] = OriginalDate[prop];
    });

  // 現在時刻を返す関数のモック
  global.Date.now = jest.fn(() => mockDate.getTime());

  // requestIdとtraceIdの生成をモック (より安定したID生成に変更)
  let reqCounter = 0;
  let traceCounter = 0;
  global.generateRequestId = jest.fn(
    () => `req-${mockDate.getTime()}-${++reqCounter}`
  );
  global.generateTraceId = jest.fn(
    () => `trace-${mockDate.getTime()}-${++traceCounter}`
  );
}

/**
 * 共通のモック依存関係オブジェクトを作成
 * @returns {Object} モック依存関係オブジェクト { logger, eventEmitter, errorHandler, storageService, validator, traceIdGenerator, requestIdGenerator, ... }
 */
function createMockDependencies() {
  const mockLogger = createMockLogger();
  const mockEventEmitter = createMockEventEmitter();
  const mockErrorHandler = createMockErrorHandler();
  const mockStorageService = createMockStorageService(); // 作成した関数を使用
  const mockValidator = createMockValidator(); // 作成した関数を使用

  // 必要に応じて他の共通モックを追加
  const mockGitService = {
    getCurrentCommitHash: jest.fn(),
    getCommitsBetween: jest.fn(),
    getChangedFilesInCommit: jest.fn(),
    getCommitDiffStats: jest.fn(),
    getCommitHistory: jest.fn(),
    getFileHistory: jest.fn(),
    getCommitDetails: jest.fn(),
    stageFiles: jest.fn(),
    createCommit: jest.fn(),
    getBranches: jest.fn(),
    getCurrentBranch: jest.fn(),
    extractTaskIdsFromCommitMessage: jest.fn(),
  };
  // Add mocks for other managers and adapters needed by IntegrationManager
  const mockTaskManagerAdapter = {
    createTask: jest.fn(),
    updateTaskStatus: jest.fn(),
    getAllTasks: jest.fn(),
    getTaskById: jest.fn(),
    updateTaskProgress: jest.fn(),
    deleteTask: jest.fn(),
    addGitCommitToTask: jest.fn(),
    importTask: jest.fn(),
    updateTask: jest.fn(),
  };
  const mockSessionManagerAdapter = {
    createNewSession: jest.fn(),
    getLatestSession: jest.fn(),
    addTaskToSession: jest.fn(), // このメソッドは使われていない可能性
    getSession: jest.fn(),
    endSession: jest.fn(),
    getAllSessions: jest.fn(),
    importSession: jest.fn(),
  };
  const mockFeedbackManagerAdapter = {
    collectFeedback: jest.fn(), // collectTestResults だった？ 要確認
    collectTestResults: jest.fn(),
    getPendingFeedback: jest.fn(),
    updateFeedbackStatus: jest.fn(),
    getFeedbackByTaskId: jest.fn(),
    generateFeedbackMarkdown: jest.fn(),
    prioritizeFeedback: jest.fn(),
    linkFeedbackToGitCommit: jest.fn(),
    linkFeedbackToSession: jest.fn(),
    integrateFeedbackWithTask: jest.fn(),
    integrateFeedbackWithSession: jest.fn(),
  };
  const mockStateManager = {
    // stateManagerAdapter ではなく stateManager? 要確認
    setState: jest.fn(),
    getState: jest.fn(),
    getCurrentState: jest.fn(),
    transitionTo: jest.fn(),
    canTransitionTo: jest.fn(),
    getStateHistory: jest.fn(),
    getPreviousState: jest.fn(),
  };
  const mockStateManagerAdapter = mockStateManager; // エイリアスとして追加

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
    clear: jest.fn(),
    invalidate: jest.fn(),
    getStats: jest.fn(),
  };
  const mockLockManager = {
    acquireLock: jest.fn(),
    releaseLock: jest.fn(),
    getLockStatus: jest.fn(),
  };
  const mockPluginManager = {
    loadPlugins: jest.fn(),
    executeHook: jest.fn(),
    registerPlugin: jest.fn(),
    unregisterPlugin: jest.fn(),
    invokePlugin: jest.fn(),
  };
  const mockHandlebars = {
    compile: jest.fn().mockReturnValue(jest.fn()),
    registerHelper: jest.fn(),
  }; // Handlebars mock
  // IntegrationManagerAdapter のモックも追加
  const mockIntegrationManagerAdapter = {
    initializeWorkflow: jest.fn(),
    startSession: jest.fn(),
    endSession: jest.fn(),
    createTask: jest.fn(),
    updateTaskStatus: jest.fn(),
    collectFeedback: jest.fn(),
    resolveFeedback: jest.fn(),
    syncComponents: jest.fn(),
    generateReport: jest.fn(),
    getWorkflowStatus: jest.fn(), // これは直接使われていない可能性
  };

  return {
    logger: mockLogger,
    eventEmitter: mockEventEmitter,
    errorHandler: mockErrorHandler,
    storageService: mockStorageService,
    gitService: mockGitService,
    // Add other mocks to the returned object
    taskManagerAdapter: mockTaskManagerAdapter,
    sessionManagerAdapter: mockSessionManagerAdapter,
    feedbackManagerAdapter: mockFeedbackManagerAdapter,
    stateManager: mockStateManager, // or stateManagerAdapter
    stateManagerAdapter: mockStateManagerAdapter,
    cacheManager: mockCacheManager,
    lockManager: mockLockManager,
    pluginManager: mockPluginManager,
    validator: mockValidator,
    handlebars: mockHandlebars,
    integrationManagerAdapter: mockIntegrationManagerAdapter, // 追加
    // ID生成関数のモックも追加
    traceIdGenerator: jest.fn(() => `mock-trace-${Date.now()}`),
    requestIdGenerator: jest.fn(() => `mock-req-${Date.now()}`),
  };
}

module.exports = {
  createMockLogger,
  createMockEventEmitter,
  createMockErrorHandler,
  createMockStorageService, // エクスポート追加
  createMockValidator, // エクスポート追加
  mockTimestamp,
  createMockDependencies,
};

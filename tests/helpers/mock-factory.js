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
  };
}

/**
 * モックイベントエミッターを作成
 * @returns {Object} モックイベントエミッター
 */
function createMockEventEmitter() {
  return {
    emit: jest.fn(),
    emitStandardized: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn(),
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
 * 時間をモック
 * @param {string} isoString - ISO形式の時間文字列
 */
function mockTimestamp(isoString) {
  // Dateのモック
  const mockDate = new Date(isoString);
  global.Date = class extends Date {
    constructor() {
      return mockDate;
    }

    static now() {
      return mockDate.getTime();
    }
  };

  // 現在時刻を返す関数のモック
  global.Date.now = jest.fn(() => mockDate.getTime());

  // requestIdとtraceIdの生成をモック
  global.generateRequestId = jest.fn(
    () =>
      `req-${mockDate.getTime()}-${Math.random().toString(36).substring(2, 10)}`
  );
  global.generateTraceId = jest.fn(
    () =>
      `trace-${mockDate.getTime()}-${Math.random().toString(36).substring(2, 10)}`
  );
}

/**
 * 共通のモック依存関係オブジェクトを作成
 * @returns {Object} モック依存関係オブジェクト { logger, eventEmitter, errorHandler }
 */
function createMockDependencies() {
  const mockLogger = createMockLogger();
  const mockEventEmitter = createMockEventEmitter();
  const mockErrorHandler = createMockErrorHandler();

  // 必要に応じて他の共通モックを追加
  // 例: const mockStorageService = { ... };

  return {
    logger: mockLogger,
    eventEmitter: mockEventEmitter,
    errorHandler: mockErrorHandler,
    // storageService: mockStorageService,
  };
}

module.exports = {
  createMockLogger,
  createMockEventEmitter,
  createMockErrorHandler,
  mockTimestamp,
  createMockDependencies,
};

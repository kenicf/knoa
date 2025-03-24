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
    debug: jest.fn()
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
    removeAllListeners: jest.fn()
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
    getCurrentCommitHash: '',
    getCurrentBranch: '',
    extractTaskIdsFromCommitMessage: [],
    getCommitsBetween: [],
    getChangedFilesInCommit: [],
    getCommitDiffStats: { files: [], lines_added: 0, lines_deleted: 0 },
    readJSON: null,
    writeJSON: false,
    readText: null,
    writeText: false,
    fileExists: false,
    listFiles: [],
    ...defaultReturnValues
  };
  
  // モックハンドラー関数
  const mockHandle = jest.fn().mockImplementation((error, component, operation, context) => {
    // 操作に応じたデフォルト値を返す
    return defaults[operation] !== undefined ? defaults[operation] : null;
  });
  
  return {
    handle: mockHandle,
    register: jest.fn(),
    unregister: jest.fn()
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
  global.generateRequestId = jest.fn(() => `req-${mockDate.getTime()}-${Math.random().toString(36).substring(2, 10)}`);
  global.generateTraceId = jest.fn(() => `trace-${mockDate.getTime()}-${Math.random().toString(36).substring(2, 10)}`);
}

module.exports = {
  createMockLogger,
  createMockEventEmitter,
  createMockErrorHandler,
  mockTimestamp
};
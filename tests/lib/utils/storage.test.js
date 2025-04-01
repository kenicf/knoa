/**
 * ストレージサービスのテスト
 */

const StorageService = require('../../../src/lib/utils/storage');
const { StorageError } = require('../../../src/lib/utils/errors');
const {
  createMockLogger,
  createMockEventEmitter,
  createMockErrorHandler,
  mockTimestamp,
} = require('../../helpers/mock-factory');
const {
  expectStandardizedEventEmitted,
} = require('../../helpers/test-helpers');
const path = require('path'); // path モジュールを直接使用

// fs モジュールをモック
jest.mock('fs');
// path モジュールをモック (join, dirname, normalize の呼び出しをスパイできるように)
jest.mock('path', () => {
  const originalPath = jest.requireActual('path');
  return {
    ...originalPath,
    join: jest.fn((...args) => originalPath.join(...args)),
    dirname: jest.fn((p) => originalPath.dirname(p)),
    normalize: jest.fn((p) => originalPath.normalize(p)),
  };
});

describe('StorageService', () => {
  let storageService;
  let mockLogger;
  let mockEventEmitter;
  let mockErrorHandler;
  let fsMock;

  const BASE_PATH = '/test/base/path'; // Use POSIX style for consistency in tests
  const TEST_DIR = 'test-dir';
  const TEST_FILE_JSON = 'test-file.json';
  const TEST_FILE_TXT = 'test-file.txt';
  const TEST_FILE_BIN = 'test-file.bin';
  // Use path.join for expected native paths, even if mocked, to ensure test logic is correct
  const NATIVE_TEST_DIR_PATH = path.join(BASE_PATH, TEST_DIR);
  const NATIVE_JSON_PATH = path.join(NATIVE_TEST_DIR_PATH, TEST_FILE_JSON);
  const NATIVE_TXT_PATH = path.join(NATIVE_TEST_DIR_PATH, TEST_FILE_TXT);
  const NATIVE_BIN_PATH = path.join(NATIVE_TEST_DIR_PATH, TEST_FILE_BIN);
  const MOCK_TIMESTAMP_ISO = '2025-03-24T00:00:00.000Z';
  const MOCK_TIMESTAMP_MS = new Date(MOCK_TIMESTAMP_ISO).getTime();
  const MOCK_RANDOM = 0.123456789;
  // Generate expected IDs based on mocked time and random - These will be generated per test now
  // const EXPECTED_TRACE_ID = `trace-${MOCK_TIMESTAMP_MS}-${MOCK_RANDOM.toString(36).substr(2, 9)}`;
  // const EXPECTED_REQUEST_ID = `req-${MOCK_TIMESTAMP_MS}-${MOCK_RANDOM.toString(36).substr(2, 9)}`;

  beforeEach(() => {
    // Arrange (Common setup)
    jest.clearAllMocks();

    fsMock = require('fs');
    // Reset path mock functions before each test
    require('path').join.mockClear();
    require('path').dirname.mockClear();
    require('path').normalize.mockClear();

    // fs モックのデフォルト実装
    fsMock.existsSync.mockReturnValue(false);
    fsMock.readFileSync.mockReturnValue('{}');
    fsMock.writeFileSync.mockImplementation(() => {});
    fsMock.mkdirSync.mockImplementation(() => {});
    fsMock.unlinkSync.mockImplementation(() => {});
    fsMock.rmdirSync.mockImplementation(() => {}); // Keep for older Node versions if needed
    fsMock.copyFileSync.mockImplementation(() => {});
    fsMock.rmSync.mockImplementation(() => {}); // Preferred method for directory removal
    fsMock.lstatSync.mockReturnValue({ isDirectory: () => false }); // Default to file
    fsMock.readdirSync.mockReturnValue([]);

    // 時間関連のモック
    mockTimestamp(MOCK_TIMESTAMP_ISO);
    jest.spyOn(Date, 'now').mockReturnValue(MOCK_TIMESTAMP_MS);
    jest.spyOn(Math, 'random').mockReturnValue(MOCK_RANDOM);

    // 依存関係のモック
    mockLogger = createMockLogger();
    mockEventEmitter = createMockEventEmitter();
    mockErrorHandler = createMockErrorHandler({
      // Define default return values for operations handled by errorHandler
      defaultReturnValues: {
        readJSON: null,
        writeJSON: false,
        readText: null,
        writeText: false,
        writeFile: false,
        updateJSON: null,
        deleteFile: false,
        deleteDirectory: false,
        copyFile: false,
        listFiles: [],
        fileExists: false,
        ensureDirectoryExists: false,
        '_getNativeFilePath (mkdir)': undefined,
        '_ensureDirectoryExists (mkdir)': undefined,
      },
    });

    // StorageService のインスタンス作成
    storageService = new StorageService({
      basePath: BASE_PATH,
      logger: mockLogger,
      eventEmitter: mockEventEmitter,
      errorHandler: mockErrorHandler,
      // Provide mocked generators for predictable IDs in tests
      // Use the mock factory's generators for consistency if needed elsewhere,
      // but individual tests will now get IDs from the service instance.
      traceIdGenerator: mockEventEmitter._traceIdGenerator,
      requestIdGenerator: mockEventEmitter._requestIdGenerator,
    });
  });

  afterEach(() => {
    // Clean up mocks
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    test('should throw error if logger is not provided', () => {
      // Arrange & Act & Assert
      expect(() => new StorageService({ basePath: BASE_PATH })).toThrow(
        'Logger instance is required'
      );
    });

    test('should initialize with provided options and default ID generators', () => {
      // Arrange
      const options = {
        basePath: BASE_PATH,
        logger: mockLogger,
        eventEmitter: mockEventEmitter,
        errorHandler: mockErrorHandler,
        // ID generators are NOT provided here
      };
      // Act
      const instance = new StorageService(options);

      // Assert
      expect(instance.basePath).toBe(BASE_PATH);
      expect(instance.logger).toBe(mockLogger);
      expect(instance.eventEmitter).toBe(mockEventEmitter);
      expect(instance.errorHandler).toBe(mockErrorHandler);
      // Check if default generators are assigned and are functions
      expect(instance._traceIdGenerator).toBeInstanceOf(Function);
      expect(instance._requestIdGenerator).toBeInstanceOf(Function);
      // Verify they are the default ones by checking the format
      expect(instance._traceIdGenerator()).toMatch(/^trace-\d+-\w+$/);
      expect(instance._requestIdGenerator()).toMatch(/^req-\d+-\w+$/);
    });

    test('should initialize with custom ID generators', () => {
      // Arrange
      const customTraceIdGen = jest.fn(() => 'custom-trace-id');
      const customRequestIdGen = jest.fn(() => 'custom-req-id');
      const options = {
        basePath: BASE_PATH,
        logger: mockLogger,
        traceIdGenerator: customTraceIdGen,
        requestIdGenerator: customRequestIdGen,
      };
      // Act
      const instance = new StorageService(options);
      // Assert
      expect(instance._traceIdGenerator).toBe(customTraceIdGen);
      expect(instance._requestIdGenerator).toBe(customRequestIdGen);
    });

    test('should use process.cwd() if basePath is not provided', () => {
      // Arrange & Act
      const defaultService = new StorageService({ logger: mockLogger });
      // Assert
      expect(defaultService.basePath).toBe(process.cwd());
    });
  });

  describe('_getNativeFilePath', () => {
    test('should return correct native path if directory exists', () => {
      // Arrange
      fsMock.existsSync.mockReturnValue(true); // Simulate directory exists

      // Act
      const result = storageService._getNativeFilePath(
        TEST_DIR,
        TEST_FILE_JSON
      );

      // Assert
      expect(result).toBe(NATIVE_JSON_PATH);
      expect(require('path').join).toHaveBeenCalledWith(
        BASE_PATH,
        TEST_DIR,
        TEST_FILE_JSON
      );
      expect(require('path').dirname).toHaveBeenCalledWith(NATIVE_JSON_PATH);
      expect(fsMock.existsSync).toHaveBeenCalledWith(NATIVE_TEST_DIR_PATH);
      expect(fsMock.mkdirSync).not.toHaveBeenCalled();
    });

    test('should create directory and return path if directory does not exist', () => {
      // Arrange
      fsMock.existsSync.mockReturnValue(false); // Simulate directory does not exist
      // const expectedTraceId = storageService._traceIdGenerator(); // 削除
      // const expectedRequestId = storageService._requestIdGenerator(); // 削除

      // Act
      const result = storageService._getNativeFilePath(
        TEST_DIR,
        TEST_FILE_JSON
      );

      // Assert
      expect(result).toBe(NATIVE_JSON_PATH);
      expect(fsMock.existsSync).toHaveBeenCalledWith(NATIVE_TEST_DIR_PATH);
      expect(fsMock.mkdirSync).toHaveBeenCalledWith(NATIVE_TEST_DIR_PATH, {
        recursive: true,
      });
      expect(require('path').normalize).toHaveBeenCalledWith(
        NATIVE_TEST_DIR_PATH
      ); // Check normalize call
      // Re-add traceId and requestId expectations
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'storage',
        'directory_created',
        {
          path: NATIVE_TEST_DIR_PATH, // Expect normalized path
          timestamp: MOCK_TIMESTAMP_ISO,
          traceId: expect.any(String), // expect.any(String) に変更
          requestId: expect.any(String), // expect.any(String) に変更
        }
      );
    });

    test('should call errorHandler if directory creation fails', () => {
      // Arrange
      fsMock.existsSync.mockReturnValue(false);
      const error = new Error('mkdir failed');
      fsMock.mkdirSync.mockImplementation(() => {
        throw error;
      });
      const expectedDirPath = path.join(BASE_PATH, 'error-dir');

      // Act
      const result = storageService._getNativeFilePath(
        'error-dir',
        'file.json'
      );

      // Assert
      expect(result).toBe(path.join(expectedDirPath, 'file.json')); // Still returns the path
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.any(StorageError),
        'StorageService',
        '_getNativeFilePath (mkdir)',
        expect.objectContaining({ directory: expectedDirPath })
      );
      expect(mockEventEmitter.emitStandardized).not.toHaveBeenCalledWith(
        // No directory_created event
        'storage',
        'directory_created',
        expect.any(Object)
      );
    });
  });

  describe('getFilePath (deprecated)', () => {
    test('should return POSIX path even on Windows', () => {
      // Arrange
      const nativeWinPath = `c:\\test\\base\\path\\${TEST_DIR}\\${TEST_FILE_JSON}`;
      const expectedPosixPath = `c:/test/base/path/${TEST_DIR}/${TEST_FILE_JSON}`;
      jest
        .spyOn(storageService, '_getNativeFilePath')
        .mockReturnValue(nativeWinPath);

      // Act
      const result = storageService.getFilePath(TEST_DIR, TEST_FILE_JSON);

      // Assert
      expect(result).toBe(expectedPosixPath);
      expect(storageService._getNativeFilePath).toHaveBeenCalledWith(
        TEST_DIR,
        TEST_FILE_JSON
      );
    });
    test('should return POSIX path as is on POSIX systems', () => {
      // Arrange
      const nativePosixPath = `${BASE_PATH}/${TEST_DIR}/${TEST_FILE_JSON}`; // Already POSIX
      jest
        .spyOn(storageService, '_getNativeFilePath')
        .mockReturnValue(nativePosixPath);

      // Act
      const result = storageService.getFilePath(TEST_DIR, TEST_FILE_JSON);

      // Assert
      expect(result).toBe(nativePosixPath); // Should remain unchanged
    });
  });

  describe('readJSON', () => {
    test('should return JSON object if file exists and is valid JSON', () => {
      // Arrange
      const jsonContent = '{"key": "value", "count": 1}';
      const expectedData = { key: 'value', count: 1 };
      fsMock.existsSync.mockReturnValue(true);
      fsMock.readFileSync.mockReturnValue(jsonContent);
      // const expectedTraceId = storageService._traceIdGenerator(); // 削除
      // const expectedRequestId = storageService._requestIdGenerator(); // 削除

      // Act
      const result = storageService.readJSON(TEST_DIR, TEST_FILE_JSON);

      // Assert
      expect(result).toEqual(expectedData);
      expect(fsMock.existsSync).toHaveBeenCalledWith(NATIVE_JSON_PATH);
      expect(fsMock.readFileSync).toHaveBeenCalledWith(
        NATIVE_JSON_PATH,
        'utf8'
      );
      // Re-add traceId and requestId expectations
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'storage',
        'file_read_before',
        {
          path: NATIVE_JSON_PATH, // ★★★ 修正 ★★★
          type: 'json',
          timestamp: MOCK_TIMESTAMP_ISO,
          traceId: expect.any(String), // expect.any(String) に変更
          requestId: expect.any(String), // expect.any(String) に変更
        }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'storage',
        'file_read_after',
        {
          path: NATIVE_JSON_PATH, // ★★★ 修正 ★★★
          type: 'json',
          success: true,
          timestamp: MOCK_TIMESTAMP_ISO,
          traceId: expect.any(String), // expect.any(String) に変更
          requestId: expect.any(String), // expect.any(String) に変更
        }
      );
    });

    test('should return null and emit file_not_found if file does not exist', () => {
      // Arrange
      fsMock.existsSync.mockReturnValue(false);
      // const expectedTraceId = storageService._traceIdGenerator(); // 削除
      // const expectedRequestId = storageService._requestIdGenerator(); // 削除

      // Act
      const result = storageService.readJSON(TEST_DIR, TEST_FILE_JSON);

      // Assert
      expect(result).toBeNull();
      expect(fsMock.existsSync).toHaveBeenCalledWith(NATIVE_JSON_PATH);
      expect(fsMock.readFileSync).not.toHaveBeenCalled();
      // ★★★ 修正: 期待するイベントデータの形式を修正 ★★★
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'storage',
        'file_read_before',
        {
          path: NATIVE_JSON_PATH,
          type: 'json',
          timestamp: MOCK_TIMESTAMP_ISO,
          traceId: expect.any(String),
          requestId: expect.any(String),
        }
      );
      // Re-add traceId and requestId expectations
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'storage',
        'file_not_found',
        {
          path: NATIVE_JSON_PATH, // ★★★ 修正 ★★★
          type: 'json',
          timestamp: MOCK_TIMESTAMP_ISO,
          traceId: expect.any(String), // expect.any(String) に変更
          requestId: expect.any(String), // expect.any(String) に変更
        }
      );
      expect(mockErrorHandler.handle).not.toHaveBeenCalled(); // Should not call error handler for not found
    });

    test('should call errorHandler and return null if JSON parsing fails', () => {
      // Arrange
      const invalidJson = '{invalid json';
      fsMock.existsSync.mockReturnValue(true);
      fsMock.readFileSync.mockReturnValue(invalidJson);
      // const expectedTraceId = storageService._traceIdGenerator(); // 削除
      // const expectedRequestId = storageService._requestIdGenerator(); // 削除

      // Act
      const result = storageService.readJSON(TEST_DIR, TEST_FILE_JSON);

      // Assert
      expect(result).toBeNull(); // Default return from mockErrorHandler
      expect(fsMock.readFileSync).toHaveBeenCalledWith(
        NATIVE_JSON_PATH,
        'utf8'
      );
      // Re-add traceId and requestId expectations
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'storage',
        'file_read_after',
        {
          path: NATIVE_JSON_PATH, // ★★★ 修正 ★★★
          type: 'json',
          success: false,
          error: expect.any(String),
          timestamp: MOCK_TIMESTAMP_ISO,
          traceId: expect.any(String), // expect.any(String) に変更
          requestId: expect.any(String), // expect.any(String) に変更
        }
      );
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.any(StorageError),
        'StorageService',
        'readJSON',
        expect.objectContaining({
          directory: TEST_DIR,
          filename: TEST_FILE_JSON,
        })
      );
    });

    test('should call errorHandler and return null if readFileSync throws', () => {
      // Arrange
      const error = new Error('Read error');
      fsMock.existsSync.mockReturnValue(true);
      fsMock.readFileSync.mockImplementation(() => {
        throw error;
      });
      // const expectedTraceId = storageService._traceIdGenerator(); // 削除
      // const expectedRequestId = storageService._requestIdGenerator(); // 削除

      // Act
      const result = storageService.readJSON(TEST_DIR, TEST_FILE_JSON);

      // Assert
      expect(result).toBeNull();
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.any(StorageError),
        'StorageService',
        'readJSON',
        expect.objectContaining({
          directory: TEST_DIR,
          filename: TEST_FILE_JSON,
        })
      );
      // Re-add traceId and requestId expectations
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'storage',
        'file_read_after',
        {
          path: NATIVE_JSON_PATH, // ★★★ 修正 ★★★
          type: 'json',
          success: false,
          error: error.message,
          timestamp: MOCK_TIMESTAMP_ISO,
          traceId: expect.any(String), // expect.any(String) に変更
          requestId: expect.any(String), // expect.any(String) に変更
        }
      );
    });
  });

  describe('writeJSON', () => {
    test('should write JSON file successfully and return true', () => {
      // Arrange
      const data = { key: 'value', nested: { num: 1 } };
      const expectedJsonString = JSON.stringify(data, null, 2);
      // const expectedTraceId = storageService._traceIdGenerator(); // 削除
      // const expectedRequestId = storageService._requestIdGenerator(); // 削除

      // Act
      const result = storageService.writeJSON(TEST_DIR, TEST_FILE_JSON, data);

      // Assert
      expect(result).toBe(true);
      expect(fsMock.writeFileSync).toHaveBeenCalledWith(
        NATIVE_JSON_PATH,
        expectedJsonString,
        'utf8'
      );
      // Re-add traceId and requestId expectations
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'storage',
        'file_write_before',
        {
          path: NATIVE_JSON_PATH, // ★★★ 修正 ★★★
          type: 'json',
          timestamp: MOCK_TIMESTAMP_ISO,
          traceId: expect.any(String), // expect.any(String) に変更
          requestId: expect.any(String), // expect.any(String) に変更
        }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'storage',
        'file_write_after',
        {
          path: NATIVE_JSON_PATH, // ★★★ 修正 ★★★
          type: 'json',
          success: true,
          timestamp: MOCK_TIMESTAMP_ISO,
          traceId: expect.any(String), // expect.any(String) に変更
          requestId: expect.any(String), // expect.any(String) に変更
        }
      );
    });

    test('should call errorHandler and return false if writeFileSync throws', () => {
      // Arrange
      const data = { key: 'value' };
      const error = new Error('Write error');
      fsMock.writeFileSync.mockImplementation(() => {
        throw error;
      });
      // const expectedTraceId = storageService._traceIdGenerator(); // 削除
      // const expectedRequestId = storageService._requestIdGenerator(); // 削除

      // Act
      const result = storageService.writeJSON(TEST_DIR, TEST_FILE_JSON, data);

      // Assert
      expect(result).toBe(false); // Default return from mockErrorHandler
      expect(fsMock.writeFileSync).toHaveBeenCalled();
      // Re-add traceId and requestId expectations
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'storage',
        'file_write_error', // ★★★ 修正 ★★★
        {
          path: NATIVE_JSON_PATH, // ★★★ 修正 ★★★
          type: 'json',
          error: error.message,
          timestamp: MOCK_TIMESTAMP_ISO,
          traceId: expect.any(String), // expect.any(String) に変更
          requestId: expect.any(String), // expect.any(String) に変更
        }
      );
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.any(StorageError),
        'StorageService',
        'writeJSON',
        expect.objectContaining({
          directory: TEST_DIR,
          filename: TEST_FILE_JSON,
        })
      );
    });
  });

  // --- readText, writeText, writeFile, updateJSON ---
  // Similar structure to readJSON/writeJSON, adding AAA comments and specific event data checks

  describe('readText', () => {
    test('should return text content if file exists', async () => {
      // Arrange
      const textContent = 'This is a text file.';
      fsMock.existsSync.mockReturnValue(true);
      fsMock.readFileSync.mockReturnValue(textContent);
      // const expectedTraceId = storageService._traceIdGenerator(); // 削除
      // const expectedRequestId = storageService._requestIdGenerator(); // 削除

      // Act
      const result = storageService.readText(TEST_DIR, TEST_FILE_TXT);

      // Assert
      expect(result).toBe(textContent);
      expect(fsMock.readFileSync).toHaveBeenCalledWith(NATIVE_TXT_PATH, 'utf8');
      // Re-add traceId and requestId expectations
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'storage',
        'file_read_before',
        {
          path: NATIVE_TXT_PATH, // ★★★ 修正 ★★★
          type: 'text',
          timestamp: MOCK_TIMESTAMP_ISO,
          traceId: expect.any(String), // expect.any(String) に変更
          requestId: expect.any(String), // expect.any(String) に変更
        }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'storage',
        'file_read_after',
        {
          path: NATIVE_TXT_PATH, // ★★★ 修正 ★★★
          type: 'text',
          success: true,
          timestamp: MOCK_TIMESTAMP_ISO,
          traceId: expect.any(String), // expect.any(String) に変更
          requestId: expect.any(String), // expect.any(String) に変更
        }
      );
    });

    test('should return null and emit file_not_found if file does not exist', async () => {
      // Arrange
      fsMock.existsSync.mockReturnValue(false);
      // const expectedTraceId = storageService._traceIdGenerator(); // 削除
      // const expectedRequestId = storageService._requestIdGenerator(); // 削除
      // Act
      const result = storageService.readText(TEST_DIR, TEST_FILE_TXT);
      // Assert
      expect(result).toBeNull();
      expect(fsMock.readFileSync).not.toHaveBeenCalled();
      // Re-add traceId and requestId expectations
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'storage',
        'file_not_found',
        {
          path: NATIVE_TXT_PATH, // ★★★ 修正 ★★★
          type: 'text',
          timestamp: MOCK_TIMESTAMP_ISO,
          traceId: expect.any(String), // expect.any(String) に変更
          requestId: expect.any(String), // expect.any(String) に変更
        }
      );
    });

    test('should call errorHandler and return null if readFileSync throws', async () => {
      // Arrange
      const error = new Error('Read error');
      fsMock.existsSync.mockReturnValue(true);
      fsMock.readFileSync.mockImplementation(() => {
        throw error;
      });
      // const expectedTraceId = storageService._traceIdGenerator(); // 削除
      // const expectedRequestId = storageService._requestIdGenerator(); // 削除

      // Act
      const result = storageService.readText(TEST_DIR, TEST_FILE_TXT);

      // Assert
      expect(result).toBeNull();
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.any(StorageError),
        'StorageService',
        'readText',
        expect.objectContaining({
          directory: TEST_DIR,
          filename: TEST_FILE_TXT,
        })
      );
      // Re-add traceId and requestId expectations
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'storage',
        'file_read_after',
        {
          path: NATIVE_TXT_PATH, // ★★★ 修正 ★★★
          type: 'text',
          success: false,
          error: error.message,
          timestamp: MOCK_TIMESTAMP_ISO,
          traceId: expect.any(String), // expect.any(String) に変更
          requestId: expect.any(String), // expect.any(String) に変更
        }
      );
    });
  });

  describe('writeText', () => {
    test('should write text file successfully and return true', async () => {
      // Arrange
      const content = 'テキスト内容';
      // const expectedTraceId = storageService._traceIdGenerator(); // 削除
      // const expectedRequestId = storageService._requestIdGenerator(); // 削除
      // Act
      const result = storageService.writeText(TEST_DIR, TEST_FILE_TXT, content);
      // Assert
      expect(result).toBe(true);
      expect(fsMock.writeFileSync).toHaveBeenCalledWith(
        NATIVE_TXT_PATH,
        content,
        'utf8'
      );
      // Re-add traceId and requestId expectations
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'storage',
        'file_write_before',
        {
          path: NATIVE_TXT_PATH, // ★★★ 修正 ★★★
          type: 'text',
          timestamp: MOCK_TIMESTAMP_ISO,
          traceId: expect.any(String), // expect.any(String) に変更
          requestId: expect.any(String), // expect.any(String) に変更
        }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'storage',
        'file_write_after',
        {
          path: NATIVE_TXT_PATH, // ★★★ 修正 ★★★
          type: 'text',
          success: true,
          timestamp: MOCK_TIMESTAMP_ISO,
          traceId: expect.any(String), // expect.any(String) に変更
          requestId: expect.any(String), // expect.any(String) に変更
        }
      );
    });

    test('should call errorHandler and return false if writeFileSync throws', async () => {
      // Arrange
      const content = 'テキスト内容';
      const error = new Error('Write error');
      fsMock.writeFileSync.mockImplementation(() => {
        throw error;
      });
      // const expectedTraceId = storageService._traceIdGenerator(); // 削除
      // const expectedRequestId = storageService._requestIdGenerator(); // 削除

      // Act
      const result = storageService.writeText(TEST_DIR, TEST_FILE_TXT, content);

      // Assert
      expect(result).toBe(false);
      expect(fsMock.writeFileSync).toHaveBeenCalled();
      // Re-add traceId and requestId expectations
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'storage',
        'file_write_error', // ★★★ 修正 ★★★
        {
          path: NATIVE_TXT_PATH, // ★★★ 修正 ★★★
          type: 'text',
          error: error.message,
          timestamp: MOCK_TIMESTAMP_ISO,
          traceId: expect.any(String), // expect.any(String) に変更
          requestId: expect.any(String), // expect.any(String) に変更
        }
      );
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.any(StorageError),
        'StorageService',
        'writeText',
        expect.objectContaining({
          directory: TEST_DIR,
          filename: TEST_FILE_TXT,
        })
      );
    });
  });

  describe('writeFile', () => {
    test('should write binary file successfully and return true', async () => {
      // Arrange
      const content = Buffer.from('バイナリデータ');
      // const expectedTraceId = storageService._traceIdGenerator(); // 削除
      // const expectedRequestId = storageService._requestIdGenerator(); // 削除
      // Act
      const result = storageService.writeFile(TEST_DIR, TEST_FILE_BIN, content);
      // Assert
      expect(result).toBe(true);
      expect(fsMock.writeFileSync).toHaveBeenCalledWith(
        NATIVE_BIN_PATH,
        content
      );
      // Re-add traceId and requestId expectations
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'storage',
        'file_write_before',
        {
          path: NATIVE_BIN_PATH, // ★★★ 修正 ★★★
          timestamp: MOCK_TIMESTAMP_ISO,
          traceId: expect.any(String), // expect.any(String) に変更
          requestId: expect.any(String), // expect.any(String) に変更
        }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'storage',
        'file_write_after',
        {
          path: NATIVE_BIN_PATH, // ★★★ 修正 ★★★
          success: true,
          timestamp: MOCK_TIMESTAMP_ISO,
          traceId: expect.any(String), // expect.any(String) に変更
          requestId: expect.any(String), // expect.any(String) に変更
        }
      );
    });

    test('should call errorHandler and return false if writeFileSync throws', async () => {
      // Arrange
      const content = Buffer.from('バイナリデータ');
      const error = new Error('Write error');
      fsMock.writeFileSync.mockImplementation(() => {
        throw error;
      });
      // const expectedTraceId = storageService._traceIdGenerator(); // 削除
      // const expectedRequestId = storageService._requestIdGenerator(); // 削除

      // Act
      const result = storageService.writeFile(TEST_DIR, TEST_FILE_BIN, content);

      // Assert
      expect(result).toBe(false);
      expect(fsMock.writeFileSync).toHaveBeenCalled();
      // Re-add traceId and requestId expectations
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'storage',
        'file_write_error', // ★★★ 修正 ★★★
        {
          path: NATIVE_BIN_PATH, // ★★★ 修正 ★★★
          error: error.message,
          timestamp: MOCK_TIMESTAMP_ISO,
          traceId: expect.any(String), // expect.any(String) に変更
          requestId: expect.any(String), // expect.any(String) に変更
        }
      );
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.any(StorageError),
        'StorageService',
        'writeFile',
        expect.objectContaining({
          directory: TEST_DIR,
          filename: TEST_FILE_BIN,
        })
      );
    });
  });

  describe('updateJSON', () => {
    test('should update existing JSON file and return true', async () => {
      // Arrange
      const initialData = { key: 'value', count: 1 };
      const updatedData = { key: 'value', count: 2 };
      fsMock.existsSync.mockReturnValue(true);
      fsMock.readFileSync.mockReturnValue(JSON.stringify(initialData));
      const updateFn = jest.fn((data) => ({ ...data, count: data.count + 1 }));
      // const expectedTraceId = storageService._traceIdGenerator(); // 削除
      // const expectedRequestId = storageService._requestIdGenerator(); // 削除

      // Act
      const result = storageService.updateJSON(
        TEST_DIR,
        TEST_FILE_JSON,
        updateFn
      );

      // Assert
      expect(result).toBe(true);
      expect(updateFn).toHaveBeenCalledWith(initialData);
      expect(fsMock.writeFileSync).toHaveBeenCalledWith(
        NATIVE_JSON_PATH,
        JSON.stringify(updatedData, null, 2),
        'utf8'
      );
      // Re-add traceId and requestId expectations
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'storage',
        'file_update_before',
        {
          path: NATIVE_JSON_PATH, // ★★★ 修正 ★★★
          type: 'json',
          timestamp: MOCK_TIMESTAMP_ISO,
          traceId: expect.any(String), // expect.any(String) に変更
          requestId: expect.any(String), // expect.any(String) に変更
        }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'storage',
        'file_update_after',
        {
          path: NATIVE_JSON_PATH, // ★★★ 修正 ★★★
          type: 'json',
          success: true,
          timestamp: MOCK_TIMESTAMP_ISO,
          traceId: expect.any(String), // expect.any(String) に変更
          requestId: expect.any(String), // expect.any(String) に変更
        }
      );
    });

    test('should create new JSON file and return null if file does not exist', async () => {
      // Arrange
      const updatedData = { key: 'new', count: 1 };
      fsMock.existsSync.mockReturnValue(false);
      const updateFn = jest.fn(() => updatedData);
      // const expectedTraceId = storageService._traceIdGenerator(); // 削除
      // const expectedRequestId = storageService._requestIdGenerator(); // 削除

      // Act
      const result = storageService.updateJSON(
        TEST_DIR,
        TEST_FILE_JSON,
        updateFn
      );

      // Assert
      expect(result).toBeNull();
      expect(updateFn).toHaveBeenCalledWith({}); // Called with empty object
      expect(fsMock.writeFileSync).toHaveBeenCalledWith(
        NATIVE_JSON_PATH,
        JSON.stringify(updatedData, null, 2),
        'utf8'
      );
      // Re-add traceId and requestId expectations
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'storage',
        'file_update_after',
        {
          path: NATIVE_JSON_PATH, // ★★★ 修正 ★★★
          type: 'json',
          success: true,
          timestamp: MOCK_TIMESTAMP_ISO,
          traceId: expect.any(String), // expect.any(String) に変更
          requestId: expect.any(String), // expect.any(String) に変更
        }
      );
    });

    test('should call errorHandler and return null if writeFileSync throws', async () => {
      // Arrange
      const error = new Error('Update error');
      fsMock.existsSync.mockReturnValue(true);
      fsMock.readFileSync.mockReturnValue('{"key":"value"}');
      fsMock.writeFileSync.mockImplementation(() => {
        throw error;
      });
      const updateFn = jest.fn((data) => data);
      // const expectedTraceId = storageService._traceIdGenerator(); // 削除
      // const expectedRequestId = storageService._requestIdGenerator(); // 削除

      // Act
      const result = storageService.updateJSON(
        TEST_DIR,
        TEST_FILE_JSON,
        updateFn
      );

      // Assert
      expect(result).toBeNull();
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.any(StorageError),
        'StorageService',
        'updateJSON',
        expect.objectContaining({
          directory: TEST_DIR,
          filename: TEST_FILE_JSON,
        })
      );
      // Re-add traceId and requestId expectations
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'storage',
        'file_update_error', // ★★★ 修正 ★★★
        {
          path: NATIVE_JSON_PATH, // ★★★ 修正 ★★★
          type: 'json',
          error: error.message,
          timestamp: MOCK_TIMESTAMP_ISO,
          traceId: expect.any(String), // expect.any(String) に変更
          requestId: expect.any(String), // expect.any(String) に変更
        }
      );
    });

    test('should call errorHandler and return null if updateFn throws', () => {
      // Arrange
      const error = new Error('Update function error');
      fsMock.existsSync.mockReturnValue(true);
      fsMock.readFileSync.mockReturnValue('{"key":"value"}');
      const updateFn = jest.fn(() => {
        throw error;
      });
      // const expectedTraceId = storageService._traceIdGenerator(); // 削除
      // const expectedRequestId = storageService._requestIdGenerator(); // 削除

      // Act
      const result = storageService.updateJSON(
        TEST_DIR,
        TEST_FILE_JSON,
        updateFn
      );

      // Assert
      expect(result).toBeNull();
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.any(StorageError),
        'StorageService',
        'updateJSON',
        expect.objectContaining({
          directory: TEST_DIR,
          filename: TEST_FILE_JSON,
        })
      );
      // Re-add traceId and requestId expectations
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'storage',
        'file_update_error', // ★★★ 修正 ★★★
        {
          path: NATIVE_JSON_PATH, // ★★★ 修正 ★★★
          type: 'json',
          error: error.message,
          timestamp: MOCK_TIMESTAMP_ISO,
          traceId: expect.any(String), // expect.any(String) に変更
          requestId: expect.any(String), // expect.any(String) に変更
        }
      );
    });
  });

  // lockFile のテストは省略

  describe('fileExists', () => {
    test('should return true if file exists', () => {
      // Arrange
      fsMock.existsSync.mockReturnValue(true);
      // Act
      const result = storageService.fileExists(TEST_DIR, TEST_FILE_TXT);
      // Assert
      expect(result).toBe(true);
      expect(fsMock.existsSync).toHaveBeenCalledWith(NATIVE_TXT_PATH);
    });

    test('should return false if file does not exist', () => {
      // Arrange
      fsMock.existsSync.mockReturnValue(false);
      // Act
      const result = storageService.fileExists(TEST_DIR, TEST_FILE_TXT);
      // Assert
      expect(result).toBe(false);
      expect(fsMock.existsSync).toHaveBeenCalledWith(NATIVE_TXT_PATH);
    });

    test('should work with a single full path argument', () => {
      // Arrange
      fsMock.existsSync.mockReturnValue(true);
      // Act
      const result = storageService.fileExists(NATIVE_TXT_PATH);
      // Assert
      expect(result).toBe(true);
      expect(fsMock.existsSync).toHaveBeenCalledWith(NATIVE_TXT_PATH);
      expect(require('path').normalize).toHaveBeenCalledWith(NATIVE_TXT_PATH); // Check normalize call
    });

    test('should call errorHandler and return false if existsSync throws', () => {
      // Arrange
      const error = new Error('existsSync error');
      fsMock.existsSync.mockImplementation(() => {
        throw error;
      });

      // Act
      const result = storageService.fileExists(TEST_DIR, TEST_FILE_TXT);

      // Assert
      expect(result).toBe(false);
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.any(StorageError),
        'StorageService',
        'fileExists',
        expect.objectContaining({
          directory: TEST_DIR,
          filename: TEST_FILE_TXT,
        })
      );
    });

    test('should log warning and return false for invalid arguments (non-string)', () => {
      // Arrange
      const invalidArg1 = 123;
      const invalidArg2 = null;

      // Act & Assert (single arg)
      expect(storageService.fileExists(invalidArg1)).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'fileExists に不正な引数が渡されました (単一引数):',
        { args: [invalidArg1] }
      );

      // Act & Assert (two args)
      expect(storageService.fileExists(invalidArg1, 'file.txt')).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'fileExists に不正な引数が渡されました (二引数):',
        { args: [invalidArg1, 'file.txt'] }
      );
      expect(storageService.fileExists('dir', invalidArg2)).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'fileExists に不正な引数が渡されました (二引数):',
        { args: ['dir', invalidArg2] }
      );
    });

    test('should log warning and return false for invalid number of arguments', () => {
      // Arrange
      const args0 = [];
      const args3 = ['dir', 'file', 'extra'];

      // Act & Assert (0 args)
      expect(storageService.fileExists(...args0)).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'fileExists に不正な数の引数が渡されました:',
        { args: args0 }
      );

      // Act & Assert (3 args)
      expect(storageService.fileExists(...args3)).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'fileExists に不正な数の引数が渡されました:',
        { args: args3 }
      );
    });
  });

  describe('listFiles', () => {
    test('should return list of files in directory', () => {
      // Arrange
      const mockFiles = ['file1.txt', 'file2.json', 'subdir'];
      fsMock.existsSync.mockReturnValue(true);
      fsMock.readdirSync.mockReturnValue(mockFiles);
      // const expectedTraceId = storageService._traceIdGenerator(); // 削除
      // const expectedRequestId = storageService._requestIdGenerator(); // 削除

      // Act
      const result = storageService.listFiles(TEST_DIR);

      // Assert
      expect(result).toEqual(mockFiles);
      expect(fsMock.readdirSync).toHaveBeenCalledWith(NATIVE_TEST_DIR_PATH);
      // Re-add traceId and requestId expectations
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'storage',
        'directory_list_before',
        {
          path: NATIVE_TEST_DIR_PATH, // ★★★ 修正 ★★★
          pattern: null,
          timestamp: MOCK_TIMESTAMP_ISO,
          traceId: expect.any(String), // expect.any(String) に変更
          requestId: expect.any(String), // expect.any(String) に変更
        }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'storage',
        'directory_list_after',
        {
          path: NATIVE_TEST_DIR_PATH, // ★★★ 修正 ★★★
          pattern: null,
          success: true,
          count: 3,
          timestamp: MOCK_TIMESTAMP_ISO,
          traceId: expect.any(String), // expect.any(String) に変更
          requestId: expect.any(String), // expect.any(String) に変更
        }
      );
    });

    test('should filter files based on pattern', () => {
      // Arrange
      const mockFiles = ['file1.txt', 'file2.json', 'image.png'];
      fsMock.existsSync.mockReturnValue(true);
      fsMock.readdirSync.mockReturnValue(mockFiles);
      const pattern = '\\.(txt|json)$'; // Regex for .txt or .json files
      // const expectedTraceId = storageService._traceIdGenerator(); // 削除
      // const expectedRequestId = storageService._requestIdGenerator(); // 削除

      // Act
      const result = storageService.listFiles(TEST_DIR, pattern);

      // Assert
      expect(result).toEqual(['file1.txt', 'file2.json']);
      // Re-add traceId and requestId expectations
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'storage',
        'directory_list_after',
        {
          path: NATIVE_TEST_DIR_PATH, // ★★★ 修正 ★★★
          pattern,
          success: true,
          count: 2,
          timestamp: MOCK_TIMESTAMP_ISO,
          traceId: expect.any(String), // expect.any(String) に変更
          requestId: expect.any(String), // expect.any(String) に変更
        }
      );
    });

    test('should return empty array if directory does not exist', () => {
      // Arrange
      fsMock.existsSync.mockReturnValue(false);
      // const expectedTraceId = storageService._traceIdGenerator(); // 削除
      // const expectedRequestId = storageService._requestIdGenerator(); // 削除
      // Act
      const result = storageService.listFiles(TEST_DIR);
      // Assert
      expect(result).toEqual([]);
      expect(fsMock.readdirSync).not.toHaveBeenCalled();
      // Re-add traceId and requestId expectations
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'storage',
        'directory_not_found',
        {
          path: NATIVE_TEST_DIR_PATH, // ★★★ 修正 ★★★
          timestamp: MOCK_TIMESTAMP_ISO,
          traceId: expect.any(String), // expect.any(String) に変更
          requestId: expect.any(String), // expect.any(String) に変更
        }
      );
    });

    test('should call errorHandler and return empty array if readdirSync throws', () => {
      // Arrange
      const error = new Error('readdir error');
      fsMock.existsSync.mockReturnValue(true);
      fsMock.readdirSync.mockImplementation(() => {
        throw error;
      });
      // const expectedTraceId = storageService._traceIdGenerator(); // 削除
      // const expectedRequestId = storageService._requestIdGenerator(); // 削除

      // Act
      const result = storageService.listFiles(TEST_DIR);

      // Assert
      expect(result).toEqual([]); // Default from mockErrorHandler
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.any(StorageError),
        'StorageService',
        'listFiles',
        expect.objectContaining({ directory: TEST_DIR, pattern: null })
      );
      // Re-add traceId and requestId expectations
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'storage',
        'directory_list_error', // ★★★ 修正 ★★★
        {
          path: NATIVE_TEST_DIR_PATH, // ★★★ 修正 ★★★
          pattern: null,
          error: error.message,
          timestamp: MOCK_TIMESTAMP_ISO,
          traceId: expect.any(String), // expect.any(String) に変更
          requestId: expect.any(String), // expect.any(String) に変更
        }
      );
    });
  });

  describe('deleteFile', () => {
    test('should delete file successfully and return true', () => {
      // Arrange
      fsMock.existsSync.mockReturnValue(true);
      // const expectedTraceId = storageService._traceIdGenerator(); // 削除
      // const expectedRequestId = storageService._requestIdGenerator(); // 削除
      // Act
      const result = storageService.deleteFile(TEST_DIR, TEST_FILE_TXT);
      // Assert
      expect(result).toBe(true);
      expect(fsMock.unlinkSync).toHaveBeenCalledWith(NATIVE_TXT_PATH);
      // Re-add traceId and requestId expectations
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'storage',
        'file_delete_before',
        {
          path: NATIVE_TXT_PATH, // ★★★ 修正 ★★★
          timestamp: MOCK_TIMESTAMP_ISO,
          traceId: expect.any(String), // expect.any(String) に変更
          requestId: expect.any(String), // expect.any(String) に変更
        }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'storage',
        'file_delete_after',
        {
          path: NATIVE_TXT_PATH, // ★★★ 修正 ★★★
          success: true,
          timestamp: MOCK_TIMESTAMP_ISO,
          traceId: expect.any(String), // expect.any(String) に変更
          requestId: expect.any(String), // expect.any(String) に変更
        }
      );
    });

    test('should return false and emit file_not_found if file does not exist', () => {
      // Arrange
      fsMock.existsSync.mockReturnValue(false);
      // const expectedTraceId = storageService._traceIdGenerator(); // 削除
      // const expectedRequestId = storageService._requestIdGenerator(); // 削除
      // Act
      const result = storageService.deleteFile(TEST_DIR, TEST_FILE_TXT);
      // Assert
      expect(result).toBe(false);
      expect(fsMock.unlinkSync).not.toHaveBeenCalled();
      // Re-add traceId and requestId expectations
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'storage',
        'file_not_found',
        {
          path: NATIVE_TXT_PATH, // ★★★ 修正 ★★★
          timestamp: MOCK_TIMESTAMP_ISO,
          traceId: expect.any(String), // expect.any(String) に変更
          requestId: expect.any(String), // expect.any(String) に変更
        }
      );
    });

    test('should call errorHandler and return false if unlinkSync throws', () => {
      // Arrange
      const error = new Error('unlink error');
      fsMock.existsSync.mockReturnValue(true);
      fsMock.unlinkSync.mockImplementation(() => {
        throw error;
      });
      // const expectedTraceId = storageService._traceIdGenerator(); // 削除
      // const expectedRequestId = storageService._requestIdGenerator(); // 削除

      // Act
      const result = storageService.deleteFile(TEST_DIR, TEST_FILE_TXT);

      // Assert
      expect(result).toBe(false);
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.any(StorageError),
        'StorageService',
        'deleteFile',
        expect.objectContaining({
          directory: TEST_DIR,
          filename: TEST_FILE_TXT,
        })
      );
      // Re-add traceId and requestId expectations
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'storage',
        'file_delete_error', // ★★★ 修正 ★★★
        {
          path: NATIVE_TXT_PATH, // ★★★ 修正 ★★★
          error: error.message,
          timestamp: MOCK_TIMESTAMP_ISO,
          traceId: expect.any(String), // expect.any(String) に変更
          requestId: expect.any(String), // expect.any(String) に変更
        }
      );
    });
  });

  describe('deleteDirectory', () => {
    test('should delete directory non-recursively successfully and return true', () => {
      // Arrange
      fsMock.existsSync.mockReturnValue(true);
      // const expectedTraceId = storageService._traceIdGenerator(); // 削除
      // const expectedRequestId = storageService._requestIdGenerator(); // 削除
      // Act
      const result = storageService.deleteDirectory(TEST_DIR); // recursive = false (default)
      // Assert
      expect(result).toBe(true);
      expect(fsMock.rmSync).toHaveBeenCalledWith(NATIVE_TEST_DIR_PATH, {
        recursive: false,
        force: false,
      });
      // Re-add traceId and requestId expectations
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'storage',
        'directory_delete_before',
        {
          path: NATIVE_TEST_DIR_PATH, // ★★★ 修正 ★★★
          recursive: false,
          timestamp: MOCK_TIMESTAMP_ISO,
          traceId: expect.any(String), // expect.any(String) に変更
          requestId: expect.any(String), // expect.any(String) に変更
        }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'storage',
        'directory_delete_after',
        {
          path: NATIVE_TEST_DIR_PATH, // ★★★ 修正 ★★★
          recursive: false,
          success: true,
          timestamp: MOCK_TIMESTAMP_ISO,
          traceId: expect.any(String), // expect.any(String) に変更
          requestId: expect.any(String), // expect.any(String) に変更
        }
      );
    });

    test('should delete directory recursively successfully and return true', () => {
      // Arrange
      fsMock.existsSync.mockReturnValue(true);
      // const expectedTraceId = storageService._traceIdGenerator(); // 削除
      // const expectedRequestId = storageService._requestIdGenerator(); // 削除
      // Act
      const result = storageService.deleteDirectory(TEST_DIR, true); // recursive = true
      // Assert
      expect(result).toBe(true);
      expect(fsMock.rmSync).toHaveBeenCalledWith(NATIVE_TEST_DIR_PATH, {
        recursive: true,
        force: true,
      });
      // Re-add traceId and requestId expectations
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'storage',
        'directory_delete_before',
        {
          path: NATIVE_TEST_DIR_PATH, // ★★★ 修正 ★★★
          recursive: true,
          timestamp: MOCK_TIMESTAMP_ISO,
          traceId: expect.any(String), // expect.any(String) に変更
          requestId: expect.any(String), // expect.any(String) に変更
        }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'storage',
        'directory_delete_after',
        {
          path: NATIVE_TEST_DIR_PATH, // ★★★ 修正 ★★★
          recursive: true,
          success: true,
          timestamp: MOCK_TIMESTAMP_ISO,
          traceId: expect.any(String), // expect.any(String) に変更
          requestId: expect.any(String), // expect.any(String) に変更
        }
      );
    });

    test('should return false and emit directory_not_found if directory does not exist', () => {
      // Arrange
      fsMock.existsSync.mockReturnValue(false);
      // const expectedTraceId = storageService._traceIdGenerator(); // 削除
      // const expectedRequestId = storageService._requestIdGenerator(); // 削除
      // Act
      const result = storageService.deleteDirectory(TEST_DIR);
      // Assert
      expect(result).toBe(false);
      expect(fsMock.rmSync).not.toHaveBeenCalled();
      // Re-add traceId and requestId expectations
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'storage',
        'directory_not_found',
        {
          path: NATIVE_TEST_DIR_PATH, // ★★★ 修正 ★★★
          timestamp: MOCK_TIMESTAMP_ISO,
          traceId: expect.any(String), // expect.any(String) に変更
          requestId: expect.any(String), // expect.any(String) に変更
        }
      );
    });

    test('should call errorHandler and return false if rmSync throws', () => {
      // Arrange
      const error = new Error('rm error');
      fsMock.existsSync.mockReturnValue(true);
      fsMock.rmSync.mockImplementation(() => {
        throw error;
      });
      // const expectedTraceId = storageService._traceIdGenerator(); // 削除
      // const expectedRequestId = storageService._requestIdGenerator(); // 削除

      // Act
      const result = storageService.deleteDirectory(TEST_DIR, true);

      // Assert
      expect(result).toBe(false);
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.any(StorageError),
        'StorageService',
        'deleteDirectory',
        expect.objectContaining({ directory: TEST_DIR, recursive: true })
      );
      // Re-add traceId and requestId expectations
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'storage',
        'directory_delete_error', // ★★★ 修正 ★★★
        {
          path: NATIVE_TEST_DIR_PATH, // ★★★ 修正 ★★★
          recursive: true,
          error: error.message,
          timestamp: MOCK_TIMESTAMP_ISO,
          traceId: expect.any(String), // expect.any(String) に変更
          requestId: expect.any(String), // expect.any(String) に変更
        }
      );
    });
  });

  describe('copyFile', () => {
    const SOURCE_DIR = 'source-dir';
    const SOURCE_FILE = 'source.txt';
    const DEST_DIR = 'dest-dir';
    const DEST_FILE = 'dest.txt';
    const NATIVE_SOURCE_PATH = path.join(BASE_PATH, SOURCE_DIR, SOURCE_FILE);
    const NATIVE_DEST_PATH = path.join(BASE_PATH, DEST_DIR, DEST_FILE);

    test('should copy file successfully and return true', () => {
      // Arrange
      // Simulate source exists, destination dir might need creation (handled by _getNativeFilePath mock side effect)
      fsMock.existsSync.mockImplementation((p) => p === NATIVE_SOURCE_PATH);
      jest
        .spyOn(storageService, '_getNativeFilePath')
        .mockReturnValueOnce(NATIVE_SOURCE_PATH) // First call for source
        .mockReturnValueOnce(NATIVE_DEST_PATH); // Second call for destination
      // const expectedTraceId = storageService._traceIdGenerator(); // 削除
      // const expectedRequestId = storageService._requestIdGenerator(); // 削除

      // Act
      const result = storageService.copyFile(
        SOURCE_DIR,
        SOURCE_FILE,
        DEST_DIR,
        DEST_FILE
      );

      // Assert
      expect(result).toBe(true);
      expect(fsMock.copyFileSync).toHaveBeenCalledWith(
        NATIVE_SOURCE_PATH,
        NATIVE_DEST_PATH
      );
      // Re-add traceId and requestId expectations
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'storage',
        'file_copy_before',
        {
          sourcePath: NATIVE_SOURCE_PATH, // ★★★ 修正 ★★★
          destPath: NATIVE_DEST_PATH, // ★★★ 修正 ★★★
          timestamp: MOCK_TIMESTAMP_ISO,
          traceId: expect.any(String), // expect.any(String) に変更
          requestId: expect.any(String), // expect.any(String) に変更
        }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'storage',
        'file_copy_after',
        {
          sourcePath: NATIVE_SOURCE_PATH, // ★★★ 修正 ★★★
          destPath: NATIVE_DEST_PATH, // ★★★ 修正 ★★★
          success: true,
          timestamp: MOCK_TIMESTAMP_ISO,
          traceId: expect.any(String), // expect.any(String) に変更
          requestId: expect.any(String), // expect.any(String) に変更
        }
      );
    });

    test('should return false and emit file_not_found if source file does not exist', () => {
      // Arrange
      // Simulate source does not exist
      fsMock.existsSync.mockImplementation((p) => p !== NATIVE_SOURCE_PATH);
      jest
        .spyOn(storageService, '_getNativeFilePath')
        .mockReturnValue(NATIVE_SOURCE_PATH); // Still need path for check
      // const expectedTraceId = storageService._traceIdGenerator(); // 削除
      // const expectedRequestId = storageService._requestIdGenerator(); // 削除

      // Act
      const result = storageService.copyFile(
        SOURCE_DIR,
        SOURCE_FILE,
        DEST_DIR,
        DEST_FILE
      );

      // Assert
      expect(result).toBe(false);
      expect(fsMock.copyFileSync).not.toHaveBeenCalled();
      // Re-add traceId and requestId expectations
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'storage',
        'file_not_found',
        {
          path: NATIVE_SOURCE_PATH, // ★★★ 修正 ★★★
          timestamp: MOCK_TIMESTAMP_ISO,
          traceId: expect.any(String), // expect.any(String) に変更
          requestId: expect.any(String), // expect.any(String) に変更
        }
      );
    });

    test('should call errorHandler and return false if copyFileSync throws', () => {
      // Arrange
      const error = new Error('copy error');
      fsMock.existsSync.mockReturnValue(true); // Source exists
      jest
        .spyOn(storageService, '_getNativeFilePath')
        .mockReturnValueOnce(NATIVE_SOURCE_PATH)
        .mockReturnValueOnce(NATIVE_DEST_PATH);
      fsMock.copyFileSync.mockImplementation(() => {
        throw error;
      });
      // const expectedTraceId = storageService._traceIdGenerator(); // 削除
      // const expectedRequestId = storageService._requestIdGenerator(); // 削除

      // Act
      const result = storageService.copyFile(
        SOURCE_DIR,
        SOURCE_FILE,
        DEST_DIR,
        DEST_FILE
      );

      // Assert
      expect(result).toBe(false);
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.any(StorageError),
        'StorageService',
        'copyFile',
        expect.objectContaining({ sourceDir: SOURCE_DIR, destDir: DEST_DIR })
      );
      // Re-add traceId and requestId expectations
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'storage',
        'file_copy_error', // ★★★ 修正 ★★★
        {
          sourcePath: NATIVE_SOURCE_PATH, // ★★★ 修正 ★★★
          destPath: NATIVE_DEST_PATH, // ★★★ 修正 ★★★
          error: error.message,
          timestamp: MOCK_TIMESTAMP_ISO,
          traceId: expect.any(String), // expect.any(String) に変更
          requestId: expect.any(String), // expect.any(String) に変更
        }
      );
    });
  });

  describe('ensureDirectoryExists', () => {
    test('should return true if directory already exists', () => {
      // Arrange
      fsMock.existsSync.mockReturnValue(true);
      const ensureSpy = jest.spyOn(storageService, '_ensureDirectoryExists'); // Spy on internal method

      // Act
      const result = storageService.ensureDirectoryExists(TEST_DIR);

      // Assert
      expect(result).toBe(true);
      expect(ensureSpy).toHaveBeenCalledWith(NATIVE_TEST_DIR_PATH);
      expect(fsMock.mkdirSync).not.toHaveBeenCalled();
      expect(mockEventEmitter.emitStandardized).not.toHaveBeenCalledWith(
        'storage',
        'directory_created',
        expect.any(Object)
      );
    });

    test('should create directory and return true if it does not exist', () => {
      // Arrange
      fsMock.existsSync.mockReturnValue(false);
      const ensureSpy = jest
        .spyOn(storageService, '_ensureDirectoryExists')
        .mockImplementation(() => {}); // Mock internal to avoid actual mkdir

      // Act
      const result = storageService.ensureDirectoryExists(TEST_DIR);

      // Assert
      expect(result).toBe(true);
      expect(ensureSpy).toHaveBeenCalledWith(NATIVE_TEST_DIR_PATH);
      // _ensureDirectoryExists is mocked, so mkdirSync/event emission check is done there (tested separately if needed)
    });

    test('should return false if directory creation fails (internal error)', () => {
      // Arrange
      const error = new Error('mkdir failed');
      // Mock internal method to throw, simulating mkdir failure
      jest
        .spyOn(storageService, '_ensureDirectoryExists')
        .mockImplementation(() => {
          throw error;
        });

      // Act
      const result = storageService.ensureDirectoryExists(TEST_DIR);

      // Assert
      expect(result).toBe(false);
      // Error handling happens within _ensureDirectoryExists, which is mocked here.
      // If _handleError was called inside _ensureDirectoryExists, it would be caught by its own tests.
    });
  });

  // _ensureDirectoryExists is private, tested indirectly via public methods like ensureDirectoryExists and write* methods.
  // Adding specific tests for private methods can make tests brittle.
});

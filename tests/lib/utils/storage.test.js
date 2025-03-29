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
const fs = require('fs'); // fs モジュールを直接使用 (モックされる)

// fs モジュールをモック
jest.mock('fs');
// path モジュールは beforeEach で spyOn を使ってモックする
// path モジュールをモック
jest.mock('path', () => {
  const originalPath = jest.requireActual('path');
  return {
    ...originalPath, // 他の path 関数は元の実装を使用
    // join, dirname, normalize を jest.fn() でラップし、元の関数を呼び出す
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
  let pathMock;

  const BASE_PATH = '/test/base/path';
  const TEST_DIR = 'test-dir';
  const TEST_FILE_JSON = 'test-file.json';
  const TEST_FILE_TXT = 'test-file.txt';
  const TEST_FILE_BIN = 'test-file.bin';
  const NATIVE_TEST_DIR_PATH = path.join(BASE_PATH, TEST_DIR);
  const NATIVE_JSON_PATH = path.join(NATIVE_TEST_DIR_PATH, TEST_FILE_JSON);
  const NATIVE_TXT_PATH = path.join(NATIVE_TEST_DIR_PATH, TEST_FILE_TXT);
  const NATIVE_BIN_PATH = path.join(NATIVE_TEST_DIR_PATH, TEST_FILE_BIN);
  const MOCK_TIMESTAMP_ISO = '2025-03-24T00:00:00.000Z';
  const MOCK_TIMESTAMP_MS = new Date(MOCK_TIMESTAMP_ISO).getTime();
  const MOCK_RANDOM = 0.123456789;
  const EXPECTED_TRACE_ID = `trace-${MOCK_TIMESTAMP_MS}-4fzzxw8a5`;
  const EXPECTED_REQUEST_ID = `req-${MOCK_TIMESTAMP_MS}-4fzzxw8a5`;


  beforeEach(() => {
    jest.clearAllMocks();

    fsMock = require('fs');
    // path モジュールは jest.mock でモックされる

    // fs モックのデフォルト実装
    fsMock.existsSync.mockReturnValue(false);
    fsMock.readFileSync.mockReturnValue('{}');
    fsMock.writeFileSync.mockImplementation(() => {});
    fsMock.mkdirSync.mockImplementation(() => {});
    fsMock.unlinkSync.mockImplementation(() => {});
    fsMock.rmdirSync.mockImplementation(() => {});
    fsMock.copyFileSync.mockImplementation(() => {});
    fsMock.rmSync.mockImplementation(() => {});
    fsMock.lstatSync.mockReturnValue({ isDirectory: () => false });
    fsMock.readdirSync.mockReturnValue([]);

    // 時間関連のモック
    mockTimestamp(MOCK_TIMESTAMP_ISO);
    jest.spyOn(Date, 'now').mockReturnValue(MOCK_TIMESTAMP_MS);
    jest.spyOn(Math, 'random').mockReturnValue(MOCK_RANDOM);

    // 依存関係のモック
    mockLogger = createMockLogger();
    mockEventEmitter = createMockEventEmitter();
    // エラーハンドラのデフォルト値を更新
    mockErrorHandler = createMockErrorHandler({
        defaultReturnValues: {
            readJSON: null, writeJSON: false, readText: null, writeText: false,
            writeFile: false, updateJSON: null, deleteFile: false,
            deleteDirectory: false, copyFile: false, listFiles: [],
            fileExists: false, ensureDirectoryExists: false,
            '_getNativeFilePath (mkdir)': undefined, // エラーハンドラが呼ばれた場合、これらの操作は値を返さない
            '_ensureDirectoryExists (mkdir)': undefined,
        }
    });

    // StorageService のインスタンス作成
    storageService = new StorageService({
        basePath: BASE_PATH,
        logger: mockLogger,
        eventEmitter: mockEventEmitter,
        errorHandler: mockErrorHandler,
    });
    // IDジェネレーターをモックして固定値を返すようにする (関数であることを維持)
    storageService._traceIdGenerator = jest.fn().mockImplementation(() => EXPECTED_TRACE_ID);
    storageService._requestIdGenerator = jest.fn().mockImplementation(() => EXPECTED_REQUEST_ID);
  });

   afterEach(() => {
     jest.restoreAllMocks();
   });

   describe('constructor', () => {
        test('logger がないとエラーをスローする', () => {
            expect(() => new StorageService({ basePath: BASE_PATH })).toThrow('Logger instance is required');
        });

        test('デフォルト値とカスタム値で初期化される', () => {
            // Arrange & Act (beforeEach で初期化済み)
            // Assert
            expect(storageService.basePath).toBe(BASE_PATH);
            expect(storageService.logger).toBe(mockLogger);
            expect(storageService.eventEmitter).toBe(mockEventEmitter);
            expect(storageService.errorHandler).toBe(mockErrorHandler);
            expect(typeof storageService._traceIdGenerator).toBe('function'); // typeof で関数であることを確認
            expect(typeof storageService._requestIdGenerator).toBe('function'); // typeof で関数であることを確認

            // デフォルト basePath のテスト
            const defaultService = new StorageService({ logger: mockLogger });
            expect(defaultService.basePath).toBe(process.cwd());
        });
   });

  describe('_getNativeFilePath', () => {
    test('ディレクトリが存在する場合、正しいネイティブパスを返す', () => {
      // Arrange
      fsMock.existsSync.mockReturnValue(true);
      // Act
      const result = storageService._getNativeFilePath(TEST_DIR, TEST_FILE_JSON);
      // Assert
      expect(result).toBe(NATIVE_JSON_PATH);
      expect(require('path').join).toHaveBeenCalledWith(BASE_PATH, TEST_DIR, TEST_FILE_JSON);
      expect(fsMock.existsSync).toHaveBeenCalledWith(NATIVE_TEST_DIR_PATH);
      expect(fsMock.mkdirSync).not.toHaveBeenCalled();
    });

    test('ディレクトリが存在しない場合、ディレクトリを作成して正しいネイティブパスを返す', () => {
      // Arrange
      fsMock.existsSync.mockReturnValue(false);
      // Act
      const result = storageService._getNativeFilePath(TEST_DIR, TEST_FILE_JSON);
      // Assert
      expect(result).toBe(NATIVE_JSON_PATH);
      expect(fsMock.existsSync).toHaveBeenCalledWith(NATIVE_TEST_DIR_PATH);
      expect(fsMock.mkdirSync).toHaveBeenCalledWith(NATIVE_TEST_DIR_PATH, { recursive: true });
      expectStandardizedEventEmitted(mockEventEmitter, 'storage', 'directory_created', { path: NATIVE_TEST_DIR_PATH, timestamp: 'any', traceId: expect.any(String), requestId: expect.any(String) });
    });

     test('ディレクトリ作成時にエラーが発生した場合、エラーをハンドルする', () => {
       // Arrange
       fsMock.existsSync.mockReturnValue(false);
       const error = new Error('mkdir failed');
       fsMock.mkdirSync.mockImplementation(() => { throw error; });
       // Act
       const result = storageService._getNativeFilePath('error-dir', 'file.json');
       // Assert
       expect(result).toBe(path.join(BASE_PATH, 'error-dir', 'file.json'));
       expect(mockErrorHandler.handle).toHaveBeenCalledWith(
         expect.any(StorageError),
         'StorageService',
         '_getNativeFilePath (mkdir)',
         expect.objectContaining({ directory: path.join(BASE_PATH, 'error-dir') })
       );
     });
  });

  // getFilePath (deprecated) のテスト
  describe('getFilePath', () => {
      test('ネイティブパスを / 区切りに変換して返す', () => {
          // Arrange
          const nativePath = 'c:\\test\\path';
          const expectedPath = 'c:/test/path';
          jest.spyOn(storageService, '_getNativeFilePath').mockReturnValue(nativePath);
          // Act
          const result = storageService.getFilePath('dir', 'file');
          // Assert
          expect(result).toBe(expectedPath);
          expect(storageService._getNativeFilePath).toHaveBeenCalledWith('dir', 'file');
      });
  });

  describe('readJSON', () => {
    test('ファイルが存在する場合、JSONオブジェクトを返す', () => {
      // Arrange
      const jsonContent = '{"key": "value"}';
      fsMock.existsSync.mockReturnValue(true);
      fsMock.readFileSync.mockReturnValue(jsonContent);

      // Act
      const result = storageService.readJSON(TEST_DIR, TEST_FILE_JSON);

      // Assert
      expect(result).toEqual({ key: 'value' });
      expect(fsMock.existsSync).toHaveBeenCalledWith(NATIVE_JSON_PATH);
      expect(fsMock.readFileSync).toHaveBeenCalledWith(NATIVE_JSON_PATH, 'utf8');
      expectStandardizedEventEmitted(mockEventEmitter, 'storage', 'file_read_before', { path: NATIVE_JSON_PATH, type: 'json', timestamp: 'any', traceId: expect.any(String), requestId: expect.any(String) });
      expectStandardizedEventEmitted(mockEventEmitter, 'storage', 'file_read_after', { path: NATIVE_JSON_PATH, type: 'json', success: true, timestamp: 'any', traceId: expect.any(String), requestId: expect.any(String) });
    });

    test('ファイルが存在しない場合、nullを返し、not_foundイベントを発行する', () => {
      // Arrange
      fsMock.existsSync.mockReturnValue(false);
      // Act
      const result = storageService.readJSON(TEST_DIR, TEST_FILE_JSON);
      // Assert
      expect(result).toBeNull();
      expect(fsMock.existsSync).toHaveBeenCalledWith(NATIVE_JSON_PATH);
      expect(fsMock.readFileSync).not.toHaveBeenCalled();
      expectStandardizedEventEmitted(mockEventEmitter, 'storage', 'file_read_before', { path: NATIVE_JSON_PATH, type: 'json', timestamp: 'any', traceId: expect.any(String), requestId: expect.any(String) });
      expectStandardizedEventEmitted(mockEventEmitter, 'storage', 'file_not_found', { path: NATIVE_JSON_PATH, type: 'json', timestamp: 'any', traceId: expect.any(String), requestId: expect.any(String) });
    });

    test('JSONパースエラーが発生した場合、エラーをハンドルしnullを返す', () => {
      // Arrange
      const invalidJson = '{invalid: json}';
      fsMock.existsSync.mockReturnValue(true);
      fsMock.readFileSync.mockReturnValue(invalidJson);

      // Act
      const result = storageService.readJSON(TEST_DIR, TEST_FILE_JSON);

      // Assert
      expect(result).toBeNull();
      expect(fsMock.readFileSync).toHaveBeenCalledWith(NATIVE_JSON_PATH, 'utf8');
      expectStandardizedEventEmitted(mockEventEmitter, 'storage', 'file_read_after', { path: NATIVE_JSON_PATH, type: 'json', success: false, error: expect.any(String), timestamp: 'any', traceId: expect.any(String), requestId: expect.any(String) });
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.any(StorageError),
        'StorageService',
        'readJSON',
        expect.objectContaining({ directory: TEST_DIR, filename: TEST_FILE_JSON })
      );
    });

    test('readFileSync でエラーが発生した場合、エラーをハンドルしnullを返す', () => {
        // Arrange
        const error = new Error('Read error');
        fsMock.existsSync.mockReturnValue(true);
        fsMock.readFileSync.mockImplementation(() => { throw error; });

        // Act
        const result = storageService.readJSON(TEST_DIR, TEST_FILE_JSON);

        // Assert
        expect(result).toBeNull();
        expect(mockErrorHandler.handle).toHaveBeenCalledWith(
          expect.any(StorageError),
          'StorageService',
          'readJSON',
          expect.objectContaining({ directory: TEST_DIR, filename: TEST_FILE_JSON })
        );
        expectStandardizedEventEmitted(mockEventEmitter, 'storage', 'file_read_after', { path: NATIVE_JSON_PATH, type: 'json', success: false, error: error.message, timestamp: 'any', traceId: expect.any(String), requestId: expect.any(String) });
      });
  });

  describe('writeJSON', () => {
    test('JSONファイルを正常に書き込み、trueを返す', () => {
      // Arrange
      const data = { key: 'value' };
      // Act
      const result = storageService.writeJSON(TEST_DIR, TEST_FILE_JSON, data);
      // Assert
      expect(result).toBe(true);
      expect(fsMock.writeFileSync).toHaveBeenCalledWith(NATIVE_JSON_PATH, JSON.stringify(data, null, 2), 'utf8');
      expectStandardizedEventEmitted(mockEventEmitter, 'storage', 'file_write_before', { directory: TEST_DIR, filename: TEST_FILE_JSON, type: 'json', timestamp: 'any', traceId: expect.any(String), requestId: expect.any(String) });
      expectStandardizedEventEmitted(mockEventEmitter, 'storage', 'file_write_after', { directory: TEST_DIR, filename: TEST_FILE_JSON, type: 'json', success: true, timestamp: 'any', traceId: expect.any(String), requestId: expect.any(String) });
    });

    test('書き込み時にエラーが発生した場合、エラーをハンドルしfalseを返す', () => {
      // Arrange
      const data = { key: 'value' };
      const error = new Error('Write error');
      fsMock.writeFileSync.mockImplementation(() => { throw error; });

      // Act
      const result = storageService.writeJSON(TEST_DIR, TEST_FILE_JSON, data);

      // Assert
      expect(result).toBe(false);
      expect(fsMock.writeFileSync).toHaveBeenCalled();
      expectStandardizedEventEmitted(mockEventEmitter, 'storage', 'file_write_error', { directory: TEST_DIR, filename: TEST_FILE_JSON, type: 'json', error: error.message, timestamp: 'any', traceId: expect.any(String), requestId: expect.any(String) });
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.any(StorageError),
        'StorageService',
        'writeJSON',
        expect.objectContaining({ directory: TEST_DIR, filename: TEST_FILE_JSON })
      );
    });
  });

   describe('readText', () => {
     test('ファイルが存在する場合、テキスト内容を返す', async () => {
       // Arrange
       const textContent = 'テキスト内容';
       fsMock.existsSync.mockReturnValue(true);
       fsMock.readFileSync.mockReturnValue(textContent);

       // Act
       const result = storageService.readText(TEST_DIR, TEST_FILE_TXT);

       // Assert
       expect(result).toBe(textContent);
       expect(fsMock.readFileSync).toHaveBeenCalledWith(NATIVE_TXT_PATH, 'utf8');
       expectStandardizedEventEmitted(mockEventEmitter, 'storage', 'file_read_before', { directory: TEST_DIR, filename: TEST_FILE_TXT, type: 'text', timestamp: 'any', traceId: expect.any(String), requestId: expect.any(String) });
       expectStandardizedEventEmitted(mockEventEmitter, 'storage', 'file_read_after', { directory: TEST_DIR, filename: TEST_FILE_TXT, type: 'text', success: true, timestamp: 'any', traceId: expect.any(String), requestId: expect.any(String) });
     });

     test('ファイルが存在しない場合、nullを返す', async () => {
       // Arrange
       fsMock.existsSync.mockReturnValue(false);
       // Act
       const result = storageService.readText(TEST_DIR, TEST_FILE_TXT);
       // Assert
       expect(result).toBeNull();
       expect(fsMock.readFileSync).not.toHaveBeenCalled();
       expectStandardizedEventEmitted(mockEventEmitter, 'storage', 'file_not_found', { path: NATIVE_TXT_PATH, type: 'text', timestamp: 'any', traceId: expect.any(String), requestId: expect.any(String) });
     });

     test('エラーが発生した場合、エラーをハンドルしnullを返す', async () => {
       // Arrange
       const error = new Error('Read error');
       fsMock.existsSync.mockReturnValue(true);
       fsMock.readFileSync.mockImplementation(() => { throw error; });

       // Act
       const result = storageService.readText(TEST_DIR, TEST_FILE_TXT);

       // Assert
       expect(result).toBeNull();
       expect(mockErrorHandler.handle).toHaveBeenCalledWith(
         expect.any(StorageError),
         'StorageService',
         'readText',
         expect.objectContaining({ directory: TEST_DIR, filename: TEST_FILE_TXT })
       );
       expectStandardizedEventEmitted(mockEventEmitter, 'storage', 'file_read_after', { directory: TEST_DIR, filename: TEST_FILE_TXT, type: 'text', success: false, error: error.message, timestamp: 'any', traceId: expect.any(String), requestId: expect.any(String) });
     });
   });

   describe('writeText', () => {
     test('テキストファイルを正常に書き込み、trueを返す', async () => {
       // Arrange
       const content = 'テキスト内容';
       // Act
       const result = storageService.writeText(TEST_DIR, TEST_FILE_TXT, content);
       // Assert
       expect(result).toBe(true);
       expect(fsMock.writeFileSync).toHaveBeenCalledWith(NATIVE_TXT_PATH, content, 'utf8');
       expectStandardizedEventEmitted(mockEventEmitter, 'storage', 'file_write_before', { directory: TEST_DIR, filename: TEST_FILE_TXT, type: 'text', timestamp: 'any', traceId: expect.any(String), requestId: expect.any(String) });
       expectStandardizedEventEmitted(mockEventEmitter, 'storage', 'file_write_after', { directory: TEST_DIR, filename: TEST_FILE_TXT, type: 'text', success: true, timestamp: 'any', traceId: expect.any(String), requestId: expect.any(String) });
     });

     test('書き込み時にエラーが発生した場合、エラーをハンドルしfalseを返す', async () => {
       // Arrange
       const content = 'テキスト内容';
       const error = new Error('Write error');
       fsMock.writeFileSync.mockImplementation(() => { throw error; });

       // Act
       const result = storageService.writeText(TEST_DIR, TEST_FILE_TXT, content);

       // Assert
       expect(result).toBe(false);
       expect(fsMock.writeFileSync).toHaveBeenCalled();
       expectStandardizedEventEmitted(mockEventEmitter, 'storage', 'file_write_error', { directory: TEST_DIR, filename: TEST_FILE_TXT, type: 'text', error: error.message, timestamp: 'any', traceId: expect.any(String), requestId: expect.any(String) });
       expect(mockErrorHandler.handle).toHaveBeenCalledWith(
         expect.any(StorageError),
         'StorageService',
         'writeText',
         expect.objectContaining({ directory: TEST_DIR, filename: TEST_FILE_TXT })
       );
     });
   });

   describe('writeFile', () => {
     test('バイナリファイルを正常に書き込み、trueを返す', async () => {
       // Arrange
       const content = Buffer.from('バイナリデータ');
       // Act
       const result = storageService.writeFile(TEST_DIR, TEST_FILE_BIN, content);
       // Assert
       expect(result).toBe(true);
       expect(fsMock.writeFileSync).toHaveBeenCalledWith(NATIVE_BIN_PATH, content);
       expectStandardizedEventEmitted(mockEventEmitter, 'storage', 'file_write_before', { directory: TEST_DIR, filename: TEST_FILE_BIN, timestamp: 'any', traceId: expect.any(String), requestId: expect.any(String) });
       expectStandardizedEventEmitted(mockEventEmitter, 'storage', 'file_write_after', { directory: TEST_DIR, filename: TEST_FILE_BIN, success: true, timestamp: 'any', traceId: expect.any(String), requestId: expect.any(String) });
     });

     test('書き込み時にエラーが発生した場合、エラーをハンドルしfalseを返す', async () => {
       // Arrange
       const content = Buffer.from('バイナリデータ');
       const error = new Error('Write error');
       fsMock.writeFileSync.mockImplementation(() => { throw error; });

       // Act
       const result = storageService.writeFile(TEST_DIR, TEST_FILE_BIN, content);

       // Assert
       expect(result).toBe(false);
       expect(fsMock.writeFileSync).toHaveBeenCalled();
       expectStandardizedEventEmitted(mockEventEmitter, 'storage', 'file_write_after', { directory: TEST_DIR, filename: TEST_FILE_BIN, success: false, error: error.message, timestamp: 'any', traceId: expect.any(String), requestId: expect.any(String) });
       expect(mockErrorHandler.handle).toHaveBeenCalledWith(
         expect.any(StorageError),
         'StorageService',
         'writeFile',
         expect.objectContaining({ directory: TEST_DIR, filename: TEST_FILE_BIN })
       );
     });
   });

   describe('updateJSON', () => {
     test('JSONファイルを正常に更新し、trueを返す', async () => {
       // Arrange
       const initialData = { key: 'value', count: 1 };
       const updatedData = { key: 'value', count: 2 };
       fsMock.existsSync.mockReturnValue(true);
       fsMock.readFileSync.mockReturnValue(JSON.stringify(initialData));
       const updateFn = jest.fn((data) => ({ ...data, count: data.count + 1 }));

       // Act
       const result = storageService.updateJSON(TEST_DIR, TEST_FILE_JSON, updateFn);

       // Assert
       expect(result).toBe(true);
       expect(updateFn).toHaveBeenCalledWith(initialData);
       expect(fsMock.writeFileSync).toHaveBeenCalledWith(NATIVE_JSON_PATH, JSON.stringify(updatedData, null, 2), 'utf8');
       expectStandardizedEventEmitted(mockEventEmitter, 'storage', 'file_update_before', { directory: TEST_DIR, filename: TEST_FILE_JSON, type: 'json', timestamp: 'any', traceId: expect.any(String), requestId: expect.any(String) });
       expectStandardizedEventEmitted(mockEventEmitter, 'storage', 'file_update_after', { directory: TEST_DIR, filename: TEST_FILE_JSON, type: 'json', success: true, timestamp: 'any', traceId: expect.any(String), requestId: expect.any(String) });
     });

     test('ファイルが存在しない場合、新規作成し、nullを返す', async () => {
       // Arrange
       const updatedData = { key: 'new', count: 1 };
       fsMock.existsSync.mockReturnValue(false);
       const updateFn = jest.fn(() => updatedData);

       // Act
       const result = storageService.updateJSON(TEST_DIR, TEST_FILE_JSON, updateFn);

       // Assert
       expect(result).toBeNull();
       expect(updateFn).toHaveBeenCalledWith({});
       expect(fsMock.writeFileSync).toHaveBeenCalledWith(NATIVE_JSON_PATH, JSON.stringify(updatedData, null, 2), 'utf8');
       expectStandardizedEventEmitted(mockEventEmitter, 'storage', 'file_update_before', { directory: TEST_DIR, filename: TEST_FILE_JSON, type: 'json', timestamp: 'any', traceId: expect.any(String), requestId: expect.any(String) });
       expectStandardizedEventEmitted(mockEventEmitter, 'storage', 'file_update_after', { directory: TEST_DIR, filename: TEST_FILE_JSON, type: 'json', success: true, timestamp: 'any', traceId: expect.any(String), requestId: expect.any(String) });
     });

     test('更新時にエラーが発生した場合、エラーをハンドルしnullを返す', async () => {
       // Arrange
       const error = new Error('Update error');
       fsMock.existsSync.mockReturnValue(true);
       fsMock.readFileSync.mockReturnValue('{"key":"value"}');
       fsMock.writeFileSync.mockImplementation(() => { throw error; });
       const updateFn = jest.fn((data) => data);

       // Act
       const result = storageService.updateJSON(TEST_DIR, TEST_FILE_JSON, updateFn);

       // Assert
       expect(result).toBeNull();
       expect(mockErrorHandler.handle).toHaveBeenCalledWith(
         expect.any(StorageError),
         'StorageService',
         'updateJSON',
         expect.objectContaining({ directory: TEST_DIR, filename: TEST_FILE_JSON })
       );
       expectStandardizedEventEmitted(mockEventEmitter, 'storage', 'file_update_after', { directory: TEST_DIR, filename: TEST_FILE_JSON, type: 'json', success: false, error: error.message, timestamp: 'any', traceId: expect.any(String), requestId: expect.any(String) });
     });

     test('updateFn がエラーをスローした場合、エラーをハンドルしnullを返す', () => {
        // Arrange
        const error = new Error('Update function error');
        fsMock.existsSync.mockReturnValue(true);
        fsMock.readFileSync.mockReturnValue('{"key":"value"}');
        const updateFn = jest.fn(() => { throw error; });

        // Act
        const result = storageService.updateJSON(TEST_DIR, TEST_FILE_JSON, updateFn);

        // Assert
        expect(result).toBeNull();
        expect(mockErrorHandler.handle).toHaveBeenCalledWith(
          expect.any(StorageError),
          'StorageService',
          'updateJSON',
          expect.objectContaining({ directory: TEST_DIR, filename: TEST_FILE_JSON })
        );
        expectStandardizedEventEmitted(mockEventEmitter, 'storage', 'file_update_after', { directory: TEST_DIR, filename: TEST_FILE_JSON, type: 'json', success: false, error: error.message, timestamp: 'any', traceId: expect.any(String), requestId: expect.any(String) });
      });
   });

   // lockFile のテストは省略

   describe('fileExists', () => {
     test('ファイルが存在する場合、trueを返す', () => {
       // Arrange
       fsMock.existsSync.mockReturnValue(true);
       // Act
       const result = storageService.fileExists(TEST_DIR, TEST_FILE_TXT);
       // Assert
       expect(result).toBe(true);
       expect(fsMock.existsSync).toHaveBeenCalledWith(NATIVE_TXT_PATH);
     });

     test('ファイルが存在しない場合、falseを返す', () => {
       // Arrange
       fsMock.existsSync.mockReturnValue(false);
       // Act
       const result = storageService.fileExists(TEST_DIR, TEST_FILE_TXT);
       // Assert
       expect(result).toBe(false);
       expect(fsMock.existsSync).toHaveBeenCalledWith(NATIVE_TXT_PATH);
     });

      test('単一引数でパスを指定した場合も動作する', () => {
        // Arrange
        fsMock.existsSync.mockReturnValue(true);
        // Act
        const result = storageService.fileExists(NATIVE_TXT_PATH);
        // Assert
        expect(result).toBe(true);
        expect(fsMock.existsSync).toHaveBeenCalledWith(NATIVE_TXT_PATH);
      });

     test('エラーが発生した場合、エラーをハンドルしfalseを返す', () => {
       // Arrange
       const error = new Error('existsSync error');
       fsMock.existsSync.mockImplementation(() => { throw error; });

       // Act
       const result = storageService.fileExists(TEST_DIR, TEST_FILE_TXT);

       // Assert
       expect(result).toBe(false);
       expect(mockErrorHandler.handle).toHaveBeenCalledWith(
         expect.any(StorageError),
         'StorageService',
         'fileExists',
         expect.objectContaining({ directory: TEST_DIR, filename: TEST_FILE_TXT })
       );
     });

     test('不正な引数 (文字列以外) を渡した場合、警告ログを出力し false を返す', () => {
       // Arrange
       const invalidArg1 = 123;
       const invalidArg2 = null;

       // Act & Assert (単一引数)
       expect(storageService.fileExists(invalidArg1)).toBe(false);
       expect(mockLogger.warn).toHaveBeenCalledWith('fileExists に不正な引数が渡されました (単一引数):', { args: [invalidArg1] });

       // Act & Assert (二引数)
       expect(storageService.fileExists(invalidArg1, 'file.txt')).toBe(false);
       expect(mockLogger.warn).toHaveBeenCalledWith('fileExists に不正な引数が渡されました (二引数):', { args: [invalidArg1, 'file.txt'] });
       expect(storageService.fileExists('dir', invalidArg2)).toBe(false);
       expect(mockLogger.warn).toHaveBeenCalledWith('fileExists に不正な引数が渡されました (二引数):', { args: ['dir', invalidArg2] });
     });

     test('不正な数の引数を渡した場合、警告ログを出力し false を返す', () => {
        // Arrange
        const args0 = [];
        const args3 = ['dir', 'file', 'extra'];

        // Act & Assert (0引数)
        expect(storageService.fileExists(...args0)).toBe(false);
        expect(mockLogger.warn).toHaveBeenCalledWith('fileExists に不正な数の引数が渡されました:', { args: args0 });

        // Act & Assert (3引数)
        expect(storageService.fileExists(...args3)).toBe(false);
        expect(mockLogger.warn).toHaveBeenCalledWith('fileExists に不正な数の引数が渡されました:', { args: args3 });
     });
   });

   describe('listFiles', () => {
     test('ディレクトリ内のファイル一覧を取得する', () => {
       // Arrange
       const mockFiles = ['file1.txt', 'file2.json'];
       fsMock.existsSync.mockReturnValue(true);
       fsMock.readdirSync.mockReturnValue(mockFiles);

       // Act
       const result = storageService.listFiles(TEST_DIR);

       // Assert
       expect(result).toEqual(mockFiles);
       expect(fsMock.readdirSync).toHaveBeenCalledWith(NATIVE_TEST_DIR_PATH);
       expectStandardizedEventEmitted(mockEventEmitter, 'storage', 'directory_list_before', { directory: TEST_DIR, pattern: null, timestamp: 'any', traceId: expect.any(String), requestId: expect.any(String) });
       expectStandardizedEventEmitted(mockEventEmitter, 'storage', 'directory_list_after', { directory: TEST_DIR, pattern: null, success: true, count: 2, timestamp: 'any', traceId: expect.any(String), requestId: expect.any(String) });
     });

     test('パターンを指定してファイル一覧をフィルタリングする', () => {
       // Arrange
       const mockFiles = ['file1.txt', 'file2.json'];
       fsMock.existsSync.mockReturnValue(true);
       fsMock.readdirSync.mockReturnValue(mockFiles);

       // Act
       const result = storageService.listFiles(TEST_DIR, '\\.json$');

       // Assert
       expect(result).toEqual(['file2.json']);
       expectStandardizedEventEmitted(mockEventEmitter, 'storage', 'directory_list_after', { directory: TEST_DIR, pattern: '\\.json$', success: true, count: 1, timestamp: 'any', traceId: expect.any(String), requestId: expect.any(String) });
     });

     test('ディレクトリが存在しない場合、空配列を返す', () => {
       // Arrange
       fsMock.existsSync.mockReturnValue(false);
       // Act
       const result = storageService.listFiles(TEST_DIR);
       // Assert
       expect(result).toEqual([]);
       expect(fsMock.readdirSync).not.toHaveBeenCalled();
       expectStandardizedEventEmitted(mockEventEmitter, 'storage', 'directory_not_found', { directory: TEST_DIR, timestamp: 'any', traceId: expect.any(String), requestId: expect.any(String) });
     });

     test('エラーが発生した場合、エラーをハンドルし空配列を返す', () => {
       // Arrange
       const error = new Error('readdir error');
       fsMock.existsSync.mockReturnValue(true);
       fsMock.readdirSync.mockImplementation(() => { throw error; });

       // Act
       const result = storageService.listFiles(TEST_DIR);

       // Assert
       expect(result).toEqual([]);
       expect(mockErrorHandler.handle).toHaveBeenCalledWith(
         expect.any(StorageError),
         'StorageService',
         'listFiles',
         expect.objectContaining({ directory: TEST_DIR, pattern: null })
       );
       expectStandardizedEventEmitted(mockEventEmitter, 'storage', 'directory_list_after', { directory: TEST_DIR, pattern: null, success: false, error: error.message, timestamp: 'any', traceId: expect.any(String), requestId: expect.any(String) });
     });
   });

   describe('deleteFile', () => {
     test('ファイルを正常に削除し、trueを返す', () => {
       // Arrange
       fsMock.existsSync.mockReturnValue(true);
       // Act
       const result = storageService.deleteFile(TEST_DIR, TEST_FILE_TXT);
       // Assert
       expect(result).toBe(true);
       expect(fsMock.unlinkSync).toHaveBeenCalledWith(NATIVE_TXT_PATH);
       expectStandardizedEventEmitted(mockEventEmitter, 'storage', 'file_delete_before', { directory: TEST_DIR, filename: TEST_FILE_TXT, timestamp: 'any', traceId: expect.any(String), requestId: expect.any(String) });
       expectStandardizedEventEmitted(mockEventEmitter, 'storage', 'file_delete_after', { directory: TEST_DIR, filename: TEST_FILE_TXT, success: true, timestamp: 'any', traceId: expect.any(String), requestId: expect.any(String) });
     });

     test('ファイルが存在しない場合、falseを返す', () => {
       // Arrange
       fsMock.existsSync.mockReturnValue(false);
       // Act
       const result = storageService.deleteFile(TEST_DIR, TEST_FILE_TXT);
       // Assert
       expect(result).toBe(false);
       expect(fsMock.unlinkSync).not.toHaveBeenCalled();
       expectStandardizedEventEmitted(mockEventEmitter, 'storage', 'file_not_found', { directory: TEST_DIR, filename: TEST_FILE_TXT, timestamp: 'any', traceId: expect.any(String), requestId: expect.any(String) });
     });

     test('エラーが発生した場合、エラーをハンドルしfalseを返す', () => {
       // Arrange
       const error = new Error('unlink error');
       fsMock.existsSync.mockReturnValue(true);
       fsMock.unlinkSync.mockImplementation(() => { throw error; });

       // Act
       const result = storageService.deleteFile(TEST_DIR, TEST_FILE_TXT);

       // Assert
       expect(result).toBe(false);
       expect(mockErrorHandler.handle).toHaveBeenCalledWith(
         expect.any(StorageError),
         'StorageService',
         'deleteFile',
         expect.objectContaining({ directory: TEST_DIR, filename: TEST_FILE_TXT })
       );
       expectStandardizedEventEmitted(mockEventEmitter, 'storage', 'file_delete_after', { directory: TEST_DIR, filename: TEST_FILE_TXT, success: false, error: error.message, timestamp: 'any', traceId: expect.any(String), requestId: expect.any(String) });
     });
   });

   describe('deleteDirectory', () => {
     test('ディレクトリを正常に削除する（非再帰的）', () => {
       // Arrange
       fsMock.existsSync.mockReturnValue(true);
       // Act
       const result = storageService.deleteDirectory(TEST_DIR);
       // Assert
       expect(result).toBe(true);
       expect(fsMock.rmSync).toHaveBeenCalledWith(NATIVE_TEST_DIR_PATH, { recursive: false, force: false });
       expectStandardizedEventEmitted(mockEventEmitter, 'storage', 'directory_delete_before', { directory: TEST_DIR, recursive: false, timestamp: 'any', traceId: expect.any(String), requestId: expect.any(String) });
       expectStandardizedEventEmitted(mockEventEmitter, 'storage', 'directory_delete_after', { directory: TEST_DIR, recursive: false, success: true, timestamp: 'any', traceId: expect.any(String), requestId: expect.any(String) });
     });

     test('ディレクトリを再帰的に削除する', () => {
       // Arrange
       fsMock.existsSync.mockReturnValue(true);
       // Act
       const result = storageService.deleteDirectory(TEST_DIR, true);
       // Assert
       expect(result).toBe(true);
       expect(fsMock.rmSync).toHaveBeenCalledWith(NATIVE_TEST_DIR_PATH, { recursive: true, force: true });
       expectStandardizedEventEmitted(mockEventEmitter, 'storage', 'directory_delete_before', { directory: TEST_DIR, recursive: true, timestamp: 'any', traceId: expect.any(String), requestId: expect.any(String) });
       expectStandardizedEventEmitted(mockEventEmitter, 'storage', 'directory_delete_after', { directory: TEST_DIR, recursive: true, success: true, timestamp: 'any', traceId: expect.any(String), requestId: expect.any(String) });
     });

     test('ディレクトリが存在しない場合、falseを返す', () => {
       // Arrange
       fsMock.existsSync.mockReturnValue(false);
       // Act
       const result = storageService.deleteDirectory(TEST_DIR);
       // Assert
       expect(result).toBe(false);
       expect(fsMock.rmSync).not.toHaveBeenCalled();
       expectStandardizedEventEmitted(mockEventEmitter, 'storage', 'directory_not_found', { directory: TEST_DIR, timestamp: 'any', traceId: expect.any(String), requestId: expect.any(String) });
     });

     test('エラーが発生した場合、エラーをハンドルしfalseを返す', () => {
       // Arrange
       const error = new Error('rm error');
       fsMock.existsSync.mockReturnValue(true);
       fsMock.rmSync.mockImplementation(() => { throw error; });

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
       expectStandardizedEventEmitted(mockEventEmitter, 'storage', 'directory_delete_after', { directory: TEST_DIR, recursive: true, success: false, error: error.message, timestamp: 'any', traceId: expect.any(String), requestId: expect.any(String) });
     });
   });

   describe('copyFile', () => {
     const SOURCE_DIR = 'source-dir';
     const SOURCE_FILE = 'source.txt';
     const DEST_DIR = 'dest-dir';
     const DEST_FILE = 'dest.txt';
     const NATIVE_SOURCE_PATH = path.join(BASE_PATH, SOURCE_DIR, SOURCE_FILE);
     const NATIVE_DEST_PATH = path.join(BASE_PATH, DEST_DIR, DEST_FILE);

     test('ファイルを正常にコピーし、trueを返す', () => {
       // Arrange
       fsMock.existsSync.mockReturnValue(true);
       // Act
       const result = storageService.copyFile(SOURCE_DIR, SOURCE_FILE, DEST_DIR, DEST_FILE);
       // Assert
       expect(result).toBe(true);
       expect(fsMock.copyFileSync).toHaveBeenCalledWith(NATIVE_SOURCE_PATH, NATIVE_DEST_PATH);
       expectStandardizedEventEmitted(mockEventEmitter, 'storage', 'file_copy_before', { sourceDir: SOURCE_DIR, sourceFile: SOURCE_FILE, destDir: DEST_DIR, destFile: DEST_FILE, timestamp: 'any', traceId: expect.any(String), requestId: expect.any(String) });
       expectStandardizedEventEmitted(mockEventEmitter, 'storage', 'file_copy_after', { sourceDir: SOURCE_DIR, sourceFile: SOURCE_FILE, destDir: DEST_DIR, destFile: DEST_FILE, success: true, timestamp: 'any', traceId: expect.any(String), requestId: expect.any(String) });
     });

     test('ソースファイルが存在しない場合、falseを返す', () => {
       // Arrange
       fsMock.existsSync.mockImplementation(p => p !== NATIVE_SOURCE_PATH);
       // Act
       const result = storageService.copyFile(SOURCE_DIR, SOURCE_FILE, DEST_DIR, DEST_FILE);
       // Assert
       expect(result).toBe(false);
       expect(fsMock.copyFileSync).not.toHaveBeenCalled();
       expectStandardizedEventEmitted(mockEventEmitter, 'storage', 'file_not_found', { directory: SOURCE_DIR, filename: SOURCE_FILE, timestamp: 'any', traceId: expect.any(String), requestId: expect.any(String) });
     });

     test('エラーが発生した場合、エラーをハンドルしfalseを返す', () => {
       // Arrange
       const error = new Error('copy error');
       fsMock.existsSync.mockReturnValue(true);
       fsMock.copyFileSync.mockImplementation(() => { throw error; });

       // Act
       const result = storageService.copyFile(SOURCE_DIR, SOURCE_FILE, DEST_DIR, DEST_FILE);

       // Assert
       expect(result).toBe(false);
       expect(mockErrorHandler.handle).toHaveBeenCalledWith(
         expect.any(StorageError),
         'StorageService',
         'copyFile',
         expect.objectContaining({ sourceDir: SOURCE_DIR, sourceFile: SOURCE_FILE, destDir: DEST_DIR, destFile: DEST_FILE })
       );
       expectStandardizedEventEmitted(mockEventEmitter, 'storage', 'file_copy_after', { sourceDir: SOURCE_DIR, sourceFile: SOURCE_FILE, destDir: DEST_DIR, destFile: DEST_FILE, success: false, error: error.message, timestamp: 'any', traceId: expect.any(String), requestId: expect.any(String) });
     });
   });

   describe('_emitEvent', () => {
     test('emitStandardized を正しい引数で呼び出す', () => {
       // Arrange
       const eventName = 'test_event';
       const data = { key: 'value' };
       // Act
       storageService._emitEvent(eventName, data);
       // Assert
       expect(mockEventEmitter.emitStandardized).toHaveBeenCalledWith(
         'storage',
         eventName,
         expect.objectContaining({
           key: 'value',
           timestamp: MOCK_TIMESTAMP_ISO,
           traceId: EXPECTED_TRACE_ID,
           requestId: EXPECTED_REQUEST_ID,
         })
       );
     });

      test('イベント名にコロンが含まれる場合、アンダースコアに置換する', () => {
        // Arrange
        const eventName = 'file:read:before';
        const data = { path: 'p' };
        // Act
        storageService._emitEvent(eventName, data);
        // Assert
        expect(mockEventEmitter.emitStandardized).toHaveBeenCalledWith(
          'storage',
          'file_read_before',
          expect.any(Object)
        );
      });

     test('イベントエミッターがない場合、何も起こらない', () => {
       // Arrange
       storageService.eventEmitter = null;
       // Act & Assert
       expect(() => {
         storageService._emitEvent('test_event', {});
       }).not.toThrow();
       expect(mockEventEmitter.emitStandardized).not.toHaveBeenCalled(); // 元のモックが呼ばれないことを確認
     });

     test('イベント発行中にエラーが発生した場合、警告ログを出力する', () => {
       // Arrange
       const error = new Error('Emit error');
       mockEventEmitter.emitStandardized.mockImplementation(() => { throw error; });
       // Act
       storageService._emitEvent('test_event', {});
       // Assert
       expect(mockLogger.warn).toHaveBeenCalledWith(`イベント発行中にエラーが発生しました: storage:test_event`, error);
     });
   });

   // _handleError のテストは省略 (エラーハンドラモックで検証)

   describe('ensureDirectoryExists', () => {
       test('ディレクトリが存在する場合、trueを返す', () => {
           // Arrange
           fsMock.existsSync.mockReturnValue(true);
           // Act
           const result = storageService.ensureDirectoryExists(TEST_DIR);
           // Assert
           expect(result).toBe(true);
           expect(fsMock.existsSync).toHaveBeenCalledWith(NATIVE_TEST_DIR_PATH);
           expect(fsMock.mkdirSync).not.toHaveBeenCalled();
       });

       test('ディレクトリが存在しない場合、作成してtrueを返す', () => {
           // Arrange
           fsMock.existsSync.mockReturnValue(false);
           // Act
           const result = storageService.ensureDirectoryExists(TEST_DIR);
           // Assert
           expect(result).toBe(true);
           expect(fsMock.existsSync).toHaveBeenCalledWith(NATIVE_TEST_DIR_PATH);
           expect(fsMock.mkdirSync).toHaveBeenCalledWith(NATIVE_TEST_DIR_PATH, { recursive: true });
           expectStandardizedEventEmitted(mockEventEmitter, 'storage', 'directory_created', { path: NATIVE_TEST_DIR_PATH, timestamp: 'any', traceId: expect.any(String), requestId: expect.any(String) });
       });

       test('ディレクトリ作成時にエラーが発生した場合、エラーをハンドルしfalseを返す', () => {
           // Arrange
           fsMock.existsSync.mockReturnValue(false);
           const error = new Error('mkdir failed');
           fsMock.mkdirSync.mockImplementation(() => { throw error; });
           // Act
           const result = storageService.ensureDirectoryExists(TEST_DIR);
           // Assert
           expect(result).toBe(false);
           expect(mockErrorHandler.handle).toHaveBeenCalledWith(
               expect.any(StorageError),
               'StorageService',
               '_ensureDirectoryExists (mkdir)',
               expect.objectContaining({ directory: NATIVE_TEST_DIR_PATH })
           );
       });
   });

});

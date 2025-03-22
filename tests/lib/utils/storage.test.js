/**
 * ストレージサービスのテスト
 */

const StorageService = require('../../../src/lib/utils/storage');

// fsとpathのモック
jest.mock('fs');
jest.mock('path');

describe('StorageService', () => {
  let storageService;
  let mockLogger;
  let mockEventEmitter;
  let mockErrorHandler;
  let fs;
  let path;

  beforeEach(() => {
    // モックのリセット
    jest.clearAllMocks();
    
    // fsとpathのモックを取得
    fs = require('fs');
    path = require('path');
    
    // パスの結合をシミュレート
    path.join.mockImplementation((...args) => args.join('/'));
    
    // モックロガー
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };
    
    // モックイベントエミッター（修正）
    mockEventEmitter = {
      emit: jest.fn().mockImplementation((eventName, data) => {
        // イベントが発行されたことをログに出力（デバッグ用）
        console.log(`Event emitted: ${eventName}`, data);
        return true;
      }),
      emitStandardized: jest.fn().mockImplementation((component, eventName, data, options) => {
        // 標準化されたイベントが発行されたことをログに出力（デバッグ用）
        console.log(`Standardized event emitted: ${component}:${eventName}`, data, options);
        return true;
      })
    };
    
    // モックエラーハンドラー
    mockErrorHandler = {
      handle: jest.fn()
    };
    
    // StorageServiceのインスタンス作成
    storageService = new StorageService({
      basePath: '/test/base/path',
      logger: mockLogger,
      eventEmitter: mockEventEmitter,
      errorHandler: mockErrorHandler
    });
    
    // モックをリセット
    jest.clearAllMocks();
  });

  describe('getFilePath', () => {
    test('ディレクトリが存在する場合、正しいパスを返す', () => {
      // ディレクトリが存在する場合
      fs.existsSync.mockReturnValue(true);
      
      const result = storageService.getFilePath('test-dir', 'test-file.json');
      
      expect(result).toBe('/test/base/path/test-dir/test-file.json');
      expect(path.join).toHaveBeenCalledWith('/test/base/path', 'test-dir');
      expect(path.join).toHaveBeenCalledWith('/test/base/path/test-dir', 'test-file.json');
      expect(fs.existsSync).toHaveBeenCalledWith('/test/base/path/test-dir');
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });

    test('ディレクトリが存在しない場合、ディレクトリを作成して正しいパスを返す', () => {
      // ディレクトリが存在しない場合
      fs.existsSync.mockReturnValue(false);
      
      const result = storageService.getFilePath('test-dir', 'test-file.json');
      
      expect(result).toBe('/test/base/path/test-dir/test-file.json');
      expect(path.join).toHaveBeenCalledWith('/test/base/path', 'test-dir');
      expect(path.join).toHaveBeenCalledWith('/test/base/path/test-dir', 'test-file.json');
      expect(fs.existsSync).toHaveBeenCalledWith('/test/base/path/test-dir');
      expect(fs.mkdirSync).toHaveBeenCalledWith('/test/base/path/test-dir', { recursive: true });
      
      // イベント発行の検証を修正
      expect(mockEventEmitter.emitStandardized).toHaveBeenCalled();
      expect(mockEventEmitter.emitStandardized.mock.calls[0][0]).toBe('storage');
      expect(mockEventEmitter.emitStandardized.mock.calls[0][1]).toBe('directory:created');
      expect(mockEventEmitter.emitStandardized.mock.calls[0][2]).toEqual(expect.objectContaining({
        path: '/test/base/path/test-dir'
      }));
    });
  });

  describe('ensureDirectoryExists', () => {
    test('ディレクトリが存在する場合、何もしない', () => {
      // ディレクトリが存在する場合
      fs.existsSync.mockReturnValue(true);
      
      storageService.ensureDirectoryExists('/test/dir');
      
      expect(fs.existsSync).toHaveBeenCalledWith('/test/dir');
      expect(fs.mkdirSync).not.toHaveBeenCalled();
      expect(mockEventEmitter.emitStandardized).not.toHaveBeenCalled();
    });

    test('ディレクトリが存在しない場合、ディレクトリを作成する', () => {
      // ディレクトリが存在しない場合
      fs.existsSync.mockReturnValue(false);
      
      storageService.ensureDirectoryExists('/test/dir');
      
      expect(fs.existsSync).toHaveBeenCalledWith('/test/dir');
      expect(fs.mkdirSync).toHaveBeenCalledWith('/test/dir', { recursive: true });
      
      // イベント発行の検証を修正
      expect(mockEventEmitter.emitStandardized).toHaveBeenCalled();
      expect(mockEventEmitter.emitStandardized.mock.calls[0][0]).toBe('storage');
      expect(mockEventEmitter.emitStandardized.mock.calls[0][1]).toBe('directory:created');
      expect(mockEventEmitter.emitStandardized.mock.calls[0][2]).toEqual(expect.objectContaining({
        path: '/test/dir'
      }));
    });

    test('ディレクトリ作成時にエラーが発生した場合、エラーハンドラーを呼び出す', () => {
      // ディレクトリが存在しない場合
      fs.existsSync.mockReturnValue(false);
      
      // mkdirSyncでエラーをスロー
      const error = new Error('ディレクトリ作成エラー');
      fs.mkdirSync.mockImplementation(() => {
        throw error;
      });
      
      storageService.ensureDirectoryExists('/test/dir');
      
      expect(fs.existsSync).toHaveBeenCalledWith('/test/dir');
      expect(fs.mkdirSync).toHaveBeenCalledWith('/test/dir', { recursive: true });
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'StorageError',
          message: 'ディレクトリの作成に失敗しました',
          cause: error
        }),
        'StorageService',
        undefined,
        expect.objectContaining({
          additionalContext: { directory: '/test/dir' }
        })
      );
    });
  });

  describe('readJSON', () => {
    test('ファイルが存在する場合、JSONオブジェクトを返す', () => {
      // ファイルが存在する場合
      fs.existsSync.mockReturnValue(true);
      
      // readFileSyncの戻り値を設定
      const jsonContent = '{"key": "value"}';
      fs.readFileSync.mockReturnValue(jsonContent);
      
      const result = storageService.readJSON('test-dir', 'test-file.json');
      
      expect(result).toEqual({ key: 'value' });
      expect(fs.existsSync).toHaveBeenCalledWith('/test/base/path/test-dir/test-file.json');
      expect(fs.readFileSync).toHaveBeenCalledWith('/test/base/path/test-dir/test-file.json', 'utf8');
      
      // イベント発行の検証を修正
      expect(mockEventEmitter.emitStandardized).toHaveBeenCalledTimes(2);
      expect(mockEventEmitter.emitStandardized.mock.calls[0][0]).toBe('storage');
      expect(mockEventEmitter.emitStandardized.mock.calls[0][1]).toBe('file:read:before');
      expect(mockEventEmitter.emitStandardized.mock.calls[0][2]).toEqual(expect.objectContaining({
        directory: 'test-dir',
        filename: 'test-file.json',
        type: 'json'
      }));
      
      expect(mockEventEmitter.emitStandardized.mock.calls[1][0]).toBe('storage');
      expect(mockEventEmitter.emitStandardized.mock.calls[1][1]).toBe('file:read:after');
      expect(mockEventEmitter.emitStandardized.mock.calls[1][2]).toEqual(expect.objectContaining({
        directory: 'test-dir',
        filename: 'test-file.json',
        type: 'json',
        success: true
      }));
    });

    test('ファイルが存在しない場合、nullを返す', () => {
      // ファイルが存在しない場合
      fs.existsSync.mockReturnValue(false);
      
      const result = storageService.readJSON('test-dir', 'test-file.json');
      
      expect(result).toBeNull();
      expect(fs.existsSync).toHaveBeenCalledWith('/test/base/path/test-dir/test-file.json');
      expect(fs.readFileSync).not.toHaveBeenCalled();
      
      // イベント発行の検証を修正（ファイルが存在しない場合は1回のみ）
      expect(mockEventEmitter.emitStandardized).toHaveBeenCalledTimes(1);
      expect(mockEventEmitter.emitStandardized.mock.calls[0][0]).toBe('storage');
      expect(mockEventEmitter.emitStandardized.mock.calls[0][1]).toBe('file:read:before');
      expect(mockEventEmitter.emitStandardized.mock.calls[0][2]).toEqual(expect.objectContaining({
        directory: 'test-dir',
        filename: 'test-file.json',
        type: 'json'
      }));
    });

    test('JSONパースエラーが発生した場合、エラーハンドラーを呼び出す', () => {
      // ファイルが存在する場合
      fs.existsSync.mockReturnValue(true);
      
      // 不正なJSON
      const invalidJson = '{key: value}';
      fs.readFileSync.mockReturnValue(invalidJson);
      
      // エラーハンドラーの戻り値を設定
      mockErrorHandler.handle.mockReturnValue(null);
      
      const result = storageService.readJSON('test-dir', 'test-file.json');
      
      expect(result).toBeNull();
      expect(fs.existsSync).toHaveBeenCalledWith('/test/base/path/test-dir/test-file.json');
      expect(fs.readFileSync).toHaveBeenCalledWith('/test/base/path/test-dir/test-file.json', 'utf8');
      
      // イベント発行の検証を修正
      expect(mockEventEmitter.emitStandardized).toHaveBeenCalledTimes(2);
      expect(mockEventEmitter.emitStandardized.mock.calls[0][0]).toBe('storage');
      expect(mockEventEmitter.emitStandardized.mock.calls[0][1]).toBe('file:read:before');
      expect(mockEventEmitter.emitStandardized.mock.calls[0][2]).toEqual(expect.objectContaining({
        directory: 'test-dir',
        filename: 'test-file.json',
        type: 'json'
      }));
      
      expect(mockEventEmitter.emitStandardized.mock.calls[1][0]).toBe('storage');
      expect(mockEventEmitter.emitStandardized.mock.calls[1][1]).toBe('file:read:after');
      expect(mockEventEmitter.emitStandardized.mock.calls[1][2]).toEqual(expect.objectContaining({
        directory: 'test-dir',
        filename: 'test-file.json',
        type: 'json',
        success: false
      }));
      
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'StorageError',
          message: expect.stringContaining('JSONファイルの読み込みに失敗しました')
        }),
        'StorageService',
        'readJSON',
        expect.objectContaining({
          additionalContext: expect.objectContaining({
            directory: 'test-dir',
            filename: 'test-file.json',
            operation: 'readJSON'
          })
        })
      );
    });
  });

  describe('writeJSON', () => {
    test('JSONファイルを正常に書き込む', () => {
      const data = { key: 'value' };
      
      const result = storageService.writeJSON('test-dir', 'test-file.json', data);
      
      expect(result).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/test/base/path/test-dir/test-file.json',
        JSON.stringify(data, null, 2),
        'utf8'
      );
      
      // イベント発行の検証を修正
      expect(mockEventEmitter.emitStandardized).toHaveBeenCalledTimes(2);
      expect(mockEventEmitter.emitStandardized.mock.calls[0][0]).toBe('storage');
      expect(mockEventEmitter.emitStandardized.mock.calls[0][1]).toBe('file:write:before');
      expect(mockEventEmitter.emitStandardized.mock.calls[0][2]).toEqual(expect.objectContaining({
        directory: 'test-dir',
        filename: 'test-file.json',
        type: 'json'
      }));
      
      expect(mockEventEmitter.emitStandardized.mock.calls[1][0]).toBe('storage');
      expect(mockEventEmitter.emitStandardized.mock.calls[1][1]).toBe('file:write:after');
      expect(mockEventEmitter.emitStandardized.mock.calls[1][2]).toEqual(expect.objectContaining({
        directory: 'test-dir',
        filename: 'test-file.json',
        type: 'json',
        success: true
      }));
    });

    test('書き込み時にエラーが発生した場合、エラーハンドラーを呼び出す', () => {
      // writeFileSyncでエラーをスロー
      const error = new Error('書き込みエラー');
      fs.writeFileSync.mockImplementation(() => {
        throw error;
      });
      
      // エラーハンドラーの戻り値を設定
      mockErrorHandler.handle.mockReturnValue(false);
      
      const data = { key: 'value' };
      const result = storageService.writeJSON('test-dir', 'test-file.json', data);
      
      expect(result).toBe(false);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/test/base/path/test-dir/test-file.json',
        JSON.stringify(data, null, 2),
        'utf8'
      );
      
      // イベント発行の検証を修正
      expect(mockEventEmitter.emitStandardized).toHaveBeenCalledTimes(2);
      expect(mockEventEmitter.emitStandardized.mock.calls[0][0]).toBe('storage');
      expect(mockEventEmitter.emitStandardized.mock.calls[0][1]).toBe('file:write:before');
      expect(mockEventEmitter.emitStandardized.mock.calls[0][2]).toEqual(expect.objectContaining({
        directory: 'test-dir',
        filename: 'test-file.json',
        type: 'json'
      }));
      
      expect(mockEventEmitter.emitStandardized.mock.calls[1][0]).toBe('storage');
      expect(mockEventEmitter.emitStandardized.mock.calls[1][1]).toBe('file:write:after');
      expect(mockEventEmitter.emitStandardized.mock.calls[1][2]).toEqual(expect.objectContaining({
        directory: 'test-dir',
        filename: 'test-file.json',
        type: 'json',
        success: false
      }));
      
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'StorageError',
          message: expect.stringContaining('JSONファイルの書き込みに失敗しました'),
          cause: error
        }),
        'StorageService',
        'writeJSON',
        expect.objectContaining({
          additionalContext: expect.objectContaining({
            directory: 'test-dir',
            filename: 'test-file.json',
            operation: 'writeJSON'
          })
        })
      );
    });
  });

  describe('readText', () => {
    test('ファイルが存在する場合、テキスト内容を返す', () => {
      // ファイルが存在する場合
      fs.existsSync.mockReturnValue(true);
      
      // readFileSyncの戻り値を設定
      const textContent = 'テキスト内容';
      fs.readFileSync.mockReturnValue(textContent);
      
      const result = storageService.readText('test-dir', 'test-file.txt');
      
      expect(result).toBe(textContent);
      expect(fs.existsSync).toHaveBeenCalledWith('/test/base/path/test-dir/test-file.txt');
      expect(fs.readFileSync).toHaveBeenCalledWith('/test/base/path/test-dir/test-file.txt', 'utf8');
      
      // イベント発行の検証を修正
      expect(mockEventEmitter.emitStandardized).toHaveBeenCalledTimes(2);
      expect(mockEventEmitter.emitStandardized.mock.calls[0][0]).toBe('storage');
      expect(mockEventEmitter.emitStandardized.mock.calls[0][1]).toBe('file:read:before');
      expect(mockEventEmitter.emitStandardized.mock.calls[0][2]).toEqual(expect.objectContaining({
        directory: 'test-dir',
        filename: 'test-file.txt',
        type: 'text'
      }));
      
      expect(mockEventEmitter.emitStandardized.mock.calls[1][0]).toBe('storage');
      expect(mockEventEmitter.emitStandardized.mock.calls[1][1]).toBe('file:read:after');
      expect(mockEventEmitter.emitStandardized.mock.calls[1][2]).toEqual(expect.objectContaining({
        directory: 'test-dir',
        filename: 'test-file.txt',
        type: 'text',
        success: true
      }));
    });

    test('ファイルが存在しない場合、nullを返す', () => {
      // ファイルが存在しない場合
      fs.existsSync.mockReturnValue(false);
      
      const result = storageService.readText('test-dir', 'test-file.txt');
      
      expect(result).toBeNull();
      expect(fs.existsSync).toHaveBeenCalledWith('/test/base/path/test-dir/test-file.txt');
      expect(fs.readFileSync).not.toHaveBeenCalled();
      
      // イベント発行の検証を修正（ファイルが存在しない場合は1回のみ）
      expect(mockEventEmitter.emitStandardized).toHaveBeenCalledTimes(1);
      expect(mockEventEmitter.emitStandardized.mock.calls[0][0]).toBe('storage');
      expect(mockEventEmitter.emitStandardized.mock.calls[0][1]).toBe('file:read:before');
      expect(mockEventEmitter.emitStandardized.mock.calls[0][2]).toEqual(expect.objectContaining({
        directory: 'test-dir',
        filename: 'test-file.txt',
        type: 'text'
      }));
    });
  });

  describe('writeText', () => {
    test('テキストファイルを正常に書き込む', () => {
      const content = 'テキスト内容';
      
      // writeFileSyncのモックを明示的に設定
      fs.writeFileSync.mockImplementation(() => {});
      
      const result = storageService.writeText('test-dir', 'test-file.txt', content);
      
      expect(result).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/test/base/path/test-dir/test-file.txt',
        content,
        'utf8'
      );
      
      // イベント発行の検証を修正
      expect(mockEventEmitter.emitStandardized).toHaveBeenCalledTimes(2);
      expect(mockEventEmitter.emitStandardized.mock.calls[0][0]).toBe('storage');
      expect(mockEventEmitter.emitStandardized.mock.calls[0][1]).toBe('file:write:before');
      expect(mockEventEmitter.emitStandardized.mock.calls[0][2]).toEqual(expect.objectContaining({
        directory: 'test-dir',
        filename: 'test-file.txt',
        type: 'text'
      }));
      
      expect(mockEventEmitter.emitStandardized.mock.calls[1][0]).toBe('storage');
      expect(mockEventEmitter.emitStandardized.mock.calls[1][1]).toBe('file:write:after');
      expect(mockEventEmitter.emitStandardized.mock.calls[1][2]).toEqual(expect.objectContaining({
        directory: 'test-dir',
        filename: 'test-file.txt',
        type: 'text',
        success: true
      }));
    });
  });

  describe('fileExists', () => {
    test('ファイルが存在する場合、trueを返す', () => {
      // ファイルが存在する場合
      fs.existsSync.mockReturnValue(true);
      
      const result = storageService.fileExists('test-dir', 'test-file.txt');
      
      expect(result).toBe(true);
      expect(fs.existsSync).toHaveBeenCalledWith('/test/base/path/test-dir/test-file.txt');
    });

    test('ファイルが存在しない場合、falseを返す', () => {
      // ファイルが存在しない場合
      fs.existsSync.mockReturnValue(false);
      
      const result = storageService.fileExists('test-dir', 'test-file.txt');
      
      expect(result).toBe(false);
      expect(fs.existsSync).toHaveBeenCalledWith('/test/base/path/test-dir/test-file.txt');
    });
  });

  describe('_emitEvent', () => {
    test('標準化されたイベント発行メソッドがある場合、それを使用する', () => {
      // 標準化されたイベント発行メソッドを持つイベントエミッター
      const mockStandardizedEventEmitter = {
        emitStandardized: jest.fn(),
        emit: jest.fn()
      };
      
      // StorageServiceのインスタンス作成
      const storageServiceWithStandardized = new StorageService({
        basePath: '/test/base/path',
        logger: mockLogger,
        eventEmitter: mockStandardizedEventEmitter,
        errorHandler: mockErrorHandler
      });
      
      // イベント発行
      storageServiceWithStandardized._emitEvent('file:read', { directory: 'test-dir', filename: 'test-file.txt' });
      
      expect(mockStandardizedEventEmitter.emitStandardized).toHaveBeenCalledWith(
        'storage',
        'file:read',
        expect.objectContaining({
          directory: 'test-dir',
          filename: 'test-file.txt',
          timestamp: expect.any(String)
        })
      );
      expect(mockStandardizedEventEmitter.emit).not.toHaveBeenCalled();
    });

    test('標準化されたイベント発行メソッドがない場合、従来のイベント発行を使用する', () => {
      // 従来のイベント発行メソッドのみを持つイベントエミッター
      const mockLegacyEventEmitter = {
        emit: jest.fn()
      };
      
      // StorageServiceのインスタンス作成
      const storageServiceWithLegacy = new StorageService({
        basePath: '/test/base/path',
        logger: mockLogger,
        eventEmitter: mockLegacyEventEmitter,
        errorHandler: mockErrorHandler
      });
      
      // イベント発行
      storageServiceWithLegacy._emitEvent('file:read', { directory: 'test-dir', filename: 'test-file.txt' });
      
      expect(mockLegacyEventEmitter.emit).toHaveBeenCalledWith(
        'storage:file:read',
        expect.objectContaining({
          directory: 'test-dir',
          filename: 'test-file.txt',
          timestamp: expect.any(String)
        })
      );
    });
  });

  describe('_handleError', () => {
    test('エラーハンドラーがある場合、それを使用する', () => {
      // エラーハンドラーの戻り値を設定
      mockErrorHandler.handle.mockReturnValue(null);
      
      const error = new Error('テストエラー');
      const context = { directory: 'test-dir', filename: 'test-file.txt', operation: 'readJSON' };
      
      const result = storageService._handleError('エラーメッセージ', error, context);
      
      expect(result).toBeNull();
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'StorageError',
          message: 'エラーメッセージ',
          cause: error
        }),
        'StorageService',
        'readJSON',
        expect.objectContaining({
          additionalContext: context
        })
      );
    });

    test('エラーハンドラーがない場合、ロガーを使用する', () => {
      // エラーハンドラーなしのStorageService
      const storageServiceWithoutHandler = new StorageService({
        basePath: '/test/base/path',
        logger: mockLogger,
        eventEmitter: mockEventEmitter
      });
      
      const error = new Error('テストエラー');
      const context = { directory: 'test-dir', filename: 'test-file.txt', operation: 'readJSON' };
      
      const result = storageServiceWithoutHandler._handleError('エラーメッセージ', error, context);
      
      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[StorageService] エラーメッセージ:',
        expect.objectContaining({
          error_name: 'Error',
          error_message: 'テストエラー',
          stack: error.stack,
          context
        })
      );
    });

    test('操作に応じて適切なデフォルト値を返す', () => {
      // エラーハンドラーなしのStorageService
      const storageServiceWithoutHandler = new StorageService({
        basePath: '/test/base/path',
        logger: mockLogger,
        eventEmitter: mockEventEmitter
      });
      
      const error = new Error('テストエラー');
      
      // readJSON操作
      let result = storageServiceWithoutHandler._handleError('エラーメッセージ', error, { operation: 'readJSON' });
      expect(result).toBeNull();
      
      // writeJSON操作
      result = storageServiceWithoutHandler._handleError('エラーメッセージ', error, { operation: 'writeJSON' });
      expect(result).toBe(false);
      
      // listFiles操作
      result = storageServiceWithoutHandler._handleError('エラーメッセージ', error, { operation: 'listFiles' });
      expect(result).toEqual([]);
      
      // 不明な操作
      result = storageServiceWithoutHandler._handleError('エラーメッセージ', error, { operation: 'unknown' });
      expect(result).toBeNull();
    });
  });
});

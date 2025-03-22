/**
 * ストレージサービスのテスト
 */

// ファイルシステムモジュールをモック
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  rmdirSync: jest.fn(),
  rmSync: jest.fn(),
  copyFileSync: jest.fn(),
  renameSync: jest.fn(),
  readdirSync: jest.fn(),
  statSync: jest.fn()
}));

const fs = require('fs');
const path = require('path');
const StorageService = require('../../../src/lib/utils/storage');
const { StorageError } = require('../../../src/lib/core/error-framework');

describe('ストレージサービス', () => {
  let storage;
  let mockEventEmitter;
  let mockLogger;
  
  beforeEach(() => {
    // モックをリセット
    jest.clearAllMocks();
    
    // モックの基本動作を設定
    fs.existsSync.mockReturnValue(false);
    fs.mkdirSync.mockImplementation(() => {}); // デフォルトの実装を設定
    fs.writeFileSync.mockImplementation(() => {}); // デフォルトの実装を設定
    fs.copyFileSync.mockImplementation(() => {}); // デフォルトの実装を設定
    fs.statSync.mockReturnValue({
      isFile: () => true,
      isDirectory: () => false,
      size: 1024,
      birthtime: new Date('2025-01-01'),
      mtime: new Date('2025-01-02'),
      atime: new Date('2025-01-03'),
      mode: 0o644
    });
    
    mockEventEmitter = {
      emit: jest.fn()
    };
    
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };
    
    storage = new StorageService({
      basePath: '/test/base/path',
      logger: mockLogger,
      eventEmitter: mockEventEmitter
    });
  });
  
  describe('getFilePath', () => {
    test('ディレクトリとファイル名からパスを生成する', () => {
      const result = storage.getFilePath('test-dir', 'test-file.txt');
      expect(result).toBe(path.join('/test/base/path', 'test-dir', 'test-file.txt'));
    });
  });
  
  describe('ensureDirectoryExists', () => {
    test('ディレクトリが存在しない場合は作成する', () => {
      fs.existsSync.mockReturnValue(false);
      
      const dirPath = '/test/base/path/new-dir';
      const result = storage.ensureDirectoryExists(dirPath);
      
      expect(result).toBe(true);
      expect(fs.existsSync).toHaveBeenCalledWith(dirPath);
      expect(fs.mkdirSync).toHaveBeenCalledWith(dirPath, { recursive: true });
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'storage:directory_created',
        { path: dirPath }
      );
    });
    
    test('ディレクトリが既に存在する場合は何もしない', () => {
      fs.existsSync.mockReturnValue(true);
      
      const dirPath = '/test/base/path/existing-dir';
      const result = storage.ensureDirectoryExists(dirPath);
      
      expect(result).toBe(true);
      expect(fs.existsSync).toHaveBeenCalledWith(dirPath);
      expect(fs.mkdirSync).not.toHaveBeenCalled();
      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });
    
    test('エラーが発生した場合はStorageErrorをスローする', () => {
      fs.existsSync.mockReturnValue(false);
      
      // このテスト内でのみエラーをスロー
      const originalMkdirSync = fs.mkdirSync;
      fs.mkdirSync.mockImplementation(() => {
        throw new Error('mkdir error');
      });
      
      const dirPath = '/test/base/path/error-dir';
      
      expect(() => {
        storage.ensureDirectoryExists(dirPath);
      }).toThrow(StorageError);
      
      // テスト後にモックを元に戻す
      fs.mkdirSync = originalMkdirSync;
    });
  });
  
  describe('fileExists', () => {
    test('ファイルが存在する場合はtrueを返す', () => {
      fs.existsSync.mockReturnValue(true);
      
      const result = storage.fileExists('test-dir', 'existing-file.txt');
      
      expect(result).toBe(true);
      expect(fs.existsSync).toHaveBeenCalledWith(
        path.join('/test/base/path', 'test-dir', 'existing-file.txt')
      );
    });
    
    test('ファイルが存在しない場合はfalseを返す', () => {
      fs.existsSync.mockReturnValue(false);
      
      const result = storage.fileExists('test-dir', 'non-existing-file.txt');
      
      expect(result).toBe(false);
    });
    
    test('エラーが発生した場合はStorageErrorをスローする', () => {
      fs.existsSync.mockImplementation(() => {
        throw new Error('existsSync error');
      });
      
      expect(() => {
        storage.fileExists('test-dir', 'error-file.txt');
      }).toThrow(StorageError);
    });
  });
  
  describe('readFile', () => {
    test('ファイルを読み込む', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('file content');
      
      const result = storage.readFile('test-dir', 'test-file.txt');
      
      expect(result).toBe('file content');
      expect(fs.existsSync).toHaveBeenCalled();
      expect(fs.readFileSync).toHaveBeenCalledWith(
        path.join('/test/base/path', 'test-dir', 'test-file.txt'),
        'utf8'
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'storage:file_read',
        expect.objectContaining({
          path: path.join('/test/base/path', 'test-dir', 'test-file.txt'),
          size: 12 // 'file content'.length
        })
      );
    });
    
    test('ファイルが存在しない場合はStorageErrorをスローする', () => {
      fs.existsSync.mockReturnValue(false);
      
      expect(() => {
        storage.readFile('test-dir', 'non-existing-file.txt');
      }).toThrow(StorageError);
      expect(fs.readFileSync).not.toHaveBeenCalled();
    });
    
    test('読み込みエラーが発生した場合はStorageErrorをスローする', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation(() => {
        throw new Error('readFileSync error');
      });
      
      expect(() => {
        storage.readFile('test-dir', 'error-file.txt');
      }).toThrow(StorageError);
    });
  });
  
  describe('readJSON', () => {
    test('JSONファイルを読み込んでパースする', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('{"key":"value"}');
      
      const result = storage.readJSON('test-dir', 'test-file.json');
      
      expect(result).toEqual({ key: 'value' });
      expect(fs.readFileSync).toHaveBeenCalled();
    });
    
    test('JSONパースエラーが発生した場合はStorageErrorをスローする', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('invalid json');
      
      expect(() => {
        storage.readJSON('test-dir', 'invalid-json.json');
      }).toThrow(StorageError);
    });
  });
  
  describe('writeFile', () => {
    test('ファイルを書き込む', () => {
      const result = storage.writeFile('test-dir', 'test-file.txt', 'file content');
      
      expect(result).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join('/test/base/path', 'test-dir', 'test-file.txt'),
        'file content',
        'utf8'
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'storage:file_written',
        expect.objectContaining({
          path: path.join('/test/base/path', 'test-dir', 'test-file.txt'),
          size: 12 // 'file content'.length
        })
      );
    });
    
    test('ディレクトリが存在しない場合は作成する', () => {
      storage.writeFile('new-dir', 'test-file.txt', 'file content');
      
      expect(fs.mkdirSync).toHaveBeenCalled();
    });
    
    test('書き込みエラーが発生した場合はStorageErrorをスローする', () => {
      // このテスト内でのみエラーをスロー
      const originalWriteFileSync = fs.writeFileSync;
      fs.writeFileSync.mockImplementation(() => {
        throw new Error('writeFileSync error');
      });
      
      expect(() => {
        storage.writeFile('test-dir', 'error-file.txt', 'file content');
      }).toThrow(StorageError);
      
      // テスト後にモックを元に戻す
      fs.writeFileSync = originalWriteFileSync;
    });
  });
  
  describe('writeJSON', () => {
    test('オブジェクトをJSONに変換して書き込む', () => {
      const data = { key: 'value' };
      const result = storage.writeJSON('test-dir', 'test-file.json', data);
      
      expect(result).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join('/test/base/path', 'test-dir', 'test-file.json'),
        JSON.stringify(data, null, 2),
        'utf8'
      );
    });
    
    test('書き込みエラーが発生した場合はStorageErrorをスローする', () => {
      // このテスト内でのみエラーをスロー
      const originalWriteFileSync = fs.writeFileSync;
      fs.writeFileSync.mockImplementation(() => {
        throw new Error('writeFileSync error');
      });
      
      expect(() => {
        storage.writeJSON('test-dir', 'error-file.json', { key: 'value' });
      }).toThrow(StorageError);
      
      // テスト後にモックを元に戻す
      fs.writeFileSync = originalWriteFileSync;
    });
  });
  
  describe('deleteFile', () => {
    test('ファイルを削除する', () => {
      fs.existsSync.mockReturnValue(true);
      
      const result = storage.deleteFile('test-dir', 'test-file.txt');
      
      expect(result).toBe(true);
      expect(fs.unlinkSync).toHaveBeenCalledWith(
        path.join('/test/base/path', 'test-dir', 'test-file.txt')
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'storage:file_deleted',
        expect.objectContaining({
          path: path.join('/test/base/path', 'test-dir', 'test-file.txt')
        })
      );
    });
    
    test('ファイルが存在しない場合はfalseを返す', () => {
      fs.existsSync.mockReturnValue(false);
      
      const result = storage.deleteFile('test-dir', 'non-existing-file.txt');
      
      expect(result).toBe(false);
      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });
    
    test('削除エラーが発生した場合はStorageErrorをスローする', () => {
      fs.existsSync.mockReturnValue(true);
      fs.unlinkSync.mockImplementation(() => {
        throw new Error('unlinkSync error');
      });
      
      expect(() => {
        storage.deleteFile('test-dir', 'error-file.txt');
      }).toThrow(StorageError);
    });
  });
  
  describe('deleteDirectory', () => {
    test('ディレクトリを削除する（非再帰的）', () => {
      fs.existsSync.mockReturnValue(true);
      
      const result = storage.deleteDirectory('test-dir');
      
      expect(result).toBe(true);
      expect(fs.rmdirSync).toHaveBeenCalledWith(
        path.join('/test/base/path', 'test-dir')
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'storage:directory_deleted',
        expect.objectContaining({
          path: path.join('/test/base/path', 'test-dir'),
          recursive: false
        })
      );
    });
    
    test('ディレクトリを再帰的に削除する', () => {
      fs.existsSync.mockReturnValue(true);
      
      const result = storage.deleteDirectory('test-dir', true);
      
      expect(result).toBe(true);
      expect(fs.rmSync).toHaveBeenCalledWith(
        path.join('/test/base/path', 'test-dir'),
        { recursive: true, force: true }
      );
    });
    
    test('ディレクトリが存在しない場合はfalseを返す', () => {
      fs.existsSync.mockReturnValue(false);
      
      const result = storage.deleteDirectory('non-existing-dir');
      
      expect(result).toBe(false);
      expect(fs.rmdirSync).not.toHaveBeenCalled();
      expect(fs.rmSync).not.toHaveBeenCalled();
    });
    
    test('削除エラーが発生した場合はStorageErrorをスローする', () => {
      fs.existsSync.mockReturnValue(true);
      fs.rmdirSync.mockImplementation(() => {
        throw new Error('rmdirSync error');
      });
      
      expect(() => {
        storage.deleteDirectory('error-dir');
      }).toThrow(StorageError);
    });
  });
  
  describe('copyFile', () => {
    test('ファイルをコピーする', () => {
      fs.existsSync.mockReturnValue(true);
      
      const result = storage.copyFile('source-dir', 'source-file.txt', 'dest-dir', 'dest-file.txt');
      
      expect(result).toBe(true);
      expect(fs.copyFileSync).toHaveBeenCalledWith(
        path.join('/test/base/path', 'source-dir', 'source-file.txt'),
        path.join('/test/base/path', 'dest-dir', 'dest-file.txt')
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'storage:file_copied',
        expect.objectContaining({
          sourcePath: path.join('/test/base/path', 'source-dir', 'source-file.txt'),
          destPath: path.join('/test/base/path', 'dest-dir', 'dest-file.txt')
        })
      );
    });
    
    test('宛先ファイル名が省略された場合は元のファイル名を使用する', () => {
      fs.existsSync.mockReturnValue(true);
      
      storage.copyFile('source-dir', 'source-file.txt', 'dest-dir');
      
      expect(fs.copyFileSync).toHaveBeenCalledWith(
        path.join('/test/base/path', 'source-dir', 'source-file.txt'),
        path.join('/test/base/path', 'dest-dir', 'source-file.txt')
      );
    });
    
    test('元のファイルが存在しない場合はStorageErrorをスローする', () => {
      fs.existsSync.mockReturnValue(false);
      
      expect(() => {
        storage.copyFile('source-dir', 'non-existing-file.txt', 'dest-dir');
      }).toThrow(StorageError);
      expect(fs.copyFileSync).not.toHaveBeenCalled();
    });
    
    test('コピーエラーが発生した場合はStorageErrorをスローする', () => {
      fs.existsSync.mockReturnValue(true);
      fs.copyFileSync.mockImplementation(() => {
        throw new Error('copyFileSync error');
      });
      
      expect(() => {
        storage.copyFile('source-dir', 'error-file.txt', 'dest-dir');
      }).toThrow(StorageError);
    });
  });
  
  describe('moveFile', () => {
    test('ファイルを移動する', () => {
      fs.existsSync.mockReturnValue(true);
      
      const result = storage.moveFile('source-dir', 'source-file.txt', 'dest-dir', 'dest-file.txt');
      
      expect(result).toBe(true);
      expect(fs.renameSync).toHaveBeenCalledWith(
        path.join('/test/base/path', 'source-dir', 'source-file.txt'),
        path.join('/test/base/path', 'dest-dir', 'dest-file.txt')
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'storage:file_moved',
        expect.objectContaining({
          sourcePath: path.join('/test/base/path', 'source-dir', 'source-file.txt'),
          destPath: path.join('/test/base/path', 'dest-dir', 'dest-file.txt')
        })
      );
    });
    
    test('宛先ファイル名が省略された場合は元のファイル名を使用する', () => {
      fs.existsSync.mockReturnValue(true);
      
      storage.moveFile('source-dir', 'source-file.txt', 'dest-dir');
      
      expect(fs.renameSync).toHaveBeenCalledWith(
        path.join('/test/base/path', 'source-dir', 'source-file.txt'),
        path.join('/test/base/path', 'dest-dir', 'source-file.txt')
      );
    });
    
    test('元のファイルが存在しない場合はStorageErrorをスローする', () => {
      fs.existsSync.mockReturnValue(false);
      
      expect(() => {
        storage.moveFile('source-dir', 'non-existing-file.txt', 'dest-dir');
      }).toThrow(StorageError);
      expect(fs.renameSync).not.toHaveBeenCalled();
    });
    
    test('移動エラーが発生した場合はStorageErrorをスローする', () => {
      fs.existsSync.mockReturnValue(true);
      fs.renameSync.mockImplementation(() => {
        throw new Error('renameSync error');
      });
      
      expect(() => {
        storage.moveFile('source-dir', 'error-file.txt', 'dest-dir');
      }).toThrow(StorageError);
    });
  });
  
  // 他のメソッドのテストも同様に実装...
  
  describe('lockFile', () => {
    test('ファイルをロックする', async () => {
      const unlock = await storage.lockFile('test-dir', 'test-file.txt');
      
      expect(typeof unlock).toBe('function');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'storage:file_locked',
        expect.objectContaining({
          path: path.join('/test/base/path', 'test-dir', 'test-file.txt')
        })
      );
    });
    
    test('既にロックされているファイルをロックするとエラーになる', async () => {
      await storage.lockFile('test-dir', 'locked-file.txt');
      
      await expect(
        storage.lockFile('test-dir', 'locked-file.txt')
      ).rejects.toThrow(StorageError);
    });
    
    test('ロック解除関数を呼び出すとロックが解除される', async () => {
      const unlock = await storage.lockFile('test-dir', 'test-file.txt');
      
      unlock();
      
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'storage:file_unlocked',
        expect.objectContaining({
          path: path.join('/test/base/path', 'test-dir', 'test-file.txt')
        })
      );
      
      // ロック解除後は再度ロックできる
      const unlock2 = await storage.lockFile('test-dir', 'test-file.txt');
      expect(typeof unlock2).toBe('function');
    });
  });
  
  describe('updateJSON', () => {
    test('JSONファイルを安全に更新する', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('{"key":"value"}');
      
      const updateFn = jest.fn().mockReturnValue({ key: 'updated' });
      
      const result = await storage.updateJSON('test-dir', 'test-file.json', updateFn);
      
      expect(updateFn).toHaveBeenCalledWith({ key: 'value' });
      expect(result).toEqual({ key: 'updated' });
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join('/test/base/path', 'test-dir', 'test-file.json'),
        JSON.stringify({ key: 'updated' }, null, 2),
        'utf8'
      );
    });
    
    test('ファイルが存在しない場合は空オブジェクトを渡す', async () => {
      fs.existsSync.mockReturnValue(false);
      
      const updateFn = jest.fn().mockReturnValue({ key: 'new' });
      
      await storage.updateJSON('test-dir', 'new-file.json', updateFn);
      
      expect(updateFn).toHaveBeenCalledWith({});
    });
    
    test('更新関数がエラーをスローしても、ロックは解除される', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('{"key":"value"}');
      
      const updateFn = jest.fn().mockImplementation(() => {
        throw new Error('update error');
      });
      
      await expect(
        storage.updateJSON('test-dir', 'error-file.json', updateFn)
      ).rejects.toThrow();
      
      // ロックが解除されているので、再度ロックできる
      const unlock = await storage.lockFile('test-dir', 'error-file.json');
      expect(typeof unlock).toBe('function');
    });
  });
  
  describe('backupFile', () => {
    test('ファイルをバックアップする', () => {
      fs.existsSync.mockReturnValue(true);
      
      const result = storage.backupFile('test-dir', 'test-file.txt');
      
      expect(result).toContain('test-file.txt.backup.');
      expect(fs.copyFileSync).toHaveBeenCalled();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'storage:file_backed_up',
        expect.objectContaining({
          originalPath: path.join('/test/base/path', 'test-dir', 'test-file.txt')
        })
      );
    });
    
    test('ファイルが存在しない場合はStorageErrorをスローする', () => {
      fs.existsSync.mockReturnValue(false);
      
      expect(() => {
        storage.backupFile('test-dir', 'non-existing-file.txt');
      }).toThrow(StorageError);
    });
    
    test('バックアップエラーが発生した場合はStorageErrorをスローする', () => {
      fs.existsSync.mockReturnValue(true);
      
      // このテスト内でのみエラーをスロー
      const originalCopyFileSync = fs.copyFileSync;
      fs.copyFileSync.mockImplementation(() => {
        throw new Error('copyFileSync error');
      });
      
      expect(() => {
        storage.backupFile('test-dir', 'error-file.txt');
      }).toThrow(StorageError);
      
      // テスト後にモックを元に戻す
      fs.copyFileSync = originalCopyFileSync;
    });
  });
});
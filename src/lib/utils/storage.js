/**
 * ストレージサービス
 * 
 * ファイルシステム操作を抽象化し、一貫したインターフェースを提供します。
 * ディレクトリ作成、ファイル読み書き、JSONデータ操作などの共通機能を提供します。
 */

const fs = require('fs');
const path = require('path');
const { StorageError } = require('../core/error-framework');

/**
 * ストレージサービスクラス
 */
class StorageService {
  /**
   * コンストラクタ
   * @param {Object} options - オプション
   * @param {string} options.basePath - ベースパス
   * @param {Object} options.logger - ロガーインスタンス
   * @param {Object} options.eventEmitter - イベントエミッターインスタンス
   */
  constructor(options = {}) {
    this.basePath = options.basePath || process.cwd();
    this.logger = options.logger || console;
    this.eventEmitter = options.eventEmitter;
    this.encoding = options.encoding || 'utf8';
    this.jsonIndent = options.jsonIndent || 2;
    this.lockTimeout = options.lockTimeout || 5000; // ミリ秒
    this.locks = new Map();
  }

  /**
   * ファイルパスを取得
   * @param {string} directory - ディレクトリ
   * @param {string} filename - ファイル名
   * @returns {string} 完全なファイルパス
   */
  getFilePath(directory, filename) {
    const dirPath = path.join(this.basePath, directory);
    return path.join(dirPath, filename);
  }

  /**
   * ディレクトリの存在を確認し、存在しない場合は作成
   * @param {string} dirPath - ディレクトリパス
   * @returns {boolean} 成功したかどうか
   */
  ensureDirectoryExists(dirPath) {
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        
        if (this.eventEmitter) {
          // 標準化されたイベント発行を使用
          if (typeof this.eventEmitter.emitStandardized === 'function') {
            this.eventEmitter.emitStandardized('storage', 'directory_created', {
              path: dirPath,
              recursive: true
            });
          } else {
            // 後方互換性のために従来のイベント発行も維持
            this.eventEmitter.emit('storage:directory_created', { path: dirPath });
          }
        }
        
        this.logger.debug(`ディレクトリを作成しました: ${dirPath}`);
      }
      return true;
    } catch (error) {
      // エラーハンドラーが設定されている場合は使用
      if (this.errorHandler) {
        this.errorHandler.handle(
          error instanceof StorageError ? error : new StorageError(
            `ディレクトリの作成に失敗しました: ${dirPath}`,
            { cause: error, context: { dirPath } }
          ),
          'StorageService',
          'ensureDirectoryExists'
        );
      }
      
      throw error instanceof StorageError ? error : new StorageError(
        `ディレクトリの作成に失敗しました: ${dirPath}`,
        { cause: error, context: { dirPath } }
      );
    }
  }

  /**
   * ファイルの存在を確認
   * @param {string} directory - ディレクトリ
   * @param {string} filename - ファイル名
   * @returns {boolean} ファイルが存在するかどうか
   */
  fileExists(directory, filename) {
    try {
      const filePath = this.getFilePath(directory, filename);
      return fs.existsSync(filePath);
    } catch (error) {
      throw new StorageError(`ファイルの存在確認に失敗しました: ${directory}/${filename}`, { cause: error });
    }
  }

  /**
   * ファイルを読み込む
   * @param {string} directory - ディレクトリ
   * @param {string} filename - ファイル名
   * @returns {string} ファイルの内容
   */
  readFile(directory, filename) {
    try {
      const filePath = this.getFilePath(directory, filename);
      
      if (!fs.existsSync(filePath)) {
        throw new StorageError(`ファイルが存在しません: ${directory}/${filename}`);
      }
      
      const content = fs.readFileSync(filePath, this.encoding);
      
      if (this.eventEmitter) {
        this.eventEmitter.emit('storage:file_read', { 
          path: filePath,
          size: content.length
        });
      }
      
      return content;
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(`ファイルの読み込みに失敗しました: ${directory}/${filename}`, { cause: error });
    }
  }

  /**
   * JSONファイルを読み込む
   * @param {string} directory - ディレクトリ
   * @param {string} filename - ファイル名
   * @returns {Object} JSONオブジェクト
   */
  readJSON(directory, filename) {
    try {
      const content = this.readFile(directory, filename);
      return JSON.parse(content);
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(`JSONファイルの解析に失敗しました: ${directory}/${filename}`, { cause: error });
    }
  }

  /**
   * ファイルを書き込む
   * @param {string} directory - ディレクトリ
   * @param {string} filename - ファイル名
   * @param {string} content - ファイルの内容
   * @returns {boolean} 成功したかどうか
   */
  writeFile(directory, filename, content) {
    try {
      const dirPath = path.join(this.basePath, directory);
      this.ensureDirectoryExists(dirPath);
      
      const filePath = path.join(dirPath, filename);
      fs.writeFileSync(filePath, content, this.encoding);
      
      if (this.eventEmitter) {
        // 標準化されたイベント発行を使用
        if (typeof this.eventEmitter.emitStandardized === 'function') {
          this.eventEmitter.emitStandardized('storage', 'file_written', {
            path: filePath,
            size: content.length,
            encoding: this.encoding
          });
        } else {
          // 後方互換性のために従来のイベント発行も維持
          this.eventEmitter.emit('storage:file_written', {
            path: filePath,
            size: content.length
          });
        }
      }
      
      this.logger.debug(`ファイルを書き込みました: ${filePath}`);
      return true;
    } catch (error) {
      // エラーハンドラーが設定されている場合は使用
      if (this.errorHandler) {
        this.errorHandler.handle(
          error instanceof StorageError ? error : new StorageError(
            `ファイルの書き込みに失敗しました: ${directory}/${filename}`,
            { cause: error, context: { directory, filename, contentSize: content.length } }
          ),
          'StorageService',
          'writeFile'
        );
      }
      
      throw error instanceof StorageError ? error : new StorageError(
        `ファイルの書き込みに失敗しました: ${directory}/${filename}`,
        { cause: error, context: { directory, filename, contentSize: content.length } }
      );
    }
  }

  /**
   * JSONファイルを書き込む
   * @param {string} directory - ディレクトリ
   * @param {string} filename - ファイル名
   * @param {Object} data - JSONオブジェクト
   * @returns {boolean} 成功したかどうか
   */
  writeJSON(directory, filename, data) {
    try {
      const content = JSON.stringify(data, null, this.jsonIndent);
      return this.writeFile(directory, filename, content);
    } catch (error) {
      throw new StorageError(`JSONファイルの書き込みに失敗しました: ${directory}/${filename}`, { cause: error });
    }
  }

  /**
   * ファイルを削除
   * @param {string} directory - ディレクトリ
   * @param {string} filename - ファイル名
   * @returns {boolean} 成功したかどうか
   */
  deleteFile(directory, filename) {
    try {
      const filePath = this.getFilePath(directory, filename);
      
      if (!fs.existsSync(filePath)) {
        return false;
      }
      
      fs.unlinkSync(filePath);
      
      if (this.eventEmitter) {
        this.eventEmitter.emit('storage:file_deleted', { path: filePath });
      }
      
      this.logger.debug(`ファイルを削除しました: ${filePath}`);
      return true;
    } catch (error) {
      throw new StorageError(`ファイルの削除に失敗しました: ${directory}/${filename}`, { cause: error });
    }
  }

  /**
   * ディレクトリを削除
   * @param {string} directory - ディレクトリ
   * @param {boolean} recursive - 再帰的に削除するかどうか
   * @returns {boolean} 成功したかどうか
   */
  deleteDirectory(directory, recursive = false) {
    try {
      const dirPath = path.join(this.basePath, directory);
      
      if (!fs.existsSync(dirPath)) {
        return false;
      }
      
      if (recursive) {
        fs.rmSync(dirPath, { recursive: true, force: true });
      } else {
        fs.rmdirSync(dirPath);
      }
      
      if (this.eventEmitter) {
        this.eventEmitter.emit('storage:directory_deleted', { 
          path: dirPath,
          recursive
        });
      }
      
      this.logger.debug(`ディレクトリを削除しました: ${dirPath}`);
      return true;
    } catch (error) {
      throw new StorageError(`ディレクトリの削除に失敗しました: ${directory}`, { cause: error });
    }
  }

  /**
   * ファイルをコピー
   * @param {string} sourceDir - 元のディレクトリ
   * @param {string} sourceFile - 元のファイル名
   * @param {string} destDir - 宛先ディレクトリ
   * @param {string} destFile - 宛先ファイル名
   * @returns {boolean} 成功したかどうか
   */
  copyFile(sourceDir, sourceFile, destDir, destFile) {
    try {
      const sourcePath = this.getFilePath(sourceDir, sourceFile);
      
      if (!fs.existsSync(sourcePath)) {
        throw new StorageError(`元のファイルが存在しません: ${sourceDir}/${sourceFile}`);
      }
      
      const destDirPath = path.join(this.basePath, destDir);
      this.ensureDirectoryExists(destDirPath);
      
      const destPath = path.join(destDirPath, destFile || sourceFile);
      fs.copyFileSync(sourcePath, destPath);
      
      if (this.eventEmitter) {
        this.eventEmitter.emit('storage:file_copied', { 
          sourcePath,
          destPath
        });
      }
      
      this.logger.debug(`ファイルをコピーしました: ${sourcePath} -> ${destPath}`);
      return true;
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(`ファイルのコピーに失敗しました: ${sourceDir}/${sourceFile} -> ${destDir}/${destFile || sourceFile}`, { cause: error });
    }
  }

  /**
   * ファイルを移動
   * @param {string} sourceDir - 元のディレクトリ
   * @param {string} sourceFile - 元のファイル名
   * @param {string} destDir - 宛先ディレクトリ
   * @param {string} destFile - 宛先ファイル名
   * @returns {boolean} 成功したかどうか
   */
  moveFile(sourceDir, sourceFile, destDir, destFile) {
    try {
      const sourcePath = this.getFilePath(sourceDir, sourceFile);
      
      if (!fs.existsSync(sourcePath)) {
        throw new StorageError(`元のファイルが存在しません: ${sourceDir}/${sourceFile}`);
      }
      
      const destDirPath = path.join(this.basePath, destDir);
      this.ensureDirectoryExists(destDirPath);
      
      const destPath = path.join(destDirPath, destFile || sourceFile);
      fs.renameSync(sourcePath, destPath);
      
      if (this.eventEmitter) {
        this.eventEmitter.emit('storage:file_moved', { 
          sourcePath,
          destPath
        });
      }
      
      this.logger.debug(`ファイルを移動しました: ${sourcePath} -> ${destPath}`);
      return true;
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(`ファイルの移動に失敗しました: ${sourceDir}/${sourceFile} -> ${destDir}/${destFile || sourceFile}`, { cause: error });
    }
  }

  /**
   * ディレクトリ内のファイル一覧を取得
   * @param {string} directory - ディレクトリ
   * @param {Object} options - オプション
   * @param {boolean} options.recursive - 再帰的に取得するかどうか
   * @param {string} options.pattern - ファイル名のパターン（正規表現）
   * @returns {Array<string>} ファイル一覧
   */
  listFiles(directory, options = {}) {
    try {
      const dirPath = path.join(this.basePath, directory);
      
      if (!fs.existsSync(dirPath)) {
        return [];
      }
      
      const pattern = options.pattern ? new RegExp(options.pattern) : null;
      
      if (!options.recursive) {
        // 非再帰的な場合
        const files = fs.readdirSync(dirPath);
        return files
          .filter(file => {
            const filePath = path.join(dirPath, file);
            const isFile = fs.statSync(filePath).isFile();
            return isFile && (!pattern || pattern.test(file));
          })
          .map(file => file);
      } else {
        // 再帰的な場合
        const results = [];
        
        function traverseDir(currentPath, relativePath = '') {
          const files = fs.readdirSync(currentPath);
          
          for (const file of files) {
            const filePath = path.join(currentPath, file);
            const relativeFilePath = relativePath ? path.join(relativePath, file) : file;
            const stat = fs.statSync(filePath);
            
            if (stat.isDirectory()) {
              traverseDir(filePath, relativeFilePath);
            } else if (!pattern || pattern.test(file)) {
              results.push(relativeFilePath);
            }
          }
        }
        
        traverseDir(dirPath);
        return results;
      }
    } catch (error) {
      throw new StorageError(`ファイル一覧の取得に失敗しました: ${directory}`, { cause: error });
    }
  }

  /**
   * ファイルのメタデータを取得
   * @param {string} directory - ディレクトリ
   * @param {string} filename - ファイル名
   * @returns {Object} メタデータ
   */
  getFileMetadata(directory, filename) {
    try {
      const filePath = this.getFilePath(directory, filename);
      
      if (!fs.existsSync(filePath)) {
        throw new StorageError(`ファイルが存在しません: ${directory}/${filename}`);
      }
      
      const stats = fs.statSync(filePath);
      
      return {
        path: filePath,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        accessed: stats.atime,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        permissions: stats.mode
      };
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(`ファイルのメタデータ取得に失敗しました: ${directory}/${filename}`, { cause: error });
    }
  }

  /**
   * ファイルをロック
   * @param {string} directory - ディレクトリ
   * @param {string} filename - ファイル名
   * @param {number} timeout - タイムアウト（ミリ秒）
   * @returns {Promise<Function>} ロック解除関数
   */
  async lockFile(directory, filename, timeout = this.lockTimeout) {
    const filePath = this.getFilePath(directory, filename);
    const lockKey = filePath;
    
    // 既存のロックをチェック
    if (this.locks.has(lockKey)) {
      const existingLock = this.locks.get(lockKey);
      
      if (existingLock.expiresAt > Date.now()) {
        throw new StorageError(`ファイルは既にロックされています: ${directory}/${filename}`);
      } else {
        // 期限切れのロックを削除
        this.locks.delete(lockKey);
      }
    }
    
    // 新しいロックを作成
    const expiresAt = Date.now() + timeout;
    const lock = { expiresAt };
    
    this.locks.set(lockKey, lock);
    
    if (this.eventEmitter) {
      this.eventEmitter.emit('storage:file_locked', { 
        path: filePath,
        expiresAt
      });
    }
    
    this.logger.debug(`ファイルをロックしました: ${filePath}`);
    
    // ロック解除関数を返す
    return () => {
      if (this.locks.get(lockKey) === lock) {
        this.locks.delete(lockKey);
        
        if (this.eventEmitter) {
          this.eventEmitter.emit('storage:file_unlocked', { path: filePath });
        }
        
        this.logger.debug(`ファイルのロックを解除しました: ${filePath}`);
      }
    };
  }

  /**
   * JSONファイルを安全に更新
   * @param {string} directory - ディレクトリ
   * @param {string} filename - ファイル名
   * @param {Function} updateFn - 更新関数
   * @returns {Promise<Object>} 更新後のJSONオブジェクト
   */
  async updateJSON(directory, filename, updateFn) {
    const unlock = await this.lockFile(directory, filename);
    
    try {
      let data = {};
      
      // ファイルが存在する場合は読み込む
      if (this.fileExists(directory, filename)) {
        data = this.readJSON(directory, filename);
      }
      
      // 更新関数を実行
      const updatedData = await updateFn(data);
      
      // 更新されたデータを書き込む
      this.writeJSON(directory, filename, updatedData);
      
      return updatedData;
    } finally {
      // 必ずロックを解除
      unlock();
    }
  }

  /**
   * ファイルを一時的にバックアップ
   * @param {string} directory - ディレクトリ
   * @param {string} filename - ファイル名
   * @returns {string} バックアップファイルのパス
   */
  backupFile(directory, filename) {
    try {
      const filePath = this.getFilePath(directory, filename);
      
      if (!fs.existsSync(filePath)) {
        throw new StorageError(`バックアップするファイルが存在しません: ${directory}/${filename}`);
      }
      
      const backupFilename = `${filename}.backup.${Date.now()}`;
      const backupPath = path.join(path.dirname(filePath), backupFilename);
      
      fs.copyFileSync(filePath, backupPath);
      
      if (this.eventEmitter) {
        this.eventEmitter.emit('storage:file_backed_up', { 
          originalPath: filePath,
          backupPath
        });
      }
      
      this.logger.debug(`ファイルをバックアップしました: ${filePath} -> ${backupPath}`);
      return backupPath;
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(`ファイルのバックアップに失敗しました: ${directory}/${filename}`, { cause: error });
    }
  }
}

module.exports = StorageService;
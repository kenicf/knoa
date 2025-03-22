/**
 * ストレージサービス
 * 
 * ファイルシステム操作を抽象化し、一貫したインターフェースを提供します。
 * JSONファイルの読み書き、テキストファイルの読み書き、ディレクトリ操作などの機能を提供します。
 */

const fs = require('fs');
const path = require('path');

/**
 * ストレージエラークラス
 */
class StorageError extends Error {
  /**
   * コンストラクタ
   * @param {string} message - エラーメッセージ
   * @param {Error} cause - 原因となったエラー
   */
  constructor(message, cause) {
    super(message);
    this.name = 'StorageError';
    this.cause = cause;
  }
}

/**
 * ストレージサービスクラス
 */
class StorageService {
  /**
   * コンストラクタ
   * @param {Object} options - オプション
   * @param {string} options.basePath - 基準パス
   * @param {Object} options.logger - ロガー
   * @param {Object} options.eventEmitter - イベントエミッター
   * @param {Object} options.errorHandler - エラーハンドラー
   */
  constructor(options = {}) {
    this.basePath = options.basePath || process.cwd();
    this.logger = options.logger || console;
    this.eventEmitter = options.eventEmitter;
    this.errorHandler = options.errorHandler;
  }

  /**
   * ファイルパスを取得（常に/区切りのパスを返す）
   * @param {string} directory - ディレクトリパス
   * @param {string} filename - ファイル名
   * @returns {string} 完全なファイルパス
   */
  getFilePath(directory, filename) {
    // path.posix.joinを使用して常に/区切りのパスを返す
    const dirPath = path.posix.join(this.basePath, directory);
    this.ensureDirectoryExists(dirPath);
    return path.posix.join(dirPath, filename);
  }

  /**
   * ディレクトリの存在を確認し、存在しない場合は作成
   * @param {string} dirPath - ディレクトリパス
   */
  ensureDirectoryExists(dirPath) {
    try {
      // Windowsの場合はパスを変換
      const nativeDirPath = process.platform === 'win32' ? dirPath.replace(/\//g, '\\') : dirPath;
      
      if (!fs.existsSync(nativeDirPath)) {
        fs.mkdirSync(nativeDirPath, { recursive: true });
        this._emitEvent('directory:created', { path: dirPath });
      }
    } catch (error) {
      this._handleError('ディレクトリの作成に失敗しました', error, {
        directory: dirPath
      });
    }
  }

  /**
   * JSONファイルを読み込む
   * @param {string} directory - ディレクトリパス
   * @param {string} filename - ファイル名
   * @returns {Object|null} JSONオブジェクト、ファイルが存在しない場合はnull
   */
  readJSON(directory, filename) {
    try {
      this._emitEvent('file:read:before', { directory, filename, type: 'json' });
      
      const filePath = this.getFilePath(directory, filename);
      // Windowsの場合はパスを変換
      const nativeFilePath = process.platform === 'win32' ? filePath.replace(/\//g, '\\') : filePath;
      
      if (!fs.existsSync(nativeFilePath)) {
        return null;
      }
      
      const content = fs.readFileSync(nativeFilePath, 'utf8');
      const data = JSON.parse(content);
      
      this._emitEvent('file:read:after', { directory, filename, type: 'json', success: true });
      
      return data;
    } catch (error) {
      this._emitEvent('file:read:after', { directory, filename, type: 'json', success: false, error });
      
      return this._handleError(`JSONファイルの読み込みに失敗しました: ${directory}/${filename}`, error, {
        directory,
        filename,
        operation: 'readJSON'
      });
    }
  }

  /**
   * JSONファイルを書き込む
   * @param {string} directory - ディレクトリパス
   * @param {string} filename - ファイル名
   * @param {Object} data - 書き込むデータ
   * @returns {boolean} 成功したかどうか
   */
  writeJSON(directory, filename, data) {
    try {
      this._emitEvent('file:write:before', { directory, filename, type: 'json' });
      
      const filePath = this.getFilePath(directory, filename);
      // Windowsの場合はパスを変換
      const nativeFilePath = process.platform === 'win32' ? filePath.replace(/\//g, '\\') : filePath;
      
      fs.writeFileSync(nativeFilePath, JSON.stringify(data, null, 2), 'utf8');
      
      this._emitEvent('file:write:after', { directory, filename, type: 'json', success: true });
      
      return true;
    } catch (error) {
      this._emitEvent('file:write:after', { directory, filename, type: 'json', success: false, error });
      
      return this._handleError(`JSONファイルの書き込みに失敗しました: ${directory}/${filename}`, error, {
        directory,
        filename,
        operation: 'writeJSON'
      });
    }
  }

  /**
   * テキストファイルを読み込む
   * @param {string} directory - ディレクトリパス
   * @param {string} filename - ファイル名
   * @returns {string|null} ファイルの内容、ファイルが存在しない場合はnull
   */
  readText(directory, filename) {
    try {
      this._emitEvent('file:read:before', { directory, filename, type: 'text' });
      
      const filePath = this.getFilePath(directory, filename);
      // Windowsの場合はパスを変換
      const nativeFilePath = process.platform === 'win32' ? filePath.replace(/\//g, '\\') : filePath;
      
      if (!fs.existsSync(nativeFilePath)) {
        return null;
      }
      
      const content = fs.readFileSync(nativeFilePath, 'utf8');
      
      this._emitEvent('file:read:after', { directory, filename, type: 'text', success: true });
      
      return content;
    } catch (error) {
      this._emitEvent('file:read:after', { directory, filename, type: 'text', success: false, error });
      
      return this._handleError(`テキストファイルの読み込みに失敗しました: ${directory}/${filename}`, error, {
        directory,
        filename,
        operation: 'readText'
      });
    }
  }

  /**
   * テキストファイルを書き込む
   * @param {string} directory - ディレクトリパス
   * @param {string} filename - ファイル名
   * @param {string} content - 書き込む内容
   * @returns {boolean} 成功したかどうか
   */
  writeText(directory, filename, content) {
    try {
      this._emitEvent('file:write:before', { directory, filename, type: 'text' });
      
      const filePath = this.getFilePath(directory, filename);
      // Windowsの場合はパスを変換
      const nativeFilePath = process.platform === 'win32' ? filePath.replace(/\//g, '\\') : filePath;
      
      fs.writeFileSync(nativeFilePath, content, 'utf8');
      
      this._emitEvent('file:write:after', { directory, filename, type: 'text', success: true });
      
      return true;
    } catch (error) {
      this._emitEvent('file:write:after', { directory, filename, type: 'text', success: false, error });
      
      return this._handleError(`テキストファイルの書き込みに失敗しました: ${directory}/${filename}`, error, {
        directory,
        filename,
        operation: 'writeText'
      });
    }
  }

  /**
   * テキストファイルを書き込む（互換性のためのエイリアス）
   * @param {string} directory - ディレクトリパス
   * @param {string} filename - ファイル名
   * @param {string} content - 書き込む内容
   * @returns {boolean} 成功したかどうか
   */
  writeFile(directory, filename, content) {
    const result = this.writeText(directory, filename, content);
    
    // 標準化されたイベントを発行
    if (this.eventEmitter) {
      const filePath = this.getFilePath(directory, filename);
      this.eventEmitter.emit('storage:file_written', {
        path: filePath,
        directory,
        filename,
        timestamp: new Date().toISOString()
      });
      
      // 標準化されたイベント発行
      if (typeof this.eventEmitter.emitStandardized === 'function') {
        this.eventEmitter.emitStandardized('storage', 'file_written', {
          path: filePath,
          directory,
          filename
        });
      }
    }
    
    return result;
  }

  /**
   * JSONファイルを更新する
   * @param {string} directory - ディレクトリパス
   * @param {string} filename - ファイル名
   * @param {Function} updateFn - 更新関数（現在のデータを受け取り、更新後のデータを返す）
   * @returns {boolean} 成功したかどうか
   */
  updateJSON(directory, filename, updateFn) {
    try {
      this._emitEvent('file:update:before', { directory, filename, type: 'json' });
      
      // 現在のデータを読み込む
      const data = this.readJSON(directory, filename) || {};
      
      // 更新関数を適用
      const updatedData = updateFn(data);
      
      // 更新されたデータを書き込む
      const result = this.writeJSON(directory, filename, updatedData);
      
      this._emitEvent('file:update:after', { directory, filename, type: 'json', success: true });
      
      return result;
    } catch (error) {
      this._emitEvent('file:update:after', { directory, filename, type: 'json', success: false, error });
      
      return this._handleError(`JSONファイルの更新に失敗しました: ${directory}/${filename}`, error, {
        directory,
        filename,
        operation: 'updateJSON'
      });
    }
  }

  /**
   * ファイルをロックする
   * @param {string} directory - ディレクトリパス
   * @param {string} filename - ファイル名
   * @param {number} timeout - タイムアウト（ミリ秒）
   * @returns {Promise<Function>} ロック解除関数
   * @throws {StorageError} ファイルが既にロックされている場合
   */
  async lockFile(directory, filename, timeout = 5000) {
    try {
      this._emitEvent('file:lock:before', { directory, filename });
      
      const filePath = this.getFilePath(directory, filename);
      const lockPath = `${filePath}.lock`;
      // Windowsの場合はパスを変換
      const nativeLockPath = process.platform === 'win32' ? lockPath.replace(/\//g, '\\') : lockPath;
      
      // ロックファイルが存在するか確認
      if (fs.existsSync(nativeLockPath)) {
        const error = new StorageError(`ファイル ${filePath} は既にロックされています`);
        this._emitEvent('file:lock:after', { directory, filename, success: false, error });
        
        // エラーイベントを発行
        if (this.eventEmitter) {
          this.eventEmitter.emit('storage:lock_failed', {
            path: filePath,
            directory,
            filename,
            error,
            timestamp: new Date().toISOString()
          });
        }
        
        throw error;
      }
      
      // ロックファイルを作成
      this.writeText(directory, `${filename}.lock`, new Date().toISOString());
      
      this._emitEvent('file:lock:after', { directory, filename, success: true });
      
      // ロック解除関数を返す
      return () => {
        if (fs.existsSync(nativeLockPath)) {
          fs.unlinkSync(nativeLockPath);
          this._emitEvent('file:unlock', { directory, filename });
        }
      };
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      
      this._emitEvent('file:lock:after', { directory, filename, success: false, error });
      
      return this._handleError(`ファイルのロックに失敗しました: ${directory}/${filename}`, error, {
        directory,
        filename,
        operation: 'lockFile'
      });
    }
  }

  /**
   * ファイルの存在を確認
   * @param {string} directory - ディレクトリパス
   * @param {string} filename - ファイル名
   * @returns {boolean} ファイルが存在するかどうか
   */
  fileExists(directory, filename) {
    try {
      const filePath = this.getFilePath(directory, filename);
      // Windowsの場合はパスを変換
      const nativeFilePath = process.platform === 'win32' ? filePath.replace(/\//g, '\\') : filePath;
      
      return fs.existsSync(nativeFilePath);
    } catch (error) {
      return this._handleError(`ファイルの存在確認に失敗しました: ${directory}/${filename}`, error, {
        directory,
        filename,
        operation: 'fileExists'
      });
    }
  }

  /**
   * ディレクトリ内のファイル一覧を取得
   * @param {string} directory - ディレクトリパス
   * @param {string} pattern - ファイル名パターン（正規表現）
   * @returns {Array<string>} ファイル名の配列
   */
  listFiles(directory, pattern = null) {
    try {
      this._emitEvent('directory:list:before', { directory, pattern });
      
      const dirPath = path.posix.join(this.basePath, directory);
      // Windowsの場合はパスを変換
      const nativeDirPath = process.platform === 'win32' ? dirPath.replace(/\//g, '\\') : dirPath;
      
      if (!fs.existsSync(nativeDirPath)) {
        return [];
      }
      
      let files = fs.readdirSync(nativeDirPath);
      
      // パターンが指定されている場合はフィルタリング
      if (pattern) {
        const regex = new RegExp(pattern);
        files = files.filter(file => regex.test(file));
      }
      
      this._emitEvent('directory:list:after', { directory, pattern, success: true, count: files.length });
      
      return files;
    } catch (error) {
      this._emitEvent('directory:list:after', { directory, pattern, success: false, error });
      
      return this._handleError(`ディレクトリ内のファイル一覧取得に失敗しました: ${directory}`, error, {
        directory,
        pattern,
        operation: 'listFiles'
      });
    }
  }

  /**
   * ファイルを削除
   * @param {string} directory - ディレクトリパス
   * @param {string} filename - ファイル名
   * @returns {boolean} 成功したかどうか
   */
  deleteFile(directory, filename) {
    try {
      this._emitEvent('file:delete:before', { directory, filename });
      
      const filePath = this.getFilePath(directory, filename);
      // Windowsの場合はパスを変換
      const nativeFilePath = process.platform === 'win32' ? filePath.replace(/\//g, '\\') : filePath;
      
      if (!fs.existsSync(nativeFilePath)) {
        return false;
      }
      
      fs.unlinkSync(nativeFilePath);
      
      this._emitEvent('file:delete:after', { directory, filename, success: true });
      
      return true;
    } catch (error) {
      this._emitEvent('file:delete:after', { directory, filename, success: false, error });
      
      return this._handleError(`ファイルの削除に失敗しました: ${directory}/${filename}`, error, {
        directory,
        filename,
        operation: 'deleteFile'
      });
    }
  }

  /**
   * ディレクトリを削除
   * @param {string} directory - ディレクトリパス
   * @param {boolean} recursive - サブディレクトリも削除するかどうか
   * @returns {boolean} 成功したかどうか
   */
  deleteDirectory(directory, recursive = false) {
    try {
      this._emitEvent('directory:delete:before', { directory, recursive });
      
      const dirPath = path.posix.join(this.basePath, directory);
      // Windowsの場合はパスを変換
      const nativeDirPath = process.platform === 'win32' ? dirPath.replace(/\//g, '\\') : dirPath;
      
      if (!fs.existsSync(nativeDirPath)) {
        return false;
      }
      
      fs.rmdirSync(nativeDirPath, { recursive });
      
      this._emitEvent('directory:delete:after', { directory, recursive, success: true });
      
      return true;
    } catch (error) {
      this._emitEvent('directory:delete:after', { directory, recursive, success: false, error });
      
      return this._handleError(`ディレクトリの削除に失敗しました: ${directory}`, error, {
        directory,
        recursive,
        operation: 'deleteDirectory'
      });
    }
  }

  /**
   * ファイルをコピー
   * @param {string} sourceDir - コピー元ディレクトリパス
   * @param {string} sourceFile - コピー元ファイル名
   * @param {string} destDir - コピー先ディレクトリパス
   * @param {string} destFile - コピー先ファイル名
   * @returns {boolean} 成功したかどうか
   */
  copyFile(sourceDir, sourceFile, destDir, destFile) {
    try {
      this._emitEvent('file:copy:before', { sourceDir, sourceFile, destDir, destFile });
      
      const sourcePath = this.getFilePath(sourceDir, sourceFile);
      const destPath = this.getFilePath(destDir, destFile);
      
      // Windowsの場合はパスを変換
      const nativeSourcePath = process.platform === 'win32' ? sourcePath.replace(/\//g, '\\') : sourcePath;
      const nativeDestPath = process.platform === 'win32' ? destPath.replace(/\//g, '\\') : destPath;
      
      if (!fs.existsSync(nativeSourcePath)) {
        return false;
      }
      
      fs.copyFileSync(nativeSourcePath, nativeDestPath);
      
      this._emitEvent('file:copy:after', { sourceDir, sourceFile, destDir, destFile, success: true });
      
      return true;
    } catch (error) {
      this._emitEvent('file:copy:after', { sourceDir, sourceFile, destDir, destFile, success: false, error });
      
      return this._handleError(`ファイルのコピーに失敗しました: ${sourceDir}/${sourceFile} -> ${destDir}/${destFile}`, error, {
        sourceDir,
        sourceFile,
        destDir,
        destFile,
        operation: 'copyFile'
      });
    }
  }

  /**
   * イベントを発行
   * @private
   * @param {string} eventName - イベント名
   * @param {Object} data - イベントデータ
   */
  _emitEvent(eventName, data) {
    if (this.eventEmitter) {
      // 標準化されたイベント発行メソッドがあれば使用
      if (typeof this.eventEmitter.emitStandardized === 'function') {
        const [category, action] = eventName.split(':');
        this.eventEmitter.emitStandardized('storage', eventName, {
          ...data,
          timestamp: new Date().toISOString()
        });
      } else {
        // 後方互換性のために従来のイベント発行も維持
        // イベント名がすでにstorage:で始まっている場合は、そのまま使用
        const fullEventName = eventName.startsWith('storage:') ? eventName : `storage:${eventName}`;
        this.eventEmitter.emit(fullEventName, {
          ...data,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  /**
   * エラーを処理
   * @private
   * @param {string} message - エラーメッセージ
   * @param {Error} error - 原因となったエラー
   * @param {Object} context - エラーコンテキスト
   * @returns {null|boolean} エラー処理の結果
   */
  _handleError(message, error, context = {}) {
    const storageError = new StorageError(message, error);
    
    // エラーハンドラーがあれば使用
    if (this.errorHandler && typeof this.errorHandler.handle === 'function') {
      return this.errorHandler.handle(storageError, 'StorageService', context.operation, context);
    }
    
    // エラーハンドラーがなければログに出力
    this.logger.error(message, {
      error: error.message,
      stack: error.stack,
      context
    });
    
    // エラーイベントを発行
    if (this.eventEmitter) {
      this.eventEmitter.emit('error', storageError);
    }
    
    // 操作に応じてデフォルト値を返す
    if (context.operation === 'fileExists') {
      return false;
    } else if (context.operation === 'readJSON' || context.operation === 'readText') {
      return null;
    } else {
      return false;
    }
  }
}

module.exports = StorageService;
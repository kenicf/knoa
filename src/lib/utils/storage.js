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
    // ディレクトリパスの正規化
    const normalizedDir = directory.replace(/\\/g, '/');
    
    // 基準パスからの相対パスを構築
    const relativePath = path.join(
      this.basePath,
      normalizedDir,
      filename
    ).replace(/\\/g, '/');
    
    return relativePath;
  }

  /**
   * JSONファイルを読み込む
   * @param {string} filePath - ファイルパス、または
   * @param {string} [filename] - ファイル名（directoryと一緒に使用）
   * @returns {Object|null} JSONオブジェクト、ファイルが存在しない場合はnull
   */
  readJSON(filePath, filename) {
    try {
      // パスが2つの引数で呼び出された場合の処理
      let directory = filePath;
      let actualFilePath = filePath;
      
      // トレースIDとリクエストIDの生成
      const traceId = `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      if (filename) {
        actualFilePath = this.getFilePath(directory, filename);
        this._emitEvent('file_read_before', {
          directory,
          filename,
          type: 'json',
          traceId,
          requestId,
          timestamp: new Date().toISOString()
        });
      } else {
        this._emitEvent('file_read_before', {
          filePath,
          type: 'json',
          traceId,
          requestId,
          timestamp: new Date().toISOString()
        });
      }
      
      // Windowsの場合はパスを変換
      const nativeFilePath = process.platform === 'win32' ? actualFilePath.replace(/\//g, '\\') : actualFilePath;
      
      if (!fs.existsSync(nativeFilePath)) {
        return null;
      }
      
      const content = fs.readFileSync(nativeFilePath, 'utf8');
      const data = JSON.parse(content);
      
      if (filename) {
        this._emitEvent('file_read_after', {
          directory,
          filename,
          type: 'json',
          success: true,
          traceId,
          requestId,
          timestamp: new Date().toISOString()
        });
      } else {
        this._emitEvent('file_read_after', {
          filePath,
          type: 'json',
          success: true,
          traceId,
          requestId,
          timestamp: new Date().toISOString()
        });
      }
      
      return data;
    } catch (error) {
      // トレースIDとリクエストIDの生成（エラー時）
      const traceId = `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      if (filename) {
        this._emitEvent('file_read_after', {
          directory: filePath,
          filename,
          type: 'json',
          success: false,
          error: error.message,
          traceId,
          requestId,
          timestamp: new Date().toISOString()
        });
        return this._handleError(`JSONファイルの読み込みに失敗しました: ${filePath}/${filename}`, error, {
          directory: filePath,
          filename,
          operation: 'readJSON',
          traceId,
          requestId
        });
      } else {
        this._emitEvent('file_read_after', {
          filePath,
          type: 'json',
          success: false,
          error: error.message,
          traceId,
          requestId,
          timestamp: new Date().toISOString()
        });
        return this._handleError(`JSONファイルの読み込みに失敗しました: ${filePath}`, error, {
          filePath,
          operation: 'readJSON',
          traceId,
          requestId
        });
      }
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
   * @returns {string|null} テキスト内容、ファイルが存在しない場合はnull
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
      // ディレクトリが存在しない場合は作成
      this._ensureDirectoryExists(path.dirname(filePath));
      
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
   * ファイルを書き込む（バイナリ対応）
   * @param {string} directory - ディレクトリパス
   * @param {string} filename - ファイル名
   * @param {Buffer|string} content - 書き込む内容
   * @returns {boolean} 成功したかどうか
   */
  writeFile(directory, filename, content) {
    try {
      this._emitEvent('file:write:before', { directory, filename });
      
      const filePath = this.getFilePath(directory, filename);
      // ディレクトリが存在しない場合は作成
      this._ensureDirectoryExists(path.dirname(filePath));
      
      // Windowsの場合はパスを変換
      const nativeFilePath = process.platform === 'win32' ? filePath.replace(/\//g, '\\') : filePath;
      
      fs.writeFileSync(nativeFilePath, content);
      
      this._emitEvent('file:write:after', { directory, filename, success: true });
      
      return true;
    } catch (error) {
      this._emitEvent('file:write:after', { directory, filename, success: false, error });
      
      return this._handleError(`ファイルの書き込みに失敗しました: ${directory}/${filename}`, error, {
        directory,
        filename,
        operation: 'writeFile'
      });
    }
  }

  /**
   * JSONファイルを更新する
   * @param {string} directory - ディレクトリパス
   * @param {string} filename - ファイル名
   * @param {Function} updateFn - 更新関数 (data) => updatedData
   * @returns {boolean} 成功したかどうか
   */
  updateJSON(directory, filename, updateFn) {
    try {
      this._emitEvent('file:update:before', { directory, filename, type: 'json' });
      
      const filePath = this.getFilePath(directory, filename);
      // Windowsの場合はパスを変換
      const nativeFilePath = process.platform === 'win32' ? filePath.replace(/\//g, '\\') : filePath;
      
      let data = {};
      
      if (fs.existsSync(nativeFilePath)) {
        const content = fs.readFileSync(nativeFilePath, 'utf8');
        data = JSON.parse(content);
      }
      
      const updatedData = updateFn(data);
      
      // ディレクトリが存在しない場合は作成
      this._ensureDirectoryExists(path.dirname(filePath));
      
      fs.writeFileSync(nativeFilePath, JSON.stringify(updatedData, null, 2), 'utf8');
      
      this._emitEvent('file:update:after', { directory, filename, type: 'json', success: true });
      
      return true;
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
   * ファイルをロックして操作を行う
   * @param {string} directory - ディレクトリパス
   * @param {string} filename - ファイル名
   * @param {number} timeout - タイムアウト時間(ms)
   * @returns {Promise<Object>} ロックオブジェクト
   */
  async lockFile(directory, filename, timeout = 5000) {
    const filePath = this.getFilePath(directory, filename);
    const lockPath = `${filePath}.lock`;
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        // ロックファイルが存在しない場合は作成
        if (!fs.existsSync(lockPath)) {
          // ディレクトリが存在しない場合は作成
          this._ensureDirectoryExists(path.dirname(lockPath));
          
          // ロック情報を書き込む
          fs.writeFileSync(lockPath, JSON.stringify({
            pid: process.pid,
            timestamp: Date.now()
          }), 'utf8');
          
          // ロック解除関数を返す
          return {
            release: () => {
              if (fs.existsSync(lockPath)) {
                fs.unlinkSync(lockPath);
              }
            }
          };
        }
        
        // ロックファイルが存在する場合は待機
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        this.logger.warn('ファイルロック中にエラーが発生しました:', error);
      }
    }
    
    throw new Error(`ファイルロックのタイムアウト: ${directory}/${filename}`);
  }

  /**
   * ファイルの存在を確認
   * @param {string} filePath - ファイルパス
   * @returns {boolean} ファイルが存在するかどうか
   */
  fileExists(filePath) {
    try {
      // パスが2つの引数で呼び出された場合の後方互換性
      if (arguments.length === 2) {
        const directory = arguments[0];
        const filename = arguments[1];
        filePath = this.getFilePath(directory, filename);
      }
      
      // Windowsの場合はパスを変換
      const nativeFilePath = process.platform === 'win32' ? filePath.replace(/\//g, '\\') : filePath;
      
      return fs.existsSync(nativeFilePath);
    } catch (error) {
      return this._handleError(`ファイルの存在確認に失敗しました: ${filePath}`, error, {
        filePath,
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
      
      const dirPath = path.join(this.basePath, directory);
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
      
      return this._handleError(`ディレクトリの一覧取得に失敗しました: ${directory}`, error, {
        directory,
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
        return true; // 既に存在しない場合は成功とみなす
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
   * @param {boolean} recursive - 再帰的に削除するかどうか
   * @returns {boolean} 成功したかどうか
   */
  deleteDirectory(directory, recursive = false) {
    try {
      this._emitEvent('directory:delete:before', { directory, recursive });
      
      const dirPath = path.join(this.basePath, directory);
      // Windowsの場合はパスを変換
      const nativeDirPath = process.platform === 'win32' ? dirPath.replace(/\//g, '\\') : dirPath;
      
      if (!fs.existsSync(nativeDirPath)) {
        return true; // 既に存在しない場合は成功とみなす
      }
      
      if (recursive) {
        this._removeDirectoryRecursive(nativeDirPath);
      } else {
        fs.rmdirSync(nativeDirPath);
      }
      
      this._emitEvent('directory:delete:after', { directory, recursive, success: true });
      
      return true;
    } catch (error) {
      this._emitEvent('directory:delete:after', { directory, recursive, success: false, error });
      
      return this._handleError(`ディレクトリの削除に失敗しました: ${directory}`, error, {
        directory,
        operation: 'deleteDirectory'
      });
    }
  }

  /**
   * ファイルをコピー
   * @param {string} sourceDir - コピー元ディレクトリ
   * @param {string} sourceFile - コピー元ファイル名
   * @param {string} destDir - コピー先ディレクトリ
   * @param {string} destFile - コピー先ファイル名
   * @returns {boolean} 成功したかどうか
   */
  copyFile(sourceDir, sourceFile, destDir, destFile) {
    try {
      this._emitEvent('file:copy:before', { sourceDir, sourceFile, destDir, destFile });
      
      const sourcePath = this.getFilePath(sourceDir, sourceFile);
      const destPath = this.getFilePath(destDir, destFile);
      
      // ディレクトリが存在しない場合は作成
      this._ensureDirectoryExists(path.dirname(destPath));
      
      // Windowsの場合はパスを変換
      const nativeSourcePath = process.platform === 'win32' ? sourcePath.replace(/\//g, '\\') : sourcePath;
      const nativeDestPath = process.platform === 'win32' ? destPath.replace(/\//g, '\\') : destPath;
      
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
   * @param {string} eventName - イベント名
   * @param {Object} data - イベントデータ
   * @private
   */
  _emitEvent(eventName, data) {
    if (!this.eventEmitter) {
      return;
    }
    
    try {
      // イベント名のパース
      let component = 'storage';
      let action;
      
      if (eventName.includes(':')) {
        // 'file:read:before' → 'file_read_before'
        const parts = eventName.split(':');
        action = parts.join('_');
      } else {
        action = eventName;
      }
      
      // トレースIDとリクエストIDの生成
      const traceId = data.traceId || `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const requestId = data.requestId || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // 標準化されたイベントデータ
      const standardizedData = {
        ...data,
        traceId,
        requestId,
        component: 'storage',
        timestamp: new Date().toISOString()
      };
      
      // 標準化されたイベント発行
      if (typeof this.eventEmitter.emitStandardized === 'function') {
        this.eventEmitter.emitStandardized(component, action, standardizedData);
      } else {
        // 後方互換性のため
        const prefixedEventName = eventName.startsWith('storage:') ? eventName : `storage:${eventName}`;
        this.eventEmitter.emit(prefixedEventName, standardizedData);
        
        // 開発環境では警告を表示
        if (process.env.NODE_ENV === 'development') {
          console.warn(`非推奨のイベント名 ${prefixedEventName} が使用されています。代わりに ${component}:${action} を使用してください。`);
        } else {
          this.logger.warn(`非標準のイベント発行が使用されました: ${prefixedEventName}`, { action });
        }
      }
    } catch (error) {
      this.logger.warn(`イベント発行中にエラーが発生しました: ${eventName}`, error);
    }
  }

  /**
   * エラーを処理
   * @param {string} message - エラーメッセージ
   * @param {Error} error - 元のエラー
   * @param {Object} context - コンテキスト情報
   * @returns {any} エラーハンドラーの戻り値
   * @private
   */
  _handleError(message, error, context = {}) {
    const storageError = new StorageError(message, error);
    
    if (this.errorHandler) {
      return this.errorHandler.handle(storageError, 'StorageService', context.operation, {
        ...context,
        component: 'StorageService'
      });
    } else {
      this.logger.error(`[StorageService] ${context.operation} failed:`, storageError);
      
      // 操作に応じてデフォルト値を返す
      if (context.operation === 'readJSON' || context.operation === 'readText') {
        return null;
      } else {
        return false;
      }
    }
  }

  /**
   * ディレクトリが存在することを確認し、存在しない場合は作成
   * @param {string} dirPath - ディレクトリパス
   * @private
   */
  _ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      this._emitEvent('directory:created', { path: dirPath });
    }
  }

  /**
   * ディレクトリが存在することを確認し、存在しない場合は作成（パブリックメソッド）
   * @param {string} dirPath - ディレクトリパス
   */
  ensureDirectoryExists(dirPath) {
    try {
      const fullPath = path.join(this.basePath, dirPath);
      this._ensureDirectoryExists(fullPath);
      return true;
    } catch (error) {
      return this._handleError(`ディレクトリの作成に失敗しました: ${dirPath}`, error, {
        directory: dirPath,
        operation: 'ensureDirectoryExists'
      });
    }
  }

  /**
   * ディレクトリを再帰的に削除
   * @param {string} dirPath - ディレクトリパス
   * @private
   */
  _removeDirectoryRecursive(dirPath) {
    if (fs.existsSync(dirPath)) {
      fs.readdirSync(dirPath).forEach((file) => {
        const curPath = path.join(dirPath, file);
        if (fs.lstatSync(curPath).isDirectory()) {
          // 再帰的に削除
          this._removeDirectoryRecursive(curPath);
        } else {
          // ファイルを削除
          fs.unlinkSync(curPath);
        }
      });
      fs.rmdirSync(dirPath);
    }
  }
}

module.exports = StorageService;
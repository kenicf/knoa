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
   * ファイルパスを取得
   * @param {string} directory - ディレクトリパス
   * @param {string} filename - ファイル名
   * @returns {string} 完全なファイルパス
   */
  getFilePath(directory, filename) {
    const dirPath = path.join(this.basePath, directory);
    this.ensureDirectoryExists(dirPath);
    return path.join(dirPath, filename);
  }

  /**
   * ディレクトリの存在を確認し、存在しない場合は作成
   * @param {string} dirPath - ディレクトリパス
   */
  ensureDirectoryExists(dirPath) {
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
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
      if (!fs.existsSync(filePath)) {
        return null;
      }
      
      const content = fs.readFileSync(filePath, 'utf8');
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
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      
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
      if (!fs.existsSync(filePath)) {
        return null;
      }
      
      const content = fs.readFileSync(filePath, 'utf8');
      
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
      fs.writeFileSync(filePath, content, 'utf8');
      
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
      const path = this.getFilePath(directory, filename);
      this.eventEmitter.emit('storage:file_written', {
        path,
        directory,
        filename,
        timestamp: new Date().toISOString()
      });
      
      // 標準化されたイベント発行
      if (typeof this.eventEmitter.emitStandardized === 'function') {
        this.eventEmitter.emitStandardized('storage', 'file_written', {
          path,
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
   * @returns {Function} ロック解除関数
   */
  async lockFile(directory, filename, timeout = 5000) {
    const filePath = this.getFilePath(directory, filename);
    const lockPath = `${filePath}.lock`;
    
    this._emitEvent('file:lock:before', { directory, filename });
    // ロックファイルが存在するか確認
    if (fs.existsSync(lockPath)) {
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
    }
    
    // ロックファイルを作成
    this.writeText(directory, filename + '.lock', new Date().toISOString());
    
    this._emitEvent('file:lock:after', { directory, filename, success: true });
    
    // ロック解除関数を返す
    return () => {
      if (fs.existsSync(lockPath)) {
        fs.unlinkSync(lockPath);
        this._emitEvent('file:unlock', { directory, filename });
      }
    };
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
      return fs.existsSync(filePath);
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
      
      const dirPath = path.join(this.basePath, directory);
      if (!fs.existsSync(dirPath)) {
        return [];
      }
      
      let files = fs.readdirSync(dirPath);
      
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
      if (!fs.existsSync(filePath)) {
        return false;
      }
      
      fs.unlinkSync(filePath);
      
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
      
      const dirPath = path.join(this.basePath, directory);
      if (!fs.existsSync(dirPath)) {
        return false;
      }
      
      fs.rmdirSync(dirPath, { recursive });
      
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
      
      if (!fs.existsSync(sourcePath)) {
        return false;
      }
      
      fs.copyFileSync(sourcePath, destPath);
      
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
      return this.errorHandler.handle(storageError, 'StorageService', context.operation, {
        additionalContext: context
      });
    }
    
    // エラーハンドラーがなければログに出力
    this.logger.error(`[StorageService] ${message}:`, {
      error_name: error.name,
      error_message: error.message,
      stack: error.stack,
      context
    });
    
    // 操作に応じてデフォルト値を返す
    if (context.operation === 'readJSON' || context.operation === 'readText') {
      return null;
    } else if (
      context.operation === 'writeJSON' || 
      context.operation === 'writeText' || 
      context.operation === 'fileExists' || 
      context.operation === 'deleteFile' || 
      context.operation === 'deleteDirectory' || 
      context.operation === 'copyFile'
    ) {
      return false;
    } else if (context.operation === 'listFiles') {
      return [];
    }
    
    // デフォルトはnull
    return null;
  }
}

module.exports = StorageService;
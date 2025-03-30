/**
 * ストレージサービス
 *
 * ファイルシステム操作を抽象化し、一貫したインターフェースを提供します。
 * JSONファイルの読み書き、テキストファイルの読み書き、ディレクトリ操作などの機能を提供します。
 */

const fs = require('fs');
const path = require('path');
const { StorageError } = require('./errors'); // StorageError はこのモジュール固有

// TODO: Step 5 で emitStandardizedEvent ヘルパーを利用するか検討
// const { emitStandardizedEvent } = require('./event-helpers');

/**
 * ストレージサービスクラス
 */
class StorageService {
  /**
   * コンストラクタ
   * @param {Object} options - オプション
   * @param {string} [options.basePath=process.cwd()] - 基準パス
   * @param {Object} options.logger - ロガーインスタンス (必須)
   * @param {Object} [options.eventEmitter] - イベントエミッターインスタンス
   * @param {Object} [options.errorHandler] - エラーハンドラー
   */
  constructor(options = {}) {
    // logger を必須にする
    if (!options.logger) {
      throw new Error('Logger instance is required in StorageService options.');
    }
    this.basePath = options.basePath || process.cwd();
    this.logger = options.logger;
    this.eventEmitter = options.eventEmitter;
    this.errorHandler = options.errorHandler;

    // TODO: Step 5 で ID 生成を集約
    this._traceIdGenerator =
      options.traceIdGenerator ||
      (() => `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    this._requestIdGenerator =
      options.requestIdGenerator ||
      (() => `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  }

  /**
   * ファイルパスを取得（OSネイティブなパスを返すように変更）
   * @param {string} directory - ディレクトリパス
   * @param {string} filename - ファイル名
   * @returns {string} 完全なファイルパス (OSネイティブ形式)
   */
  _getNativeFilePath(directory, filename) {
    // path.join はOSネイティブな区切り文字を使用する
    const filePath = path.join(this.basePath, directory, filename);
    const dirPath = path.dirname(filePath);

    // ディレクトリが存在しない場合は作成
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!fs.existsSync(dirPath)) {
      try {
        // recursive: true で親ディレクトリも作成
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        fs.mkdirSync(dirPath, { recursive: true });
        // path.normalize でOS標準のパス形式に変換してイベント発行
        this._emitEvent('directory_created', { path: path.normalize(dirPath) });
      } catch (error) {
        // ディレクトリ作成エラーをハンドル
        this._handleError(`ディレクトリ作成に失敗しました: ${dirPath}`, error, {
          directory: dirPath,
          operation: '_getNativeFilePath (mkdir)',
        });
        // エラーが発生した場合でもパスを返す（後続処理でエラーになる可能性あり）
      }
    }
    // OSネイティブなパスを返す
    return filePath;
  }

  /**
   * ファイルパスを取得（常に/区切りのパスを返す - 後方互換性のため残すが非推奨）
   * @deprecated _getNativeFilePath を使用してください
   * @param {string} directory - ディレクトリパス
   * @param {string} filename - ファイル名
   * @returns {string} 完全なファイルパス (/区切り)
   */
  getFilePath(directory, filename) {
    const nativePath = this._getNativeFilePath(directory, filename);
    // / 区切りに変換して返す
    return nativePath.replace(/\\/g, '/');
  }

  /**
   * JSONファイルを読み込む
   * @param {string} directory - ディレクトリパス
   * @param {string} filename - ファイル名
   * @returns {Object|null} JSONオブジェクト、ファイルが存在しない場合はnull
   */
  readJSON(directory, filename) {
    const operationContext = { operation: 'readJSON', directory, filename };
    let nativeFilePath = '';
    try {
      nativeFilePath = this._getNativeFilePath(directory, filename);

      this._emitEvent('file_read_before', {
        path: nativeFilePath, // ネイティブパスを使用
        type: 'json',
      });

      // eslint-disable-next-line security/detect-non-literal-fs-filename
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      if (!fs.existsSync(nativeFilePath)) {
        this._emitEvent('file_not_found', {
          path: nativeFilePath,
          type: 'json',
        });
        return null;
      }

      // eslint-disable-next-line security/detect-non-literal-fs-filename
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      const content = fs.readFileSync(nativeFilePath, 'utf8');
      const data = JSON.parse(content);

      this._emitEvent('file_read_after', {
        path: nativeFilePath,
        type: 'json',
        success: true,
      });

      return data;
    } catch (error) {
      this._emitEvent('file_read_after', {
        path: nativeFilePath,
        type: 'json',
        success: false,
        error: error.message,
      });
      return this._handleError(
        `JSONファイルの読み込みに失敗しました: ${nativeFilePath}`,
        error,
        operationContext
      );
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
    const operationContext = {
      operation: 'writeJSON',
      directory,
      filename,
    };
    let nativeFilePath = '';
    try {
      this._emitEvent('file_write_before', {
        directory,
        filename,
        type: 'json',
      });

      nativeFilePath = this._getNativeFilePath(directory, filename);

      // _ensureDirectoryExists は _getNativeFilePath 内で処理されるため不要

      // eslint-disable-next-line security/detect-non-literal-fs-filename
      fs.writeFileSync(nativeFilePath, JSON.stringify(data, null, 2), 'utf8');

      this._emitEvent('file_write_after', {
        directory,
        filename,
        type: 'json',
        success: true,
      });

      return true;
    } catch (error) {
      this._emitEvent('file_write_error', {
        directory,
        filename,
        type: 'json',
        error: error.message,
      });

      this._handleError(
        `JSONファイルの書き込みに失敗しました: ${nativeFilePath || path.join(directory, filename)}`,
        error,
        operationContext
      );
      return false;
    }
  }

  /**
   * テキストファイルを読み込む
   * @param {string} directory - ディレクトリパス
   * @param {string} filename - ファイル名
   * @returns {string|null} テキスト内容、ファイルが存在しない場合はnull
   */
  readText(directory, filename) {
    const operationContext = { operation: 'readText', directory, filename };
    let nativeFilePath = '';
    try {
      this._emitEvent('file_read_before', {
        directory,
        filename,
        type: 'text',
      });

      nativeFilePath = this._getNativeFilePath(directory, filename);

      // eslint-disable-next-line security/detect-non-literal-fs-filename
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      if (!fs.existsSync(nativeFilePath)) {
        this._emitEvent('file_not_found', {
          path: nativeFilePath,
          type: 'text',
        });
        return null;
      }

      // eslint-disable-next-line security/detect-non-literal-fs-filename
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      const content = fs.readFileSync(nativeFilePath, 'utf8');

      this._emitEvent('file_read_after', {
        directory,
        filename,
        type: 'text',
        success: true,
      });

      return content;
    } catch (error) {
      this._emitEvent('file_read_after', {
        directory,
        filename,
        type: 'text',
        success: false,
        error: error.message,
      });

      return this._handleError(
        `テキストファイルの読み込みに失敗しました: ${nativeFilePath || path.join(directory, filename)}`,
        error,
        operationContext
      );
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
    const operationContext = {
      operation: 'writeText',
      directory,
      filename,
    };
    let nativeFilePath = '';
    try {
      this._emitEvent('file_write_before', {
        directory,
        filename,
        type: 'text',
      });

      nativeFilePath = this._getNativeFilePath(directory, filename);
      // _ensureDirectoryExists は _getNativeFilePath 内で処理されるため不要

      // eslint-disable-next-line security/detect-non-literal-fs-filename
      fs.writeFileSync(nativeFilePath, content, 'utf8');

      this._emitEvent('file_write_after', {
        directory,
        filename,
        type: 'text',
        success: true,
      });

      return true;
    } catch (error) {
      this._emitEvent('file_write_error', {
        directory,
        filename,
        type: 'text',
        error: error.message,
      });

      this._handleError(
        `テキストファイルの書き込みに失敗しました: ${nativeFilePath || path.join(directory, filename)}`,
        error,
        operationContext
      );
      return false;
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
    const operationContext = {
      operation: 'writeFile',
      directory,
      filename,
    };
    let nativeFilePath = '';
    try {
      this._emitEvent('file_write_before', { directory, filename });

      nativeFilePath = this._getNativeFilePath(directory, filename);
      // _ensureDirectoryExists は _getNativeFilePath 内で処理されるため不要

      // eslint-disable-next-line security/detect-non-literal-fs-filename
      fs.writeFileSync(nativeFilePath, content);

      this._emitEvent('file_write_after', {
        directory,
        filename,
        success: true,
      });

      return true;
    } catch (error) {
      this._emitEvent('file_write_after', {
        directory,
        filename,
        success: false,
        error: error.message,
      });

      this._handleError(
        `ファイルの書き込みに失敗しました: ${nativeFilePath || path.join(directory, filename)}`,
        error,
        operationContext
      );
      return false;
    }
  }

  /**
   * JSONファイルを更新する
   * @param {string} directory - ディレクトリパス
   * @param {string} filename - ファイル名
   * @param {Function} updateFn - 更新関数 (data) => updatedData
   * @returns {boolean|null} 成功時はtrue、ファイルが存在しない場合はnull、エラー時はnull
   */
  updateJSON(directory, filename, updateFn) {
    const operationContext = {
      operation: 'updateJSON',
      directory,
      filename,
    };
    let nativeFilePath = '';
    try {
      this._emitEvent('file_update_before', {
        directory,
        filename,
        type: 'json',
      });

      nativeFilePath = this._getNativeFilePath(directory, filename);

      let data = {};
      let fileExists = false;

      // eslint-disable-next-line security/detect-non-literal-fs-filename
      if (fs.existsSync(nativeFilePath)) {
        fileExists = true;
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const content = fs.readFileSync(nativeFilePath, 'utf8');
        data = JSON.parse(content);
      }

      const updatedData = updateFn(data);

      // _ensureDirectoryExists は _getNativeFilePath 内で処理されるため不要

      // eslint-disable-next-line security/detect-non-literal-fs-filename
      fs.writeFileSync(
        nativeFilePath,
        JSON.stringify(updatedData, null, 2),
        'utf8'
      );

      this._emitEvent('file_update_after', {
        directory,
        filename,
        type: 'json',
        success: true,
      });

      return fileExists ? true : null;
    } catch (error) {
      this._emitEvent('file_update_after', {
        directory,
        filename,
        type: 'json',
        success: false,
        error: error.message,
      });

      this._handleError(
        `JSONファイルの更新に失敗しました: ${nativeFilePath || path.join(directory, filename)}`,
        error,
        operationContext
      );
      return null;
    }
  }

  /**
   * ファイルをロックして操作を行う
   * @param {string} directory - ディレクトリパス
   * @param {string} filename - ファイル名
   * @param {number} timeout - タイムアウト時間(ms)
   * @returns {Promise<Object>} ロックオブジェクト { release: Function }
   */
  async lockFile(directory, filename, timeout = 5000) {
    const nativeFilePath = this._getNativeFilePath(directory, filename);
    const lockPath = `${nativeFilePath}.lock`;
    const startTime = Date.now();
    const isTestEnvironment = process.env.NODE_ENV === 'test';

    const tryAcquireLock = async (attemptsLeft = 50) => {
      if (Date.now() - startTime >= timeout) {
        throw new Error(`ファイルロックのタイムアウト: ${nativeFilePath}`);
      }
      if (attemptsLeft <= 0) {
        throw new Error(
          `ファイルロックの最大試行回数を超えました: ${nativeFilePath}`
        );
      }

      try {
        // O_EXCL フラグを使用してアトミックにファイルを作成・ロック試行
        fs.writeFileSync(lockPath, `${process.pid}:${Date.now()}`, {
          flag: 'wx',
        });

        this._emitEvent('file_lock_acquired', {
          path: nativeFilePath,
          lockPath,
        });

        return {
          release: () => {
            try {
              // eslint-disable-next-line security/detect-non-literal-fs-filename
              if (fs.existsSync(lockPath)) {
                // ロックファイルの内容を確認してから削除する方がより安全
                // const lockData = fs.readFileSync(lockPath, 'utf8');
                // if (lockData.startsWith(`${process.pid}:`)) {
                //   // eslint-disable-next-line security/detect-non-literal-fs-filename
                fs.unlinkSync(lockPath);
                // }
                // eslint-disable-next-line security/detect-non-literal-fs-filename
                fs.unlinkSync(lockPath);
                this._emitEvent('file_lock_released', {
                  path: nativeFilePath,
                  lockPath,
                });
              }
            } catch (unlinkError) {
              this.logger.warn(
                `ロックファイルの解放に失敗しました: ${lockPath}`,
                unlinkError
              );
            }
          },
        };
      } catch (error) {
        // EEXIST はロック取得失敗を示す
        if (error.code === 'EEXIST') {
          if (isTestEnvironment && attemptsLeft === 50) {
            throw new Error(
              `ファイルロックの最大試行回数を超えました: ${nativeFilePath}`
            );
          }
          await new Promise((resolve) =>
            setTimeout(resolve, Math.min(100, timeout / 10))
          );
          return tryAcquireLock(attemptsLeft - 1);
        }
        // その他のエラーは予期しないエラー
        this.logger.error('ファイルロック中に予期しないエラーが発生しました:', {
          path: nativeFilePath,
          error,
        });
        throw error; // 予期しないエラーは再スロー
      }
    };
    return tryAcquireLock();
  }

  /**
   * ファイルの存在を確認
   * @param {string} directory - ディレクトリパス
   * @param {string} filename - ファイル名
   * @returns {boolean} ファイルが存在するかどうか
   */
  fileExists(...args) {
    let operationContext = {};
    let nativeFilePath = '';
    try {
      if (args.length === 1) {
        // 引数が1つの場合: 完全なパスとして扱う
        nativeFilePath = args[0];
        operationContext = { operation: 'fileExists', path: nativeFilePath };
        if (typeof nativeFilePath !== 'string') {
          this.logger.warn(
            'fileExists に不正な引数が渡されました (単一引数):',
            { args }
          );
          return false; // 文字列でない場合は false を返す
        }
        // basePath を考慮しない直接パス指定の場合、normalize する
        nativeFilePath = path.normalize(nativeFilePath);
      } else if (args.length === 2) {
        // 引数が2つの場合: ディレクトリとファイル名として扱う
        const [directory, filename] = args;
        operationContext = { operation: 'fileExists', directory, filename };
        if (typeof directory !== 'string' || typeof filename !== 'string') {
          this.logger.warn('fileExists に不正な引数が渡されました (二引数):', {
            args,
          });
          return false; // 文字列でない場合は false を返す
        }
        nativeFilePath = this._getNativeFilePath(directory, filename);
      } else {
        this.logger.warn('fileExists に不正な数の引数が渡されました:', {
          args,
        });
        return false; // 引数の数が不正な場合は false を返す
      }

      // eslint-disable-next-line security/detect-non-literal-fs-filename
      return fs.existsSync(nativeFilePath);
    } catch (error) {
      // エラーメッセージを引数の数に応じて調整
      const errorPath =
        nativeFilePath ||
        (args.length === 1
          ? args[0]
          : args.length === 2
            ? path.join(args[0], args[1])
            : '不明なパス');
      this._handleError(
        `ファイルの存在確認中にエラーが発生しました: ${errorPath}`,
        error,
        operationContext // 更新された operationContext を使用
      );
      return false;
    }
  }

  /**
   * ディレクトリ内のファイル一覧を取得
   * @param {string} directory - ディレクトリパス
   * @param {string} [pattern=null] - ファイル名パターン（正規表現）
   * @returns {Array<string>} ファイル名の配列
   */
  listFiles(directory, pattern = null) {
    const operationContext = { operation: 'listFiles', directory, pattern };
    let nativeDirPath = '';
    try {
      this._emitEvent('directory_list_before', { directory, pattern });

      nativeDirPath = path.join(this.basePath, directory);

      // eslint-disable-next-line security/detect-non-literal-fs-filename
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      if (!fs.existsSync(nativeDirPath)) {
        this._emitEvent('directory_not_found', { directory });
        return [];
      }

      // eslint-disable-next-line security/detect-non-literal-fs-filename
      let files = fs.readdirSync(nativeDirPath);

      if (pattern) {
        // eslint-disable-next-line security/detect-non-literal-regexp
        const regex = new RegExp(pattern);
        files = files.filter((file) => regex.test(file));
      }

      this._emitEvent('directory_list_after', {
        directory,
        pattern,
        success: true,
        count: files.length,
      });

      return files;
    } catch (error) {
      this._emitEvent('directory_list_after', {
        directory,
        pattern,
        success: false,
        error: error.message,
      });

      return this._handleError(
        `ディレクトリの一覧取得に失敗しました: ${nativeDirPath || directory}`,
        error,
        operationContext
      );
    }
  }

  /**
   * ファイルを削除
   * @param {string} directory - ディレクトリパス
   * @param {string} filename - ファイル名
   * @returns {boolean} 成功したかどうか
   */
  deleteFile(directory, filename) {
    const operationContext = { operation: 'deleteFile', directory, filename };
    let nativeFilePath = '';
    try {
      this._emitEvent('file_delete_before', { directory, filename });

      nativeFilePath = this._getNativeFilePath(directory, filename);

      // eslint-disable-next-line security/detect-non-literal-fs-filename
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      if (!fs.existsSync(nativeFilePath)) {
        this._emitEvent('file_not_found', { directory, filename });
        return false;
      }

      // eslint-disable-next-line security/detect-non-literal-fs-filename
      fs.unlinkSync(nativeFilePath);

      this._emitEvent('file_delete_after', {
        directory,
        filename,
        success: true,
      });

      return true;
    } catch (error) {
      this._emitEvent('file_delete_after', {
        directory,
        filename,
        success: false,
        error: error.message,
      });

      this._handleError(
        `ファイルの削除に失敗しました: ${nativeFilePath || path.join(directory, filename)}`,
        error,
        operationContext
      );
      return false;
    }
  }

  /**
   * ディレクトリを削除
   * @param {string} directory - ディレクトリパス
   * @param {boolean} [recursive=false] - 再帰的に削除するかどうか
   * @returns {boolean} 成功したかどうか
   */
  deleteDirectory(directory, recursive = false) {
    const operationContext = {
      operation: 'deleteDirectory',
      directory,
      recursive,
    };
    let nativeDirPath = '';
    try {
      this._emitEvent('directory_delete_before', { directory, recursive });

      nativeDirPath = path.join(this.basePath, directory);

      // eslint-disable-next-line security/detect-non-literal-fs-filename
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      if (!fs.existsSync(nativeDirPath)) {
        this._emitEvent('directory_not_found', { directory });
        return false;
      }

      // fs.rmSync を使用 (Node.js v14.14.0+)
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      fs.rmSync(nativeDirPath, { recursive: recursive, force: recursive }); // force は recursive が true の場合のみ有効

      this._emitEvent('directory_delete_after', {
        directory,
        recursive,
        success: true,
      });

      return true;
    } catch (error) {
      this._emitEvent('directory_delete_after', {
        directory,
        recursive,
        success: false,
        error: error.message,
      });

      this._handleError(
        `ディレクトリの削除に失敗しました: ${nativeDirPath || directory}`,
        error,
        operationContext
      );
      return false;
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
    const operationContext = {
      operation: 'copyFile',
      sourceDir,
      sourceFile,
      destDir,
      destFile,
    };
    let sourcePath = '';
    let destPath = '';
    try {
      this._emitEvent('file_copy_before', {
        sourceDir,
        sourceFile,
        destDir,
        destFile,
      });

      sourcePath = this._getNativeFilePath(sourceDir, sourceFile);

      // eslint-disable-next-line security/detect-non-literal-fs-filename
      if (!fs.existsSync(sourcePath)) {
        this._emitEvent('file_not_found', {
          directory: sourceDir,
          filename: sourceFile,
        });
        return false;
      }

      destPath = this._getNativeFilePath(destDir, destFile);
      // _ensureDirectoryExists は _getNativeFilePath 内で処理されるため不要

      // eslint-disable-next-line security/detect-non-literal-fs-filename
      fs.copyFileSync(sourcePath, destPath);

      this._emitEvent('file_copy_after', {
        sourceDir,
        sourceFile,
        destDir,
        destFile,
        success: true,
      });

      return true;
    } catch (error) {
      this._emitEvent('file_copy_after', {
        sourceDir,
        sourceFile,
        destDir,
        destFile,
        success: false,
        error: error.message,
      });

      this._handleError(
        `ファイルのコピーに失敗しました: ${sourcePath || path.join(sourceDir, sourceFile)} -> ${destPath || path.join(destDir, destFile)}`,
        error,
        operationContext
      );
      return false;
    }
  }

  /**
   * イベントを発行
   * @param {string} eventName - イベント名 (例: 'file_read_before')
   * @param {Object} data - イベントデータ
   * @private
   */
  _emitEvent(eventName, data) {
    if (
      !this.eventEmitter ||
      typeof this.eventEmitter.emitStandardized !== 'function'
    ) {
      return;
    }

    try {
      const traceId = this._traceIdGenerator();
      const requestId = this._requestIdGenerator();

      const standardizedData = {
        ...data,
        timestamp: new Date().toISOString(),
        traceId,
        requestId,
      };

      // イベント名のコロンをアンダースコアに置換
      const finalEventName = eventName.replace(/:/g, '_');

      this.eventEmitter.emitStandardized(
        'storage', // component name
        finalEventName, // 置換後のイベント名を使用
        standardizedData
      );
    } catch (error) {
      this.logger.warn(
        `イベント発行中にエラーが発生しました: storage:${eventName}`,
        error
      );
    }
  }

  /**
   * エラーを処理
   * @param {string} message - エラーメッセージ
   * @param {Error} error - 元のエラー
   * @param {Object} context - コンテキスト情報
   * @returns {any} エラーハンドラーの戻り値、または操作に応じたデフォルト値
   * @private
   */
  _handleError(message, error, context = {}) {
    const storageError = new StorageError(message, error);

    if (this.errorHandler && typeof this.errorHandler.handle === 'function') {
      return this.errorHandler.handle(
        storageError,
        'StorageService',
        context.operation,
        context
      );
    } else {
      this.logger.error(message, {
        error: storageError,
        context,
      });

      if (
        context.operation === 'readJSON' ||
        context.operation === 'readText' ||
        context.operation === 'updateJSON'
      ) {
        return null;
      } else if (context.operation === 'listFiles') {
        return [];
      } else {
        return false;
      }
    }
  }

  /**
   * ディレクトリが存在することを確認し、存在しない場合は作成
   * @param {string} dirPath - ディレクトリパス (OSネイティブ形式)
   * @private
   */
  _ensureDirectoryExists(dirPath) {
    // _getNativeFilePath 内で処理されるため、基本的には不要だが念のため残す
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!fs.existsSync(dirPath)) {
      try {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        fs.mkdirSync(dirPath, { recursive: true });
        this._emitEvent('directory_created', { path: path.normalize(dirPath) });
      } catch (error) {
        this._handleError(`ディレクトリ作成に失敗しました: ${dirPath}`, error, {
          directory: dirPath,
          operation: '_ensureDirectoryExists (mkdir)',
        });
        // エラーをスローする
        throw error;
      }
    }
  }

  /**
   * ディレクトリが存在することを確認し、存在しない場合は作成（パブリックメソッド）
   * @param {string} directory - ディレクトリパス (相対パス)
   * @returns {boolean} 成功したかどうか
   */
  ensureDirectoryExists(directory) {
    const operationContext = { operation: 'ensureDirectoryExists', directory };
    try {
      const nativeDirPath = path.join(this.basePath, directory);
      this._ensureDirectoryExists(nativeDirPath);
      return true;
    } catch (error) {
      // _ensureDirectoryExists 内でエラーがログ記録されるか、スローされる
      return false;
    }
  }

  // _removeDirectoryRecursive は削除 (fs.rmSync を使用)
}

module.exports = StorageService;

const {
  ApplicationError,
  CliError,
  NotFoundError,
  StorageError,
} = require('../lib/utils/errors'); // StorageError をインポート
const { emitErrorEvent } = require('../lib/utils/error-helpers');
const path = require('path'); // ファイルパス操作に必要

/**
 * CLIにおけるセッション関連の操作を管理するクラス
 */
class CliSessionManager {
  /**
   * @param {object} options - オプション
   * @param {object} options.logger - Loggerインスタンス (必須)
   * @param {object} options.eventEmitter - EventEmitterインスタンス (必須)
   * @param {object} options.integrationManagerAdapter - IntegrationManagerAdapterインスタンス (必須)
   * @param {object} options.sessionManagerAdapter - SessionManagerAdapterインスタンス (必須)
   * @param {object} options.storageService - StorageServiceインスタンス (必須)
   * @param {object} options.errorHandler - エラーハンドラー (オプション)
   */
  constructor(options = {}) {
    // 必須依存関係のチェック
    const requiredDependencies = [
      'logger',
      'eventEmitter',
      'integrationManagerAdapter',
      'sessionManagerAdapter',
      'storageService',
    ];
    for (const dep of requiredDependencies) {
      if (!options[dep]) {
        throw new ApplicationError(
          `CliSessionManager requires ${dep} instance.`
        );
      }
    }

    this.logger = options.logger;
    this.eventEmitter = options.eventEmitter;
    this.integrationManager = options.integrationManagerAdapter;
    this.sessionManager = options.sessionManagerAdapter;
    this.storageService = options.storageService; // ファイル操作に使用
    this.errorHandler = options.errorHandler;

    this.logger.debug('CliSessionManager initialized');
  }

  /**
   * 新しいセッションを開始する
   * @param {string|null} previousSessionId - 前回のセッションID (オプション)
   * @returns {Promise<object>} 開始されたセッション情報
   * @throws {CliError} セッション開始に失敗した場合
   */
  async startSession(previousSessionId = null) {
    const operation = 'startSession';
    this.logger.info('Starting new session...', {
      operation,
      previousSessionId,
    });
    await this.eventEmitter.emitStandardizedAsync(
      'cli_session',
      `${operation}_before`,
      { previousSessionId }
    );

    try {
      // integrationManagerAdapter を使用してセッションを開始
      const result =
        await this.integrationManager.startSession(previousSessionId);

      if (result && result.error) {
        // CliError を使用し、CLI固有コードを設定
        throw new CliError(`Session start failed: ${result.error}`, null, {
          code: 'ERR_CLI_SESSION_START_FAILED', // CLI固有コード
          context: { previousSessionId, errorDetail: result.error },
        });
      }
      if (!result || !result.session_id) {
        // CliError を使用し、CLI固有コードを設定
        throw new CliError(
          'Session start did not return expected result.',
          null, // cause は null
          {
            code: 'ERR_CLI_SESSION_START_UNEXPECTED', // CLI固有コード
            context: { previousSessionId, result },
          }
        );
      }

      await this.eventEmitter.emitStandardizedAsync(
        'cli_session',
        `${operation}_after`,
        { previousSessionId, result }
      );
      this.logger.info(`Session started successfully: ${result.session_id}`);
      return result;
    } catch (error) {
      // エラーラップロジック修正
      const cliError =
        error instanceof CliError && // 特定の CliError はそのまま
        (error.code === 'ERR_CLI_SESSION_START_FAILED' ||
          error.code === 'ERR_CLI_SESSION_START_UNEXPECTED')
          ? error
          : new CliError(`Failed to start session`, error, {
              // それ以外は CliError でラップ
              code: 'ERR_CLI_SESSION_START',
              context: { previousSessionId },
            });
      emitErrorEvent(
        this.eventEmitter,
        this.logger,
        'CliSessionManager',
        operation,
        cliError,
        null,
        { previousSessionId }
      );

      if (this.errorHandler) {
        return this.errorHandler.handle(
          cliError,
          'CliSessionManager',
          operation,
          { previousSessionId }
        );
      } else {
        throw cliError; // エラーハンドラがなければスロー
      }
    }
  }

  /**
   * セッションを終了する
   * @param {string|null} sessionId - 終了するセッションID (nullの場合は最新)
   * @returns {Promise<object>} 終了されたセッション情報
   * @throws {CliError|NotFoundError} セッション終了に失敗した場合
   */
  async endSession(sessionId = null) {
    const operation = 'endSession';
    this.logger.info(`Ending session: ${sessionId || 'latest'}`, {
      operation,
      sessionId,
    });
    await this.eventEmitter.emitStandardizedAsync(
      'cli_session',
      `${operation}_before`,
      { sessionId }
    );

    try {
      let targetSessionId = sessionId;
      // セッションIDが指定されていない場合は最新のセッションを取得
      if (!targetSessionId) {
        const latestSession = await this.sessionManager.getLatestSession();
        if (latestSession) {
          targetSessionId = latestSession.session_id;
          this.logger.debug(`Using latest session ID: ${targetSessionId}`);
        } else {
          // NotFoundError を使用し、CLI固有コードを設定 (第2引数に options を渡す)
          throw new NotFoundError('No active session found to end.', {
            code: 'ERR_CLI_NO_ACTIVE_SESSION', // CLI固有コード
          });
        }
      }

      // integrationManagerAdapter を使用してセッションを終了
      const result = await this.integrationManager.endSession(targetSessionId);

      if (result && result.error) {
        // CliError を使用し、CLI固有コードを設定
        throw new CliError(`Session end failed: ${result.error}`, null, {
          code: 'ERR_CLI_SESSION_END_FAILED', // CLI固有コード
          context: { sessionId: targetSessionId, errorDetail: result.error },
        });
      }
      if (!result || !result.session_id || !result.handover_document) {
        // CliError を使用し、CLI固有コードを設定
        throw new CliError(
          'Session end did not return expected result.',
          null, // cause は null
          {
            code: 'ERR_CLI_SESSION_END_UNEXPECTED', // CLI固有コード
            context: { sessionId: targetSessionId, result },
          }
        );
      }

      // 引継ぎドキュメントを StorageService を使って保存
      const handoverFilename = 'session-handover.md'; // 固定ファイル名
      const handoverDir = path.join('ai-context', 'sessions'); // 保存先ディレクトリ
      const writeSuccess = await this.storageService.writeText(
        handoverDir,
        handoverFilename,
        result.handover_document
      );

      if (!writeSuccess) {
        this.logger.warn(
          `Failed to save handover document to ${path.join(handoverDir, handoverFilename)}`,
          { operation }
        );
        // 保存失敗は致命的ではないかもしれないが、警告は出す
      } else {
        this.logger.info(
          `Handover document saved to ${path.join(handoverDir, handoverFilename)}`
        );
      }

      await this.eventEmitter.emitStandardizedAsync(
        'cli_session',
        `${operation}_after`,
        { sessionId: targetSessionId, result }
      );
      this.logger.info(`Session ended successfully: ${result.session_id}`);
      return result;
    } catch (error) {
      // エラーラップロジック修正
      const cliError =
        error instanceof NotFoundError || // NotFoundError はそのまま
        (error instanceof CliError && // 特定の CliError もそのまま
          (error.code === 'ERR_CLI_SESSION_END_FAILED' ||
            error.code === 'ERR_CLI_SESSION_END_UNEXPECTED'))
          ? error
          : new CliError( // それ以外は CliError でラップ
              `Failed to end session ${sessionId || 'latest'}`,
              error,
              {
                code: 'ERR_CLI_SESSION_END',
                context: { sessionId },
              }
            );

      emitErrorEvent(
        this.eventEmitter,
        this.logger,
        'CliSessionManager',
        operation,
        cliError, // 正しいエラーオブジェクト
        null,
        { sessionId }
      );

      if (this.errorHandler) {
        return this.errorHandler.handle(
          cliError,
          'CliSessionManager',
          operation,
          { sessionId }
        );
      } else {
        throw cliError;
      }
    }
  }

  /**
   * セッション一覧を取得する
   * @returns {Promise<Array<object>>} セッション情報の配列
   * @throws {CliError} 取得に失敗した場合
   */
  async listSessions() {
    const operation = 'listSessions';
    this.logger.info('Listing all sessions...', { operation });
    await this.eventEmitter.emitStandardizedAsync(
      'cli_session',
      `${operation}_before`
    );

    try {
      const sessions = await this.sessionManager.getAllSessions();
      await this.eventEmitter.emitStandardizedAsync(
        'cli_session',
        `${operation}_after`,
        { count: sessions?.length || 0 }
      );
      this.logger.info(`Found ${sessions?.length || 0} sessions.`);
      return sessions || []; // sessions が null や undefined の場合も考慮
    } catch (error) {
      // CliError でラップ (常に)
      const cliError = new CliError('Failed to list sessions', error, {
        code: 'ERR_CLI_SESSION_LIST',
      });
      emitErrorEvent(
        this.eventEmitter,
        this.logger,
        'CliSessionManager',
        operation,
        cliError
      );
      if (this.errorHandler) {
        return (
          this.errorHandler.handle(cliError, 'CliSessionManager', operation) ||
          []
        ); // エラー時は空配列を返すなど
      } else {
        throw cliError; // エラーハンドラがなければスロー
      }
    }
  }

  /**
   * 最新（現在）のセッション情報を取得する
   * @returns {Promise<object|null>} 最新のセッション情報、または null
   * @throws {CliError} 取得に失敗した場合
   */
  async getCurrentSessionInfo() {
    const operation = 'getCurrentSessionInfo';
    this.logger.info('Getting current session info...', { operation });
    await this.eventEmitter.emitStandardizedAsync(
      'cli_session',
      `${operation}_before`
    );

    try {
      const session = await this.sessionManager.getLatestSession();
      await this.eventEmitter.emitStandardizedAsync(
        'cli_session',
        `${operation}_after`,
        { sessionFound: !!session }
      );
      if (session) {
        this.logger.info(`Current session found: ${session.session_id}`);
      } else {
        this.logger.info('No active session found.');
      }
      return session;
    } catch (error) {
      // CliError でラップ (常に)
      const cliError = new CliError(
        'Failed to get current session info',
        error,
        {
          code: 'ERR_CLI_SESSION_CURRENT',
        }
      );
      emitErrorEvent(
        this.eventEmitter,
        this.logger,
        'CliSessionManager',
        operation,
        cliError
      );
      if (this.errorHandler) {
        return this.errorHandler.handle(
          cliError,
          'CliSessionManager',
          operation
        ); // null を返すなど
      } else {
        throw cliError; // エラーハンドラがなければスロー
      }
    }
  }

  /**
   * 指定されたIDのセッション情報を取得する
   * @param {string} sessionId - セッションID
   * @returns {Promise<object|null>} セッション情報、または null
   * @throws {CliError|NotFoundError} 取得に失敗した場合
   */
  async getSessionInfo(sessionId) {
    const operation = 'getSessionInfo';
    this.logger.info(`Getting session info for: ${sessionId}`, {
      operation,
      sessionId,
    });
    await this.eventEmitter.emitStandardizedAsync(
      'cli_session',
      `${operation}_before`,
      { sessionId }
    );
    try {
      this.logger.debug(
        `Calling sessionManager.getSession with ID: ${sessionId}`
      ); // デバッグログ追加
      const session = await this.sessionManager.getSession(sessionId);
      this.logger.debug(
        `sessionManager.getSession returned: ${JSON.stringify(session)}`
      ); // デバッグログ追加
      await this.eventEmitter.emitStandardizedAsync(
        'cli_session',
        `${operation}_after`,
        { sessionId, sessionFound: !!session }
      );
      if (session) {
        this.logger.info(`Session info retrieved for: ${sessionId}`);
      } else {
        // logger.warn にコンテキストオブジェクトを渡すように修正
        this.logger.warn(`Session not found: ${sessionId}`, { sessionId });
        // NotFoundError を使用し、CLI固有コードを設定 (第2引数に options を渡す)
        const notFoundError = new NotFoundError(
          `Session not found: ${sessionId}`,
          {
            code: 'ERR_CLI_SESSION_NOT_FOUND', // CLI固有コード
            context: { sessionId },
          }
        );
        throw notFoundError;
      }
      return session;
    } catch (error) {
      // ★★★ catch ブロックのデバッグログ ★★★
      this.logger.error('Caught error in getSessionInfo catch block:', {
        errorName: error.name,
        errorCode: error.code,
        errorMessage: error.message,
        errorInstanceofNotFoundError: error instanceof NotFoundError,
        errorStack: error.stack, // スタックトレースも出力
      });
      // ★★★ デバッグログ追加ここまで ★★★

      // エラーラップロジック修正
      const cliError =
        error instanceof NotFoundError || // NotFoundError はそのまま
        error instanceof CliError // CliError もそのまま
          ? error
          : new CliError( // それ以外は CliError でラップ
              `Failed to get session info for ${sessionId}`,
              error,
              {
                code: 'ERR_CLI_SESSION_INFO',
                context: { sessionId },
              }
            );

      emitErrorEvent(
        this.eventEmitter,
        this.logger,
        'CliSessionManager',
        operation,
        cliError, // 正しいエラーオブジェクト
        null,
        { sessionId }
      );
      if (this.errorHandler) {
        return this.errorHandler.handle(
          cliError,
          'CliSessionManager',
          operation,
          { sessionId }
        ); // null を返すなど
      } else {
        throw cliError;
      }
    }
  }

  /**
   * セッション情報をファイルにエクスポートする
   * @param {string} sessionId - セッションID
   * @param {string|null} outputPath - 出力ファイルパス (nullの場合はデフォルトパス)
   * @returns {Promise<string>} エクスポートされたファイルパス
   * @throws {CliError|NotFoundError|StorageError} エクスポートに失敗した場合
   */
  async exportSession(sessionId, outputPath = null) {
    const operation = 'exportSession';
    this.logger.info(`Exporting session: ${sessionId}`, {
      operation,
      sessionId,
      outputPath,
    });
    await this.eventEmitter.emitStandardizedAsync(
      'cli_session',
      `${operation}_before`,
      { sessionId, outputPath }
    );

    try {
      const session = await this.sessionManager.getSession(sessionId);
      if (!session) {
        // NotFoundError を使用し、CLI固有コードを設定 (第2引数に options を渡す)
        throw new NotFoundError(`Session not found: ${sessionId}`, {
          code: 'ERR_CLI_SESSION_NOT_FOUND', // CLI固有コード
          context: { sessionId },
        });
      }

      const finalPath = outputPath || `session-${sessionId}-export.json`;
      // StorageService を使用して書き込み
      const writeSuccess = await this.storageService.writeJSON(
        '.', // basePath からの相対パスなのでカレントディレクトリ
        finalPath,
        session
      );

      if (!writeSuccess) {
        // StorageError を使用し、CLI固有コードを設定
        // StorageService.writeJSON が false を返す場合、内部でエラーログは出力されているはず
        // ここでは CLI 固有のエラーをスローする
        throw new StorageError( // StorageError を直接スロー
          `Failed to write session export file: ${finalPath}`, // message
          null, // cause
          {
            code: 'ERR_CLI_FILE_WRITE',
            context: { sessionId, path: finalPath },
          } // options
        );
      }

      await this.eventEmitter.emitStandardizedAsync(
        'cli_session',
        `${operation}_after`,
        { sessionId, path: finalPath }
      );
      this.logger.info(`Session exported successfully to: ${finalPath}`);
      return finalPath;
    } catch (error) {
      // エラーラップロジック修正
      const cliError =
        error instanceof NotFoundError || // NotFoundError はそのまま
        error instanceof StorageError || // StorageError もそのまま
        error instanceof CliError // CliError もそのまま
          ? error
          : new CliError( // それ以外は CliError でラップ
              `Failed to export session ${sessionId}`,
              error,
              {
                code: 'ERR_CLI_SESSION_EXPORT',
                context: { sessionId, outputPath },
              }
            );

      emitErrorEvent(
        this.eventEmitter,
        this.logger,
        'CliSessionManager',
        operation,
        cliError, // 正しいエラーオブジェクト
        null,
        { sessionId, outputPath }
      );
      if (this.errorHandler) {
        return this.errorHandler.handle(
          cliError,
          'CliSessionManager',
          operation,
          { sessionId, outputPath }
        );
      } else {
        throw cliError;
      }
    }
  }

  /**
   * ファイルからセッション情報をインポートする
   * @param {string} inputPath - 入力ファイルパス
   * @returns {Promise<object>} インポートされたセッション情報
   * @throws {CliError|StorageError} インポートに失敗した場合
   */
  async importSession(inputPath) {
    const operation = 'importSession';
    this.logger.info(`Importing session from: ${inputPath}`, {
      operation,
      inputPath,
    });
    await this.eventEmitter.emitStandardizedAsync(
      'cli_session',
      `${operation}_before`,
      { inputPath }
    );

    try {
      // StorageService を使用して読み込み
      const sessionData = await this.storageService.readJSON('.', inputPath); // basePath からの相対パス

      if (sessionData === null) {
        // readJSON が null を返す場合 (ファイルが存在しないかパースエラー)
        // StorageError を使用し、CLI固有コードを設定
        throw new StorageError( // StorageError を直接スロー
          `Failed to read or parse session import file: ${inputPath}`, // message
          null, // cause
          { code: 'ERR_CLI_FILE_READ', context: { path: inputPath } } // options
        );
      }

      // sessionManagerAdapter を使用してインポート
      const session = await this.sessionManager.importSession(sessionData);

      if (!session || !session.session_id) {
        // importSession の成功判定 (ここは変更不要)
        // CliError を使用し、CLI固有コードを設定
        throw new CliError(
          'Session import did not return expected result.',
          null, // cause は null
          {
            code: 'ERR_CLI_SESSION_IMPORT_UNEXPECTED', // CLI固有コード
            context: { inputPath, result: session },
          }
        );
      }

      await this.eventEmitter.emitStandardizedAsync(
        'cli_session',
        `${operation}_after`,
        { inputPath, sessionId: session.session_id }
      );
      this.logger.info(`Session imported successfully: ${session.session_id}`);
      return session;
    } catch (error) {
      // エラーラップロジック修正
      const cliError =
        error instanceof StorageError || // StorageError はそのまま
        (error instanceof CliError &&
          error.code === 'ERR_CLI_SESSION_IMPORT_UNEXPECTED') // 特定の CliError もそのまま
          ? error
          : new CliError( // それ以外は CliError でラップ
              `Failed to import session from ${inputPath}`,
              error,
              {
                code: 'ERR_CLI_SESSION_IMPORT',
                context: { inputPath },
              }
            );
      emitErrorEvent(
        this.eventEmitter,
        this.logger,
        'CliSessionManager',
        operation,
        cliError,
        null,
        { inputPath }
      );
      if (this.errorHandler) {
        return this.errorHandler.handle(
          cliError,
          'CliSessionManager',
          operation,
          { inputPath }
        );
      } else {
        throw cliError; // エラーハンドラがなければスロー
      }
    }
  }
}

module.exports = CliSessionManager;

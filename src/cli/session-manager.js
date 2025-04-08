const {
  ApplicationError,
  CliError,
  NotFoundError,
  StorageError,
} = require('../lib/utils/errors');
const { emitErrorEvent } = require('../lib/utils/error-helpers');
const path = require('path');
// ID生成関数をインポート (EventEmitter から取得するため不要)
// const { generateTraceId, generateRequestId } = require('../lib/utils/id-generators');

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
   * @param {object} [options.errorHandler] - エラーハンドラー (オプション)
   * @param {Function} options.traceIdGenerator - トレースID生成関数 (必須)
   * @param {Function} options.requestIdGenerator - リクエストID生成関数 (必須)
   */
  constructor(options = {}) {
    // 分割代入で依存関係を取得
    const {
      logger,
      eventEmitter,
      integrationManagerAdapter,
      sessionManagerAdapter,
      storageService,
      errorHandler, // 任意
      traceIdGenerator,
      requestIdGenerator,
    } = options;

    // 必須依存関係のチェック
    if (!logger)
      throw new ApplicationError('CliSessionManager requires logger instance.');
    if (!eventEmitter)
      throw new ApplicationError(
        'CliSessionManager requires eventEmitter instance.'
      );
    if (!integrationManagerAdapter)
      throw new ApplicationError(
        'CliSessionManager requires integrationManagerAdapter instance.'
      );
    if (!sessionManagerAdapter)
      throw new ApplicationError(
        'CliSessionManager requires sessionManagerAdapter instance.'
      );
    if (!storageService)
      throw new ApplicationError(
        'CliSessionManager requires storageService instance.'
      );
    if (!traceIdGenerator)
      throw new ApplicationError(
        'CliSessionManager requires traceIdGenerator function.'
      );
    if (!requestIdGenerator)
      throw new ApplicationError(
        'CliSessionManager requires requestIdGenerator function.'
      );

    this.logger = logger;
    this.eventEmitter = eventEmitter;
    this.integrationManager = integrationManagerAdapter;
    this.sessionManager = sessionManagerAdapter;
    this.storageService = storageService;
    this.errorHandler = errorHandler; // 任意なのでチェック不要
    this._traceIdGenerator = traceIdGenerator;
    this._requestIdGenerator = requestIdGenerator;

    this.logger.debug('CliSessionManager initialized');
  }

  /**
   * 標準化されたイベントを発行する内部ヘルパー
   * @param {string} action - アクション名 (例: 'start_before')
   * @param {object} [data={}] - イベントデータ
   * @param {string} [traceId] - トレースID (指定されなければ生成)
   * @param {string} [requestId] - リクエストID (指定されなければ生成)
   * @returns {Promise<void>}
   * @private
   */
  async _emitEvent(action, data = {}, traceId, requestId) {
    if (
      !this.eventEmitter ||
      typeof this.eventEmitter.emitStandardizedAsync !== 'function'
    ) {
      this.logger.warn(
        `Cannot emit event session_${action}: eventEmitter or emitStandardizedAsync is missing.`
      );
      return;
    }
    const finalTraceId = traceId || this._traceIdGenerator();
    const finalRequestId = requestId || this._requestIdGenerator();
    const eventData = {
      ...data,
      traceId: finalTraceId,
      requestId: finalRequestId,
    };
    try {
      // コンポーネント名を 'cli'、アクション名を 'session_action' 形式に統一
      await this.eventEmitter.emitStandardizedAsync(
        'cli',
        `session_${action}`,
        eventData
      );
    } catch (error) {
      this.logger.warn(`イベント発行中にエラー: cli:session_${action}`, {
        error,
      });
    }
  }

  /**
   * エラー処理を行う内部ヘルパー
   * @param {Error} error - 発生したエラー
   * @param {string} operation - 操作名
   * @param {object} [context={}] - エラーコンテキスト
   * @returns {*} エラーハンドラーの戻り値、またはエラーを再スロー
   * @throws {CliError|ApplicationError|NotFoundError|StorageError} エラーハンドラーがない場合、またはエラーハンドラーがエラーをスローした場合
   * @private
   */
  _handleError(error, operation, context = {}) {
    // 特定のエラーコードや型はそのまま使う
    const knownErrorCodes = [
      'ERR_CLI_SESSION_START_FAILED',
      'ERR_CLI_SESSION_START_UNEXPECTED',
      'ERR_CLI_NO_ACTIVE_SESSION', // NotFoundError から来る可能性
      'ERR_CLI_SESSION_END_FAILED',
      'ERR_CLI_SESSION_END_UNEXPECTED',
      'ERR_CLI_SESSION_NOT_FOUND', // NotFoundError から来る可能性
      'ERR_CLI_FILE_WRITE', // StorageError から来る可能性
      'ERR_CLI_FILE_READ', // StorageError から来る可能性
      'ERR_CLI_SESSION_IMPORT_UNEXPECTED',
      'ERR_CLI_HANDOVER_SAVE', // StorageError から来る可能性 (endSession内)
    ];
    const isKnownCliError =
      error instanceof CliError && knownErrorCodes.includes(error.code);
    const isKnownError =
      error instanceof NotFoundError ||
      error instanceof StorageError ||
      isKnownCliError;

    const processedError = isKnownError
      ? error
      : new CliError(`Failed during ${operation}`, error, {
          // エラーコード生成ルールを統一 (コンポーネント名を含む)
          code: `ERR_CLI_SESSIONMANAGER_${operation.toUpperCase()}`,
          ...context,
        });

    emitErrorEvent(
      this.eventEmitter,
      this.logger,
      'CliSessionManager',
      operation,
      processedError,
      null,
      context
    );

    if (this.errorHandler) {
      return this.errorHandler.handle(
        processedError,
        'CliSessionManager',
        operation,
        context
      );
    } else {
      throw processedError;
    }
  }

  /**
   * 新しいセッションを開始する
   * @param {string|null} [previousSessionId=null] - 前回のセッションID (オプション)
   * @returns {Promise<object>} 開始されたセッション情報
   * @throws {CliError} セッション開始に失敗した場合
   */
  async startSession(previousSessionId = null) {
    const operation = 'startSession';
    const traceId = this._traceIdGenerator();
    const requestId = this._requestIdGenerator();
    const context = { previousSessionId, traceId, requestId };
    await this._emitEvent(
      'start_before',
      { previousSessionId },
      traceId,
      requestId
    );
    this.logger.info('Starting new session...', context);

    try {
      const result =
        await this.integrationManager.startSession(previousSessionId);

      if (result && result.error) {
        throw new CliError(`Session start failed: ${result.error}`, null, {
          code: 'ERR_CLI_SESSION_START_FAILED',
          previousSessionId, // ネストを削除
          errorDetail: result.error, // フラットに渡す
        });
      }
      if (!result || !result.session_id) {
        throw new CliError(
          'Session start did not return expected result.',
          null,
          {
            code: 'ERR_CLI_SESSION_START_UNEXPECTED',
            context: { previousSessionId, result },
          }
        );
      }

      await this._emitEvent(
        'start_after',
        { previousSessionId, result },
        traceId,
        requestId
      );
      this.logger.info(`Session started successfully: ${result.session_id}`, {
        traceId,
        requestId,
      });
      return result;
    } catch (error) {
      return this._handleError(error, operation, context);
    }
  }

  /**
   * セッションを終了する
   * @param {string|null} [sessionId=null] - 終了するセッションID (nullの場合は最新)
   * @returns {Promise<object>} 終了されたセッション情報
   * @throws {CliError|NotFoundError} セッション終了または引継ぎドキュメント保存に失敗した場合
   */
  async endSession(sessionId = null) {
    const operation = 'endSession';
    const traceId = this._traceIdGenerator();
    const requestId = this._requestIdGenerator();
    const context = { sessionId, traceId, requestId }; // 初期コンテキスト
    await this._emitEvent('end_before', { sessionId }, traceId, requestId);
    this.logger.info(`Ending session: ${sessionId || 'latest'}`, context);

    let targetSessionId = sessionId; // エラーハンドリング用に保持

    try {
      if (!targetSessionId) {
        const latestSession = await this.sessionManager.getLatestSession();
        if (latestSession) {
          targetSessionId = latestSession.session_id;
          context.sessionId = targetSessionId; // コンテキスト更新
          this.logger.debug(`Using latest session ID: ${targetSessionId}`, {
            traceId,
            requestId,
          });
        } else {
          throw new NotFoundError('No active session found to end.', {
            code: 'ERR_CLI_NO_ACTIVE_SESSION',
          });
        }
      }

      const result = await this.integrationManager.endSession(targetSessionId);

      if (result && result.error) {
        throw new CliError(`Session end failed: ${result.error}`, null, {
          code: 'ERR_CLI_SESSION_END_FAILED',
          context: { sessionId: targetSessionId, errorDetail: result.error },
        });
      }
      if (!result || !result.session_id || !result.handover_document) {
        throw new CliError(
          'Session end did not return expected result.',
          null,
          {
            code: 'ERR_CLI_SESSION_END_UNEXPECTED',
            context: { sessionId: targetSessionId, result },
          }
        );
      }

      // 引継ぎドキュメント保存 (エラーは警告ログのみ)
      try {
        const handoverFilename = 'session-handover.md';
        const handoverDir = path.join('ai-context', 'sessions');
        const writeSuccess = await this.storageService.writeText(
          handoverDir,
          handoverFilename,
          result.handover_document
        );
        if (!writeSuccess) {
          // ログレベルを error に変更し、StorageError を作成してログコンテキストに含める
          const saveError = new StorageError(
            `Failed to save handover document to ${path.join(handoverDir, handoverFilename)}`,
            {
              code: 'ERR_CLI_HANDOVER_SAVE', // 新しいコード
              context: { sessionId: targetSessionId },
            }
          );
          this.logger.error('Failed to save handover document.', {
            error: saveError,
            traceId,
            requestId,
          });
        } else {
          this.logger.info(
            `Handover document saved to ${path.join(handoverDir, handoverFilename)}`,
            { traceId, requestId }
          );
        }
      } catch (saveError) {
        // storageService.writeText が例外をスローした場合もエラーログ
        this.logger.error('Error saving handover document.', {
          error: saveError,
          traceId,
          requestId,
        });
      }

      await this._emitEvent(
        'end_after',
        { sessionId: targetSessionId, result },
        traceId,
        requestId
      );
      this.logger.info(`Session ended successfully: ${result.session_id}`, {
        traceId,
        requestId,
      });
      return result;
    } catch (error) {
      // targetSessionId をコンテキストに含める
      context.sessionId = targetSessionId;
      return this._handleError(error, operation, context);
    }
  }

  /**
   * セッション一覧を取得する
   * @returns {Promise<Array<object>>} セッション情報の配列
   * @throws {CliError} 取得に失敗した場合
   */
  async listSessions() {
    const operation = 'listSessions';
    const traceId = this._traceIdGenerator();
    const requestId = this._requestIdGenerator();
    const context = { traceId, requestId };
    await this._emitEvent('list_before', {}, traceId, requestId);
    this.logger.info('Listing all sessions...', { ...context, operation });

    try {
      const sessions = await this.sessionManager.getAllSessions();
      const count = sessions?.length || 0;
      await this._emitEvent('list_after', { count }, traceId, requestId);
      this.logger.info(`Found ${count} sessions.`, { traceId, requestId });
      return sessions || [];
    } catch (error) {
      // エラーハンドラが値を返さない場合は空配列を返す
      const handledResult = this._handleError(error, operation, context);
      return handledResult === undefined ? [] : handledResult;
    }
  }

  /**
   * 最新（現在）のセッション情報を取得する
   * @returns {Promise<object|null>} 最新のセッション情報、または null
   * @throws {CliError} 取得に失敗した場合
   */
  async getCurrentSessionInfo() {
    const operation = 'getCurrentSessionInfo';
    const traceId = this._traceIdGenerator();
    const requestId = this._requestIdGenerator();
    const context = { traceId, requestId };
    await this._emitEvent('current_get_before', {}, traceId, requestId);
    this.logger.info('Getting current session info...', {
      ...context,
      operation,
    });

    try {
      const session = await this.sessionManager.getLatestSession();
      await this._emitEvent(
        'current_get_after',
        { sessionFound: !!session },
        traceId,
        requestId
      );
      if (session) {
        this.logger.info(`Current session found: ${session.session_id}`, {
          traceId,
          requestId,
        });
      } else {
        this.logger.info('No active session found.', { traceId, requestId });
      }
      return session;
    } catch (error) {
      // エラーハンドラが値を返さない場合は null を返す
      const handledResult = this._handleError(error, operation, context);
      return handledResult === undefined ? null : handledResult;
    }
  }

  /**
   * 指定されたIDのセッション情報を取得する
   * @param {string} sessionId - セッションID
   * @returns {Promise<object>} セッション情報
   * @throws {CliError|NotFoundError} 取得に失敗した場合、またはセッションが見つからない場合
   */
  async getSessionInfo(sessionId) {
    const operation = 'getSessionInfo';
    const traceId = this._traceIdGenerator();
    const requestId = this._requestIdGenerator();
    const context = { sessionId, traceId, requestId };
    await this._emitEvent('info_get_before', { sessionId }, traceId, requestId);
    this.logger.info(`Getting session info for: ${sessionId}`, context);

    try {
      const session = await this.sessionManager.getSession(sessionId);
      if (!session) {
        throw new NotFoundError(`Session not found: ${sessionId}`, {
          code: 'ERR_CLI_SESSION_NOT_FOUND',
          context: { sessionId },
        });
      }
      await this._emitEvent(
        'info_get_after',
        { sessionId, sessionFound: true },
        traceId,
        requestId
      );
      this.logger.info(`Session info retrieved for: ${sessionId}`, {
        traceId,
        requestId,
      });
      return session;
    } catch (error) {
      return this._handleError(error, operation, context);
    }
  }

  /**
   * セッション情報をファイルにエクスポートする
   * @param {string} sessionId - セッションID
   * @param {string|null} [outputPath=null] - 出力ファイルパス (nullの場合はデフォルトパス)
   * @returns {Promise<string>} エクスポートされたファイルパス
   * @throws {CliError|NotFoundError|StorageError} エクスポートに失敗した場合
   */
  async exportSession(sessionId, outputPath = null) {
    const operation = 'exportSession';
    const traceId = this._traceIdGenerator();
    const requestId = this._requestIdGenerator();
    const context = { sessionId, outputPath, traceId, requestId };
    await this._emitEvent(
      'export_before',
      { sessionId, outputPath },
      traceId,
      requestId
    );
    this.logger.info(`Exporting session: ${sessionId}`, context);

    try {
      const session = await this.sessionManager.getSession(sessionId);
      if (!session) {
        throw new NotFoundError(`Session not found: ${sessionId}`, {
          code: 'ERR_CLI_SESSION_NOT_FOUND',
          context: { sessionId },
        });
      }

      const finalPath = outputPath || `session-${sessionId}-export.json`;
      const writeSuccess = await this.storageService.writeJSON(
        '.',
        finalPath,
        session
      );

      if (!writeSuccess) {
        throw new StorageError(
          `Failed to write session export file: ${finalPath}`,
          {
            code: 'ERR_CLI_FILE_WRITE',
            context: { sessionId, path: finalPath },
          }
        );
      }

      await this._emitEvent(
        'export_after',
        { sessionId, path: finalPath },
        traceId,
        requestId
      );
      this.logger.info(`Session exported successfully to: ${finalPath}`, {
        traceId,
        requestId,
      });
      return finalPath;
    } catch (error) {
      return this._handleError(error, operation, context);
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
    const traceId = this._traceIdGenerator();
    const requestId = this._requestIdGenerator();
    const context = { inputPath, traceId, requestId };
    await this._emitEvent('import_before', { inputPath }, traceId, requestId);
    this.logger.info(`Importing session from: ${inputPath}`, context);

    try {
      const sessionData = await this.storageService.readJSON('.', inputPath);
      if (sessionData === null) {
        throw new StorageError(
          `Failed to read or parse session import file: ${inputPath}`,
          {
            code: 'ERR_CLI_FILE_READ',
            context: { path: inputPath },
          }
        );
      }

      // TODO: インポート前に sessionData のバリデーションを行う (validator.validateSessionInput)

      const session = await this.sessionManager.importSession(sessionData);

      if (!session || !session.session_id) {
        throw new CliError(
          'Session import did not return expected result.',
          null,
          {
            code: 'ERR_CLI_SESSION_IMPORT_UNEXPECTED',
            context: { inputPath, result: session },
          }
        );
      }

      await this._emitEvent(
        'import_after',
        { inputPath, sessionId: session.session_id },
        traceId,
        requestId
      );
      this.logger.info(`Session imported successfully: ${session.session_id}`, {
        traceId,
        requestId,
      });
      return session;
    } catch (error) {
      return this._handleError(error, operation, context);
    }
  }
}

module.exports = CliSessionManager;

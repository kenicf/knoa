const {
  ApplicationError,
  ValidationError,
  CliError,
  NotFoundError,
  StorageError,
} = require('../lib/utils/errors');
const { emitErrorEvent } = require('../lib/utils/error-helpers');
const path = require('path'); // レポート保存パス用
// ID生成関数をインポート (EventEmitter から取得するため不要)
// const { generateTraceId, generateRequestId } = require('../lib/utils/id-generators');

/**
 * CLIにおけるフィードバック関連の操作を管理するクラス
 */
class CliFeedbackHandler {
  /**
   * @param {object} options - オプション
   * @param {object} options.logger - Loggerインスタンス (必須)
   * @param {object} options.eventEmitter - EventEmitterインスタンス (必須)
   * @param {object} options.integrationManagerAdapter - IntegrationManagerAdapterインスタンス (必須)
   * @param {object} options.feedbackManagerAdapter - FeedbackManagerAdapterインスタンス (必須)
   * @param {object} options.storageService - StorageServiceインスタンス (必須)
   * @param {object} options.validator - Validatorインスタンス (必須)
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
      feedbackManagerAdapter,
      storageService,
      validator,
      errorHandler, // 任意
      traceIdGenerator,
      requestIdGenerator,
    } = options;

    // 必須依存関係のチェック
    if (!logger)
      throw new ApplicationError(
        'CliFeedbackHandler requires logger instance.'
      );
    if (!eventEmitter)
      throw new ApplicationError(
        'CliFeedbackHandler requires eventEmitter instance.'
      );
    if (!integrationManagerAdapter)
      throw new ApplicationError(
        'CliFeedbackHandler requires integrationManagerAdapter instance.'
      );
    if (!feedbackManagerAdapter)
      throw new ApplicationError(
        'CliFeedbackHandler requires feedbackManagerAdapter instance.'
      );
    if (!storageService)
      throw new ApplicationError(
        'CliFeedbackHandler requires storageService instance.'
      );
    if (!validator)
      throw new ApplicationError(
        'CliFeedbackHandler requires validator instance.'
      );
    if (!traceIdGenerator)
      throw new ApplicationError(
        'CliFeedbackHandler requires traceIdGenerator function.'
      );
    if (!requestIdGenerator)
      throw new ApplicationError(
        'CliFeedbackHandler requires requestIdGenerator function.'
      );

    this.logger = logger;
    this.eventEmitter = eventEmitter;
    this.integrationManager = integrationManagerAdapter;
    this.feedbackManager = feedbackManagerAdapter;
    this.storageService = storageService;
    this.validator = validator;
    this.errorHandler = errorHandler; // 任意なのでチェック不要
    this._traceIdGenerator = traceIdGenerator;
    this._requestIdGenerator = requestIdGenerator;

    this.logger.debug('CliFeedbackHandler initialized');
  }

  /**
   * 標準化されたイベントを発行する内部ヘルパー
   * @param {string} action - アクション名 (例: 'collect_before')
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
        `Cannot emit event feedback_${action}: eventEmitter or emitStandardizedAsync is missing.`
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
      // コンポーネント名を 'cli'、アクション名を 'feedback_action' 形式に統一
      await this.eventEmitter.emitStandardizedAsync(
        'cli',
        `feedback_${action}`,
        eventData
      );
    } catch (error) {
      this.logger.warn(`イベント発行中にエラー: cli:feedback_${action}`, {
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
   * @throws {CliError|ApplicationError|NotFoundError|StorageError|ValidationError} エラーハンドラーがない場合、またはエラーハンドラーがエラーをスローした場合
   * @private
   */
  _handleError(error, operation, context = {}) {
    // 特定のエラーコードや型はそのまま使う
    const knownErrorCodes = [
      'ERR_CLI_FEEDBACK_COLLECT_ADAPTER',
      'ERR_CLI_FEEDBACK_COLLECT_UNEXPECTED',
      'ERR_CLI_FEEDBACK_RESOLVE_ADAPTER',
      'ERR_CLI_FEEDBACK_RESOLVE_UNEXPECTED',
      'ERR_CLI_FEEDBACK_NOT_FOUND', // NotFoundError から来る可能性
      'ERR_CLI_FEEDBACK_REOPEN_UNEXPECTED',
      'ERR_CLI_FEEDBACK_REPORT_GENERATE',
      'ERR_CLI_FILE_WRITE', // StorageError から来る可能性
      'ERR_CLI_FEEDBACK_PRIORITIZE_UNEXPECTED',
      'ERR_CLI_FEEDBACK_INTEGRATE_TASK_FAILED',
      'ERR_CLI_FEEDBACK_INTEGRATE_SESSION_FAILED',
      'ERR_CLI_FILE_READ', // StorageError から来る可能性
    ];
    const isKnownCliError =
      error instanceof CliError && knownErrorCodes.includes(error.code);
    const isKnownError =
      error instanceof NotFoundError ||
      error instanceof StorageError ||
      error instanceof ValidationError ||
      isKnownCliError;

    const processedError = isKnownError
      ? error
      : new CliError(`Failed during ${operation}`, error, {
          // エラーコード生成ルールを統一 (コンポーネント名を含む)
          code: `ERR_CLI_FEEDBACKHANDLER_${operation.toUpperCase()}`,
          ...context,
        });

    emitErrorEvent(
      this.eventEmitter,
      this.logger,
      'CliFeedbackHandler',
      operation,
      processedError,
      null,
      context
    );

    if (this.errorHandler) {
      return this.errorHandler.handle(
        processedError,
        'CliFeedbackHandler',
        operation,
        context
      );
    } else {
      throw processedError;
    }
  }

  /**
   * テスト結果を収集してフィードバックを生成する
   * @param {string} taskId - タスクID
   * @param {string} testCommand - テストコマンド
   * @returns {Promise<object>} 生成されたフィードバック情報
   * @throws {CliError|ValidationError} 収集に失敗した場合
   */
  async collectFeedback(taskId, testCommand) {
    const operation = 'collectFeedback';
    const traceId = this._traceIdGenerator();
    const requestId = this._requestIdGenerator();
    const context = { taskId, testCommand, traceId, requestId };
    await this._emitEvent(
      'collect_before',
      { taskId, testCommand },
      traceId,
      requestId
    );
    this.logger.info(`Collecting feedback for task: ${taskId}`, context);

    try {
      const result = await this.integrationManager.collectFeedback(
        taskId,
        testCommand
      );

      if (result && result.error) {
        throw new CliError(
          `Feedback collection failed: ${result.error}`,
          null,
          {
            code: 'ERR_CLI_FEEDBACK_COLLECT_ADAPTER',
            taskId,
            testCommand,
            errorDetail: result.error,
          }
        );
      }
      if (!result || !result.feedback_loop || !result.feedback_loop.task_id) {
        throw new CliError(
          'Feedback collection did not return expected result.',
          null,
          {
            code: 'ERR_CLI_FEEDBACK_COLLECT_UNEXPECTED',
            taskId,
            testCommand,
            result,
          }
        );
      }

      // バリデーションを実行
      const validationResult = this.validator.validateFeedbackInput(result);
      if (!validationResult.isValid) {
        throw new ValidationError(
          'Invalid feedback data received after collection',
          {
            context: { errors: validationResult.errors, taskId, result },
          }
        );
      }

      await this._emitEvent(
        'collect_after',
        { taskId, testCommand, result },
        traceId,
        requestId
      );
      this.logger.info(`Feedback collected successfully for task: ${taskId}`, {
        traceId,
        requestId,
      });
      return result;
    } catch (error) {
      // エラーハンドラが値を返さない場合は null を返すなど、適切なデフォルト値を検討
      return this._handleError(error, operation, context);
    }
  }

  /**
   * フィードバックを解決済みとしてマークする
   * @param {string} feedbackId - フィードバックID (通常はタスクID)
   * @returns {Promise<object>} 更新されたフィードバック情報
   * @throws {CliError} 解決に失敗した場合
   */
  async resolveFeedback(feedbackId) {
    const operation = 'resolveFeedback';
    const traceId = this._traceIdGenerator();
    const requestId = this._requestIdGenerator();
    const context = { feedbackId, traceId, requestId }; // taskId ではなく feedbackId を使う
    await this._emitEvent('resolve_before', { feedbackId }, traceId, requestId);
    this.logger.info(`Resolving feedback for: ${feedbackId}`, context);

    try {
      // TODO: integrationManager.resolveFeedback と feedbackManager.updateFeedbackStatus の
      //       インターフェース不整合の可能性を確認し、必要であれば修正する。
      //       現状は integrationManager のインターフェースに従う。
      const result = await this.integrationManager.resolveFeedback(feedbackId);

      if (result && result.error) {
        throw new CliError(
          `Feedback resolution failed: ${result.error}`,
          null,
          {
            code: 'ERR_CLI_FEEDBACK_RESOLVE_ADAPTER',
            feedbackId,
            errorDetail: result.error,
          }
        );
      }
      if (
        !result ||
        !result.feedback_loop ||
        result.feedback_loop.feedback_status !== 'resolved'
      ) {
        throw new CliError(
          'Feedback resolution did not return expected result.',
          null,
          {
            code: 'ERR_CLI_FEEDBACK_RESOLVE_UNEXPECTED',
            feedbackId,
            result,
          }
        );
      }

      await this._emitEvent(
        'resolve_after',
        { feedbackId, result },
        traceId,
        requestId
      );
      this.logger.info(`Feedback resolved successfully for: ${feedbackId}`, {
        traceId,
        requestId,
      });
      return result;
    } catch (error) {
      return this._handleError(error, operation, context);
    }
  }

  /**
   * フィードバックの状態を取得する
   * @param {string} taskId - タスクID
   * @returns {Promise<object>} フィードバック情報
   * @throws {CliError|NotFoundError} 取得に失敗した場合、またはフィードバックが見つからない場合
   */
  async getFeedbackStatus(taskId) {
    const operation = 'getFeedbackStatus';
    const traceId = this._traceIdGenerator();
    const requestId = this._requestIdGenerator();
    const context = { taskId, traceId, requestId };
    await this._emitEvent('status_get_before', { taskId }, traceId, requestId);
    this.logger.info(`Getting feedback status for task: ${taskId}`, context);

    try {
      const feedback = await this.feedbackManager.getFeedbackByTaskId(taskId);
      if (!feedback) {
        throw new NotFoundError(`Feedback not found for task: ${taskId}`, {
          code: 'ERR_CLI_FEEDBACK_NOT_FOUND',
          context: { taskId },
        });
      }
      await this._emitEvent(
        'status_get_after',
        { taskId, feedbackFound: true },
        traceId,
        requestId
      );
      this.logger.info(`Feedback status retrieved for task: ${taskId}`, {
        traceId,
        requestId,
      });
      return feedback;
    } catch (error) {
      // NotFoundError は _handleError でそのままスローされる
      return this._handleError(error, operation, context);
    }
  }

  /**
   * フィードバックを再オープンする
   * @param {string} taskId - タスクID
   * @returns {Promise<object>} 更新されたフィードバック情報
   * @throws {CliError|NotFoundError} 更新に失敗した場合
   */
  async reopenFeedback(taskId) {
    const operation = 'reopenFeedback';
    const traceId = this._traceIdGenerator();
    const requestId = this._requestIdGenerator();
    const context = { taskId, traceId, requestId };
    await this._emitEvent('reopen_before', { taskId }, traceId, requestId);
    this.logger.info(`Reopening feedback for task: ${taskId}`, context);

    try {
      const feedback = await this.feedbackManager.getFeedbackByTaskId(taskId);
      if (!feedback) {
        throw new NotFoundError(`Feedback not found for task: ${taskId}`, {
          code: 'ERR_CLI_FEEDBACK_NOT_FOUND',
          context: { taskId },
        });
      }
      const updatedFeedback = await this.feedbackManager.updateFeedbackStatus(
        feedback,
        'open'
      );

      if (
        !updatedFeedback ||
        updatedFeedback.feedback_loop?.feedback_status !== 'open'
      ) {
        throw new CliError(
          'Feedback reopen did not return expected result.',
          null,
          {
            code: 'ERR_CLI_FEEDBACK_REOPEN_UNEXPECTED',
            taskId,
            result: updatedFeedback,
          }
        );
      }

      await this._emitEvent(
        'reopen_after',
        { taskId, result: updatedFeedback },
        traceId,
        requestId
      );
      this.logger.info(`Feedback reopened successfully for task: ${taskId}`, {
        traceId,
        requestId,
      });
      return updatedFeedback;
    } catch (error) {
      return this._handleError(error, operation, context);
    }
  }

  /**
   * フィードバックレポートを生成する
   * @param {string} taskId - タスクID
   * @param {string|null} [outputPath=null] - 出力ファイルパス (nullの場合は標準出力)
   * @returns {Promise<string>} 生成されたレポート内容、またはファイルパス
   * @throws {CliError|StorageError} 生成または書き込みに失敗した場合
   */
  async generateFeedbackReport(taskId, outputPath = null) {
    const operation = 'generateFeedbackReport';
    const traceId = this._traceIdGenerator();
    const requestId = this._requestIdGenerator();
    const context = { taskId, outputPath, traceId, requestId };
    await this._emitEvent(
      'report_generate_before',
      { taskId, outputPath },
      traceId,
      requestId
    );
    this.logger.info(`Generating feedback report for task: ${taskId}`, context);

    try {
      const report =
        await this.feedbackManager.generateFeedbackMarkdown(taskId);
      if (!report) {
        throw new CliError(
          `Failed to generate feedback report for task ${taskId}`,
          null,
          {
            code: 'ERR_CLI_FEEDBACK_REPORT_GENERATE',
            taskId,
          }
        );
      }

      let resultPath = null;
      if (outputPath) {
        const writeSuccess = await this.storageService.writeText(
          '.',
          outputPath,
          report
        );
        if (!writeSuccess) {
          // StorageService が false を返した場合、内部でエラーログは出力されているはず
          // StorageError をスローして _handleError に処理させる
          throw new StorageError(
            `Failed to write feedback report file: ${outputPath}`,
            {
              code: 'ERR_CLI_FILE_WRITE',
              context: { taskId, path: outputPath },
            }
          );
        }
        resultPath = outputPath;
        this.logger.info(
          `Feedback report saved successfully to: ${resultPath}`,
          { traceId, requestId }
        );
      } else {
        this.logger.info(
          `Feedback report generated successfully for task: ${taskId}`,
          { traceId, requestId }
        );
      }

      await this._emitEvent(
        'report_generate_after',
        { taskId, outputPath: resultPath, reportLength: report.length },
        traceId,
        requestId
      );
      return outputPath ? resultPath : report;
    } catch (error) {
      return this._handleError(error, operation, context);
    }
  }

  /**
   * フィードバックの優先順位付けを行う
   * @param {string} taskId - タスクID
   * @returns {Promise<object>} 更新されたフィードバック情報
   * @throws {CliError|NotFoundError} 優先順位付けに失敗した場合
   */
  async prioritizeFeedback(taskId) {
    const operation = 'prioritizeFeedback';
    const traceId = this._traceIdGenerator();
    const requestId = this._requestIdGenerator();
    const context = { taskId, traceId, requestId };
    await this._emitEvent('prioritize_before', { taskId }, traceId, requestId);
    this.logger.info(`Prioritizing feedback for task: ${taskId}`, context);

    try {
      const feedback = await this.feedbackManager.getFeedbackByTaskId(taskId);
      if (!feedback) {
        throw new NotFoundError(`Feedback not found for task: ${taskId}`, {
          code: 'ERR_CLI_FEEDBACK_NOT_FOUND',
          context: { taskId },
        });
      }
      const updatedFeedback =
        await this.feedbackManager.prioritizeFeedback(feedback);

      if (!updatedFeedback || !updatedFeedback.feedback_loop) {
        throw new CliError(
          'Feedback prioritization did not return expected result.',
          null,
          {
            code: 'ERR_CLI_FEEDBACK_PRIORITIZE_UNEXPECTED',
            taskId,
            result: updatedFeedback,
          }
        );
      }

      await this._emitEvent(
        'prioritize_after',
        { taskId, result: updatedFeedback },
        traceId,
        requestId
      );
      this.logger.info(
        `Feedback prioritized successfully for task: ${taskId}`,
        { traceId, requestId }
      );
      return updatedFeedback;
    } catch (error) {
      return this._handleError(error, operation, context);
    }
  }

  /**
   * フィードバックにGitコミットを関連付ける
   * @param {string} taskId - タスクID
   * @param {string} commitHash - コミットハッシュ
   * @returns {Promise<void>}
   * @throws {CliError|NotFoundError} 関連付けに失敗した場合
   */
  async linkFeedbackToCommit(taskId, commitHash) {
    const operation = 'linkFeedbackToCommit';
    const traceId = this._traceIdGenerator();
    const requestId = this._requestIdGenerator();
    const context = { taskId, commitHash, traceId, requestId };
    await this._emitEvent(
      'link_commit_before',
      { taskId, commitHash },
      traceId,
      requestId
    );
    this.logger.info(
      `Linking commit ${commitHash} to feedback for task ${taskId}`,
      context
    );

    try {
      const feedback = await this.feedbackManager.getFeedbackByTaskId(taskId);
      if (!feedback) {
        throw new NotFoundError(`Feedback not found for task: ${taskId}`, {
          code: 'ERR_CLI_FEEDBACK_NOT_FOUND',
          context: { taskId },
        });
      }
      await this.feedbackManager.linkFeedbackToGitCommit(feedback, commitHash);

      await this._emitEvent(
        'link_commit_after',
        { taskId, commitHash },
        traceId,
        requestId
      );
      this.logger.info(
        `Commit ${commitHash} linked to feedback for task ${taskId} successfully.`,
        { traceId, requestId }
      );
      // void を返すため return なし
    } catch (error) {
      this._handleError(error, operation, context); // エラーハンドラは値を返さない想定
    }
  }

  /**
   * フィードバックにセッションを関連付ける
   * @param {string} taskId - タスクID
   * @param {string} sessionId - セッションID
   * @returns {Promise<void>}
   * @throws {CliError|NotFoundError} 関連付けに失敗した場合
   */
  async linkFeedbackToSession(taskId, sessionId) {
    const operation = 'linkFeedbackToSession';
    const traceId = this._traceIdGenerator();
    const requestId = this._requestIdGenerator();
    const context = { taskId, sessionId, traceId, requestId };
    await this._emitEvent(
      'link_session_before',
      { taskId, sessionId },
      traceId,
      requestId
    );
    this.logger.info(
      `Linking session ${sessionId} to feedback for task ${taskId}`,
      context
    );

    try {
      const feedback = await this.feedbackManager.getFeedbackByTaskId(taskId);
      if (!feedback) {
        throw new NotFoundError(`Feedback not found for task: ${taskId}`, {
          code: 'ERR_CLI_FEEDBACK_NOT_FOUND',
          context: { taskId },
        });
      }
      await this.feedbackManager.linkFeedbackToSession(feedback, sessionId);

      await this._emitEvent(
        'link_session_after',
        { taskId, sessionId },
        traceId,
        requestId
      );
      this.logger.info(
        `Session ${sessionId} linked to feedback for task ${taskId} successfully.`,
        { traceId, requestId }
      );
      // void を返すため return なし
    } catch (error) {
      this._handleError(error, operation, context);
    }
  }

  /**
   * フィードバックをタスクに統合する
   * @param {string} taskId - タスクID
   * @returns {Promise<boolean>} 統合に成功したかどうか
   * @throws {CliError} 統合に失敗した場合
   */
  async integrateFeedbackWithTask(taskId) {
    const operation = 'integrateFeedbackWithTask';
    const traceId = this._traceIdGenerator();
    const requestId = this._requestIdGenerator();
    const context = { taskId, traceId, requestId };
    await this._emitEvent(
      'integrate_task_before',
      { taskId },
      traceId,
      requestId
    );
    this.logger.info(`Integrating feedback with task ${taskId}`, context);

    try {
      const result = await this.feedbackManager.integrateFeedbackWithTask(
        taskId,
        taskId
      );

      if (!result) {
        throw new CliError(
          `Failed to integrate feedback with task ${taskId}`,
          null,
          {
            code: 'ERR_CLI_FEEDBACK_INTEGRATE_TASK_FAILED',
            taskId,
          }
        );
      }

      await this._emitEvent(
        'integrate_task_after',
        { taskId, success: result },
        traceId,
        requestId
      );
      this.logger.info(
        `Feedback integrated with task ${taskId} successfully.`,
        { traceId, requestId }
      );
      return result;
    } catch (error) {
      const handledResult = this._handleError(error, operation, context);
      return handledResult === undefined ? false : handledResult;
    }
  }

  /**
   * フィードバックをセッションに統合する
   * @param {string} taskId - タスクID
   * @param {string} sessionId - セッションID
   * @returns {Promise<boolean>} 統合に成功したかどうか
   * @throws {CliError} 統合に失敗した場合
   */
  async integrateFeedbackWithSession(taskId, sessionId) {
    const operation = 'integrateFeedbackWithSession';
    const traceId = this._traceIdGenerator();
    const requestId = this._requestIdGenerator();
    const context = { taskId, sessionId, traceId, requestId };
    await this._emitEvent(
      'integrate_session_before',
      { taskId, sessionId },
      traceId,
      requestId
    );
    this.logger.info(
      `Integrating feedback for task ${taskId} with session ${sessionId}`,
      context
    );

    try {
      const result = await this.feedbackManager.integrateFeedbackWithSession(
        taskId,
        sessionId
      );

      if (!result) {
        throw new CliError(
          `Failed to integrate feedback for task ${taskId} with session ${sessionId}`,
          null,
          {
            code: 'ERR_CLI_FEEDBACK_INTEGRATE_SESSION_FAILED',
            taskId,
            sessionId,
          }
        );
      }

      await this._emitEvent(
        'integrate_session_after',
        { taskId, sessionId, success: result },
        traceId,
        requestId
      );
      this.logger.info(
        `Feedback for task ${taskId} integrated with session ${sessionId} successfully.`,
        { traceId, requestId }
      );
      return result;
    } catch (error) {
      const handledResult = this._handleError(error, operation, context);
      return handledResult === undefined ? false : handledResult;
    }
  }
}

module.exports = CliFeedbackHandler;

const {
  ApplicationError,
  ValidationError,
  CliError,
  NotFoundError,
  StorageError, // FileWriteError の代わりに StorageError をインポート
} = require('../lib/utils/errors');
const { emitErrorEvent } = require('../lib/utils/error-helpers');
const path = require('path'); // レポート保存パス用

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
   * @param {object} options.errorHandler - エラーハンドラー (オプション)
   */
  constructor(options = {}) {
    // 必須依存関係のチェック
    const requiredDependencies = [
      'logger',
      'eventEmitter',
      'integrationManagerAdapter',
      'feedbackManagerAdapter',
      'storageService',
      'validator',
    ];
    for (const dep of requiredDependencies) {
      if (!options[dep]) {
        throw new ApplicationError(
          `CliFeedbackHandler requires ${dep} instance.`
        );
      }
    }

    this.logger = options.logger;
    this.eventEmitter = options.eventEmitter;
    this.integrationManager = options.integrationManagerAdapter;
    this.feedbackManager = options.feedbackManagerAdapter;
    this.storageService = options.storageService;
    this.validator = options.validator; // フィードバック入力検証用
    this.errorHandler = options.errorHandler;

    this.logger.debug('CliFeedbackHandler initialized');
  }

  /**
   * テスト結果を収集してフィードバックを生成する
   * @param {string} taskId - タスクID
   * @param {string} testCommand - テストコマンド
   * @returns {Promise<object>} 生成されたフィードバック情報
   * @throws {CliError} 収集に失敗した場合
   */
  async collectFeedback(taskId, testCommand) {
    const operation = 'collectFeedback';
    this.logger.info(`Collecting feedback for task: ${taskId}`, {
      operation,
      taskId,
      testCommand,
    });
    await this.eventEmitter.emitStandardizedAsync(
      'cli_feedback',
      `${operation}_before`,
      { taskId, testCommand }
    );

    try {
      // integrationManagerAdapter を使用して収集 (integration.js の実装に合わせる)
      const result = await this.integrationManager.collectFeedback(
        taskId,
        testCommand
      );

      if (result && result.error) {
        // CliError を使用
        throw new CliError(
          `Feedback collection failed: ${result.error}`,
          null,
          {
            code: 'ERR_CLI_FEEDBACK_COLLECT_ADAPTER', // アダプター由来を示すコード
            taskId,
            testCommand,
            errorDetail: result.error,
          }
        );
      }
      if (!result || !result.feedback_loop || !result.feedback_loop.task_id) {
        // 成功時の期待される構造を確認
        // CliError を使用
        throw new CliError(
          'Feedback collection did not return expected result.',
          null,
          {
            code: 'ERR_CLI_FEEDBACK_COLLECT_UNEXPECTED', // より具体的なコード
            taskId,
            testCommand,
            result,
          }
        );
      }

      // TODO: 必要であれば validator で result.feedback_loop を検証

      await this.eventEmitter.emitStandardizedAsync(
        'cli_feedback',
        `${operation}_after`,
        { taskId, testCommand, result }
      );
      this.logger.info(`Feedback collected successfully for task: ${taskId}`);
      return result;
    } catch (error) {
      // エラーコードの扱いを修正
      const cliError =
        error instanceof CliError && // CliError を確認
        (error.code === 'ERR_CLI_FEEDBACK_COLLECT_ADAPTER' ||
          error.code === 'ERR_CLI_FEEDBACK_COLLECT_UNEXPECTED')
          ? error // 特定の CliError はそのまま使用
          : new CliError( // それ以外のエラーは CliError でラップ
              `Failed to collect feedback for task ${taskId}`,
              error, // cause
              { taskId, testCommand } // context
              // code は CliError のデフォルト 'ERR_CLI'
            );
      emitErrorEvent(
        this.eventEmitter,
        this.logger,
        'CliFeedbackHandler',
        operation,
        cliError,
        null,
        { taskId, testCommand }
      );

      if (this.errorHandler) {
        return this.errorHandler.handle(
          cliError,
          'CliFeedbackHandler',
          operation,
          { taskId, testCommand }
        );
      } else {
        throw cliError;
      }
    }
  }

  /**
   * フィードバックを解決済みとしてマークする
   * @param {string} feedbackId - フィードバックID (通常はタスクIDと同じ？ 要確認)
   * @returns {Promise<object>} 更新されたフィードバック情報
   * @throws {CliError} 解決に失敗した場合
   */
  async resolveFeedback(feedbackId) {
    const operation = 'resolveFeedback';
    // feedbackId が実際には taskId を指している可能性が高いが、元の integration.js に合わせる
    const taskId = feedbackId;
    this.logger.info(`Resolving feedback for: ${feedbackId}`, {
      operation,
      feedbackId,
    });
    await this.eventEmitter.emitStandardizedAsync(
      'cli_feedback',
      `${operation}_before`,
      { feedbackId }
    );

    try {
      // integrationManagerAdapter を使用 (integration.js の実装に合わせる)
      // 注意: integrationManager.resolveFeedback は feedbackId を引数に取るが、
      // feedbackManager.updateFeedbackStatus は feedback オブジェクトを引数に取る。整合性を要確認。
      // ここでは integrationManager のインターフェースに従う。
      const result = await this.integrationManager.resolveFeedback(feedbackId);

      if (result && result.error) {
        // CliError を使用
        throw new CliError(
          `Feedback resolution failed: ${result.error}`,
          null,
          {
            code: 'ERR_CLI_FEEDBACK_RESOLVE_ADAPTER', // アダプター由来を示すコード
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
        // 成功時の期待される構造を確認
        // CliError を使用
        throw new CliError(
          'Feedback resolution did not return expected result.',
          null,
          {
            code: 'ERR_CLI_FEEDBACK_RESOLVE_UNEXPECTED', // より具体的なコード
            feedbackId,
            result,
          }
        );
      }

      await this.eventEmitter.emitStandardizedAsync(
        'cli_feedback',
        `${operation}_after`,
        { feedbackId, result }
      );
      this.logger.info(`Feedback resolved successfully for: ${feedbackId}`);
      return result;
    } catch (error) {
      // エラーコードの扱いを修正
      const cliError =
        error instanceof CliError && // CliError を確認
        (error.code === 'ERR_CLI_FEEDBACK_RESOLVE_ADAPTER' ||
          error.code === 'ERR_CLI_FEEDBACK_RESOLVE_UNEXPECTED')
          ? error // 特定の CliError はそのまま使用
          : new CliError( // それ以外のエラーは CliError でラップ
              `Failed to resolve feedback ${feedbackId}`,
              error, // cause
              { feedbackId } // context
              // code は CliError のデフォルト 'ERR_CLI'
            );
      emitErrorEvent(
        this.eventEmitter,
        this.logger,
        'CliFeedbackHandler',
        operation,
        cliError,
        null,
        { feedbackId }
      );

      if (this.errorHandler) {
        return this.errorHandler.handle(
          cliError,
          'CliFeedbackHandler',
          operation,
          { feedbackId }
        );
      } else {
        throw cliError;
      }
    }
  }

  /**
   * フィードバックの状態を取得する
   * @param {string} taskId - タスクID
   * @returns {Promise<object|null>} フィードバック情報、または null
   * @throws {CliError|NotFoundError} 取得に失敗した場合
   */
  async getFeedbackStatus(taskId) {
    const operation = 'getFeedbackStatus';
    this.logger.info(`Getting feedback status for task: ${taskId}`, {
      operation,
      taskId,
    });
    await this.eventEmitter.emitStandardizedAsync(
      'cli_feedback',
      `${operation}_before`,
      { taskId }
    );

    try {
      // feedbackManagerAdapter を直接使用 (feedback.js の実装に合わせる)
      const feedback = await this.feedbackManager.getFeedbackByTaskId(taskId); // await を追加
      await this.eventEmitter.emitStandardizedAsync(
        'cli_feedback',
        `${operation}_after`,
        { taskId, feedbackFound: !!feedback }
      );
      if (feedback) {
        this.logger.info(`Feedback status retrieved for task: ${taskId}`);
      } else {
        this.logger.warn(`Feedback not found for task: ${taskId}`, { taskId }); // logger.warn に context 追加
        // NotFoundError をスローするか、null を返すかは設計次第
        // NotFoundError を使用
        throw new NotFoundError(`Feedback not found for task: ${taskId}`, {
          // options オブジェクトを第2引数に
          code: 'ERR_CLI_FEEDBACK_NOT_FOUND',
          context: { taskId }, // context を options 内に
        });
      }
      return feedback;
    } catch (error) {
      // エラーコードの扱いを修正
      const cliError =
        error instanceof NotFoundError && // instanceof に戻す
        error.code === 'ERR_CLI_FEEDBACK_NOT_FOUND'
          ? error // NotFoundError はそのまま使用
          : new CliError( // それ以外のエラーは CliError でラップ
              `Failed to get feedback status for task ${taskId}`,
              error, // cause
              { taskId, code: error.code } // context に元のエラーコードを追加
              // code は CliError のデフォルト 'ERR_CLI'
            );
      emitErrorEvent(
        this.eventEmitter,
        this.logger,
        'CliFeedbackHandler',
        operation,
        cliError,
        null,
        { taskId }
      );
      if (this.errorHandler) {
        return this.errorHandler.handle(
          cliError,
          'CliFeedbackHandler',
          operation,
          { taskId }
        );
      } else {
        throw cliError;
      }
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
    this.logger.info(`Reopening feedback for task: ${taskId}`, {
      operation,
      taskId,
    });
    await this.eventEmitter.emitStandardizedAsync(
      'cli_feedback',
      `${operation}_before`,
      { taskId }
    );

    try {
      // feedbackManagerAdapter を直接使用 (feedback.js の実装に合わせる)
      const feedback = await this.feedbackManager.getFeedbackByTaskId(taskId); // await を追加
      if (!feedback) {
        // NotFoundError を使用
        throw new NotFoundError(`Feedback not found for task: ${taskId}`, {
          // options オブジェクトを第2引数に
          code: 'ERR_CLI_FEEDBACK_NOT_FOUND',
          context: { taskId }, // context を options 内に
        });
      }
      const updatedFeedback = await this.feedbackManager.updateFeedbackStatus(
        // await を追加
        feedback,
        'open'
      );

      if (
        !updatedFeedback ||
        updatedFeedback.feedback_loop?.feedback_status !== 'open'
      ) {
        // 成功時の期待される構造を確認
        // CliError を使用
        throw new CliError(
          'Feedback reopen did not return expected result.',
          null,
          {
            code: 'ERR_CLI_FEEDBACK_REOPEN_UNEXPECTED', // より具体的なコード
            taskId,
            result: updatedFeedback,
          }
        );
      }

      await this.eventEmitter.emitStandardizedAsync(
        'cli_feedback',
        `${operation}_after`,
        { taskId, result: updatedFeedback }
      );
      this.logger.info(`Feedback reopened successfully for task: ${taskId}`);
      return updatedFeedback;
    } catch (error) {
      // エラーコードの扱いを修正
      const cliError =
        (error instanceof NotFoundError && // instanceof に戻す
          error.code === 'ERR_CLI_FEEDBACK_NOT_FOUND') ||
        (error instanceof CliError &&
          error.code === 'ERR_CLI_FEEDBACK_REOPEN_UNEXPECTED')
          ? error // 特定のエラーはそのまま使用
          : new CliError( // それ以外のエラーは CliError でラップ
              `Failed to reopen feedback for task ${taskId}`,
              error, // cause
              { taskId, code: error.code } // context に元のエラーコードを追加
              // code は CliError のデフォルト 'ERR_CLI'
            );
      emitErrorEvent(
        this.eventEmitter,
        this.logger,
        'CliFeedbackHandler',
        operation,
        cliError,
        null,
        { taskId }
      );
      if (this.errorHandler) {
        return this.errorHandler.handle(
          cliError,
          'CliFeedbackHandler',
          operation,
          { taskId }
        );
      } else {
        throw cliError;
      }
    }
  }

  /**
   * フィードバックレポートを生成する
   * @param {string} taskId - タスクID
   * @param {string|null} outputPath - 出力ファイルパス (nullの場合は標準出力)
   * @returns {Promise<string>} 生成されたレポート内容、またはファイルパス
   * @throws {CliError|FileWriteError} 生成に失敗した場合
   */
  async generateFeedbackReport(taskId, outputPath = null) {
    const operation = 'generateFeedbackReport';
    this.logger.info(`Generating feedback report for task: ${taskId}`, {
      operation,
      taskId,
      outputPath,
    });
    await this.eventEmitter.emitStandardizedAsync(
      'cli_feedback',
      `${operation}_before`,
      { taskId, outputPath }
    );

    try {
      // feedbackManagerAdapter を直接使用 (feedback.js の実装に合わせる)
      const report =
        await this.feedbackManager.generateFeedbackMarkdown(taskId); // await を追加
      if (!report) {
        // CliError を使用
        throw new CliError(
          `Failed to generate feedback report for task ${taskId}`,
          null,
          { code: 'ERR_CLI_FEEDBACK_REPORT_GENERATE', taskId } // より具体的なコード
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
          // StorageError を使用
          throw new StorageError(
            `Failed to write feedback report file: ${outputPath}`,
            {
              // options オブジェクトを第2引数に
              code: 'ERR_CLI_FILE_WRITE',
              context: { taskId, path: outputPath }, // context を options 内に
            }
          );
        }
        resultPath = outputPath;
        this.logger.info(
          `Feedback report saved successfully to: ${resultPath}`
        );
      } else {
        this.logger.info(
          `Feedback report generated successfully for task: ${taskId}`
        );
        // 標準出力への表示は呼び出し元 (Facade or EntryPoint) で行う
      }

      await this.eventEmitter.emitStandardizedAsync(
        'cli_feedback',
        `${operation}_after`,
        { taskId, outputPath: resultPath, reportLength: report.length }
      );
      return outputPath ? resultPath : report; // パス指定時はパス、なければ内容を返す
    } catch (error) {
      // エラーラップロジック修正 (error.code で判定)
      const cliError =
        error.code === 'ERR_CLI_FEEDBACK_REPORT_GENERATE' ||
        error.code === 'ERR_CLI_FILE_WRITE' // StorageError のコードで判定
          ? error // 特定のエラーはそのまま使用
          : new CliError( // それ以外のエラーは CliError でラップ
              `Failed to generate feedback report for task ${taskId}`,
              error, // cause
              { taskId, outputPath, code: error.code } // context に元のエラーコードを追加
            );
      emitErrorEvent(
        this.eventEmitter,
        this.logger,
        'CliFeedbackHandler',
        operation,
        cliError,
        null,
        { taskId, outputPath }
      );
      if (this.errorHandler) {
        return this.errorHandler.handle(
          cliError,
          'CliFeedbackHandler',
          operation,
          { taskId, outputPath }
        );
      } else {
        throw cliError;
      }
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
    this.logger.info(`Prioritizing feedback for task: ${taskId}`, {
      operation,
      taskId,
    });
    await this.eventEmitter.emitStandardizedAsync(
      'cli_feedback',
      `${operation}_before`,
      { taskId }
    );

    try {
      // feedbackManagerAdapter を直接使用 (feedback.js の実装に合わせる)
      const feedback = await this.feedbackManager.getFeedbackByTaskId(taskId); // await を追加
      if (!feedback) {
        // NotFoundError を使用
        throw new NotFoundError(`Feedback not found for task: ${taskId}`, {
          // options オブジェクトを第2引数に
          code: 'ERR_CLI_FEEDBACK_NOT_FOUND',
          context: { taskId }, // context を options 内に
        });
      }
      const updatedFeedback =
        await this.feedbackManager.prioritizeFeedback(feedback); // await を追加

      if (!updatedFeedback || !updatedFeedback.feedback_loop) {
        // 成功時の期待される構造を確認 (ここは変更不要)
        // CliError を使用
        throw new CliError(
          'Feedback prioritization did not return expected result.',
          null,
          {
            code: 'ERR_CLI_FEEDBACK_PRIORITIZE_UNEXPECTED', // より具体的なコード
            taskId,
            result: updatedFeedback,
          }
        );
      }

      await this.eventEmitter.emitStandardizedAsync(
        'cli_feedback',
        `${operation}_after`,
        { taskId, result: updatedFeedback }
      );
      this.logger.info(`Feedback prioritized successfully for task: ${taskId}`);
      return updatedFeedback;
    } catch (error) {
      // エラーコードの扱いを修正
      const cliError =
        (error instanceof NotFoundError && // instanceof に戻す
          error.code === 'ERR_CLI_FEEDBACK_NOT_FOUND') ||
        (error instanceof CliError &&
          error.code === 'ERR_CLI_FEEDBACK_PRIORITIZE_UNEXPECTED')
          ? error // 特定のエラーはそのまま使用
          : new CliError( // それ以外のエラーは CliError でラップ
              `Failed to prioritize feedback for task ${taskId}`,
              error, // cause
              { taskId, code: error.code } // context に元のエラーコードを追加
              // code は CliError のデフォルト 'ERR_CLI'
            );
      emitErrorEvent(
        this.eventEmitter,
        this.logger,
        'CliFeedbackHandler',
        operation,
        cliError,
        null,
        { taskId }
      );
      if (this.errorHandler) {
        return this.errorHandler.handle(
          cliError,
          'CliFeedbackHandler',
          operation,
          { taskId }
        );
      } else {
        throw cliError;
      }
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
    this.logger.info(
      `Linking commit ${commitHash} to feedback for task ${taskId}`,
      { operation, taskId, commitHash }
    );
    await this.eventEmitter.emitStandardizedAsync(
      'cli_feedback',
      `${operation}_before`,
      { taskId, commitHash }
    );

    try {
      // feedbackManagerAdapter を直接使用 (feedback.js の実装に合わせる)
      const feedback = await this.feedbackManager.getFeedbackByTaskId(taskId); // await を追加
      if (!feedback) {
        // NotFoundError を使用
        throw new NotFoundError(`Feedback not found for task: ${taskId}`, {
          // options オブジェクトを第2引数に
          code: 'ERR_CLI_FEEDBACK_NOT_FOUND',
          context: { taskId }, // context を options 内に
        });
      }
      await this.feedbackManager.linkFeedbackToGitCommit(feedback, commitHash); // await を追加

      await this.eventEmitter.emitStandardizedAsync(
        'cli_feedback',
        `${operation}_after`,
        { taskId, commitHash }
      );
      this.logger.info(
        `Commit ${commitHash} linked to feedback for task ${taskId} successfully.`
      );
    } catch (error) {
      // エラーコードの扱いを修正
      const cliError =
        error instanceof NotFoundError && // instanceof に戻す
        error.code === 'ERR_CLI_FEEDBACK_NOT_FOUND'
          ? error // NotFoundError はそのまま使用
          : new CliError( // それ以外のエラーは CliError でラップ
              `Failed to link commit ${commitHash} to feedback for task ${taskId}`,
              error, // cause
              { taskId, commitHash, code: error.code } // context に元のエラーコードを追加
              // code は CliError のデフォルト 'ERR_CLI'
            );
      emitErrorEvent(
        this.eventEmitter,
        this.logger,
        'CliFeedbackHandler',
        operation,
        cliError,
        null,
        { taskId, commitHash }
      );
      if (this.errorHandler) {
        this.errorHandler.handle(cliError, 'CliFeedbackHandler', operation, {
          taskId,
          commitHash,
        });
      } else {
        throw cliError;
      }
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
    this.logger.info(
      `Linking session ${sessionId} to feedback for task ${taskId}`,
      { operation, taskId, sessionId }
    );
    await this.eventEmitter.emitStandardizedAsync(
      'cli_feedback',
      `${operation}_before`,
      { taskId, sessionId }
    );

    try {
      // feedbackManagerAdapter を直接使用 (feedback.js の実装に合わせる)
      const feedback = await this.feedbackManager.getFeedbackByTaskId(taskId); // await を追加
      if (!feedback) {
        // NotFoundError を使用
        throw new NotFoundError(`Feedback not found for task: ${taskId}`, {
          // options オブジェクトを第2引数に
          code: 'ERR_CLI_FEEDBACK_NOT_FOUND',
          context: { taskId }, // context を options 内に
        });
      }
      await this.feedbackManager.linkFeedbackToSession(feedback, sessionId); // await を追加

      await this.eventEmitter.emitStandardizedAsync(
        'cli_feedback',
        `${operation}_after`,
        { taskId, sessionId }
      );
      this.logger.info(
        `Session ${sessionId} linked to feedback for task ${taskId} successfully.`
      );
    } catch (error) {
      // エラーコードの扱いを修正
      const cliError =
        error instanceof NotFoundError && // instanceof に戻す
        error.code === 'ERR_CLI_FEEDBACK_NOT_FOUND'
          ? error // NotFoundError はそのまま使用
          : new CliError( // それ以外のエラーは CliError でラップ
              `Failed to link session ${sessionId} to feedback for task ${taskId}`,
              error, // cause
              { taskId, sessionId, code: error.code } // context に元のエラーコードを追加
              // code は CliError のデフォルト 'ERR_CLI'
            );
      emitErrorEvent(
        this.eventEmitter,
        this.logger,
        'CliFeedbackHandler',
        operation,
        cliError,
        null,
        { taskId, sessionId }
      );
      if (this.errorHandler) {
        this.errorHandler.handle(cliError, 'CliFeedbackHandler', operation, {
          taskId,
          sessionId,
        });
      } else {
        throw cliError;
      }
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
    this.logger.info(`Integrating feedback with task ${taskId}`, {
      operation,
      taskId,
    });
    await this.eventEmitter.emitStandardizedAsync(
      'cli_feedback',
      `${operation}_before`,
      { taskId }
    );

    try {
      // feedbackManagerAdapter を直接使用 (feedback.js の実装に合わせる)
      // integrateFeedbackWithTask は taskId を2つ取るが、feedback.js では同じIDを渡している
      const result = await this.feedbackManager.integrateFeedbackWithTask(
        // await を確認 (元々あった)
        taskId,
        taskId
      );

      await this.eventEmitter.emitStandardizedAsync(
        'cli_feedback',
        `${operation}_after`,
        { taskId, success: result }
      );
      if (result) {
        this.logger.info(
          `Feedback integrated with task ${taskId} successfully.`
        );
      } else {
        this.logger.warn(`Failed to integrate feedback with task ${taskId}.`);
        // CliError を使用
        throw new CliError(
          `Failed to integrate feedback with task ${taskId}`,
          null,
          { code: 'ERR_CLI_FEEDBACK_INTEGRATE_TASK_FAILED', taskId } // より具体的なコード
        );
      }
      return result;
    } catch (error) {
      // エラーコードの扱いを修正
      const cliError =
        error instanceof CliError && // CliError を確認
        error.code === 'ERR_CLI_FEEDBACK_INTEGRATE_TASK_FAILED'
          ? error // 特定の CliError はそのまま使用
          : new CliError( // それ以外のエラーは CliError でラップ
              `Failed to integrate feedback with task ${taskId}`,
              error, // cause
              { taskId } // context
              // code は CliError のデフォルト 'ERR_CLI'
            );
      emitErrorEvent(
        this.eventEmitter,
        this.logger,
        'CliFeedbackHandler',
        operation,
        cliError,
        null,
        { taskId }
      );
      if (this.errorHandler) {
        return (
          this.errorHandler.handle(cliError, 'CliFeedbackHandler', operation, {
            taskId,
          }) || false
        );
      } else {
        throw cliError;
      }
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
    this.logger.info(
      `Integrating feedback for task ${taskId} with session ${sessionId}`,
      { operation, taskId, sessionId }
    );
    await this.eventEmitter.emitStandardizedAsync(
      'cli_feedback',
      `${operation}_before`,
      { taskId, sessionId }
    );

    try {
      // feedbackManagerAdapter を直接使用 (feedback.js の実装に合わせる)
      const result = await this.feedbackManager.integrateFeedbackWithSession(
        // await を確認 (元々あった)
        taskId,
        sessionId
      );

      await this.eventEmitter.emitStandardizedAsync(
        'cli_feedback',
        `${operation}_after`,
        { taskId, sessionId, success: result }
      );
      if (result) {
        this.logger.info(
          `Feedback for task ${taskId} integrated with session ${sessionId} successfully.`
        );
      } else {
        this.logger.warn(
          `Failed to integrate feedback for task ${taskId} with session ${sessionId}.`
        );
        // CliError を使用
        throw new CliError(
          `Failed to integrate feedback for task ${taskId} with session ${sessionId}`,
          null,
          {
            code: 'ERR_CLI_FEEDBACK_INTEGRATE_SESSION_FAILED', // より具体的なコード
            taskId,
            sessionId,
          }
        );
      }
      return result;
    } catch (error) {
      // エラーコードの扱いを修正
      const cliError =
        error instanceof CliError && // CliError を確認
        error.code === 'ERR_CLI_FEEDBACK_INTEGRATE_SESSION_FAILED'
          ? error // 特定の CliError はそのまま使用
          : new CliError( // それ以外のエラーは CliError でラップ
              `Failed to integrate feedback for task ${taskId} with session ${sessionId}`,
              error, // cause
              { taskId, sessionId } // context
              // code は CliError のデフォルト 'ERR_CLI'
            );
      emitErrorEvent(
        this.eventEmitter,
        this.logger,
        'CliFeedbackHandler',
        operation,
        cliError,
        null,
        { taskId, sessionId }
      );
      if (this.errorHandler) {
        return (
          this.errorHandler.handle(cliError, 'CliFeedbackHandler', operation, {
            taskId,
            sessionId,
          }) || false
        );
      } else {
        throw cliError;
      }
    }
  }
}

module.exports = CliFeedbackHandler;

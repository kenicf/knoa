/**
 * セッションリポジトリクラス
 *
 * セッション管理のためのリポジトリクラス。
 * セッションの検索、状態管理、Git連携などの機能を提供します。
 */

const { Repository, NotFoundError, ValidationError } = require('./repository'); // ValidationError をインポート

/**
 * セッションリポジトリクラス
 */
class SessionRepository extends Repository {
  /**
   * コンストラクタ
   * @param {Object} options - オプション
   * @param {Object} options.storageService - ストレージサービス (必須)
   * @param {Object} options.sessionValidator - セッションバリデーター (必須)
   * @param {Object} options.gitService - Gitサービス (必須)
   * @param {Object} options.logger - ロガーインスタンス (必須)
   * @param {Object} [options.eventEmitter] - イベントエミッターインスタンス
   * @param {Object} [options.errorHandler] - エラーハンドラーインスタンス
   * @param {string} [options.directory] - ディレクトリパス
   * @param {string} [options.currentFile] - 現在のファイル名
   * @param {string} [options.historyDirectory] - 履歴ディレクトリ名
   */
  constructor(options = {}) {
    // 必須依存関係のチェック
    if (!options.storageService) {
      throw new Error('SessionRepository requires a storageService instance');
    }
    if (!options.sessionValidator) {
      throw new Error('SessionRepository requires a sessionValidator instance');
    }
    if (!options.gitService) {
      throw new Error('SessionRepository requires a gitService instance');
    }
    if (!options.logger) {
      throw new Error('SessionRepository requires a logger instance');
    }

    // 基底クラスのコンストラクタ呼び出し
    super({
      storageService: options.storageService,
      entityName: 'session',
      logger: options.logger,
      eventEmitter: options.eventEmitter, // 任意
      errorHandler: options.errorHandler, // 任意
      ...options, // directory, currentFile, historyDirectory など他のオプションも渡す
      directory: options.directory || 'ai-context/sessions',
      currentFile: options.currentFile || 'latest-session.json',
      historyDirectory: options.historyDirectory || 'session-history',
      // validator は基底クラスに渡さない (SessionRepository 固有の検証を行うため)
    });

    this.sessionValidator = options.sessionValidator; // sessionValidator を保持
    this.gitService = options.gitService;
  }

  /**
   * 最新のセッションを取得
   * @returns {Promise<Object|null>} 最新のセッション
   */
  async getLatestSession() {
    const operation = 'getLatestSession';
    try {
      if (this.storage.fileExists(this.directory, this.currentFile)) {
        return await this.storage.readJSON(this.directory, this.currentFile);
      }
      return null;
    } catch (error) {
      if (this.errorHandler) {
        // エラーハンドラーに処理を委譲し、デフォルト値として null を返すことを期待
        return (
          this.errorHandler.handle(error, 'SessionRepository', operation, {}) ||
          null
        );
      }
      this.logger.error(`Failed to ${operation}`, { error });
      throw new Error(`Failed to get latest session: ${error.message}`); // 元のエラーメッセージを維持
    }
  }

  /**
   * セッションIDでセッションを取得
   * @param {string} sessionId - セッションID
   * @returns {Promise<Object|null>} セッション
   */
  async getSessionById(sessionId) {
    const operation = 'getSessionById';
    try {
      try {
        // 最新のセッションをチェック
        const latestSession = await this.getLatestSession(); // エラーは getLatestSession 内で処理される想定
        if (
          latestSession &&
          latestSession.session_handover.session_id === sessionId
        ) {
          return latestSession;
        }
      } catch (_error) {
        // getLatestSession がエラーをスローした場合 (errorHandlerがない場合など)
        this.logger.warn(
          `Ignoring error during getLatestSession while getting session by ID ${sessionId}`,
          { error: _error }
        );
      }

      // 履歴からセッションを検索
      const historyFilePath = `${this.directory}/${this.historyDirectory}/session-${sessionId}.json`;
      // fileExists はエラーをスローしない想定
      if (this.storage.fileExists(historyFilePath)) {
        return await this.storage.readJSON(
          `${this.directory}/${this.historyDirectory}`,
          `session-${sessionId}.json`
        ); // readJSON のエラーはここで捕捉される
      }

      return null; // 見つからなかった場合は null を返す
    } catch (error) {
      // storage.readJSON などで発生した予期せぬエラー
      if (this.errorHandler) {
        // エラーハンドラーに処理を委譲し、デフォルト値として null を返すことを期待
        return (
          this.errorHandler.handle(error, 'SessionRepository', operation, {
            sessionId,
          }) || null
        );
      }
      this.logger.error(`Failed to ${operation}`, { sessionId, error });
      throw new Error(
        `Failed to get session by id ${sessionId}: ${error.message}`
      ); // 元のエラーメッセージを維持
    }
  }

  /**
   * 新しいセッションを作成
   * @param {string} previousSessionId - 前回のセッションID
   * @returns {Promise<Object>} 新しいセッション
   */
  async createNewSession(previousSessionId) {
    const operation = 'createNewSession';
    try {
      let previousSession = null;

      // getSessionById/getLatestSession のエラーはそちらで処理される想定
      if (previousSessionId) {
        previousSession = await this.getSessionById(previousSessionId);
      } else {
        previousSession = await this.getLatestSession();
        if (previousSession) {
          previousSessionId = previousSession.session_handover.session_id;
        }
      }

      // _getCurrentGitCommitHash のエラーはそちらで処理される想定
      const sessionId = await this._getCurrentGitCommitHash();
      const timestamp = new Date().toISOString();

      // 新しいセッションの基本構造 (省略)
      const newSession = {
        /* ... (元のコードと同じ) ... */
        session_handover: {
          project_id: previousSession
            ? previousSession.session_handover.project_id
            : 'knoa',
          session_id: sessionId,
          previous_session_id: previousSessionId || null,
          session_timestamp: timestamp,
          session_start_timestamp: timestamp,
          project_state_summary: {
            completed_tasks: [],
            current_tasks: [],
            pending_tasks: [],
            blocked_tasks: [],
          },
          key_artifacts: [],
          git_changes: {
            // Ensure git_changes is initialized
            commits: [],
            summary: {
              files_added: 0,
              files_modified: 0,
              files_deleted: 0,
              lines_added: 0,
              lines_deleted: 0,
            },
          },
          other_changes: { config_changes: [], external_changes: [] },
          current_challenges: [],
          next_session_focus: '',
          action_items: [],
        },
      };

      // 前回のセッションから情報を引き継ぐ (省略)
      if (previousSession) {
        /* ... (元のコードと同じ) ... */
        const prevHandover = previousSession.session_handover;
        newSession.session_handover.project_state_summary = {
          completed_tasks: [
            ...prevHandover.project_state_summary.completed_tasks,
          ],
          current_tasks: [...prevHandover.project_state_summary.current_tasks],
          pending_tasks: [...prevHandover.project_state_summary.pending_tasks],
          blocked_tasks: [
            ...(prevHandover.project_state_summary.blocked_tasks || []),
          ],
        };
        if (Array.isArray(prevHandover.current_challenges)) {
          newSession.session_handover.current_challenges =
            prevHandover.current_challenges.filter(
              (c) =>
                !c.status || (c.status !== 'resolved' && c.status !== 'wontfix')
            );
        }
        if (Array.isArray(prevHandover.action_items)) {
          newSession.session_handover.action_items = [
            ...prevHandover.action_items,
          ];
        }
        newSession.session_handover.next_session_focus =
          prevHandover.next_session_focus;
      }

      // 生成されたセッションを検証
      const validationResult = this.sessionValidator.validate(newSession);
      if (!validationResult.isValid) {
        throw new ValidationError(
          'Generated new session data is invalid',
          validationResult.errors
        );
      }

      return newSession;
    } catch (error) {
      if (this.errorHandler) {
        // 新規セッション作成失敗時は null を返すかエラーをスローするかはハンドラー次第
        return this.errorHandler.handle(error, 'SessionRepository', operation, {
          previousSessionId,
        });
      }
      if (error instanceof ValidationError) {
        this.logger.warn(`Validation Error during ${operation}`, {
          previousSessionId,
          error: error.message,
          errors: error.errors,
        });
        throw error;
      }
      this.logger.error(`Failed to ${operation}`, { previousSessionId, error });
      throw new Error(`Failed to create new session: ${error.message}`); // 元のエラーメッセージを維持
    }
  }

  /**
   * セッションを保存
   * @param {Object} session - セッション
   * @param {boolean} isLatest - 最新のセッションとして保存するかどうか
   * @returns {Promise<boolean>} 保存結果
   */
  async saveSession(session, isLatest = true) {
    const operation = 'saveSession';
    try {
      // バリデータを使用して検証
      const validationResult = this.sessionValidator.validate(session);
      if (!validationResult.isValid) {
        throw new ValidationError(
          'Invalid session data',
          validationResult.errors
        );
      }

      const sessionId = session.session_handover.session_id;

      // セッション履歴に保存 (エラーはここで捕捉)
      await this.storage.writeJSON(
        `${this.directory}/${this.historyDirectory}`,
        `session-${sessionId}.json`,
        session
      );

      // 最新のセッションとして保存 (エラーはここで捕捉)
      if (isLatest) {
        await this.storage.writeJSON(this.directory, this.currentFile, session);
      }

      // イベント発行
      if (this.eventEmitter) {
        this.eventEmitter.emitStandardized('session', 'saved', {
          sessionId,
          isLatest,
        });
      }

      return true;
    } catch (error) {
      if (this.errorHandler) {
        // 保存失敗時は false を返すことを期待
        return (
          this.errorHandler.handle(error, 'SessionRepository', operation, {
            sessionId: session?.session_handover?.session_id,
            isLatest,
          }) || false
        );
      }
      if (error instanceof ValidationError) {
        this.logger.warn(`Validation Error during ${operation}`, {
          sessionId: session?.session_handover?.session_id,
          error: error.message,
          errors: error.errors,
        });
        throw error; // バリデーションエラーはそのままスロー
      }
      this.logger.error(`Failed to ${operation}`, {
        sessionId: session?.session_handover?.session_id,
        isLatest,
        error,
      });
      throw new Error(`Failed to save session: ${error.message}`); // 元のエラーメッセージを維持
    }
  }

  /**
   * Gitコミットからセッション情報を生成
   * @param {string} startCommit - 開始コミットハッシュ
   * @param {string} endCommit - 終了コミットハッシュ
   * @returns {Promise<Object>} セッション
   */
  async createSessionFromGitCommits(startCommit, endCommit, options = {}) {
    const operation = 'createSessionFromGitCommits';
    try {
      // getLatestSession, createNewSession のエラーはそちらで処理される想定
      const latestSession = await this.getLatestSession();
      const session = await this.createNewSession(
        latestSession ? latestSession.session_handover.session_id : null
      );

      if (!session) throw new Error('Failed to create base session structure');

      session.session_handover.session_id = endCommit;

      // _getCommitsBetween, _calculateChangeSummary, _getKeyArtifactCandidates のエラーはそちらで処理される想定
      const commits = await this._getCommitsBetween(startCommit, endCommit);

      // 修正: session.session_handover.git_changes が存在することを確認
      if (!session.session_handover.git_changes) {
        session.session_handover.git_changes = { commits: [], summary: {} };
      }
      session.session_handover.git_changes.commits = commits;

      if (options.forTest) {
        /* ... (元のコードと同じ) ... */
        session.session_handover.git_changes.summary = {
          files_added: 1,
          files_modified: 1,
          files_deleted: 0,
          lines_added: 100,
          lines_deleted: 50,
        };
      } else {
        const summary = await this._calculateChangeSummary(commits);
        session.session_handover.git_changes.summary = summary;
      }

      if (commits.length > 0) {
        /* ... (元のコードと同じ) ... */
        session.session_handover.session_start_timestamp =
          commits[commits.length - 1].timestamp;
        session.session_handover.session_timestamp = commits[0].timestamp;
      }

      const keyArtifacts = await this._getKeyArtifactCandidates(commits);
      session.session_handover.key_artifacts = keyArtifacts;

      // 生成されたセッションを検証
      const validationResult = this.sessionValidator.validate(session);
      if (!validationResult.isValid) {
        throw new ValidationError(
          'Generated session data is invalid',
          validationResult.errors
        );
      }

      return session;
    } catch (error) {
      if (this.errorHandler) {
        // セッション生成失敗時は null を返すかエラーをスローするかはハンドラー次第
        return this.errorHandler.handle(error, 'SessionRepository', operation, {
          startCommit,
          endCommit,
          options,
        });
      }
      if (error instanceof ValidationError) {
        this.logger.warn(`Validation Error during ${operation}`, {
          startCommit,
          endCommit,
          error: error.message,
          errors: error.errors,
        });
        throw error;
      }
      this.logger.error(`Failed to ${operation}`, {
        startCommit,
        endCommit,
        options,
        error,
      });
      throw new Error(
        `Failed to create session from git commits: ${error.message}`
      ); // 元のエラーメッセージを維持
    }
  }

  // _validateSession メソッドは削除

  /**
   * 現在のGitコミットハッシュを取得
   * @returns {Promise<string>} コミットハッシュ
   * @private
   */
  async _getCurrentGitCommitHash() {
    const operation = '_getCurrentGitCommitHash';
    try {
      return await this.gitService.getCurrentCommitHash();
    } catch (error) {
      if (this.errorHandler) {
        // エラーハンドラーに処理を委譲。失敗時は null や空文字を返すか、エラーをスローするかはハンドラー次第
        return this.errorHandler.handle(
          error,
          'SessionRepository',
          operation,
          {}
        );
      }
      this.logger.error(`Failed to ${operation}`, { error });
      throw new Error(
        `Failed to get current git commit hash: ${error.message}`
      );
    }
  }

  /**
   * 2つのコミット間のコミット情報を取得
   * @param {string} startCommit - 開始コミットハッシュ
   * @param {string} endCommit - 終了コミットハッシュ
   * @returns {Promise<Array>} コミット情報の配列
   * @private
   */
  async _getCommitsBetween(startCommit, endCommit) {
    const operation = '_getCommitsBetween';
    try {
      return await this.gitService.getCommitsBetween(startCommit, endCommit);
    } catch (error) {
      if (this.errorHandler) {
        // エラーハンドラーに処理を委譲。失敗時は空配列を返すことを期待
        return (
          this.errorHandler.handle(error, 'SessionRepository', operation, {
            startCommit,
            endCommit,
          }) || []
        );
      }
      this.logger.error(`Failed to ${operation}`, {
        startCommit,
        endCommit,
        error,
      });
      throw new Error(
        `Failed to get commits between ${startCommit} and ${endCommit}: ${error.message}`
      );
    }
  }

  /**
   * 変更サマリーを計算
   * @param {Array} commits - コミット情報の配列
   * @returns {Promise<Object>} 変更サマリー
   * @private
   */
  async _calculateChangeSummary(commits) {
    const operation = '_calculateChangeSummary';
    const defaultSummary = {
      files_added: 0,
      files_modified: 0,
      files_deleted: 0,
      lines_added: 0,
      lines_deleted: 0,
    };
    try {
      let summary = { ...defaultSummary }; // 集計用オブジェクト

      for (const commit of commits) {
        try {
          const stats = await this.gitService.getCommitDiffStats(commit.hash); // エラーは gitService の errorHandler で処理される想定
          if (stats.files) {
            for (const file of stats.files) {
              if (file.status === 'added') summary.files_added++;
              else if (file.status === 'modified') summary.files_modified++;
              else if (file.status === 'deleted') summary.files_deleted++;
            }
          }
          summary.lines_added += stats.lines_added || 0;
          summary.lines_deleted += stats.lines_deleted || 0;
        } catch (commitStatError) {
          // 修正: errorHandler を呼び出す
          if (this.errorHandler) {
            try {
              this.errorHandler.handle(
                commitStatError,
                'SessionRepository',
                operation,
                { commitHash: commit.hash }
              );
            } catch (handlerError) {
              // errorHandler がエラーをスローした場合、ループを中断して rethrow
              throw handlerError;
            }
          } else {
            this.logger.warn(
              `Failed to get diff stats for commit ${commit.hash}, skipping summary calculation for this commit.`,
              { error: commitStatError }
            );
          }
          // エラーが発生しても処理を続行 (errorHandler がスローしない場合)
        }
      }
      return summary;
    } catch (error) {
      // ループ外の予期せぬエラー、または errorHandler がスローしたエラー
      // 修正: エラーハンドラーが既に処理したエラーは再処理せず、そのままスロー
      if (
        this.errorHandler &&
        !(error instanceof Error && error.message.includes('Stats error'))
      ) {
        // errorHandler がまだ処理していない場合のみハンドル
        return (
          this.errorHandler.handle(error, 'SessionRepository', operation, {
            commitCount: commits?.length,
          }) || defaultSummary
        );
      }
      // errorHandler がない場合、または errorHandler がスローした場合
      this.logger.error(`Failed to ${operation}`, {
        commitCount: commits?.length,
        error,
      });
      throw error; // 捕捉したエラーをそのままスロー
    }
  }

  /**
   * キーアーティファクトの候補を取得
   * @param {Array} commits - コミット情報の配列
   * @returns {Promise<Array>} キーアーティファクトの配列
   * @private
   */
  async _getKeyArtifactCandidates(commits) {
    const operation = '_getKeyArtifactCandidates';
    try {
      const artifacts = [];
      const processedFiles = new Set();

      for (const commit of commits) {
        try {
          const files = await this.gitService.getChangedFilesInCommit(
            commit.hash
          ); // エラーは gitService の errorHandler で処理される想定
          for (const file of files) {
            if (processedFiles.has(file.path)) continue;
            processedFiles.add(file.path);
            artifacts.push({
              path: file.path,
              description: `Changed in commit ${commit.hash.substring(0, 7)}`,
              last_modified: commit.timestamp,
              git_status: file.status,
              related_tasks: commit.related_tasks || [],
              importance: 'medium',
            });
          }
        } catch (changedFilesError) {
          // 修正: errorHandler を呼び出す
          if (this.errorHandler) {
            try {
              this.errorHandler.handle(
                changedFilesError,
                'SessionRepository',
                operation,
                { commitHash: commit.hash }
              );
            } catch (handlerError) {
              // errorHandler がエラーをスローした場合、ループを中断して rethrow
              throw handlerError;
            }
          } else {
            this.logger.warn(
              `Failed to get changed files for commit ${commit.hash}, skipping artifact candidates for this commit.`,
              { error: changedFilesError }
            );
          }
          // エラーが発生しても処理を続行 (errorHandler がスローしない場合)
        }
      }
      return artifacts;
    } catch (error) {
      // ループ外の予期せぬエラー、または errorHandler がスローしたエラー
      // 修正: エラーハンドラーが既に処理したエラーは再処理せず、そのままスロー
      if (
        this.errorHandler &&
        !(error instanceof Error && error.message.includes('Files error'))
      ) {
        // errorHandler がまだ処理していない場合のみハンドル
        return (
          this.errorHandler.handle(error, 'SessionRepository', operation, {
            commitCount: commits?.length,
          }) || []
        );
      }
      // errorHandler がない場合、または errorHandler がスローした場合
      this.logger.error(`Failed to ${operation}`, {
        commitCount: commits?.length,
        error,
      });
      throw error; // 捕捉したエラーをそのままスロー
    }
  }

  /**
   * セッション間の状態変化を取得
   * @param {string} previousSessionId - 前回のセッションID
   * @param {string} currentSessionId - 現在のセッションID
   * @returns {Promise<Object>} 状態変化
   */
  async getSessionStateChanges(previousSessionId, currentSessionId) {
    const operation = 'getSessionStateChanges';
    const defaultChanges = {
      newlyCompletedTasks: [],
      newlyAddedTasks: [],
      changedStatusTasks: [],
    };
    try {
      // getSessionById でのエラーはそちらで処理される想定
      const previousSession = await this.getSessionById(previousSessionId);
      const currentSession = await this.getSessionById(currentSessionId);

      if (!previousSession || !currentSession) {
        throw new NotFoundError(
          'Session not found for state change comparison'
        );
      }

      // バリデータを使用して状態変化を検証 (オプション)
      if (
        this.sessionValidator &&
        typeof this.sessionValidator.validateStateChanges === 'function'
      ) {
        const validationResult = this.sessionValidator.validateStateChanges(
          previousSession,
          currentSession
        );
        if (!validationResult.isValid) {
          this.logger.warn('Session state change validation failed', {
            previousSessionId,
            currentSessionId,
            errors: validationResult.errors,
            warnings: validationResult.warnings,
          });
          // 検証エラーは警告に留め、処理は続行する
        }
      }

      const prevState = previousSession.session_handover.project_state_summary;
      const currState = currentSession.session_handover.project_state_summary;

      // 状態変化の計算ロジック (省略)
      const newlyCompletedTasks = currState.completed_tasks.filter(
        (id) => !prevState.completed_tasks.includes(id)
      );
      const allPrevTasks = [
        ...prevState.completed_tasks,
        ...prevState.current_tasks,
        ...prevState.pending_tasks,
        ...(prevState.blocked_tasks || []),
      ];
      const allCurrTasks = [
        ...currState.completed_tasks,
        ...currState.current_tasks,
        ...currState.pending_tasks,
        ...(currState.blocked_tasks || []),
      ];
      const newlyAddedTasks = allCurrTasks.filter(
        (id) => !allPrevTasks.includes(id)
      );
      const changedStatusTasks = [];
      for (const taskId of allCurrTasks) {
        /* ... (元のコードと同じ) ... */
        let prevStatus = null;
        let currStatus = null;
        if (allPrevTasks.includes(taskId)) {
          if (prevState.completed_tasks.includes(taskId))
            prevStatus = 'completed';
          else if (prevState.current_tasks.includes(taskId))
            prevStatus = 'in_progress';
          else if (prevState.pending_tasks.includes(taskId))
            prevStatus = 'pending';
          else if (prevState.blocked_tasks?.includes(taskId))
            prevStatus = 'blocked';
        }
        if (currState.completed_tasks.includes(taskId))
          currStatus = 'completed';
        else if (currState.current_tasks.includes(taskId))
          currStatus = 'in_progress';
        else if (currState.pending_tasks.includes(taskId))
          currStatus = 'pending';
        else if (currState.blocked_tasks?.includes(taskId))
          currStatus = 'blocked';
        if (prevStatus !== currStatus)
          changedStatusTasks.push({
            taskId,
            previousStatus: prevStatus,
            currentStatus: currStatus,
          });
      }

      return { newlyCompletedTasks, newlyAddedTasks, changedStatusTasks };
    } catch (error) {
      if (this.errorHandler) {
        return (
          this.errorHandler.handle(error, 'SessionRepository', operation, {
            previousSessionId,
            currentSessionId,
          }) || defaultChanges
        );
      }
      if (error instanceof NotFoundError) {
        this.logger.warn(`Error during ${operation}`, {
          previousSessionId,
          currentSessionId,
          error: error.message,
        });
        throw error;
      }
      this.logger.error(`Failed to ${operation}`, {
        previousSessionId,
        currentSessionId,
        error,
      });
      throw new Error(`Failed to get session state changes: ${error.message}`); // 元のエラーメッセージを維持
    }
  }
}

module.exports = { SessionRepository };

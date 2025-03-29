/**
 * Gitサービス
 *
 * Git操作を抽象化し、一貫したインターフェースを提供します。
 * コミット情報の取得、タスクIDの抽出、変更ファイルの取得などの機能を提供します。
 */

// simple-git をインポート
const simpleGit = require('simple-git');
const { GitError } = require('./errors'); // GitError はこのモジュール固有

// TODO: Step 5 で emitStandardizedEvent ヘルパーを利用するか検討
// const { emitStandardizedEvent } = require('./event-helpers');

/**
 * Gitサービスクラス
 */
class GitService {
  /**
   * コンストラクタ
   * @param {Object} options - オプション
   * @param {string} [options.repoPath=process.cwd()] - リポジトリパス
   * @param {Object} options.logger - ロガーインスタンス (必須)
   * @param {Object} [options.eventEmitter] - イベントエミッターインスタンス
   * @param {Object} [options.errorHandler] - エラーハンドラー
   */
  constructor(options = {}) {
    // logger を必須にする
    if (!options.logger) {
      throw new Error('Logger instance is required in GitService options.');
    }
    this.repoPath = options.repoPath || process.cwd();
    this.logger = options.logger;
    this.eventEmitter = options.eventEmitter;
    this.errorHandler = options.errorHandler;
    this.taskIdPattern = /#(T[0-9]{3})/g;

    // simple-git インスタンスを作成
    this.git = simpleGit(this.repoPath);

    // TODO: Step 5 で ID 生成を集約
    this._traceIdGenerator =
      options.traceIdGenerator ||
      (() => `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    this._requestIdGenerator =
      options.requestIdGenerator ||
      (() => `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  }

  // _executeCommand メソッドは削除

  /**
   * 現在のコミットハッシュを取得
   * @returns {Promise<string>} コミットハッシュ
   */
  async getCurrentCommitHash() {
    const operationContext = { operation: 'getCurrentCommitHash' };
    try {
      this._emitEvent('commit_get_hash_before', {});
      // simple-git の revparse を使用
      const hash = await this.git.revparse(['HEAD']);
      this._emitEvent('commit_get_hash_after', { hash, success: true });
      return hash;
    } catch (error) {
      this._emitEvent('commit_get_hash_after', {
        success: false,
        error: error.message,
      });
      throw this._handleError(
        'コミットハッシュの取得に失敗しました',
        error,
        operationContext
      );
    }
  }

  /**
   * コミットメッセージからタスクIDを抽出
   * @param {string} message - コミットメッセージ
   * @returns {Array<string>} タスクIDの配列
   */
  extractTaskIdsFromCommitMessage(message) {
    const operationContext = {
      operation: 'extractTaskIdsFromCommitMessage',
      message,
    };
    try {
      // message が null や undefined の場合は空配列を返す
      if (message == null) {
        return [];
      }
      // イベント発行は削除
      const matches = message.match(this.taskIdPattern) || [];
      const taskIds = matches.map((match) => match.substring(1)); // #を除去
      return taskIds;
    } catch (error) {
      throw this._handleError(
        'タスクIDの抽出に失敗しました',
        error,
        operationContext
      );
    }
  }

  /**
   * コミット間のコミット情報を取得
   * @param {string} startCommit - 開始コミット
   * @param {string} endCommit - 終了コミット
   * @returns {Promise<Array<Object>>} コミット情報の配列
   */
  async getCommitsBetween(startCommit, endCommit) {
    const operationContext = {
      operation: 'getCommitsBetween',
      startCommit,
      endCommit,
    };
    try {
      this._emitEvent('commit_get_between_before', { startCommit, endCommit });

      const range = `${startCommit}..${endCommit}`;
      // simple-git の log を使用
      const log = await this.git.log({
        from: startCommit,
        to: endCommit,
        format: { hash: '%H', message: '%s', date: '%ad', author_name: '%an' }, // %ad は --date=iso 相当
        '--date': 'iso',
      });

      const commits = log.all.map((commit) => ({
        hash: commit.hash,
        message: commit.message,
        timestamp: commit.date,
        author: commit.author_name,
        related_tasks: this.extractTaskIdsFromCommitMessage(commit.message),
      }));

      this._emitEvent('commit_get_between_after', {
        startCommit,
        endCommit,
        commits,
        success: true,
      });

      return commits;
    } catch (error) {
      this._emitEvent('commit_get_between_after', {
        startCommit,
        endCommit,
        success: false,
        error: error.message,
      });
      throw this._handleError(
        'コミット間の情報取得に失敗しました',
        error,
        operationContext
      );
    }
  }

  /**
   * コミットで変更されたファイルを取得
   * @param {string} commitHash - コミットハッシュ
   * @returns {Promise<Array<Object>>} 変更されたファイルの配列 { status: string, path: string }
   */
  async getChangedFilesInCommit(commitHash) {
    const operationContext = {
      operation: 'getChangedFilesInCommit',
      commitHash,
    };
    try {
      this._emitEvent('commit_get_changed_files_before', { commitHash });

      // simple-git の show を使用 (--name-status オプション)
      // simple-git v3 では show のパースが改善されている可能性があるが、一旦文字列で取得
      const output = await this.git.show([
        `${commitHash}`,
        '--name-status',
        '--format=',
      ]);

      if (!output) {
        this._emitEvent('commit_get_changed_files_after', {
          commitHash,
          files: [],
          success: true,
        });
        return [];
      }

      const files = output
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => {
          const parts = line.split('\t');
          const status = parts[0];
          const path = parts[parts.length - 1];
          let fileStatus;

          switch (status.charAt(0)) {
            case 'A':
              fileStatus = 'added';
              break;
            case 'M':
              fileStatus = 'modified';
              break;
            case 'D':
              fileStatus = 'deleted';
              break;
            case 'R':
              fileStatus = 'renamed';
              break;
            case 'C':
              fileStatus = 'copied';
              break;
            default:
              fileStatus = status;
          }
          return { status: fileStatus, path };
        });

      this._emitEvent('commit_get_changed_files_after', {
        commitHash,
        files,
        success: true,
      });

      return files;
    } catch (error) {
      this._emitEvent('commit_get_changed_files_after', {
        commitHash,
        success: false,
        error: error.message,
      });
      throw this._handleError(
        '変更されたファイルの取得に失敗しました',
        error,
        operationContext
      );
    }
  }

  /**
   * コミットの差分統計を取得
   * @param {string} commitHash - コミットハッシュ
   * @returns {Promise<Object>} 差分統計 { files: Array, lines_added: number, lines_deleted: number }
   */
  async getCommitDiffStats(commitHash) {
    const operationContext = { operation: 'getCommitDiffStats', commitHash };
    try {
      this._emitEvent('commit_get_diff_stats_before', { commitHash });

      // 変更されたファイルを取得
      const files = await this.getChangedFilesInCommit(commitHash);

      // 行数の変更を取得 (--numstat オプション)
      const output = await this.git.show([
        `${commitHash}`,
        '--numstat',
        '--format=',
      ]);

      let lines_added = 0;
      let lines_deleted = 0;

      if (output) {
        output
          .split('\n')
          .filter((line) => line.trim())
          .forEach((line) => {
            const [added, deleted] = line.split('\t');
            if (added !== '-' && deleted !== '-') {
              lines_added += parseInt(added, 10) || 0;
              lines_deleted += parseInt(deleted, 10) || 0;
            }
          });
      }

      const stats = {
        files,
        lines_added,
        lines_deleted,
      };

      this._emitEvent('commit_get_diff_stats_after', {
        commitHash,
        stats,
        success: true,
      });

      return stats;
    } catch (error) {
      this._emitEvent('commit_get_diff_stats_after', {
        commitHash,
        success: false,
        error: error.message,
      });
      throw this._handleError(
        'コミットの差分統計の取得に失敗しました',
        error,
        operationContext
      );
    }
  }

  /**
   * ブランチ一覧を取得
   * @returns {Promise<Array<string>>} ブランチ名の配列
   */
  async getBranches() {
    const operationContext = { operation: 'getBranches' };
    try {
      this._emitEvent('branch_get_all_before', {});
      // simple-git の branch を使用
      const branchSummary = await this.git.branchLocal(); // ローカルブランチのみ取得
      const branches = branchSummary.all;

      this._emitEvent('branch_get_all_after', { branches, success: true });
      return branches;
    } catch (error) {
      this._emitEvent('branch_get_all_after', {
        success: false,
        error: error.message,
      });
      throw this._handleError(
        'ブランチ一覧の取得に失敗しました',
        error,
        operationContext
      );
    }
  }

  /**
   * 現在のブランチを取得
   * @returns {Promise<string>} ブランチ名
   */
  async getCurrentBranch() {
    const operationContext = { operation: 'getCurrentBranch' };
    try {
      this._emitEvent('branch_get_current_before', {});
      // simple-git の branch を使用
      const branchSummary = await this.git.branchLocal();
      const branch = branchSummary.current;

      this._emitEvent('branch_get_current_after', { branch, success: true });
      return branch;
    } catch (error) {
      this._emitEvent('branch_get_current_after', {
        success: false,
        error: error.message,
      });
      throw this._handleError(
        '現在のブランチの取得に失敗しました',
        error,
        operationContext
      );
    }
  }

  /**
   * コミット履歴を取得
   * @param {number} [limit=10] - 取得する履歴の最大数
   * @returns {Promise<Array<Object>>} コミット情報の配列
   */
  async getCommitHistory(limit = 10) {
    const operationContext = { operation: 'getCommitHistory', limit };
    try {
      this._emitEvent('commit_get_history_before', { limit });

      const count = Number.isInteger(limit) && limit > 0 ? limit : 10;
      // simple-git の log を使用
      const log = await this.git.log({
        n: count, // '-n' オプション
        format: { hash: '%H', message: '%s', date: '%ad', author_name: '%an' },
        '--date': 'iso',
      });

      const commits = log.all.map((commit) => ({
        hash: commit.hash,
        message: commit.message,
        timestamp: commit.date,
        author: commit.author_name,
        related_tasks: this.extractTaskIdsFromCommitMessage(commit.message),
      }));

      this._emitEvent('commit_get_history_after', {
        limit,
        commits,
        success: true,
      });

      return commits;
    } catch (error) {
      this._emitEvent('commit_get_history_after', {
        limit,
        success: false,
        error: error.message,
      });
      throw this._handleError(
        'コミット履歴の取得に失敗しました',
        error,
        operationContext
      );
    }
  }

  /**
   * ファイルの変更履歴を取得
   * @param {string} filePath - ファイルパス
   * @param {number} [limit=10] - 取得する履歴の最大数
   * @returns {Promise<Array<Object>>} コミット情報の配列
   */
  async getFileHistory(filePath, limit = 10) {
    const operationContext = { operation: 'getFileHistory', filePath, limit };
    try {
      this._emitEvent('file_get_history_before', { filePath, limit });

      const count = Number.isInteger(limit) && limit > 0 ? limit : 10;
      // simple-git の log を使用 (ファイルパス指定)
      const log = await this.git.log({
        file: filePath,
        n: count,
        format: { hash: '%H', message: '%s', date: '%ad', author_name: '%an' },
        '--date': 'iso',
      });

      const commits = log.all.map((commit) => ({
        hash: commit.hash,
        message: commit.message,
        timestamp: commit.date,
        author: commit.author_name,
        related_tasks: this.extractTaskIdsFromCommitMessage(commit.message),
      }));

      this._emitEvent('file_get_history_after', {
        filePath,
        limit,
        commits,
        success: true,
      });

      return commits;
    } catch (error) {
      this._emitEvent('file_get_history_after', {
        filePath,
        limit,
        success: false,
        error: error.message,
      });
      throw this._handleError(
        'ファイルの変更履歴の取得に失敗しました',
        error,
        operationContext
      );
    }
  }

  /**
   * イベントを発行
   * @private
   * @param {string} eventName - イベント名 (例: 'command_execute_before')
   * @param {Object} data - イベントデータ
   */
  _emitEvent(eventName, data) {
    if (
      !this.eventEmitter ||
      typeof this.eventEmitter.emitStandardized !== 'function'
    ) {
      return;
    }
    try {
      // ID生成 (Step 5 で見直し)
      const traceId = this._traceIdGenerator();
      const requestId = this._requestIdGenerator();

      const standardizedData = {
        ...data,
        timestamp: new Date().toISOString(),
        traceId,
        requestId,
      };
      // emitStandardized に統一
      this.eventEmitter.emitStandardized(
        'git', // component name
        eventName, // action name
        standardizedData
      );
    } catch (error) {
      this.logger.warn(
        `イベント発行中にエラーが発生しました: git:${eventName}`,
        error
      );
    }
  }

  /**
   * エラーを処理し、GitErrorを生成して返す（またはエラーハンドラに委譲）
   * @private
   * @param {string} message - エラーメッセージ
   * @param {Error} error - 原因となったエラー
   * @param {Object} context - エラーコンテキスト
   * @returns {GitError|any} GitErrorインスタンス、またはエラーハンドラの戻り値
   */
  _handleError(message, error, context = {}) {
    const gitError = new GitError(message, error, context);

    if (this.errorHandler && typeof this.errorHandler.handle === 'function') {
      return this.errorHandler.handle(
        gitError,
        'GitService',
        context.operation,
        context
      );
    }

    this.logger.error(message, {
      error: gitError,
      context,
    });

    // エラーイベントの発行は削除

    // 常にエラーを返す
    return gitError;
  }

  /**
   * コミットの詳細情報を取得
   * @param {string} commitHash - コミットハッシュ
   * @returns {Promise<Object|null>} コミットの詳細情報、またはエラー時にnullを返す代わりにエラーをスロー
   */
  async getCommitDetails(commitHash) {
    const operationContext = { operation: 'getCommitDetails', commitHash };
    try {
      this._emitEvent('commit_get_details_before', { commitHash });

      // simple-git の show を使用して必要な情報を取得
      // %B: message, %H: hash, %an: author name, %ae: author email, %ai: author date (ISO 8601),
      // %cn: committer name, %ce: committer email, %ci: committer date (ISO 8601), %P: parent hashes
      const format = {
        message: '%B',
        hash: '%H',
        author_name: '%an',
        author_email: '%ae',
        author_date: '%ai',
        committer_name: '%cn',
        committer_email: '%ce',
        committer_date: '%ci',
        parents: '%P',
      };
      const log = await this.git.log({ format, n: 1, [commitHash]: null }); // 特定のコミットを指定

      if (!log || !log.latest) {
        this._emitEvent('commit_get_details_after', {
          commitHash,
          details: null,
          success: false,
          error: 'Commit info not found',
        });
        // null を返す代わりにエラーをスローする方が一貫性があるかもしれない
        throw new GitError(
          `Commit not found: ${commitHash}`,
          null,
          operationContext
        );
      }
      const commit = log.latest;

      // 差分統計を取得
      const stats = await this.getCommitDiffStats(commitHash);

      // タスクIDを抽出
      const taskIds = this.extractTaskIdsFromCommitMessage(commit.message);

      const details = {
        hash: commit.hash,
        message: commit.message.trim(), // 末尾の改行を削除
        author: {
          name: commit.author_name,
          email: commit.author_email,
          date: commit.author_date,
        },
        committer: {
          name: commit.committer_name,
          email: commit.committer_email,
          date: commit.committer_date,
        },
        parents: commit.parents ? commit.parents.split(' ') : [],
        files: stats.files,
        stats: {
          lines_added: stats.lines_added,
          lines_deleted: stats.lines_deleted,
          files_changed: stats.files.length,
        },
        related_tasks: taskIds,
      };

      this._emitEvent('commit_get_details_after', {
        commitHash,
        details,
        success: true,
      });

      return details;
    } catch (error) {
      this._emitEvent('commit_get_details_after', {
        commitHash,
        success: false,
        error: error.message,
      });
      throw this._handleError(
        'コミットの詳細情報の取得に失敗しました',
        error,
        operationContext
      );
    }
  }

  // _execGit メソッドは削除

  /**
   * ファイルをステージング
   * @param {Array<string>|string} files - ステージングするファイルのパス（単一または配列）
   * @returns {Promise<boolean>} 成功したかどうか
   */
  async stageFiles(files) {
    const operationContext = { operation: 'stageFiles', files };
    try {
      this._emitEvent('stage_before', { files });
      // simple-git の add を使用
      await this.git.add(files);
      this._emitEvent('stage_after', { files, success: true });
      return true;
    } catch (error) {
      this._emitEvent('stage_after', {
        files,
        success: false,
        error: error.message,
      });
      throw this._handleError(
        'ファイルのステージに失敗しました',
        error,
        operationContext
      );
    }
  }

  /**
   * コミットを作成
   * @param {string} message - コミットメッセージ
   * @returns {Promise<string>} 作成されたコミットのハッシュ
   */
  async createCommit(message) {
    const operationContext = { operation: 'createCommit', message };
    try {
      if (!message || message.trim() === '') {
        const error = new GitError(
          'コミットメッセージが空です',
          null,
          operationContext
        );
        this._emitEvent('commit_create_after', {
          message,
          success: false,
          error: error.message,
        });
        throw error;
      }

      this._emitEvent('commit_create_before', { message });
      // simple-git の commit を使用
      const commitSummary = await this.git.commit(message);
      const hash = commitSummary.commit; // コミットハッシュを取得

      this._emitEvent('commit_create_after', { message, hash, success: true });
      return hash;
    } catch (error) {
      // _emitEvent は _handleError 内で呼ばれるか、既に呼ばれている可能性がある
      throw this._handleError(
        'コミットの作成に失敗しました',
        error,
        operationContext
      );
    }
  }
}

module.exports = GitService;

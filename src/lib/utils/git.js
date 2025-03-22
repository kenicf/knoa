/**
 * Gitサービス
 * 
 * Git操作を抽象化し、一貫したインターフェースを提供します。
 * コミット情報の取得、タスクIDの抽出、変更ファイルの取得などの機能を提供します。
 */

const { execSync } = require('child_process');

/**
 * Gitエラークラス
 */
class GitError extends Error {
  /**
   * コンストラクタ
   * @param {string} message - エラーメッセージ
   * @param {Error} cause - 原因となったエラー
   */
  constructor(message, cause) {
    super(message);
    this.name = 'GitError';
    this.cause = cause;
  }
}

/**
 * Gitサービスクラス
 */
class GitService {
  /**
   * コンストラクタ
   * @param {Object} options - オプション
   * @param {string} options.repoPath - リポジトリパス
   * @param {Object} options.logger - ロガー
   * @param {Object} options.eventEmitter - イベントエミッター
   * @param {Object} options.errorHandler - エラーハンドラー
   */
  constructor(options = {}) {
    this.repoPath = options.repoPath || process.cwd();
    this.logger = options.logger || console;
    this.eventEmitter = options.eventEmitter;
    this.errorHandler = options.errorHandler;
  }

  /**
   * コマンドを実行
   * @private
   * @param {string} command - 実行するコマンド
   * @param {Object} options - オプション
   * @returns {string} コマンドの出力
   */
  _executeCommand(command, options = {}) {
    try {
      const execOptions = {
        cwd: this.repoPath,
        encoding: 'utf8',
        ...options
      };
      
      this._emitEvent('command:execute:before', { command });
      
      const output = execSync(command, execOptions).toString().trim();
      
      this._emitEvent('command:execute:after', { command, success: true });
      
      return output;
    } catch (error) {
      this._emitEvent('command:execute:after', { command, success: false, error });
      
      return this._handleError(`コマンド実行に失敗しました: ${command}`, error, {
        command,
        operation: '_executeCommand'
      });
    }
  }

  /**
   * 現在のコミットハッシュを取得
   * @returns {string} コミットハッシュ
   */
  getCurrentCommitHash() {
    try {
      this._emitEvent('commit:get_hash:before', {});
      
      const hash = this._executeCommand('git rev-parse HEAD');
      
      this._emitEvent('commit:get_hash:after', { hash, success: true });
      
      return hash;
    } catch (error) {
      this._emitEvent('commit:get_hash:after', { success: false, error });
      
      return this._handleError('コミットハッシュの取得に失敗しました', error, {
        operation: 'getCurrentCommitHash'
      });
    }
  }
/**
 * Gitコマンドを実行（互換性のためのエイリアス）
 * @param {string} command - 実行するGitコマンド（git プレフィックスなし）
 * @param {Object} options - オプション
 * @returns {string} コマンドの出力
 */
_execGit(command, options = {}) {
  const fullCommand = `git ${command}`;
  try {
    const result = this._executeCommand(fullCommand, options);
    
    // イベント発行
    if (this.eventEmitter) {
      this.eventEmitter.emit('git:command_executed', {
        command: fullCommand,
        result,
        timestamp: new Date().toISOString()
      });
    }
    
    return result;
  } catch (error) {
    if (this.errorHandler) {
      this.errorHandler.handle(error, 'GitService', '_execGit');
    }
    throw error;
  }
}
/**
 * ファイルをステージングする
 * @param {string} filePath - ステージングするファイルパス
 * @returns {boolean} 成功したかどうか
 */
stageFiles(filePath) {
  try {
    this._emitEvent('git:stage:before', { filePath });
    
    const result = this._executeCommand(`git add ${filePath}`);
    
    this._emitEvent('git:stage:after', { filePath, success: true });
    
    // イベント発行
    if (this.eventEmitter) {
      this.eventEmitter.emit('git:files_staged', {
        filePath,
        timestamp: new Date().toISOString()
      });
    }
    
    return true;
  } catch (error) {
    this._emitEvent('git:stage:after', { filePath, success: false, error });
    
    return this._handleError(`ファイルのステージングに失敗しました: ${filePath}`, error, {
      filePath,
      operation: 'stageFiles'
    });
  }
}

/**
 * コミットを作成する
 * @param {string} message - コミットメッセージ
 * @returns {string} コミットハッシュ
 */
createCommit(message) {
  try {
    this._emitEvent('git:commit:before', { message });
    
    const result = this._executeCommand(`git commit -m "${message}"`);
    
    // コミットハッシュを取得
    const hash = this.getCurrentCommitHash();
    
    this._emitEvent('git:commit:after', { message, hash, success: true });
    
    // イベント発行
    if (this.eventEmitter) {
      this.eventEmitter.emit('git:commit_created', {
        message,
        hash,
        timestamp: new Date().toISOString()
      });
    }
    
    return hash;
  } catch (error) {
    this._emitEvent('git:commit:after', { message, success: false, error });
    
    return this._handleError(`コミットの作成に失敗しました: ${message}`, error, {
      message,
      operation: 'createCommit'
    });
  }
}

/**
 * コミットメッセージからタスクIDを抽出
 * @param {string} message - コミットメッセージ
 * @returns {Array<string>} タスクIDの配列
 */
extractTaskIdsFromCommitMessage(message) {
  extractTaskIdsFromCommitMessage(message) {
    try {
      this._emitEvent('commit:extract_task_ids:before', { message });
      
      const regex = /#(T[0-9]{3})/g;
      const matches = message.match(regex) || [];
      const taskIds = matches.map(match => match.substring(1)); // #を除去
      
      this._emitEvent('commit:extract_task_ids:after', { message, taskIds, success: true });
      
      return taskIds;
    } catch (error) {
      this._emitEvent('commit:extract_task_ids:after', { message, success: false, error });
      
      return this._handleError('タスクIDの抽出に失敗しました', error, {
        message,
        operation: 'extractTaskIdsFromCommitMessage'
      });
    }
  }

  /**
   * コミット間のコミット情報を取得
   * @param {string} startCommit - 開始コミットハッシュ
   * @param {string} endCommit - 終了コミットハッシュ
   * @returns {Array<Object>} コミット情報の配列
   */
  getCommitsBetween(startCommit, endCommit) {
    try {
      this._emitEvent('commit:get_between:before', { startCommit, endCommit });
      
      const command = `git log ${startCommit}..${endCommit} --pretty=format:"%H|%s|%ai|%an"`;
      const output = this._executeCommand(command);
      
      if (!output) {
        this._emitEvent('commit:get_between:after', { startCommit, endCommit, commits: [], success: true });
        return [];
      }
      
      const commits = output.split('\n').map(line => {
        const [hash, message, timestamp, author] = line.split('|');
        const related_tasks = this.extractTaskIdsFromCommitMessage(message);
        
        return {
          hash,
          message,
          timestamp,
          author,
          related_tasks
        };
      });
      
      this._emitEvent('commit:get_between:after', { startCommit, endCommit, commits, success: true });
      
      return commits;
    } catch (error) {
      this._emitEvent('commit:get_between:after', { startCommit, endCommit, success: false, error });
      
      return this._handleError('コミット情報の取得に失敗しました', error, {
        startCommit,
        endCommit,
        operation: 'getCommitsBetween'
      });
    }
  }

  /**
   * コミットで変更されたファイルを取得
   * @param {string} commitHash - コミットハッシュ
   * @returns {Array<Object>} 変更されたファイル情報の配列
   */
  getChangedFilesInCommit(commitHash) {
    try {
      this._emitEvent('commit:get_changed_files:before', { commitHash });
      
      const command = `git show --name-status --format="" ${commitHash}`;
      const output = this._executeCommand(command);
      
      if (!output) {
        this._emitEvent('commit:get_changed_files:after', { commitHash, files: [], success: true });
        return [];
      }
      
      const files = output.split('\n').map(line => {
        const [status, ...pathParts] = line.split('\t');
        
        // リネームの場合は元のパスと新しいパスの両方が含まれる
        if (status.startsWith('R')) {
          const [previousPath, path] = pathParts;
          return { status: 'renamed', path, previous_path: previousPath };
        }
        
        const path = pathParts.join('\t'); // タブが含まれるパス名に対応
        
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
          default:
            fileStatus = status;
        }
        
        return { status: fileStatus, path };
      });
      
      this._emitEvent('commit:get_changed_files:after', { commitHash, files, success: true });
      
      return files;
    } catch (error) {
      this._emitEvent('commit:get_changed_files:after', { commitHash, success: false, error });
      
      return this._handleError('変更されたファイルの取得に失敗しました', error, {
        commitHash,
        operation: 'getChangedFilesInCommit'
      });
    }
  }

  /**
   * コミットの差分統計を取得
   * @param {string} commitHash - コミットハッシュ
   * @returns {Object} 差分統計
   */
  getCommitDiffStats(commitHash) {
    try {
      this._emitEvent('commit:get_diff_stats:before', { commitHash });
      
      // 変更されたファイルを取得
      const files = this.getChangedFilesInCommit(commitHash);
      
      // 行数の変更を取得
      const command = `git show --numstat --format="" ${commitHash}`;
      const output = this._executeCommand(command);
      
      let lines_added = 0;
      let lines_deleted = 0;
      
      if (output) {
        output.split('\n').forEach(line => {
          const [added, deleted] = line.split('\t');
          
          // バイナリファイルなどで '-' が返ってくる場合はスキップ
          if (added !== '-' && deleted !== '-') {
            lines_added += parseInt(added, 10) || 0;
            lines_deleted += parseInt(deleted, 10) || 0;
          }
        });
      }
      
      const result = {
        files,
        lines_added,
        lines_deleted
      };
      
      this._emitEvent('commit:get_diff_stats:after', { commitHash, stats: result, success: true });
      
      return result;
    } catch (error) {
      this._emitEvent('commit:get_diff_stats:after', { commitHash, success: false, error });
      
      return this._handleError('差分統計の取得に失敗しました', error, {
        commitHash,
        operation: 'getCommitDiffStats'
      });
    }
  }

  /**
   * ブランチ一覧を取得
   * @returns {Array<string>} ブランチ名の配列
   */
  getBranches() {
    try {
      this._emitEvent('branch:get_all:before', {});
      
      const command = 'git branch';
      const output = this._executeCommand(command);
      
      if (!output) {
        this._emitEvent('branch:get_all:after', { branches: [], success: true });
        return [];
      }
      
      const branches = output.split('\n').map(branch => {
        // 現在のブランチには '*' が付いているので削除
        return branch.replace(/^\*\s+/, '').trim();
      });
      
      this._emitEvent('branch:get_all:after', { branches, success: true });
      
      return branches;
    } catch (error) {
      this._emitEvent('branch:get_all:after', { success: false, error });
      
      return this._handleError('ブランチ一覧の取得に失敗しました', error, {
        operation: 'getBranches'
      });
    }
  }

  /**
   * 現在のブランチを取得
   * @returns {string} ブランチ名
   */
  getCurrentBranch() {
    try {
      this._emitEvent('branch:get_current:before', {});
      
      const command = 'git branch --show-current';
      const branch = this._executeCommand(command);
      
      this._emitEvent('branch:get_current:after', { branch, success: true });
      
      return branch;
    } catch (error) {
      this._emitEvent('branch:get_current:after', { success: false, error });
      
      return this._handleError('現在のブランチの取得に失敗しました', error, {
        operation: 'getCurrentBranch'
      });
    }
  }

  /**
   * コミット履歴を取得
   * @param {number} limit - 取得するコミット数
   * @returns {Array<Object>} コミット情報の配列
   */
  getCommitHistory(limit = 10) {
    try {
      this._emitEvent('commit:get_history:before', { limit });
      
      const command = `git log -${limit} --pretty=format:"%H|%s|%ai|%an"`;
      const output = this._executeCommand(command);
      
      if (!output) {
        this._emitEvent('commit:get_history:after', { limit, commits: [], success: true });
        return [];
      }
      
      const commits = output.split('\n').map(line => {
        const [hash, message, timestamp, author] = line.split('|');
        const related_tasks = this.extractTaskIdsFromCommitMessage(message);
        
        return {
          hash,
          message,
          timestamp,
          author,
          related_tasks
        };
      });
      
      this._emitEvent('commit:get_history:after', { limit, commits, success: true });
      
      return commits;
    } catch (error) {
      this._emitEvent('commit:get_history:after', { limit, success: false, error });
      
      return this._handleError('コミット履歴の取得に失敗しました', error, {
        limit,
        operation: 'getCommitHistory'
      });
    }
  }

  /**
   * ファイルの変更履歴を取得
   * @param {string} filePath - ファイルパス
   * @param {number} limit - 取得するコミット数
   * @returns {Array<Object>} コミット情報の配列
   */
  getFileHistory(filePath, limit = 10) {
    try {
      this._emitEvent('file:get_history:before', { filePath, limit });
      
      const command = `git log -${limit} --pretty=format:"%H|%s|%ai|%an" -- "${filePath}"`;
      const output = this._executeCommand(command);
      
      if (!output) {
        this._emitEvent('file:get_history:after', { filePath, limit, commits: [], success: true });
        return [];
      }
      
      const commits = output.split('\n').map(line => {
        const [hash, message, timestamp, author] = line.split('|');
        const related_tasks = this.extractTaskIdsFromCommitMessage(message);
        
        return {
          hash,
          message,
          timestamp,
          author,
          related_tasks
        };
      });
      
      this._emitEvent('file:get_history:after', { filePath, limit, commits, success: true });
      
      return commits;
    } catch (error) {
      this._emitEvent('file:get_history:after', { filePath, limit, success: false, error });
      
      return this._handleError('ファイル変更履歴の取得に失敗しました', error, {
        filePath,
        limit,
        operation: 'getFileHistory'
      });
    }
  }

  /**
   * コミットの詳細情報を取得
   * @param {string} commitHash - コミットハッシュ
   * @returns {Object} コミット詳細情報
   */
  getCommitDetails(commitHash) {
    try {
      this._emitEvent('commit:get_details:before', { commitHash });
      
      // コミットメッセージを取得
      const messageCommand = `git show -s --format="%B" ${commitHash}`;
      const message = this._executeCommand(messageCommand);
      
      // コミット情報を取得
      const infoCommand = `git show -s --format="%H|%an|%ae|%ai|%cn|%ce|%ci|%P" ${commitHash}`;
      const info = this._executeCommand(infoCommand);
      
      const [
        hash,
        authorName,
        authorEmail,
        authorDate,
        committerName,
        committerEmail,
        committerDate,
        parents
      ] = info.split('|');
      
      // 変更されたファイルと差分統計を取得
      const diffStats = this.getCommitDiffStats(commitHash);
      
      const result = {
        hash,
        message,
        author: {
          name: authorName,
          email: authorEmail,
          date: authorDate
        },
        committer: {
          name: committerName,
          email: committerEmail,
          date: committerDate
        },
        parents: parents.split(' ').filter(Boolean),
        files: diffStats.files,
        stats: {
          lines_added: diffStats.lines_added,
          lines_deleted: diffStats.lines_deleted,
          files_changed: diffStats.files.length
        },
        related_tasks: this.extractTaskIdsFromCommitMessage(message)
      };
      
      this._emitEvent('commit:get_details:after', { commitHash, details: result, success: true });
      
      return result;
    } catch (error) {
      this._emitEvent('commit:get_details:after', { commitHash, success: false, error });
      
      return this._handleError('コミット詳細の取得に失敗しました', error, {
        commitHash,
        operation: 'getCommitDetails'
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
        this.eventEmitter.emitStandardized('git', eventName, {
          ...data,
          timestamp: new Date().toISOString()
        });
      } else {
        // 後方互換性のために従来のイベント発行も維持
        this.eventEmitter.emit(`git:${eventName}`, {
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
   * @returns {null|Array|Object} エラー処理の結果
   */
  _handleError(message, error, context = {}) {
    const gitError = new GitError(message, error);
    
    // エラーハンドラーがあれば使用
    if (this.errorHandler && typeof this.errorHandler.handle === 'function') {
      return this.errorHandler.handle(gitError, 'GitService', context.operation, {
        additionalContext: context
      });
    }
    
    // エラーハンドラーがなければログに出力
    this.logger.error(`[GitService] ${message}:`, {
      error_name: error.name,
      error_message: error.message,
      stack: error.stack,
      context
    });
    
    // 操作に応じてデフォルト値を返す
    if (
      context.operation === 'getCurrentCommitHash' || 
      context.operation === 'getCurrentBranch'
    ) {
      return '';
    } else if (
      context.operation === 'extractTaskIdsFromCommitMessage' || 
      context.operation === 'getCommitsBetween' || 
      context.operation === 'getChangedFilesInCommit' || 
      context.operation === 'getBranches' || 
      context.operation === 'getCommitHistory' || 
      context.operation === 'getFileHistory'
    ) {
      return [];
    } else if (
      context.operation === 'getCommitDiffStats' || 
      context.operation === 'getCommitDetails'
    ) {
      return {};
    } else if (context.operation === '_executeCommand') {
      return '';
    }
    
    // デフォルトはnull
    return null;
  }
}

module.exports = GitService;
/**
 * Gitサービス
 * 
 * Git操作を抽象化し、一貫したインターフェースを提供します。
 * コミット情報取得、差分取得、タスクID抽出などの共通機能を提供します。
 */

const { execSync } = require('child_process');
const { GitError } = require('../core/error-framework');

/**
 * Gitサービスクラス
 */
class GitService {
  /**
   * コンストラクタ
   * @param {Object} options - オプション
   * @param {string} options.repoPath - リポジトリのパス
   * @param {Object} options.logger - ロガーインスタンス
   * @param {Object} options.eventEmitter - イベントエミッターインスタンス
   */
  constructor(options = {}) {
    this.repoPath = options.repoPath || process.cwd();
    this.logger = options.logger || console;
    this.eventEmitter = options.eventEmitter;
    this.taskIdPattern = options.taskIdPattern || /\b(T[0-9]{3})\b/g;
    this.execOptions = {
      cwd: this.repoPath,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024 // 10MB
    };
  }

  /**
   * Gitコマンドを実行
   * @param {string} command - Gitコマンド
   * @param {Object} options - 実行オプション
   * @returns {string} コマンドの出力
   * @private
   */
  _execGit(command, options = {}) {
    try {
      const fullCommand = `git ${command}`;
      const execOptions = { ...this.execOptions, ...options };
      
      if (options.debug || process.env.DEBUG_GIT) {
        this.logger.debug(`実行: ${fullCommand}`, { cwd: execOptions.cwd });
      }
      
      const output = execSync(fullCommand, execOptions).toString().trim();
      
      if (this.eventEmitter) {
        this.eventEmitter.emit('git:command_executed', { 
          command: fullCommand,
          success: true
        });
      }
      
      return output;
    } catch (error) {
      if (this.eventEmitter) {
        this.eventEmitter.emit('git:command_failed', { 
          command: `git ${command}`,
          error: error.message
        });
      }
      
      throw new GitError(`Gitコマンドの実行に失敗しました: git ${command}`, { 
        cause: error,
        context: { 
          command,
          errorOutput: error.stderr ? error.stderr.toString() : null,
          exitCode: error.status
        }
      });
    }
  }

  /**
   * リポジトリが有効かどうかを確認
   * @returns {boolean} リポジトリが有効かどうか
   */
  isValidRepository() {
    try {
      this._execGit('rev-parse --is-inside-work-tree');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 現在のブランチ名を取得
   * @returns {string} ブランチ名
   */
  getCurrentBranch() {
    return this._execGit('rev-parse --abbrev-ref HEAD');
  }

  /**
   * 現在のコミットハッシュを取得
   * @param {boolean} short - 短いハッシュを取得するかどうか
   * @returns {string} コミットハッシュ
   */
  getCurrentCommitHash(short = false) {
    const command = short ? 'rev-parse --short HEAD' : 'rev-parse HEAD';
    return this._execGit(command);
  }

  /**
   * 指定したコミットの情報を取得
   * @param {string} commitHash - コミットハッシュ
   * @returns {Object} コミット情報
   */
  getCommitInfo(commitHash = 'HEAD') {
    try {
      const format = {
        hash: '%H',
        shortHash: '%h',
        author: '%an',
        authorEmail: '%ae',
        authorDate: '%aI',
        committer: '%cn',
        committerEmail: '%ce',
        committerDate: '%cI',
        subject: '%s',
        body: '%b'
      };
      
      const formatStr = Object.values(format).join('%n');
      const command = `show -s --format="${formatStr}" ${commitHash}`;
      const output = this._execGit(command);
      const lines = output.split('\n');
      
      const result = {};
      let i = 0;
      
      for (const [key, _] of Object.entries(format)) {
        result[key] = lines[i++] || '';
      }
      
      // bodyは複数行の可能性があるため、残りの行を結合
      if (i < lines.length) {
        result.body = lines.slice(i).join('\n');
      }
      
      return result;
    } catch (error) {
      if (error instanceof GitError) {
        throw error;
      }
      throw new GitError(`コミット情報の取得に失敗しました: ${commitHash}`, { cause: error });
    }
  }

  /**
   * コミットメッセージからタスクIDを抽出
   * @param {string} message - コミットメッセージ
   * @returns {Array<string>} タスクIDの配列
   */
  extractTaskIdsFromCommitMessage(message) {
    try {
      const matches = message.match(this.taskIdPattern) || [];
      return [...new Set(matches)]; // 重複を削除
    } catch (error) {
      throw new GitError('タスクIDの抽出に失敗しました', { 
        cause: error,
        context: { message }
      });
    }
  }

  /**
   * 指定したコミットのタスクIDを取得
   * @param {string} commitHash - コミットハッシュ
   * @returns {Array<string>} タスクIDの配列
   */
  getTaskIdsFromCommit(commitHash = 'HEAD') {
    try {
      const commitInfo = this.getCommitInfo(commitHash);
      const message = `${commitInfo.subject}\n${commitInfo.body}`;
      return this.extractTaskIdsFromCommitMessage(message);
    } catch (error) {
      if (error instanceof GitError) {
        throw error;
      }
      throw new GitError(`コミットからのタスクID取得に失敗しました: ${commitHash}`, { cause: error });
    }
  }

  /**
   * 2つのコミット間のコミット一覧を取得
   * @param {string} startCommit - 開始コミット
   * @param {string} endCommit - 終了コミット
   * @returns {Array<Object>} コミット情報の配列
   */
  getCommitsBetween(startCommit, endCommit = 'HEAD') {
    try {
      const command = `log --pretty=format:"%H|%h|%an|%aI|%s" ${startCommit}..${endCommit}`;
      const output = this._execGit(command);
      
      if (!output) {
        return [];
      }
      
      return output.split('\n').map(line => {
        const [hash, shortHash, author, timestamp, subject] = line.split('|');
        const taskIds = this.extractTaskIdsFromCommitMessage(subject);
        
        return {
          hash,
          shortHash,
          author,
          timestamp,
          subject,
          taskIds
        };
      });
    } catch (error) {
      if (error instanceof GitError) {
        throw error;
      }
      throw new GitError(`コミット一覧の取得に失敗しました: ${startCommit}..${endCommit}`, { cause: error });
    }
  }

  /**
   * 指定したコミットの変更ファイル一覧を取得
   * @param {string} commitHash - コミットハッシュ
   * @returns {Array<Object>} 変更ファイル情報の配列
   */
  getChangedFilesInCommit(commitHash = 'HEAD') {
    try {
      const command = `show --name-status --pretty=format:"" ${commitHash}`;
      const output = this._execGit(command);
      
      if (!output) {
        return [];
      }
      
      return output.trim().split('\n').filter(Boolean).map(line => {
        const [status, ...pathParts] = line.trim().split('\t');
        const path = pathParts.join('\t'); // タブを含むパス名に対応
        
        return {
          status: this._mapGitStatusToAction(status),
          path
        };
      });
    } catch (error) {
      if (error instanceof GitError) {
        throw error;
      }
      throw new GitError(`変更ファイル一覧の取得に失敗しました: ${commitHash}`, { cause: error });
    }
  }

  /**
   * Gitのステータスコードをアクション名にマッピング
   * @param {string} status - Gitのステータスコード
   * @returns {string} アクション名
   * @private
   */
  _mapGitStatusToAction(status) {
    const statusMap = {
      'A': 'added',
      'M': 'modified',
      'D': 'deleted',
      'R': 'renamed',
      'C': 'copied',
      'U': 'unmerged',
      'T': 'type_changed'
    };
    
    const firstChar = status.charAt(0);
    return statusMap[firstChar] || 'unknown';
  }

  /**
   * 指定したコミットの差分統計情報を取得
   * @param {string} commitHash - コミットハッシュ
   * @returns {Object} 差分統計情報
   */
  getCommitDiffStats(commitHash = 'HEAD') {
    try {
      const command = `diff --stat ${commitHash}^ ${commitHash}`;
      const output = this._execGit(command);
      
      // 最後の行から統計情報を抽出
      const lines = output.split('\n');
      const lastLine = lines[lines.length - 1] || '';
      
      const filesChanged = (lastLine.match(/(\d+) files? changed/) || [])[1] || 0;
      const insertions = (lastLine.match(/(\d+) insertions?/) || [])[1] || 0;
      const deletions = (lastLine.match(/(\d+) deletions?/) || [])[1] || 0;
      
      return {
        filesChanged: parseInt(filesChanged, 10),
        insertions: parseInt(insertions, 10),
        deletions: parseInt(deletions, 10)
      };
    } catch (error) {
      if (error instanceof GitError) {
        throw error;
      }
      throw new GitError(`差分統計情報の取得に失敗しました: ${commitHash}`, { cause: error });
    }
  }

  /**
   * 作業ディレクトリの状態を取得
   * @returns {Object} 作業ディレクトリの状態
   */
  getWorkingDirectoryStatus() {
    try {
      const command = 'status --porcelain';
      const output = this._execGit(command);
      
      if (!output) {
        return {
          clean: true,
          staged: [],
          unstaged: [],
          untracked: []
        };
      }
      
      const staged = [];
      const unstaged = [];
      const untracked = [];
      
      output.split('\n').filter(Boolean).forEach(line => {
        const statusCode = line.substring(0, 2);
        const path = line.substring(3);
        
        // ステータスコードの解釈
        // X = インデックス、Y = 作業ツリー
        // ' ' = 変更なし、M = 変更あり、A = 追加、D = 削除、R = 名前変更、C = コピー、U = 更新（マージ時）、? = 追跡されていない
        const [indexStatus, workTreeStatus] = statusCode;
        
        if (indexStatus !== ' ' && indexStatus !== '?') {
          staged.push({
            path,
            status: this._mapGitStatusToAction(indexStatus)
          });
        }
        
        if (workTreeStatus !== ' ') {
          if (indexStatus === '?') {
            untracked.push({ path });
          } else {
            unstaged.push({
              path,
              status: this._mapGitStatusToAction(workTreeStatus)
            });
          }
        }
      });
      
      return {
        clean: staged.length === 0 && unstaged.length === 0 && untracked.length === 0,
        staged,
        unstaged,
        untracked
      };
    } catch (error) {
      if (error instanceof GitError) {
        throw error;
      }
      throw new GitError('作業ディレクトリの状態取得に失敗しました', { cause: error });
    }
  }

  /**
   * ファイルをステージング
   * @param {string|Array<string>} paths - ファイルパスまたはパスの配列
   * @returns {boolean} 成功したかどうか
   */
  stageFiles(paths) {
    try {
      const pathsArray = Array.isArray(paths) ? paths : [paths];
      
      if (pathsArray.length === 0) {
        return false;
      }
      
      const escapedPaths = pathsArray.map(p => `"${p.replace(/"/g, '\\"')}"`).join(' ');
      const command = `add ${escapedPaths}`;
      
      this._execGit(command);
      
      if (this.eventEmitter) {
        this.eventEmitter.emit('git:files_staged', { paths: pathsArray });
      }
      
      return true;
    } catch (error) {
      if (error instanceof GitError) {
        throw error;
      }
      throw new GitError('ファイルのステージングに失敗しました', { 
        cause: error,
        context: { paths }
      });
    }
  }

  /**
   * コミットを作成
   * @param {string} message - コミットメッセージ
   * @param {Object} options - オプション
   * @param {boolean} options.allowEmpty - 空のコミットを許可するかどうか
   * @param {string} options.author - 作者（"Name <email>"形式）
   * @returns {string} 作成されたコミットのハッシュ
   */
  createCommit(message, options = {}) {
    try {
      let command = 'commit';
      
      if (options.allowEmpty) {
        command += ' --allow-empty';
      }
      
      if (options.author) {
        command += ` --author="${options.author}"`;
      }
      
      command += ` -m "${message.replace(/"/g, '\\"')}"`;
      
      this._execGit(command);
      
      const commitHash = this.getCurrentCommitHash();
      
      if (this.eventEmitter) {
        this.eventEmitter.emit('git:commit_created', { 
          hash: commitHash,
          message
        });
      }
      
      return commitHash;
    } catch (error) {
      if (error instanceof GitError) {
        throw error;
      }
      throw new GitError('コミットの作成に失敗しました', { 
        cause: error,
        context: { message, options }
      });
    }
  }

  /**
   * ブランチを作成
   * @param {string} branchName - ブランチ名
   * @param {string} startPoint - 開始ポイント
   * @param {boolean} checkout - 作成後にチェックアウトするかどうか
   * @returns {boolean} 成功したかどうか
   */
  createBranch(branchName, startPoint = 'HEAD', checkout = false) {
    try {
      let command = `branch ${branchName} ${startPoint}`;
      
      this._execGit(command);
      
      if (checkout) {
        this._execGit(`checkout ${branchName}`);
      }
      
      if (this.eventEmitter) {
        this.eventEmitter.emit('git:branch_created', { 
          name: branchName,
          startPoint,
          checkout
        });
      }
      
      return true;
    } catch (error) {
      if (error instanceof GitError) {
        throw error;
      }
      throw new GitError('ブランチの作成に失敗しました', { 
        cause: error,
        context: { branchName, startPoint, checkout }
      });
    }
  }

  /**
   * ブランチをチェックアウト
   * @param {string} branchName - ブランチ名
   * @returns {boolean} 成功したかどうか
   */
  checkoutBranch(branchName) {
    try {
      this._execGit(`checkout ${branchName}`);
      
      if (this.eventEmitter) {
        this.eventEmitter.emit('git:branch_checked_out', { name: branchName });
      }
      
      return true;
    } catch (error) {
      if (error instanceof GitError) {
        throw error;
      }
      throw new GitError('ブランチのチェックアウトに失敗しました', { 
        cause: error,
        context: { branchName }
      });
    }
  }

  /**
   * タグを作成
   * @param {string} tagName - タグ名
   * @param {string} message - タグメッセージ
   * @param {string} commitHash - コミットハッシュ
   * @returns {boolean} 成功したかどうか
   */
  createTag(tagName, message, commitHash = 'HEAD') {
    try {
      const command = `tag -a ${tagName} -m "${message.replace(/"/g, '\\"')}" ${commitHash}`;
      
      this._execGit(command);
      
      if (this.eventEmitter) {
        this.eventEmitter.emit('git:tag_created', { 
          name: tagName,
          message,
          commitHash
        });
      }
      
      return true;
    } catch (error) {
      if (error instanceof GitError) {
        throw error;
      }
      throw new GitError('タグの作成に失敗しました', { 
        cause: error,
        context: { tagName, message, commitHash }
      });
    }
  }

  /**
   * リモートリポジトリからプル
   * @param {string} remote - リモート名
   * @param {string} branch - ブランチ名
   * @returns {boolean} 成功したかどうか
   */
  pull(remote = 'origin', branch = '') {
    try {
      const command = `pull ${remote} ${branch}`.trim();
      
      this._execGit(command);
      
      if (this.eventEmitter) {
        this.eventEmitter.emit('git:pulled', { remote, branch });
      }
      
      return true;
    } catch (error) {
      if (error instanceof GitError) {
        throw error;
      }
      throw new GitError('プルに失敗しました', { 
        cause: error,
        context: { remote, branch }
      });
    }
  }

  /**
   * リモートリポジトリにプッシュ
   * @param {string} remote - リモート名
   * @param {string} branch - ブランチ名
   * @param {boolean} force - 強制プッシュするかどうか
   * @returns {boolean} 成功したかどうか
   */
  push(remote = 'origin', branch = '', force = false) {
    try {
      let command = `push ${remote} ${branch}`.trim();
      
      if (force) {
        command += ' --force';
      }
      
      this._execGit(command);
      
      if (this.eventEmitter) {
        this.eventEmitter.emit('git:pushed', { remote, branch, force });
      }
      
      return true;
    } catch (error) {
      if (error instanceof GitError) {
        throw error;
      }
      throw new GitError('プッシュに失敗しました', { 
        cause: error,
        context: { remote, branch, force }
      });
    }
  }
}

module.exports = GitService;
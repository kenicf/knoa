/**
 * セッション管理ユーティリティ
 * 
 * セッション間の状態引継ぎを管理するためのユーティリティ関数群
 */

// スキーマの読み込み
const sessionSchema = require('../schemas/session.schema.json');

/**
 * セッション管理クラス
 */
class SessionManager {
  /**
   * コンストラクタ
   * @param {Object} storageService - ストレージサービス（必須）
   * @param {Object} gitService - Gitサービス（必須）
   * @param {Object} logger - ロガー（必須）
   * @param {Object} eventEmitter - イベントエミッター（必須）
   * @param {Object} errorHandler - エラーハンドラー（必須）
   * @param {Object} options - 追加オプション
   * @param {string} options.sessionsDir - セッションディレクトリのパス
   * @param {string} options.templateDir - テンプレートディレクトリのパス
   */
  constructor(storageService, gitService, logger, eventEmitter, errorHandler, options = {}) {
    // 依存関係のバリデーション
    if (!storageService) throw new Error('SessionManager requires a storageService instance');
    if (!gitService) throw new Error('SessionManager requires a gitService instance');
    if (!logger) throw new Error('SessionManager requires a logger instance');
    if (!eventEmitter) throw new Error('SessionManager requires an eventEmitter instance');
    if (!errorHandler) throw new Error('SessionManager requires an errorHandler instance');
    
    // 依存関係の設定
    this.storageService = storageService;
    this.gitService = gitService;
    this.logger = logger;
    this.eventEmitter = eventEmitter;
    this.errorHandler = errorHandler;
    
    // オプションの設定
    this.sessionsDir = options.sessionsDir || 'ai-context/sessions';
    this.templateDir = options.templateDir || 'src/templates/docs';
    
    // ディレクトリの存在確認はstorageServiceに委譲
    this.storageService.ensureDirectoryExists(`${this.sessionsDir}/session-history`);
    
    this.logger.info('SessionManager initialized', { 
      sessionsDir: this.sessionsDir,
      templateDir: this.templateDir
    });
  }

  /**
   * セッションの検証
   * @param {Object} session - セッションオブジェクト
   * @returns {boolean} 検証結果
   */
  validateSession(session) {
    // 基本的な構造チェック
    if (!session || !session.session_handover) {
      this.logger.error('セッションオブジェクトが不正です');
      return false;
    }

    const handover = session.session_handover;
    
    // 必須フィールドのチェック
    const requiredFields = ['project_id', 'session_id', 'session_timestamp', 'project_state_summary', 'next_session_focus'];
    for (const field of requiredFields) {
      if (!handover[field]) {
        this.logger.error(`必須フィールド ${field} がありません`);
        return false;
      }
    }
    
    // project_state_summaryのチェック
    const stateSummary = handover.project_state_summary;
    if (!stateSummary.completed_tasks || !stateSummary.current_tasks || !stateSummary.pending_tasks) {
      this.logger.error('project_state_summary の必須フィールドがありません');
      return false;
    }
    
    // タスクIDの形式チェック
    const taskPattern = /^T[0-9]{3}$/;
    const allTasks = [
      ...stateSummary.completed_tasks,
      ...stateSummary.current_tasks,
      ...stateSummary.pending_tasks,
      ...(stateSummary.blocked_tasks || [])
    ];
    
    for (const taskId of allTasks) {
      if (!taskPattern.test(taskId)) {
        this.logger.error(`不正なタスクID形式です: ${taskId}`);
        return false;
      }
    }
    
    return true;
  }

  /**
   * 最新のセッションを取得
   * @returns {Object} 最新のセッション
   */
  getLatestSession() {
    try {
      if (this.storageService.fileExists(this.sessionsDir, 'latest-session.json')) {
        return this.storageService.readJSON(this.sessionsDir, 'latest-session.json');
      }
    } catch (error) {
      this.errorHandler.handle(error, 'SessionManager', 'getLatestSession');
    }
    return null;
  }

  /**
   * セッションIDでセッションを取得
   * @param {string} sessionId - セッションID
   * @returns {Object} セッション
   */
  getSessionById(sessionId) {
    try {
      // 最新のセッションをチェック
      const latestSession = this.getLatestSession();
      if (latestSession && latestSession.session_handover.session_id === sessionId) {
        return latestSession;
      }
      
      // 履歴からセッションを検索
      if (this.storageService.fileExists(`${this.sessionsDir}/session-history`, `session-${sessionId}.json`)) {
        return this.storageService.readJSON(`${this.sessionsDir}/session-history`, `session-${sessionId}.json`);
      }
    } catch (error) {
      this.errorHandler.handle(error, 'SessionManager', 'getSessionById');
    }
    return null;
  }

  /**
   * 新しいセッションを作成
   * @param {string} previousSessionId - 前回のセッションID
   * @returns {Object} 新しいセッション
   */
  createNewSession(previousSessionId) {
    try {
      let previousSession = null;
      
      if (previousSessionId) {
        previousSession = this.getSessionById(previousSessionId);
      } else {
        // 前回のセッションIDが指定されていない場合は最新のセッションを使用
        previousSession = this.getLatestSession();
        if (previousSession) {
          previousSessionId = previousSession.session_handover.session_id;
        }
      }
      
      // 現在のGitコミットハッシュを取得
      const sessionId = this._getCurrentGitCommitHash();
      const timestamp = new Date().toISOString();
      
      // 新しいセッションの基本構造
      const newSession = {
        session_handover: {
          project_id: previousSession ? previousSession.session_handover.project_id : 'knoa',
          session_id: sessionId,
          previous_session_id: previousSessionId || null,
          session_timestamp: timestamp,
          session_start_timestamp: timestamp,
          project_state_summary: {
            completed_tasks: [],
            current_tasks: [],
            pending_tasks: [],
            blocked_tasks: []
          },
          key_artifacts: [],
          git_changes: {
            commits: [],
            summary: {
              files_added: 0,
              files_modified: 0,
              files_deleted: 0,
              lines_added: 0,
              lines_deleted: 0
            }
          },
          other_changes: {
            config_changes: [],
            external_changes: []
          },
          current_challenges: [],
          next_session_focus: '',
          action_items: []
        }
      };
      
      // 前回のセッションから情報を引き継ぐ
      if (previousSession) {
        const prevHandover = previousSession.session_handover;
        
        // タスク状態の引き継ぎ
        newSession.session_handover.project_state_summary = {
          completed_tasks: [...prevHandover.project_state_summary.completed_tasks],
          current_tasks: [...prevHandover.project_state_summary.current_tasks],
          pending_tasks: [...prevHandover.project_state_summary.pending_tasks],
          blocked_tasks: [...(prevHandover.project_state_summary.blocked_tasks || [])]
        };
        
        // 課題の引き継ぎ（resolvedでないもの）
        if (Array.isArray(prevHandover.current_challenges)) {
          newSession.session_handover.current_challenges = prevHandover.current_challenges
            .filter(challenge => {
              return !challenge.status || 
                     (challenge.status !== 'resolved' && challenge.status !== 'wontfix');
            });
        }
        
        // アクションアイテムの引き継ぎ
        if (Array.isArray(prevHandover.action_items)) {
          newSession.session_handover.action_items = [...prevHandover.action_items];
        }
        
        // 次のセッションの焦点を引き継ぐ
        newSession.session_handover.next_session_focus = prevHandover.next_session_focus;
      }
      
      return newSession;
    } catch (error) {
      this.errorHandler.handle(error, 'SessionManager', 'createNewSession');
      return null;
    }
  }

  /**
   * セッションを保存
   * @param {Object} session - セッション
   * @param {boolean} isLatest - 最新のセッションとして保存するかどうか
   * @returns {boolean} 保存結果
   */
  saveSession(session, isLatest = true) {
    try {
      if (!this.validateSession(session)) {
        this.logger.error('不正なセッションは保存できません');
        return false;
      }
      
      const sessionId = session.session_handover.session_id;
      
      // セッション履歴に保存
      this.storageService.writeJSON(`${this.sessionsDir}/session-history`, `session-${sessionId}.json`, session);
      
      // 最新のセッションとして保存
      if (isLatest) {
        this.storageService.writeJSON(this.sessionsDir, 'latest-session.json', session);
      }
      
      this.eventEmitter.emit('session:saved', { sessionId, isLatest });
      
      return true;
    } catch (error) {
      this.errorHandler.handle(error, 'SessionManager', 'saveSession');
      return false;
    }
  }

  /**
   * Gitコミットからセッション情報を生成
   * @param {string} startCommit - 開始コミットハッシュ
   * @param {string} endCommit - 終了コミットハッシュ
   * @returns {Object} セッション
   */
  createSessionFromGitCommits(startCommit, endCommit) {
    try {
      // 最新のセッションを取得
      const latestSession = this.getLatestSession();
      
      // 新しいセッションの基本構造
      const session = this.createNewSession(latestSession ? latestSession.session_handover.session_id : null);
      
      if (!session) {
        return null;
      }
      
      // セッションIDを終了コミットハッシュに設定
      session.session_handover.session_id = endCommit;
      
      // コミット情報を取得
      const commits = this._getCommitsBetween(startCommit, endCommit);
      session.session_handover.git_changes.commits = commits;
      
      // 変更サマリーを計算
      const summary = this.calculateChangeSummary(commits);
      session.session_handover.git_changes.summary = summary;
      
      // セッションの開始時刻と終了時刻を設定
      if (commits.length > 0) {
        // 最初のコミットの時刻を開始時刻に
        session.session_handover.session_start_timestamp = commits[commits.length - 1].timestamp;
        // 最後のコミットの時刻を終了時刻に
        session.session_handover.session_timestamp = commits[0].timestamp;
      }
      
      // key_artifactの候補を取得
      const keyArtifacts = this.getKeyArtifactCandidates(commits);
      session.session_handover.key_artifacts = keyArtifacts;
      
      return session;
    } catch (error) {
      this.errorHandler.handle(error, 'SessionManager', 'createSessionFromGitCommits');
      return null;
    }
  }

  /**
   * コミットメッセージからタスクIDを抽出
   * @param {string} message - コミットメッセージ
   * @returns {Array} タスクIDの配列
   */
  extractTaskIdsFromCommitMessage(message) {
    return this.gitService.extractTaskIdsFromCommitMessage(message);
  }

  /**
   * 現在のGitコミットハッシュを取得
   * @returns {string} コミットハッシュ
   * @private
   */
  _getCurrentGitCommitHash() {
    return this.gitService.getCurrentCommitHash();
  }

  /**
   * 2つのコミット間のコミット情報を取得
   * @param {string} startCommit - 開始コミットハッシュ
   * @param {string} endCommit - 終了コミットハッシュ
   * @returns {Array} コミット情報の配列
   * @private
   */
  _getCommitsBetween(startCommit, endCommit) {
    return this.gitService.getCommitsBetween(startCommit, endCommit);
  }

  // 他のメソッドも同様に修正...
}

module.exports = { SessionManager };
/**
 * セッション管理ユーティリティ
 * 
 * セッション間の状態引継ぎを管理するためのユーティリティ関数群
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// スキーマの読み込み
const sessionSchema = require('../schemas/session.schema.json');

/**
 * セッション管理クラス
 */
class SessionManager {
  /**
   * コンストラクタ
   * @param {Object} options - オプション
   * @param {string} options.sessionsDir - セッションディレクトリのパス
   * @param {string} options.templateDir - テンプレートディレクトリのパス
   */
  constructor(options = {}) {
    this.sessionsDir = options.sessionsDir || path.join(process.cwd(), 'ai-context', 'sessions');
    this.templateDir = options.templateDir || path.join(process.cwd(), 'src', 'templates', 'docs');
    this.latestSessionPath = path.join(this.sessionsDir, 'latest-session.json');
    this.sessionHistoryDir = path.join(this.sessionsDir, 'session-history');
    
    // ディレクトリが存在しない場合は作成
    if (!fs.existsSync(this.sessionHistoryDir)) {
      fs.mkdirSync(this.sessionHistoryDir, { recursive: true });
    }
  }

  /**
   * セッションの検証
   * @param {Object} session - セッションオブジェクト
   * @returns {boolean} 検証結果
   */
  validateSession(session) {
    // 基本的な構造チェック
    if (!session || !session.session_handover) {
      console.error('セッションオブジェクトが不正です');
      return false;
    }

    const handover = session.session_handover;
    
    // 必須フィールドのチェック
    const requiredFields = ['project_id', 'session_id', 'session_timestamp', 'project_state_summary', 'next_session_focus'];
    for (const field of requiredFields) {
      if (!handover[field]) {
        console.error(`必須フィールド ${field} がありません`);
        return false;
      }
    }
    
    // project_state_summaryのチェック
    const stateSummary = handover.project_state_summary;
    if (!stateSummary.completed_tasks || !stateSummary.current_tasks || !stateSummary.pending_tasks) {
      console.error('project_state_summary の必須フィールドがありません');
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
        console.error(`不正なタスクID形式です: ${taskId}`);
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
      if (fs.existsSync(this.latestSessionPath)) {
        const sessionData = fs.readFileSync(this.latestSessionPath, 'utf8');
        return JSON.parse(sessionData);
      }
    } catch (error) {
      console.error('最新のセッションの読み込みに失敗しました:', error);
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
      const sessionPath = path.join(this.sessionHistoryDir, `session-${sessionId}.json`);
      if (fs.existsSync(sessionPath)) {
        const sessionData = fs.readFileSync(sessionPath, 'utf8');
        return JSON.parse(sessionData);
      }
    } catch (error) {
      console.error(`セッションID ${sessionId} の取得に失敗しました:`, error);
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
      console.error('新しいセッションの作成に失敗しました:', error);
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
        console.error('不正なセッションは保存できません');
        return false;
      }
      
      const sessionId = session.session_handover.session_id;
      
      // セッション履歴に保存
      const historyPath = path.join(this.sessionHistoryDir, `session-${sessionId}.json`);
      fs.writeFileSync(historyPath, JSON.stringify(session, null, 2), 'utf8');
      
      // 最新のセッションとして保存
      if (isLatest) {
        fs.writeFileSync(this.latestSessionPath, JSON.stringify(session, null, 2), 'utf8');
      }
      
      return true;
    } catch (error) {
      console.error('セッションの保存に失敗しました:', error);
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
      console.error('Gitコミットからのセッション生成に失敗しました:', error);
      return null;
    }
  }

  /**
   * セッションをGit変更で更新
   * @param {string} sessionId - セッションID
   * @param {Array} commits - コミット情報の配列
   * @returns {Object} 更新されたセッション
   */
  updateSessionWithGitChanges(sessionId, commits) {
    try {
      const session = this.getSessionById(sessionId);
      
      if (!session) {
        console.error(`セッションID ${sessionId} が見つかりません`);
        return null;
      }
      
      // コミット情報を更新
      session.session_handover.git_changes.commits = commits;
      
      // 変更サマリーを計算
      const summary = this.calculateChangeSummary(commits);
      session.session_handover.git_changes.summary = summary;
      
      // key_artifactの候補を更新
      const keyArtifacts = this.getKeyArtifactCandidates(commits);
      session.session_handover.key_artifacts = keyArtifacts;
      
      return session;
    } catch (error) {
      console.error('セッションのGit変更更新に失敗しました:', error);
      return null;
    }
  }

  /**
   * key_artifactを追加
   * @param {string} sessionId - セッションID
   * @param {Object} artifact - key_artifact
   * @returns {Object} 更新されたセッション
   */
  addKeyArtifact(sessionId, artifact) {
    try {
      const session = this.getSessionById(sessionId);
      
      if (!session) {
        console.error(`セッションID ${sessionId} が見つかりません`);
        return null;
      }
      
      // 必須フィールドのチェック
      if (!artifact.path || !artifact.description) {
        console.error('key_artifactには path と description が必要です');
        return null;
      }
      
      // 既存のkey_artifactを検索
      const existingIndex = session.session_handover.key_artifacts.findIndex(a => a.path === artifact.path);
      
      if (existingIndex >= 0) {
        // 既存のkey_artifactを更新
        session.session_handover.key_artifacts[existingIndex] = {
          ...session.session_handover.key_artifacts[existingIndex],
          ...artifact
        };
      } else {
        // 新しいkey_artifactを追加
        session.session_handover.key_artifacts.push(artifact);
      }
      
      return session;
    } catch (error) {
      console.error('key_artifactの追加に失敗しました:', error);
      return null;
    }
  }

  /**
   * 課題を追加
   * @param {string} sessionId - セッションID
   * @param {Object} challenge - 課題
   * @returns {Object} 更新されたセッション
   */
  addChallenge(sessionId, challenge) {
    try {
      const session = this.getSessionById(sessionId);
      
      if (!session) {
        console.error(`セッションID ${sessionId} が見つかりません`);
        return null;
      }
      
      // 必須フィールドのチェック
      if (!challenge.description) {
        console.error('challengeには description が必要です');
        return null;
      }
      
      // 既存の課題を検索
      const existingIndex = session.session_handover.current_challenges.findIndex(
        c => c.description === challenge.description
      );
      
      if (existingIndex >= 0) {
        // 既存の課題を更新
        session.session_handover.current_challenges[existingIndex] = {
          ...session.session_handover.current_challenges[existingIndex],
          ...challenge
        };
      } else {
        // 新しい課題を追加
        session.session_handover.current_challenges.push(challenge);
      }
      
      return session;
    } catch (error) {
      console.error('課題の追加に失敗しました:', error);
      return null;
    }
  }

  /**
   * アクションアイテムを追加
   * @param {string} sessionId - セッションID
   * @param {Object} actionItem - アクションアイテム
   * @returns {Object} 更新されたセッション
   */
  addActionItem(sessionId, actionItem) {
    try {
      const session = this.getSessionById(sessionId);
      
      if (!session) {
        console.error(`セッションID ${sessionId} が見つかりません`);
        return null;
      }
      
      // 必須フィールドのチェック
      if (!actionItem.description) {
        console.error('actionItemには description が必要です');
        return null;
      }
      
      // 既存のアクションアイテムを検索
      const existingIndex = session.session_handover.action_items.findIndex(
        a => a.description === actionItem.description
      );
      
      if (existingIndex >= 0) {
        // 既存のアクションアイテムを更新
        session.session_handover.action_items[existingIndex] = {
          ...session.session_handover.action_items[existingIndex],
          ...actionItem
        };
      } else {
        // 新しいアクションアイテムを追加
        session.session_handover.action_items.push(actionItem);
      }
      
      return session;
    } catch (error) {
      console.error('アクションアイテムの追加に失敗しました:', error);
      return null;
    }
  }

  /**
   * セッション間の差分を取得
   * @param {string} sessionId1 - セッションID1
   * @param {string} sessionId2 - セッションID2
   * @returns {Object} 差分情報
   */
  getSessionDiff(sessionId1, sessionId2) {
    try {
      const session1 = this.getSessionById(sessionId1);
      const session2 = this.getSessionById(sessionId2);
      
      if (!session1 || !session2) {
        console.error('セッションが見つかりません');
        return null;
      }
      
      const handover1 = session1.session_handover;
      const handover2 = session2.session_handover;
      
      // タスク状態の差分
      const taskDiff = {
        completed: {
          added: handover2.project_state_summary.completed_tasks.filter(
            t => !handover1.project_state_summary.completed_tasks.includes(t)
          ),
          removed: handover1.project_state_summary.completed_tasks.filter(
            t => !handover2.project_state_summary.completed_tasks.includes(t)
          )
        },
        current: {
          added: handover2.project_state_summary.current_tasks.filter(
            t => !handover1.project_state_summary.current_tasks.includes(t)
          ),
          removed: handover1.project_state_summary.current_tasks.filter(
            t => !handover2.project_state_summary.current_tasks.includes(t)
          )
        },
        pending: {
          added: handover2.project_state_summary.pending_tasks.filter(
            t => !handover1.project_state_summary.pending_tasks.includes(t)
          ),
          removed: handover1.project_state_summary.pending_tasks.filter(
            t => !handover2.project_state_summary.pending_tasks.includes(t)
          )
        },
        blocked: {
          added: (handover2.project_state_summary.blocked_tasks || []).filter(
            t => !(handover1.project_state_summary.blocked_tasks || []).includes(t)
          ),
          removed: (handover1.project_state_summary.blocked_tasks || []).filter(
            t => !(handover2.project_state_summary.blocked_tasks || []).includes(t)
          )
        }
      };
      
      // key_artifactの差分
      const artifactDiff = {
        added: handover2.key_artifacts.filter(
          a2 => !handover1.key_artifacts.some(a1 => a1.path === a2.path)
        ),
        modified: handover2.key_artifacts.filter(
          a2 => handover1.key_artifacts.some(
            a1 => a1.path === a2.path && a1.last_modified !== a2.last_modified
          )
        ),
        removed: handover1.key_artifacts.filter(
          a1 => !handover2.key_artifacts.some(a2 => a2.path === a1.path)
        )
      };
      
      // 課題の差分
      const challengeDiff = {
        added: handover2.current_challenges.filter(
          c2 => !handover1.current_challenges.some(c1 => c1.description === c2.description)
        ),
        resolved: handover1.current_challenges.filter(
          c1 => !handover2.current_challenges.some(c2 => c2.description === c1.description)
        ),
        updated: handover2.current_challenges.filter(
          c2 => handover1.current_challenges.some(
            c1 => c1.description === c2.description && 
                  (c1.status !== c2.status || c1.priority !== c2.priority || c1.severity !== c2.severity)
          )
        )
      };
      
      // アクションアイテムの差分
      const actionItemDiff = {
        added: handover2.action_items.filter(
          a2 => !handover1.action_items.some(a1 => a1.description === a2.description)
        ),
        completed: handover1.action_items.filter(
          a1 => !handover2.action_items.some(a2 => a2.description === a1.description)
        ),
        updated: handover2.action_items.filter(
          a2 => handover1.action_items.some(
            a1 => a1.description === a2.description && 
                  (a1.priority !== a2.priority || a1.severity !== a2.severity || a1.due_date !== a2.due_date)
          )
        )
      };
      
      return {
        taskDiff,
        artifactDiff,
        challengeDiff,
        actionItemDiff,
        focusChanged: handover1.next_session_focus !== handover2.next_session_focus
      };
    } catch (error) {
      console.error('セッション差分の取得に失敗しました:', error);
      return null;
    }
  }

  /**
   * マークダウン形式の引継ぎドキュメントを生成
   * @param {string} sessionId - セッションID
   * @param {string} templateName - テンプレート名
   * @returns {string} マークダウン形式の引継ぎドキュメント
   */
  generateSessionHandoverMarkdown(sessionId, templateName = 'session-handover-template.md') {
    try {
      const session = this.getSessionById(sessionId);
      
      if (!session) {
        console.error(`セッションID ${sessionId} が見つかりません`);
        return null;
      }
      
      // テンプレートを読み込む
      const templatePath = path.join(this.templateDir, templateName);
      let template = fs.readFileSync(templatePath, 'utf8');
      
      const handover = session.session_handover;
      
      // セッション情報
      template = template.replace(/{{project_id}}/g, handover.project_id);
      template = template.replace(/{{session_timestamp}}/g, this._formatDateTime(handover.session_timestamp));
      template = template.replace(/{{session_id}}/g, handover.session_id);
      template = template.replace(/{{previous_session_id}}/g, handover.previous_session_id || 'なし');
      
      // セッション時間の計算
      const sessionDuration = this._calculateSessionDuration(
        handover.session_start_timestamp,
        handover.session_timestamp
      );
      template = template.replace(/{{session_duration}}/g, sessionDuration);
      
      // プロジェクト状態サマリー
      template = template.replace(
        /{{completed_tasks_formatted}}/g,
        this._formatTaskList(handover.project_state_summary.completed_tasks)
      );
      template = template.replace(
        /{{current_tasks_formatted}}/g,
        this._formatTaskList(handover.project_state_summary.current_tasks)
      );
      template = template.replace(
        /{{pending_tasks_formatted}}/g,
        this._formatTaskList(handover.project_state_summary.pending_tasks)
      );
      template = template.replace(
        /{{blocked_tasks_formatted}}/g,
        this._formatTaskList(handover.project_state_summary.blocked_tasks || [])
      );
      
      // 実装サマリー
      const implementationSummary = this._generateImplementationSummary(handover);
      template = template.replace(/{{implementation_summary}}/g, implementationSummary);
      
      // 主な変更点
      const keyChanges = this._generateKeyChanges(handover);
      template = template.replace(/{{key_changes}}/g, keyChanges);
      
      // 重要なファイル
      template = template.replace(
        /{{key_artifacts_formatted}}/g,
        this._formatKeyArtifacts(handover.key_artifacts)
      );
      
      // Git変更サマリー
      template = template.replace(/{{commit_count}}/g, handover.git_changes.commits.length.toString());
      template = template.replace(/{{files_added}}/g, handover.git_changes.summary.files_added.toString());
      template = template.replace(/{{files_modified}}/g, handover.git_changes.summary.files_modified.toString());
      template = template.replace(/{{files_deleted}}/g, handover.git_changes.summary.files_deleted.toString());
      template = template.replace(/{{lines_added}}/g, handover.git_changes.summary.lines_added.toString());
      template = template.replace(/{{lines_deleted}}/g, handover.git_changes.summary.lines_deleted.toString());
      
      // コミット履歴
      template = template.replace(
        /{{commits_formatted}}/g,
        this._formatCommits(handover.git_changes.commits)
      );
      
      // その他の変更
      template = template.replace(
        /{{other_changes_formatted}}/g,
        this._formatOtherChanges(handover.other_changes)
      );
      
      // 解決済みの課題
      const resolvedChallenges = this._generateResolvedChallenges(handover);
      template = template.replace(/{{resolved_challenges}}/g, resolvedChallenges);
      
      // 現在の課題
      template = template.replace(
        /{{current_challenges_formatted}}/g,
        this._formatChallenges(handover.current_challenges)
      );
      
      // 次のセッションの焦点
      template = template.replace(/{{next_session_focus}}/g, handover.next_session_focus);
      
      // アクションアイテム
      template = template.replace(
        /{{action_items_formatted}}/g,
        this._formatActionItems(handover.action_items)
      );
      
      // 推奨事項
      const recommendations = this._generateRecommendations(handover);
      template = template.replace(/{{recommendations}}/g, recommendations);
      
      return template;
    } catch (error) {
      console.error('マークダウン生成に失敗しました:', error);
      return null;
    }
  }

  /**
   * key_artifactの候補を取得
   * @param {Array} commits - コミット情報の配列
   * @returns {Array} key_artifactの候補
   */
  getKeyArtifactCandidates(commits) {
    try {
      // 変更されたファイルの情報を収集
      const fileChanges = {};
      
      for (const commit of commits) {
        // コミットで変更されたファイルを取得
        const changedFiles = this._getChangedFilesInCommit(commit.hash);
        
        for (const file of changedFiles) {
          if (!fileChanges[file.path]) {
            fileChanges[file.path] = {
              path: file.path,
              git_status: file.status,
              previous_path: file.previous_path,
              last_modified: commit.timestamp,
              related_tasks: [...(commit.related_tasks || [])],
              commit_count: 1
            };
          } else {
            // 既存のファイル情報を更新
            fileChanges[file.path].commit_count += 1;
            fileChanges[file.path].last_modified = commit.timestamp;
            
            // 関連タスクを追加（重複を除去）
            if (commit.related_tasks) {
              for (const task of commit.related_tasks) {
                if (!fileChanges[file.path].related_tasks.includes(task)) {
                  fileChanges[file.path].related_tasks.push(task);
                }
              }
            }
          }
        }
      }
      
      // 重要度を評価
      const keyArtifacts = Object.values(fileChanges).map(file => {
        // 重要度の評価基準
        let importance = 'medium';
        
        // コミット回数が多いファイルは重要
        if (file.commit_count > 2) {
          importance = 'high';
        }
        
        // 特定のパターンに一致するファイルは重要
        const importantPatterns = [
          /\.schema\.json$/,
          /^src\/utils\/.+\.js$/,
          /^src\/templates\/.+\.md$/,
          /^ai-context\/.+\.json$/
        ];
        
        for (const pattern of importantPatterns) {
          if (pattern.test(file.path)) {
            importance = 'high';
            break;
          }
        }
        
        // ファイルの説明を生成
        let description = this._generateFileDescription(file.path);
        
        return {
          path: file.path,
          description,
          last_modified: file.last_modified,
          git_status: file.git_status,
          previous_path: file.previous_path,
          related_tasks: file.related_tasks,
          importance
        };
      });
      
      // 重要度でソート（high, medium, lowの順）
      keyArtifacts.sort((a, b) => {
        const importanceOrder = { high: 0, medium: 1, low: 2 };
        return importanceOrder[a.importance] - importanceOrder[b.importance];
      });
      
      return keyArtifacts;
    } catch (error) {
      console.error('key_artifact候補の取得に失敗しました:', error);
      return [];
    }
  }

  /**
   * 変更サマリーを計算
   * @param {Array} commits - コミット情報の配列
   * @returns {Object} 変更サマリー
   */
  calculateChangeSummary(commits) {
    try {
      let summary = {
        files_added: 0,
        files_modified: 0,
        files_deleted: 0,
        lines_added: 0,
        lines_deleted: 0
      };
      
      // 変更されたファイルを追跡（重複カウントを避けるため）
      const processedFiles = new Set();
      
      for (const commit of commits) {
        // コミットの差分情報を取得
        const diffStats = this._getCommitDiffStats(commit.hash);
        
        for (const file of diffStats.files) {
          // 既に処理済みのファイルはスキップ
          if (processedFiles.has(file.path)) {
            continue;
          }
          
          processedFiles.add(file.path);
          
          // ファイルの状態に応じてカウント
          if (file.status === 'added') {
            summary.files_added += 1;
          } else if (file.status === 'modified' || file.status === 'renamed') {
            summary.files_modified += 1;
          } else if (file.status === 'deleted') {
            summary.files_deleted += 1;
          }
        }
        
        // 行数の変更を加算
        summary.lines_added += diffStats.lines_added;
        summary.lines_deleted += diffStats.lines_deleted;
      }
      
      return summary;
    } catch (error) {
      console.error('変更サマリーの計算に失敗しました:', error);
      return {
        files_added: 0,
        files_modified: 0,
        files_deleted: 0,
        lines_added: 0,
        lines_deleted: 0
      };
    }
  }

  /**
   * コミットメッセージからタスクIDを抽出
   * @param {string} message - コミットメッセージ
   * @returns {Array} タスクIDの配列
   */
  extractTaskIdsFromCommitMessage(message) {
    try {
      const taskPattern = /#T[0-9]{3}/g;
      const matches = message.match(taskPattern) || [];
      
      // '#'を除去してタスクIDのみを返す
      return matches.map(match => match.substring(1));
    } catch (error) {
      console.error('タスクIDの抽出に失敗しました:', error);
      return [];
    }
  }

  /**
   * アクションアイテムとタスクを関連付け
   * @param {string} sessionId - セッションID
   * @returns {Object} 更新されたセッション
   */
  linkActionItemsToTasks(sessionId) {
    try {
      const session = this.getSessionById(sessionId);
      
      if (!session) {
        console.error(`セッションID ${sessionId} が見つかりません`);
        return null;
      }
      
      const handover = session.session_handover;
      
      // 現在のタスクを取得
      const allTasks = [
        ...handover.project_state_summary.completed_tasks,
        ...handover.project_state_summary.current_tasks,
        ...handover.project_state_summary.pending_tasks,
        ...(handover.project_state_summary.blocked_tasks || [])
      ];
      
      // アクションアイテムを更新
      for (let i = 0; i < handover.action_items.length; i++) {
        const actionItem = handover.action_items[i];
        
        // 関連タスクが設定されていない場合は、説明からタスクIDを抽出
        if (!actionItem.related_task) {
          const taskPattern = /T[0-9]{3}/g;
          const matches = actionItem.description.match(taskPattern) || [];
          
          if (matches.length > 0) {
            // 最初に見つかったタスクIDを使用
            const taskId = matches[0];
            
            // タスクが存在するか確認
            if (allTasks.includes(taskId)) {
              handover.action_items[i].related_task = taskId;
            }
          }
        }
      }
      
      return session;
    } catch (error) {
      console.error('アクションアイテムとタスクの関連付けに失敗しました:', error);
      return null;
    }
  }

  /**
   * 現在のGitコミットハッシュを取得
   * @returns {string} コミットハッシュ
   * @private
   */
  _getCurrentGitCommitHash() {
    try {
      return execSync('git rev-parse HEAD').toString().trim();
    } catch (error) {
      console.error('Gitコミットハッシュの取得に失敗しました:', error);
      return `unknown-${Date.now()}`;
    }
  }

  /**
   * 2つのコミット間のコミット情報を取得
   * @param {string} startCommit - 開始コミットハッシュ
   * @param {string} endCommit - 終了コミットハッシュ
   * @returns {Array} コミット情報の配列
   * @private
   */
  _getCommitsBetween(startCommit, endCommit) {
    try {
      const command = `git log ${startCommit}..${endCommit} --pretty=format:"%H|%s|%ai|%an"`;
      const output = execSync(command).toString().trim();
      
      if (!output) {
        return [];
      }
      
      return output.split('\n').map(line => {
        const [hash, message, timestamp, author] = line.split('|');
        const related_tasks = this.extractTaskIdsFromCommitMessage(message);
        
        return {
          hash,
          message,
          timestamp: new Date(timestamp).toISOString(),
          related_tasks,
          author
        };
      });
    } catch (error) {
      console.error('コミット情報の取得に失敗しました:', error);
      return [];
    }
  }

  /**
   * コミットで変更されたファイルを取得
   * @param {string} commitHash - コミットハッシュ
   * @returns {Array} 変更されたファイルの配列
   * @private
   */
  _getChangedFilesInCommit(commitHash) {
    try {
      const command = `git show --name-status --format="" ${commitHash}`;
      const output = execSync(command).toString().trim();
      
      if (!output) {
        return [];
      }
      
      return output.split('\n').map(line => {
        const [status, path, newPath] = line.split('\t');
        
        let fileStatus = 'modified';
        if (status === 'A') fileStatus = 'added';
        else if (status === 'D') fileStatus = 'deleted';
        else if (status === 'R') fileStatus = 'renamed';
        
        return {
          path: newPath || path,
          status: fileStatus,
          previous_path: status === 'R' ? path : undefined
        };
      });
    } catch (error) {
      console.error('変更ファイルの取得に失敗しました:', error);
      return [];
    }
  }

  /**
   * コミットの差分統計を取得
   * @param {string} commitHash - コミットハッシュ
   * @returns {Object} 差分統計
   * @private
   */
  _getCommitDiffStats(commitHash) {
    try {
      // 変更されたファイルを取得
      const files = this._getChangedFilesInCommit(commitHash);
      
      // 行数の変更を取得
      const command = `git show --numstat --format="" ${commitHash}`;
      const output = execSync(command).toString().trim();
      
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
      
      return {
        files,
        lines_added,
        lines_deleted
      };
    } catch (error) {
      console.error('差分統計の取得に失敗しました:', error);
      return {
        files: [],
        lines_added: 0,
        lines_deleted: 0
      };
    }
  }

  /**
   * ファイルの説明を生成
   * @param {string} filePath - ファイルパス
   * @returns {string} ファイルの説明
   * @private
   */
  _generateFileDescription(filePath) {
    // ファイル名を取得
    const fileName = path.basename(filePath);
    
    // ファイルの種類に基づいて説明を生成
    if (filePath.endsWith('.schema.json')) {
      return `${fileName.replace('.schema.json', '')}のスキーマ定義`;
    } else if (filePath.endsWith('.json')) {
      return `${fileName.replace('.json', '')}の設定ファイル`;
    } else if (filePath.endsWith('.js')) {
      if (filePath.includes('/utils/')) {
        return `${fileName.replace('.js', '')}ユーティリティ`;
      } else if (filePath.includes('/templates/')) {
        return `${fileName.replace('.js', '')}テンプレート`;
      } else {
        return `${fileName.replace('.js', '')}モジュール`;
      }
    } else if (filePath.endsWith('.md')) {
      return `${fileName.replace('.md', '')}ドキュメント`;
    } else if (filePath.endsWith('.test.js')) {
      return `${fileName.replace('.test.js', '')}のテスト`;
    } else {
      return fileName;
    }
  }

  /**
   * タスクリストをフォーマット
   * @param {Array} tasks - タスクIDの配列
   * @returns {string} フォーマットされたタスクリスト
   * @private
   */
  _formatTaskList(tasks) {
    if (!tasks || tasks.length === 0) {
      return 'なし';
    }
    
    return tasks.map(task => `\`${task}\``).join(', ');
  }

  /**
   * key_artifactをフォーマット
   * @param {Array} artifacts - key_artifactの配列
   * @returns {string} フォーマットされたkey_artifact
   * @private
   */
  _formatKeyArtifacts(artifacts) {
    if (!artifacts || artifacts.length === 0) {
      return 'なし';
    }
    
    return artifacts.map(artifact => {
      let status = '';
      switch (artifact.git_status) {
        case 'added':
          status = '📝 新規';
          break;
        case 'modified':
          status = '✏️ 変更';
          break;
        case 'deleted':
          status = '🗑️ 削除';
          break;
        case 'renamed':
          status = '🔄 リネーム';
          break;
        default:
          status = '📄';
      }
      
      let importance = '';
      switch (artifact.importance) {
        case 'high':
          importance = '🔴';
          break;
        case 'medium':
          importance = '🟡';
          break;
        case 'low':
          importance = '🟢';
          break;
      }
      
      let result = `- ${status} ${importance} **\`${artifact.path}\`**: ${artifact.description}`;
      
      if (artifact.git_status === 'renamed' && artifact.previous_path) {
        result += ` (旧: \`${artifact.previous_path}\`)`;
      }
      
      if (artifact.related_tasks && artifact.related_tasks.length > 0) {
        result += ` (関連タスク: ${artifact.related_tasks.map(t => `\`${t}\``).join(', ')})`;
      }
      
      return result;
    }).join('\n');
  }

  /**
   * コミットをフォーマット
   * @param {Array} commits - コミットの配列
   * @returns {string} フォーマットされたコミット
   * @private
   */
  _formatCommits(commits) {
    if (!commits || commits.length === 0) {
      return 'なし';
    }
    
    return commits.map(commit => {
      let result = `- **${commit.hash.substring(0, 7)}**: ${commit.message}`;
      
      if (commit.related_tasks && commit.related_tasks.length > 0) {
        result += ` (関連タスク: ${commit.related_tasks.map(t => `\`${t}\``).join(', ')})`;
      }
      
      result += ` - ${this._formatDateTime(commit.timestamp)} by ${commit.author}`;
      
      return result;
    }).join('\n');
  }

  /**
   * その他の変更をフォーマット
   * @param {Object} otherChanges - その他の変更
   * @returns {string} フォーマットされたその他の変更
   * @private
   */
  _formatOtherChanges(otherChanges) {
    if (!otherChanges) {
      return 'なし';
    }
    
    let result = '';
    
    // 設定変更
    if (otherChanges.config_changes && otherChanges.config_changes.length > 0) {
      result += '### 設定変更\n\n';
      result += otherChanges.config_changes.map(change => {
        return `- **${change.config_type}**: ${change.description} (${this._formatDateTime(change.timestamp)})`;
      }).join('\n');
      result += '\n\n';
    }
    
    // 外部システムの変更
    if (otherChanges.external_changes && otherChanges.external_changes.length > 0) {
      result += '### 外部システムの変更\n\n';
      result += otherChanges.external_changes.map(change => {
        return `- **${change.system}** (${change.change_type}): ${change.description} (${this._formatDateTime(change.timestamp)})`;
      }).join('\n');
      result += '\n\n';
    }
    
    return result || 'なし';
  }

  /**
   * 課題をフォーマット
   * @param {Array} challenges - 課題の配列
   * @returns {string} フォーマットされた課題
   * @private
   */
  _formatChallenges(challenges) {
    if (!challenges || challenges.length === 0) {
      return 'なし';
    }
    
    return challenges.map(challenge => {
      let priority = '⭐'.repeat(challenge.priority || 3);
      let severity = '🔥'.repeat(challenge.severity || 3);
      
      let status = '';
      switch (challenge.status) {
        case 'identified':
          status = '🔍 特定済み';
          break;
        case 'analyzing':
          status = '🔬 分析中';
          break;
        case 'in_progress':
          status = '🚧 対応中';
          break;
        case 'resolved':
          status = '✅ 解決済み';
          break;
        case 'wontfix':
          status = '⏩ 対応しない';
          break;
        default:
          status = '🔍 特定済み';
      }
      
      let result = `- ${status} **${challenge.description}**`;
      
      if (challenge.related_tasks && challenge.related_tasks.length > 0) {
        result += ` (関連タスク: ${challenge.related_tasks.map(t => `\`${t}\``).join(', ')})`;
      }
      
      result += `\n  - 優先度: ${priority} | 重要度: ${severity}`;
      
      if (challenge.resolution_plan) {
        result += `\n  - 解決計画: ${challenge.resolution_plan}`;
      }
      
      return result;
    }).join('\n\n');
  }

  /**
   * アクションアイテムをフォーマット
   * @param {Array} actionItems - アクションアイテムの配列
   * @returns {string} フォーマットされたアクションアイテム
   * @private
   */
  _formatActionItems(actionItems) {
    if (!actionItems || actionItems.length === 0) {
      return 'なし';
    }
    
    return actionItems.map(item => {
      let priority = '⭐'.repeat(item.priority || 3);
      let severity = '🔥'.repeat(item.severity || 3);
      
      let result = `- **${item.description}**`;
      
      if (item.related_task) {
        result += ` (関連タスク: \`${item.related_task}\`)`;
      }
      
      result += `\n  - 優先度: ${priority} | 重要度: ${severity}`;
      
      if (item.due_date) {
        result += ` | 期限: ${item.due_date}`;
      }
      
      if (item.assignee) {
        result += ` | 担当: ${item.assignee}`;
      }
      
      return result;
    }).join('\n\n');
  }

  /**
   * 実装サマリーを生成
   * @param {Object} handover - セッション引継ぎ情報
   * @returns {string} 実装サマリー
   * @private
   */
  _generateImplementationSummary(handover) {
    // コミット情報から実装内容を要約
    if (!handover.git_changes || !handover.git_changes.commits || handover.git_changes.commits.length === 0) {
      return '実装内容はありません。';
    }
    
    // コミットメッセージから実装内容を抽出
    const commitMessages = handover.git_changes.commits.map(commit => commit.message);
    
    // 重複を除去
    const uniqueMessages = [...new Set(commitMessages)];
    
    // タスクIDを除去してメッセージを整形
    const cleanMessages = uniqueMessages.map(message => {
      return message.replace(/#T[0-9]{3}/g, '').trim();
    });
    
    return cleanMessages.map(message => `- ${message}`).join('\n');
  }

  /**
   * 主な変更点を生成
   * @param {Object} handover - セッション引継ぎ情報
   * @returns {string} 主な変更点
   * @private
   */
  _generateKeyChanges(handover) {
    // 変更サマリーから主な変更点を抽出
    const summary = handover.git_changes.summary;
    
    if (summary.files_added === 0 && summary.files_modified === 0 && summary.files_deleted === 0) {
      return '主な変更点はありません。';
    }
    
    const changes = [];
    
    if (summary.files_added > 0) {
      changes.push(`- ${summary.files_added}個のファイルを追加`);
    }
    
    if (summary.files_modified > 0) {
      changes.push(`- ${summary.files_modified}個のファイルを変更`);
    }
    
    if (summary.files_deleted > 0) {
      changes.push(`- ${summary.files_deleted}個のファイルを削除`);
    }
    
    if (summary.lines_added > 0 || summary.lines_deleted > 0) {
      changes.push(`- ${summary.lines_added}行追加、${summary.lines_deleted}行削除`);
    }
    
    return changes.join('\n');
  }

  /**
   * 解決済みの課題を生成
   * @param {Object} handover - セッション引継ぎ情報
   * @returns {string} 解決済みの課題
   * @private
   */
  _generateResolvedChallenges(handover) {
    // 解決済みの課題を抽出
    const resolvedChallenges = handover.current_challenges.filter(
      challenge => challenge.status === 'resolved'
    );
    
    if (resolvedChallenges.length === 0) {
      return '解決済みの課題はありません。';
    }
    
    return resolvedChallenges.map(challenge => {
      let result = `- ✅ **${challenge.description}**`;
      
      if (challenge.related_tasks && challenge.related_tasks.length > 0) {
        result += ` (関連タスク: ${challenge.related_tasks.map(t => `\`${t}\``).join(', ')})`;
      }
      
      return result;
    }).join('\n');
  }

  /**
   * 推奨事項を生成
   * @param {Object} handover - セッション引継ぎ情報
   * @returns {string} 推奨事項
   * @private
   */
  _generateRecommendations(handover) {
    const recommendations = [];
    
    // 優先度の高い課題がある場合
    const highPriorityChallenges = handover.current_challenges.filter(
      challenge => (challenge.priority >= 4 || challenge.severity >= 4) && 
                  challenge.status !== 'resolved' && 
                  challenge.status !== 'wontfix'
    );
    
    if (highPriorityChallenges.length > 0) {
      recommendations.push('- 優先度または重要度の高い課題に注意してください。');
    }
    
    // 期限の近いアクションアイテムがある場合
    const today = new Date();
    const nearDueActionItems = handover.action_items.filter(item => {
      if (!item.due_date) return false;
      
      const dueDate = new Date(item.due_date);
      const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
      
      return diffDays <= 3;
    });
    
    if (nearDueActionItems.length > 0) {
      recommendations.push('- 期限の近いアクションアイテムがあります。優先的に対応してください。');
    }
    
    // 変更の多いファイルがある場合
    const highChangeFiles = handover.key_artifacts.filter(
      artifact => artifact.importance === 'high'
    );
    
    if (highChangeFiles.length > 0) {
      recommendations.push('- 重要度の高いファイルに変更が集中しています。慎重にレビューしてください。');
    }
    
    // 推奨事項がない場合
    if (recommendations.length === 0) {
      return '特に注意すべき点はありません。';
    }
    
    return recommendations.join('\n');
  }

  /**
   * 日時をフォーマット
   * @param {string} dateTimeString - ISO 8601形式の日時文字列
   * @returns {string} フォーマットされた日時
   * @private
   */
  _formatDateTime(dateTimeString) {
    try {
      const date = new Date(dateTimeString);
      return date.toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return dateTimeString;
    }
  }

  /**
   * セッション時間を計算
   * @param {string} startTime - 開始時刻
   * @param {string} endTime - 終了時刻
   * @returns {string} セッション時間
   * @private
   */
  _calculateSessionDuration(startTime, endTime) {
    try {
      const start = new Date(startTime);
      const end = new Date(endTime);
      
      const durationMs = end - start;
      const hours = Math.floor(durationMs / (1000 * 60 * 60));
      const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
      
      return `${hours}時間${minutes}分`;
    } catch (error) {
      return '不明';
    }
  }
}

module.exports = { SessionManager };
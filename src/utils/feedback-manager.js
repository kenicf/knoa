/**
 * フィードバック管理ユーティリティ
 * 
 * フィードバックの検証、テスト結果の自動収集、優先順位付け、状態管理、
 * Gitコミットとの関連付け、履歴管理などの機能を提供します。
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const Handlebars = require('handlebars');

// スキーマの読み込み
const feedbackSchema = require('../schemas/feedback.schema.json');

// フィードバックの状態遷移の定義
const FEEDBACK_STATE_TRANSITIONS = {
  open: ["in_progress", "resolved", "wontfix"],
  in_progress: ["resolved", "wontfix", "open"],
  resolved: ["open"],
  wontfix: ["open"]
};

// フィードバックの種類と優先度の重み付け
const FEEDBACK_TYPE_WEIGHTS = {
  security: 5,
  functional: 5,
  performance: 4,
  ux: 3,
  code_quality: 2
};

/**
 * フィードバック管理クラス
 */
class FeedbackManager {
  /**
   * コンストラクタ
   * @param {Object} options - オプション
   * @param {string} options.feedbackDir - フィードバックディレクトリのパス
   * @param {string} options.templateDir - テンプレートディレクトリのパス
   */
  constructor(options = {}) {
    this.feedbackDir = options.feedbackDir || path.join(process.cwd(), 'ai-context', 'feedback');
    this.templateDir = options.templateDir || path.join(process.cwd(), 'src', 'templates', 'docs');
    this.pendingFeedbackPath = path.join(this.feedbackDir, 'pending-feedback.json');
    this.feedbackHistoryDir = path.join(this.feedbackDir, 'feedback-history');
    
    // ディレクトリが存在しない場合は作成
    if (!fs.existsSync(this.feedbackDir)) {
      fs.mkdirSync(this.feedbackDir, { recursive: true });
    }
    if (!fs.existsSync(this.feedbackHistoryDir)) {
      fs.mkdirSync(this.feedbackHistoryDir, { recursive: true });
    }
    
    // Handlebarsヘルパーの登録
    this._registerHandlebarsHelpers();
  }

  /**
   * フィードバックの検証
   * @param {Object} feedback - フィードバックオブジェクト
   * @returns {Object} 検証結果 {isValid, errors, warnings}
   */
  validateFeedback(feedback) {
    const errors = [];
    const warnings = [];
    
    // 基本的な構造チェック
    if (!feedback || !feedback.feedback_loop) {
      errors.push('フィードバックオブジェクトが不正です');
      return { isValid: false, errors, warnings };
    }

    const loop = feedback.feedback_loop;
    
    // 必須フィールドのチェック
    const requiredFields = ['task_id', 'implementation_attempt', 'verification_results', 'iteration_plan'];
    for (const field of requiredFields) {
      if (!loop[field]) {
        errors.push(`必須フィールド ${field} がありません`);
      }
    }
    
    // タスクIDの形式チェック
    if (loop.task_id && !loop.task_id.match(/^T[0-9]{3}$/)) {
      errors.push(`不正なタスクID形式です: ${loop.task_id}`);
    }
    
    // implementation_attemptのチェック
    if (loop.implementation_attempt !== undefined) {
      if (!Number.isInteger(loop.implementation_attempt) || loop.implementation_attempt < 1) {
        errors.push('implementation_attemptは1以上の整数である必要があります');
      }
    }
    
    // verification_resultsのチェック
    if (loop.verification_results) {
      const vr = loop.verification_results;
      
      // passes_testsのチェック
      if (typeof vr.passes_tests !== 'boolean') {
        errors.push('passes_testsはブール値である必要があります');
      }
      
      // failed_testsのチェック
      if (!Array.isArray(vr.failed_tests)) {
        errors.push('failed_testsは配列である必要があります');
      } else {
        for (const test of vr.failed_tests) {
          if (!test.test_name || !test.error) {
            errors.push('failed_testsの各要素にはtest_nameとerrorが必要です');
          }
        }
      }
      
      // suggestionsのチェック
      if (!Array.isArray(vr.suggestions)) {
        errors.push('suggestionsは配列である必要があります');
      } else {
        for (const suggestion of vr.suggestions) {
          if (typeof suggestion === 'object') {
            if (!suggestion.content) {
              errors.push('suggestionsの各要素にはcontentが必要です');
            }
            
            if (suggestion.type && !['functional', 'performance', 'security', 'ux', 'code_quality'].includes(suggestion.type)) {
              errors.push('suggestionのtypeは functional, performance, security, ux, code_quality のいずれかである必要があります');
            }
            
            if (suggestion.priority !== undefined) {
              if (!Number.isInteger(suggestion.priority) || suggestion.priority < 1 || suggestion.priority > 5) {
                errors.push('suggestionのpriorityは1から5の整数である必要があります');
              }
            }
          } else {
            warnings.push('suggestionsの要素はオブジェクトであることが推奨されます');
          }
        }
      }
    }
    
    // iteration_planのチェック
    if (loop.iteration_plan) {
      const ip = loop.iteration_plan;
      
      // focus_areasのチェック
      if (!Array.isArray(ip.focus_areas)) {
        errors.push('focus_areasは配列である必要があります');
      }
      
      // approachのチェック
      if (!ip.approach) {
        errors.push('approachは必須です');
      }
      
      // specific_actionsのチェック
      if (ip.specific_actions && !Array.isArray(ip.specific_actions)) {
        errors.push('specific_actionsは配列である必要があります');
      } else if (Array.isArray(ip.specific_actions)) {
        for (const action of ip.specific_actions) {
          if (!action.description) {
            errors.push('specific_actionsの各要素にはdescriptionが必要です');
          }
          
          if (action.priority !== undefined) {
            if (!Number.isInteger(action.priority) || action.priority < 1 || action.priority > 5) {
              errors.push('actionのpriorityは1から5の整数である必要があります');
            }
          }
          
          if (action.related_task && !action.related_task.match(/^T[0-9]{3}$/)) {
            errors.push(`不正なrelated_task形式です: ${action.related_task}`);
          }
        }
      }
    }
    
    // feedback_statusのチェック
    if (loop.feedback_status && !['open', 'in_progress', 'resolved', 'wontfix'].includes(loop.feedback_status)) {
      errors.push('feedback_statusは open, in_progress, resolved, wontfix のいずれかである必要があります');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 保留中のフィードバックを取得
   * @returns {Object} 保留中のフィードバック
   */
  getPendingFeedback() {
    try {
      if (fs.existsSync(this.pendingFeedbackPath)) {
        const feedbackData = fs.readFileSync(this.pendingFeedbackPath, 'utf8');
        return JSON.parse(feedbackData);
      }
    } catch (error) {
      console.error('保留中のフィードバックの読み込みに失敗しました:', error);
    }
    return null;
  }

  /**
   * タスクIDでフィードバックを取得
   * @param {string} taskId - タスクID
   * @returns {Object} フィードバック
   */
  getFeedbackByTaskId(taskId) {
    try {
      // 保留中のフィードバックをチェック
      const pendingFeedback = this.getPendingFeedback();
      if (pendingFeedback && pendingFeedback.feedback_loop.task_id === taskId) {
        return pendingFeedback;
      }
      
      // 履歴からフィードバックを検索
      const historyPath = path.join(this.feedbackHistoryDir, `feedback-${taskId}.json`);
      if (fs.existsSync(historyPath)) {
        const feedbackData = fs.readFileSync(historyPath, 'utf8');
        return JSON.parse(feedbackData);
      }
    } catch (error) {
      console.error(`タスクID ${taskId} のフィードバックの取得に失敗しました:`, error);
    }
    return null;
  }

  /**
   * コミットハッシュでフィードバックを取得
   * @param {string} commitHash - コミットハッシュ
   * @returns {Object} フィードバック
   */
  getFeedbackByCommit(commitHash) {
    try {
      // 保留中のフィードバックをチェック
      const pendingFeedback = this.getPendingFeedback();
      if (pendingFeedback && pendingFeedback.feedback_loop.git_commit === commitHash) {
        return pendingFeedback;
      }
      
      // 履歴からフィードバックを検索
      const files = fs.readdirSync(this.feedbackHistoryDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.feedbackHistoryDir, file);
          const feedbackData = fs.readFileSync(filePath, 'utf8');
          const feedback = JSON.parse(feedbackData);
          
          if (feedback.feedback_loop.git_commit === commitHash) {
            return feedback;
          }
        }
      }
    } catch (error) {
      console.error(`コミットハッシュ ${commitHash} のフィードバックの取得に失敗しました:`, error);
    }
    return null;
  }

  /**
   * 状態でフィードバックをフィルタリング
   * @param {string} status - フィードバックの状態
   * @returns {Array} フィードバックの配列
   */
  getFeedbacksByStatus(status) {
    try {
      const result = [];
      
      // 保留中のフィードバックをチェック
      const pendingFeedback = this.getPendingFeedback();
      if (pendingFeedback && pendingFeedback.feedback_loop.feedback_status === status) {
        result.push(pendingFeedback);
      }
      
      // 履歴からフィードバックを検索
      const files = fs.readdirSync(this.feedbackHistoryDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.feedbackHistoryDir, file);
          const feedbackData = fs.readFileSync(filePath, 'utf8');
          const feedback = JSON.parse(feedbackData);
          
          if (feedback.feedback_loop.feedback_status === status) {
            result.push(feedback);
          }
        }
      }
      
      return result;
    } catch (error) {
      console.error(`状態 ${status} のフィードバックの取得に失敗しました:`, error);
      return [];
    }
  }

  /**
   * 新しいフィードバックを作成
   * @param {string} taskId - タスクID
   * @param {number} attempt - 実装の試行回数
   * @returns {Object} 新しいフィードバック
   */
  createNewFeedback(taskId, attempt = 1) {
    try {
      // 現在のGitコミットハッシュを取得
      const gitCommit = this._getCurrentGitCommitHash();
      const timestamp = new Date().toISOString();
      
      // 新しいフィードバックの基本構造
      const newFeedback = {
        feedback_loop: {
          task_id: taskId,
          implementation_attempt: attempt,
          git_commit: gitCommit,
          test_execution: {
            command: "",
            timestamp: timestamp,
            duration_ms: 0,
            test_types: ["unit"]
          },
          verification_results: {
            passes_tests: false,
            test_summary: {
              total: 0,
              passed: 0,
              failed: 0,
              skipped: 0
            },
            failed_tests: [],
            suggestions: []
          },
          iteration_plan: {
            focus_areas: [],
            approach: "",
            specific_actions: []
          },
          feedback_status: "open",
          related_sessions: [],
          created_at: timestamp,
          updated_at: timestamp
        }
      };
      
      return newFeedback;
    } catch (error) {
      console.error('新しいフィードバックの作成に失敗しました:', error);
      return null;
    }
  }

  /**
   * フィードバックを保存
   * @param {Object} feedback - フィードバック
   * @param {boolean} isPending - 保留中のフィードバックとして保存するかどうか
   * @returns {boolean} 保存結果
   */
  saveFeedback(feedback, isPending = true) {
    try {
      const validation = this.validateFeedback(feedback);
      if (!validation.isValid) {
        console.error('不正なフィードバックは保存できません:', validation.errors);
        return false;
      }
      
      const taskId = feedback.feedback_loop.task_id;
      
      // 更新日時を設定
      feedback.feedback_loop.updated_at = new Date().toISOString();
      
      // フィードバックの状態に応じて保存先を決定
      if (isPending) {
        fs.writeFileSync(this.pendingFeedbackPath, JSON.stringify(feedback, null, 2), 'utf8');
      } else {
        const historyPath = path.join(this.feedbackHistoryDir, `feedback-${taskId}.json`);
        fs.writeFileSync(historyPath, JSON.stringify(feedback, null, 2), 'utf8');
      }
      
      return true;
    } catch (error) {
      console.error('フィードバックの保存に失敗しました:', error);
      return false;
    }
  }

  /**
   * テスト結果を自動収集
   * @param {string} taskId - タスクID
   * @param {string} testCommand - テストコマンド
   * @param {Array} testTypes - テストの種類
   * @returns {Object} 更新されたフィードバック
   */
  async collectTestResults(taskId, testCommand, testTypes = ["unit"]) {
    try {
      // 既存のフィードバックを取得または新規作成
      let feedback = this.getFeedbackByTaskId(taskId);
      if (!feedback) {
        feedback = this.createNewFeedback(taskId);
      }
      
      const loop = feedback.feedback_loop;
      const startTime = Date.now();
      
      // テストコマンドを実行
      let testOutput;
      let passes = false;
      
      try {
        testOutput = execSync(testCommand, { encoding: 'utf8' });
        passes = true;
      } catch (e) {
        testOutput = e.stdout || e.message;
        passes = false;
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // テスト実行情報を更新
      loop.test_execution = {
        command: testCommand,
        timestamp: new Date().toISOString(),
        duration_ms: duration,
        test_types: testTypes
      };
      
      // テスト結果を解析
      const testResults = this._parseTestResults(testOutput, testCommand);
      
      // verification_resultsを更新
      loop.verification_results.passes_tests = passes;
      loop.verification_results.test_summary = testResults.summary;
      loop.verification_results.failed_tests = testResults.failedTests;
      
      // 既存の提案を保持
      if (!Array.isArray(loop.verification_results.suggestions)) {
        loop.verification_results.suggestions = [];
      }
      
      // フィードバックを保存
      this.saveFeedback(feedback);
      
      return feedback;
    } catch (error) {
      console.error('テスト結果の自動収集に失敗しました:', error);
      return null;
    }
  }

  /**
   * フィードバックの優先順位付け
   * @param {Object} feedback - フィードバック
   * @returns {Object} 優先順位付けされたフィードバック
   */
  prioritizeFeedback(feedback) {
    try {
      const validation = this.validateFeedback(feedback);
      if (!validation.isValid) {
        console.error('不正なフィードバックは優先順位付けできません:', validation.errors);
        return feedback;
      }
      
      const loop = feedback.feedback_loop;
      const suggestions = loop.verification_results.suggestions;
      
      // 提案の優先順位付け
      for (let i = 0; i < suggestions.length; i++) {
        const suggestion = suggestions[i];
        
        // 文字列の場合はオブジェクトに変換
        if (typeof suggestion === 'string') {
          suggestions[i] = {
            content: suggestion,
            type: 'functional',
            priority: FEEDBACK_TYPE_WEIGHTS.functional
          };
          continue;
        }
        
        // 種類が指定されていない場合はfunctionalとみなす
        if (!suggestion.type) {
          suggestion.type = "functional";
        }
        
        // 優先度が指定されていない場合は種類に基づいて設定
        if (!suggestion.priority) {
          suggestion.priority = FEEDBACK_TYPE_WEIGHTS[suggestion.type] || 3;
        }
      }
      
      // 優先度でソート（高い順）
      suggestions.sort((a, b) => b.priority - a.priority);
      
      // iteration_planのspecific_actionsも優先順位付け
      if (Array.isArray(loop.iteration_plan.specific_actions)) {
        loop.iteration_plan.specific_actions.sort((a, b) => b.priority - a.priority);
      }
      
      // フィードバックを保存
      this.saveFeedback(feedback);
      
      return feedback;
    } catch (error) {
      console.error('フィードバックの優先順位付けに失敗しました:', error);
      return feedback;
    }
  }

  /**
   * フィードバックの状態を更新
   * @param {Object} feedback - フィードバック
   * @param {string} newStatus - 新しい状態
   * @returns {Object} 更新されたフィードバック
   */
  updateFeedbackStatus(feedback, newStatus) {
    try {
      const validation = this.validateFeedback(feedback);
      if (!validation.isValid) {
        console.error('不正なフィードバックは状態を更新できません:', validation.errors);
        return feedback;
      }
      
      const loop = feedback.feedback_loop;
      const currentStatus = loop.feedback_status || "open";
      
      // 状態遷移の検証
      if (!FEEDBACK_STATE_TRANSITIONS[currentStatus].includes(newStatus)) {
        console.error(`${currentStatus}から${newStatus}への状態遷移は許可されていません`);
        return feedback;
      }
      
      // 状態を更新
      loop.feedback_status = newStatus;
      loop.updated_at = new Date().toISOString();
      
      // resolvedまたはwontfixの場合は履歴に移動
      if (newStatus === "resolved" || newStatus === "wontfix") {
        this.saveFeedback(feedback, false);
        
        // 保留中のフィードバックが同じタスクIDの場合は削除
        const pendingFeedback = this.getPendingFeedback();
        if (pendingFeedback && pendingFeedback.feedback_loop.task_id === loop.task_id) {
          fs.unlinkSync(this.pendingFeedbackPath);
        }
      } else {
        this.saveFeedback(feedback);
      }
      
      return feedback;
    } catch (error) {
      console.error('フィードバックの状態更新に失敗しました:', error);
      return feedback;
    }
  }

  /**
   * フィードバックにGitコミットを関連付ける
   * @param {Object} feedback - フィードバック
   * @param {string} commitHash - コミットハッシュ
   * @returns {Object} 更新されたフィードバック
   */
  linkFeedbackToGitCommit(feedback, commitHash) {
    try {
      const validation = this.validateFeedback(feedback);
      if (!validation.isValid) {
        console.error('不正なフィードバックはGitコミットと関連付けできません:', validation.errors);
        return feedback;
      }
      
      // コミットハッシュを設定
      feedback.feedback_loop.git_commit = commitHash;
      feedback.feedback_loop.updated_at = new Date().toISOString();
      
      // フィードバックを保存
      this.saveFeedback(feedback);
      
      return feedback;
    } catch (error) {
      console.error('フィードバックとGitコミットの関連付けに失敗しました:', error);
      return feedback;
    }
  }

  /**
   * フィードバックにセッションを関連付ける
   * @param {Object} feedback - フィードバック
   * @param {string} sessionId - セッションID
   * @returns {Object} 更新されたフィードバック
   */
  linkFeedbackToSession(feedback, sessionId) {
    try {
      const validation = this.validateFeedback(feedback);
      if (!validation.isValid) {
        console.error('不正なフィードバックはセッションと関連付けできません:', validation.errors);
        return feedback;
      }
      
      // 関連するセッションが未定義の場合は初期化
      if (!Array.isArray(feedback.feedback_loop.related_sessions)) {
        feedback.feedback_loop.related_sessions = [];
      }
      
      // 既に関連付けられている場合は何もしない
      if (feedback.feedback_loop.related_sessions.includes(sessionId)) {
        return feedback;
      }
      
      // セッションIDを追加
      feedback.feedback_loop.related_sessions.push(sessionId);
      feedback.feedback_loop.updated_at = new Date().toISOString();
      
      // フィードバックを保存
      this.saveFeedback(feedback);
      
      return feedback;
    } catch (error) {
      console.error('フィードバックとセッションの関連付けに失敗しました:', error);
      return feedback;
    }
  }

  /**
   * フィードバックを履歴に移動
   * @param {string} taskId - タスクID
   * @returns {boolean} 移動結果
   */
  moveFeedbackToHistory(taskId) {
    try {
      // 保留中のフィードバックを取得
      const pendingFeedback = this.getPendingFeedback();
      if (!pendingFeedback || pendingFeedback.feedback_loop.task_id !== taskId) {
        console.error(`タスクID ${taskId} の保留中のフィードバックが見つかりません`);
        return false;
      }
      
      // 履歴に保存
      const historyPath = path.join(this.feedbackHistoryDir, `feedback-${taskId}.json`);
      fs.writeFileSync(historyPath, JSON.stringify(pendingFeedback, null, 2), 'utf8');
      
      // 保留中のフィードバックを削除
      fs.unlinkSync(this.pendingFeedbackPath);
      
      return true;
    } catch (error) {
      console.error('フィードバックの履歴への移動に失敗しました:', error);
      return false;
    }
  }

  /**
   * 履歴からフィードバックを検索
   * @param {string} query - 検索クエリ
   * @returns {Array} 検索結果
   */
  searchFeedbackHistory(query) {
    try {
      const results = [];
      
      // 履歴ディレクトリ内のファイルを取得
      const files = fs.readdirSync(this.feedbackHistoryDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.feedbackHistoryDir, file);
          const content = fs.readFileSync(filePath, 'utf8');
          
          // クエリに一致するか確認
          if (content.includes(query)) {
            const feedback = JSON.parse(content);
            results.push(feedback);
          }
        }
      }
      
      return results;
    } catch (error) {
      console.error('フィードバック履歴の検索に失敗しました:', error);
      return [];
    }
  }

  /**
   * フィードバックのマークダウンを生成
   * @param {string} taskId - タスクID
   * @returns {string} マークダウン文字列
   */
  generateFeedbackMarkdown(taskId) {
    try {
      // フィードバックを取得
      const feedback = this.getFeedbackByTaskId(taskId);
      if (!feedback) {
        console.error(`タスクID ${taskId} のフィードバックが見つかりません`);
        return null;
      }
      
      // マークダウンテンプレートを読み込む
      const templatePath = path.join(this.templateDir, 'feedback-markdown-template.md');
      if (!fs.existsSync(templatePath)) {
        console.error(`テンプレートファイル ${templatePath} が見つかりません`);
        return null;
      }
      
      const templateSource = fs.readFileSync(templatePath, 'utf8');
      const template = Handlebars.compile(templateSource);
      
      // テンプレートに渡すデータを準備
      const loop = feedback.feedback_loop;
      const data = {
        task_id: loop.task_id,
        implementation_attempt: loop.implementation_attempt,
        git_commit: loop.git_commit || 'なし',
        feedback_status: loop.feedback_status || 'open',
        test_execution: {
          timestamp: this._formatDateTime(loop.test_execution?.timestamp || new Date().toISOString()),
          command: loop.test_execution?.command || '',
          duration_ms: loop.test_execution?.duration_ms || 0
        },
        test_types_formatted: (loop.test_execution?.test_types || []).join(', '),
        passes_tests_text: loop.verification_results?.passes_tests ? '✅ 成功' : '❌ 失敗',
        test_summary: loop.verification_results?.test_summary || {
          total: 0,
          passed: 0,
          failed: 0,
          skipped: 0
        },
        has_failed_tests: loop.verification_results?.failed_tests?.length > 0,
        failed_tests: loop.verification_results?.failed_tests || [],
        suggestions: loop.verification_results?.suggestions || [],
        focus_areas: loop.iteration_plan?.focus_areas || [],
        approach: loop.iteration_plan?.approach || '特に指定されていません',
        specific_actions: loop.iteration_plan?.specific_actions || []
      };
      
      // テンプレートを適用
      return template(data);
    } catch (error) {
      console.error('マークダウン生成に失敗しました:', error);
      return null;
    }
  }

  /**
   * フィードバックをセッションに統合
   * @param {string} feedbackId - フィードバックID（タスクID）
   * @param {string} sessionId - セッションID
   * @returns {boolean} 統合結果
   */
  async integrateFeedbackWithSession(feedbackId, sessionId) {
    try {
      const { SessionManager } = require('./session-manager');
      const sessionManager = new SessionManager();
      
      // フィードバックを取得
      const feedback = this.getFeedbackByTaskId(feedbackId);
      if (!feedback) {
        console.error(`フィードバック ${feedbackId} が見つかりません`);
        return false;
      }
      
      // セッションを取得
      const session = sessionManager.getSessionById(sessionId);
      if (!session) {
        console.error(`セッション ${sessionId} が見つかりません`);
        return false;
      }
      
      // フィードバックの失敗したテストを課題として反映
      const failedTests = feedback.feedback_loop.verification_results.failed_tests;
      for (const test of failedTests) {
        const challenge = {
          description: `テスト失敗: ${test.test_name}`,
          related_tasks: [feedback.feedback_loop.task_id],
          priority: 4,
          severity: 4,
          status: "in_progress",
          resolution_plan: "テストが成功するように実装を修正"
        };
        
        sessionManager.addChallenge(sessionId, challenge);
      }
      
      // フィードバックのアクションアイテムをセッションのアクションアイテムに反映
      const actions = feedback.feedback_loop.iteration_plan.specific_actions;
      for (const action of actions) {
        const actionItem = {
          description: action.description,
          related_task: action.related_task || feedback.feedback_loop.task_id,
          priority: action.priority,
          severity: action.priority,
          due_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
          assignee: "AI Developer"
        };
        
        sessionManager.addActionItem(sessionId, actionItem);
      }
      
      // フィードバックとセッションを関連付け
      this.linkFeedbackToSession(feedback, sessionId);
      
      return true;
    } catch (error) {
      console.error('フィードバックとセッションの統合に失敗しました:', error);
      return false;
    }
  }

  /**
   * フィードバックをタスクに統合
   * @param {string} feedbackId - フィードバックID（タスクID）
   * @param {string} taskId - タスクID
   * @returns {boolean} 統合結果
   */
  async integrateFeedbackWithTask(feedbackId, taskId) {
    try {
      // フィードバックを取得
      const feedback = this.getFeedbackByTaskId(feedbackId);
      if (!feedback) {
        console.error(`フィードバック ${feedbackId} が見つかりません`);
        return false;
      }
      
      // タスク管理ユーティリティを読み込む
      const taskManager = require('./task-manager');
      
      // タスクを取得
      const tasksData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'ai-context', 'tasks', 'current-tasks.json'), 'utf8'));
      const tasks = tasksData.decomposed_tasks;
      const taskIndex = tasks.findIndex(t => t.id === taskId);
      
      if (taskIndex === -1) {
        console.error(`タスク ${taskId} が見つかりません`);
        return false;
      }
      
      const task = tasks[taskIndex];
      
      // フィードバックの状態に基づいてタスクの進捗状態を更新
      const statusMap = {
        open: "in_progress",
        in_progress: "in_progress",
        resolved: task.progress_state === "completed" ? "completed" : "in_testing",
        wontfix: task.status
      };
      
      const progressStateMap = {
        open: "in_development",
        in_progress: "in_review",
        resolved: task.progress_percentage === 100 ? "completed" : "in_testing",
        wontfix: task.progress_state
      };
      
      // タスクの状態を更新
      const result = taskManager.updateTaskProgress(
        taskId,
        feedback.feedback_loop.verification_results.passes_tests ? 90 : undefined,
        progressStateMap[feedback.feedback_loop.feedback_status],
        tasks
      );
      
      if (!result.success) {
        console.error(`タスクの更新に失敗しました: ${result.message}`);
        return false;
      }
      
      // Gitコミットの関連付け
      if (feedback.feedback_loop.git_commit) {
        const commitResult = taskManager.addGitCommitToTask(taskId, feedback.feedback_loop.git_commit, result.updatedTasks);
        if (!commitResult.success) {
          console.error(`Gitコミットの関連付けに失敗しました: ${commitResult.message}`);
        }
      }
      
      // 更新されたタスクを保存
      tasksData.decomposed_tasks = result.updatedTasks;
      fs.writeFileSync(
        path.join(process.cwd(), 'ai-context', 'tasks', 'current-tasks.json'),
        JSON.stringify(tasksData, null, 2),
        'utf8'
      );
      
      return true;
    } catch (error) {
      console.error('フィードバックとタスクの統合に失敗しました:', error);
      return false;
    }
  }

  /**
   * テスト結果を解析
   * @param {string} testOutput - テスト出力
   * @param {string} testCommand - テストコマンド
   * @returns {Object} 解析結果 {summary, failedTests}
   * @private
   */
  _parseTestResults(testOutput, testCommand) {
    const framework = this._detectTestFramework(testOutput, testCommand);
    
    switch (framework) {
      case 'jest':
        return this._parseJestOutput(testOutput);
      case 'custom':
        return this._parseCustomOutput(testOutput);
      default:
        return this._parseGenericOutput(testOutput);
    }
  }

  /**
   * テストフレームワークを検出
   * @param {string} testOutput - テスト出力
   * @param {string} testCommand - テストコマンド
   * @returns {string} テストフレームワーク（'jest', 'custom', 'unknown'）
   * @private
   */
  _detectTestFramework(testOutput, testCommand) {
    if (testOutput.includes('PASS') || testOutput.includes('FAIL') || testCommand.includes('jest')) {
      return 'jest';
    } else if (testOutput.includes('✅ PASS') || testOutput.includes('❌ FAIL')) {
      return 'custom';
    }
    return 'unknown';
  }

  /**
   * Jestの出力を解析
   * @param {string} output - テスト出力
   * @returns {Object} 解析結果
   * @private
   */
  _parseJestOutput(output) {
    // 基本的な結果構造
    const result = {
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0
      },
      failedTests: []
    };
    
    try {
      // 合計テスト数を抽出
      const totalMatch = output.match(/Tests:\s+(\d+)/);
      if (totalMatch) {
        result.summary.total = parseInt(totalMatch[1], 10);
      }
      
      // 失敗したテスト数を抽出
      const failedMatch = output.match(/(\d+)\s+failed/);
      if (failedMatch) {
        result.summary.failed = parseInt(failedMatch[1], 10);
      }
      
      // スキップされたテスト数を抽出
      const skippedMatch = output.match(/(\d+)\s+skipped/);
      if (skippedMatch) {
        result.summary.skipped = parseInt(skippedMatch[1], 10);
      }
      
      // 合格したテスト数を計算
      result.summary.passed = result.summary.total - result.summary.failed - result.summary.skipped;
      
      // 失敗したテストの詳細を抽出
      const failedTestsSection = output.split('● ').slice(1);
      for (const section of failedTestsSection) {
        const lines = section.split('\n');
        if (lines.length > 0) {
          const testName = lines[0].trim();
          let error = '';
          let expected = '';
          let actual = '';
          let filePath = '';
          let lineNumber = 0;
          
          // エラーメッセージを抽出
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line.startsWith('Expected:')) {
              expected = line.substring('Expected:'.length).trim();
            } else if (line.startsWith('Received:')) {
              actual = line.substring('Received:'.length).trim();
            } else if (line.includes('at ') && line.includes('.test.js:')) {
              const match = line.match(/at .+\((.+\.test\.js):(\d+):\d+\)/);
              if (match) {
                filePath = match[1];
                lineNumber = parseInt(match[2], 10);
              }
            } else if (error === '' && line !== '') {
              error = line;
            }
          }
          
          result.failedTests.push({
            test_name: testName,
            error: error || 'Unknown error',
            expected,
            actual,
            file_path: filePath,
            line_number: lineNumber
          });
        }
      }
    } catch (error) {
      console.error('Jestテスト結果の解析に失敗しました:', error);
    }
    
    return result;
  }

  /**
   * カスタムテストの出力を解析
   * @param {string} output - テスト出力
   * @returns {Object} 解析結果
   * @private
   */
  _parseCustomOutput(output) {
    // 基本的な結果構造
    const result = {
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0
      },
      failedTests: []
    };
    
    try {
      const lines = output.split('\n');
      
      // 各行を解析
      for (const line of lines) {
        if (line.includes('✅ PASS')) {
          result.summary.passed++;
          result.summary.total++;
        } else if (line.includes('❌ FAIL')) {
          result.summary.failed++;
          result.summary.total++;
          
          // 失敗したテストの詳細を抽出
          const testName = line.replace('❌ FAIL:', '').trim();
          let error = '';
          let expected = '';
          let actual = '';
          
          // 期待値と実際値を抽出
          if (line.includes('期待値:') && line.includes('実際値:')) {
            const parts = line.split('期待値:');
            if (parts.length > 1) {
              const valueParts = parts[1].split('実際値:');
              if (valueParts.length > 1) {
                expected = valueParts[0].trim();
                actual = valueParts[1].trim();
              }
            }
          }
          
          result.failedTests.push({
            test_name: testName,
            error: error || 'テストが失敗しました',
            expected,
            actual,
            file_path: '',
            line_number: 0
          });
        } else if (line.includes('SKIP')) {
          result.summary.skipped++;
          result.summary.total++;
        }
      }
    } catch (error) {
      console.error('カスタムテスト結果の解析に失敗しました:', error);
    }
    
    return result;
  }

  /**
   * 汎用的なテスト出力を解析
   * @param {string} output - テスト出力
   * @returns {Object} 解析結果
   * @private
   */
  _parseGenericOutput(output) {
    // 基本的な結果構造
    const result = {
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0
      },
      failedTests: []
    };
    
    try {
      // 成功と失敗のパターンを検出
      const passPattern = /pass|success|ok/i;
      const failPattern = /fail|error|not ok/i;
      
      const lines = output.split('\n');
      
      // 各行を解析
      for (const line of lines) {
        if (passPattern.test(line)) {
          result.summary.passed++;
          result.summary.total++;
        } else if (failPattern.test(line)) {
          result.summary.failed++;
          result.summary.total++;
          
          result.failedTests.push({
            test_name: line.trim(),
            error: 'テストが失敗しました',
            expected: '',
            actual: '',
            file_path: '',
            line_number: 0
          });
        }
      }
    } catch (error) {
      console.error('汎用テスト結果の解析に失敗しました:', error);
    }
    
    return result;
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
   * コミットメッセージからタスクIDを抽出
   * @param {string} message - コミットメッセージ
   * @returns {Array} タスクIDの配列
   * @private
   */
  _extractTaskIdsFromCommitMessage(message) {
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
   * Handlebarsヘルパーを登録
   * @private
   */
  _registerHandlebarsHelpers() {
    // 条件分岐ヘルパー
    Handlebars.registerHelper('eq', function(a, b, options) {
      return a === b ? options.fn(this) : options.inverse(this);
    });

    // 比較ヘルパー
    Handlebars.registerHelper('gt', function(a, b, options) {
      return a > b ? options.fn(this) : options.inverse(this);
    });

    Handlebars.registerHelper('lt', function(a, b, options) {
      return a < b ? options.fn(this) : options.inverse(this);
    });

    // 配列の長さヘルパー
    Handlebars.registerHelper('length', function(arr) {
      return Array.isArray(arr) ? arr.length : 0;
    });

    // 条件付き表示ヘルパー
    Handlebars.registerHelper('ifCond', function(v1, operator, v2, options) {
      switch (operator) {
        case '==':
          return (v1 == v2) ? options.fn(this) : options.inverse(this);
        case '===':
          return (v1 === v2) ? options.fn(this) : options.inverse(this);
        case '!=':
          return (v1 != v2) ? options.fn(this) : options.inverse(this);
        case '!==':
          return (v1 !== v2) ? options.fn(this) : options.inverse(this);
        case '<':
          return (v1 < v2) ? options.fn(this) : options.inverse(this);
        case '<=':
          return (v1 <= v2) ? options.fn(this) : options.inverse(this);
        case '>':
          return (v1 > v2) ? options.fn(this) : options.inverse(this);
        case '>=':
          return (v1 >= v2) ? options.fn(this) : options.inverse(this);
        case '&&':
          return (v1 && v2) ? options.fn(this) : options.inverse(this);
        case '||':
          return (v1 || v2) ? options.fn(this) : options.inverse(this);
        default:
          return options.inverse(this);
      }
    });

    // 配列の結合ヘルパー
    Handlebars.registerHelper('join', function(arr, separator) {
      return Array.isArray(arr) ? arr.join(separator) : '';
    });

    // JSONフォーマットヘルパー
    Handlebars.registerHelper('json', function(context) {
      return JSON.stringify(context, null, 2);
    });
  }
}

module.exports = { FeedbackManager };
/**
 * セッション管理ユーティリティのテスト
 */

const { SessionManager } = require('../src/utils/session-manager');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// モックの設定
jest.mock('fs');
jest.mock('child_process');

describe('SessionManager', () => {
  let sessionManager;
  let mockSession;
  
  beforeEach(() => {
    // ファイルシステムのモックをリセット
    fs.existsSync.mockReset();
    fs.readFileSync.mockReset();
    fs.writeFileSync.mockReset();
    fs.mkdirSync.mockReset();
    
    // execSyncのモックをリセット
    execSync.mockReset();
    
    // SessionManagerのインスタンスを作成
    sessionManager = new SessionManager({
      sessionsDir: '/test/sessions',
      templateDir: '/test/templates'
    });
    
    // モックセッションの作成
    mockSession = {
      session_handover: {
        project_id: 'test-project',
        session_id: 'abc123',
        previous_session_id: 'def456',
        session_timestamp: '2025-03-20T15:30:00Z',
        session_start_timestamp: '2025-03-20T13:45:00Z',
        project_state_summary: {
          completed_tasks: ['T001', 'T002'],
          current_tasks: ['T003'],
          pending_tasks: ['T004', 'T005'],
          blocked_tasks: []
        },
        key_artifacts: [
          {
            path: 'src/test.js',
            description: 'テストファイル',
            last_modified: '2025-03-20T14:25:00Z',
            git_status: 'modified',
            related_tasks: ['T003'],
            importance: 'high'
          }
        ],
        git_changes: {
          commits: [
            {
              hash: 'abc123',
              message: 'テスト実装 #T003',
              timestamp: '2025-03-20T15:20:00Z',
              related_tasks: ['T003'],
              author: 'Test User'
            }
          ],
          summary: {
            files_added: 1,
            files_modified: 2,
            files_deleted: 0,
            lines_added: 100,
            lines_deleted: 50
          }
        },
        current_challenges: [
          {
            description: 'テスト課題',
            related_tasks: ['T003'],
            priority: 4,
            severity: 3,
            status: 'in_progress',
            resolution_plan: 'テスト解決計画'
          }
        ],
        next_session_focus: 'T004: 次のタスク',
        action_items: [
          {
            description: 'テストアクションアイテム',
            related_task: 'T003',
            priority: 5,
            severity: 4,
            due_date: '2025-03-21',
            assignee: 'Test User'
          }
        ]
      }
    };
  });
  
  describe('validateSession', () => {
    test('有効なセッションを検証できること', () => {
      const result = sessionManager.validateSession(mockSession);
      expect(result).toBe(true);
    });
    
    test('セッションオブジェクトがない場合はfalseを返すこと', () => {
      const result = sessionManager.validateSession(null);
      expect(result).toBe(false);
    });
    
    test('session_handoverがない場合はfalseを返すこと', () => {
      const result = sessionManager.validateSession({});
      expect(result).toBe(false);
    });
    
    test('必須フィールドがない場合はfalseを返すこと', () => {
      const invalidSession = { ...mockSession };
      delete invalidSession.session_handover.project_id;
      
      const result = sessionManager.validateSession(invalidSession);
      expect(result).toBe(false);
    });
    
    test('不正なタスクID形式の場合はfalseを返すこと', () => {
      const invalidSession = { ...mockSession };
      invalidSession.session_handover.project_state_summary.completed_tasks = ['invalid-task-id'];
      
      const result = sessionManager.validateSession(invalidSession);
      expect(result).toBe(false);
    });
  });
  
  describe('getLatestSession', () => {
    test('最新のセッションを取得できること', () => {
      // モックの設定を完全にリセット
      fs.existsSync.mockReset();
      fs.readFileSync.mockReset();
      
      // 明示的なモックの設定
      fs.existsSync.mockImplementation(path => {
        return path.includes('latest-session.json');
      });
      
      fs.readFileSync.mockImplementation((path, encoding) => {
        if (path.includes('latest-session.json') && encoding === 'utf8') {
          return JSON.stringify(mockSession);
        }
        throw new Error('Unexpected file read');
      });
      
      const result = sessionManager.getLatestSession();
      
      // 結果の検証
      expect(result).toEqual(mockSession);
      expect(fs.existsSync).toHaveBeenCalled();
      expect(fs.readFileSync).toHaveBeenCalled();
      
      // 呼び出し引数の検証（パス形式に依存しない）
      const existsPath = fs.existsSync.mock.calls[0][0];
      const readPath = fs.readFileSync.mock.calls[0][0];
      const readEncoding = fs.readFileSync.mock.calls[0][1];
      
      expect(existsPath).toEqual(expect.stringContaining('latest-session.json'));
      expect(readPath).toEqual(expect.stringContaining('latest-session.json'));
      expect(readEncoding).toBe('utf8');
    });
    
    test('最新のセッションが存在しない場合はnullを返すこと', () => {
      fs.existsSync.mockReturnValue(false);
      
      const result = sessionManager.getLatestSession();
      expect(result).toBeNull();
    });
    
    test('ファイル読み込みエラーの場合はnullを返すこと', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation(() => {
        throw new Error('読み込みエラー');
      });
      
      const result = sessionManager.getLatestSession();
      expect(result).toBeNull();
    });
  });
  
  describe('getSessionById', () => {
    test('最新のセッションからセッションを取得できること', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(mockSession));
      
      const result = sessionManager.getSessionById('abc123');
      expect(result).toEqual(mockSession);
    });
    
    test('履歴からセッションを取得できること', () => {
      // 最新のセッションは別のIDを持つ
      const latestSession = JSON.parse(JSON.stringify(mockSession));
      latestSession.session_handover.session_id = 'different-id';
      
      // モックの設定を調整
      fs.existsSync.mockImplementation((path) => {
        return true; // すべてのパスが存在すると仮定
      });
      
      fs.readFileSync.mockImplementation((path) => {
        if (path.includes('latest-session.json')) {
          return JSON.stringify(latestSession);
        }
        if (path.includes('abc123.json')) {
          return JSON.stringify(mockSession);
        }
        return '';
      });
      
      // テスト対象のメソッドを呼び出す
      const result = sessionManager.getSessionById('abc123');
      
      // 検証
      expect(result).toEqual(mockSession);
      expect(fs.existsSync).toHaveBeenCalled();
      expect(fs.readFileSync).toHaveBeenCalled();
    });
    
    test('セッションが存在しない場合はnullを返すこと', () => {
      fs.existsSync.mockReturnValue(false);
      
      const result = sessionManager.getSessionById('non-existent-id');
      expect(result).toBeNull();
    });
  });
  
  describe('createNewSession', () => {
    test('前回のセッションIDを指定して新しいセッションを作成できること', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(mockSession));
      execSync.mockReturnValue(Buffer.from('new-commit-hash'));
      
      const result = sessionManager.createNewSession('abc123');
      
      expect(result).not.toBeNull();
      expect(result.session_handover.previous_session_id).toBe('abc123');
      expect(result.session_handover.session_id).toBe('new-commit-hash');
      expect(result.session_handover.project_state_summary.completed_tasks).toEqual(['T001', 'T002']);
      expect(result.session_handover.project_state_summary.current_tasks).toEqual(['T003']);
      expect(result.session_handover.project_state_summary.pending_tasks).toEqual(['T004', 'T005']);
      expect(result.session_handover.next_session_focus).toBe('T004: 次のタスク');
    });
    
    test('前回のセッションIDを指定せずに新しいセッションを作成できること', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(mockSession));
      execSync.mockReturnValue(Buffer.from('new-commit-hash'));
      
      const result = sessionManager.createNewSession();
      
      expect(result).not.toBeNull();
      expect(result.session_handover.previous_session_id).toBe('abc123');
      expect(result.session_handover.session_id).toBe('new-commit-hash');
    });
    
    test('前回のセッションが存在しない場合でも新しいセッションを作成できること', () => {
      fs.existsSync.mockReturnValue(false);
      execSync.mockReturnValue(Buffer.from('new-commit-hash'));
      
      const result = sessionManager.createNewSession();
      
      expect(result).not.toBeNull();
      expect(result.session_handover.previous_session_id).toBeNull();
      expect(result.session_handover.session_id).toBe('new-commit-hash');
      expect(result.session_handover.project_id).toBe('knoa');
    });
  });
  
  describe('saveSession', () => {
    test('セッションを保存できること', () => {
      sessionManager.validateSession = jest.fn().mockReturnValue(true);
      
      const result = sessionManager.saveSession(mockSession, true);
      
      expect(result).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
      // パスの形式に依存しないテスト
      expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
      
      // 最初の呼び出しがセッション履歴への保存であることを確認
      const firstCallPath = fs.writeFileSync.mock.calls[0][0];
      expect(firstCallPath).toMatch(/session-history.*session-abc123\.json/);
      expect(fs.writeFileSync.mock.calls[0][1]).toBe(JSON.stringify(mockSession, null, 2));
      expect(fs.writeFileSync.mock.calls[0][2]).toBe('utf8');
      
      // 2番目の呼び出しが最新セッションへの保存であることを確認
      const secondCallPath = fs.writeFileSync.mock.calls[1][0];
      expect(secondCallPath).toMatch(/latest-session\.json/);
      expect(fs.writeFileSync.mock.calls[1][1]).toBe(JSON.stringify(mockSession, null, 2));
      expect(fs.writeFileSync.mock.calls[1][2]).toBe('utf8');
    });
    
    test('不正なセッションは保存できないこと', () => {
      sessionManager.validateSession = jest.fn().mockReturnValue(false);
      
      const result = sessionManager.saveSession(mockSession, true);
      
      expect(result).toBe(false);
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });
    
    test('isLatestがfalseの場合は最新のセッションとして保存しないこと', () => {
      sessionManager.validateSession = jest.fn().mockReturnValue(true);
      
      const result = sessionManager.saveSession(mockSession, false);
      
      expect(result).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
      // パスの形式に依存しないテスト
      expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
      
      // 呼び出しがセッション履歴への保存であることを確認
      const callPath = fs.writeFileSync.mock.calls[0][0];
      expect(callPath).toMatch(/session-history.*session-abc123\.json/);
      expect(fs.writeFileSync.mock.calls[0][1]).toBe(JSON.stringify(mockSession, null, 2));
      expect(fs.writeFileSync.mock.calls[0][2]).toBe('utf8');
    });
  });
  
  describe('extractTaskIdsFromCommitMessage', () => {
    test('コミットメッセージからタスクIDを抽出できること', () => {
      const message = 'テスト実装 #T001 #T002';
      const result = sessionManager.extractTaskIdsFromCommitMessage(message);
      
      expect(result).toEqual(['T001', 'T002']);
    });
    
    test('タスクIDがない場合は空配列を返すこと', () => {
      const message = 'タスクIDなしのコミット';
      const result = sessionManager.extractTaskIdsFromCommitMessage(message);
      
      expect(result).toEqual([]);
    });
    
    test('不正な形式のタスクIDは抽出しないこと', () => {
      const message = 'テスト実装 #T001 #invalid-task-id';
      const result = sessionManager.extractTaskIdsFromCommitMessage(message);
      
      expect(result).toEqual(['T001']);
    });
  });
  
  describe('linkActionItemsToTasks', () => {
    test('アクションアイテムとタスクを関連付けできること', () => {
      // 関連タスクが設定されていないアクションアイテムを含むセッション
      const sessionWithUnlinkedActionItem = { ...mockSession };
      sessionWithUnlinkedActionItem.session_handover.action_items.push({
        description: 'タスクT004に関連するアクションアイテム',
        priority: 3,
        severity: 2
      });
      
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(sessionWithUnlinkedActionItem));
      
      const result = sessionManager.linkActionItemsToTasks('abc123');
      
      expect(result).not.toBeNull();
      expect(result.session_handover.action_items[1].related_task).toBe('T004');
    });
    
    test('タスクIDが説明に含まれていない場合は関連付けしないこと', () => {
      // タスクIDが含まれていないアクションアイテムを含むセッション
      const sessionWithUnlinkedActionItem = { ...mockSession };
      sessionWithUnlinkedActionItem.session_handover.action_items.push({
        description: 'タスクIDが含まれていないアクションアイテム',
        priority: 3,
        severity: 2
      });
      
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(sessionWithUnlinkedActionItem));
      
      const result = sessionManager.linkActionItemsToTasks('abc123');
      
      expect(result).not.toBeNull();
      expect(result.session_handover.action_items[1].related_task).toBeUndefined();
    });
  });
  
  describe('generateSessionHandoverMarkdown', () => {
    test('マークダウン形式の引継ぎドキュメントを生成できること', () => {
      // 直接モックセッションを使用するようにメソッドをオーバーライド
      sessionManager.getSessionById = jest.fn().mockReturnValue(mockSession);
      
      // テンプレートファイルのモック
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation((path) => {
        if (path.includes('session-handover-template.md')) {
          return `# セッション引継ぎドキュメント
## セッション情報
- **プロジェクト**: {{project_id}}
- **日時**: {{session_timestamp}}
- **セッションID**: {{session_id}}`;
        }
        return '';
      });
      
      // 内部メソッドのモック
      sessionManager._formatDateTime = jest.fn().mockReturnValue('2025-03-20 15:30');
      sessionManager._calculateSessionDuration = jest.fn().mockReturnValue('1時間45分');
      sessionManager._formatTaskList = jest.fn().mockReturnValue('`T001`, `T002`');
      sessionManager._generateImplementationSummary = jest.fn().mockReturnValue('実装内容のサマリー');
      sessionManager._generateKeyChanges = jest.fn().mockReturnValue('主な変更点');
      sessionManager._formatKeyArtifacts = jest.fn().mockReturnValue('重要なファイルのリスト');
      sessionManager._formatCommits = jest.fn().mockReturnValue('コミット履歴');
      sessionManager._formatOtherChanges = jest.fn().mockReturnValue('その他の変更');
      sessionManager._generateResolvedChallenges = jest.fn().mockReturnValue('解決済みの課題');
      sessionManager._formatChallenges = jest.fn().mockReturnValue('現在の課題のリスト');
      sessionManager._formatActionItems = jest.fn().mockReturnValue('アクションアイテムのリスト');
      sessionManager._generateRecommendations = jest.fn().mockReturnValue('推奨事項');
      
      // マークダウン生成
      const result = sessionManager.generateSessionHandoverMarkdown('abc123');
      
      // 検証
      expect(result).not.toBeNull();
      expect(result).toContain('# セッション引継ぎドキュメント');
      expect(result).toContain('**プロジェクト**: test-project');
      expect(result).toContain('**日時**: 2025-03-20 15:30');
      expect(result).toContain('**セッションID**: abc123');
    });
    
    test('セッションが存在しない場合はnullを返すこと', () => {
      fs.existsSync.mockReturnValue(false);
      
      const result = sessionManager.generateSessionHandoverMarkdown('non-existent-id');
      
      expect(result).toBeNull();
    });
  });
  
  // その他のメソッドのテストも同様に実装
});
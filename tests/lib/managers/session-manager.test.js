/**
 * セッション管理ユーティリティのテスト
 */

const { SessionManager } = require('../../../src/lib/managers/session-manager');
const { createMockDependencies } = require('../../helpers/mock-factory');

describe('SessionManager', () => {
  let sessionManager;
  let mockDeps;
  let mockSession;

  beforeEach(() => {
    // モック依存関係の作成
    mockDeps = createMockDependencies();

    // SessionManagerのインスタンスを作成
    sessionManager = new SessionManager(
      mockDeps.storageService,
      mockDeps.gitService,
      mockDeps.logger,
      mockDeps.eventEmitter,
      mockDeps.errorHandler,
      {
        sessionsDir: 'test-sessions',
        templateDir: 'test-templates',
      }
    );

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
          blocked_tasks: [],
        },
        key_artifacts: [
          {
            path: 'src/test.js',
            description: 'テストファイル',
            last_modified: '2025-03-20T14:25:00Z',
            git_status: 'modified',
            related_tasks: ['T003'],
            importance: 'high',
          },
        ],
        git_changes: {
          commits: [
            {
              hash: 'abc123',
              message: 'テスト実装 #T003',
              timestamp: '2025-03-20T15:20:00Z',
              related_tasks: ['T003'],
              author: 'Test User',
            },
          ],
          summary: {
            files_added: 1,
            files_modified: 2,
            files_deleted: 0,
            lines_added: 100,
            lines_deleted: 50,
          },
        },
        current_challenges: [
          {
            description: 'テスト課題',
            related_tasks: ['T003'],
            priority: 4,
            severity: 3,
            status: 'in_progress',
            resolution_plan: 'テスト解決計画',
          },
        ],
        next_session_focus: 'T004: 次のタスク',
        action_items: [
          {
            description: 'テストアクションアイテム',
            related_task: 'T003',
            priority: 5,
            severity: 4,
            due_date: '2025-03-21',
            assignee: 'Test User',
          },
        ],
      },
    };
  });

  test('コンストラクタで依存関係を正しく設定する', () => {
    expect(sessionManager.storageService).toBe(mockDeps.storageService);
    expect(sessionManager.gitService).toBe(mockDeps.gitService);
    expect(sessionManager.logger).toBe(mockDeps.logger);
    expect(sessionManager.eventEmitter).toBe(mockDeps.eventEmitter);
    expect(sessionManager.errorHandler).toBe(mockDeps.errorHandler);
    expect(sessionManager.sessionsDir).toBe('test-sessions');
    expect(sessionManager.templateDir).toBe('test-templates');
  });

  test('必須の依存関係が欠けている場合はエラーをスローする', () => {
    expect(
      () =>
        new SessionManager(
          null,
          mockDeps.gitService,
          mockDeps.logger,
          mockDeps.eventEmitter,
          mockDeps.errorHandler
        )
    ).toThrow('SessionManager requires a storageService instance');

    expect(
      () =>
        new SessionManager(
          mockDeps.storageService,
          null,
          mockDeps.logger,
          mockDeps.eventEmitter,
          mockDeps.errorHandler
        )
    ).toThrow('SessionManager requires a gitService instance');

    expect(
      () =>
        new SessionManager(
          mockDeps.storageService,
          mockDeps.gitService,
          null,
          mockDeps.eventEmitter,
          mockDeps.errorHandler
        )
    ).toThrow('SessionManager requires a logger instance');

    expect(
      () =>
        new SessionManager(
          mockDeps.storageService,
          mockDeps.gitService,
          mockDeps.logger,
          null,
          mockDeps.errorHandler
        )
    ).toThrow('SessionManager requires an eventEmitter instance');

    expect(
      () =>
        new SessionManager(
          mockDeps.storageService,
          mockDeps.gitService,
          mockDeps.logger,
          mockDeps.eventEmitter,
          null
        )
    ).toThrow('SessionManager requires an errorHandler instance');
  });

  describe('validateSession', () => {
    test('有効なセッションを検証できること', () => {
      const result = sessionManager.validateSession(mockSession);
      expect(result).toBe(true);
    });

    test('セッションオブジェクトがない場合はfalseを返すこと', () => {
      const result = sessionManager.validateSession(null);
      expect(result).toBe(false);
      expect(mockDeps.logger.error).toHaveBeenCalled();
    });

    test('session_handoverがない場合はfalseを返すこと', () => {
      const result = sessionManager.validateSession({});
      expect(result).toBe(false);
      expect(mockDeps.logger.error).toHaveBeenCalled();
    });

    test('必須フィールドがない場合はfalseを返すこと', () => {
      const invalidSession = { ...mockSession };
      delete invalidSession.session_handover.project_id;

      const result = sessionManager.validateSession(invalidSession);
      expect(result).toBe(false);
      expect(mockDeps.logger.error).toHaveBeenCalled();
    });

    test('不正なタスクID形式の場合はfalseを返すこと', () => {
      const invalidSession = { ...mockSession };
      invalidSession.session_handover.project_state_summary.completed_tasks = [
        'invalid-task-id',
      ];

      const result = sessionManager.validateSession(invalidSession);
      expect(result).toBe(false);
      expect(mockDeps.logger.error).toHaveBeenCalled();
    });
  });

  describe('getLatestSession', () => {
    test('最新のセッションを取得できること', () => {
      // モックの設定
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockReturnValue(mockSession);

      const result = sessionManager.getLatestSession();

      // 結果の検証
      expect(result).toEqual(mockSession);
      expect(mockDeps.storageService.fileExists).toHaveBeenCalledWith(
        'test-sessions',
        'latest-session.json'
      );
      expect(mockDeps.storageService.readJSON).toHaveBeenCalledWith(
        'test-sessions',
        'latest-session.json'
      );
    });

    test('最新のセッションが存在しない場合はnullを返すこと', () => {
      mockDeps.storageService.fileExists.mockReturnValue(false);

      const result = sessionManager.getLatestSession();
      expect(result).toBeNull();
    });

    test('ファイル読み込みエラーの場合はnullを返すこと', () => {
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockImplementation(() => {
        throw new Error('読み込みエラー');
      });

      const result = sessionManager.getLatestSession();
      expect(result).toBeNull();
      expect(mockDeps.errorHandler.handle).toHaveBeenCalled();
    });
  });

  describe('getSessionById', () => {
    test('最新のセッションからセッションを取得できること', () => {
      // getLatestSessionをモック
      sessionManager.getLatestSession = jest.fn().mockReturnValue(mockSession);

      const result = sessionManager.getSessionById('abc123');
      expect(result).toEqual(mockSession);
      expect(sessionManager.getLatestSession).toHaveBeenCalled();
    });

    test('履歴からセッションを取得できること', () => {
      // 最新のセッションは別のIDを持つ
      const latestSession = JSON.parse(JSON.stringify(mockSession));
      latestSession.session_handover.session_id = 'different-id';

      // getLatestSessionをモック
      sessionManager.getLatestSession = jest
        .fn()
        .mockReturnValue(latestSession);

      // モックの設定
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockReturnValue(mockSession);

      // テスト対象のメソッドを呼び出す
      const result = sessionManager.getSessionById('abc123');

      // 検証
      expect(result).toEqual(mockSession);
      expect(sessionManager.getLatestSession).toHaveBeenCalled();
      expect(mockDeps.storageService.fileExists).toHaveBeenCalledWith(
        'test-sessions/session-history',
        'session-abc123.json'
      );
      expect(mockDeps.storageService.readJSON).toHaveBeenCalledWith(
        'test-sessions/session-history',
        'session-abc123.json'
      );
    });

    test('セッションが存在しない場合はnullを返すこと', () => {
      // getLatestSessionをモック
      sessionManager.getLatestSession = jest.fn().mockReturnValue(null);

      // モックの設定
      mockDeps.storageService.fileExists.mockReturnValue(false);

      const result = sessionManager.getSessionById('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('createNewSession', () => {
    test('前回のセッションIDを指定して新しいセッションを作成できること', () => {
      // getSessionByIdをモック
      sessionManager.getSessionById = jest.fn().mockReturnValue(mockSession);

      // getCurrentGitCommitHashをモック
      sessionManager._getCurrentGitCommitHash = jest
        .fn()
        .mockReturnValue('new-commit-hash');

      const result = sessionManager.createNewSession('abc123');

      expect(result).not.toBeNull();
      expect(result.session_handover.previous_session_id).toBe('abc123');
      expect(result.session_handover.session_id).toBe('new-commit-hash');
      expect(
        result.session_handover.project_state_summary.completed_tasks
      ).toEqual(['T001', 'T002']);
      expect(
        result.session_handover.project_state_summary.current_tasks
      ).toEqual(['T003']);
      expect(
        result.session_handover.project_state_summary.pending_tasks
      ).toEqual(['T004', 'T005']);
      expect(result.session_handover.next_session_focus).toBe(
        'T004: 次のタスク'
      );
    });

    test('前回のセッションIDを指定せずに新しいセッションを作成できること', () => {
      // getLatestSessionをモック
      sessionManager.getLatestSession = jest.fn().mockReturnValue(mockSession);

      // getCurrentGitCommitHashをモック
      sessionManager._getCurrentGitCommitHash = jest
        .fn()
        .mockReturnValue('new-commit-hash');

      const result = sessionManager.createNewSession();

      expect(result).not.toBeNull();
      expect(result.session_handover.previous_session_id).toBe('abc123');
      expect(result.session_handover.session_id).toBe('new-commit-hash');
    });

    test('前回のセッションが存在しない場合でも新しいセッションを作成できること', () => {
      // getSessionByIdとgetLatestSessionをモック
      sessionManager.getSessionById = jest.fn().mockReturnValue(null);
      sessionManager.getLatestSession = jest.fn().mockReturnValue(null);

      // getCurrentGitCommitHashをモック
      sessionManager._getCurrentGitCommitHash = jest
        .fn()
        .mockReturnValue('new-commit-hash');

      const result = sessionManager.createNewSession();

      expect(result).not.toBeNull();
      expect(result.session_handover.previous_session_id).toBeNull();
      expect(result.session_handover.session_id).toBe('new-commit-hash');
      expect(result.session_handover.project_id).toBe('knoa');
    });
  });

  describe('saveSession', () => {
    test('セッションを保存できること', () => {
      // validateSessionをモック
      sessionManager.validateSession = jest.fn().mockReturnValue(true);

      const result = sessionManager.saveSession(mockSession, true);

      expect(result).toBe(true);
      expect(mockDeps.storageService.writeJSON).toHaveBeenCalledTimes(2);

      // 最初の呼び出しがセッション履歴への保存であることを確認
      expect(mockDeps.storageService.writeJSON).toHaveBeenCalledWith(
        'test-sessions/session-history',
        'session-abc123.json',
        mockSession
      );

      // 2番目の呼び出しが最新セッションへの保存であることを確認
      expect(mockDeps.storageService.writeJSON).toHaveBeenCalledWith(
        'test-sessions',
        'latest-session.json',
        mockSession
      );
    });

    test('不正なセッションは保存できないこと', () => {
      // validateSessionをモック
      sessionManager.validateSession = jest.fn().mockReturnValue(false);

      const result = sessionManager.saveSession(mockSession, true);

      expect(result).toBe(false);
      expect(mockDeps.storageService.writeJSON).not.toHaveBeenCalled();
      expect(mockDeps.logger.error).toHaveBeenCalled();
    });

    test('isLatestがfalseの場合は最新のセッションとして保存しないこと', () => {
      // validateSessionをモック
      sessionManager.validateSession = jest.fn().mockReturnValue(true);

      const result = sessionManager.saveSession(mockSession, false);

      expect(result).toBe(true);
      expect(mockDeps.storageService.writeJSON).toHaveBeenCalledTimes(1);

      // 呼び出しがセッション履歴への保存であることを確認
      expect(mockDeps.storageService.writeJSON).toHaveBeenCalledWith(
        'test-sessions/session-history',
        'session-abc123.json',
        mockSession
      );
    });
  });

  describe('extractTaskIdsFromCommitMessage', () => {
    test('コミットメッセージからタスクIDを抽出できること', () => {
      // gitServiceのextractTaskIdsFromCommitMessageをモック
      mockDeps.gitService.extractTaskIdsFromCommitMessage.mockReturnValue([
        'T001',
        'T002',
      ]);

      const message = 'テスト実装 #T001 #T002';
      const result = sessionManager.extractTaskIdsFromCommitMessage(message);

      expect(result).toEqual(['T001', 'T002']);
      expect(
        mockDeps.gitService.extractTaskIdsFromCommitMessage
      ).toHaveBeenCalledWith(message);
    });
  });

  // その他のテストも同様に修正
});

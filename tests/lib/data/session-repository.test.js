/**
 * セッションリポジトリクラスのテスト
 */

const {
  SessionRepository,
} = require('../../../src/lib/data/session-repository');
const { NotFoundError } = require('../../../src/lib/data/repository');
const { createMockDependencies } = require('../../helpers/mock-factory');

describe('SessionRepository', () => {
  let sessionRepository;
  let mockDeps;
  let mockValidator;

  beforeEach(() => {
    mockDeps = createMockDependencies();
    mockValidator = {
      validate: jest.fn().mockReturnValue({ isValid: true }),
    };
    sessionRepository = new SessionRepository(
      mockDeps.storageService,
      mockValidator,
      mockDeps.gitService
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should create repository with default options', () => {
      expect(sessionRepository.entityName).toBe('session');
      expect(sessionRepository.directory).toBe('ai-context/sessions');
      expect(sessionRepository.currentFile).toBe('latest-session.json');
      expect(sessionRepository.historyDirectory).toBe('session-history');
      expect(sessionRepository.validator).toBe(mockValidator);
      expect(sessionRepository.gitService).toBe(mockDeps.gitService);
    });

    test('should create repository with custom options', () => {
      const customOptions = {
        directory: 'custom-sessions',
        currentFile: 'custom-session.json',
        historyDirectory: 'custom-history',
      };

      const customRepo = new SessionRepository(
        mockDeps.storageService,
        mockValidator,
        mockDeps.gitService,
        customOptions
      );

      expect(customRepo.directory).toBe('custom-sessions');
      expect(customRepo.currentFile).toBe('custom-session.json');
      expect(customRepo.historyDirectory).toBe('custom-history');
    });
  });

  describe('getLatestSession', () => {
    test('should return latest session if exists', async () => {
      const mockSession = { session_handover: { session_id: 'session-123' } };

      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue(mockSession);

      const result = await sessionRepository.getLatestSession();

      expect(result).toEqual(mockSession);
      expect(mockDeps.storageService.fileExists).toHaveBeenCalledWith(
        'ai-context/sessions',
        'latest-session.json'
      );
      expect(mockDeps.storageService.readJSON).toHaveBeenCalledWith(
        'ai-context/sessions',
        'latest-session.json'
      );
    });

    test('should return null if latest session does not exist', async () => {
      mockDeps.storageService.fileExists.mockReturnValue(false);

      const result = await sessionRepository.getLatestSession();

      expect(result).toBeNull();
      expect(mockDeps.storageService.readJSON).not.toHaveBeenCalled();
    });

    test('should handle error from storage service', async () => {
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockRejectedValue(
        new Error('Read error')
      );

      await expect(sessionRepository.getLatestSession()).rejects.toThrow(
        'Failed to get latest session: Read error'
      );
    });
  });

  describe('getSessionById', () => {
    test('should return session from latest if ID matches', async () => {
      const mockSession = { session_handover: { session_id: 'session-123' } };

      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue(mockSession);

      const result = await sessionRepository.getSessionById('session-123');

      expect(result).toEqual(mockSession);
      expect(mockDeps.storageService.readJSON).toHaveBeenCalledWith(
        'ai-context/sessions',
        'latest-session.json'
      );
    });

    test('should return session from history if not in latest', async () => {
      // Latest session has different ID
      const latestSession = { session_handover: { session_id: 'session-456' } };
      const historySession = {
        session_handover: { session_id: 'session-123' },
      };

      mockDeps.storageService.fileExists
        .mockReturnValueOnce(true) // For latest session
        .mockReturnValueOnce(true); // For history session

      mockDeps.storageService.readJSON
        .mockResolvedValueOnce(latestSession) // For latest session
        .mockResolvedValueOnce(historySession); // For history session

      const result = await sessionRepository.getSessionById('session-123');

      expect(result).toEqual(historySession);
      expect(mockDeps.storageService.fileExists).toHaveBeenCalledWith(
        'ai-context/sessions/session-history',
        'session-session-123.json'
      );
      expect(mockDeps.storageService.readJSON).toHaveBeenCalledWith(
        'ai-context/sessions/session-history',
        'session-session-123.json'
      );
    });

    test('should return null if session not found', async () => {
      // Latest session has different ID
      const latestSession = { session_handover: { session_id: 'session-456' } };

      mockDeps.storageService.fileExists
        .mockReturnValueOnce(true) // For latest session
        .mockReturnValueOnce(false); // For history session

      mockDeps.storageService.readJSON.mockResolvedValueOnce(latestSession);

      const result = await sessionRepository.getSessionById('session-123');

      expect(result).toBeNull();
    });

    test('should handle error from storage service', async () => {
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockRejectedValue(
        new Error('Read error')
      );

      await expect(
        sessionRepository.getSessionById('session-123')
      ).rejects.toThrow('Failed to get session by id session-123: Read error');
    });
  });

  describe('createNewSession', () => {
    test('should create new session with previous session', async () => {
      const previousSession = {
        session_handover: {
          project_id: 'knoa',
          session_id: 'session-123',
          project_state_summary: {
            completed_tasks: ['T001'],
            current_tasks: ['T002'],
            pending_tasks: ['T003'],
            blocked_tasks: ['T004'],
          },
          current_challenges: [
            { description: 'Challenge 1', status: 'in_progress' },
            { description: 'Challenge 2', status: 'resolved' },
          ],
          action_items: [{ description: 'Action 1' }],
          next_session_focus: 'Focus area',
        },
      };

      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue(previousSession);
      mockDeps.gitService.getCurrentCommitHash.mockResolvedValue('commit-hash');

      // Mock Date.toISOString to return a fixed timestamp
      const originalDateToISOString = Date.prototype.toISOString;
      const mockTimestamp = '2025-03-22T12:00:00.000Z';
      Date.prototype.toISOString = jest.fn(() => mockTimestamp);

      const result = await sessionRepository.createNewSession('session-123');

      // Restore original Date.toISOString
      Date.prototype.toISOString = originalDateToISOString;

      expect(result.session_handover.project_id).toBe('knoa');
      expect(result.session_handover.session_id).toBe('commit-hash');
      expect(result.session_handover.previous_session_id).toBe('session-123');
      expect(result.session_handover.session_timestamp).toBe(mockTimestamp);

      // 状態の引き継ぎを確認
      expect(
        result.session_handover.project_state_summary.completed_tasks
      ).toEqual(['T001']);
      expect(
        result.session_handover.project_state_summary.current_tasks
      ).toEqual(['T002']);
      expect(
        result.session_handover.project_state_summary.pending_tasks
      ).toEqual(['T003']);
      expect(
        result.session_handover.project_state_summary.blocked_tasks
      ).toEqual(['T004']);

      // 解決済みでない課題のみ引き継がれることを確認
      expect(result.session_handover.current_challenges).toHaveLength(1);
      expect(result.session_handover.current_challenges[0].description).toBe(
        'Challenge 1'
      );

      // アクションアイテムの引き継ぎを確認
      expect(result.session_handover.action_items).toEqual([
        { description: 'Action 1' },
      ]);

      // 次のセッションの焦点の引き継ぎを確認
      expect(result.session_handover.next_session_focus).toBe('Focus area');
    });

    test('should create new session without previous session', async () => {
      mockDeps.storageService.fileExists.mockReturnValue(false);
      mockDeps.gitService.getCurrentCommitHash.mockResolvedValue('commit-hash');

      // Mock Date.toISOString to return a fixed timestamp
      const originalDateToISOString = Date.prototype.toISOString;
      const mockTimestamp = '2025-03-22T12:00:00.000Z';
      Date.prototype.toISOString = jest.fn(() => mockTimestamp);

      const result = await sessionRepository.createNewSession();

      // Restore original Date.toISOString
      Date.prototype.toISOString = originalDateToISOString;

      expect(result.session_handover.project_id).toBe('knoa');
      expect(result.session_handover.session_id).toBe('commit-hash');
      expect(result.session_handover.previous_session_id).toBeNull();
      expect(result.session_handover.session_timestamp).toBe(mockTimestamp);

      // 空の状態が作成されることを確認
      expect(
        result.session_handover.project_state_summary.completed_tasks
      ).toEqual([]);
      expect(
        result.session_handover.project_state_summary.current_tasks
      ).toEqual([]);
      expect(
        result.session_handover.project_state_summary.pending_tasks
      ).toEqual([]);
      expect(
        result.session_handover.project_state_summary.blocked_tasks
      ).toEqual([]);
    });

    test('should handle error from git service', async () => {
      mockDeps.gitService.getCurrentCommitHash.mockRejectedValue(
        new Error('Git error')
      );

      await expect(sessionRepository.createNewSession()).rejects.toThrow(
        'Failed to create new session: Git error'
      );
    });
  });

  describe('saveSession', () => {
    test('should validate session before saving', async () => {
      const mockSession = { session_handover: { session_id: 'session-123' } };

      // Mock _validateSession method
      jest.spyOn(sessionRepository, '_validateSession').mockReturnValue(false);

      await expect(sessionRepository.saveSession(mockSession)).rejects.toThrow(
        'Invalid session'
      );
      expect(sessionRepository._validateSession).toHaveBeenCalledWith(
        mockSession
      );
    });

    test('should save session to history and latest', async () => {
      const mockSession = { session_handover: { session_id: 'session-123' } };

      // Mock _validateSession method
      jest.spyOn(sessionRepository, '_validateSession').mockReturnValue(true);

      const result = await sessionRepository.saveSession(mockSession);

      expect(result).toBe(true);
      expect(mockDeps.storageService.writeJSON).toHaveBeenCalledTimes(2);
      expect(mockDeps.storageService.writeJSON).toHaveBeenCalledWith(
        'ai-context/sessions/session-history',
        'session-session-123.json',
        mockSession
      );
      expect(mockDeps.storageService.writeJSON).toHaveBeenCalledWith(
        'ai-context/sessions',
        'latest-session.json',
        mockSession
      );
    });

    test('should save session to history only if isLatest is false', async () => {
      const mockSession = { session_handover: { session_id: 'session-123' } };

      // Mock _validateSession method
      jest.spyOn(sessionRepository, '_validateSession').mockReturnValue(true);

      const result = await sessionRepository.saveSession(mockSession, false);

      expect(result).toBe(true);
      expect(mockDeps.storageService.writeJSON).toHaveBeenCalledTimes(1);
      expect(mockDeps.storageService.writeJSON).toHaveBeenCalledWith(
        'ai-context/sessions/session-history',
        'session-session-123.json',
        mockSession
      );
    });

    test('should handle error from storage service', async () => {
      const mockSession = { session_handover: { session_id: 'session-123' } };

      // Mock _validateSession method
      jest.spyOn(sessionRepository, '_validateSession').mockReturnValue(true);

      mockDeps.storageService.writeJSON.mockRejectedValue(
        new Error('Write error')
      );

      await expect(sessionRepository.saveSession(mockSession)).rejects.toThrow(
        'Failed to save session: Write error'
      );
    });
  });

  describe('createSessionFromGitCommits', () => {
    test('should create session from git commits', async () => {
      const latestSession = {
        session_handover: {
          project_id: 'knoa',
          session_id: 'session-123',
        },
      };

      const mockCommits = [
        {
          hash: 'commit-2',
          message: 'Commit 2 #T002',
          timestamp: '2025-03-22T11:00:00Z',
          related_tasks: ['T002'],
        },
        {
          hash: 'commit-1',
          message: 'Commit 1 #T001',
          timestamp: '2025-03-22T10:00:00Z',
          related_tasks: ['T001'],
        },
      ];

      const mockChangedFiles = [
        { path: 'file1.js', status: 'modified' },
        { path: 'file2.js', status: 'added' },
      ];

      const mockDiffStats = {
        files: [{ status: 'modified' }, { status: 'added' }],
        lines_added: 100,
        lines_deleted: 50,
      };

      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue(latestSession);
      mockDeps.gitService.getCommitsBetween.mockResolvedValue(mockCommits);
      mockDeps.gitService.getChangedFilesInCommit.mockResolvedValue(
        mockChangedFiles
      );
      mockDeps.gitService.getCommitDiffStats.mockResolvedValue(mockDiffStats);

      // Mock createNewSession method
      jest.spyOn(sessionRepository, 'createNewSession').mockResolvedValue({
        session_handover: {
          project_id: 'knoa',
          session_id: 'start-commit',
          previous_session_id: 'session-123',
          session_timestamp: '2025-03-22T12:00:00Z',
          session_start_timestamp: '2025-03-22T12:00:00Z',
          project_state_summary: {
            completed_tasks: [],
            current_tasks: [],
            pending_tasks: [],
            blocked_tasks: [],
          },
          key_artifacts: [],
          git_changes: {
            commits: [],
            summary: {
              files_added: 0,
              files_modified: 0,
              files_deleted: 0,
              lines_added: 0,
              lines_deleted: 0,
            },
          },
        },
      });

      const result = await sessionRepository.createSessionFromGitCommits(
        'start-commit',
        'end-commit',
        { forTest: true }
      );

      expect(result.session_handover.session_id).toBe('end-commit');
      expect(result.session_handover.git_changes.commits).toEqual(mockCommits);
      expect(result.session_handover.git_changes.summary).toEqual({
        files_added: 1,
        files_modified: 1,
        files_deleted: 0,
        lines_added: 100,
        lines_deleted: 50,
      });

      // セッションの開始時刻と終了時刻が設定されていることを確認
      expect(result.session_handover.session_start_timestamp).toBe(
        '2025-03-22T10:00:00Z'
      ); // 最初のコミットの時刻
      expect(result.session_handover.session_timestamp).toBe(
        '2025-03-22T11:00:00Z'
      ); // 最後のコミットの時刻

      // key_artifactsが設定されていることを確認
      expect(result.session_handover.key_artifacts).toHaveLength(2);
      expect(result.session_handover.key_artifacts[0].path).toBe('file1.js');
      expect(result.session_handover.key_artifacts[0].git_status).toBe(
        'modified'
      );
      expect(result.session_handover.key_artifacts[0].related_tasks).toEqual([
        'T002',
      ]);
    });

    test('should handle error when creating new session', async () => {
      // Mock createNewSession method to throw error
      jest
        .spyOn(sessionRepository, 'createNewSession')
        .mockRejectedValue(new Error('Create error'));

      await expect(
        sessionRepository.createSessionFromGitCommits(
          'start-commit',
          'end-commit'
        )
      ).rejects.toThrow(
        'Failed to create session from git commits: Create error'
      );
    });
  });

  describe('getSessionStateChanges', () => {
    test('should return state changes between sessions', async () => {
      const previousSession = {
        session_handover: {
          project_state_summary: {
            completed_tasks: ['T001'],
            current_tasks: ['T002'],
            pending_tasks: ['T003'],
            blocked_tasks: [],
          },
        },
      };

      const currentSession = {
        session_handover: {
          project_state_summary: {
            completed_tasks: ['T001', 'T002'],
            current_tasks: ['T004'],
            pending_tasks: ['T003'],
            blocked_tasks: [],
          },
        },
      };

      // Mock getSessionById method
      jest
        .spyOn(sessionRepository, 'getSessionById')
        .mockResolvedValueOnce(previousSession)
        .mockResolvedValueOnce(currentSession);

      const result = await sessionRepository.getSessionStateChanges(
        'prev-session',
        'curr-session'
      );

      expect(result.newlyCompletedTasks).toEqual(['T002']);
      expect(result.newlyAddedTasks).toEqual(['T004']);
      expect(result.changedStatusTasks).toEqual([
        {
          taskId: 'T002',
          previousStatus: 'in_progress',
          currentStatus: 'completed',
        },
        { taskId: 'T004', previousStatus: null, currentStatus: 'in_progress' },
      ]);
    });

    test('should throw NotFoundError if session not found', async () => {
      // Mock getSessionById method to return null
      jest
        .spyOn(sessionRepository, 'getSessionById')
        .mockResolvedValueOnce(null);

      await expect(
        sessionRepository.getSessionStateChanges('prev-session', 'curr-session')
      ).rejects.toThrow('Session not found');
    });
  });

  describe('_validateSession', () => {
    test('should validate session structure', () => {
      const validSession = {
        session_handover: {
          project_id: 'knoa',
          session_id: 'session-123',
          session_timestamp: '2025-03-22T12:00:00Z',
          project_state_summary: {
            completed_tasks: ['T001'],
            current_tasks: ['T002'],
            pending_tasks: ['T003'],
          },
          next_session_focus: 'Focus area',
        },
      };

      const result = sessionRepository._validateSession(validSession);

      expect(result).toBe(true);
    });

    test('should return false for invalid session structure', () => {
      const invalidSession = {
        // Missing session_handover
      };

      const result = sessionRepository._validateSession(invalidSession);

      expect(result).toBe(false);
    });

    test('should return false for missing required fields', () => {
      const invalidSession = {
        session_handover: {
          project_id: 'knoa',
          // Missing session_id
          session_timestamp: '2025-03-22T12:00:00Z',
          project_state_summary: {
            completed_tasks: ['T001'],
            current_tasks: ['T002'],
            pending_tasks: ['T003'],
          },
          next_session_focus: 'Focus area',
        },
      };

      const result = sessionRepository._validateSession(invalidSession);

      expect(result).toBe(false);
    });

    test('should return false for invalid task IDs', () => {
      const invalidSession = {
        session_handover: {
          project_id: 'knoa',
          session_id: 'session-123',
          session_timestamp: '2025-03-22T12:00:00Z',
          project_state_summary: {
            completed_tasks: ['T001'],
            current_tasks: ['invalid-task-id'], // Invalid format
            pending_tasks: ['T003'],
          },
          next_session_focus: 'Focus area',
        },
      };

      const result = sessionRepository._validateSession(invalidSession);

      expect(result).toBe(false);
    });
  });
});

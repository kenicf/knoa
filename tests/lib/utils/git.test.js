/**
 * Gitサービスのテスト (simple-git 使用版)
 */

const GitService = require('../../../src/lib/utils/git');
const { GitError } = require('../../../src/lib/utils/errors');
const {
  createMockLogger,
  createMockEventEmitter,
  mockTimestamp,
} = require('../../helpers/mock-factory');
const {
  expectStandardizedEventEmitted,
} = require('../../helpers/test-helpers');

// simple-git をモック化
const mockGit = {
  revparse: jest.fn(),
  log: jest.fn(),
  show: jest.fn(),
  branchLocal: jest.fn(),
  add: jest.fn(),
  commit: jest.fn(),
};
jest.mock('simple-git', () => {
  return jest.fn(() => mockGit);
});

describe('GitService (simple-git)', () => {
  let gitService;
  let mockLogger;
  let mockEventEmitter;
  let mockErrorHandler; // エラーハンドラモックを追加
  const MOCK_TIMESTAMP_ISO = '2025-03-24T00:00:00.000Z';

  beforeEach(() => {
    // Arrange (Common setup)
    jest.clearAllMocks();
    mockTimestamp(MOCK_TIMESTAMP_ISO);
    mockLogger = createMockLogger();
    mockEventEmitter = createMockEventEmitter();
    // エラーハンドラモックを作成 (エラーをそのままスローする)
    mockErrorHandler = {
      handle: jest.fn((err) => {
        throw err;
      }),
    };

    gitService = new GitService({
      repoPath: '/test/repo/path',
      logger: mockLogger,
      eventEmitter: mockEventEmitter,
      errorHandler: mockErrorHandler, // モックを渡す
    });
  });

  afterEach(() => {
    // Clean up mocks
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    test('should throw error if logger is not provided', () => {
      // Arrange & Act & Assert
      expect(() => new GitService({ eventEmitter: mockEventEmitter })).toThrow(
        'Logger instance is required'
      );
    });

    test('should set default values correctly if options are omitted', () => {
      // Arrange & Act
      const defaultGitService = new GitService({ logger: createMockLogger() }); // logger は必須

      // Assert
      expect(defaultGitService.repoPath).toBe(process.cwd());
      expect(defaultGitService.logger).toBeDefined();
      expect(defaultGitService.eventEmitter).toBeUndefined();
      expect(defaultGitService.errorHandler).toBeUndefined();
      expect(defaultGitService.taskIdPattern).toEqual(/#(T[0-9]{3})/g);
      expect(require('simple-git')).toHaveBeenCalledWith(process.cwd());
    });

    test('should initialize with custom values', () => {
      // Assert (Instance created in beforeEach)
      expect(gitService.repoPath).toBe('/test/repo/path');
      expect(gitService.logger).toBe(mockLogger);
      expect(gitService.eventEmitter).toBe(mockEventEmitter);
      expect(gitService.errorHandler).toBe(mockErrorHandler);
      expect(require('simple-git')).toHaveBeenCalledWith('/test/repo/path');
    });
  });

  test('should work without error if eventEmitter is not provided', async () => {
    // Arrange
    const gitServiceWithoutEmitter = new GitService({ logger: mockLogger }); // No eventEmitter
    const mockHash = 'abcdef1234567890';
    mockGit.revparse.mockResolvedValue(mockHash);

    // Act & Assert
    await expect(gitServiceWithoutEmitter.getCurrentCommitHash()).resolves.toBe(
      mockHash
    );
    // No assertion needed for eventEmitter calls as it's undefined
  });

  describe('getCurrentCommitHash', () => {
    test('should get the current commit hash', async () => {
      // Arrange
      const mockHash = 'abcdef1234567890';
      mockGit.revparse.mockResolvedValue(mockHash);

      // Act
      const result = await gitService.getCurrentCommitHash();

      // Assert
      expect(result).toBe(mockHash);
      expect(mockGit.revparse).toHaveBeenCalledWith(['HEAD']);
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_hash_before',
        { timestamp: 'any' }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_hash_after',
        { hash: mockHash, success: true, timestamp: 'any' }
      );
    });

    test('should throw GitError and call errorHandler if git command fails', async () => {
      // Arrange
      const error = new Error('Git revparse error');
      mockGit.revparse.mockRejectedValue(error);

      // Act & Assert
      await expect(gitService.getCurrentCommitHash()).rejects.toThrow(GitError);
      expect(mockGit.revparse).toHaveBeenCalledWith(['HEAD']);
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_hash_before',
        { timestamp: 'any' }
      );
      expectStandardizedEventEmitted(
        // after イベントも発行される
        mockEventEmitter,
        'git',
        'commit_get_hash_after',
        { success: false, error: error.message, timestamp: 'any' }
      );
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.any(GitError),
        'GitService',
        'getCurrentCommitHash',
        { operation: 'getCurrentCommitHash' }
      );
    });
  });

  describe('extractTaskIdsFromCommitMessage', () => {
    // test.each を個別のテストに分割
    test('should extract single task ID', () => {
      // Arrange
      const message = 'Fix bug #T001';
      // Act
      const result = gitService.extractTaskIdsFromCommitMessage(message);
      // Assert
      expect(result).toEqual(['T001']);
    });

    test('should extract multiple task IDs', () => {
      // Arrange
      const message = 'Fix bug #T001 and implement feature #T002';
      // Act
      const result = gitService.extractTaskIdsFromCommitMessage(message);
      // Assert
      expect(result).toEqual(['T001', 'T002']);
    });

    test('should return empty array if no task IDs found', () => {
      // Arrange
      const message = 'Fix bug and implement feature';
      // Act
      const result = gitService.extractTaskIdsFromCommitMessage(message);
      // Assert
      expect(result).toEqual([]);
    });

    test('should ignore invalid task ID format', () => {
      // Arrange
      const message = 'Invalid ID #TABC';
      // Act
      const result = gitService.extractTaskIdsFromCommitMessage(message);
      // Assert
      expect(result).toEqual([]);
    });

    test('should ignore task ID without hash', () => {
      // Arrange
      const message = 'No hash T001';
      // Act
      const result = gitService.extractTaskIdsFromCommitMessage(message);
      // Assert
      expect(result).toEqual([]);
    });

    test('should return empty array for empty message', () => {
      // Arrange
      const message = '';
      // Act
      const result = gitService.extractTaskIdsFromCommitMessage(message);
      // Assert
      expect(result).toEqual([]);
    });

    test('should return empty array for null message', () => {
      // Arrange
      const message = null;
      // Act
      const result = gitService.extractTaskIdsFromCommitMessage(message);
      // Assert
      expect(result).toEqual([]);
    });

    test('should return empty array for undefined message', () => {
      // Arrange
      const message = undefined;
      // Act
      const result = gitService.extractTaskIdsFromCommitMessage(message);
      // Assert
      expect(result).toEqual([]);
    });

    test('should throw GitError and call errorHandler if message.match throws', () => {
      // Arrange
      const invalidMessage = {
        // Simulate an object that causes .match to fail
        match: () => {
          throw new Error('Invalid message object');
        },
      };
      // Act & Assert
      expect(() =>
        gitService.extractTaskIdsFromCommitMessage(invalidMessage)
      ).toThrow(GitError);
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.any(GitError),
        'GitService',
        'extractTaskIdsFromCommitMessage',
        expect.objectContaining({ message: invalidMessage }) // context を具体的に
      );
    });
  });

  describe('getCommitsBetween', () => {
    test('should get commit information between two commits', async () => {
      // Arrange
      const mockLog = {
        all: [
          {
            hash: 'abc123',
            message: 'Fix bug #T001',
            date: '2025-03-20T10:00:00+09:00',
            author_name: 'User1',
          },
          {
            hash: 'def456',
            message: 'Implement feature #T002',
            date: '2025-03-21T11:00:00+09:00',
            author_name: 'User2',
          },
        ],
        latest: { hash: 'def456' },
        total: 2,
      };
      mockGit.log.mockResolvedValue(mockLog);
      const extractSpy = jest
        .spyOn(gitService, 'extractTaskIdsFromCommitMessage')
        .mockReturnValueOnce(['T001'])
        .mockReturnValueOnce(['T002']);
      const startCommit = 'start-commit';
      const endCommit = 'end-commit';

      // Act
      const result = await gitService.getCommitsBetween(startCommit, endCommit);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(
        expect.objectContaining({
          hash: 'abc123',
          message: 'Fix bug #T001',
          author: 'User1',
          related_tasks: ['T001'],
        })
      );
      expect(result[1]).toEqual(
        expect.objectContaining({
          hash: 'def456',
          message: 'Implement feature #T002',
          author: 'User2',
          related_tasks: ['T002'],
        })
      );
      expect(mockGit.log).toHaveBeenCalledWith({
        from: startCommit,
        to: endCommit,
        format: { hash: '%H', message: '%s', date: '%ad', author_name: '%an' },
        '--date': 'iso',
      });
      expect(extractSpy).toHaveBeenCalledTimes(2);
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_between_before',
        { startCommit, endCommit, timestamp: 'any' }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_between_after',
        {
          startCommit,
          endCommit,
          commits: result,
          success: true,
          timestamp: 'any',
        }
      );
    });

    test('should return empty array if no commits found', async () => {
      // Arrange
      const mockLog = { all: [], latest: null, total: 0 };
      mockGit.log.mockResolvedValue(mockLog);
      const startCommit = 'start-commit';
      const endCommit = 'end-commit';

      // Act
      const result = await gitService.getCommitsBetween(startCommit, endCommit);

      // Assert
      expect(result).toEqual([]);
      expect(mockGit.log).toHaveBeenCalledWith(
        expect.objectContaining({ from: startCommit, to: endCommit })
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_between_after',
        { startCommit, endCommit, commits: [], success: true, timestamp: 'any' }
      );
    });

    test('should throw GitError and call errorHandler if git command fails', async () => {
      // Arrange
      const error = new Error('Git log error');
      mockGit.log.mockRejectedValue(error);
      const startCommit = 'start';
      const endCommit = 'end';

      // Act & Assert
      await expect(
        gitService.getCommitsBetween(startCommit, endCommit)
      ).rejects.toThrow(GitError);
      expect(mockGit.log).toHaveBeenCalled();
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_between_before',
        { startCommit, endCommit, timestamp: 'any' }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_between_after',
        {
          startCommit,
          endCommit,
          success: false,
          error: error.message,
          timestamp: 'any',
        }
      );
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.any(GitError),
        'GitService',
        'getCommitsBetween',
        expect.objectContaining({ startCommit, endCommit })
      );
    });
  });

  describe('getChangedFilesInCommit', () => {
    test('should get changed files in a commit', async () => {
      // Arrange
      const commitHash = 'commit-hash';
      const mockOutput =
        'A\tfile1.txt\nM\tfile2.js\nD\tfile3.md\nR100\told-file.txt\tnew-file.txt';
      mockGit.show.mockResolvedValue(mockOutput);
      const expectedFiles = [
        { status: 'added', path: 'file1.txt' },
        { status: 'modified', path: 'file2.js' },
        { status: 'deleted', path: 'file3.md' },
        { status: 'renamed', path: 'new-file.txt' },
      ];

      // Act
      const result = await gitService.getChangedFilesInCommit(commitHash);

      // Assert
      expect(result).toEqual(expectedFiles);
      expect(mockGit.show).toHaveBeenCalledWith([
        commitHash,
        '--name-status',
        '--format=',
      ]);
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_changed_files_before',
        { commitHash, timestamp: 'any' }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_changed_files_after',
        { commitHash, files: expectedFiles, success: true, timestamp: 'any' }
      );
    });

    test('should return empty array if no files changed', async () => {
      // Arrange
      const commitHash = 'commit-hash';
      mockGit.show.mockResolvedValue('');
      // Act
      const result = await gitService.getChangedFilesInCommit(commitHash);
      // Assert
      expect(result).toEqual([]);
      expect(mockGit.show).toHaveBeenCalledWith([
        commitHash,
        '--name-status',
        '--format=',
      ]);
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_changed_files_after',
        { commitHash, files: [], success: true, timestamp: 'any' }
      );
    });

    test('should throw GitError and call errorHandler if git command fails', async () => {
      // Arrange
      const commitHash = 'hash';
      const error = new Error('Git show error');
      mockGit.show.mockRejectedValue(error);

      // Act & Assert
      await expect(
        gitService.getChangedFilesInCommit(commitHash)
      ).rejects.toThrow(GitError);
      expect(mockGit.show).toHaveBeenCalled();
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_changed_files_before',
        { commitHash, timestamp: 'any' }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_changed_files_after',
        { commitHash, success: false, error: error.message, timestamp: 'any' }
      );
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.any(GitError),
        'GitService',
        'getChangedFilesInCommit',
        expect.objectContaining({ commitHash })
      );
    });

    test('should handle copied and unknown statuses correctly', async () => {
      // Arrange
      const commitHash = 'commit-hash';
      const mockOutput = 'C100\tsrc/a.txt\tdst/a.txt\nX\tunknown.file';
      mockGit.show.mockResolvedValue(mockOutput);
      const expectedFiles = [
        { status: 'copied', path: 'dst/a.txt' },
        { status: 'X', path: 'unknown.file' },
      ];

      // Act
      const result = await gitService.getChangedFilesInCommit(commitHash);

      // Assert
      expect(result).toEqual(expectedFiles);
      expect(mockGit.show).toHaveBeenCalledWith([
        commitHash,
        '--name-status',
        '--format=',
      ]);
    });
  });

  describe('getCommitDiffStats', () => {
    test('should get commit diff statistics', async () => {
      // Arrange
      const commitHash = 'commit-hash';
      const mockFiles = [
        { status: 'added', path: 'file1.txt' },
        { status: 'modified', path: 'file2.js' },
      ];
      const mockNumstatOutput = '10\t5\tfile1.txt\n20\t10\tfile2.js';
      jest
        .spyOn(gitService, 'getChangedFilesInCommit')
        .mockResolvedValue(mockFiles);
      mockGit.show.mockResolvedValue(mockNumstatOutput);
      const expectedStats = {
        files: mockFiles,
        lines_added: 30,
        lines_deleted: 15,
      };

      // Act
      const result = await gitService.getCommitDiffStats(commitHash);

      // Assert
      expect(result).toEqual(expectedStats);
      expect(gitService.getChangedFilesInCommit).toHaveBeenCalledWith(
        commitHash
      );
      expect(mockGit.show).toHaveBeenCalledWith([
        commitHash,
        '--numstat',
        '--format=',
      ]);
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_diff_stats_before',
        { commitHash, timestamp: 'any' }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_diff_stats_after',
        { commitHash, stats: expectedStats, success: true, timestamp: 'any' }
      );
    });

    test('should handle binary files correctly', async () => {
      // Arrange
      const commitHash = 'commit-hash';
      const mockFiles = [
        { status: 'added', path: 'file1.txt' },
        { status: 'added', path: 'image.png' },
      ];
      const mockNumstatOutput = '10\t5\tfile1.txt\n-\t-\timage.png';
      jest
        .spyOn(gitService, 'getChangedFilesInCommit')
        .mockResolvedValue(mockFiles);
      mockGit.show.mockResolvedValue(mockNumstatOutput);
      const expectedStats = {
        files: mockFiles,
        lines_added: 10,
        lines_deleted: 5,
      };

      // Act
      const result = await gitService.getCommitDiffStats(commitHash);

      // Assert
      expect(result).toEqual(expectedStats);
      expect(mockGit.show).toHaveBeenCalledWith([
        commitHash,
        '--numstat',
        '--format=',
      ]);
    });

    test('should throw GitError and call errorHandler if git command fails', async () => {
      // Arrange
      const commitHash = 'hash';
      const error = new Error('Git show numstat error');
      jest.spyOn(gitService, 'getChangedFilesInCommit').mockResolvedValue([]);
      mockGit.show.mockRejectedValue(error);

      // Act & Assert
      await expect(gitService.getCommitDiffStats(commitHash)).rejects.toThrow(
        GitError
      );
      expect(gitService.getChangedFilesInCommit).toHaveBeenCalledWith(
        commitHash
      );
      expect(mockGit.show).toHaveBeenCalledWith([
        commitHash,
        '--numstat',
        '--format=',
      ]);
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_diff_stats_before',
        { commitHash, timestamp: 'any' }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_diff_stats_after',
        { commitHash, success: false, error: error.message, timestamp: 'any' }
      );
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.any(GitError),
        'GitService',
        'getCommitDiffStats',
        expect.objectContaining({ commitHash })
      );
    });
  });

  describe('getBranches', () => {
    test('should get list of branches', async () => {
      // Arrange
      const mockBranchSummary = {
        all: ['main', 'develop', 'feature/test'],
        current: 'main',
      };
      mockGit.branchLocal.mockResolvedValue(mockBranchSummary);
      const expectedBranches = ['main', 'develop', 'feature/test'];

      // Act
      const result = await gitService.getBranches();

      // Assert
      expect(result).toEqual(expectedBranches);
      expect(mockGit.branchLocal).toHaveBeenCalled();
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'branch_get_all_before',
        { timestamp: 'any' }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'branch_get_all_after',
        { branches: expectedBranches, success: true, timestamp: 'any' }
      );
    });

    test('should return empty array if no branches found', async () => {
      // Arrange
      const mockBranchSummary = { all: [], current: '' };
      mockGit.branchLocal.mockResolvedValue(mockBranchSummary);
      // Act
      const result = await gitService.getBranches();
      // Assert
      expect(result).toEqual([]);
      expect(mockGit.branchLocal).toHaveBeenCalled();
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'branch_get_all_after',
        { branches: [], success: true, timestamp: 'any' }
      );
    });

    test('should throw GitError and call errorHandler if git command fails', async () => {
      // Arrange
      const error = new Error('Git branch error');
      mockGit.branchLocal.mockRejectedValue(error);

      // Act & Assert
      await expect(gitService.getBranches()).rejects.toThrow(GitError);
      expect(mockGit.branchLocal).toHaveBeenCalled();
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'branch_get_all_before',
        { timestamp: 'any' }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'branch_get_all_after',
        { success: false, error: error.message, timestamp: 'any' }
      );
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.any(GitError),
        'GitService',
        'getBranches',
        expect.any(Object)
      );
    });
  });

  describe('getCurrentBranch', () => {
    test('should get the current branch', async () => {
      // Arrange
      const mockBranchSummary = { all: ['main', 'develop'], current: 'main' };
      mockGit.branchLocal.mockResolvedValue(mockBranchSummary);

      // Act
      const result = await gitService.getCurrentBranch();

      // Assert
      expect(result).toBe('main');
      expect(mockGit.branchLocal).toHaveBeenCalled();
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'branch_get_current_before',
        { timestamp: 'any' }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'branch_get_current_after',
        { branch: 'main', success: true, timestamp: 'any' }
      );
    });

    test('should throw GitError and call errorHandler if git command fails', async () => {
      // Arrange
      const error = new Error('Git branch current error');
      mockGit.branchLocal.mockRejectedValue(error);

      // Act & Assert
      await expect(gitService.getCurrentBranch()).rejects.toThrow(GitError);
      expect(mockGit.branchLocal).toHaveBeenCalled();
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'branch_get_current_before',
        { timestamp: 'any' }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'branch_get_current_after',
        { success: false, error: error.message, timestamp: 'any' }
      );
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.any(GitError),
        'GitService',
        'getCurrentBranch',
        expect.any(Object)
      );
    });
  });

  describe('getCommitHistory', () => {
    test('should get commit history', async () => {
      // Arrange
      const mockLog = {
        all: [
          {
            hash: 'abc123',
            message: 'Fix bug #T001',
            date: '2025-03-20T10:00:00+09:00',
            author_name: 'User1',
          },
          {
            hash: 'def456',
            message: 'Implement feature #T002',
            date: '2025-03-21T11:00:00+09:00',
            author_name: 'User2',
          },
        ],
        latest: { hash: 'def456' },
        total: 2,
      };
      mockGit.log.mockResolvedValue(mockLog);
      const extractSpy = jest
        .spyOn(gitService, 'extractTaskIdsFromCommitMessage')
        .mockReturnValueOnce(['T001'])
        .mockReturnValueOnce(['T002']);
      const limit = 2;

      // Act
      const result = await gitService.getCommitHistory(limit);

      // Assert
      expect(result).toHaveLength(limit);
      expect(result[0]).toEqual(
        expect.objectContaining({
          hash: 'abc123',
          message: 'Fix bug #T001',
          author: 'User1',
          related_tasks: ['T001'],
        })
      );
      expect(result[1]).toEqual(
        expect.objectContaining({
          hash: 'def456',
          message: 'Implement feature #T002',
          author: 'User2',
          related_tasks: ['T002'],
        })
      );
      expect(mockGit.log).toHaveBeenCalledWith({
        n: limit,
        format: expect.any(Object),
        '--date': 'iso',
      });
      expect(extractSpy).toHaveBeenCalledTimes(limit);
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_history_before',
        { limit, timestamp: 'any' }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_history_after',
        { limit, commits: result, success: true, timestamp: 'any' }
      );
    });

    test('should use default limit if not provided', async () => {
      // Arrange
      const mockLog = { all: [], latest: null, total: 0 };
      mockGit.log.mockResolvedValue(mockLog);
      // Act
      await gitService.getCommitHistory();
      // Assert
      expect(mockGit.log).toHaveBeenCalledWith(
        expect.objectContaining({ n: 10 })
      );
    });

    test('should use default limit if invalid limit provided', async () => {
      // Arrange
      const mockLog = { all: [], latest: null, total: 0 };
      mockGit.log.mockResolvedValue(mockLog);
      // Act
      await gitService.getCommitHistory(-1); // Invalid limit
      // Assert
      expect(mockGit.log).toHaveBeenCalledWith(
        expect.objectContaining({ n: 10 })
      );
    });

    test('should throw GitError and call errorHandler if git command fails', async () => {
      // Arrange
      const error = new Error('Git log history error');
      mockGit.log.mockRejectedValue(error);
      const limit = 5;

      // Act & Assert
      await expect(gitService.getCommitHistory(limit)).rejects.toThrow(
        GitError
      );
      expect(mockGit.log).toHaveBeenCalled();
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_history_before',
        { limit, timestamp: 'any' }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_history_after',
        { limit, success: false, error: error.message, timestamp: 'any' }
      );
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.any(GitError),
        'GitService',
        'getCommitHistory',
        expect.objectContaining({ limit })
      );
    });
  });

  describe('getFileHistory', () => {
    const filePath = 'path/to/file.js';
    test('should get file history', async () => {
      // Arrange
      const mockLog = {
        all: [
          {
            hash: 'abc123',
            message: 'Fix bug #T001',
            date: '2025-03-20T10:00:00+09:00',
            author_name: 'User1',
          },
        ],
        latest: { hash: 'abc123' },
        total: 1,
      };
      mockGit.log.mockResolvedValue(mockLog);
      const extractSpy = jest
        .spyOn(gitService, 'extractTaskIdsFromCommitMessage')
        .mockReturnValue(['T001']);
      const limit = 1;

      // Act
      const result = await gitService.getFileHistory(filePath, limit);

      // Assert
      expect(result).toHaveLength(limit);
      expect(result[0]).toEqual(
        expect.objectContaining({
          hash: 'abc123',
          message: 'Fix bug #T001',
          author: 'User1',
          related_tasks: ['T001'],
        })
      );
      expect(mockGit.log).toHaveBeenCalledWith({
        file: filePath,
        n: limit,
        format: expect.any(Object),
        '--date': 'iso',
      });
      expect(extractSpy).toHaveBeenCalledTimes(limit);
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'file_get_history_before',
        { filePath, limit, timestamp: 'any' }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'file_get_history_after',
        { filePath, limit, commits: result, success: true, timestamp: 'any' }
      );
    });

    test('should return empty array if no history found', async () => {
      // Arrange
      const mockLog = { all: [], latest: null, total: 0 };
      mockGit.log.mockResolvedValue(mockLog);
      // Act
      const result = await gitService.getFileHistory(filePath);
      // Assert
      expect(result).toEqual([]);
      expect(mockGit.log).toHaveBeenCalledWith(
        expect.objectContaining({ file: filePath, n: 10 })
      ); // Default limit
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'file_get_history_after',
        { filePath, limit: 10, commits: [], success: true, timestamp: 'any' }
      );
    });

    test('should throw GitError and call errorHandler if git command fails', async () => {
      // Arrange
      const error = new Error('Git log file error');
      mockGit.log.mockRejectedValue(error);
      const limit = 10; // Default limit

      // Act & Assert
      await expect(gitService.getFileHistory(filePath)).rejects.toThrow(
        GitError
      );
      expect(mockGit.log).toHaveBeenCalled();
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'file_get_history_before',
        { filePath, limit, timestamp: 'any' }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'file_get_history_after',
        {
          filePath,
          limit,
          success: false,
          error: error.message,
          timestamp: 'any',
        }
      );
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.any(GitError),
        'GitService',
        'getFileHistory',
        expect.objectContaining({ filePath, limit })
      );
    });
  });

  describe('getCommitDetails', () => {
    test('should get commit details', async () => {
      // Arrange
      const commitHash = 'abc123';
      const mockLog = {
        latest: {
          hash: commitHash,
          message: 'Commit message #T001\n',
          author_name: 'User1',
          author_email: 'u1@e.com',
          author_date: 'd1',
          committer_name: 'C1',
          committer_email: 'c1@e.com',
          committer_date: 'd2',
          parents: 'p1 p2',
        },
        all: [],
        total: 1,
      };
      const mockStats = {
        files: [{ status: 'A', path: 'f.txt' }],
        lines_added: 10,
        lines_deleted: 5,
      };
      mockGit.log.mockResolvedValue(mockLog);
      jest.spyOn(gitService, 'getCommitDiffStats').mockResolvedValue(mockStats);
      const extractSpy = jest
        .spyOn(gitService, 'extractTaskIdsFromCommitMessage')
        .mockReturnValue(['T001']);
      const expectedDetails = {
        hash: commitHash,
        message: 'Commit message #T001',
        author: { name: 'User1', email: 'u1@e.com', date: 'd1' },
        committer: { name: 'C1', email: 'c1@e.com', date: 'd2' },
        parents: ['p1', 'p2'],
        files: mockStats.files,
        stats: { lines_added: 10, lines_deleted: 5, files_changed: 1 },
        related_tasks: ['T001'],
      };

      // Act
      const result = await gitService.getCommitDetails(commitHash);

      // Assert
      expect(result).toEqual(expectedDetails);
      expect(mockGit.log).toHaveBeenCalledWith({
        format: expect.any(Object),
        n: 1,
        [commitHash]: null,
      });
      expect(gitService.getCommitDiffStats).toHaveBeenCalledWith(commitHash);
      expect(extractSpy).toHaveBeenCalledWith('Commit message #T001\n');
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_details_before',
        { commitHash, timestamp: 'any' }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_details_after',
        {
          commitHash,
          details: expectedDetails,
          success: true,
          timestamp: 'any',
        }
      );
    });

    test('should throw GitError if commit not found', async () => {
      // Arrange
      const commitHash = 'unknown-hash';
      const mockLog = { latest: null, all: [], total: 0 };
      mockGit.log.mockResolvedValue(mockLog);

      // Act & Assert
      await expect(gitService.getCommitDetails(commitHash)).rejects.toThrow(
        GitError
      );
      expect(mockGit.log).toHaveBeenCalled();
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_details_before',
        { commitHash, timestamp: 'any' }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_details_after',
        {
          commitHash,
          details: null,
          success: false,
          error: 'Commit info not found',
          timestamp: 'any',
        }
      );
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.any(GitError),
        'GitService',
        'getCommitDetails',
        expect.objectContaining({ commitHash })
      );
    });

    test('should throw GitError and call errorHandler if git log fails', async () => {
      // Arrange
      const commitHash = 'hash';
      const error = new Error('Git log details error');
      mockGit.log.mockRejectedValue(error);

      // Act & Assert
      await expect(gitService.getCommitDetails(commitHash)).rejects.toThrow(
        GitError
      );
      expect(mockGit.log).toHaveBeenCalled();
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_details_before',
        { commitHash, timestamp: 'any' }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_details_after',
        { commitHash, success: false, error: error.message, timestamp: 'any' }
      );
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.any(GitError),
        'GitService',
        'getCommitDetails',
        expect.objectContaining({ commitHash })
      );
    });

    test('should throw GitError and call errorHandler if getCommitDiffStats fails', async () => {
      // Arrange
      const commitHash = 'abc123';
      const mockLog = {
        latest: {
          hash: commitHash,
          message: 'Msg',
          author_name: 'A',
          author_email: 'a@e',
          author_date: 'd',
          committer_name: 'C',
          committer_email: 'c@e',
          committer_date: 'd',
          parents: '',
        },
        all: [],
        total: 1,
      };
      mockGit.log.mockResolvedValue(mockLog);
      const error = new Error('Diff stats error');
      jest.spyOn(gitService, 'getCommitDiffStats').mockRejectedValue(error); // Simulate failure

      // Act & Assert
      await expect(gitService.getCommitDetails(commitHash)).rejects.toThrow(
        GitError
      );
      expect(gitService.getCommitDiffStats).toHaveBeenCalledWith(commitHash);
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_get_details_before',
        { commitHash, timestamp: 'any' }
      );
      // After event might not be emitted if getCommitDiffStats fails early, or might have diff stats error
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.any(GitError),
        'GitService',
        'getCommitDetails',
        expect.objectContaining({ commitHash })
      );
    });
  });

  describe('stageFiles', () => {
    test('should stage files', async () => {
      // Arrange
      const files = ['file1.txt', 'file2.js'];
      mockGit.add.mockResolvedValue(undefined);
      // Act
      const result = await gitService.stageFiles(files);
      // Assert
      expect(result).toBe(true);
      expect(mockGit.add).toHaveBeenCalledWith(files);
      expectStandardizedEventEmitted(mockEventEmitter, 'git', 'stage_before', {
        files,
        timestamp: 'any',
      });
      expectStandardizedEventEmitted(mockEventEmitter, 'git', 'stage_after', {
        files,
        success: true,
        timestamp: 'any',
      });
    });

    test('should throw GitError and call errorHandler if git command fails', async () => {
      // Arrange
      const files = 'file.txt';
      const error = new Error('Git add error');
      mockGit.add.mockRejectedValue(error);

      // Act & Assert
      await expect(gitService.stageFiles(files)).rejects.toThrow(GitError);
      expect(mockGit.add).toHaveBeenCalledWith(files);
      expectStandardizedEventEmitted(mockEventEmitter, 'git', 'stage_before', {
        files,
        timestamp: 'any',
      });
      expectStandardizedEventEmitted(mockEventEmitter, 'git', 'stage_after', {
        files,
        success: false,
        error: error.message,
        timestamp: 'any',
      });
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.any(GitError),
        'GitService',
        'stageFiles',
        expect.objectContaining({ files })
      );
    });
  });

  describe('createCommit', () => {
    test('should create a commit', async () => {
      // Arrange
      const message = 'Test commit message';
      const mockCommitSummary = { commit: 'new-commit-hash' };
      mockGit.commit.mockResolvedValue(mockCommitSummary);

      // Act
      const result = await gitService.createCommit(message);

      // Assert
      expect(result).toBe('new-commit-hash');
      expect(mockGit.commit).toHaveBeenCalledWith(message);
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_create_before',
        { message, timestamp: 'any' }
      );
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_create_after',
        { message, hash: 'new-commit-hash', success: true, timestamp: 'any' }
      );
    });

    test('should throw GitError if commit message is empty', async () => {
      // Arrange
      const message = '';
      // Act & Assert
      await expect(gitService.createCommit(message)).rejects.toThrow(GitError);
      expect(mockGit.commit).not.toHaveBeenCalled();
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_create_after',
        {
          message,
          success: false,
          error: 'コミットメッセージが空です',
          timestamp: 'any',
        }
      );
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.any(GitError),
        'GitService',
        'createCommit',
        expect.objectContaining({ message })
      );
    });

    test('should throw GitError if commit message is whitespace only', async () => {
      // Arrange
      const message = '   ';
      // Act & Assert
      await expect(gitService.createCommit(message)).rejects.toThrow(GitError);
      expect(mockGit.commit).not.toHaveBeenCalled();
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_create_after',
        {
          message,
          success: false,
          error: 'コミットメッセージが空です',
          timestamp: 'any',
        }
      );
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.any(GitError),
        'GitService',
        'createCommit',
        expect.objectContaining({ message })
      );
    });

    test('should throw GitError and call errorHandler if git command fails', async () => {
      // Arrange
      const message = 'message';
      const error = new Error('Git commit error');
      mockGit.commit.mockRejectedValue(error);

      // Act & Assert
      await expect(gitService.createCommit(message)).rejects.toThrow(GitError);
      expect(mockGit.commit).toHaveBeenCalledWith(message);
      expectStandardizedEventEmitted(
        mockEventEmitter,
        'git',
        'commit_create_before',
        { message, timestamp: 'any' }
      );
      // エラー時の after イベントは _handleError 内で発行される想定だが、errorHandler がエラーを再スローするため、ここでは検証しない
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.any(GitError),
        'GitService',
        'createCommit',
        expect.objectContaining({ message })
      );
    });
  });

  describe('_emitEvent (Error Handling)', () => {
    // 内部メソッドのエラーハンドリングテスト
    test('should log warning if event emission fails (e.g., ID generator error)', async () => {
      // Arrange
      const emitError = new Error('ID generation failed');
      // IDジェネレーターがエラーをスローするようにモック
      const faultyGitService = new GitService({
        repoPath: '/test/repo/path',
        logger: mockLogger,
        eventEmitter: mockEventEmitter,
        errorHandler: mockErrorHandler,
        traceIdGenerator: jest.fn().mockImplementation(() => {
          throw emitError;
        }), // エラーをスロー
        requestIdGenerator: jest.fn().mockReturnValue('req-id'),
      });
      mockGit.revparse.mockResolvedValue('some-hash'); // メイン処理は成功させる

      // Act
      await faultyGitService.getCurrentCommitHash(); // _emitEvent を呼び出すメソッドを実行

      // Assert
      // _emitEvent 内でエラーがキャッチされ、warn ログが出力されることを確認
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `イベント発行中にエラーが発生しました: git:commit_get_hash_before`, // before イベントでエラー発生
        emitError
      );
      // メインの処理 (revparse) は成功し、after イベントの発行も試みられるはず
      expect(mockGit.revparse).toHaveBeenCalled();
      // after イベントの発行も失敗するはず (同じ ID ジェネレーターエラーのため)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `イベント発行中にエラーが発生しました: git:commit_get_hash_after`,
        emitError
      );
      // エラーハンドラは呼ばれない（メイン処理は成功しているため）
      expect(mockErrorHandler.handle).not.toHaveBeenCalled();
    });
  });
});

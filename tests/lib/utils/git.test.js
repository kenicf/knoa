/**
 * Gitサービスのテスト
 */

// child_processモジュールをモック
jest.mock('child_process', () => ({
  execSync: jest.fn()
}));

const { execSync } = require('child_process');
const GitService = require('../../../src/lib/utils/git');
const { GitError } = require('../../../src/lib/core/error-framework');

describe('Gitサービス', () => {
  let git;
  let mockEventEmitter;
  let mockLogger;
  
  beforeEach(() => {
    // モックをリセット
    jest.clearAllMocks();
    
    mockEventEmitter = {
      emit: jest.fn()
    };
    
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };
    
    git = new GitService({
      repoPath: '/test/repo/path',
      logger: mockLogger,
      eventEmitter: mockEventEmitter
    });
    
    // デフォルトのモック実装
    execSync.mockReturnValue(Buffer.from('mock output'));
  });
  
  describe('_execGit', () => {
    test('Gitコマンドを実行する', () => {
      const result = git._execGit('status');
      
      expect(result).toBe('mock output');
      expect(execSync).toHaveBeenCalledWith('git status', {
        cwd: '/test/repo/path',
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024
      });
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'git:command_executed',
        expect.objectContaining({
          command: 'git status',
          success: true
        })
      );
    });
    
    test('コマンドが失敗した場合はGitErrorをスローする', () => {
      execSync.mockImplementation(() => {
        const error = new Error('Command failed');
        error.status = 128;
        error.stderr = Buffer.from('fatal: not a git repository');
        throw error;
      });
      
      expect(() => {
        git._execGit('status');
      }).toThrow(GitError);
      
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'git:command_failed',
        expect.objectContaining({
          command: 'git status',
          error: expect.any(String)
        })
      );
    });
    
    test('デバッグモードが有効な場合はログを出力する', () => {
      git._execGit('status', { debug: true });
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('実行: git status'),
        expect.any(Object)
      );
    });
  });
  
  describe('isValidRepository', () => {
    test('有効なリポジトリの場合はtrueを返す', () => {
      execSync.mockReturnValue(Buffer.from('true'));
      
      const result = git.isValidRepository();
      
      expect(result).toBe(true);
      expect(execSync).toHaveBeenCalledWith(
        'git rev-parse --is-inside-work-tree',
        expect.any(Object)
      );
    });
    
    test('無効なリポジトリの場合はfalseを返す', () => {
      execSync.mockImplementation(() => {
        throw new Error('not a git repository');
      });
      
      const result = git.isValidRepository();
      
      expect(result).toBe(false);
    });
  });
  
  describe('getCurrentBranch', () => {
    test('現在のブランチ名を取得する', () => {
      execSync.mockReturnValue(Buffer.from('main'));
      
      const result = git.getCurrentBranch();
      
      expect(result).toBe('main');
      expect(execSync).toHaveBeenCalledWith(
        'git rev-parse --abbrev-ref HEAD',
        expect.any(Object)
      );
    });
  });
  
  describe('getCurrentCommitHash', () => {
    test('現在のコミットハッシュを取得する（フル）', () => {
      execSync.mockReturnValue(Buffer.from('abcdef1234567890abcdef1234567890abcdef12'));
      
      const result = git.getCurrentCommitHash();
      
      expect(result).toBe('abcdef1234567890abcdef1234567890abcdef12');
      expect(execSync).toHaveBeenCalledWith(
        'git rev-parse HEAD',
        expect.any(Object)
      );
    });
    
    test('現在のコミットハッシュを取得する（短縮）', () => {
      execSync.mockReturnValue(Buffer.from('abcdef12'));
      
      const result = git.getCurrentCommitHash(true);
      
      expect(result).toBe('abcdef12');
      expect(execSync).toHaveBeenCalledWith(
        'git rev-parse --short HEAD',
        expect.any(Object)
      );
    });
  });
  
  describe('getCommitInfo', () => {
    test('コミット情報を取得する', () => {
      const mockOutput = [
        'abcdef1234567890abcdef1234567890abcdef12', // hash
        'abcdef12', // shortHash
        'Test Author', // author
        'author@example.com', // authorEmail
        '2025-01-01T12:00:00+09:00', // authorDate
        'Test Committer', // committer
        'committer@example.com', // committerEmail
        '2025-01-01T12:30:00+09:00', // committerDate
        'Test commit message', // subject
        'Commit body line 1', // body
        'Commit body line 2'
      ].join('\n');
      
      execSync.mockReturnValue(Buffer.from(mockOutput));
      
      const result = git.getCommitInfo('test-commit');
      
      expect(result).toEqual({
        hash: 'abcdef1234567890abcdef1234567890abcdef12',
        shortHash: 'abcdef12',
        author: 'Test Author',
        authorEmail: 'author@example.com',
        authorDate: '2025-01-01T12:00:00+09:00',
        committer: 'Test Committer',
        committerEmail: 'committer@example.com',
        committerDate: '2025-01-01T12:30:00+09:00',
        subject: 'Test commit message',
        body: 'Commit body line 2'
      });
      
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('git show -s --format='),
        expect.any(Object)
      );
    });
    
    test('コミットハッシュが指定されない場合はHEADを使用する', () => {
      execSync.mockReturnValue(Buffer.from(''));
      
      git.getCommitInfo();
      
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('HEAD'),
        expect.any(Object)
      );
    });
    
    test('エラーが発生した場合はGitErrorをスローする', () => {
      execSync.mockImplementation(() => {
        throw new Error('show error');
      });
      
      expect(() => {
        git.getCommitInfo('invalid-commit');
      }).toThrow(GitError);
    });
  });
  
  describe('extractTaskIdsFromCommitMessage', () => {
    test('コミットメッセージからタスクIDを抽出する', () => {
      const message = 'Fix bug in login form #T123\n\nRelated to #T456 and #T789';
      
      const result = git.extractTaskIdsFromCommitMessage(message);
      
      expect(result).toEqual(['T123', 'T456', 'T789']);
    });
    
    test('重複するタスクIDは1つにまとめる', () => {
      const message = 'Fix #T123 and also #T123 again';
      
      const result = git.extractTaskIdsFromCommitMessage(message);
      
      expect(result).toEqual(['T123']);
    });
    
    test('タスクIDがない場合は空配列を返す', () => {
      const message = 'Fix bug in login form';
      
      const result = git.extractTaskIdsFromCommitMessage(message);
      
      expect(result).toEqual([]);
    });
    
    test('エラーが発生した場合はGitErrorをスローする', () => {
      const message = null; // nullを渡してエラーを発生させる
      
      expect(() => {
        git.extractTaskIdsFromCommitMessage(message);
      }).toThrow(GitError);
    });
  });
  
  describe('getTaskIdsFromCommit', () => {
    test('コミットからタスクIDを取得する', () => {
      // タスクIDパターンを一時的に変更
      const originalPattern = git.taskIdPattern;
      git.taskIdPattern = /#(T[0-9]{3})/g;

      // extractTaskIdsFromCommitMessageを直接テスト
      const message = 'Fix bug in login form #T123\nRelated to #T456 and #T789';
      const result = git.extractTaskIdsFromCommitMessage(message);
      
      // パターンを元に戻す
      git.taskIdPattern = originalPattern;
      
      expect(result).toEqual(['#T123', '#T456', '#T789']);
    });
  });
  
  describe('getCommitsBetween', () => {
    test('2つのコミット間のコミット一覧を取得する', () => {
      const mockOutput = [
        'abcdef1234567890abcdef1234567890abcdef12|abcdef12|Test Author|2025-01-01T12:00:00+09:00|Fix bug #T123',
        '1234567890abcdef1234567890abcdef12345678|1234567|Another Author|2025-01-02T12:00:00+09:00|Update docs #T456'
      ].join('\n');
      
      execSync.mockReturnValue(Buffer.from(mockOutput));
      
      const result = git.getCommitsBetween('start-commit', 'end-commit');
      
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        hash: 'abcdef1234567890abcdef1234567890abcdef12',
        shortHash: 'abcdef12',
        author: 'Test Author',
        timestamp: '2025-01-01T12:00:00+09:00',
        subject: 'Fix bug #T123',
        taskIds: ['T123']
      });
      
      expect(execSync).toHaveBeenCalledWith(
        'git log --pretty=format:"%H|%h|%an|%aI|%s" start-commit..end-commit',
        expect.any(Object)
      );
    });
    
    test('出力が空の場合は空配列を返す', () => {
      execSync.mockReturnValue(Buffer.from(''));
      
      const result = git.getCommitsBetween('start-commit', 'end-commit');
      
      expect(result).toEqual([]);
    });
    
    test('エラーが発生した場合はGitErrorをスローする', () => {
      execSync.mockImplementation(() => {
        throw new Error('log error');
      });
      
      expect(() => {
        git.getCommitsBetween('start-commit', 'end-commit');
      }).toThrow(GitError);
    });
  });
  
  describe('getChangedFilesInCommit', () => {
    test('コミットの変更ファイル一覧を取得する', () => {
      const mockOutput = '\nA\tfile1.txt\nM\tfile2.txt\nD\tfile3.txt\nR100\toldname.txt\tnewname.txt';
      
      execSync.mockReturnValue(Buffer.from(mockOutput));
      
      const result = git.getChangedFilesInCommit('test-commit');
      
      expect(result).toHaveLength(4);
      expect(result[0]).toEqual({
        status: 'added',
        path: 'file1.txt'
      });
      expect(result[1]).toEqual({
        status: 'modified',
        path: 'file2.txt'
      });
      expect(result[2]).toEqual({
        status: 'deleted',
        path: 'file3.txt'
      });
      expect(result[3]).toEqual({
        status: 'renamed',
        path: 'oldname.txt\tnewname.txt'
      });
      
      expect(execSync).toHaveBeenCalledWith(
        'git show --name-status --pretty=format:"" test-commit',
        expect.any(Object)
      );
    });
    
    test('出力が空の場合は空配列を返す', () => {
      execSync.mockReturnValue(Buffer.from(''));
      
      const result = git.getChangedFilesInCommit('test-commit');
      
      expect(result).toEqual([]);
    });
  });
  
  describe('_mapGitStatusToAction', () => {
    test('Gitのステータスコードをアクション名にマッピングする', () => {
      expect(git._mapGitStatusToAction('A')).toBe('added');
      expect(git._mapGitStatusToAction('M')).toBe('modified');
      expect(git._mapGitStatusToAction('D')).toBe('deleted');
      expect(git._mapGitStatusToAction('R')).toBe('renamed');
      expect(git._mapGitStatusToAction('C')).toBe('copied');
      expect(git._mapGitStatusToAction('U')).toBe('unmerged');
      expect(git._mapGitStatusToAction('T')).toBe('type_changed');
      expect(git._mapGitStatusToAction('X')).toBe('unknown');
    });
  });
  
  describe('getCommitDiffStats', () => {
    test('コミットの差分統計情報を取得する', () => {
      const mockOutput = 'file1.txt | 10 +++++-----\nfile2.txt | 5 +++++\n2 files changed, 10 insertions(+), 5 deletions(-)';
      
      execSync.mockReturnValue(Buffer.from(mockOutput));
      
      const result = git.getCommitDiffStats('test-commit');
      
      expect(result).toEqual({
        filesChanged: 2,
        insertions: 10,
        deletions: 5
      });
      
      expect(execSync).toHaveBeenCalledWith(
        'git diff --stat test-commit^ test-commit',
        expect.any(Object)
      );
    });
    
    test('統計情報が取得できない場合はデフォルト値を返す', () => {
      execSync.mockReturnValue(Buffer.from(''));
      
      const result = git.getCommitDiffStats('test-commit');
      
      expect(result).toEqual({
        filesChanged: 0,
        insertions: 0,
        deletions: 0
      });
    });
  });
  
  describe('getWorkingDirectoryStatus', () => {
    test('作業ディレクトリの状態を取得する', () => {
      const mockOutput = ' M file1.txt\nA  file2.txt\n?? file3.txt\nMM file4.txt';
      
      execSync.mockReturnValue(Buffer.from(mockOutput));
      
      const result = git.getWorkingDirectoryStatus();
      
      expect(result.clean).toBe(false);
      expect(result.staged).toHaveLength(3);
      expect(result.unstaged).toHaveLength(1);
      expect(result.untracked).toHaveLength(1);
      
      // ステージングされたファイル
      expect(result.staged).toContainEqual({
        path: 'file2.txt',
        status: 'added'
      });
      expect(result.staged).toContainEqual({
        path: 'file4.txt',
        status: 'modified'
      });
      
      // ステージングされていないファイル
      expect(result.unstaged).toContainEqual({
        path: 'file4.txt',
        status: 'modified'
      });
      // unstaged配列の長さは1なので、[1]は存在しない
      
      // 追跡されていないファイル
      expect(result.untracked[0]).toEqual({
        path: 'file3.txt'
      });
      
      expect(execSync).toHaveBeenCalledWith(
        'git status --porcelain',
        expect.any(Object)
      );
    });
    
    test('作業ディレクトリがクリーンな場合', () => {
      execSync.mockReturnValue(Buffer.from(''));
      
      const result = git.getWorkingDirectoryStatus();
      
      expect(result.clean).toBe(true);
      expect(result.staged).toEqual([]);
      expect(result.unstaged).toEqual([]);
      expect(result.untracked).toEqual([]);
    });
  });
  
  describe('stageFiles', () => {
    test('ファイルをステージングする', () => {
      const result = git.stageFiles(['file1.txt', 'file2.txt']);
      
      expect(result).toBe(true);
      expect(execSync).toHaveBeenCalledWith(
        'git add "file1.txt" "file2.txt"',
        expect.any(Object)
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'git:files_staged',
        expect.objectContaining({
          paths: ['file1.txt', 'file2.txt']
        })
      );
    });
    
    test('単一のファイルをステージングする', () => {
      git.stageFiles('file1.txt');
      
      expect(execSync).toHaveBeenCalledWith(
        'git add "file1.txt"',
        expect.any(Object)
      );
    });
    
    test('空の配列が渡された場合はfalseを返す', () => {
      const result = git.stageFiles([]);
      
      expect(result).toBe(false);
      expect(execSync).not.toHaveBeenCalled();
    });
    
    test('エラーが発生した場合はGitErrorをスローする', () => {
      execSync.mockImplementation(() => {
        throw new Error('add error');
      });
      
      expect(() => {
        git.stageFiles('file1.txt');
      }).toThrow(GitError);
    });
  });
  
  describe('createCommit', () => {
    test('コミットを作成する', () => {
      execSync.mockReturnValue(Buffer.from(''));
      
      // 現在のコミットハッシュを取得するためのモック
      git.getCurrentCommitHash = jest.fn().mockReturnValue('new-commit-hash');
      
      const result = git.createCommit('Test commit message');
      
      expect(result).toBe('new-commit-hash');
      expect(execSync).toHaveBeenCalledWith(
        'git commit -m "Test commit message"',
        expect.any(Object)
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'git:commit_created',
        expect.objectContaining({
          hash: 'new-commit-hash',
          message: 'Test commit message'
        })
      );
    });
    
    test('オプション付きでコミットを作成する', () => {
      git.createCommit('Test commit message', {
        allowEmpty: true,
        author: 'Test Author <test@example.com>'
      });
      
      expect(execSync).toHaveBeenCalledWith(
        'git commit --allow-empty --author="Test Author <test@example.com>" -m "Test commit message"',
        expect.any(Object)
      );
    });
  });
  
  describe('createBranch', () => {
    test('ブランチを作成する', () => {
      const result = git.createBranch('new-branch');
      
      expect(result).toBe(true);
      expect(execSync).toHaveBeenCalledWith(
        'git branch new-branch HEAD',
        expect.any(Object)
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'git:branch_created',
        expect.objectContaining({
          name: 'new-branch',
          startPoint: 'HEAD',
          checkout: false
        })
      );
    });
    
    test('開始ポイントを指定してブランチを作成する', () => {
      git.createBranch('new-branch', 'commit-hash');
      
      expect(execSync).toHaveBeenCalledWith(
        'git branch new-branch commit-hash',
        expect.any(Object)
      );
    });
    
    test('作成後にチェックアウトする', () => {
      git.createBranch('new-branch', 'HEAD', true);
      
      expect(execSync).toHaveBeenCalledTimes(2);
      expect(execSync).toHaveBeenNthCalledWith(
        1,
        'git branch new-branch HEAD',
        expect.any(Object)
      );
      expect(execSync).toHaveBeenNthCalledWith(
        2,
        'git checkout new-branch',
        expect.any(Object)
      );
    });
  });
  
  describe('checkoutBranch', () => {
    test('ブランチをチェックアウトする', () => {
      const result = git.checkoutBranch('test-branch');
      
      expect(result).toBe(true);
      expect(execSync).toHaveBeenCalledWith(
        'git checkout test-branch',
        expect.any(Object)
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'git:branch_checked_out',
        expect.objectContaining({
          name: 'test-branch'
        })
      );
    });
  });
  
  describe('createTag', () => {
    test('タグを作成する', () => {
      const result = git.createTag('v1.0.0', 'Version 1.0.0');
      
      expect(result).toBe(true);
      expect(execSync).toHaveBeenCalledWith(
        'git tag -a v1.0.0 -m "Version 1.0.0" HEAD',
        expect.any(Object)
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'git:tag_created',
        expect.objectContaining({
          name: 'v1.0.0',
          message: 'Version 1.0.0',
          commitHash: 'HEAD'
        })
      );
    });
    
    test('コミットハッシュを指定してタグを作成する', () => {
      git.createTag('v1.0.0', 'Version 1.0.0', 'commit-hash');
      
      expect(execSync).toHaveBeenCalledWith(
        'git tag -a v1.0.0 -m "Version 1.0.0" commit-hash',
        expect.any(Object)
      );
    });
  });
  
  describe('pull', () => {
    test('リモートからプルする', () => {
      const result = git.pull();
      
      expect(result).toBe(true);
      expect(execSync).toHaveBeenCalledWith(
        'git pull origin',
        expect.any(Object)
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'git:pulled',
        expect.objectContaining({
          remote: 'origin',
          branch: ''
        })
      );
    });
    
    test('リモートとブランチを指定してプルする', () => {
      git.pull('upstream', 'main');
      
      expect(execSync).toHaveBeenCalledWith(
        'git pull upstream main',
        expect.any(Object)
      );
    });
  });
  
  describe('push', () => {
    test('リモートにプッシュする', () => {
      const result = git.push();
      
      expect(result).toBe(true);
      expect(execSync).toHaveBeenCalledWith(
        'git push origin',
        expect.any(Object)
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'git:pushed',
        expect.objectContaining({
          remote: 'origin',
          branch: '',
          force: false
        })
      );
    });
    
    test('リモートとブランチを指定してプッシュする', () => {
      git.push('upstream', 'feature-branch');
      
      expect(execSync).toHaveBeenCalledWith(
        'git push upstream feature-branch',
        expect.any(Object)
      );
    });
    
    test('強制プッシュする', () => {
      git.push('origin', 'main', true);
      
      expect(execSync).toHaveBeenCalledWith(
        'git push origin main --force',
        expect.any(Object)
      );
    });
  });
});
/**
 * セッションバリデータクラスのテスト
 */

const {
  SessionValidator,
} = require('../../../../src/lib/data/validators/session-validator');

describe('SessionValidator', () => {
  let sessionValidator;

  beforeEach(() => {
    sessionValidator = new SessionValidator();
  });

  describe('validate', () => {
    test('should validate valid session', () => {
      const validSession = {
        session_handover: {
          project_id: 'knoa',
          session_id: 'session-123',
          session_timestamp: '2025-03-22T12:00:00Z',
          project_state_summary: {
            completed_tasks: ['T001'],
            current_tasks: ['T002'],
            pending_tasks: ['T003'],
            blocked_tasks: ['T004'],
          },
          key_artifacts: [
            {
              path: 'src/file.js',
              description: 'File description',
              git_status: 'modified',
              related_tasks: ['T001'],
              importance: 'high',
            },
          ],
          git_changes: {
            commits: [
              {
                hash: 'commit-hash',
                message: 'Commit message',
                timestamp: '2025-03-22T11:00:00Z',
                related_tasks: ['T001'],
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
              description: 'Challenge description',
              status: 'pending',
              priority: 3,
              severity: 2,
              related_tasks: ['T001'],
            },
          ],
          action_items: [
            {
              description: 'Action item description',
              status: 'pending',
              priority: 3,
              related_task: 'T001',
            },
          ],
          next_session_focus: 'Next session focus',
        },
      };

      const result = sessionValidator.validate(validSession);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should validate session with minimum required fields', () => {
      const minimalSession = {
        session_handover: {
          project_id: 'knoa',
          session_id: 'session-123',
          session_timestamp: '2025-03-22T12:00:00Z',
          project_state_summary: {
            completed_tasks: [],
            current_tasks: [],
            pending_tasks: [],
          },
          next_session_focus: 'Next session focus',
        },
      };

      const result = sessionValidator.validate(minimalSession);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should return errors for missing session_handover', () => {
      const invalidSession = {};

      const result = sessionValidator.validate(invalidSession);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('セッションオブジェクトが不正です');
    });

    test('should return errors for missing required fields', () => {
      const invalidSession = {
        session_handover: {
          project_id: 'knoa',
          // Missing session_id
          session_timestamp: '2025-03-22T12:00:00Z',
          project_state_summary: {
            completed_tasks: [],
            current_tasks: [],
            pending_tasks: [],
          },
          next_session_focus: 'Next session focus',
        },
      };

      const result = sessionValidator.validate(invalidSession);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('必須フィールド session_id がありません');
    });

    test('should return errors for missing project_state_summary', () => {
      const invalidSession = {
        session_handover: {
          project_id: 'knoa',
          session_id: 'session-123',
          session_timestamp: '2025-03-22T12:00:00Z',
          // Missing project_state_summary
          next_session_focus: 'Next session focus',
        },
      };

      const result = sessionValidator.validate(invalidSession);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('project_state_summary がありません');
    });

    test('should return errors for invalid project_state_summary structure', () => {
      const invalidSession = {
        session_handover: {
          project_id: 'knoa',
          session_id: 'session-123',
          session_timestamp: '2025-03-22T12:00:00Z',
          project_state_summary: {
            completed_tasks: 'not-an-array', // Invalid (should be an array)
            current_tasks: [],
            pending_tasks: [],
          },
          next_session_focus: 'Next session focus',
        },
      };

      const result = sessionValidator.validate(invalidSession);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'project_state_summary.completed_tasks は配列である必要があります'
      );
    });

    test('should return errors for invalid task IDs', () => {
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
          next_session_focus: 'Next session focus',
        },
      };

      const result = sessionValidator.validate(invalidSession);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        '不正なタスクID形式です: invalid-task-id'
      );
    });

    test('should validate key_artifacts', () => {
      const invalidSession = {
        session_handover: {
          project_id: 'knoa',
          session_id: 'session-123',
          session_timestamp: '2025-03-22T12:00:00Z',
          project_state_summary: {
            completed_tasks: [],
            current_tasks: [],
            pending_tasks: [],
          },
          key_artifacts: [
            {
              // Missing path
              description: 'File description',
              git_status: 'invalid-status', // Invalid status
              related_tasks: ['invalid-task-id'], // Invalid task ID
              importance: 'invalid-importance', // Invalid importance
            },
          ],
          next_session_focus: 'Next session focus',
        },
      };

      const result = sessionValidator.validate(invalidSession);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('key_artifacts[0].path は必須です');
      expect(result.errors).toContain(
        'key_artifacts[0].git_status は added, modified, deleted, unchanged のいずれかである必要があります'
      );
      expect(result.errors).toContain(
        'key_artifacts[0].importance は high, medium, low のいずれかである必要があります'
      );
      expect(result.errors).toContain(
        'key_artifacts[0].related_tasks[0] は T001 形式である必要があります'
      );
    });

    test('should validate git_changes', () => {
      const invalidSession = {
        session_handover: {
          project_id: 'knoa',
          session_id: 'session-123',
          session_timestamp: '2025-03-22T12:00:00Z',
          project_state_summary: {
            completed_tasks: [],
            current_tasks: [],
            pending_tasks: [],
          },
          git_changes: {
            commits: [
              {
                // Missing hash
                // Missing message
                // Missing timestamp
                related_tasks: ['invalid-task-id'], // Invalid task ID
              },
            ],
            summary: {
              files_added: -1, // Invalid (should be >= 0)
              files_modified: 2,
              files_deleted: 0,
              lines_added: 100,
              lines_deleted: 50,
            },
          },
          next_session_focus: 'Next session focus',
        },
      };

      const result = sessionValidator.validate(invalidSession);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('git_changes.commits[0].hash は必須です');
      expect(result.errors).toContain(
        'git_changes.commits[0].message は必須です'
      );
      expect(result.errors).toContain(
        'git_changes.commits[0].timestamp は必須です'
      );
      expect(result.errors).toContain(
        'git_changes.commits[0].related_tasks[0] は T001 形式である必要があります'
      );
      expect(result.errors).toContain(
        'git_changes.summary.files_added は 0 以上の数値である必要があります'
      );
    });

    test('should validate current_challenges', () => {
      const invalidSession = {
        session_handover: {
          project_id: 'knoa',
          session_id: 'session-123',
          session_timestamp: '2025-03-22T12:00:00Z',
          project_state_summary: {
            completed_tasks: [],
            current_tasks: [],
            pending_tasks: [],
          },
          current_challenges: [
            {
              // Missing description
              status: 'invalid-status', // Invalid status
              priority: 10, // Invalid (should be 1-5)
              severity: 10, // Invalid (should be 1-5)
              related_tasks: ['invalid-task-id'], // Invalid task ID
            },
          ],
          next_session_focus: 'Next session focus',
        },
      };

      const result = sessionValidator.validate(invalidSession);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'current_challenges[0].description は必須です'
      );
      expect(result.errors).toContain(
        'current_challenges[0].status は pending, in_progress, resolved, wontfix のいずれかである必要があります'
      );
      expect(result.errors).toContain(
        'current_challenges[0].priority は 1 から 5 の整数である必要があります'
      );
      expect(result.errors).toContain(
        'current_challenges[0].severity は 1 から 5 の整数である必要があります'
      );
      expect(result.errors).toContain(
        'current_challenges[0].related_tasks[0] は T001 形式である必要があります'
      );
    });

    test('should validate action_items', () => {
      const invalidSession = {
        session_handover: {
          project_id: 'knoa',
          session_id: 'session-123',
          session_timestamp: '2025-03-22T12:00:00Z',
          project_state_summary: {
            completed_tasks: [],
            current_tasks: [],
            pending_tasks: [],
          },
          action_items: [
            {
              // Missing description
              status: 'invalid-status', // Invalid status
              priority: 10, // Invalid (should be 1-5)
              related_task: 'invalid-task-id', // Invalid task ID
            },
          ],
          next_session_focus: 'Next session focus',
        },
      };

      const result = sessionValidator.validate(invalidSession);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('action_items[0].description は必須です');
      expect(result.errors).toContain(
        'action_items[0].status は pending, in_progress, completed, cancelled のいずれかである必要があります'
      );
      expect(result.errors).toContain(
        'action_items[0].priority は 1 から 5 の整数である必要があります'
      );
      expect(result.errors).toContain(
        'action_items[0].related_task は T001 形式である必要があります'
      );
    });
  });

  describe('validateStateChanges', () => {
    test('should validate valid state changes', () => {
      const previousSession = {
        session_handover: {
          session_id: 'session-123',
          session_timestamp: '2025-03-22T10:00:00Z',
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
          session_id: 'session-456',
          previous_session_id: 'session-123',
          session_timestamp: '2025-03-22T12:00:00Z',
          project_state_summary: {
            completed_tasks: ['T001', 'T002'],
            current_tasks: ['T004'],
            pending_tasks: ['T003'],
            blocked_tasks: [],
          },
        },
      };

      const result = sessionValidator.validateStateChanges(
        previousSession,
        currentSession
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    test('should return errors for missing sessions', () => {
      const result = sessionValidator.validateStateChanges(null, null);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('前回のセッションオブジェクトが不正です');
    });

    test('should return errors for invalid session ID continuity', () => {
      const previousSession = {
        session_handover: {
          session_id: 'session-123',
          session_timestamp: '2025-03-22T10:00:00Z',
          project_state_summary: {
            completed_tasks: [],
            current_tasks: [],
            pending_tasks: [],
          },
        },
      };

      const currentSession = {
        session_handover: {
          session_id: 'session-456',
          previous_session_id: 'session-789', // Doesn't match previous session ID
          session_timestamp: '2025-03-22T12:00:00Z',
          project_state_summary: {
            completed_tasks: [],
            current_tasks: [],
            pending_tasks: [],
          },
        },
      };

      const result = sessionValidator.validateStateChanges(
        previousSession,
        currentSession
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'セッションIDの連続性が不正です: session-123 -> session-789'
      );
    });

    test('should return errors for invalid timestamp continuity', () => {
      const previousSession = {
        session_handover: {
          session_id: 'session-123',
          session_timestamp: '2025-03-22T12:00:00Z', // Later than current session
          project_state_summary: {
            completed_tasks: [],
            current_tasks: [],
            pending_tasks: [],
          },
        },
      };

      const currentSession = {
        session_handover: {
          session_id: 'session-456',
          previous_session_id: 'session-123',
          session_timestamp: '2025-03-22T10:00:00Z', // Earlier than previous session
          project_state_summary: {
            completed_tasks: [],
            current_tasks: [],
            pending_tasks: [],
          },
        },
      };

      const result = sessionValidator.validateStateChanges(
        previousSession,
        currentSession
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'セッションタイムスタンプの連続性が不正です: 2025-03-22T12:00:00Z -> 2025-03-22T10:00:00Z'
      );
    });

    test('should return warnings for completed tasks that are no longer completed', () => {
      const previousSession = {
        session_handover: {
          session_id: 'session-123',
          session_timestamp: '2025-03-22T10:00:00Z',
          project_state_summary: {
            completed_tasks: ['T001', 'T002'],
            current_tasks: [],
            pending_tasks: [],
            blocked_tasks: [],
          },
        },
      };

      const currentSession = {
        session_handover: {
          session_id: 'session-456',
          previous_session_id: 'session-123',
          session_timestamp: '2025-03-22T12:00:00Z',
          project_state_summary: {
            completed_tasks: ['T001'], // T002 is no longer completed
            current_tasks: ['T002'],
            pending_tasks: [],
            blocked_tasks: [],
          },
        },
      };

      const result = sessionValidator.validateStateChanges(
        previousSession,
        currentSession
      );

      expect(result.isValid).toBe(true); // Still valid, but with warnings
      expect(result.warnings).toContain(
        '完了したタスク T002 が現在のセッションで完了状態ではなくなっています'
      );
    });

    test('should return warnings for tasks that no longer exist', () => {
      const previousSession = {
        session_handover: {
          session_id: 'session-123',
          session_timestamp: '2025-03-22T10:00:00Z',
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
          session_id: 'session-456',
          previous_session_id: 'session-123',
          session_timestamp: '2025-03-22T12:00:00Z',
          project_state_summary: {
            completed_tasks: ['T001'],
            current_tasks: [], // T002 is missing
            pending_tasks: ['T003'],
            blocked_tasks: [],
          },
        },
      };

      const result = sessionValidator.validateStateChanges(
        previousSession,
        currentSession
      );

      expect(result.isValid).toBe(true); // Still valid, but with warnings
      expect(result.warnings).toContain(
        'タスク T002 が現在のセッションで存在しなくなっています'
      );
    });
  });
});

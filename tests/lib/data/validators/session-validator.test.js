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
    // 基本的な有効なセッションデータ
    const baseValidSession = {
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
        next_session_focus: 'Next session focus',
      },
    };

    test('should validate valid session', () => {
      const validSession = {
        session_handover: {
          ...baseValidSession.session_handover, // 基本データを使用
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
          ...baseValidSession.session_handover,
          project_state_summary: {
            completed_tasks: 'not-an-array', // Invalid
            current_tasks: [],
            pending_tasks: [],
          },
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
          ...baseValidSession.session_handover,
          project_state_summary: {
            completed_tasks: ['T001'],
            current_tasks: ['invalid-task-id'], // Invalid
            pending_tasks: ['T003'],
          },
        },
      };
      const result = sessionValidator.validate(invalidSession);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        '不正なタスクID形式です: invalid-task-id'
      );
    });

    // --- key_artifacts のテストケース ---
    test('should validate session if key_artifacts is undefined', () => {
      const session = { ...baseValidSession };
      delete session.session_handover.key_artifacts; // undefined にする
      const result = sessionValidator.validate(session);
      expect(result.isValid).toBe(true);
    });

    test('should validate session if key_artifacts is an empty array', () => {
      const session = {
        session_handover: {
          ...baseValidSession.session_handover,
          key_artifacts: [], // 空配列
        },
      };
      const result = sessionValidator.validate(session);
      expect(result.isValid).toBe(true);
    });

    test('should validate key_artifacts with optional fields undefined', () => {
      const session = {
        session_handover: {
          ...baseValidSession.session_handover,
          key_artifacts: [
            {
              path: 'src/file.js',
              description: 'Desc',
              // git_status, importance, related_tasks が undefined
            },
          ],
        },
      };
      const result = sessionValidator.validate(session);
      expect(result.isValid).toBe(true);
    });

    test('should return errors for invalid key_artifacts', () => {
      const invalidSession = {
        session_handover: {
          ...baseValidSession.session_handover,
          key_artifacts: [
            {
              // Missing path
              description: 'File description',
              git_status: 'invalid-status', // Invalid status
              related_tasks: ['invalid-task-id'], // Invalid task ID
              importance: 'invalid-importance', // Invalid importance
            },
          ],
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
    // --- ここまで key_artifacts のテストケース ---

    // --- git_changes のテストケース ---
    test('should validate session if git_changes is undefined', () => {
      const session = { ...baseValidSession };
      delete session.session_handover.git_changes;
      const result = sessionValidator.validate(session);
      expect(result.isValid).toBe(true);
    });

    test('should validate session if git_changes.commits is undefined', () => {
      const session = {
        session_handover: {
          ...baseValidSession.session_handover,
          git_changes: { summary: {} }, // commits が undefined
        },
      };
      const result = sessionValidator.validate(session);
      expect(result.isValid).toBe(true);
    });

    test('should validate session if git_changes.commits is empty array', () => {
      const session = {
        session_handover: {
          ...baseValidSession.session_handover,
          git_changes: { commits: [], summary: {} }, // 空配列
        },
      };
      const result = sessionValidator.validate(session);
      expect(result.isValid).toBe(true);
    });

    test('should validate git_changes.commits with optional fields undefined', () => {
      const session = {
        session_handover: {
          ...baseValidSession.session_handover,
          git_changes: {
            commits: [
              {
                hash: 'commit-hash',
                message: 'Commit message',
                timestamp: '2025-03-22T11:00:00Z',
                // related_tasks が undefined
              },
            ],
            summary: {},
          },
        },
      };
      const result = sessionValidator.validate(session);
      expect(result.isValid).toBe(true);
    });

    test('should validate session if git_changes.summary is undefined', () => {
      const session = {
        session_handover: {
          ...baseValidSession.session_handover,
          git_changes: { commits: [] }, // summary が undefined
        },
      };
      const result = sessionValidator.validate(session);
      expect(result.isValid).toBe(true);
    });

    test('should validate git_changes.summary with optional fields undefined', () => {
      const session = {
        session_handover: {
          ...baseValidSession.session_handover,
          git_changes: {
            commits: [],
            summary: {
              // 全フィールド undefined
            },
          },
        },
      };
      const result = sessionValidator.validate(session);
      expect(result.isValid).toBe(true);
    });

    test('should return errors for invalid git_changes', () => {
      const invalidSession = {
        session_handover: {
          ...baseValidSession.session_handover,
          git_changes: {
            commits: [
              {
                // Missing hash, message, timestamp
                related_tasks: ['invalid-task-id'], // Invalid task ID
              },
            ],
            summary: {
              files_added: -1, // Invalid
              files_modified: 'two', // Invalid
            },
          },
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
      expect(result.errors).toContain(
        'git_changes.summary.files_modified は 0 以上の数値である必要があります'
      );
    });
    // --- ここまで git_changes のテストケース ---

    // --- current_challenges のテストケース ---
    test('should validate session if current_challenges is undefined', () => {
      const session = { ...baseValidSession };
      delete session.session_handover.current_challenges;
      const result = sessionValidator.validate(session);
      expect(result.isValid).toBe(true);
    });

    test('should validate session if current_challenges is empty array', () => {
      const session = {
        session_handover: {
          ...baseValidSession.session_handover,
          current_challenges: [],
        },
      };
      const result = sessionValidator.validate(session);
      expect(result.isValid).toBe(true);
    });

    test('should validate current_challenges with optional fields undefined', () => {
      const session = {
        session_handover: {
          ...baseValidSession.session_handover,
          current_challenges: [
            {
              description: 'Challenge description',
              // status, priority, severity, related_tasks が undefined
            },
          ],
        },
      };
      const result = sessionValidator.validate(session);
      expect(result.isValid).toBe(true);
    });

    test('should return errors for invalid current_challenges', () => {
      const invalidSession = {
        session_handover: {
          ...baseValidSession.session_handover,
          current_challenges: [
            {
              // Missing description
              status: 'invalid-status', // Invalid
              priority: 10, // Invalid
              severity: 10, // Invalid
              related_tasks: ['invalid-task-id'], // Invalid
            },
          ],
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
    // --- ここまで current_challenges のテストケース ---

    // --- action_items のテストケース ---
    test('should validate session if action_items is undefined', () => {
      const session = { ...baseValidSession };
      delete session.session_handover.action_items;
      const result = sessionValidator.validate(session);
      expect(result.isValid).toBe(true);
    });

    test('should validate session if action_items is empty array', () => {
      const session = {
        session_handover: {
          ...baseValidSession.session_handover,
          action_items: [],
        },
      };
      const result = sessionValidator.validate(session);
      expect(result.isValid).toBe(true);
    });

    test('should validate action_items with optional fields undefined', () => {
      const session = {
        session_handover: {
          ...baseValidSession.session_handover,
          action_items: [
            {
              description: 'Action item description',
              // status, priority, related_task が undefined
            },
          ],
        },
      };
      const result = sessionValidator.validate(session);
      expect(result.isValid).toBe(true);
    });

    test('should return errors for invalid action_items', () => {
      const invalidSession = {
        session_handover: {
          ...baseValidSession.session_handover,
          action_items: [
            {
              // Missing description
              status: 'invalid-status', // Invalid
              priority: 10, // Invalid
              related_task: 'invalid-task-id', // Invalid
            },
          ],
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
    // --- ここまで action_items のテストケース ---
  });

  describe('validateStateChanges', () => {
    const basePreviousSession = {
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
    const baseCurrentSession = {
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

    test('should validate valid state changes', () => {
      const result = sessionValidator.validateStateChanges(
        basePreviousSession,
        baseCurrentSession
      );
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    test('should return errors for missing sessions', () => {
      const resultNull = sessionValidator.validateStateChanges(null, null);
      expect(resultNull.isValid).toBe(false);
      expect(resultNull.errors).toContain(
        '前回のセッションオブジェクトが不正です'
      );

      const resultMissingPrev = sessionValidator.validateStateChanges(
        {}, // session_handover がない
        baseCurrentSession
      );
      expect(resultMissingPrev.isValid).toBe(false);
      expect(resultMissingPrev.errors).toContain(
        '前回のセッションオブジェクトが不正です'
      );

      const resultMissingCurr = sessionValidator.validateStateChanges(
        basePreviousSession,
        {} // session_handover がない
      );
      expect(resultMissingCurr.isValid).toBe(false);
      expect(resultMissingCurr.errors).toContain(
        '現在のセッションオブジェクトが不正です'
      );
    });

    test('should return errors for invalid session ID continuity', () => {
      const currentSession = {
        session_handover: {
          ...baseCurrentSession.session_handover,
          previous_session_id: 'session-789', // Doesn't match
        },
      };
      const result = sessionValidator.validateStateChanges(
        basePreviousSession,
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
          ...basePreviousSession.session_handover,
          session_timestamp: '2025-03-22T12:00:00Z', // Later
        },
      };
      const currentSession = {
        session_handover: {
          ...baseCurrentSession.session_handover,
          session_timestamp: '2025-03-22T10:00:00Z', // Earlier
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
          ...basePreviousSession.session_handover,
          project_state_summary: {
            completed_tasks: ['T001', 'T002'], // T002 was completed
            current_tasks: [],
            pending_tasks: [],
            blocked_tasks: [],
          },
        },
      };
      const currentSession = {
        session_handover: {
          ...baseCurrentSession.session_handover,
          project_state_summary: {
            completed_tasks: ['T001'], // T002 is now current
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
      expect(result.isValid).toBe(true); // Still valid
      expect(result.warnings).toContain(
        '完了したタスク T002 が現在のセッションで完了状態ではなくなっています'
      );
    });

    test('should return warnings for tasks that no longer exist', () => {
      const previousSession = {
        session_handover: {
          ...basePreviousSession.session_handover,
          project_state_summary: {
            completed_tasks: ['T001'],
            current_tasks: ['T002'], // T002 existed
            pending_tasks: ['T003'],
            blocked_tasks: [],
          },
        },
      };
      const currentSession = {
        session_handover: {
          ...baseCurrentSession.session_handover,
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
      expect(result.isValid).toBe(true); // Still valid
      expect(result.warnings).toContain(
        'タスク T002 が現在のセッションで存在しなくなっています'
      );
    });

    test('should handle missing project_state_summary gracefully', () => {
      const previousSession = {
        session_handover: {
          ...basePreviousSession.session_handover,
          project_state_summary: undefined, // Missing summary
        },
      };
      const currentSession = {
        session_handover: {
          ...baseCurrentSession.session_handover,
          project_state_summary: undefined, // Missing summary
        },
      };
      const result = sessionValidator.validateStateChanges(
        previousSession,
        currentSession
      );
      // エラーにはならず、警告も出ないはず
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });
  });
});

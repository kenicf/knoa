/**
 * バリデーターユーティリティのテスト
 */

const Validator = require('../../../src/lib/utils/validator');
// ValidationError は errors モジュールからインポートする想定だが、
// このテストファイル内では直接使用されていないため、モックは不要かもしれない。
// ただし、将来的に使用する可能性を考慮してモックを残す。
// const { ValidationError } = require('../../../src/lib/utils/errors'); // 未使用のためコメントアウト
const { createMockLogger } = require('../../helpers/mock-factory');
// expectLogged はこのファイルでは使用されていない
// const { expectLogged } = require('../../helpers/test-helpers');

// errorsモジュールのモック (ValidationError のみモック)
jest.mock('../../../src/lib/utils/errors', () => ({
  ValidationError: class MockValidationError extends Error {
    constructor(message) {
      super(message);
      this.name = 'ValidationError';
    }
  },
  // 他のエラークラスが必要な場合はここに追加
}));

describe('Validator', () => {
  let validator;
  let mockLogger;

  beforeEach(() => {
    // モックのセットアップ
    jest.clearAllMocks();
    mockLogger = createMockLogger();

    // Validatorのインスタンスを作成
    validator = new Validator({
      logger: mockLogger,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    test('logger がないとエラーをスローする', () => {
      expect(() => new Validator()).toThrow(
        'Logger instance is required in Validator options.'
      );
    });

    test('logger オプションで初期化される', () => {
      // Assert (beforeEach で初期化済み)
      expect(validator.logger).toBe(mockLogger);
    });
  });

  describe('validateTaskInput', () => {
    // --- 有効なケース ---
    test('有効なタスクデータの場合、検証に成功する', () => {
      // Arrange
      const validTask = {
        title: 'テストタスク',
        description: 'これはテストタスクです',
        status: 'pending',
        priority: 3,
        estimated_hours: 5,
        progress_percentage: 0,
        dependencies: [
          { task_id: 'T001', type: 'strong' },
          { task_id: 'T002' }, // type はオプショナル
        ],
      };

      // Act
      const result = validator.validateTaskInput(validTask);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('オプションフィールドがなくても検証に成功する', () => {
      // Arrange
      const minimalTask = {
        title: '最小限タスク',
        description: '必須項目のみ',
      };
      // Act
      const result = validator.validateTaskInput(minimalTask);
      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    // --- 無効なケース ---
    describe('無効なタスクデータの検証', () => {
      const baseValidTask = {
        title: 'ベースタスク',
        description: 'ベース説明',
      };

      test.each([
        // タイトル
        [
          'タイトルがない',
          { ...baseValidTask, title: undefined },
          'タイトルは必須の文字列です',
        ],
        [
          'タイトルがnull',
          { ...baseValidTask, title: null },
          'タイトルは必須の文字列です',
        ],
        [
          'タイトルが空文字列',
          { ...baseValidTask, title: '' },
          'タイトルは必須の文字列です',
        ], // 空文字列もエラーとする
        [
          'タイトルが数値',
          { ...baseValidTask, title: 123 },
          'タイトルは必須の文字列です',
        ],
        [
          'タイトルが長すぎる',
          { ...baseValidTask, title: 'a'.repeat(201) },
          'タイトルは200文字以内にしてください',
        ],
        // 説明
        [
          '説明がない',
          { ...baseValidTask, description: undefined },
          '説明は必須の文字列です',
        ],
        [
          '説明がnull',
          { ...baseValidTask, description: null },
          '説明は必須の文字列です',
        ],
        [
          '説明が空文字列',
          { ...baseValidTask, description: '' },
          '説明は必須の文字列です',
        ], // 空文字列もエラーとする
        [
          '説明が数値',
          { ...baseValidTask, description: 123 },
          '説明は必須の文字列です',
        ],
        // ステータス
        [
          'ステータスが無効',
          { ...baseValidTask, status: 'invalid' },
          'ステータスは pending, in_progress, completed, blocked のいずれかである必要があります',
        ],
        // 優先度
        [
          '優先度が範囲外 (0)',
          { ...baseValidTask, priority: 0 },
          '優先度は1から5の整数である必要があります',
        ],
        [
          '優先度が範囲外 (6)',
          { ...baseValidTask, priority: 6 },
          '優先度は1から5の整数である必要があります',
        ],
        [
          '優先度が小数',
          { ...baseValidTask, priority: 3.5 },
          '優先度は1から5の整数である必要があります',
        ], // isInteger で false になる
        [
          '優先度が文字列',
          { ...baseValidTask, priority: '3' },
          '優先度は1から5の整数である必要があります',
        ],
        // 見積もり時間
        [
          '見積もり時間が負数',
          { ...baseValidTask, estimated_hours: -1 },
          '見積もり時間は0以上の数値である必要があります',
        ],
        [
          '見積もり時間が文字列',
          { ...baseValidTask, estimated_hours: '5' },
          '見積もり時間は0以上の数値である必要があります',
        ],
        // 進捗率
        [
          '進捗率が範囲外 (-1)',
          { ...baseValidTask, progress_percentage: -1 },
          '進捗率は0から100の数値である必要があります',
        ],
        [
          '進捗率が範囲外 (101)',
          { ...baseValidTask, progress_percentage: 101 },
          '進捗率は0から100の数値である必要があります',
        ],
        [
          '進捗率が文字列',
          { ...baseValidTask, progress_percentage: '50' },
          '進捗率は0から100の数値である必要があります',
        ],
        // 依存関係
        [
          '依存関係が配列でない',
          { ...baseValidTask, dependencies: 'T001' },
          '依存関係は配列である必要があります',
        ],
        [
          '依存関係の要素がオブジェクトでない',
          { ...baseValidTask, dependencies: ['T001'] },
          '依存関係のタスクIDは必須の文字列です',
        ], // 要素が文字列の場合
        [
          '依存関係のタスクIDがない',
          { ...baseValidTask, dependencies: [{ type: 'strong' }] },
          '依存関係のタスクIDは必須の文字列です',
        ],
        [
          '依存関係のタスクIDがnull',
          { ...baseValidTask, dependencies: [{ task_id: null }] },
          '依存関係のタスクIDは必須の文字列です',
        ],
        [
          '依存関係のタスクIDが空文字列',
          { ...baseValidTask, dependencies: [{ task_id: '' }] },
          '依存関係のタスクIDは必須の文字列です',
        ],
        [
          '依存関係のタスクIDが無効形式',
          { ...baseValidTask, dependencies: [{ task_id: 'invalid' }] },
          '依存関係のタスクIDはT000形式である必要があります',
        ],
        [
          '依存関係のタイプが無効',
          {
            ...baseValidTask,
            dependencies: [{ task_id: 'T001', type: 'invalid' }],
          },
          '依存関係のタイプはstrongまたはweakである必要があります',
        ],
      ])('%s場合、エラーを返す', (_, invalidProps, expectedError) => {
        // Arrange
        const invalidTask = { ...baseValidTask, ...invalidProps };
        // Act
        const result = validator.validateTaskInput(invalidTask);
        // Assert
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(expectedError);
      });

      test('複数のエラーがある場合、すべてのエラーを返す', () => {
        // Arrange
        const multiErrorTask = {
          title: '', // エラー1
          description: 123, // エラー2
          priority: 0, // エラー3
          dependencies: [{ task_id: 'invalid' }], // エラー4
        };
        // Act
        const result = validator.validateTaskInput(multiErrorTask);
        // Assert
        expect(result.isValid).toBe(false);
        expect(result.errors).toHaveLength(4);
        expect(result.errors).toContain('タイトルは必須の文字列です');
        expect(result.errors).toContain('説明は必須の文字列です');
        expect(result.errors).toContain(
          '優先度は1から5の整数である必要があります'
        );
        expect(result.errors).toContain(
          '依存関係のタスクIDはT000形式である必要があります'
        );
      });
    });

    // --- 境界値テスト ---
    describe('境界値テスト', () => {
      const baseValidTask = {
        title: '境界値タスク',
        description: '境界値説明',
      };
      test.each([
        ['タイトルが200文字', { title: 'a'.repeat(200) }, true],
        ['優先度が1', { priority: 1 }, true],
        ['優先度が5', { priority: 5 }, true],
        ['見積もり時間が0', { estimated_hours: 0 }, true],
        ['進捗率が0', { progress_percentage: 0 }, true],
        ['進捗率が100', { progress_percentage: 100 }, true],
      ])('%sの場合、検証に成功する', (_, taskProps, expected) => {
        // Arrange
        const task = { ...baseValidTask, ...taskProps };
        // Act
        const result = validator.validateTaskInput(task);
        // Assert
        expect(result.isValid).toBe(expected);
        expect(result.errors).toEqual([]); // expectedがtrueのケースのみなので、常にエラーがないことを期待
      });
    });
  });

  describe('validateSessionInput', () => {
    // --- 有効なケース ---
    test('有効なセッションデータの場合、検証に成功する', () => {
      // Arrange
      const validSession = {
        session_handover: {
          project_id: 'P001',
          session_id: 'S001',
          session_timestamp: '2023-01-01T00:00:00Z',
          project_state_summary: {
            completed_tasks: ['T001', 'T002'],
            current_tasks: ['T003'],
            pending_tasks: ['T004', 'T005'],
            blocked_tasks: ['T006'], // オプショナル
          },
        },
      };
      // Act
      const result = validator.validateSessionInput(validSession);
      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('blocked_tasks がなくても検証に成功する', () => {
      // Arrange
      const validSession = {
        session_handover: {
          project_id: 'P001',
          session_id: 'S001',
          session_timestamp: '2023-01-01T00:00:00Z',
          project_state_summary: {
            completed_tasks: ['T001'],
            current_tasks: ['T003'],
            pending_tasks: ['T004'],
            // blocked_tasks なし
          },
        },
      };
      // Act
      const result = validator.validateSessionInput(validSession);
      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    // --- 無効なケース ---
    describe('無効なセッションデータの検証', () => {
      test.each([
        ['セッションデータがnull', null, 'セッションオブジェクトが不正です'],
        ['session_handoverがない', {}, 'セッションオブジェクトが不正です'],
        [
          'session_handoverがnull',
          { session_handover: null },
          'セッションオブジェクトが不正です',
        ],
      ])('%s場合、エラーを返す', (_, invalidSession, expectedError) => {
        // Act
        const result = validator.validateSessionInput(invalidSession);
        // Assert
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(expectedError);
      });

      test.each([
        'project_id',
        'session_id',
        'session_timestamp',
        'project_state_summary',
      ])('必須フィールド %s がない場合、エラーを返す', (missingField) => {
        // Arrange
        const invalidSession = {
          session_handover: {
            project_id: 'P001',
            session_id: 'S001',
            session_timestamp: '2023-01-01T00:00:00Z',
            project_state_summary: {
              completed_tasks: [],
              current_tasks: [],
              pending_tasks: [],
            },
          },
        };
        delete invalidSession.session_handover[missingField];
        // Act
        const result = validator.validateSessionInput(invalidSession);
        // Assert
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          `必須フィールド ${missingField} がありません`
        );
      });

      test.each([
        ['completed_tasks', 'completed_tasks が配列でない'],
        ['current_tasks', 'current_tasks が配列でない'],
        ['pending_tasks', 'pending_tasks が配列でない'],
      ])(
        'project_state_summary の %s が配列でない場合、エラーを返す',
        (field, _) => {
          // Arrange
          const invalidSession = {
            session_handover: {
              project_id: 'P001',
              session_id: 'S001',
              session_timestamp: '2023-01-01T00:00:00Z',
              project_state_summary: {
                completed_tasks: [],
                current_tasks: [],
                pending_tasks: [],
              },
            },
          };
          invalidSession.session_handover.project_state_summary[field] =
            'not an array';
          // Act
          const result = validator.validateSessionInput(invalidSession);
          // Assert
          expect(result.isValid).toBe(false);
          expect(result.errors).toContain(
            'project_state_summary の必須フィールドがありません'
          );
        }
      );

      test('タスクIDが無効な形式の場合、エラーを返す', () => {
        // Arrange
        const invalidSession = {
          session_handover: {
            project_id: 'P001',
            session_id: 'S001',
            session_timestamp: '2023-01-01T00:00:00Z',
            project_state_summary: {
              completed_tasks: ['T001', 'invalid-id'],
              current_tasks: ['T003'],
              pending_tasks: [],
              blocked_tasks: ['T006'],
            },
          },
        };
        // Act
        const result = validator.validateSessionInput(invalidSession);
        // Assert
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('不正なタスクID形式です: invalid-id');
      });
    });
  });

  describe('validateFeedbackInput', () => {
    // --- 有効なケース ---
    test('有効なフィードバックデータの場合、検証に成功する', () => {
      // Arrange
      const validFeedback = {
        feedback_loop: {
          task_id: 'T001',
          verification_results: {
            passes_tests: true,
            details: 'All tests passed.', // オプショナル
          },
          feedback_status: 'open', // オプショナル
          comments: 'Looks good.', // オプショナル
        },
      };
      // Act
      const result = validator.validateFeedbackInput(validFeedback);
      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('オプショナルフィールドがなくても検証に成功する', () => {
      // Arrange
      const minimalFeedback = {
        feedback_loop: {
          task_id: 'T001',
          verification_results: {
            passes_tests: false,
          },
        },
      };
      // Act
      const result = validator.validateFeedbackInput(minimalFeedback);
      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    // --- 無効なケース ---
    describe('無効なフィードバックデータの検証', () => {
      test.each([
        [
          'フィードバックデータがnull',
          null,
          'フィードバックオブジェクトが不正です',
        ],
        ['feedback_loopがない', {}, 'フィードバックオブジェクトが不正です'],
        [
          'feedback_loopがnull',
          { feedback_loop: null },
          'フィードバックオブジェクトが不正です',
        ],
      ])('%s場合、エラーを返す', (_, invalidFeedback, expectedError) => {
        // Act
        const result = validator.validateFeedbackInput(invalidFeedback);
        // Assert
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(expectedError);
      });

      test.each(['task_id', 'verification_results'])(
        '必須フィールド %s がない場合、エラーを返す',
        (missingField) => {
          // Arrange
          const invalidFeedback = {
            feedback_loop: {
              task_id: 'T001',
              verification_results: { passes_tests: true },
            },
          };
          delete invalidFeedback.feedback_loop[missingField];
          // Act
          const result = validator.validateFeedbackInput(invalidFeedback);
          // Assert
          expect(result.isValid).toBe(false);
          expect(result.errors).toContain(
            `必須フィールド ${missingField} がありません`
          );
        }
      );

      test.each([
        [
          'タスクIDが無効形式',
          {
            feedback_loop: {
              task_id: 'invalid',
              verification_results: { passes_tests: true },
            },
          },
          '不正なタスクID形式です: invalid',
        ],
        [
          'passes_testsがブール値でない',
          {
            feedback_loop: {
              task_id: 'T001',
              verification_results: { passes_tests: 'true' },
            },
          },
          'passes_testsはブール値である必要があります',
        ],
        [
          'feedback_statusが無効',
          {
            feedback_loop: {
              task_id: 'T001',
              verification_results: { passes_tests: true },
              feedback_status: 'invalid',
            },
          },
          'feedback_statusは open, in_progress, resolved, wontfix のいずれかである必要があります',
        ],
      ])('%s場合、エラーを返す', (_, invalidFeedback, expectedError) => {
        // Arrange
        // Act
        const result = validator.validateFeedbackInput(invalidFeedback);
        // Assert
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(expectedError);
      });
    });
  });

  describe('sanitizeString', () => {
    test('HTMLタグをエスケープする', () => {
      // Arrange
      const input = '<script>alert("XSS")</script>';
      // Act
      const result = validator.sanitizeString(input);
      // Assert (HTMLエンティティにエスケープされることを期待)
      expect(result).toBe('<script>alert("XSS")</script>');
    });

    test('引用符をエスケープする', () => {
      // Arrange
      const input = 'Single quote: \' and double quote: "';
      // Act
      const result = validator.sanitizeString(input);
      // Assert (HTMLエンティティにエスケープされることを期待)
      expect(result).toBe('Single quote: &#039; and double quote: "');
    });

    test('文字列でない場合、空文字列を返す', () => {
      // Arrange
      const inputs = [null, undefined, 123, {}, []];
      // Act & Assert
      for (const input of inputs) {
        const result = validator.sanitizeString(input);
        expect(result).toBe('');
      }
    });

    test('サニタイズ不要な文字列はそのまま返す', () => {
      // Arrange
      const input = '安全な文字列 123 abc';
      // Act
      const result = validator.sanitizeString(input);
      // Assert
      expect(result).toBe(input);
    });
  });
});

/**
 * バリデーターユーティリティのテスト
 */

const Validator = require('../../../src/lib/utils/validator');
const { ValidationError } = require('../../../src/lib/utils/errors');
const { createMockLogger } = require('../../helpers/mock-factory');
const { expectLogged } = require('../../helpers/test-helpers');

// errorsモジュールのモック
jest.mock('../../../src/lib/utils/errors', () => ({
  ValidationError: class ValidationError extends Error {
    constructor(message) {
      super(message);
      this.name = 'ValidationError';
    }
  }
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
      logger: mockLogger
    });
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  describe('constructor', () => {
    test('デフォルト値で初期化される', () => {
      const defaultValidator = new Validator();
      
      expect(defaultValidator.logger).toBe(console);
    });
    
    test('カスタム値で初期化される', () => {
      expect(validator.logger).toBe(mockLogger);
    });
  });
  
  describe('validateTaskInput', () => {
    // 有効なケースのテスト
    test('有効なタスクデータの場合、検証に成功する', () => {
      // Arrange
      const validTask = {
        title: 'テストタスク',
        description: 'これはテストタスクです',
        status: 'pending',
        priority: 3,
        estimated_hours: 5,
        progress_percentage: 0
      };
      
      // Act
      const result = validator.validateTaskInput(validTask);
      
      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
    
    // 無効なケースのパラメータ化テスト
    describe('無効なタスクデータの検証', () => {
      // タイトル関連のテスト
      test.each([
        ['タイトルがない場合', { description: 'これはテストタスクです' }, 'タイトルは必須の文字列です'],
        ['タイトルが文字列でない場合', { title: 123, description: 'これはテストタスクです' }, 'タイトルは必須の文字列です'],
        ['タイトルが長すぎる場合', { title: 'a'.repeat(201), description: 'これはテストタスクです' }, 'タイトルは200文字以内にしてください']
      ])('%s、エラーを返す', (_, invalidTask, expectedError) => {
        // Act
        const result = validator.validateTaskInput(invalidTask);
        
        // Assert
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(expectedError);
      });
      
      // 説明関連のテスト
      test.each([
        ['説明がない場合', { title: 'テストタスク' }, '説明は必須の文字列です'],
        ['説明が文字列でない場合', { title: 'テストタスク', description: 123 }, '説明は必須の文字列です']
      ])('%s、エラーを返す', (_, invalidTask, expectedError) => {
        // Act
        const result = validator.validateTaskInput(invalidTask);
        
        // Assert
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(expectedError);
      });
      
      // ステータス関連のテスト
      test('ステータスが無効な場合、エラーを返す', () => {
        // Arrange
        const invalidTask = {
          title: 'テストタスク',
          description: 'これはテストタスクです',
          status: 'invalid'
        };
        
        // Act
        const result = validator.validateTaskInput(invalidTask);
        
        // Assert
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('ステータスは pending, in_progress, completed, blocked のいずれかである必要があります');
      });
      
      // 優先度、見積もり時間、進捗率のテスト
      test.each([
        ['優先度が無効な場合', { priority: 6 }, '優先度は1から5の整数である必要があります'],
        ['優先度が数値でない場合', { priority: '3' }, '優先度は1から5の整数である必要があります'],
        ['見積もり時間が無効な場合', { estimated_hours: -1 }, '見積もり時間は0以上の数値である必要があります'],
        ['見積もり時間が数値でない場合', { estimated_hours: '5' }, '見積もり時間は0以上の数値である必要があります'],
        ['進捗率が無効な場合', { progress_percentage: 101 }, '進捗率は0から100の数値である必要があります'],
        ['進捗率が数値でない場合', { progress_percentage: '50' }, '進捗率は0から100の数値である必要があります']
      ])('%s、エラーを返す', (_, invalidTaskProps, expectedError) => {
        // Arrange
        const invalidTask = {
          title: 'テストタスク',
          description: 'これはテストタスクです',
          ...invalidTaskProps
        };
        
        // Act
        const result = validator.validateTaskInput(invalidTask);
        
        // Assert
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(expectedError);
      });
      
      // 依存関係のテスト
      test.each([
        ['依存関係が配列でない場合', { dependencies: 'T001' }, '依存関係は配列である必要があります'],
        ['依存関係のタスクIDがない場合', { dependencies: [{}] }, '依存関係のタスクIDは必須の文字列です'],
        ['依存関係のタスクIDが無効な形式の場合', { dependencies: [{ task_id: 'invalid' }] }, '依存関係のタスクIDはT000形式である必要があります'],
        ['依存関係のタイプが無効な場合', { dependencies: [{ task_id: 'T001', type: 'invalid' }] }, '依存関係のタイプはstrongまたはweakである必要があります']
      ])('%s、エラーを返す', (_, invalidTaskProps, expectedError) => {
        // Arrange
        const invalidTask = {
          title: 'テストタスク',
          description: 'これはテストタスクです',
          ...invalidTaskProps
        };
        
        // Act
        const result = validator.validateTaskInput(invalidTask);
        
        // Assert
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(expectedError);
      });
    });
    
    // 有効な依存関係のテスト
    test('有効な依存関係の場合、検証に成功する', () => {
      // Arrange
      const validTask = {
        title: 'テストタスク',
        description: 'これはテストタスクです',
        dependencies: [
          { task_id: 'T001', type: 'strong' },
          { task_id: 'T002', type: 'weak' }
        ]
      };
      
      // Act
      const result = validator.validateTaskInput(validTask);
      
      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
    
    // 境界値テスト
    describe('境界値テスト', () => {
      test.each([
        ['タイトルが200文字ちょうどの場合', { title: 'a'.repeat(200) }, true],
        ['優先度が1の場合', { priority: 1 }, true],
        ['優先度が5の場合', { priority: 5 }, true],
        ['見積もり時間が0の場合', { estimated_hours: 0 }, true],
        ['進捗率が0の場合', { progress_percentage: 0 }, true],
        ['進捗率が100の場合', { progress_percentage: 100 }, true]
      ])('%s、検証に成功する', (_, taskProps, expected) => {
        // Arrange
        const task = {
          title: 'テストタスク',
          description: 'これはテストタスクです',
          ...taskProps
        };
        
        // Act
        const result = validator.validateTaskInput(task);
        
        // Assert
        expect(result.isValid).toBe(expected);
      });
    });
  });
  
  describe('validateSessionInput', () => {
    // 有効なケースのテスト
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
            blocked_tasks: ['T006']
          }
        }
      };
      
      // Act
      const result = validator.validateSessionInput(validSession);
      
      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
    
    // 無効なケースのパラメータ化テスト
    describe('無効なセッションデータの検証', () => {
      test.each([
        ['セッションオブジェクトがnullの場合', null, 'セッションオブジェクトが不正です'],
        ['session_handoverがない場合', {}, 'セッションオブジェクトが不正です']
      ])('%s、エラーを返す', (_, invalidSession, expectedError) => {
        // Act
        const result = validator.validateSessionInput(invalidSession);
        
        // Assert
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(expectedError);
      });
      
      // 必須フィールドのテスト
      test('必須フィールドがない場合、エラーを返す', () => {
        // Arrange
        const invalidSession = {
          session_handover: {
            project_id: 'P001',
            // session_idがない
            session_timestamp: '2023-01-01T00:00:00Z',
            project_state_summary: {
              completed_tasks: [],
              current_tasks: [],
              pending_tasks: []
            }
          }
        };
        
        // Act
        const result = validator.validateSessionInput(invalidSession);
        
        // Assert
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('必須フィールド session_id がありません');
      });
      
      // project_state_summaryのテスト
      test('project_state_summaryの必須フィールドがない場合、エラーを返す', () => {
        // Arrange
        const invalidSession = {
          session_handover: {
            project_id: 'P001',
            session_id: 'S001',
            session_timestamp: '2023-01-01T00:00:00Z',
            project_state_summary: {
              // 必須フィールドの一部が配列でない
              completed_tasks: [],
              current_tasks: 'not an array',
              pending_tasks: []
            }
          }
        };
        
        // Act
        const result = validator.validateSessionInput(invalidSession);
        
        // Assert
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('project_state_summary の必須フィールドがありません');
      });
      
    // project_state_summary の追加テスト
    describe('project_state_summary 追加テスト', () => {
      test('project_state_summary がない場合、エラーを返さない', () => {
        // Arrange
        const sessionWithoutSummary = {
          session_handover: {
            project_id: 'P001',
            session_id: 'S001',
            session_timestamp: '2023-01-01T00:00:00Z'
            // project_state_summary がない
          }
        };

        // Act
        const result = validator.validateSessionInput(sessionWithoutSummary);

        // Assert
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('必須フィールド project_state_summary がありません');
      });

      test('project_state_summary が null の場合、エラーを返さない', () => {
        // Arrange
        const sessionWithNullSummary = {
          session_handover: {
            project_id: 'P001',
            session_id: 'S001',
            session_timestamp: '2023-01-01T00:00:00Z',
            project_state_summary: null
          }
        };

        // Act
        const result = validator.validateSessionInput(sessionWithNullSummary);

        // Assert
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('必須フィールド project_state_summary がありません');
      });

      test('project_state_summary の構造が不正な場合、エラーを返す', () => {
        // Arrange
        const invalidSession = {
          session_handover: {
            project_id: 'P001',
            session_id: 'S001',
            session_timestamp: '2023-01-01T00:00:00Z',
            project_state_summary: {
              completed_tasks: 'not an array', // 不正な形式
              current_tasks: [],
              pending_tasks: []
            }
          }
        };

        // Act
        const result = validator.validateSessionInput(invalidSession);

        // Assert
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('project_state_summary の必須フィールドがありません');
      });
    });
      // タスクIDのテスト
      test('タスクIDが無効な形式の場合、エラーを返す', () => {
        // Arrange
        const invalidSession = {
          session_handover: {
            project_id: 'P001',
            session_id: 'S001',
            session_timestamp: '2023-01-01T00:00:00Z',
            project_state_summary: {
              completed_tasks: ['invalid'],
              current_tasks: [],
              pending_tasks: []
            }
          }
        };
        
        // Act
        const result = validator.validateSessionInput(invalidSession);
        
        // Assert
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('不正なタスクID形式です: invalid');
      });
    });
  });
  
  describe('validateFeedbackInput', () => {
    // 有効なケースのテスト
    test('有効なフィードバックデータの場合、検証に成功する', () => {
      // Arrange
      const validFeedback = {
        feedback_loop: {
          task_id: 'T001',
          verification_results: {
            passes_tests: true
          },
          feedback_status: 'open'
        }
      };
      
      // Act
      const result = validator.validateFeedbackInput(validFeedback);
      
      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
    
    // 無効なケースのパラメータ化テスト
    describe('無効なフィードバックデータの検証', () => {
      test.each([
        ['フィードバックオブジェクトがnullの場合', null, 'フィードバックオブジェクトが不正です'],
        ['feedback_loopがない場合', {}, 'フィードバックオブジェクトが不正です']
      ])('%s、エラーを返す', (_, invalidFeedback, expectedError) => {
        // Act
        const result = validator.validateFeedbackInput(invalidFeedback);
        
        // Assert
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(expectedError);
      });
      
      test('必須フィールドがない場合、エラーを返す', () => {
        // Arrange
        const invalidFeedback = {
          feedback_loop: {
            task_id: 'T001'
            // verification_resultsがない
          }
        };
        
        // Act
        const result = validator.validateFeedbackInput(invalidFeedback);
        
        // Assert
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('必須フィールド verification_results がありません');
      });
      
      // 他の無効なケースをパラメータ化
      test.each([
        ['タスクIDが無効な形式の場合',
          {
            feedback_loop: {
              task_id: 'invalid',
              verification_results: { passes_tests: true }
            }
          },
          '不正なタスクID形式です: invalid'
        ],
        ['passes_testsがブール値でない場合',
          {
            feedback_loop: {
              task_id: 'T001',
              verification_results: { passes_tests: 'true' }
            }
          },
          'passes_testsはブール値である必要があります'
        ],
        ['feedback_statusが無効な場合',
          {
            feedback_loop: {
              task_id: 'T001',
              verification_results: { passes_tests: true },
              feedback_status: 'invalid'
            }
          },
          'feedback_statusは open, in_progress, resolved, wontfix のいずれかである必要があります'
        ]
      ])('%s、エラーを返す', (_, invalidFeedback, expectedError) => {
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
      const input = '<script>alert("XSS")</script>';
      const expected = '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;';
      
      const result = validator.sanitizeString(input);
      
      expect(result).toBe(expected);
    });
    
    test('引用符をエスケープする', () => {
      const input = 'Single quote: \' and double quote: "';
      const expected = 'Single quote: &#039; and double quote: &quot;';
      
      const result = validator.sanitizeString(input);
      
      expect(result).toBe(expected);
    });
    
    test('文字列でない場合、空文字列を返す', () => {
      const inputs = [null, undefined, 123, {}, []];
      
      for (const input of inputs) {
        const result = validator.sanitizeString(input);
        expect(result).toBe('');
      }
    });
  });
  
  describe('静的メソッド', () => {
    test('静的validateTaskInputメソッドが正しく動作する', () => {
      const validTask = {
        title: 'テストタスク',
        description: 'これはテストタスクです'
      };
      
      // インスタンスメソッドをスパイ
      jest.spyOn(Validator.prototype, 'validateTaskInput');
      
      const result = Validator.validateTaskInput(validTask);
      
      expect(Validator.prototype.validateTaskInput).toHaveBeenCalledWith(validTask);
      expect(result).toEqual(expect.objectContaining({
        isValid: expect.any(Boolean),
        errors: expect.any(Array)
      }));
    });
    
    test('静的validateSessionInputメソッドが正しく動作する', () => {
      const validSession = {
        session_handover: {
          project_id: 'P001',
          session_id: 'S001',
          session_timestamp: '2023-01-01T00:00:00Z',
          project_state_summary: {
            completed_tasks: [],
            current_tasks: [],
            pending_tasks: []
          }
        }
      };
      
      // インスタンスメソッドをスパイ
      jest.spyOn(Validator.prototype, 'validateSessionInput');
      
      const result = Validator.validateSessionInput(validSession);
      
      expect(Validator.prototype.validateSessionInput).toHaveBeenCalledWith(validSession);
      expect(result).toEqual(expect.objectContaining({
        isValid: expect.any(Boolean),
        errors: expect.any(Array)
      }));
    });
    
    test('静的validateFeedbackInputメソッドが正しく動作する', () => {
      const validFeedback = {
        feedback_loop: {
          task_id: 'T001',
          verification_results: {
            passes_tests: true
          }
        }
      };
      
      // インスタンスメソッドをスパイ
      jest.spyOn(Validator.prototype, 'validateFeedbackInput');
      
      const result = Validator.validateFeedbackInput(validFeedback);
      
      expect(Validator.prototype.validateFeedbackInput).toHaveBeenCalledWith(validFeedback);
      expect(result).toEqual(expect.objectContaining({
        isValid: expect.any(Boolean),
        errors: expect.any(Array)
      }));
    });
    
    test('静的sanitizeStringメソッドが正しく動作する', () => {
      const input = '<script>alert("XSS")</script>';
      
      // インスタンスメソッドをスパイ
      jest.spyOn(Validator.prototype, 'sanitizeString');
      
      const result = Validator.sanitizeString(input);
      
      expect(Validator.prototype.sanitizeString).toHaveBeenCalledWith(input);
      expect(result).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
    });
  });
});
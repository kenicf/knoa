/**
 * バリデーターユーティリティクラスのテスト
 */

const Validator = require('../../../src/lib/utils/validator');

describe('Validator', () => {
  let validator;

  beforeEach(() => {
    // Arrange (Common setup)
    validator = new Validator();
  });

  describe('constructor', () => {
    test('should create an instance', () => {
      // Arrange (Instance created in beforeEach)
      // Act (Implicitly done by beforeEach)
      // Assert
      expect(validator).toBeInstanceOf(Validator);
    });
  });

  // validateTaskInput, validateSessionInput, validateFeedbackInput のテストスイートは削除済み

  describe('sanitizeString', () => {
    test('should escape HTML tags', () => {
      // Arrange
      const input = '<script>alert("XSS")</script>';
      // Corrected assertion: Expect HTML entities
      const expected = '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'; // Corrected expected value

      // Act
      const result = validator.sanitizeString(input);

      // Assert
      expect(result).toBe(expected);
    });

    test('should escape quotes', () => {
      // Arrange
      const input = 'Single quote: \' and double quote: "';
      // Corrected assertion: Expect HTML entities
      const expected = 'Single quote: &#039; and double quote: &quot;'; // Corrected expected value

      // Act
      const result = validator.sanitizeString(input);

      // Assert
      expect(result).toBe(expected);
    });

    test('should escape mixed tags and quotes', () => {
      // Arrange
      const input = '<a href="#" onclick=\'alert("Hi")\'>Click "Me"</a>';
      // Corrected assertion: Expect HTML entities
      const expected =
        '&lt;a href=&quot;#&quot; onclick=&#039;alert(&quot;Hi&quot;)&#039;&gt;Click &quot;Me&quot;&lt;/a&gt;'; // Corrected expected value

      // Act
      const result = validator.sanitizeString(input);

      // Assert
      expect(result).toBe(expected);
    });

    test('should return empty string for non-string input', () => {
      // Arrange
      const inputNull = null;
      const inputUndefined = undefined;
      const inputNumber = 123;
      const inputObject = {};
      const expected = '';

      // Act
      const resultNull = validator.sanitizeString(inputNull);
      const resultUndefined = validator.sanitizeString(inputUndefined);
      const resultNumber = validator.sanitizeString(inputNumber);
      const resultObject = validator.sanitizeString(inputObject);

      // Assert
      expect(resultNull).toBe(expected);
      expect(resultUndefined).toBe(expected);
      expect(resultNumber).toBe(expected);
      expect(resultObject).toBe(expected);
    });

    test('should return the original string if no escaping is needed', () => {
      // Arrange
      const input =
        'This is a safe string with numbers 123 and symbols !@#$%^&*()_+=-`~[]{};:,./?';
      const expected = input;

      // Act
      const result = validator.sanitizeString(input);

      // Assert
      expect(result).toBe(expected);
    });

    test('should return empty string for empty string input', () => {
      // Arrange
      const input = '';
      const expected = '';

      // Act
      const result = validator.sanitizeString(input);

      // Assert
      expect(result).toBe(expected);
    });
  });
});

/**
 * リポジトリパターン基本クラス
 *
 * データアクセスを抽象化し、一貫したインターフェースを提供します。
 * CRUD操作、バリデーション、アーカイブなどの基本機能を提供します。
 */

/**
 * 検証エラークラス
 */
class ValidationError extends Error {
  /**
   * コンストラクタ
   * @param {string} message - エラーメッセージ
   * @param {Array} errors - エラー詳細の配列
   */
  constructor(message, errors = []) {
    // エラーメッセージにエラー詳細を追加
    const fullMessage =
      errors.length > 0 ? `${message}: ${errors.join(', ')}` : message;
    super(fullMessage);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

/**
 * 未検出エラークラス
 */
class NotFoundError extends Error {
  /**
   * コンストラクタ
   * @param {string} message - エラーメッセージ
   */
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
  }
}

/**
 * データ整合性エラークラス
 */
class DataConsistencyError extends Error {
  /**
   * コンストラクタ
   * @param {string} message - エラーメッセージ
   * @param {Object} context - エラーコンテキスト
   */
  constructor(message, context = {}) {
    super(message);
    this.name = 'DataConsistencyError';
    this.context = context;
  }
}

/**
 * リポジトリ基本クラス
 */
class Repository {
  /**
   * コンストラクタ
   * @param {Object} storageService - ストレージサービス
   * @param {string} entityName - エンティティ名
   * @param {Object} options - オプション
   * @param {string} options.directory - ディレクトリパス
   * @param {string} options.currentFile - 現在のファイル名
   * @param {string} options.historyDirectory - 履歴ディレクトリ名
   * @param {Object} options.validator - バリデータ
   */
  constructor(storageService, entityName, options = {}) {
    if (!storageService) {
      throw new Error('Repository requires a storageService instance');
    }

    this.storage = storageService;
    this.entityName = entityName;
    this.directory = options.directory || `ai-context/${entityName}s`;
    this.currentFile = options.currentFile || `current-${entityName}.json`;
    this.historyDirectory = options.historyDirectory || `${entityName}-history`;
    this.validator = options.validator;

    // ディレクトリの存在確認
    this.storage.ensureDirectoryExists(this.directory);
    this.storage.ensureDirectoryExists(
      `${this.directory}/${this.historyDirectory}`
    );
  }

  /**
   * すべてのエンティティを取得
   * @returns {Promise<Object>} エンティティコレクション
   */
  async getAll() {
    try {
      if (this.storage.fileExists(this.directory, this.currentFile)) {
        return await this.storage.readJSON(this.directory, this.currentFile);
      }
      return { [`${this.entityName}s`]: [] };
    } catch (error) {
      throw new Error(
        `Failed to get all ${this.entityName}s: ${error.message}`
      );
    }
  }

  /**
   * IDによるエンティティの取得
   * @param {string} id - エンティティID
   * @returns {Promise<Object|null>} エンティティまたはnull
   */
  async getById(id) {
    try {
      const entities = await this.getAll();
      const collection = entities[`${this.entityName}s`];

      if (!Array.isArray(collection)) {
        return null;
      }

      return collection.find((entity) => entity.id === id) || null;
    } catch (error) {
      throw new Error(
        `Failed to get ${this.entityName} by id ${id}: ${error.message}`
      );
    }
  }

  /**
   * エンティティの作成
   * @param {Object} data - エンティティデータ
   * @returns {Promise<Object>} 作成されたエンティティ
   */
  async create(data) {
    try {
      // バリデーション
      if (this.validator && typeof this.validator.validate === 'function') {
        const validation = this.validator.validate(data);
        if (!validation.isValid) {
          throw new ValidationError(
            `Invalid ${this.entityName} data`,
            validation.errors
          );
        }
      }

      // 既存のデータを取得
      const entities = await this.getAll();
      const collection = entities[`${this.entityName}s`] || [];

      // 新しいエンティティを作成
      const newEntity = { ...data };

      // IDの重複チェック
      if (
        newEntity.id &&
        collection.some((entity) => entity.id === newEntity.id)
      ) {
        throw new DataConsistencyError(
          `${this.entityName} with id ${newEntity.id} already exists`
        );
      }

      // コレクションに追加
      collection.push(newEntity);
      entities[`${this.entityName}s`] = collection;

      // 保存
      await this.storage.writeJSON(this.directory, this.currentFile, entities);

      return newEntity;
    } catch (error) {
      if (
        error instanceof ValidationError ||
        error instanceof DataConsistencyError
      ) {
        throw error;
      }
      throw new Error(`Failed to create ${this.entityName}: ${error.message}`);
    }
  }

  /**
   * エンティティの更新
   * @param {string} id - エンティティID
   * @param {Object} data - 更新データ
   * @returns {Promise<Object>} 更新されたエンティティ
   */
  async update(id, data) {
    try {
      // バリデーション
      if (this.validator && typeof this.validator.validate === 'function') {
        const validation = this.validator.validate({ ...data, id });
        if (!validation.isValid) {
          throw new ValidationError(
            `Invalid ${this.entityName} data`,
            validation.errors
          );
        }
      }

      // 既存のデータを取得
      const entities = await this.getAll();
      const collection = entities[`${this.entityName}s`] || [];

      // エンティティを検索
      const index = collection.findIndex((entity) => entity.id === id);
      if (index === -1) {
        throw new NotFoundError(`${this.entityName} with id ${id} not found`);
      }

      // エンティティを更新
      const updatedEntity = { ...collection[index], ...data, id };
      collection[index] = updatedEntity;
      entities[`${this.entityName}s`] = collection;

      // 保存
      await this.storage.writeJSON(this.directory, this.currentFile, entities);

      return updatedEntity;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new Error(
        `Failed to update ${this.entityName} with id ${id}: ${error.message}`
      );
    }
  }

  /**
   * エンティティの削除
   * @param {string} id - エンティティID
   * @returns {Promise<boolean>} 削除結果
   */
  async delete(id) {
    try {
      // 既存のデータを取得
      const entities = await this.getAll();
      const collection = entities[`${this.entityName}s`] || [];

      // エンティティを検索
      const index = collection.findIndex((entity) => entity.id === id);
      if (index === -1) {
        throw new NotFoundError(`${this.entityName} with id ${id} not found`);
      }

      // 削除前にアーカイブ
      await this.archive(id);

      // エンティティを削除
      collection.splice(index, 1);
      entities[`${this.entityName}s`] = collection;

      // 保存
      await this.storage.writeJSON(this.directory, this.currentFile, entities);

      return true;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new Error(
        `Failed to delete ${this.entityName} with id ${id}: ${error.message}`
      );
    }
  }

  /**
   * エンティティのアーカイブ
   * @param {string} id - エンティティID
   * @returns {Promise<string>} アーカイブファイル名
   */
  async archive(id) {
    try {
      // エンティティを取得
      const entity = await this.getById(id);
      if (!entity) {
        throw new NotFoundError(`${this.entityName} with id ${id} not found`);
      }

      // アーカイブファイル名を生成
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const filename = `${id}-${timestamp}.json`;

      // アーカイブに保存
      await this.storage.writeJSON(
        `${this.directory}/${this.historyDirectory}`,
        filename,
        entity
      );

      return filename;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new Error(
        `Failed to archive ${this.entityName} with id ${id}: ${error.message}`
      );
    }
  }

  /**
   * 条件によるエンティティの検索
   * @param {Function} predicate - 検索条件関数
   * @returns {Promise<Array>} 検索結果
   */
  async find(predicate) {
    try {
      const entities = await this.getAll();
      const collection = entities[`${this.entityName}s`] || [];

      return collection.filter(predicate);
    } catch (error) {
      throw new Error(`Failed to find ${this.entityName}s: ${error.message}`);
    }
  }

  /**
   * 条件による単一エンティティの検索
   * @param {Function} predicate - 検索条件関数
   * @returns {Promise<Object|null>} 検索結果
   */
  async findOne(predicate) {
    try {
      const entities = await this.getAll();
      const collection = entities[`${this.entityName}s`] || [];

      return collection.find(predicate) || null;
    } catch (error) {
      throw new Error(`Failed to find ${this.entityName}: ${error.message}`);
    }
  }

  /**
   * 複数エンティティの一括作成
   * @param {Array} dataArray - エンティティデータの配列
   * @returns {Promise<Array>} 作成されたエンティティの配列
   */
  async createMany(dataArray) {
    try {
      if (!Array.isArray(dataArray)) {
        throw new Error('dataArray must be an array');
      }

      const results = [];

      for (const data of dataArray) {
        const result = await this.create(data);
        results.push(result);
      }

      return results;
    } catch (error) {
      throw new Error(
        `Failed to create many ${this.entityName}s: ${error.message}`
      );
    }
  }

  /**
   * 複数エンティティの一括更新
   * @param {Array} updateArray - 更新データの配列 [{id, data}, ...]
   * @returns {Promise<Array>} 更新されたエンティティの配列
   */
  async updateMany(updateArray) {
    try {
      if (!Array.isArray(updateArray)) {
        throw new Error('updateArray must be an array');
      }

      // 入力検証を先に行う
      for (const item of updateArray) {
        if (!item.id) {
          throw new Error('Each update item must have an id');
        }
      }

      const results = [];

      for (const { id, data } of updateArray) {
        const result = await this.update(id, data);
        results.push(result);
      }

      return results;
    } catch (error) {
      // 特定のエラーはそのまま投げる
      if (
        error.message === 'Each update item must have an id' ||
        error.message === 'updateArray must be an array'
      ) {
        throw error;
      }
      throw new Error(
        `Failed to update many ${this.entityName}s: ${error.message}`
      );
    }
  }

  /**
   * 複数エンティティの一括削除
   * @param {Array} ids - 削除するIDの配列
   * @returns {Promise<Array>} 削除結果の配列
   */
  async deleteMany(ids) {
    try {
      if (!Array.isArray(ids)) {
        throw new Error('ids must be an array');
      }

      const results = [];

      for (const id of ids) {
        try {
          const result = await this.delete(id);
          results.push({ id, success: result });
        } catch (error) {
          results.push({ id, success: false, error: error.message });
        }
      }

      return results;
    } catch (error) {
      throw new Error(
        `Failed to delete many ${this.entityName}s: ${error.message}`
      );
    }
  }
}

module.exports = {
  Repository,
  ValidationError,
  NotFoundError,
  DataConsistencyError,
};

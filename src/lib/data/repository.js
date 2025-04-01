/**
 * リポジトリパターン基本クラス
 *
 * データアクセスを抽象化し、一貫したインターフェースを提供します。
 * CRUD操作、バリデーション、アーカイブなどの基本機能を提供します。
 */

// src/lib/utils/errors.js からエラークラスをインポート
const {
  ValidationError,
  NotFoundError,
  DataConsistencyError,
} = require('../utils/errors');

/**
 * リポジトリ基本クラス
 */
class Repository {
  /**
   * コンストラクタ
   * @param {Object} options - オプション
   * @param {Object} options.storageService - ストレージサービス (必須)
   * @param {string} options.entityName - エンティティ名 (必須)
   * @param {Object} options.logger - ロガーインスタンス (必須)
   * @param {Object} [options.eventEmitter] - イベントエミッターインスタンス
   * @param {Object} [options.errorHandler] - エラーハンドラーインスタンス
   * @param {string} [options.directory] - ディレクトリパス
   * @param {string} [options.currentFile] - 現在のファイル名
   * @param {string} [options.historyDirectory] - 履歴ディレクトリ名
   */
  constructor(options = {}) {
    if (!options.storageService) {
      throw new Error('Repository requires a storageService instance');
    }
    if (!options.entityName) {
      throw new Error('Repository requires an entityName');
    }
    if (!options.logger) {
      throw new Error('Repository requires a logger instance');
    }

    this.storage = options.storageService;
    this.entityName = options.entityName;
    this.logger = options.logger;
    this.eventEmitter = options.eventEmitter; // 任意
    this.errorHandler = options.errorHandler; // 任意

    // entityName を options から取得するように修正
    this.directory = options.directory || `ai-context/${options.entityName}s`;
    this.currentFile =
      options.currentFile || `current-${options.entityName}.json`;
    this.historyDirectory =
      options.historyDirectory || `${options.entityName}-history`;
    // this.validator = options.validator;

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
      if (this.errorHandler) {
        return this.errorHandler.handle(error, 'Repository', 'getAll', {
          entityName: this.entityName,
        });
      }
      this.logger.error(`Failed to get all ${this.entityName}s`, { error });
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
      if (this.errorHandler) {
        return this.errorHandler.handle(error, 'Repository', 'getById', {
          entityName: this.entityName,
          id,
        });
      }
      this.logger.error(`Failed to get ${this.entityName} by id ${id}`, {
        error,
      });
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

      // イベント発行
      if (this.eventEmitter) {
        this.eventEmitter.emitStandardized(this.entityName, 'created', {
          entity: newEntity,
        });
      }

      return newEntity;
    } catch (error) {
      if (
        error instanceof ValidationError ||
        error instanceof DataConsistencyError
      ) {
        // 特定のエラーはそのままスロー (または errorHandler に渡すか検討)
        if (this.errorHandler) {
          return this.errorHandler.handle(error, 'Repository', 'create', {
            entityName: this.entityName,
            data,
          });
        }
        throw error;
      }
      if (this.errorHandler) {
        return this.errorHandler.handle(error, 'Repository', 'create', {
          entityName: this.entityName,
          data,
        });
      }
      this.logger.error(`Failed to create ${this.entityName}`, { data, error });
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
      // 既存のデータを取得
      const entities = await this.getAll();
      const collection = entities[`${this.entityName}s`] || [];

      // エンティティを検索
      const index = collection.findIndex((entity) => entity.id === id);
      if (index === -1) {
        throw new NotFoundError(`${this.entityName} with id ${id} not found`);
      }

      // エンティティを更新 (安全でないキーを除外)
      const safeData = Object.keys(data).reduce((acc, key) => {
        if (key !== '__proto__' && key !== 'constructor') {
          // eslint-disable-next-line security/detect-object-injection
          acc[key] = data[key];
        }
        return acc;
      }, {});
      // eslint-disable-next-line security/detect-object-injection -- safeData で基本的なサニタイズ済みのため抑制
      const updatedEntity = { ...collection[index], ...safeData, id };

      // eslint-disable-next-line security/detect-object-injection
      collection[index] = updatedEntity;
      entities[`${this.entityName}s`] = collection;

      // 保存
      await this.storage.writeJSON(this.directory, this.currentFile, entities);

      // イベント発行
      if (this.eventEmitter) {
        // 更新前後のデータを渡すか、更新後のデータのみかは要件による
        this.eventEmitter.emitStandardized(this.entityName, 'updated', {
          entity: updatedEntity,
          id,
        });
      }

      return updatedEntity;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        // 特定のエラーはそのままスロー (または errorHandler に渡すか検討)
        if (this.errorHandler) {
          return this.errorHandler.handle(error, 'Repository', 'update', {
            entityName: this.entityName,
            id,
            data,
          });
        }
        throw error;
      }
      if (this.errorHandler) {
        return this.errorHandler.handle(error, 'Repository', 'update', {
          entityName: this.entityName,
          id,
          data,
        });
      }
      this.logger.error(`Failed to update ${this.entityName} with id ${id}`, {
        data,
        error,
      });
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

      // イベント発行 (削除されたエンティティの情報を渡すか検討)
      if (this.eventEmitter) {
        // 削除されたエンティティの情報は index から取得しておく必要がある
        // const deletedEntity = collection[index]; // splice 前に取得
        // this.eventEmitter.emitStandardized(this.entityName, 'deleted', { id, entity: deletedEntity });
        // ここでは ID のみを渡す
        this.eventEmitter.emitStandardized(this.entityName, 'deleted', { id });
      }

      return true;
    } catch (error) {
      if (error instanceof NotFoundError) {
        // 特定のエラーはそのままスロー (または errorHandler に渡すか検討)
        if (this.errorHandler) {
          return this.errorHandler.handle(error, 'Repository', 'delete', {
            entityName: this.entityName,
            id,
          });
        }
        throw error;
      }
      if (this.errorHandler) {
        return this.errorHandler.handle(error, 'Repository', 'delete', {
          entityName: this.entityName,
          id,
        });
      }
      this.logger.error(`Failed to delete ${this.entityName} with id ${id}`, {
        error,
      });
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
        // 特定のエラーはそのままスロー (または errorHandler に渡すか検討)
        if (this.errorHandler) {
          return this.errorHandler.handle(error, 'Repository', 'archive', {
            entityName: this.entityName,
            id,
          });
        }
        throw error;
      }
      if (this.errorHandler) {
        return this.errorHandler.handle(error, 'Repository', 'archive', {
          entityName: this.entityName,
          id,
        });
      }
      this.logger.error(`Failed to archive ${this.entityName} with id ${id}`, {
        error,
      });
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
      if (this.errorHandler) {
        return this.errorHandler.handle(error, 'Repository', 'find', {
          entityName: this.entityName,
        });
      }
      this.logger.error(`Failed to find ${this.entityName}s`, { error });
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
      if (this.errorHandler) {
        return this.errorHandler.handle(error, 'Repository', 'findOne', {
          entityName: this.entityName,
        });
      }
      this.logger.error(`Failed to find ${this.entityName}`, { error });
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
      if (this.errorHandler) {
        // createMany の場合、一部成功・一部失敗の可能性もあるため、ハンドラーでの処理が複雑になる可能性
        return this.errorHandler.handle(error, 'Repository', 'createMany', {
          entityName: this.entityName,
          dataArray,
        });
      }
      this.logger.error(`Failed to create many ${this.entityName}s`, { error });
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
      // 特定の入力エラーはそのままスロー
      if (
        error.message === 'Each update item must have an id' ||
        error.message === 'updateArray must be an array'
      ) {
        if (this.errorHandler) {
          // 入力エラーもハンドラーに渡すか検討
          return this.errorHandler.handle(error, 'Repository', 'updateMany', {
            entityName: this.entityName,
            updateArray,
          });
        }
        throw error;
      }
      if (this.errorHandler) {
        // updateMany の場合、一部成功・一部失敗の可能性もあるため、ハンドラーでの処理が複雑になる可能性
        return this.errorHandler.handle(error, 'Repository', 'updateMany', {
          entityName: this.entityName,
          updateArray,
        });
      }
      this.logger.error(`Failed to update many ${this.entityName}s`, { error });
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
          if (this.errorHandler) {
            // errorHandler に処理を委譲。ハンドラーがエラーをスローする可能性がある。
            // ハンドラーが値を返した場合（エラーをスローしなかった場合）は、エラー情報を記録する。
            try {
              this.errorHandler.handle(error, 'Repository', 'deleteMany', {
                entityName: this.entityName,
                id,
              });
              // ハンドラーがスローしなかった場合のみエラー情報を記録
              results.push({ id, success: false, error: error.message });
            } catch (handlerError) {
              // errorHandler がエラーをスローした場合、ループを中断して rethrow する
              throw handlerError;
            }
          } else {
            // errorHandler がない場合はログ出力してエラー情報を記録
            this.logger.error(`Failed during deleteMany for id ${id}`, {
              error,
            });
            results.push({ id, success: false, error: error.message });
          }
        }
      }

      return results;
    } catch (error) {
      // 特定の入力エラーはそのままスロー
      if (error.message === 'ids must be an array') {
        if (this.errorHandler) {
          return this.errorHandler.handle(error, 'Repository', 'deleteMany', {
            entityName: this.entityName,
            ids,
          });
        }
        throw error;
      }
      if (this.errorHandler) {
        // deleteMany の場合、一部成功・一部失敗の可能性もあるため、ハンドラーでの処理が複雑になる可能性
        return this.errorHandler.handle(error, 'Repository', 'deleteMany', {
          entityName: this.entityName,
          ids,
        });
      }
      this.logger.error(`Failed to delete many ${this.entityName}s`, { error });
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

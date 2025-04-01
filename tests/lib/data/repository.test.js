/**
 * リポジトリクラスのテスト
 */

// エラークラスは src/lib/utils/errors からインポート
const {
  ValidationError, // createMany, updateMany で使用される可能性があるため残す
  NotFoundError,
  DataConsistencyError,
} = require('../../../src/lib/utils/errors');
const { Repository } = require('../../../src/lib/data/repository');
const { createMockDependencies } = require('../../helpers/mock-factory');
const {
  expectStandardizedEventEmitted,
} = require('../../helpers/test-helpers');

describe('Repository', () => {
  let repository;
  let mockDeps;
  const entityName = 'test'; // テスト用のエンティティ名
  let originalDateToISOString; // Date モック復元用

  beforeEach(() => {
    mockDeps = createMockDependencies();
    // Repository のコンストラクタに合わせて修正
    repository = new Repository({
      storageService: mockDeps.storageService,
      entityName: entityName,
      logger: mockDeps.logger,
      eventEmitter: mockDeps.eventEmitter, // 追加
      errorHandler: mockDeps.errorHandler, // 追加
      // validator は基底クラスでは不要
    });
    // errorHandler はデフォルトでエラーを再スローするようにモック
    mockDeps.errorHandler.handle.mockImplementation((err) => {
      throw err;
    });

    // Date.toISOString のモック準備 (必要なテストスイート内で実行)
    originalDateToISOString = Date.prototype.toISOString;
  });

  afterEach(() => {
    jest.restoreAllMocks(); // spyOn もリセットするために restoreAllMocks を使用
    // Date.prototype.toISOString のモックを確実に復元
    Date.prototype.toISOString = originalDateToISOString;
  });

  describe('constructor', () => {
    test('should throw error if storageService is not provided', () => {
      expect(
        () =>
          new Repository({
            entityName: entityName,
            logger: mockDeps.logger,
          })
      ).toThrow('Repository requires a storageService instance');
    });

    test('should throw error if entityName is not provided', () => {
      expect(
        () =>
          new Repository({
            storageService: mockDeps.storageService,
            logger: mockDeps.logger,
          })
      ).toThrow('Repository requires an entityName');
    });

    test('should throw error if logger is not provided', () => {
      expect(
        () =>
          new Repository({
            storageService: mockDeps.storageService,
            entityName: entityName,
          })
      ).toThrow('Repository requires a logger instance');
    });

    test('should create repository with default options', () => {
      expect(repository.entityName).toBe(entityName);
      expect(repository.directory).toBe(`ai-context/${entityName}s`);
      expect(repository.currentFile).toBe(`current-${entityName}.json`);
      expect(repository.historyDirectory).toBe(`${entityName}-history`);
      expect(repository.logger).toBe(mockDeps.logger);
      expect(repository.eventEmitter).toBe(mockDeps.eventEmitter);
      expect(repository.errorHandler).toBe(mockDeps.errorHandler);

      expect(
        mockDeps.storageService.ensureDirectoryExists
      ).toHaveBeenCalledTimes(2);
      expect(
        mockDeps.storageService.ensureDirectoryExists
      ).toHaveBeenCalledWith(`ai-context/${entityName}s`);
      // historyDirectory のパス生成を修正
      expect(
        mockDeps.storageService.ensureDirectoryExists
      ).toHaveBeenCalledWith(`ai-context/${entityName}s/${entityName}-history`);
    });

    test('should create repository with custom options', () => {
      const customOptions = {
        directory: 'custom-dir',
        currentFile: 'custom-file.json',
        historyDirectory: 'custom-history',
      };

      const customRepo = new Repository({
        storageService: mockDeps.storageService,
        entityName: 'custom',
        logger: mockDeps.logger,
        eventEmitter: mockDeps.eventEmitter,
        errorHandler: mockDeps.errorHandler,
        ...customOptions,
      });

      expect(customRepo.entityName).toBe('custom');
      expect(customRepo.directory).toBe('custom-dir');
      expect(customRepo.currentFile).toBe('custom-file.json');
      expect(customRepo.historyDirectory).toBe('custom-history');

      // ensureDirectoryExists は beforeEach で呼ばれているため、ここではカスタムパスでの呼び出しを確認
      expect(
        mockDeps.storageService.ensureDirectoryExists
      ).toHaveBeenCalledWith('custom-dir');
      expect(
        mockDeps.storageService.ensureDirectoryExists
      ).toHaveBeenCalledWith('custom-dir/custom-history');
    });
  });

  describe('getAll', () => {
    test('should return empty collection if file does not exist', async () => {
      mockDeps.storageService.fileExists.mockReturnValue(false);
      const result = await repository.getAll();
      expect(result).toEqual({ [`${entityName}s`]: [] });
      expect(mockDeps.storageService.readJSON).not.toHaveBeenCalled();
    });

    test('should return collection from file', async () => {
      const mockData = { [`${entityName}s`]: [{ id: 'test1' }] };
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue(mockData);
      const result = await repository.getAll();
      expect(result).toEqual(mockData);
      expect(mockDeps.storageService.readJSON).toHaveBeenCalledWith(
        repository.directory,
        repository.currentFile
      );
    });

    test('should call errorHandler if readJSON fails', async () => {
      const readError = new Error('Read error');
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockRejectedValue(readError);
      mockDeps.errorHandler.handle.mockReturnValue({ [`${entityName}s`]: [] }); // 例: エラー時は空を返す

      const result = await repository.getAll();
      expect(result).toEqual({ [`${entityName}s`]: [] }); // errorHandler の戻り値を確認
      expect(mockDeps.errorHandler.handle).toHaveBeenCalledWith(
        readError,
        'Repository',
        'getAll',
        { entityName }
      );
      expect(mockDeps.logger.error).not.toHaveBeenCalled();
    });

    test('should log error and rethrow if readJSON fails and no errorHandler', async () => {
      const readError = new Error('Read error');
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockRejectedValue(readError);
      repository.errorHandler = undefined; // errorHandler を無効化

      await expect(repository.getAll()).rejects.toThrow(
        `Failed to get all ${entityName}s: Read error`
      );
      expect(mockDeps.logger.error).toHaveBeenCalledWith(
        `Failed to get all ${entityName}s`,
        { error: readError }
      );
    });
  });

  describe('getById', () => {
    test('should return null if entity not found', async () => {
      const mockData = { [`${entityName}s`]: [{ id: 'test1' }] };
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue(mockData);
      const result = await repository.getById('test2');
      expect(result).toBeNull();
    });

    test('should return entity if found', async () => {
      const mockEntity = { id: 'test1', name: 'Test 1' };
      const mockData = { [`${entityName}s`]: [mockEntity] };
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue(mockData);
      const result = await repository.getById('test1');
      expect(result).toEqual(mockEntity);
    });

    test('should return null if collection is not an array', async () => {
      const mockData = { [`${entityName}s`]: 'not an array' };
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue(mockData);
      const result = await repository.getById('test1');
      expect(result).toBeNull();
    });

    test('should call errorHandler if getAll fails', async () => {
      const getAllError = new Error('Get all error');
      jest.spyOn(repository, 'getAll').mockRejectedValue(getAllError);
      mockDeps.errorHandler.handle.mockReturnValue(null); // 例: エラー時は null を返す

      const result = await repository.getById('test1');
      expect(result).toBeNull();
      expect(mockDeps.errorHandler.handle).toHaveBeenCalledWith(
        getAllError,
        'Repository',
        'getById',
        { entityName, id: 'test1' }
      );
    });

    // --- errorHandler なしの場合のテスト ---
    test('should log error and rethrow if getAll fails and no errorHandler', async () => {
      const getAllError = new Error('Get all error');
      jest.spyOn(repository, 'getAll').mockRejectedValue(getAllError);
      repository.errorHandler = undefined;

      await expect(repository.getById('test1')).rejects.toThrow(
        `Failed to get ${entityName} by id test1: Get all error`
      );
      expect(mockDeps.logger.error).toHaveBeenCalledWith(
        `Failed to get ${entityName} by id test1`,
        { error: getAllError }
      );
    });
    // --- ここまで errorHandler なしの場合のテスト ---
  });

  describe('create', () => {
    const newEntity = { id: 'test1', name: 'Test 1' };

    beforeEach(() => {
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue({
        [`${entityName}s`]: [],
      });
    });

    test('should create entity, save to file, and emit event', async () => {
      const result = await repository.create(newEntity);
      expect(result).toEqual(newEntity);
      expect(mockDeps.storageService.writeJSON).toHaveBeenCalledWith(
        repository.directory,
        repository.currentFile,
        { [`${entityName}s`]: [newEntity] }
      );
      expectStandardizedEventEmitted(
        mockDeps.eventEmitter,
        entityName,
        'created',
        { entity: newEntity }
      );
    });

    test('should throw DataConsistencyError if entity with same ID exists', async () => {
      mockDeps.storageService.readJSON.mockResolvedValue({
        [`${entityName}s`]: [newEntity],
      });
      await expect(repository.create(newEntity)).rejects.toThrow(
        DataConsistencyError
      );
      expect(mockDeps.storageService.writeJSON).not.toHaveBeenCalled();
      expect(mockDeps.eventEmitter.emitStandardized).not.toHaveBeenCalled();
    });

    test('should call errorHandler for DataConsistencyError', async () => {
      mockDeps.storageService.readJSON.mockResolvedValue({
        [`${entityName}s`]: [newEntity],
      });
      mockDeps.errorHandler.handle.mockImplementation((err) => {
        throw err;
      });
      await expect(repository.create(newEntity)).rejects.toThrow(
        DataConsistencyError
      );
      expect(mockDeps.errorHandler.handle).toHaveBeenCalledWith(
        expect.any(DataConsistencyError),
        'Repository',
        'create',
        { entityName, data: newEntity }
      );
    });

    test('should call errorHandler for other errors (e.g., writeJSON)', async () => {
      const writeError = new Error('Write error');
      mockDeps.storageService.writeJSON.mockRejectedValue(writeError);
      mockDeps.errorHandler.handle.mockImplementation((err) => {
        throw err;
      });
      await expect(repository.create(newEntity)).rejects.toThrow(writeError);
      expect(mockDeps.errorHandler.handle).toHaveBeenCalledWith(
        writeError,
        'Repository',
        'create',
        { entityName, data: newEntity }
      );
    });

    test('should log error and rethrow if no errorHandler', async () => {
      const writeError = new Error('Write error');
      mockDeps.storageService.writeJSON.mockRejectedValue(writeError);
      repository.errorHandler = undefined;
      await expect(repository.create(newEntity)).rejects.toThrow(
        `Failed to create ${entityName}: Write error`
      );
      expect(mockDeps.logger.error).toHaveBeenCalledWith(
        `Failed to create ${entityName}`,
        { data: newEntity, error: writeError }
      );
    });
  });

  describe('update', () => {
    const existingEntity = { id: 'test1', name: 'Old Name' };
    const updateData = { name: 'New Name' };
    const updatedEntity = { ...existingEntity, ...updateData };

    beforeEach(() => {
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue({
        [`${entityName}s`]: [existingEntity],
      });
    });

    test('should update entity, save to file, and emit event', async () => {
      const result = await repository.update('test1', updateData);
      expect(result).toEqual(updatedEntity);
      expect(mockDeps.storageService.writeJSON).toHaveBeenCalledWith(
        repository.directory,
        repository.currentFile,
        { [`${entityName}s`]: [updatedEntity] }
      );
      expectStandardizedEventEmitted(
        mockDeps.eventEmitter,
        entityName,
        'updated',
        { entity: updatedEntity, id: 'test1' }
      );
    });

    test('should throw NotFoundError if entity not found', async () => {
      mockDeps.storageService.readJSON.mockResolvedValue({
        [`${entityName}s`]: [],
      }); // Entity not found
      await expect(repository.update('test1', updateData)).rejects.toThrow(
        NotFoundError
      );
      expect(mockDeps.storageService.writeJSON).not.toHaveBeenCalled();
      expect(mockDeps.eventEmitter.emitStandardized).not.toHaveBeenCalled();
    });

    test('should call errorHandler for NotFoundError', async () => {
      mockDeps.storageService.readJSON.mockResolvedValue({
        [`${entityName}s`]: [],
      });
      mockDeps.errorHandler.handle.mockImplementation((err) => {
        throw err;
      });
      await expect(repository.update('test1', updateData)).rejects.toThrow(
        NotFoundError
      );
      expect(mockDeps.errorHandler.handle).toHaveBeenCalledWith(
        expect.any(NotFoundError),
        'Repository',
        'update',
        { entityName, id: 'test1', data: updateData }
      );
    });

    test('should call errorHandler for other errors (e.g., writeJSON)', async () => {
      const writeError = new Error('Write error');
      mockDeps.storageService.writeJSON.mockRejectedValue(writeError);
      mockDeps.errorHandler.handle.mockImplementation((err) => {
        throw err;
      });
      await expect(repository.update('test1', updateData)).rejects.toThrow(
        writeError
      );
      expect(mockDeps.errorHandler.handle).toHaveBeenCalledWith(
        writeError,
        'Repository',
        'update',
        { entityName, id: 'test1', data: updateData }
      );
    });

    test('should log error and rethrow if no errorHandler', async () => {
      const writeError = new Error('Write error');
      mockDeps.storageService.writeJSON.mockRejectedValue(writeError);
      repository.errorHandler = undefined;
      await expect(repository.update('test1', updateData)).rejects.toThrow(
        `Failed to update ${entityName} with id test1: Write error`
      );
      expect(mockDeps.logger.error).toHaveBeenCalledWith(
        `Failed to update ${entityName} with id test1`,
        { data: updateData, error: writeError }
      );
    });
  });

  describe('delete', () => {
    const entityToDelete = { id: 'test1', name: 'To Delete' };

    beforeEach(() => {
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue({
        [`${entityName}s`]: [entityToDelete],
      });
      jest
        .spyOn(repository, 'archive')
        .mockResolvedValue('test1-timestamp.json');
    });

    test('should archive, delete entity, save file, and emit event', async () => {
      const result = await repository.delete('test1');
      expect(result).toBe(true);
      expect(repository.archive).toHaveBeenCalledWith('test1');
      expect(mockDeps.storageService.writeJSON).toHaveBeenCalledWith(
        repository.directory,
        repository.currentFile,
        { [`${entityName}s`]: [] }
      );
      expectStandardizedEventEmitted(
        mockDeps.eventEmitter,
        entityName,
        'deleted',
        { id: 'test1' }
      );
    });

    test('should throw NotFoundError if entity not found', async () => {
      mockDeps.storageService.readJSON.mockResolvedValue({
        [`${entityName}s`]: [],
      });
      await expect(repository.delete('test1')).rejects.toThrow(NotFoundError);
      expect(repository.archive).not.toHaveBeenCalled();
      expect(mockDeps.storageService.writeJSON).not.toHaveBeenCalled();
      expect(mockDeps.eventEmitter.emitStandardized).not.toHaveBeenCalled();
    });

    test('should call errorHandler for NotFoundError', async () => {
      mockDeps.storageService.readJSON.mockResolvedValue({
        [`${entityName}s`]: [],
      });
      mockDeps.errorHandler.handle.mockImplementation((err) => {
        throw err;
      });
      await expect(repository.delete('test1')).rejects.toThrow(NotFoundError);
      expect(mockDeps.errorHandler.handle).toHaveBeenCalledWith(
        expect.any(NotFoundError),
        'Repository',
        'delete',
        { entityName, id: 'test1' }
      );
    });

    test('should call errorHandler if archive fails', async () => {
      const archiveError = new Error('Archive error');
      jest.spyOn(repository, 'archive').mockRejectedValue(archiveError);
      mockDeps.errorHandler.handle.mockReturnValue(false); // エラー時は false を返す

      const result = await repository.delete('test1');
      expect(result).toBe(false); // errorHandler の戻り値
      expect(mockDeps.errorHandler.handle).toHaveBeenCalledWith(
        archiveError,
        'Repository',
        'delete',
        { entityName, id: 'test1' }
      );
      expect(mockDeps.storageService.writeJSON).not.toHaveBeenCalled();
      expect(mockDeps.eventEmitter.emitStandardized).not.toHaveBeenCalled();
    });

    test('should call errorHandler if writeJSON fails after archive', async () => {
      const writeError = new Error('Write error');
      mockDeps.storageService.writeJSON.mockRejectedValue(writeError);
      mockDeps.errorHandler.handle.mockReturnValue(false);

      const result = await repository.delete('test1');
      expect(result).toBe(false);
      expect(repository.archive).toHaveBeenCalledWith('test1'); // アーカイブは成功
      expect(mockDeps.errorHandler.handle).toHaveBeenCalledWith(
        writeError,
        'Repository',
        'delete',
        { entityName, id: 'test1' }
      );
      expect(mockDeps.eventEmitter.emitStandardized).not.toHaveBeenCalled();
    });

    test('should log error and rethrow if no errorHandler', async () => {
      const archiveError = new Error('Archive error');
      jest.spyOn(repository, 'archive').mockRejectedValue(archiveError);
      repository.errorHandler = undefined;

      await expect(repository.delete('test1')).rejects.toThrow(
        `Failed to delete ${entityName} with id test1: Archive error`
      );
      expect(mockDeps.logger.error).toHaveBeenCalledWith(
        `Failed to delete ${entityName} with id test1`,
        { error: archiveError }
      );
    });
  });

  describe('archive', () => {
    const entityToArchive = { id: 'test1', name: 'To Archive' };
    const mockTimestamp = '2025-03-30T12:00:00.000Z';

    beforeEach(() => {
      jest.spyOn(repository, 'getById').mockResolvedValue(entityToArchive);
      // Date.toISOString のモックは各テストケース内で行う
    });

    test('should archive entity to history directory', async () => {
      Date.prototype.toISOString = jest.fn(() => mockTimestamp); // モック設定
      const expectedFilename = `test1-${mockTimestamp.replace(/:/g, '-')}.json`;
      const result = await repository.archive('test1');
      expect(result).toBe(expectedFilename);
      expect(mockDeps.storageService.writeJSON).toHaveBeenCalledWith(
        `${repository.directory}/${repository.historyDirectory}`, // 正しいパスを期待
        expectedFilename,
        entityToArchive
      );
    });

    test('should throw NotFoundError if entity not found', async () => {
      jest.spyOn(repository, 'getById').mockResolvedValue(null);
      await expect(repository.archive('test1')).rejects.toThrow(NotFoundError);
      expect(mockDeps.storageService.writeJSON).not.toHaveBeenCalled();
    });

    test('should call errorHandler for NotFoundError', async () => {
      jest.spyOn(repository, 'getById').mockResolvedValue(null);
      mockDeps.errorHandler.handle.mockImplementation((err) => {
        throw err;
      });
      await expect(repository.archive('test1')).rejects.toThrow(NotFoundError);
      expect(mockDeps.errorHandler.handle).toHaveBeenCalledWith(
        expect.any(NotFoundError),
        'Repository',
        'archive',
        { entityName, id: 'test1' }
      );
    });

    test('should call errorHandler if writeJSON fails', async () => {
      const writeError = new Error('Write error');
      mockDeps.storageService.writeJSON.mockRejectedValue(writeError);
      mockDeps.errorHandler.handle.mockImplementation((err) => {
        throw err;
      });
      await expect(repository.archive('test1')).rejects.toThrow(writeError);
      expect(mockDeps.errorHandler.handle).toHaveBeenCalledWith(
        writeError,
        'Repository',
        'archive',
        { entityName, id: 'test1' }
      );
    });

    test('should log error and rethrow if no errorHandler', async () => {
      const writeError = new Error('Write error');
      mockDeps.storageService.writeJSON.mockRejectedValue(writeError);
      repository.errorHandler = undefined;
      await expect(repository.archive('test1')).rejects.toThrow(
        `Failed to archive ${entityName} with id test1: Write error`
      );
      expect(mockDeps.logger.error).toHaveBeenCalledWith(
        `Failed to archive ${entityName} with id test1`,
        { error: writeError }
      );
    });
  });

  // find, findOne, createMany, updateMany, deleteMany のテストも同様に
  // エラーハンドリングの検証を追加する (errorHandler の呼び出し、または logger.error と再スロー)
  describe('Find Operations Error Handling', () => {
    test('find should call errorHandler if getAll fails', async () => {
      const getAllError = new Error('Get all error');
      jest.spyOn(repository, 'getAll').mockRejectedValue(getAllError);
      mockDeps.errorHandler.handle.mockReturnValue([]); // エラー時は空配列

      const result = await repository.find(() => true);
      expect(result).toEqual([]);
      expect(mockDeps.errorHandler.handle).toHaveBeenCalledWith(
        getAllError,
        'Repository',
        'find',
        { entityName }
      );
    });

    test('findOne should call errorHandler if getAll fails', async () => {
      const getAllError = new Error('Get all error');
      jest.spyOn(repository, 'getAll').mockRejectedValue(getAllError);
      mockDeps.errorHandler.handle.mockReturnValue(null); // エラー時は null

      const result = await repository.findOne(() => true);
      expect(result).toBeNull();
      expect(mockDeps.errorHandler.handle).toHaveBeenCalledWith(
        getAllError,
        'Repository',
        'findOne',
        { entityName }
      );
    });

    // --- errorHandler なしの場合のテスト ---
    test('find should log error and rethrow if getAll fails and no errorHandler', async () => {
      const getAllError = new Error('Get all error');
      jest.spyOn(repository, 'getAll').mockRejectedValue(getAllError);
      repository.errorHandler = undefined;
      await expect(repository.find(() => true)).rejects.toThrow(
        `Failed to find ${entityName}s: Get all error`
      );
      expect(mockDeps.logger.error).toHaveBeenCalledWith(
        `Failed to find ${entityName}s`,
        { error: getAllError }
      );
    });

    test('findOne should log error and rethrow if getAll fails and no errorHandler', async () => {
      const getAllError = new Error('Get all error');
      jest.spyOn(repository, 'getAll').mockRejectedValue(getAllError);
      repository.errorHandler = undefined;
      await expect(repository.findOne(() => true)).rejects.toThrow(
        `Failed to find ${entityName}: Get all error`
      );
      expect(mockDeps.logger.error).toHaveBeenCalledWith(
        `Failed to find ${entityName}`,
        { error: getAllError }
      );
    });
    // --- ここまで errorHandler なしの場合のテスト ---
  });

  describe('Many Operations Error Handling', () => {
    test('createMany should call errorHandler if create fails', async () => {
      const createError = new Error('Create error');
      const dataArray = [{ id: 'test1' }];
      jest.spyOn(repository, 'create').mockRejectedValue(createError);
      mockDeps.errorHandler.handle.mockImplementation((err) => {
        throw err;
      });

      await expect(repository.createMany(dataArray)).rejects.toThrow(
        createError
      );
      expect(mockDeps.errorHandler.handle).toHaveBeenCalledWith(
        createError,
        'Repository',
        'createMany',
        { entityName, dataArray }
      );
    });

    test('updateMany should call errorHandler if update fails', async () => {
      const updateError = new Error('Update error');
      const updateArray = [{ id: 'test1', data: {} }];
      jest.spyOn(repository, 'update').mockRejectedValue(updateError);
      mockDeps.errorHandler.handle.mockImplementation((err) => {
        throw err;
      });

      await expect(repository.updateMany(updateArray)).rejects.toThrow(
        updateError
      );
      expect(mockDeps.errorHandler.handle).toHaveBeenCalledWith(
        updateError,
        'Repository',
        'updateMany',
        { entityName, updateArray }
      );
    });

    test('deleteMany should call errorHandler if delete fails', async () => {
      const deleteError = new Error('Delete error');
      const ids = ['test1'];
      jest.spyOn(repository, 'delete').mockRejectedValue(deleteError);
      mockDeps.errorHandler.handle.mockImplementation((err) => {
        throw err;
      });

      await expect(repository.deleteMany(ids)).rejects.toThrow(deleteError);
      expect(mockDeps.errorHandler.handle).toHaveBeenCalledWith(
        deleteError,
        'Repository',
        'deleteMany',
        { entityName, ids }
      );
    });

    // --- errorHandler なしの場合のテスト ---
    test('createMany should log error and rethrow if create fails and no errorHandler', async () => {
      const createError = new Error('Create error');
      const dataArray = [{ id: 'test1' }];
      jest.spyOn(repository, 'create').mockRejectedValue(createError);
      repository.errorHandler = undefined;
      await expect(repository.createMany(dataArray)).rejects.toThrow(
        `Failed to create many ${entityName}s: Create error`
      );
      expect(mockDeps.logger.error).toHaveBeenCalledWith(
        `Failed to create many ${entityName}s`,
        { error: createError }
      );
    });

    test('updateMany should log error and rethrow if update fails and no errorHandler', async () => {
      const updateError = new Error('Update error');
      const updateArray = [{ id: 'test1', data: {} }];
      jest.spyOn(repository, 'update').mockRejectedValue(updateError);
      repository.errorHandler = undefined;
      await expect(repository.updateMany(updateArray)).rejects.toThrow(
        `Failed to update many ${entityName}s: Update error`
      );
      expect(mockDeps.logger.error).toHaveBeenCalledWith(
        `Failed to update many ${entityName}s`,
        { error: updateError }
      );
    });

    test('deleteMany should log error and return results if delete fails and no errorHandler', async () => {
      const deleteError = new Error('Delete error');
      const ids = ['test1'];
      jest.spyOn(repository, 'delete').mockRejectedValue(deleteError);
      repository.errorHandler = undefined;
      // 修正: resolves.toEqual を使用して結果配列を検証
      await expect(repository.deleteMany(ids)).resolves.toEqual([
        { id: 'test1', success: false, error: deleteError.message },
      ]);
      expect(mockDeps.logger.error).toHaveBeenCalledWith(
        `Failed during deleteMany for id test1`, // ループ内でエラーが発生した場合のログ
        { error: deleteError }
      );
    });
    // --- ここまで errorHandler なしの場合のテスト ---
  });
});

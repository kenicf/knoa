/**
 * リポジトリクラスのテスト
 */

const { Repository, ValidationError, NotFoundError, DataConsistencyError } = require('../../../src/lib/data/repository');
const { createMockDependencies } = require('../../helpers/mock-factory');

describe('Repository', () => {
  let repository;
  let mockDeps;
  
  beforeEach(() => {
    mockDeps = createMockDependencies();
    repository = new Repository(mockDeps.storageService, 'test');
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('constructor', () => {
    test('should throw error if storageService is not provided', () => {
      expect(() => new Repository()).toThrow('Repository requires a storageService instance');
    });
    
    test('should create repository with default options', () => {
      expect(repository.entityName).toBe('test');
      expect(repository.directory).toBe('ai-context/tests');
      expect(repository.currentFile).toBe('current-test.json');
      expect(repository.historyDirectory).toBe('test-history');
      
      expect(mockDeps.storageService.ensureDirectoryExists).toHaveBeenCalledTimes(2);
      expect(mockDeps.storageService.ensureDirectoryExists).toHaveBeenCalledWith('ai-context/tests');
      expect(mockDeps.storageService.ensureDirectoryExists).toHaveBeenCalledWith('ai-context/tests/test-history');
    });
    
    test('should create repository with custom options', () => {
      const customOptions = {
        directory: 'custom-dir',
        currentFile: 'custom-file.json',
        historyDirectory: 'custom-history',
        validator: { validate: jest.fn() }
      };
      
      const customRepo = new Repository(mockDeps.storageService, 'custom', customOptions);
      
      expect(customRepo.entityName).toBe('custom');
      expect(customRepo.directory).toBe('custom-dir');
      expect(customRepo.currentFile).toBe('custom-file.json');
      expect(customRepo.historyDirectory).toBe('custom-history');
      expect(customRepo.validator).toBe(customOptions.validator);
      
      expect(mockDeps.storageService.ensureDirectoryExists).toHaveBeenCalledWith('custom-dir');
      expect(mockDeps.storageService.ensureDirectoryExists).toHaveBeenCalledWith('custom-dir/custom-history');
    });
  });
  
  describe('getAll', () => {
    test('should return empty collection if file does not exist', async () => {
      mockDeps.storageService.fileExists.mockReturnValue(false);
      
      const result = await repository.getAll();
      
      expect(result).toEqual({ tests: [] });
      expect(mockDeps.storageService.fileExists).toHaveBeenCalledWith('ai-context/tests', 'current-test.json');
      expect(mockDeps.storageService.readJSON).not.toHaveBeenCalled();
    });
    
    test('should return collection from file', async () => {
      const mockData = { tests: [{ id: 'test1' }, { id: 'test2' }] };
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue(mockData);
      
      const result = await repository.getAll();
      
      expect(result).toEqual(mockData);
      expect(mockDeps.storageService.fileExists).toHaveBeenCalledWith('ai-context/tests', 'current-test.json');
      expect(mockDeps.storageService.readJSON).toHaveBeenCalledWith('ai-context/tests', 'current-test.json');
    });
    
    test('should throw error if readJSON fails', async () => {
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockRejectedValue(new Error('Read error'));
      
      await expect(repository.getAll()).rejects.toThrow('Failed to get all tests: Read error');
    });
  });
  
  describe('getById', () => {
    test('should return null if entity not found', async () => {
      const mockData = { tests: [{ id: 'test1' }, { id: 'test2' }] };
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue(mockData);
      
      const result = await repository.getById('test3');
      
      expect(result).toBeNull();
    });
    
    test('should return entity if found', async () => {
      const mockEntity = { id: 'test1', name: 'Test 1' };
      const mockData = { tests: [mockEntity, { id: 'test2' }] };
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue(mockData);
      
      const result = await repository.getById('test1');
      
      expect(result).toEqual(mockEntity);
    });
    
    test('should return null if collection is not an array', async () => {
      const mockData = { tests: 'not an array' };
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue(mockData);
      
      const result = await repository.getById('test1');
      
      expect(result).toBeNull();
    });
  });
  
  describe('create', () => {
    test('should validate entity if validator is provided', async () => {
      const validator = { validate: jest.fn().mockReturnValue({ isValid: true }) };
      const repoWithValidator = new Repository(mockDeps.storageService, 'test', { validator });
      const mockEntity = { id: 'test1', name: 'Test 1' };
      
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue({ tests: [] });
      
      await repoWithValidator.create(mockEntity);
      
      expect(validator.validate).toHaveBeenCalledWith(mockEntity);
    });
    
    test('should throw ValidationError if validation fails', async () => {
      const validator = { 
        validate: jest.fn().mockReturnValue({ 
          isValid: false, 
          errors: ['Invalid entity'] 
        }) 
      };
      const repoWithValidator = new Repository(mockDeps.storageService, 'test', { validator });
      const mockEntity = { id: 'test1', name: 'Test 1' };
      
      await expect(repoWithValidator.create(mockEntity)).rejects.toThrow(ValidationError);
      expect(validator.validate).toHaveBeenCalledWith(mockEntity);
    });
    
    test('should throw DataConsistencyError if entity with same ID already exists', async () => {
      const mockEntity = { id: 'test1', name: 'Test 1' };
      const mockData = { tests: [{ id: 'test1' }] };
      
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue(mockData);
      
      await expect(repository.create(mockEntity)).rejects.toThrow(DataConsistencyError);
    });
    
    test('should create entity and save to file', async () => {
      const mockEntity = { id: 'test1', name: 'Test 1' };
      const mockData = { tests: [] };
      
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue(mockData);
      
      const result = await repository.create(mockEntity);
      
      expect(result).toEqual(mockEntity);
      expect(mockDeps.storageService.writeJSON).toHaveBeenCalledWith(
        'ai-context/tests',
        'current-test.json',
        { tests: [mockEntity] }
      );
    });
    
    test('should create entity with empty collection if file does not exist', async () => {
      const mockEntity = { id: 'test1', name: 'Test 1' };
      
      mockDeps.storageService.fileExists.mockReturnValue(false);
      
      const result = await repository.create(mockEntity);
      
      expect(result).toEqual(mockEntity);
      expect(mockDeps.storageService.writeJSON).toHaveBeenCalledWith(
        'ai-context/tests',
        'current-test.json',
        { tests: [mockEntity] }
      );
    });
  });
  
  describe('update', () => {
    test('should throw NotFoundError if entity not found', async () => {
      const mockData = { tests: [{ id: 'test1' }] };
      
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue(mockData);
      
      await expect(repository.update('test2', { name: 'Updated' })).rejects.toThrow(NotFoundError);
    });
    
    test('should update entity and save to file', async () => {
      const mockEntity = { id: 'test1', name: 'Test 1' };
      const mockData = { tests: [mockEntity] };
      const updateData = { name: 'Updated Test' };
      
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue(mockData);
      
      const result = await repository.update('test1', updateData);
      
      expect(result).toEqual({ id: 'test1', name: 'Updated Test' });
      expect(mockDeps.storageService.writeJSON).toHaveBeenCalledWith(
        'ai-context/tests',
        'current-test.json',
        { tests: [{ id: 'test1', name: 'Updated Test' }] }
      );
    });
    
    test('should validate entity if validator is provided', async () => {
      const validator = { validate: jest.fn().mockReturnValue({ isValid: true }) };
      const repoWithValidator = new Repository(mockDeps.storageService, 'test', { validator });
      const mockEntity = { id: 'test1', name: 'Test 1' };
      const mockData = { tests: [mockEntity] };
      const updateData = { name: 'Updated Test' };
      
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue(mockData);
      
      await repoWithValidator.update('test1', updateData);
      
      expect(validator.validate).toHaveBeenCalledWith({ id: 'test1', name: 'Updated Test' });
    });
  });
  
  describe('delete', () => {
    test('should throw NotFoundError if entity not found', async () => {
      const mockData = { tests: [{ id: 'test1' }] };
      
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue(mockData);
      
      await expect(repository.delete('test2')).rejects.toThrow(NotFoundError);
    });
    
    test('should archive and delete entity', async () => {
      const mockEntity = { id: 'test1', name: 'Test 1' };
      const mockData = { tests: [mockEntity, { id: 'test2' }] };
      
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue(mockData);
      
      // Mock archive method
      jest.spyOn(repository, 'archive').mockResolvedValue('test1-timestamp.json');
      
      const result = await repository.delete('test1');
      
      expect(result).toBe(true);
      expect(repository.archive).toHaveBeenCalledWith('test1');
      expect(mockDeps.storageService.writeJSON).toHaveBeenCalledWith(
        'ai-context/tests',
        'current-test.json',
        { tests: [{ id: 'test2' }] }
      );
    });
  });
  
  describe('archive', () => {
    test('should throw NotFoundError if entity not found', async () => {
      const mockData = { tests: [{ id: 'test1' }] };
      
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue(mockData);
      
      await expect(repository.archive('test2')).rejects.toThrow(NotFoundError);
    });
    
    test('should archive entity to history directory', async () => {
      const mockEntity = { id: 'test1', name: 'Test 1' };
      const mockData = { tests: [mockEntity] };
      
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue(mockData);
      
      // Mock Date.toISOString to return a fixed timestamp
      const originalDateToISOString = Date.prototype.toISOString;
      const mockTimestamp = '2025-03-22T12:00:00.000Z';
      Date.prototype.toISOString = jest.fn(() => mockTimestamp);
      
      const result = await repository.archive('test1');
      
      // Restore original Date.toISOString
      Date.prototype.toISOString = originalDateToISOString;
      
      const expectedFilename = `test1-${mockTimestamp.replace(/:/g, '-')}.json`;
      
      expect(result).toBe(expectedFilename);
      expect(mockDeps.storageService.writeJSON).toHaveBeenCalledWith(
        'ai-context/tests/test-history',
        expectedFilename,
        mockEntity
      );
    });
  });
  
  describe('find', () => {
    test('should return entities matching predicate', async () => {
      const mockData = { 
        tests: [
          { id: 'test1', status: 'active' },
          { id: 'test2', status: 'inactive' },
          { id: 'test3', status: 'active' }
        ] 
      };
      
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue(mockData);
      
      const result = await repository.find(entity => entity.status === 'active');
      
      expect(result).toEqual([
        { id: 'test1', status: 'active' },
        { id: 'test3', status: 'active' }
      ]);
    });
    
    test('should return empty array if no entities match predicate', async () => {
      const mockData = { 
        tests: [
          { id: 'test1', status: 'active' },
          { id: 'test2', status: 'inactive' }
        ] 
      };
      
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue(mockData);
      
      const result = await repository.find(entity => entity.status === 'deleted');
      
      expect(result).toEqual([]);
    });
  });
  
  describe('findOne', () => {
    test('should return first entity matching predicate', async () => {
      const mockData = { 
        tests: [
          { id: 'test1', status: 'active' },
          { id: 'test2', status: 'active' }
        ] 
      };
      
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue(mockData);
      
      const result = await repository.findOne(entity => entity.status === 'active');
      
      expect(result).toEqual({ id: 'test1', status: 'active' });
    });
    
    test('should return null if no entities match predicate', async () => {
      const mockData = { 
        tests: [
          { id: 'test1', status: 'active' },
          { id: 'test2', status: 'inactive' }
        ] 
      };
      
      mockDeps.storageService.fileExists.mockReturnValue(true);
      mockDeps.storageService.readJSON.mockResolvedValue(mockData);
      
      const result = await repository.findOne(entity => entity.status === 'deleted');
      
      expect(result).toBeNull();
    });
  });
  
  describe('createMany', () => {
    test('should create multiple entities', async () => {
      const mockEntities = [
        { id: 'test1', name: 'Test 1' },
        { id: 'test2', name: 'Test 2' }
      ];
      
      // Mock create method
      jest.spyOn(repository, 'create').mockImplementation(async (entity) => entity);
      
      const result = await repository.createMany(mockEntities);
      
      expect(result).toEqual(mockEntities);
      expect(repository.create).toHaveBeenCalledTimes(2);
      expect(repository.create).toHaveBeenCalledWith(mockEntities[0]);
      expect(repository.create).toHaveBeenCalledWith(mockEntities[1]);
    });
    
    test('should throw error if dataArray is not an array', async () => {
      await expect(repository.createMany('not an array')).rejects.toThrow('dataArray must be an array');
    });
  });
  
  describe('updateMany', () => {
    test('should update multiple entities', async () => {
      const updateArray = [
        { id: 'test1', data: { name: 'Updated Test 1' } },
        { id: 'test2', data: { name: 'Updated Test 2' } }
      ];
      
      // Mock update method
      jest.spyOn(repository, 'update').mockImplementation(async (id, data) => ({ id, ...data }));
      
      const result = await repository.updateMany(updateArray);
      
      expect(result).toEqual([
        { id: 'test1', name: 'Updated Test 1' },
        { id: 'test2', name: 'Updated Test 2' }
      ]);
      expect(repository.update).toHaveBeenCalledTimes(2);
      expect(repository.update).toHaveBeenCalledWith('test1', { name: 'Updated Test 1' });
      expect(repository.update).toHaveBeenCalledWith('test2', { name: 'Updated Test 2' });
    });
    
    test('should throw error if updateArray is not an array', async () => {
      await expect(repository.updateMany('not an array')).rejects.toThrow('updateArray must be an array');
    });
    
    test('should throw error if any item is missing id', async () => {
      const updateArray = [
        { id: 'test1', data: { name: 'Updated Test 1' } },
        { data: { name: 'Updated Test 2' } } // Missing id
      ];
      
      await expect(repository.updateMany(updateArray)).rejects.toThrow('Each update item must have an id');
    });
  });
  
  describe('deleteMany', () => {
    test('should delete multiple entities', async () => {
      const ids = ['test1', 'test2'];
      
      // Mock delete method
      jest.spyOn(repository, 'delete').mockImplementation(async (id) => true);
      
      const result = await repository.deleteMany(ids);
      
      expect(result).toEqual([
        { id: 'test1', success: true },
        { id: 'test2', success: true }
      ]);
      expect(repository.delete).toHaveBeenCalledTimes(2);
      expect(repository.delete).toHaveBeenCalledWith('test1');
      expect(repository.delete).toHaveBeenCalledWith('test2');
    });
    
    test('should handle errors for individual entities', async () => {
      const ids = ['test1', 'test2'];
      
      // Mock delete method to succeed for test1 and fail for test2
      jest.spyOn(repository, 'delete')
        .mockImplementationOnce(async () => true)
        .mockImplementationOnce(async () => { throw new Error('Delete error'); });
      
      const result = await repository.deleteMany(ids);
      
      expect(result).toEqual([
        { id: 'test1', success: true },
        { id: 'test2', success: false, error: 'Delete error' }
      ]);
    });
    
    test('should throw error if ids is not an array', async () => {
      await expect(repository.deleteMany('not an array')).rejects.toThrow('ids must be an array');
    });
  });
});
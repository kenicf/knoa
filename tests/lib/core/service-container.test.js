/**
 * サービスコンテナのテスト
 */

const ServiceContainer = require('../../../src/lib/core/service-container');

describe('ServiceContainer', () => {
  let container;

  beforeEach(() => {
    container = new ServiceContainer();
  });

  test('サービスを登録して取得できること', () => {
    const service = { name: 'test-service' };
    container.register('service', service);
    
    expect(container.get('service')).toBe(service);
  });

  test('ファクトリー関数を登録して取得できること', () => {
    const service = { name: 'factory-service' };
    container.registerFactory('service', () => service);
    
    expect(container.get('service')).toBe(service);
  });

  test('ファクトリー関数の結果がキャッシュされること', () => {
    let count = 0;
    container.registerFactory('service', () => {
      count++;
      return { count };
    });
    
    const service1 = container.get('service');
    const service2 = container.get('service');
    
    expect(service1).toBe(service2);
    expect(count).toBe(1);
  });

  test('ファクトリー関数にコンテナが渡されること', () => {
    container.register('dependency', 'dependency-value');
    
    container.registerFactory('service', (c) => {
      return {
        dependency: c.get('dependency')
      };
    });
    
    const service = container.get('service');
    expect(service.dependency).toBe('dependency-value');
  });

  test('循環参照が検出されること', () => {
    container.registerFactory('serviceA', (c) => c.get('serviceB'));
    container.registerFactory('serviceB', (c) => c.get('serviceC'));
    container.registerFactory('serviceC', (c) => c.get('serviceA'));
    
    expect(() => {
      container.get('serviceA');
    }).toThrow(/循環参照が検出されました/);
  });

  test('存在しないサービスを取得しようとするとエラーになること', () => {
    expect(() => {
      container.get('non-existent');
    }).toThrow(/サービス 'non-existent' が見つかりません/);
  });

  test('サービスの存在確認ができること', () => {
    container.register('service', {});
    container.registerFactory('factory-service', () => ({}));
    
    expect(container.has('service')).toBe(true);
    expect(container.has('factory-service')).toBe(true);
    expect(container.has('non-existent')).toBe(false);
  });

  test('サービスを削除できること', () => {
    container.register('service', {});
    expect(container.has('service')).toBe(true);
    
    container.remove('service');
    expect(container.has('service')).toBe(false);
  });

  test('すべてのサービスをクリアできること', () => {
    container.register('service1', {});
    container.register('service2', {});
    container.registerFactory('service3', () => ({}));
    
    container.clear();
    
    expect(container.has('service1')).toBe(false);
    expect(container.has('service2')).toBe(false);
    expect(container.has('service3')).toBe(false);
  });

  test('登録されているすべてのサービス名を取得できること', () => {
    container.register('service1', {});
    container.register('service2', {});
    container.registerFactory('service3', () => ({}));
    
    const names = container.getRegisteredServiceNames();
    
    expect(names).toContain('service1');
    expect(names).toContain('service2');
    expect(names).toContain('service3');
    expect(names.length).toBe(3);
  });
});
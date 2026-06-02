/**
 * tests/recommender.test.js
 * Tests unitarios para modules/recommender/index.js
 * Ejecutar con: npm test
 *
 * Cobertura: search_products, get_product_details, get_top_products
 * Requisito: ≥8 tests, 100% pass
 */

'use strict';

const {
  search_products,
  get_product_details,
  get_top_products,
} = require('../modules/recommender/index');

// ─── Constantes de referencia del catálogo ────────────────────────────────────
const TOTAL_PRODUCTS = 25;
const PRODUCTS_PER_CATEGORY = 5;
const CATEGORIES = ['Electrónica', 'Ropa', 'Hogar', 'Deportes', 'Libros'];

// ══════════════════════════════════════════════════════════════════════════════
// BLOQUE 1: search_products
// ══════════════════════════════════════════════════════════════════════════════

describe('search_products', () => {

  // TEST 1: Sin filtros devuelve todos los productos (hasta el límite por defecto)
  test('sin filtros devuelve hasta 10 productos del catálogo completo', () => {
    const result = search_products();
    expect(result).toHaveProperty('products');
    expect(result).toHaveProperty('total');
    expect(result.products.length).toBeLessThanOrEqual(10);
    expect(result.total).toBe(TOTAL_PRODUCTS);
  });

  // TEST 2: Filtro por categoría
  test('filtra correctamente por categoría "Electrónica"', () => {
    const result = search_products({ category: 'Electrónica' });
    expect(result.products.length).toBe(PRODUCTS_PER_CATEGORY);
    expect(result.total).toBe(PRODUCTS_PER_CATEGORY);
    result.products.forEach(p => {
      expect(p.category).toBe('Electrónica');
    });
  });

  // TEST 3: Filtro por precio máximo
  test('filtra por maxPrice devolviendo solo productos dentro del rango', () => {
    const maxPrice = 50;
    const result = search_products({ maxPrice });
    result.products.forEach(p => {
      expect(p.price).toBeLessThanOrEqual(maxPrice);
    });
    expect(result.products.length).toBeGreaterThan(0);
  });

  // TEST 4: Filtro por precio mínimo
  test('filtra por minPrice devolviendo solo productos iguales o más caros', () => {
    const minPrice = 200;
    const result = search_products({ minPrice });
    result.products.forEach(p => {
      expect(p.price).toBeGreaterThanOrEqual(minPrice);
    });
    expect(result.products.length).toBeGreaterThan(0);
  });

  // TEST 5: Filtro combinado (categoría + precio máximo) — caso clave del enunciado
  test('filtra combinando categoría "Ropa" y maxPrice 100€', () => {
    const result = search_products({ category: 'Ropa', maxPrice: 100 });
    expect(result.products.length).toBeGreaterThan(0);
    result.products.forEach(p => {
      expect(p.category).toBe('Ropa');
      expect(p.price).toBeLessThanOrEqual(100);
    });
  });

  // TEST 6: Búsqueda por query de texto libre (nombre)
  test('busca por query "auriculares" y devuelve productos relevantes', () => {
    const result = search_products({ query: 'auriculares' });
    expect(result.products.length).toBeGreaterThan(0);
    result.products.forEach(p => {
      const haystack = (p.name + ' ' + p.description + ' ' + p.category).toLowerCase();
      // al menos debe coincidir la búsqueda normalizada
      expect(haystack).toMatch(/auricular/i);
    });
  });

  // TEST 7: Búsqueda que no devuelve resultados (vacío)
  test('devuelve array vacío si la búsqueda no tiene resultados', () => {
    const result = search_products({ query: 'producto_que_no_existe_xyz123' });
    expect(result.products).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  // TEST 8: Respeta el parámetro limit
  test('respeta el límite de resultados especificado', () => {
    const result = search_products({ limit: 3 });
    expect(result.products.length).toBeLessThanOrEqual(3);
    expect(result.total).toBe(TOTAL_PRODUCTS); // total siempre refleja el total real
  });

  // TEST 9: Filtro por minRating
  test('filtra por minRating devolviendo solo productos con valoración suficiente', () => {
    const minRating = 4.7;
    const result = search_products({ minRating, limit: 25 });
    result.products.forEach(p => {
      expect(p.rating).toBeGreaterThanOrEqual(minRating);
    });
    expect(result.products.length).toBeGreaterThan(0);
  });

  // TEST 10: Búsqueda con tilde y sin tilde da los mismos resultados (normalización)
  test('normalización de texto: "Electronica" y "Electrónica" son equivalentes', () => {
    const conTilde = search_products({ query: 'Electrónica' });
    const sinTilde = search_products({ query: 'Electronica' });
    expect(conTilde.total).toBe(sinTilde.total);
  });

  // TEST 11: Los resultados siempre tienen la estructura correcta
  test('cada producto en el resultado tiene las propiedades requeridas', () => {
    const result = search_products({ limit: 25 });
    result.products.forEach(p => {
      expect(p).toHaveProperty('id');
      expect(p).toHaveProperty('name');
      expect(p).toHaveProperty('category');
      expect(p).toHaveProperty('price');
      expect(p).toHaveProperty('rating');
      expect(p).toHaveProperty('stock');
      expect(p).toHaveProperty('description');
    });
  });

});

// ══════════════════════════════════════════════════════════════════════════════
// BLOQUE 2: get_product_details
// ══════════════════════════════════════════════════════════════════════════════

describe('get_product_details', () => {

  // TEST 12: ID válido devuelve el producto correcto
  test('con ID válido devuelve el objeto producto completo', () => {
    const product = get_product_details('prod-elec-001');
    expect(product).not.toBeNull();
    expect(product.id).toBe('prod-elec-001');
    expect(product.name).toBe('Auriculares Sony WH-1000XM5');
    expect(product.category).toBe('Electrónica');
    expect(typeof product.price).toBe('number');
    expect(typeof product.rating).toBe('number');
  });

  // TEST 13: ID inválido devuelve null
  test('con ID inexistente devuelve null', () => {
    const product = get_product_details('id-que-no-existe');
    expect(product).toBeNull();
  });

  // TEST 14: Sin argumento devuelve null
  test('sin argumento devuelve null (no lanza error)', () => {
    expect(() => get_product_details()).not.toThrow();
    expect(get_product_details()).toBeNull();
  });

  // TEST 15: ID con espacios extra se normaliza correctamente
  test('ID con espacios extra al inicio/fin se maneja correctamente', () => {
    const product = get_product_details('  prod-lib-001  ');
    expect(product).not.toBeNull();
    expect(product.name).toBe('Dune - Frank Herbert');
  });

});

// ══════════════════════════════════════════════════════════════════════════════
// BLOQUE 3: get_top_products
// ══════════════════════════════════════════════════════════════════════════════

describe('get_top_products', () => {

  // TEST 16: Sin parámetros devuelve los 5 mejores del catálogo completo
  test('sin parámetros devuelve los 5 productos con mayor rating', () => {
    const result = get_top_products();
    expect(result.products).toHaveLength(5);
    // Verificar que están ordenados por rating descendente
    for (let i = 0; i < result.products.length - 1; i++) {
      expect(result.products[i].rating).toBeGreaterThanOrEqual(result.products[i + 1].rating);
    }
  });

  // TEST 17: Filtrado por categoría
  test('filtra por categoría "Deportes" y devuelve solo productos de esa categoría', () => {
    const result = get_top_products({ category: 'Deportes', limit: 10 });
    expect(result.products.length).toBe(PRODUCTS_PER_CATEGORY);
    result.products.forEach(p => {
      expect(p.category).toBe('Deportes');
    });
  });

  // TEST 18: Ordenación por precio ascendente
  test('sortBy price_asc ordena de menor a mayor precio', () => {
    const result = get_top_products({ sortBy: 'price_asc', limit: 25 });
    for (let i = 0; i < result.products.length - 1; i++) {
      expect(result.products[i].price).toBeLessThanOrEqual(result.products[i + 1].price);
    }
  });

  // TEST 19: Ordenación por precio descendente
  test('sortBy price_desc ordena de mayor a menor precio', () => {
    const result = get_top_products({ sortBy: 'price_desc', limit: 25 });
    for (let i = 0; i < result.products.length - 1; i++) {
      expect(result.products[i].price).toBeGreaterThanOrEqual(result.products[i + 1].price);
    }
  });

  // TEST 20: Respeta el límite
  test('respeta el parámetro limit correctamente', () => {
    const result = get_top_products({ limit: 2 });
    expect(result.products).toHaveLength(2);
  });

});

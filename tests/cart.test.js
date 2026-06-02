/**
 * tests/cart.test.js
 * Tests unitarios para el módulo de carrito de compras modules/cart/index.js
 * Ejecutar con: npm test
 *
 * Cobertura: add_to_cart, remove_from_cart, view_cart, clear_cart
 * Requisito: ≥6 tests, 100% pass
 */

'use strict';

const {
  add_to_cart,
  remove_from_cart,
  view_cart,
  clear_cart
} = require('../modules/cart/index');

describe('Módulo de Carrito de Compras', () => {

  // Limpiar el carrito antes de cada test para asegurar la independencia
  beforeEach(() => {
    clear_cart();
  });

  // TEST 1: Añadir producto al carrito vacío
  test('añade un producto válido al carrito vacío y calcula totales correctamente', () => {
    const result = add_to_cart('prod-elec-001', 2);
    
    expect(result.success).toBe(true);
    expect(result.message).toContain('Añadido "Auriculares Sony WH-1000XM5"');
    
    const cart = view_cart();
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]).toEqual({
      productId: 'prod-elec-001',
      name: 'Auriculares Sony WH-1000XM5',
      price: 279.99,
      quantity: 2
    });
    expect(cart.total).toBe(559.98); // 279.99 * 2
    expect(cart.itemCount).toBe(2);
  });

  // TEST 2: Añadir producto repetido (suma cantidad, no duplica línea)
  test('añade producto repetido incrementando la cantidad existente sin duplicar la línea', () => {
    add_to_cart('prod-elec-001', 1);
    const result = add_to_cart('prod-elec-001', 3);

    expect(result.success).toBe(true);
    
    const cart = view_cart();
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].quantity).toBe(4);
    expect(cart.total).toBe(1119.96); // 279.99 * 4
    expect(cart.itemCount).toBe(4);
  });

  // TEST 3: Añadir producto inexistente (error gracefully)
  test('falla al intentar añadir un producto con un ID inexistente', () => {
    const result = add_to_cart('id-inexistente-xyz', 1);

    expect(result.success).toBe(false);
    expect(result.error).toContain('no existe en nuestro catálogo');

    const cart = view_cart();
    expect(cart.items).toHaveLength(0);
    expect(cart.total).toBe(0);
    expect(cart.itemCount).toBe(0);
  });

  // TEST 4: Añadir superando stock
  test('falla al intentar añadir una cantidad que supera el stock disponible en catálogo', () => {
    // prod-elec-001 tiene stock: 12 en catalog.json
    const result = add_to_cart('prod-elec-001', 15);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Stock insuficiente');

    const cart = view_cart();
    expect(cart.items).toHaveLength(0);
  });

  // TEST 5: Añadir de forma acumulada superando stock
  test('falla al añadir de forma incremental si la cantidad final supera el stock', () => {
    add_to_cart('prod-elec-001', 10);
    const result = add_to_cart('prod-elec-001', 5); // total sería 15, supera stock de 12

    expect(result.success).toBe(false);
    expect(result.error).toContain('Ya tienes 10 unidad(es) en el carrito y solo puedes añadir 2 más');

    const cart = view_cart();
    expect(cart.items[0].quantity).toBe(10); // permanece en 10
  });

  // TEST 6: Cantidades no válidas
  test('falla al intentar añadir cantidades menores o iguales a cero o no numéricas', () => {
    expect(add_to_cart('prod-elec-001', 0).success).toBe(false);
    expect(add_to_cart('prod-elec-001', -5).success).toBe(false);
    expect(add_to_cart('prod-elec-001', 'muchos').success).toBe(false);
  });

  // TEST 7: Eliminar producto
  test('elimina correctamente un producto del carrito y actualiza totales', () => {
    add_to_cart('prod-elec-001', 2);
    add_to_cart('prod-ropa-001', 1); // 119.00 EUR, stock: 15

    const result = remove_from_cart('prod-elec-001');
    expect(result.success).toBe(true);
    expect(result.message).toContain('Eliminado "Auriculares Sony WH-1000XM5"');

    const cart = view_cart();
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].productId).toBe('prod-ropa-001');
    expect(cart.total).toBe(119.00);
    expect(cart.itemCount).toBe(1);
  });

  // TEST 8: Eliminar producto no existente en carrito
  test('falla al intentar eliminar del carrito un producto que no está agregado', () => {
    add_to_cart('prod-elec-001', 1);
    const result = remove_from_cart('prod-ropa-001');

    expect(result.success).toBe(false);
    expect(result.error).toContain('no está en el carrito');

    const cart = view_cart();
    expect(cart.items).toHaveLength(1);
  });

  // TEST 9: Ver carrito vacío
  test('view_cart devuelve la estructura vacía inicialmente', () => {
    const cart = view_cart();
    expect(cart.items).toHaveLength(0);
    expect(cart.total).toBe(0);
    expect(cart.itemCount).toBe(0);
  });

  // TEST 10: Limpiar carrito
  test('clear_cart vacía el carrito completamente y resetea totales a cero', () => {
    add_to_cart('prod-elec-001', 2);
    add_to_cart('prod-ropa-001', 1);

    const result = clear_cart();
    expect(result.success).toBe(true);

    const cart = view_cart();
    expect(cart.items).toHaveLength(0);
    expect(cart.total).toBe(0);
    expect(cart.itemCount).toBe(0);
  });

});

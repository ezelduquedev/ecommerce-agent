/**
 * tests/orders.test.js
 * Tests unitarios para el módulo de pedidos modules/orders/index.js
 * Utiliza mocks de Jest para emular lowdb evitando problemas de carga ESM en Jest.
 *
 * Cobertura: create_order, get_order_status, cancel_order, list_orders
 * Requisito: ≥8 tests, 100% pass
 */

'use strict';

// ─── Mock de Lowdb para Jest ─────────────────────────────────────────────────
let mockDbData = { orders: [] };

jest.mock('lowdb', () => {
  return {
    Low: jest.fn().mockImplementation((adapter, defaultData) => {
      return {
        get data() {
          return mockDbData;
        },
        set data(val) {
          mockDbData = val;
        },
        read: jest.fn().mockImplementation(async () => {
          if (!mockDbData) {
            mockDbData = defaultData || { orders: [] };
          }
          return Promise.resolve();
        }),
        write: jest.fn().mockImplementation(async () => {
          return Promise.resolve();
        })
      };
    })
  };
});

jest.mock('lowdb/node', () => {
  return {
    JSONFile: jest.fn().mockImplementation((filePath) => {
      return {
        filePath
      };
    })
  };
});

// Importar módulo de orders (se resolverá usando las librerías mockeadas)
const {
  create_order,
  get_order_status,
  cancel_order,
  list_orders,
  setDatabasePath
} = require('../modules/orders/index');

describe('Módulo de Pedidos y Persistencia (Con Mocks de Lowdb)', () => {

  beforeEach(() => {
    // Resetear los datos en memoria del mock antes de cada prueba
    mockDbData = { orders: [] };
    setDatabasePath('mock-db-path.json');
  });

  // Helper para modificar el estado de un pedido directamente en memoria
  function forceOrderStatusInMemory(orderId, newStatus) {
    const order = mockDbData.orders.find(o => o.id === orderId);
    if (order) {
      order.status = newStatus;
    }
  }

  // TEST 1: Crear pedido con ítem válido
  test('crea un pedido correctamente con un carrito válido y calcula totales', async () => {
    const cartItems = [{ productId: 'prod-elec-001', quantity: 2 }];
    const result = await create_order(cartItems);

    expect(result.success).toBe(true);
    expect(result.orderId).toMatch(/^ORD-\d{8}-0001$/);
    expect(result.status).toBe('pendiente');
    expect(result.total).toBe(559.98); // 279.99 * 2

    const statusResult = await get_order_status(result.orderId);
    expect(statusResult.success).toBe(true);
    expect(statusResult.order.items).toHaveLength(1);
    expect(statusResult.order.items[0].name).toBe('Auriculares Sony WH-1000XM5');
  });

  // TEST 2: Fallar al crear pedido con carrito vacío
  test('falla al intentar crear un pedido si el carrito de compra está vacío', async () => {
    const result = await create_order([]);
    expect(result.success).toBe(false);
    expect(result.error).toContain('vacío o el formato de ítems no es válido');
  });

  // TEST 3: Fallar al crear pedido con producto inexistente
  test('falla al intentar crear un pedido si el producto no existe en el catálogo', async () => {
    const result = await create_order([{ productId: 'prod-no-existe', quantity: 1 }]);
    expect(result.success).toBe(false);
    expect(result.error).toContain('no existe en nuestro catálogo');
  });

  // TEST 4: Fallar al crear pedido por exceso de stock
  test('falla al intentar crear un pedido si la cantidad supera el stock del catálogo', async () => {
    // prod-elec-001 tiene stock de 12 en catalog.json
    const result = await create_order([{ productId: 'prod-elec-001', quantity: 15 }]);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Stock insuficiente');
  });

  // TEST 5: Generación de IDs secuenciales
  test('genera identificadores de pedidos correlativos e incrementales', async () => {
    const cart1 = [{ productId: 'prod-elec-001', quantity: 1 }];
    const cart2 = [{ productId: 'prod-ropa-001', quantity: 1 }];

    const res1 = await create_order(cart1);
    const res2 = await create_order(cart2);

    expect(res1.orderId).toMatch(/-0001$/);
    expect(res2.orderId).toMatch(/-0002$/);
  });

  // TEST 6: Consultar estado de pedido inexistente
  test('falla al consultar el estado de un pedido con un ID que no existe', async () => {
    const result = await get_order_status('ORD-99999999-9999');
    expect(result.success).toBe(false);
    expect(result.error).toContain('no fue encontrado');
  });

  // TEST 7: Cancelar pedido pendiente
  test('cancela correctamente un pedido en estado pendiente', async () => {
    const res = await create_order([{ productId: 'prod-elec-001', quantity: 1 }]);
    const orderId = res.orderId;

    const cancelRes = await cancel_order(orderId);
    expect(cancelRes.success).toBe(true);
    expect(cancelRes.message).toContain('cancelado con éxito');
    expect(cancelRes.order.status).toBe('cancelado');

    const checkRes = await get_order_status(orderId);
    expect(checkRes.order.status).toBe('cancelado');
  });

  // TEST 8: Rechazar cancelación de pedido enviado
  test('rechaza la cancelación de un pedido si su estado actual es enviado', async () => {
    const res = await create_order([{ productId: 'prod-elec-001', quantity: 1 }]);
    const orderId = res.orderId;

    // Forzar el estado a enviado para emular el procesamiento
    forceOrderStatusInMemory(orderId, 'enviado');

    const cancelRes = await cancel_order(orderId);
    expect(cancelRes.success).toBe(false);
    expect(cancelRes.error).toContain('porque su estado actual es "enviado"');

    const checkRes = await get_order_status(orderId);
    expect(checkRes.order.status).toBe('enviado');
  });

  // TEST 9: Rechazar cancelación de pedido completado
  test('rechaza la cancelación de un pedido si su estado actual es completado', async () => {
    const res = await create_order([{ productId: 'prod-elec-001', quantity: 1 }]);
    const orderId = res.orderId;

    // Forzar el estado a completado
    forceOrderStatusInMemory(orderId, 'completado');

    const cancelRes = await cancel_order(orderId);
    expect(cancelRes.success).toBe(false);
    expect(cancelRes.error).toContain('porque su estado actual es "completado"');
  });

  // TEST 10: Listar pedidos
  test('lista correctamente todos los pedidos creados', async () => {
    await create_order([{ productId: 'prod-elec-001', quantity: 1 }]);
    await create_order([{ productId: 'prod-ropa-001', quantity: 1 }]);

    const listRes = await list_orders();
    expect(listRes.success).toBe(true);
    expect(listRes.orders).toHaveLength(2);
  });

});

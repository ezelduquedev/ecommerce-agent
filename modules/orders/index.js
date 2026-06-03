/**
 * modules/orders/index.js
 * Módulo de gestión y persistencia de pedidos para el Agente de E-commerce.
 * Utiliza lowdb para almacenar y actualizar pedidos en formato JSON en disco.
 *
 * Funciones exportadas:
 *   - create_order(cartItems)       → Crea un pedido en estado 'pendiente' y vacía el carrito
 *   - get_order_status(orderId)     → Obtiene el detalle y estado de un pedido
 *   - cancel_order(orderId)         → Cancela el pedido (solo si está 'pendiente')
 *   - list_orders()                 → Devuelve todos los pedidos registrados
 *   - setDatabasePath(path)         → Permite cambiar la ruta del archivo JSON (útil en tests)
 */

'use strict';

const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const path = require('path');
const catalog = require('../../data/catalog.json');

let db = null;
let currentDbPath = null;

/**
 * Inicializa de forma perezosa (lazy) la base de datos lowdb.
 *
 * @param {string} [customPath] - Ruta opcional para sobreescribir el path por defecto
 * @returns {Promise<Low>} Instancia de la base de datos inicializada
 */
async function initDb(customPath) {
  const dbPath = customPath || currentDbPath || path.resolve(__dirname, '../../db/db.json');
  
  // Si ya está inicializada para esa ruta específica, la devolvemos
  if (db && currentDbPath === dbPath) {
    return db;
  }

  currentDbPath = dbPath;
  const adapter = new JSONFile(dbPath);
  db = new Low(adapter, { orders: [] });

  await db.read();
  
  // Asegurar estructura
  db.data ||= { orders: [] };
  if (!db.data.orders) {
    db.data.orders = [];
  }
  await db.write();

  return db;
}

/**
 * Configura una ruta de base de datos específica (principalmente para aislar los tests).
 *
 * @param {string} filePath - Ruta absoluta del archivo de pruebas
 */
function setDatabasePath(filePath) {
  db = null; // Fuerza reinicialización en la siguiente llamada a initDb
  currentDbPath = filePath;
}

/**
 * Genera un identificador secuencial único para el pedido en formato ORD-YYYYMMDD-XXXX.
 *
 * @param {Array} orders - Lista de todos los pedidos en la base de datos
 * @returns {string} ID autoincremental generado
 */
function generateOrderId(orders) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  // Filtrar pedidos del mismo día
  const prefix = `ORD-${dateStr}-`;
  const todaysOrders = orders.filter(o => o.id.startsWith(prefix));

  // Obtener el número máximo secuencial del día
  let maxSeq = 0;
  for (const o of todaysOrders) {
    const seqPart = o.id.substring(prefix.length);
    const seqNum = parseInt(seqPart, 10);
    if (!isNaN(seqNum) && seqNum > maxSeq) {
      maxSeq = seqNum;
    }
  }

  const nextSeq = String(maxSeq + 1).padStart(4, '0');
  return `${prefix}${nextSeq}`;
}

// ─── Funciones Públicas del Módulo ────────────────────────────────────────────

/**
 * Crea un nuevo pedido a partir de una lista de ítems del carrito.
 * Valida stock del catálogo para cada ítem antes de crear la orden.
 *
 * @param {Array} cartItems - Lista de ítems: Array<{ productId, quantity }>
 * @returns {Promise<Object>} Resultado de la creación
 */
async function create_order(cartItems) {
  const database = await initDb();

  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    return {
      success: false,
      error: 'El carrito de compra está vacío o el formato de ítems no es válido.'
    };
  }

  const orderItems = [];
  let total = 0;
  let itemCount = 0;

  // 1. Validar productos y stock de catálogo de forma estricta
  for (const item of cartItems) {
    const product = catalog.find(p => p.id === item.productId);
    if (!product) {
      return {
        success: false,
        error: `El producto con ID "${item.productId}" no existe en nuestro catálogo.`
      };
    }

    if (item.quantity <= 0) {
      return {
        success: false,
        error: `La cantidad solicitada para "${product.name}" debe ser mayor que cero.`
      };
    }

    if (item.quantity > product.stock) {
      return {
        success: false,
        error: `Stock insuficiente para crear el pedido de "${product.name}". Disponible en catálogo: ${product.stock}.`
      };
    }

    const price = product.price;
    const subtotal = price * item.quantity;
    
    orderItems.push({
      productId: product.id,
      name: product.name,
      price: price,
      quantity: item.quantity
    });

    total += subtotal;
    itemCount += item.quantity;
  }

  // 2. Generar el ID y construir el pedido
  const orderId = generateOrderId(database.data.orders);
  const newOrder = {
    id: orderId,
    date: new Date().toISOString(),
    status: 'pendiente',
    items: orderItems,
    total: Math.round(total * 100) / 100,
    itemCount: itemCount
  };

  // 3. Persistir en la base de datos
  database.data.orders.push(newOrder);
  await database.write();

  return {
    success: true,
    orderId: newOrder.id,
    status: newOrder.status,
    total: newOrder.total,
    message: `Pedido creado correctamente. Código de seguimiento: ${newOrder.id}`
  };
}

/**
 * Consulta la información completa de un pedido por su ID.
 *
 * @param {string} orderId - ID del pedido a buscar
 * @returns {Promise<Object>} Detalle del pedido o error
 */
async function get_order_status(orderId) {
  const database = await initDb();

  if (!orderId) {
    return {
      success: false,
      error: 'Debe proporcionarse un ID de pedido válido.'
    };
  }

  const order = database.data.orders.find(o => o.id === orderId.trim());
  if (!order) {
    return {
      success: false,
      error: `El pedido con ID "${orderId}" no fue encontrado en nuestra base de datos.`
    };
  }

  return {
    success: true,
    order
  };
}

/**
 * Cancela un pedido existente. Solo permite la cancelación si el pedido está 'pendiente'.
 *
 * @param {string} orderId - ID del pedido a cancelar
 * @returns {Promise<Object>} Resultado de la cancelación
 */
async function cancel_order(orderId) {
  const database = await initDb();

  if (!orderId) {
    return {
      success: false,
      error: 'Debe proporcionarse un ID de pedido válido.'
    };
  }

  const order = database.data.orders.find(o => o.id === orderId.trim());
  if (!order) {
    return {
      success: false,
      error: `El pedido con ID "${orderId}" no existe.`
    };
  }

  // Validaciones del estado actual
  if (order.status === 'cancelado') {
    return {
      success: false,
      error: `El pedido "${orderId}" ya se encuentra cancelado.`
    };
  }

  if (order.status === 'enviado' || order.status === 'completado') {
    return {
      success: false,
      error: `No es posible cancelar el pedido "${orderId}" porque su estado actual es "${order.status}".`
    };
  }

  // Modificar estado a cancelado
  order.status = 'cancelado';
  await database.write();

  return {
    success: true,
    message: `El pedido "${orderId}" ha sido cancelado con éxito.`,
    order
  };
}

/**
 * Devuelve el listado completo de pedidos guardados.
 *
 * @returns {Promise<Object>} Lista de pedidos
 */
async function list_orders() {
  const database = await initDb();
  return {
    success: true,
    orders: database.data.orders
  };
}

module.exports = {
  create_order,
  get_order_status,
  cancel_order,
  list_orders,
  setDatabasePath
};

/**
 * modules/cart/index.js
 * Módulo de carrito de compras en memoria para el Agente de E-commerce.
 *
 * Funciones exportadas:
 *   - add_to_cart(productId, quantity)  → añade producto validando stock
 *   - remove_from_cart(productId)       → elimina producto
 *   - view_cart()                       → muestra items, total e itemCount
 *   - clear_cart()                      → vacía el carrito
 */

'use strict';

const catalog = require('../../data/catalog.json');

// ─── Estado del Carrito en Memoria (Sesión Volátil) ───────────────────────────
let cart = {
  items: [],      // Elementos en el carrito: { productId, name, price, quantity }
  total: 0,       // Total en EUR
  itemCount: 0    // Total de unidades físicas
};

// ─── Utilidades Internas ──────────────────────────────────────────────────────

/**
 * Recalcula el total del carrito y el número total de ítems.
 */
function recalculateTotals() {
  let newTotal = 0;
  let newCount = 0;

  for (const item of cart.items) {
    newTotal += item.price * item.quantity;
    newCount += item.quantity;
  }

  // Redondear a 2 decimales para evitar problemas de precisión en coma flotante
  cart.total = Math.round(newTotal * 100) / 100;
  cart.itemCount = newCount;
}

// ─── Funciones Públicas del Módulo ────────────────────────────────────────────

/**
 * Añade una cantidad de un producto al carrito tras realizar validaciones de existencia y stock.
 *
 * @param {string} productId - ID del producto a añadir (ej: "prod-elec-001")
 * @param {number} quantity - Unidades físicas a añadir (debe ser >= 1)
 * @returns {Object} Resultado de la operación: { success: boolean, message?: string, error?: string, cart: Object }
 */
function add_to_cart(productId, quantity) {
  const qty = parseInt(quantity);
  if (isNaN(qty) || qty <= 0) {
    return {
      success: false,
      error: 'La cantidad debe ser un número entero mayor que cero.',
      cart
    };
  }

  if (!productId) {
    return {
      success: false,
      error: 'Debe especificarse un ID de producto válido.',
      cart
    };
  }

  // 1. Validar existencia del producto en el catálogo
  const product = catalog.find(p => p.id === productId.trim());
  if (!product) {
    return {
      success: false,
      error: `El producto con ID "${productId}" no existe en nuestro catálogo.`,
      cart
    };
  }

  // 2. Comprobar si ya está en el carrito para verificar stock acumulado
  const existingItem = cart.items.find(item => item.productId === product.id);
  const currentQtyInCart = existingItem ? existingItem.quantity : 0;
  const targetQty = currentQtyInCart + qty;

  // 3. Validar stock disponible
  if (targetQty > product.stock) {
    const availableToAdd = product.stock - currentQtyInCart;
    return {
      success: false,
      error: `Stock insuficiente para "${product.name}". Stock disponible total: ${product.stock}. ` +
             (currentQtyInCart > 0 
               ? `Ya tienes ${currentQtyInCart} unidad(es) en el carrito y solo puedes añadir ${availableToAdd} más.`
               : `No puedes añadir la cantidad solicitada.`),
      cart
    };
  }

  // 4. Inserción o actualización en el carrito
  if (existingItem) {
    existingItem.quantity = targetQty;
  } else {
    cart.items.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: qty
    });
  }

  // 5. Recalcular totales y retornar
  recalculateTotals();

  return {
    success: true,
    message: `Añadido "${product.name}" al carrito (cantidad: ${qty}).`,
    cart
  };
}

/**
 * Elimina completamente un producto del carrito.
 *
 * @param {string} productId - ID del producto a eliminar
 * @returns {Object} Resultado de la operación: { success: boolean, message: string, cart: Object }
 */
function remove_from_cart(productId) {
  if (!productId) {
    return {
      success: false,
      error: 'Debe especificarse un ID de producto válido.',
      cart
    };
  }

  const normalizedId = productId.trim();
  const index = cart.items.findIndex(item => item.productId === normalizedId);

  if (index === -1) {
    return {
      success: false,
      error: `El producto con ID "${productId}" no está en el carrito.`,
      cart
    };
  }

  const productName = cart.items[index].name;
  cart.items.splice(index, 1);

  recalculateTotals();

  return {
    success: true,
    message: `Eliminado "${productName}" del carrito por completo.`,
    cart
  };
}

/**
 * Obtiene el estado actual del carrito de compras.
 *
 * @returns {Object} Estado del carrito: { items: Array, total: number, itemCount: number }
 */
function view_cart() {
  return cart;
}

/**
 * Vacía completamente el carrito restableciendo totales.
 *
 * @returns {Object} Estado del carrito reseteado: { success: boolean, message: string, cart: Object }
 */
function clear_cart() {
  cart.items = [];
  cart.total = 0;
  cart.itemCount = 0;

  return {
    success: true,
    message: 'El carrito ha sido vaciado completamente.',
    cart
  };
}

module.exports = {
  add_to_cart,
  remove_from_cart,
  view_cart,
  clear_cart
};

/**
 * modules/cart/index.js
 * Módulo de carrito de compras con PERSISTENCIA en disco (db/cart.json).
 *
 * El estado del carrito se guarda automáticamente en cada operación y se
 * restaura al iniciar el servidor, sobreviviendo a reinicios.
 *
 * Funciones exportadas:
 *   - add_to_cart(productId, quantity)  → añade producto validando stock
 *   - remove_from_cart(productId)       → elimina producto
 *   - view_cart()                       → muestra items, total e itemCount
 *   - clear_cart()                      → vacía el carrito
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { getCatalog } = require('../catalog');

// ─── Ruta de persistencia ─────────────────────────────────────────────────────
const CART_FILE = path.resolve(__dirname, '../../db/cart.json');

// ─── Estado del Carrito ───────────────────────────────────────────────────────
let cart = {
  items:     [],
  total:     0,
  itemCount: 0
};

// ─── Carga inicial desde disco ────────────────────────────────────────────────
(function loadCart() {
  try {
    if (fs.existsSync(CART_FILE)) {
      const raw = fs.readFileSync(CART_FILE, 'utf8');
      const saved = JSON.parse(raw);
      if (saved && Array.isArray(saved.items)) {
        cart = saved;
      }
    }
  } catch {
    // Si el archivo está corrupto arrancamos con carrito vacío
    cart = { items: [], total: 0, itemCount: 0 };
  }
})();

// ─── Persistencia ─────────────────────────────────────────────────────────────
function saveCart() {
  try {
    const dir = path.dirname(CART_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CART_FILE, JSON.stringify(cart, null, 2), 'utf8');
  } catch (e) {
    console.error('[cart] Error al guardar carrito en disco:', e.message);
  }
}

// ─── Utilidades Internas ──────────────────────────────────────────────────────
function recalculateTotals() {
  let newTotal = 0;
  let newCount = 0;
  for (const item of cart.items) {
    newTotal += item.price * item.quantity;
    newCount += item.quantity;
  }
  cart.total     = Math.round(newTotal * 100) / 100;
  cart.itemCount = newCount;
}

// ─── Funciones Públicas ───────────────────────────────────────────────────────

/**
 * Añade una cantidad de un producto al carrito tras validar stock.
 */
function add_to_cart(productId, quantity) {
  const qty = parseInt(quantity);
  if (isNaN(qty) || qty <= 0) {
    return { success: false, error: 'La cantidad debe ser un número entero mayor que cero.', cart };
  }
  if (!productId) {
    return { success: false, error: 'Debe especificarse un ID de producto válido.', cart };
  }

  const catalog = getCatalog();
  const product = catalog.find(p => p.id === productId.trim());
  if (!product) {
    return { success: false, error: `El producto con ID "${productId}" no existe en nuestro catálogo.`, cart };
  }

  const existingItem      = cart.items.find(item => item.productId === product.id);
  const currentQtyInCart  = existingItem ? existingItem.quantity : 0;
  const targetQty         = currentQtyInCart + qty;

  if (targetQty > product.stock) {
    const availableToAdd = product.stock - currentQtyInCart;
    return {
      success: false,
      error: `Stock insuficiente para "${product.name}". Stock disponible: ${product.stock}. ` +
             (currentQtyInCart > 0
               ? `Ya tienes ${currentQtyInCart} unidad(es) en el carrito y solo puedes añadir ${availableToAdd} más.`
               : `No puedes añadir la cantidad solicitada.`),
      cart
    };
  }

  if (existingItem) {
    existingItem.quantity = targetQty;
  } else {
    cart.items.push({ productId: product.id, name: product.name, price: product.price, quantity: qty });
  }

  recalculateTotals();
  saveCart();

  return { success: true, message: `Añadido "${product.name}" al carrito (cantidad: ${qty}).`, cart };
}

/**
 * Elimina completamente un producto del carrito.
 */
function remove_from_cart(productId) {
  if (!productId) {
    return { success: false, error: 'Debe especificarse un ID de producto válido.', cart };
  }

  const normalizedId = productId.trim();
  const index = cart.items.findIndex(item => item.productId === normalizedId);

  if (index === -1) {
    return { success: false, error: `El producto con ID "${productId}" no está en el carrito.`, cart };
  }

  const productName = cart.items[index].name;
  cart.items.splice(index, 1);

  recalculateTotals();
  saveCart();

  return { success: true, message: `Eliminado "${productName}" del carrito por completo.`, cart };
}

/**
 * Obtiene el estado actual del carrito.
 */
function view_cart() {
  return cart;
}

/**
 * Vacía completamente el carrito.
 */
function clear_cart() {
  cart.items     = [];
  cart.total     = 0;
  cart.itemCount = 0;

  saveCart();

  return { success: true, message: 'El carrito ha sido vaciado completamente.', cart };
}

module.exports = {
  add_to_cart,
  remove_from_cart,
  view_cart,
  clear_cart
};

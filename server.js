/**
 * server.js
 * Servidor Express para la interfaz web del Agente de E-commerce.
 * Expone REST API: /api/chat, /api/cart, /api/orders
 * Día 6 — Interfaz Web con Chat Interactivo
 */

'use strict';

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const Groq = require('groq-sdk');

const { tools } = require('./agent/tools');
const { SYSTEM_PROMPT } = require('./agent/prompts');
const recommender = require('./modules/recommender');
const cartModule = require('./modules/cart');
const ordersModule = require('./modules/orders');

// ─── App y middlewares ────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Cliente Groq ─────────────────────────────────────────────────────────────
const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─── Sesiones de conversación por sessionId ───────────────────────────────────
const sessions = new Map();

function getOrCreateSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, [{ role: 'system', content: SYSTEM_PROMPT }]);
  }
  return sessions.get(sessionId);
}

// ─── Despachador de herramientas (idéntico al de agent/index.js) ──────────────
async function executeTool(name, args) {
  console.log(`  🔧 ${name}(${JSON.stringify(args)})`);
  switch (name) {
    case 'search_products':
      return JSON.stringify(recommender.search_products({
        query: args.query,
        category: args.category,
        minPrice: args.minPrice,
        maxPrice: args.maxPrice,
        minRating: args.minRating,
        limit: args.limit || 5,
      }));
    case 'get_product_details': {
      const p = recommender.get_product_details(args.productId);
      return p ? JSON.stringify(p) : JSON.stringify({ error: 'Producto no encontrado.' });
    }
    case 'get_top_products':
      return JSON.stringify(recommender.get_top_products({
        category: args.category,
        limit: args.n || 5,
        sortBy: args.sortBy || 'rating',
      }));
    case 'add_to_cart':
      return JSON.stringify(cartModule.add_to_cart(args.productId, args.quantity));
    case 'remove_from_cart':
      return JSON.stringify(cartModule.remove_from_cart(args.productId));
    case 'view_cart':
      return JSON.stringify(cartModule.view_cart());
    case 'clear_cart':
      return JSON.stringify(cartModule.clear_cart());
    case 'create_order': {
      const result = await ordersModule.create_order(args.cartItems);
      if (result.success) cartModule.clear_cart();
      return JSON.stringify(result);
    }
    case 'get_order_status':
      return JSON.stringify(await ordersModule.get_order_status(args.orderId));
    case 'cancel_order':
      return JSON.stringify(await ordersModule.cancel_order(args.orderId));
    case 'list_orders':
      return JSON.stringify(await ordersModule.list_orders());
    default:
      return JSON.stringify({ error: `Herramienta desconocida: ${name}` });
  }
}

// ─── Llamada recursiva al LLM con Function Calling ────────────────────────────
async function callGroq(messages) {
  const response = await client.chat.completions.create({
    model: process.env.MODEL || 'llama-3.3-70b-versatile',
    messages,
    tools,
    tool_choice: 'auto',
    parallel_tool_calls: false,   // evita formato incorrecto de tool calls en llama-3.3
    max_tokens: parseInt(process.env.MAX_TOKENS) || 1024,
    temperature: 0.1,             // baja temperatura = menos alucinaciones en tool calling
  });

  const message = response.choices[0].message;

  if (message.tool_calls && message.tool_calls.length > 0) {
    messages.push(message);
    for (const toolCall of message.tool_calls) {
      const result = await executeTool(
        toolCall.function.name,
        JSON.parse(toolCall.function.arguments || '{}')
      );
      messages.push({ role: 'tool', tool_call_id: toolCall.id, content: result });
    }
    return callGroq(messages);
  }

  return message.content || '';
}

// ═══════════════════════════════════════════════════════════════
// RUTAS API
// ═══════════════════════════════════════════════════════════════

// POST /api/chat — Turno conversacional
app.post('/api/chat', async (req, res) => {
  const { message, sessionId = 'default' } = req.body;
  if (!message) return res.status(400).json({ error: 'message es requerido.' });

  const history = getOrCreateSession(sessionId);
  history.push({ role: 'user', content: message });

  try {
    const reply = await callGroq(history);
    history.push({ role: 'assistant', content: reply });

    // Adjuntar estado actualizado del carrito en cada respuesta
    const cart = cartModule.view_cart();
    res.json({ reply, cart });
  } catch (err) {
    console.error('Error API Groq:', err.message);
    const status = err.status || 500;
    if (status === 429) {
      return res.status(429).json({ error: 'Límite de tokens diario alcanzado. Inténtalo más tarde.' });
    }
    if (status === 400 && err.message && err.message.includes('tool_use_failed')) {
      // El modelo generó un tool call con formato incorrecto — reintentar sin tools
      try {
        const fallback = await client.chat.completions.create({
          model: process.env.MODEL || 'llama-3.3-70b-versatile',
          messages: history,
          max_tokens: 512,
          temperature: 0.1,
        });
        const reply = fallback.choices[0].message.content || 'Lo siento, no pude procesar tu mensaje. ¿Puedes reformularlo?';
        history.push({ role: 'assistant', content: reply });
        const cart = cartModule.view_cart();
        return res.json({ reply, cart });
      } catch (_) {}
    }
    res.status(500).json({ error: 'Error interno del servidor. Inténtalo de nuevo.' });
  }
});

// GET /api/cart — Estado actual del carrito
app.get('/api/cart', (req, res) => {
  res.json(cartModule.view_cart());
});

// DELETE /api/cart — Vaciar carrito
app.delete('/api/cart', (req, res) => {
  res.json(cartModule.clear_cart());
});

// GET /api/orders — Listar pedidos
app.get('/api/orders', async (req, res) => {
  const result = await ordersModule.list_orders();
  res.json(result);
});

// GET /api/orders/:id — Estado de un pedido
app.get('/api/orders/:id', async (req, res) => {
  const result = await ordersModule.get_order_status(req.params.id);
  if (!result.success) return res.status(404).json(result);
  res.json(result);
});

// GET /api/products — Catálogo completo (para la UI)
const catalog = require('./data/catalog.json');
app.get('/api/products', (req, res) => {
  const { category, limit } = req.query;
  let products = catalog;
  if (category) products = products.filter(p => p.category === category);
  if (limit) products = products.slice(0, parseInt(limit));
  res.json(products);
});

// DELETE /api/session — Reiniciar sesión de chat
app.delete('/api/session', (req, res) => {
  const { sessionId = 'default' } = req.body;
  sessions.delete(sessionId);
  cartModule.clear_cart();
  res.json({ success: true, message: 'Sesión reiniciada.' });
});

// ─── Inicio del servidor ──────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n╔════════════════════════════════════════════╗`);
  console.log(`║  🛒  ShopBot Web — Servidor Activo         ║`);
  console.log(`║  http://localhost:${PORT}                    ║`);
  console.log(`╚════════════════════════════════════════════╝\n`);
});

module.exports = app;

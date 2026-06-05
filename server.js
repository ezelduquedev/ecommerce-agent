/**
 * server.js
 * Servidor Express para la interfaz web del Agente de E-commerce.
 * Día 7 — Streaming SSE + endpoints de borrado de pedidos
 */

'use strict';

require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const express = require('express');
const cors = require('cors');
const path = require('path');
const Groq = require('groq-sdk');

const { tools } = require('./agent/tools');
const { SYSTEM_PROMPT } = require('./agent/prompts');
const recommender = require('./modules/recommender');
const cartModule = require('./modules/cart');
const ordersModule = require('./modules/orders');
const catalogModule = require('./modules/catalog');

const MODEL = process.env.MODEL || 'llama-3.3-70b-versatile';

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

// ─── Despachador de herramientas ──────────────────────────────────────────────
async function executeTool(name, args) {
  console.log(`  🔧 ${name}(${JSON.stringify(args)})`);
  switch (name) {
    case 'search_products':
      return JSON.stringify(recommender.search_products({
        query: args.query, category: args.category,
        minPrice: args.minPrice, maxPrice: args.maxPrice,
        minRating: args.minRating, limit: args.limit || 5,
      }));
    case 'get_product_details': {
      const p = recommender.get_product_details(args.productId);
      return p ? JSON.stringify(p) : JSON.stringify({ error: 'Producto no encontrado.' });
    }
    case 'get_top_products':
      return JSON.stringify(recommender.get_top_products({
        category: args.category, limit: args.n || 5, sortBy: args.sortBy || 'rating',
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

// ═══════════════════════════════════════════════════════════════
// RUTA PRINCIPAL: POST /api/chat  — Streaming SSE
// ═══════════════════════════════════════════════════════════════
app.post('/api/chat', async (req, res) => {
  const { message, sessionId = 'default' } = req.body;
  if (!message) return res.status(400).json({ error: 'message es requerido.' });

  const history = getOrCreateSession(sessionId);
  history.push({ role: 'user', content: message });

  // Ventana de contexto deslizable para ahorrar tokens de entrada:
  // Conserva el SYSTEM_PROMPT (history[0]) + los últimos 6 mensajes de la conversación
  const apiMessages = [
    history[0], 
    ...history.slice(-6)
  ];

  // Cabeceras SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    // ── Paso 1: Detectar si hay tool_calls ──
    const toolResponse = await client.chat.completions.create({
      model: MODEL,
      messages: apiMessages,
      tools,
      tool_choice: 'auto',
      parallel_tool_calls: false,
      max_tokens: 128,      // Optimizado para ahorrar tokens en la detección de tools
      temperature: 0.1,
    });

    const toolMessage = toolResponse.choices[0].message;

    if (toolMessage.tool_calls?.length > 0) {
      // Registrar llamada y respuestas de herramientas en el historial
      history.push(toolMessage);
      apiMessages.push(toolMessage);

      for (const tc of toolMessage.tool_calls) {
        const result = await executeTool(
          tc.function.name,
          JSON.parse(tc.function.arguments || '{}')
        );
        const toolReply = { role: 'tool', tool_call_id: tc.id, content: result };
        history.push(toolReply);
        apiMessages.push(toolReply);
      }

      // ── Paso 2: Generar respuesta final en STREAMING ──
      const stream = await client.chat.completions.create({
        model: MODEL,
        messages: apiMessages,
        max_tokens: 256,     // Optimizado para respuestas concisas y menor coste
        temperature: 0.1,
        stream: true,
      });

      let fullReply = '';
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || '';
        if (text) {
          fullReply += text;
          send({ type: 'chunk', text });
        }
      }
      history.push({ role: 'assistant', content: fullReply });

    } else {
      // Respuesta directa sin herramientas — enviar como chunk único
      const text = toolMessage.content || '';
      send({ type: 'chunk', text });
      history.push({ role: 'assistant', content: text });
    }

    // Enviar estado final del carrito junto al evento done
    send({ type: 'done', cart: cartModule.view_cart() });

  } catch (err) {
    console.error('⚠️ Error en API Groq (activando fallback local):', err.message);
    
    // Fallback universal resiliente para asegurar el funcionamiento de la demo
    try {
      const fallbackReply = getMockFallbackResponse(message);
      const words = fallbackReply.split(' ');
      for (const word of words) {
        send({ type: 'chunk', text: word + ' ' });
        await new Promise(r => setTimeout(r, 20)); // efecto de streaming
      }
      history.push({ role: 'assistant', content: fallbackReply });
      send({ type: 'done', cart: cartModule.view_cart() });
      return;
    } catch (fbErr) {
      console.error('Error crítico en fallback local:', fbErr);
    }
    
    send({ type: 'error', error: '❌ Servicio no disponible. Usa la exploración de categorías de la izquierda.' });
  } finally {
    res.end();
  }
});

// ═══════════════════════════════════════════════════════════════
// CARRITO
// ═══════════════════════════════════════════════════════════════
app.get('/api/cart', (req, res) => res.json(cartModule.view_cart()));
app.delete('/api/cart', (req, res) => res.json(cartModule.clear_cart()));

// Añadir al carrito directamente (sin LLM — para el browser de productos)
app.post('/api/cart/add', (req, res) => {
  const { productId, quantity = 1 } = req.body;
  if (!productId) return res.status(400).json({ error: 'productId requerido.' });
  const result = cartModule.add_to_cart(productId, quantity);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  res.json(result.cart);
});

// ═══════════════════════════════════════════════════════════════
// PEDIDOS
// ═══════════════════════════════════════════════════════════════
app.get('/api/orders', async (req, res) => {
  const result = await ordersModule.list_orders();
  res.json(result);
});

// Crear un pedido directamente (sin LLM)
app.post('/api/orders', async (req, res) => {
  const { cartItems } = req.body;
  if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
    return res.status(400).json({ error: 'El carrito está vacío.' });
  }
  const result = await ordersModule.create_order(cartItems);
  if (result.success) {
    cartModule.clear_cart();
    res.json({ success: true, orderId: result.orderId, cart: cartModule.view_cart() });
  } else {
    res.status(400).json({ error: result.error });
  }
});

app.get('/api/orders/:id', async (req, res) => {
  const result = await ordersModule.get_order_status(req.params.id);
  if (!result.success) return res.status(404).json(result);
  res.json(result);
});

// Eliminar un pedido concreto
app.delete('/api/orders/:id', async (req, res) => {
  const result = await ordersModule.delete_order(req.params.id);
  if (!result.success) return res.status(404).json(result);
  res.json(result);
});

// Cambiar estado de un pedido: pendiente → enviado → completado (o cancelado)
app.patch('/api/orders/:id/status', async (req, res) => {
  const { status } = req.body;
  const VALID = ['pendiente', 'enviado', 'completado', 'cancelado'];
  if (!status || !VALID.includes(status)) {
    return res.status(400).json({ error: `Estado inválido. Usa uno de: ${VALID.join(', ')}.` });
  }
  // Usamos initDb internamente a través de get_order_status + escritura directa
  const found = await ordersModule.get_order_status(req.params.id);
  if (!found.success) return res.status(404).json(found);
  const order = found.order;
  // Reglas de negocio: no se puede revertir desde completado/cancelado
  if (order.status === 'completado' || order.status === 'cancelado') {
    return res.status(409).json({ error: `No se puede cambiar el estado de un pedido "${order.status}".` });
  }
  order.status = status;
  // Persistir usando update_order_status del módulo
  const result = await ordersModule.update_order_status(req.params.id, status);
  if (!result.success) return res.status(500).json(result);
  res.json({ success: true, order: result.order });
});


// Eliminar TODOS los pedidos (demo limpia)
app.delete('/api/orders', async (req, res) => {
  const result = await ordersModule.clear_orders();
  res.json(result);
});

// ═══════════════════════════════════════════════════════════════
// PRODUCTOS — CRUD Completo
// ═══════════════════════════════════════════════════════════════

// Listar productos (con filtros opcionales)
app.get('/api/products', (req, res) => {
  const { category, limit } = req.query;
  let products = catalogModule.getCatalog();
  if (category && category !== 'all') {
    products = products.filter(p => p.category === category);
  }
  if (limit) products = products.slice(0, parseInt(limit));
  res.json(products);
});

// Crear nuevo producto
app.post('/api/products', (req, res) => {
  const { name, category, price, stock, description } = req.body;
  if (!name || !category || price === undefined || stock === undefined) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: name, category, price, stock.' });
  }
  const VALID_CATS = ['Electrónica', 'Ropa', 'Hogar', 'Deportes', 'Libros'];
  if (!VALID_CATS.includes(category)) {
    return res.status(400).json({ error: `Categoría inválida. Usa una de: ${VALID_CATS.join(', ')}.` });
  }
  const catalog = catalogModule.getCatalog();
  const prefix = { 'Electrónica': 'elec', 'Ropa': 'ropa', 'Hogar': 'hogar', 'Deportes': 'dep', 'Libros': 'lib' }[category];
  const seq = catalog.filter(p => p.id.includes(prefix)).length + 1;
  const newProduct = {
    id: `prod-${prefix}-${String(seq).padStart(3, '0')}-custom`,
    name: name.trim(),
    category,
    price: parseFloat(price),
    rating: 4.0,
    stock: parseInt(stock),
    description: (description || '').trim(),
  };
  catalog.push(newProduct);
  catalogModule.saveCatalog();
  res.status(201).json({ success: true, product: newProduct });
});

// Actualizar producto existente
app.put('/api/products/:id', (req, res) => {
  const catalog = catalogModule.getCatalog();
  const idx = catalog.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Producto no encontrado.' });
  const { name, category, price, stock, description, rating } = req.body;
  const p = catalog[idx];
  if (name !== undefined) p.name = name.trim();
  if (category !== undefined) p.category = category;
  if (price !== undefined) p.price = parseFloat(price);
  if (stock !== undefined) p.stock = parseInt(stock);
  if (description !== undefined) p.description = description.trim();
  if (rating !== undefined) p.rating = parseFloat(rating);
  catalogModule.saveCatalog();
  res.json({ success: true, product: p });
});

// Eliminar producto del catálogo
app.delete('/api/products/:id', (req, res) => {
  const catalog = catalogModule.getCatalog();
  const idx = catalog.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Producto no encontrado.' });
  catalog.splice(idx, 1);
  catalogModule.saveCatalog();
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════
// SESIÓN
// ═══════════════════════════════════════════════════════════════
app.delete('/api/session', (req, res) => {
  const { sessionId = 'default' } = req.body;
  sessions.delete(sessionId);
  cartModule.clear_cart();
  res.json({ success: true });
});

// ─── Fallback Local de Respaldo ante Límite de Tokens de Groq ────────────────
function getMockFallbackResponse(message) {
  const msg = message.toLowerCase();
  const catalog = catalogModule.getCatalog();

  // ── Helper: formatea una lista de productos ────────────────────────────────
  function listProducts(prods, catLabel = '') {
    if (!prods || prods.length === 0) return `No encontré productos${catLabel ? ' en ' + catLabel : ''}.`;
    return prods.slice(0, 6).map(p =>
      `- **${p.name}** — **${p.price.toFixed(2)}€** ${'⭐'.repeat(Math.round(p.rating || 4))}`
    ).join('\n');
  }

  // ── Ver mi carrito ─────────────────────────────────────────────────────────
  if (msg.includes('carrito') || msg.includes('cesta') || msg.includes('ver mi carrito')) {
    const cart = cartModule.view_cart();
    if (cart.items.length === 0) {
      return `Tu carrito está vacío en este momento. ¡Añade artículos desde las categorías del menú izquierdo!`;
    }
    let r = `Tienes **${cart.itemCount}** artículo(s) en tu carrito:\n\n`;
    cart.items.forEach(i => { r += `- **${i.name}** ×${i.quantity} — ${(i.price * i.quantity).toFixed(2)}€\n`; });
    r += `\n**Total: ${cart.total.toFixed(2)}€** — Pulsa "Confirmar pedido" en el panel derecho para finalizar.`;
    return r;
  }

  // ── Mis pedidos ────────────────────────────────────────────────────────────
  if (msg.includes('pedido') || msg.includes('mis pedidos') || msg.includes('historial')) {
    return `Puedes ver todos tus pedidos con su estado en la pestaña **📦 Pedidos** del panel derecho.\nDesde ahí puedes avanzar su estado (pendiente → enviado → completado) o eliminarlos.`;
  }

  // ── Mejor valorados ────────────────────────────────────────────────────────
  if (msg.includes('mejor valorado') || msg.includes('mejor valorados') || msg.includes('más valorado') || msg.includes('top') || msg.includes('recomendad')) {
    const top = [...catalog].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    return `Aquí tienes los productos mejor valorados de nuestra tienda:\n\n${listProducts(top)}\n\n*Puedes añadirlos al carrito desde la sección Explorar del menú izquierdo.*`;
  }

  // ── Precio más bajo / oferta ───────────────────────────────────────────────
  if (msg.includes('precio') || msg.includes('barato') || msg.includes('oferta') || msg.includes('económico') || msg.includes('precio más bajo') || msg.includes('mas bajo')) {
    const cheap = [...catalog].sort((a, b) => a.price - b.price);
    return `Estos son los productos con el precio más bajo de nuestro catálogo:\n\n${listProducts(cheap)}\n\n*Navega por las categorías del menú izquierdo para añadirlos al carrito.*`;
  }

  // ── Electrónica ────────────────────────────────────────────────────────────
  if (msg.includes('electrónica') || msg.includes('electronica') || msg.includes('auricular') || msg.includes('teclado') || msg.includes('altavoz') || msg.includes('sony') || msg.includes('logitech') || msg.includes('jbl')) {
    const elec = catalog.filter(p => p.category === 'Electrónica');
    return `Aquí tienes los productos de Electrónica disponibles:\n\n${listProducts(elec)}\n\n*Pulsa la categoría 📱 Electrónica en el menú izquierdo para verlos y añadirlos al carrito.*`;
  }

  // ── Libros ─────────────────────────────────────────────────────────────────
  if (msg.includes('libro') || msg.includes('lectura') || msg.includes('leer') || msg.includes('novela') || msg.includes('alquimista') || msg.includes('principito')) {
    const books = catalog.filter(p => p.category === 'Libros');
    return `Aquí tienes los libros disponibles en nuestra tienda:\n\n${listProducts(books)}\n\n*Puedes comprarlos directamente desde la categoría 📚 Libros del menú izquierdo.*`;
  }

  // ── Deportes ───────────────────────────────────────────────────────────────
  if (msg.includes('deporte') || msg.includes('zapatilla') || msg.includes('running') || msg.includes('yoga') || msg.includes('mancuerna') || msg.includes('nike') || msg.includes('botella')) {
    const sports = catalog.filter(p => p.category === 'Deportes');
    return `Aquí tienes nuestros productos de deportes:\n\n${listProducts(sports)}\n\n*Disponibles en la categoría ⚽ Deportes del menú izquierdo.*`;
  }

  // ── Hogar ──────────────────────────────────────────────────────────────────
  if (msg.includes('hogar') || msg.includes('casa') || msg.includes('cocina') || msg.includes('lampara') || msg.includes('aspiradora') || msg.includes('café') || msg.includes('cafe')) {
    const home = catalog.filter(p => p.category === 'Hogar');
    return `Aquí tienes nuestros productos de Hogar:\n\n${listProducts(home)}\n\n*Accede a la categoría 🏠 Hogar en el menú izquierdo para añadirlos al carrito.*`;
  }

  // ── Ropa ───────────────────────────────────────────────────────────────────
  if (msg.includes('ropa') || msg.includes('camiseta') || msg.includes('pantalon') || msg.includes('chaqueta') || msg.includes('calcetines') || msg.includes('sudadera') || msg.includes('vestir')) {
    const clothes = catalog.filter(p => p.category === 'Ropa');
    return `Aquí tienes nuestras prendas de ropa disponibles:\n\n${listProducts(clothes)}\n\n*Explóralas desde la categoría 👕 Ropa del menú izquierdo.*`;
  }

  // ── Búsqueda libre en catálogo ─────────────────────────────────────────────
  const words = msg.split(/\s+/).filter(w => w.length > 3);
  const found = catalog.filter(p =>
    words.some(w => p.name.toLowerCase().includes(w) || (p.description || '').toLowerCase().includes(w))
  );
  if (found.length > 0) {
    return `He buscado en el catálogo y esto es lo que encontré:\n\n${listProducts(found)}\n\n*Pulsa la categoría correspondiente en el menú izquierdo para añadirlos al carrito.*`;
  }

  // ── Respuesta general ──────────────────────────────────────────────────────
  const popular = [...catalog].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 4);
  return `En este momento respondo con búsqueda local. Aquí tienes algunos de nuestros productos más populares:\n\n${listProducts(popular)}\n\n` +
    `Puedes explorar el catálogo completo usando el menú **Explorar** de la izquierda, filtrar por categorías, y añadir productos al carrito directamente con un clic.`;
}

// ─── Inicio del servidor ──────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n╔════════════════════════════════════════════╗`);
  console.log(`║  🛒  ShopBot Web — Servidor Activo         ║`);
  console.log(`║  http://localhost:${PORT}                    ║`);
  console.log(`╚════════════════════════════════════════════╝\n`);
});

module.exports = app;

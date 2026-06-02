/**
 * agent/index.js
 * Bucle conversacional principal del Agente de E-commerce.
 * Gestiona el historial de mensajes, la llamada a Groq API y el flujo de Function Calling.
 */

'use strict';

require('dotenv').config();
const readline = require('readline');
const Groq = require('groq-sdk');

const { tools } = require('./tools');
const { SYSTEM_PROMPT } = require('./prompts');

// ─── Placeholders de herramientas e integraciones reales ─────────────────────
const recommender = require('../modules/recommender');
const cartModule = require('../modules/cart');

function executeTool(name, args) {
  console.log(`\n  🔧 [TOOL CALL] ${name}(${JSON.stringify(args)})\n`);

  switch (name) {
    case 'search_products': {
      const result = recommender.search_products({
        query: args.query,
        category: args.category,
        minPrice: args.minPrice,
        maxPrice: args.maxPrice,
        minRating: args.minRating,
        limit: args.limit || 5 // Límite por defecto para no saturar el contexto del LLM
      });
      return JSON.stringify(result);
    }

    case 'get_product_details': {
      const product = recommender.get_product_details(args.productId);
      return product ? JSON.stringify(product) : JSON.stringify({ error: 'Producto no encontrado.' });
    }

    case 'get_top_products': {
      const result = recommender.get_top_products({
        category: args.category,
        limit: args.n || 5,
        sortBy: args.sortBy || 'rating'
      });
      return JSON.stringify(result);
    }

    case 'add_to_cart':
      return JSON.stringify(cartModule.add_to_cart(args.productId, args.quantity));

    case 'remove_from_cart':
      return JSON.stringify(cartModule.remove_from_cart(args.productId));

    case 'view_cart':
      return JSON.stringify(cartModule.view_cart());

    case 'clear_cart':
      return JSON.stringify(cartModule.clear_cart());

    case 'create_order':
      return JSON.stringify({ orderId: `ORD-${Date.now()}`, status: 'pendiente', message: 'Pedido creado correctamente. [MOCK]' });

    case 'get_order_status':
      return JSON.stringify({ orderId: args.orderId, status: 'pendiente', message: 'Estado del pedido obtenido. [MOCK]' });

    case 'cancel_order':
      return JSON.stringify({ success: true, message: `Pedido ${args.orderId} cancelado. [MOCK]` });

    case 'list_orders':
      return JSON.stringify({ orders: [], message: 'No hay pedidos en esta sesión. [MOCK]' });

    default:
      return JSON.stringify({ error: `Herramienta desconocida: ${name}` });
  }
}

// ─── Cliente Groq ─────────────────────────────────────────────────────────────
const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─── Historial de conversación (persiste durante la sesión) ───────────────────
const conversationHistory = [
  { role: 'system', content: SYSTEM_PROMPT }
];

// ─── Llamada al LLM con soporte de Function Calling recursivo ─────────────────
async function callGroq(messages) {
  const response = await client.chat.completions.create({
    model: process.env.MODEL || 'llama-3.1-70b-versatile',
    messages,
    tools,
    tool_choice: 'auto',
    max_tokens: parseInt(process.env.MAX_TOKENS) || 1024,
    temperature: parseFloat(process.env.TEMPERATURE) || 0.3,
  });

  const choice = response.choices[0];
  const message = choice.message;

  // CASO A: El modelo quiere ejecutar una o más herramientas
  if (message.tool_calls && message.tool_calls.length > 0) {
    // Añadir la respuesta del asistente con tool_calls al historial
    messages.push(message);

    // Ejecutar cada herramienta y añadir resultados al historial
    for (const toolCall of message.tool_calls) {
      const toolName = toolCall.function.name;
      const toolArgs = JSON.parse(toolCall.function.arguments || '{}');
      const toolResult = executeTool(toolName, toolArgs);

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: toolResult,
      });
    }

    // Llamada recursiva: el LLM redacta la respuesta final con los resultados
    return callGroq(messages);
  }

  // CASO B: El modelo devuelve texto directamente
  return message.content || '';
}

// ─── Bucle principal de conversación ─────────────────────────────────────────
async function chatLoop() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║   🛒  ShopBot — Agente de E-commerce       ║');
  console.log('║   Escribe "salir" para terminar            ║');
  console.log('╚════════════════════════════════════════════╝\n');

  const askQuestion = () => {
    rl.question('Tú: ', async (input) => {
      const userInput = input.trim();

      if (!userInput) {
        return askQuestion();
      }

      if (userInput.toLowerCase() === 'salir') {
        console.log('\n👋 ¡Hasta pronto! Gracias por usar ShopBot.\n');
        rl.close();
        return;
      }

      // Añadir mensaje del usuario al historial
      conversationHistory.push({ role: 'user', content: userInput });

      try {
        // Llamar al LLM (con posible Function Calling recursivo)
        const assistantReply = await callGroq(conversationHistory);

        // Añadir respuesta al historial
        conversationHistory.push({ role: 'assistant', content: assistantReply });

        console.log(`\nShopBot: ${assistantReply}\n`);
      } catch (error) {
        const errMsg = error?.message || 'Error desconocido';
        console.error(`\n❌ Error al conectar con el agente: ${errMsg}`);
        console.log('Por favor, inténtalo de nuevo.\n');
      }

      // Continuar el bucle
      askQuestion();
    });
  };

  askQuestion();
}

// ─── Punto de entrada ─────────────────────────────────────────────────────────
chatLoop();

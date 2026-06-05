# 🛒 ShopBot — Agente Conversacional de E-commerce con IA

> Agente conversacional inteligente que permite buscar productos, gestionar un carrito de compra y realizar pedidos usando **lenguaje natural en español**, impulsado por Groq API y el modelo `llama-3.3-70b-versatile`.

[![Tests](https://img.shields.io/badge/tests-40%20passed-brightgreen)](#-tests)
[![Node](https://img.shields.io/badge/node-%3E%3D20-blue)](https://nodejs.org)
[![Groq](https://img.shields.io/badge/LLM-llama--3.3--70b-purple)](https://console.groq.com)

---

## ✨ Características

- 🗣️ **Chat en lenguaje natural** — el agente decide qué herramienta usar de forma autónoma
- 🔍 **Búsqueda inteligente** — filtros por categoría, precio máximo, rating mínimo y palabras clave
- 🛒 **Carrito persistente en tiempo real** — carrito guardado automáticamente en `db/cart.json` para no perder la compra al reiniciar/recargar
- 📦 **Gestión de pedidos** — persistidos en `db/db.json` con `lowdb` y panel de administración interactivo de estados (Pendiente, Enviado, Completado, Cancelado)
- 🔌 **API REST Extendida** — endpoints para chat, productos, carrito y actualización de estados de pedidos
- 🛡️ **Resiliencia & Fallback Local** — responde de manera inteligente con un motor local si el proveedor de IA (Groq) excede su cuota de tokens (errores 429) o está offline
- 🌐 **Interfaz web** — UI dark mode premium accesible en `http://localhost:3000`
- ✅ **40 tests unitarios** — cobertura al 100% con Jest

---

## 🚀 Stack Tecnológico

| Tecnología | Versión | Uso |
|---|---|---|
| **Node.js** | ≥ 20 | Runtime principal |
| **Groq API** | SDK 1.x | Motor LLM — `llama-3.3-70b-versatile` |
| **Express** | 4.x | Servidor HTTP REST API |
| **lowdb** | 7.x | Persistencia de pedidos en JSON local |
| **dotenv** | 17.x | Gestión de variables de entorno |
| **Jest** | 30.x | Testing unitario |

---

## 📁 Estructura del Proyecto

```
ecommerce-agent/
├── agent/
│   ├── index.js        # Bucle CLI de conversación (readline)
│   ├── tools.js        # Schemas JSON de las 11 herramientas (Function Calling)
│   └── prompts.js      # System Prompt del agente ShopBot
├── modules/
│   ├── recommender/    # Búsqueda y recomendaciones (Día 2)
│   │   └── index.js    # search_products, get_product_details, get_top_products
│   ├── cart/           # Gestión del carrito en memoria (Día 3)
│   │   └── index.js    # add_to_cart, remove_from_cart, view_cart, clear_cart
│   └── orders/         # Persistencia de pedidos con lowdb (Día 4)
│       └── index.js    # create_order, get_order_status, cancel_order, list_orders
├── data/
│   └── catalog.json    # 25 productos en 5 categorías
├── db/
│   ├── db.json         # Base de datos de pedidos (generada en runtime)
│   └── cart.json       # Base de datos del carrito (generada en runtime para persistencia)
├── public/
│   └── index.html      # Interfaz web de chat (Día 6)
├── tests/
│   ├── recommender.test.js  # 20 tests del motor de búsqueda
│   ├── cart.test.js         # 10 tests del carrito
│   └── orders.test.js       # 10 tests de pedidos (con mocks de lowdb)
├── server.js           # Servidor Express con API REST (Día 6)
├── test-groq.js        # Script de verificación de conexión API
├── .env.example        # Plantilla de variables de entorno
└── package.json
```

---

## ⚙️ Instalación y Configuración

### 1. Clonar e instalar dependencias
```bash
git clone https://github.com/ezelduquedev/ecommerce-agent
cd ecommerce-agent
npm install
```

### 2. Configurar variables de entorno
```bash
cp .env.example .env
```
Edita `.env` y añade tu API Key de Groq:
```ini
GROQ_API_KEY=gsk_tu_clave_aqui
```
> Obtén tu clave gratuita en: https://console.groq.com

### 3. Verificar la conexión con Groq
```bash
npm run test:groq
```

---

## ▶️ Modo de Uso

### 🌐 Interfaz Web (recomendado)
```bash
npm run server
# → Abre http://localhost:3000 en el navegador
```

La interfaz incluye:
- Panel de chat con burbujas y typing indicator animado
- Sidebar de carrito en tiempo real (se actualiza en cada respuesta)
- Panel de pedidos con estados visuales (pendiente / enviado / completado / cancelado)
- Acciones rápidas por categoría y chips de sugerencia
- Botones de confirmar pedido y vaciar carrito

### 💻 Cliente de Terminal
```bash
npm start
```

```
╔════════════════════════════════════════════╗
║   🛒  ShopBot — Agente de E-commerce       ║
║   Escribe "salir" para terminar            ║
╚════════════════════════════════════════════╝

Tú: Busco auriculares por menos de 150€
ShopBot: Encontré estas opciones:
1. 🎧 Altavoz Portátil JBL Charge 5 — 149.99€ ⭐ 4.6
...
```

---

## 🧪 Tests

```bash
npm test
```

```
PASS tests/orders.test.js
PASS tests/recommender.test.js
PASS tests/cart.test.js

Test Suites: 3 passed, 3 total
Tests:       40 passed, 40 total
```

---

## 🔌 API REST

El servidor Express expone los siguientes endpoints:

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/chat` | Turno conversacional. Body: `{ message, sessionId }` |
| `GET` | `/api/cart` | Estado actual del carrito |
| `DELETE` | `/api/cart` | Vaciar el carrito |
| `GET` | `/api/orders` | Listar todos los pedidos |
| `GET` | `/api/orders/:id` | Estado de un pedido específico |
| `PATCH` | `/api/orders/:id/status` | Actualizar el estado de un pedido (ej: `{"status": "enviado"}`) |
| `GET` | `/api/products` | Catálogo completo (query: `?category=&limit=`) |
| `DELETE` | `/api/session` | Reiniciar sesión de chat |

### Ejemplo de uso

```bash
# Enviar mensaje al chat
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Busco libros de ciencia ficción", "sessionId": "demo"}'

# Ver carrito
curl http://localhost:3000/api/cart

# Ver todos los pedidos
curl http://localhost:3000/api/orders
```

---

## 🛠️ Herramientas del Agente (Function Calling)

El agente dispone de 11 herramientas que el LLM invoca de forma autónoma:

| Herramienta | Módulo | Descripción |
|---|---|---|
| `search_products` | recommender | Buscar productos con filtros |
| `get_product_details` | recommender | Detalle completo de un producto |
| `get_top_products` | recommender | Top N productos por rating o precio |
| `add_to_cart` | cart | Añadir producto al carrito |
| `remove_from_cart` | cart | Eliminar un producto del carrito |
| `view_cart` | cart | Ver contenido y total del carrito |
| `clear_cart` | cart | Vaciar el carrito completo |
| `create_order` | orders | Crear pedido desde el carrito |
| `get_order_status` | orders | Consultar estado de un pedido |
| `cancel_order` | orders | Cancelar pedido (solo si 'pendiente') |
| `list_orders` | orders | Listar todos los pedidos |

---

## 📦 Catálogo de Productos

25 productos en 5 categorías:

| Categoría | Nº Productos |
|---|---|
| 📱 Electrónica | 5 |
| 👕 Ropa | 5 |
| 🏠 Hogar | 5 |
| 🏃 Deportes | 5 |
| 📚 Libros | 5 |

---

## 🔑 Variables de Entorno

| Variable | Descripción | Por defecto |
|---|---|---|
| `GROQ_API_KEY` | Clave de API de Groq (requerida) | — |
| `MODEL` | Modelo LLM | `llama-3.3-70b-versatile` |
| `MAX_TOKENS` | Tokens máximos por respuesta | `1024` |
| `PORT` | Puerto del servidor Express | `3000` |

---

## 🗓️ Desarrollo — Plan de 7 Días

| Día | Tarea | Estado |
|---|---|---|
| Día 1 | Arquitectura base, catálogo 25 productos, bucle CLI | ✅ |
| Día 2 | Módulo recommender — búsqueda real, 20 tests | ✅ |
| Día 3 | Módulo cart — carrito en memoria, 10 tests | ✅ |
| Día 4 | Módulo orders — persistencia lowdb, 10 tests | ✅ |
| Día 5 | Integración completa, SYSTEM_PROMPT v2, fix lowdb sync | ✅ |
| Día 6 | Servidor Express REST + Interfaz Web chat interactivo | ✅ |
| Día 7 | Persistencia de carrito, administración de estados de pedidos, fallback resiliente offline y README final | ✅ |

---

## 👤 Autor

**Ezel Alexander Duque Arias** — [@ezelduquedev](https://github.com/ezelduquedev)

---

## 📄 Licencia

ISC

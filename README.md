# 🛒 Agente Conversacional de E-commerce

Agente conversacional inteligente para e-commerce que permite buscar productos, gestionar un carrito de compras y realizar pedidos mediante lenguaje natural en español.

## 🚀 Stack Tecnológico

| Tecnología | Uso |
|---|---|
| **Node.js 20** | Runtime principal |
| **Groq API** (llama-3.1-70b) | Motor LLM con Function Calling |
| **lowdb** | Persistencia de pedidos en JSON |
| **Jest** | Testing unitario e integración |

## 📁 Estructura del Proyecto

```
ecommerce-agent/
├── agent/
│   ├── index.js        # Bucle principal de conversación
│   ├── tools.js        # Schemas JSON de las 11 herramientas
│   └── prompts.js      # System Prompt del agente ShopBot
├── modules/
│   ├── recommender/    # Lógica de búsqueda y recomendaciones (Día 2)
│   ├── cart/           # Gestión del carrito (Día 3)
│   └── orders/         # Procesamiento de pedidos (Día 4)
├── data/
│   └── catalog.json    # Catálogo de 25 productos mock
├── db/                 # Base de datos JSON (generada en runtime)
├── test-groq.js        # Script de verificación de API
├── .env.example        # Plantilla de variables de entorno
└── package.json
```

## ⚙️ Instalación y Configuración

### 1. Clonar e instalar dependencias
```bash
git clone <repositorio>
cd ecommerce-agent
npm install
```

### 2. Configurar variables de entorno
```bash
cp .env.example .env
```
Edita el archivo `.env` y añade tu API Key de Groq:
```ini
GROQ_API_KEY=gsk_tu_clave_aqui
```
Obtén tu clave gratuita en: https://console.groq.com

### 3. Verificar la conexión con Groq
```bash
node test-groq.js
```

### 4. Iniciar el agente
```bash
npm start
# o directamente:
node agent/index.js
```

## 💬 Uso del Agente

```
╔════════════════════════════════════════════╗
║   🛒  ShopBot — Agente de E-commerce       ║
║   Escribe "salir" para terminar            ║
╚════════════════════════════════════════════╝

Tú: Hola, busco unos auriculares buenos
ShopBot: ¡Hola! Tengo unos auriculares excelentes...

Tú: ¿Cuánto cuestan los Sony WH-1000XM5?
ShopBot: Los Sony WH-1000XM5 tienen un precio de 279,99€...

Tú: salir
👋 ¡Hasta pronto! Gracias por usar ShopBot.
```

## 🧪 Tests
```bash
npm test
```

## 📦 Catálogo de Productos

El catálogo incluye **25 productos** en 5 categorías:
- 📱 **Electrónica** (5 productos)
- 👕 **Ropa** (5 productos)
- 🏠 **Hogar** (5 productos)
- 🏃 **Deportes** (5 productos)
- 📚 **Libros** (5 productos)

## 🗓️ Estado del Proyecto

| Día | Tarea | Estado |
|---|---|---|
| **Día 1** | Fundamentos y arquitectura base | ✅ Completado |
| **Día 2** | Módulo de recomendaciones | 🔄 Pendiente |
| **Día 3** | Gestión de carrito con persistencia | 🔄 Pendiente |
| **Día 4** | Sistema de pedidos con lowdb | 🔄 Pendiente |
| **Día 5** | Tests unitarios con Jest | 🔄 Pendiente |
| **Día 6** | Refinamiento y casos de error | 🔄 Pendiente |
| **Día 7** | Documentación final y entrega | 🔄 Pendiente |

## 🔑 Variables de Entorno

| Variable | Descripción | Valor por defecto |
|---|---|---|
| `GROQ_API_KEY` | Clave de API de Groq | — (requerida) |
| `MODEL` | Modelo LLM a usar | `llama-3.1-70b-versatile` |
| `MAX_TOKENS` | Máx. tokens por respuesta | `1024` |
| `TEMPERATURE` | Temperatura del modelo (0-1) | `0.3` |
| `DB_PATH` | Ruta de la base de datos JSON | `./db/orders.json` |
| `NODE_ENV` | Entorno de ejecución | `development` |

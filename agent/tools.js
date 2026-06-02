/**
 * agent/tools.js
 * Schemas JSON de Function Calling para la API de Groq (formato OpenAI-compatible).
 * Define las 11 herramientas disponibles para el agente de e-commerce.
 */

const tools = [
  // ─────────────────────────────────────────────
  // BLOQUE 1: Búsqueda e información de productos
  // ─────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'search_products',
      description:
        'Busca productos en el catálogo aplicando filtros opcionales. Úsala cuando el usuario pida buscar, ver o encontrar productos por texto, categoría, precio o valoración.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Texto libre para buscar en el nombre, descripción o categoría del producto (ej: "auriculares", "sudadera", "Salomon").',
          },
          category: {
            type: 'string',
            enum: ['Electrónica', 'Ropa', 'Hogar', 'Deportes', 'Libros'],
            description: 'Categoría de producto por la que filtrar.',
          },
          minPrice: {
            type: 'number',
            description: 'Precio mínimo en euros (EUR). Incluye productos con precio >= minPrice.',
          },
          maxPrice: {
            type: 'number',
            description: 'Precio máximo en euros (EUR). Incluye productos con precio <= maxPrice.',
          },
          minRating: {
            type: 'number',
            description: 'Valoración mínima del producto (escala 1-5). Incluye productos con rating >= minRating.',
          },
        },
        required: [],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'get_product_details',
      description:
        'Obtiene todos los detalles de un producto específico por su ID: nombre, precio, descripción, stock y valoración.',
      parameters: {
        type: 'object',
        properties: {
          productId: {
            type: 'string',
            description: 'El identificador único del producto (ej: "prod-elec-001").',
          },
        },
        required: ['productId'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'get_top_products',
      description:
        'Devuelve los N productos más destacados del catálogo, ordenados por un criterio específico. Útil para recomendaciones generales o cuando el usuario pide "los mejores" o "los más populares".',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            enum: ['Electrónica', 'Ropa', 'Hogar', 'Deportes', 'Libros'],
            description: 'Filtrar por categoría (opcional).',
          },
          n: {
            type: 'integer',
            description: 'Número de productos a devolver. Por defecto 5.',
            default: 5,
          },
          sortBy: {
            type: 'string',
            enum: ['rating', 'price_asc', 'price_desc'],
            description:
              'Criterio de ordenación: "rating" (mejor valorados), "price_asc" (más baratos primero), "price_desc" (más caros primero).',
            default: 'rating',
          },
        },
        required: [],
      },
    },
  },

  // ─────────────────────────────────────────────
  // BLOQUE 2: Gestión del carrito de la compra
  // ─────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'add_to_cart',
      description:
        'Añade una cantidad de un producto al carrito de la compra. Verifica stock disponible antes de añadir.',
      parameters: {
        type: 'object',
        properties: {
          productId: {
            type: 'string',
            description: 'El identificador único del producto a añadir.',
          },
          quantity: {
            type: 'integer',
            description: 'Número de unidades a añadir al carrito. Debe ser >= 1.',
            minimum: 1,
          },
        },
        required: ['productId', 'quantity'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'remove_from_cart',
      description: 'Elimina completamente un producto del carrito de la compra.',
      parameters: {
        type: 'object',
        properties: {
          productId: {
            type: 'string',
            description: 'El identificador único del producto a eliminar del carrito.',
          },
        },
        required: ['productId'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'view_cart',
      description:
        'Muestra el contenido actual del carrito: lista de productos, cantidades, precios unitarios y total acumulado en euros.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'clear_cart',
      description:
        'Vacía completamente el carrito, eliminando todos los productos añadidos. Úsala solo tras confirmación explícita del usuario.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },

  // ─────────────────────────────────────────────
  // BLOQUE 3: Gestión de pedidos
  // ─────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'create_order',
      description:
        'Crea un pedido definitivo con los productos del carrito actual. IMPORTANTE: solo llamar esta función tras obtener confirmación explícita del usuario ("sí", "confirmo", "adelante"). Genera un ID de pedido y registra la orden.',
      parameters: {
        type: 'object',
        properties: {
          cartItems: {
            type: 'array',
            description: 'Lista de ítems del carrito a incluir en el pedido.',
            items: {
              type: 'object',
              properties: {
                productId: { type: 'string', description: 'ID del producto.' },
                quantity: { type: 'integer', description: 'Cantidad del producto.' },
              },
              required: ['productId', 'quantity'],
            },
          },
        },
        required: ['cartItems'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'get_order_status',
      description: 'Consulta el estado actual de un pedido existente por su ID.',
      parameters: {
        type: 'object',
        properties: {
          orderId: {
            type: 'string',
            description: 'El identificador único del pedido (ej: "ORD-20260602-001").',
          },
        },
        required: ['orderId'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'cancel_order',
      description:
        'Cancela un pedido existente. Solo es posible cancelar pedidos en estado "pendiente" o "procesando". Requiere confirmación explícita del usuario antes de ejecutar.',
      parameters: {
        type: 'object',
        properties: {
          orderId: {
            type: 'string',
            description: 'El identificador único del pedido a cancelar.',
          },
        },
        required: ['orderId'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'list_orders',
      description:
        'Lista todos los pedidos realizados en la sesión actual, con su ID, fecha, estado y total.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
];

module.exports = { tools };

/**
 * modules/recommender/index.js
 * Motor de recomendaciones del Agente de E-commerce.
 * Proporciona búsqueda y filtrado real sobre el catálogo de productos.
 *
 * Funciones exportadas:
 *   - search_products(params)   → busca productos con filtros combinables
 *   - get_product_details(id)   → devuelve un producto por ID o null
 *   - get_top_products(params)  → devuelve los N productos mejor valorados/más baratos
 */

'use strict';

const catalog = require('../../data/catalog.json');

// ─── Utilidades internas ───────────────────────────────────────────────────────

/**
 * Normaliza un texto para búsquedas: minúsculas, sin tildes, sin caracteres especiales.
 * @param {string} text
 * @returns {string}
 */
function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quitar tildes
    .trim();
}

/**
 * Comprueba si un texto de búsqueda aparece en el nombre o descripción del producto.
 * @param {Object} product
 * @param {string} query
 * @returns {boolean}
 */
function matchesQuery(product, query) {
  if (!query || query.trim() === '') return true;
  const q = normalize(query);
  const name = normalize(product.name);
  const desc = normalize(product.description);
  const cat = normalize(product.category);
  return name.includes(q) || desc.includes(q) || cat.includes(q);
}

// ─── Funciones públicas del módulo ────────────────────────────────────────────

/**
 * Busca productos aplicando filtros opcionales combinables.
 *
 * @param {Object} params
 * @param {string}  [params.query]     - Texto libre a buscar en nombre/descripción/categoría
 * @param {string}  [params.category]  - Categoría exacta (Electrónica, Ropa, Hogar, Deportes, Libros)
 * @param {number}  [params.minPrice]  - Precio mínimo en EUR (inclusive)
 * @param {number}  [params.maxPrice]  - Precio máximo en EUR (inclusive)
 * @param {number}  [params.minRating] - Valoración mínima (1-5, inclusive)
 * @param {number}  [params.limit]     - Número máximo de resultados (por defecto: 10)
 * @returns {Object} { products: Array, total: number, filters: Object }
 */
function search_products(params = {}) {
  const { query, category, minPrice, maxPrice, minRating, limit = 10 } = params;

  let results = catalog.filter(product => {
    // Filtro por texto libre (nombre, descripción, categoría)
    if (!matchesQuery(product, query)) return false;

    // Filtro por categoría exacta (case-insensitive)
    if (category) {
      const normalizedCat = normalize(category);
      const productCat = normalize(product.category);
      if (productCat !== normalizedCat) return false;
    }

    // Filtro por precio mínimo
    if (minPrice !== undefined && minPrice !== null && product.price < minPrice) return false;

    // Filtro por precio máximo
    if (maxPrice !== undefined && maxPrice !== null && product.price > maxPrice) return false;

    // Filtro por valoración mínima
    if (minRating !== undefined && minRating !== null && product.rating < minRating) return false;

    return true;
  });

  // Ordenar por rating descendente por defecto para maximizar calidad de resultados
  results.sort((a, b) => b.rating - a.rating);

  const sliced = results.slice(0, limit);

  return {
    products: sliced,
    total: results.length,
    filters: { query, category, minPrice, maxPrice, minRating, limit },
  };
}

/**
 * Obtiene el detalle completo de un producto por su ID.
 *
 * @param {string} productId - ID del producto (ej: "prod-elec-001")
 * @returns {Object|null} Producto encontrado o null si no existe
 */
function get_product_details(productId) {
  if (!productId) return null;
  const product = catalog.find(p => p.id === productId.trim());
  return product || null;
}

/**
 * Devuelve los N productos mejor clasificados según criterio de ordenación.
 *
 * @param {Object} params
 * @param {string}  [params.category]  - Filtrar por categoría (opcional)
 * @param {number}  [params.limit]     - Número de productos a devolver (por defecto: 5)
 * @param {string}  [params.sortBy]    - Criterio: 'rating' | 'price_asc' | 'price_desc' (por defecto: 'rating')
 * @returns {Object} { products: Array, total: number }
 */
function get_top_products(params = {}) {
  const { category, limit = 5, sortBy = 'rating' } = params;

  let results = [...catalog];

  // Filtrar por categoría si se especifica
  if (category) {
    const normalizedCat = normalize(category);
    results = results.filter(p => normalize(p.category) === normalizedCat);
  }

  // Ordenar según criterio
  switch (sortBy) {
    case 'price_asc':
      results.sort((a, b) => a.price - b.price);
      break;
    case 'price_desc':
      results.sort((a, b) => b.price - a.price);
      break;
    case 'rating':
    default:
      results.sort((a, b) => b.rating - a.rating || a.price - b.price);
      break;
  }

  return {
    products: results.slice(0, limit),
    total: results.length,
  };
}

module.exports = {
  search_products,
  get_product_details,
  get_top_products,
};

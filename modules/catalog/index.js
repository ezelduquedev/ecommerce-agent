/**
 * modules/catalog/index.js
 * Módulo de catálogo mutable de productos para el Agente de E-commerce.
 * Gestiona el estado en memoria y la persistencia en data/catalog.json.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../../data/catalog.json');
let catalogData = [];

// Carga inicial síncrona
try {
  const content = fs.readFileSync(filePath, 'utf8');
  catalogData = JSON.parse(content);
} catch (e) {
  console.error('Error cargando catálogo inicial:', e.message);
  catalogData = [];
}

/**
 * Obtiene la lista actual de productos del catálogo.
 * @returns {Array}
 */
function getCatalog() {
  return catalogData;
}

/**
 * Guarda el estado del catálogo actual en disco.
 * @returns {boolean} Éxito de la operación
 */
function saveCatalog() {
  try {
    fs.writeFileSync(filePath, JSON.stringify(catalogData, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Error guardando catálogo en disco:', e.message);
    return false;
  }
}

module.exports = {
  getCatalog,
  saveCatalog
};

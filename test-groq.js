/**
 * test-groq.js
 * Script de verificación de conectividad con la API de Groq.
 * Ejecutar con: node test-groq.js
 */

'use strict';

require('dotenv').config();
const Groq = require('groq-sdk');

async function testConnection() {
  console.log('🔌 Probando conexión con Groq API...');
  console.log(`   Modelo: ${process.env.MODEL}`);
  console.log(`   API Key: ${process.env.GROQ_API_KEY?.substring(0, 8)}...`);

  const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

  try {
    const response = await client.chat.completions.create({
      model: process.env.MODEL || 'llama-3.1-70b-versatile',
      messages: [
        { role: 'user', content: 'Responde exactamente con: "Conexión con Groq API verificada correctamente ✅"' }
      ],
      max_tokens: 50,
      temperature: 0,
    });

    const message = response.choices[0]?.message?.content;
    console.log('\n✅ Respuesta del modelo:');
    console.log(`   ${message}`);
    console.log('\n🎉 ¡Conexión exitosa! El agente está listo para el Día 2.');
  } catch (error) {
    console.error('\n❌ Error de conexión:');
    console.error(`   ${error.message}`);

    if (error.message?.includes('401') || error.message?.includes('authentication')) {
      console.error('\n⚠️  Comprueba que GROQ_API_KEY en tu .env empieza por "gsk_" y no tiene espacios.');
    } else if (error.message?.includes('model')) {
      console.error('\n⚠️  El modelo especificado puede no estar disponible. Prueba con "llama3-8b-8192".');
    }

    process.exit(1);
  }
}

testConnection();

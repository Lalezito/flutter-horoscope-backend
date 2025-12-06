#!/usr/bin/env node

/**
 * FIX POSTGRESQL INDEX - Manual Execution Script
 * Ejecuta el fix del índice problemático directamente en Railway PostgreSQL
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function fixPostgreSQLIndex() {
  console.log('🔧 Conectando a PostgreSQL en Railway...');

  try {
    const client = await pool.connect();
    console.log('✅ Conectado a PostgreSQL');

    // Drop el índice problemático
    console.log('\n📋 Ejecutando: DROP INDEX IF EXISTS idx_predictions_yesterday...');
    await client.query('DROP INDEX IF EXISTS idx_predictions_yesterday;');
    console.log('✅ Índice antiguo eliminado (si existía)');

    // Crear el nuevo índice sin función volátil
    console.log('\n📋 Ejecutando: CREATE INDEX idx_predictions_user_date...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_predictions_user_date
      ON predictions(user_id, predicted_for_date DESC);
    `);
    console.log('✅ Nuevo índice creado exitosamente');

    // Verificar que funcionó
    console.log('\n🔍 Verificando índices en tabla predictions...');
    const result = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'predictions'
      ORDER BY indexname;
    `);

    console.log('\n📊 Índices actuales en tabla predictions:');
    console.log('═══════════════════════════════════════');
    result.rows.forEach(row => {
      console.log(`  ✓ ${row.indexname}`);
      console.log(`    ${row.indexdef}`);
      console.log('');
    });

    client.release();

    console.log('═══════════════════════════════════════');
    console.log('🎉 FIX COMPLETADO EXITOSAMENTE');
    console.log('═══════════════════════════════════════');
    console.log('\n📋 Próximos pasos:');
    console.log('1. Ve a Railway Dashboard');
    console.log('2. Servicio: zodiac-backend-api');
    console.log('3. Click "Redeploy"');
    console.log('4. Espera 2-3 minutos');
    console.log('5. El backend debería arrancar sin errores');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error ejecutando fix:', error.message);
    console.error('\nDetalles del error:');
    console.error(error);
    process.exit(1);
  }
}

// Ejecutar fix
fixPostgreSQLIndex();

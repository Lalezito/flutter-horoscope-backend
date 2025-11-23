/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 🧪 MEMORY SYSTEM - COMPREHENSIVE TEST SUITE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * Run this file to validate the entire memory system:
 * - Database schema
 * - Service methods
 * - Memory extraction
 * - Resolution detection
 * - Multilingual support
 *
 * USAGE:
 *   node test-memory-system.js
 *
 * CREATED: 2025-01-23
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// Load environment variables
require('dotenv').config();

const db = require('./src/config/db');
const memoryService = require('./src/services/memoryService');
const { randomUUID } = require('crypto');

// Test utilities
const assert = (condition, message) => {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(message);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEST 1: Database Schema Validation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function testDatabaseSchema() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🗄️  TEST 1: Database Schema Validation');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Check if table exists
  const tableCheck = await db.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_name = 'user_memories'
    );
  `);
  assert(tableCheck.rows[0].exists, 'user_memories table should exist');

  // Check columns
  const columnsCheck = await db.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'user_memories'
    ORDER BY ordinal_position;
  `);

  const expectedColumns = [
    'id', 'user_id', 'memory_type', 'content', 'importance',
    'mentioned_at', 'last_referenced', 'resolved', 'resolution_note',
    'resolved_at', 'metadata', 'created_at', 'updated_at'
  ];

  const actualColumns = columnsCheck.rows.map(r => r.column_name);
  for (const col of expectedColumns) {
    assert(
      actualColumns.includes(col),
      `Column '${col}' should exist`
    );
  }

  // Check indices
  const indicesCheck = await db.query(`
    SELECT indexname
    FROM pg_indexes
    WHERE tablename = 'user_memories';
  `);

  const expectedIndices = [
    'idx_user_memories_user_id',
    'idx_user_memories_type',
    'idx_user_memories_importance',
    'idx_user_memories_unresolved',
    'idx_user_memories_recent',
    'idx_user_memories_active',
    'idx_user_memories_metadata'
  ];

  const actualIndices = indicesCheck.rows.map(r => r.indexname);
  for (const idx of expectedIndices) {
    assert(
      actualIndices.includes(idx),
      `Index '${idx}' should exist`
    );
  }

  // Check functions
  const functionsCheck = await db.query(`
    SELECT proname
    FROM pg_proc
    WHERE proname IN ('get_active_memories', 'resolve_memory', 'update_user_memories_updated_at');
  `);

  assert(functionsCheck.rows.length === 3, 'All 3 functions should exist');

  console.log('\n✨ Database schema validation: ALL TESTS PASSED\n');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEST 2: Basic Memory Extraction
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function testMemoryExtraction() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧠 TEST 2: Memory Extraction');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const testUserId = randomUUID();

  // Test 2.1: Extract life event (Spanish)
  console.log('Test 2.1: Life Event Extraction (Spanish)');
  const count1 = await memoryService.extractAndStoreMemories(
    "Mi mamá está enferma y tiene que ir al hospital la próxima semana",
    testUserId
  );
  assert(count1 >= 1, 'Should extract at least 1 life_event memory');

  // Test 2.2: Extract goal (English)
  console.log('Test 2.2: Goal Extraction (English)');
  const count2 = await memoryService.extractAndStoreMemories(
    "I want to achieve my dream job at Google, I have an interview next month",
    testUserId
  );
  assert(count2 >= 1, 'Should extract at least 1 goal memory');

  // Test 2.3: Extract milestone (Portuguese)
  console.log('Test 2.3: Milestone Extraction (Portuguese)');
  const count3 = await memoryService.extractAndStoreMemories(
    "Tenho um exame muito importante na próxima semana",
    testUserId
  );
  assert(count3 >= 1, 'Should extract at least 1 milestone memory');

  // Test 2.4: Extract challenge (French)
  console.log('Test 2.4: Challenge Extraction (French)');
  const count4 = await memoryService.extractAndStoreMemories(
    "J'ai des problèmes avec mon travail et je ne sais pas quoi faire",
    testUserId
  );
  assert(count4 >= 1, 'Should extract at least 1 challenge memory');

  // Verify all memories were stored
  const memories = await db.query(
    'SELECT * FROM user_memories WHERE user_id = $1',
    [testUserId]
  );
  assert(memories.rows.length >= 4, 'Should have at least 4 memories stored');

  console.log('\n✨ Memory extraction: ALL TESTS PASSED\n');
  return testUserId;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEST 3: Memory Retrieval and Context Building
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function testMemoryRetrieval(testUserId) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('💭 TEST 3: Memory Retrieval');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Test 3.1: Get relevant memories (Spanish)
  console.log('Test 3.1: Get Memories (Spanish)');
  const contextES = await memoryService.getRelevantMemories(
    testUserId,
    'Hola',
    'es'
  );
  assert(contextES !== null, 'Should return memory context');
  assert(contextES.includes('MEMORIAS IMPORTANTES'), 'Should be in Spanish');
  assert(contextES.includes('mamá'), 'Should include life event');

  // Test 3.2: Get relevant memories (English)
  console.log('Test 3.2: Get Memories (English)');
  const contextEN = await memoryService.getRelevantMemories(
    testUserId,
    'Hello',
    'en'
  );
  assert(contextEN !== null, 'Should return memory context');
  assert(contextEN.includes('IMPORTANT MEMORIES'), 'Should be in English');
  assert(contextEN.includes('Google'), 'Should include goal');

  // Test 3.3: Get relevant memories (Portuguese)
  console.log('Test 3.3: Get Memories (Portuguese)');
  const contextPT = await memoryService.getRelevantMemories(
    testUserId,
    'Olá',
    'pt'
  );
  assert(contextPT !== null, 'Should return memory context');
  assert(contextPT.includes('MEMÓRIAS IMPORTANTES'), 'Should be in Portuguese');

  // Test 3.4: Verify importance sorting
  console.log('Test 3.4: Verify Importance Sorting');
  const memories = await db.query(`
    SELECT memory_type, importance
    FROM user_memories
    WHERE user_id = $1 AND resolved = false
    ORDER BY importance DESC, mentioned_at DESC
    LIMIT 5
  `, [testUserId]);

  for (let i = 0; i < memories.rows.length - 1; i++) {
    assert(
      memories.rows[i].importance >= memories.rows[i + 1].importance,
      'Memories should be sorted by importance'
    );
  }

  console.log('\n✨ Memory retrieval: ALL TESTS PASSED\n');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEST 4: Resolution Detection and Tracking
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function testResolutionDetection(testUserId) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ TEST 4: Resolution Detection');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Test 4.1: Manual resolution
  console.log('Test 4.1: Manual Resolution');
  const resolved = await memoryService.resolveMemory(
    testUserId,
    'Google',
    'User got the job at Google!'
  );
  assert(resolved, 'Should resolve the Google job memory');

  // Verify resolution in database
  const checkResolved = await db.query(`
    SELECT resolved, resolution_note
    FROM user_memories
    WHERE user_id = $1 AND content ILIKE '%Google%'
  `, [testUserId]);

  assert(checkResolved.rows[0].resolved === true, 'Memory should be marked as resolved');
  assert(checkResolved.rows[0].resolution_note !== null, 'Should have resolution note');

  // Test 4.2: Automatic resolution detection (Spanish)
  console.log('Test 4.2: Automatic Resolution Detection (Spanish)');
  await memoryService.detectAndResolve(
    "Mi mamá ya salió del hospital y está mucho mejor!",
    testUserId
  );

  await sleep(100); // Give time for async operation

  const autoResolved = await db.query(`
    SELECT resolved
    FROM user_memories
    WHERE user_id = $1 AND content ILIKE '%mamá%'
  `, [testUserId]);

  assert(
    autoResolved.rows[0].resolved === true,
    'Should auto-resolve mom hospital memory'
  );

  // Test 4.3: Resolution shouldn't affect other memories
  console.log('Test 4.3: Verify Other Memories Remain Active');
  const activeMemories = await db.query(`
    SELECT COUNT(*)
    FROM user_memories
    WHERE user_id = $1 AND resolved = false
  `, [testUserId]);

  assert(
    activeMemories.rows[0].count > 0,
    'Should still have active (unresolved) memories'
  );

  console.log('\n✨ Resolution detection: ALL TESTS PASSED\n');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEST 5: Memory Statistics
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function testMemoryStats(testUserId) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 TEST 5: Memory Statistics');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const stats = await memoryService.getStats(testUserId);

  console.log('Stats:', JSON.stringify(stats, null, 2));

  assert(stats !== null, 'Should return stats object');
  assert(stats.total_memories > 0, 'Should have total memories count');
  assert(stats.resolved >= 0, 'Should have resolved count');
  assert(stats.active >= 0, 'Should have active count');
  assert(
    stats.total_memories === stats.resolved + stats.active,
    'Total should equal resolved + active'
  );
  assert(stats.highest_importance >= 1, 'Should have highest importance');
  assert(stats.highest_importance <= 10, 'Highest importance should be ≤ 10');

  console.log('\n✨ Memory statistics: ALL TESTS PASSED\n');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEST 6: Multilingual Support
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function testMultilingualSupport() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🌍 TEST 6: Multilingual Support');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const multilingualTests = [
    {
      lang: 'en',
      message: 'My father is sick and in the hospital',
      expectedHeader: 'IMPORTANT MEMORIES',
      expectedInstruction: 'CRITICAL INSTRUCTIONS'
    },
    {
      lang: 'es',
      message: 'Mi padre está enfermo y en el hospital',
      expectedHeader: 'MEMORIAS IMPORTANTES',
      expectedInstruction: 'INSTRUCCIONES CRÍTICAS'
    },
    {
      lang: 'pt',
      message: 'Meu pai está doente e no hospital',
      expectedHeader: 'MEMÓRIAS IMPORTANTES',
      expectedInstruction: 'INSTRUÇÕES CRÍTICAS'
    },
    {
      lang: 'fr',
      message: 'Mon père est malade et à l\'hôpital',
      expectedHeader: 'SOUVENIRS IMPORTANTS',
      expectedInstruction: 'INSTRUCTIONS CRITIQUES'
    },
    {
      lang: 'de',
      message: 'Mein Vater ist krank und im Krankenhaus',
      expectedHeader: 'WICHTIGE ERINNERUNGEN',
      expectedInstruction: 'KRITISCHE ANWEISUNGEN'
    },
    {
      lang: 'it',
      message: 'Mio padre è malato e in ospedale',
      expectedHeader: 'MEMORIE IMPORTANTI',
      expectedInstruction: 'ISTRUZIONI CRITICHE'
    }
  ];

  for (const test of multilingualTests) {
    console.log(`Test 6.${multilingualTests.indexOf(test) + 1}: ${test.lang.toUpperCase()} Support`);

    const userId = randomUUID();

    // Extract memory
    await memoryService.extractAndStoreMemories(test.message, userId);

    // Get context
    const context = await memoryService.getRelevantMemories(userId, '', test.lang);

    assert(context !== null, `Should return context for ${test.lang}`);
    assert(
      context.includes(test.expectedHeader),
      `Should have ${test.lang} header: ${test.expectedHeader}`
    );
    assert(
      context.includes(test.expectedInstruction),
      `Should have ${test.lang} instructions: ${test.expectedInstruction}`
    );
  }

  console.log('\n✨ Multilingual support: ALL TESTS PASSED\n');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEST 7: Edge Cases and Error Handling
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function testEdgeCases() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('⚠️  TEST 7: Edge Cases and Error Handling');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const testUserId = randomUUID();

  // Test 7.1: Empty message
  console.log('Test 7.1: Empty Message');
  const count1 = await memoryService.extractAndStoreMemories('', testUserId);
  assert(count1 === 0, 'Should extract 0 memories from empty message');

  // Test 7.2: Message with no triggers
  console.log('Test 7.2: Message With No Trigger Keywords');
  const count2 = await memoryService.extractAndStoreMemories(
    'The weather is nice today',
    testUserId
  );
  assert(count2 === 0, 'Should extract 0 memories from irrelevant message');

  // Test 7.3: Very short triggering phrase
  console.log('Test 7.3: Very Short Message');
  const count3 = await memoryService.extractAndStoreMemories(
    'Mi mamá',
    testUserId
  );
  assert(count3 === 0, 'Should not extract from very short message');

  // Test 7.4: Non-existent user for retrieval
  console.log('Test 7.4: Non-existent User');
  const nonExistentUserId = randomUUID();
  const context = await memoryService.getRelevantMemories(nonExistentUserId, '', 'en');
  assert(context === null, 'Should return null for user with no memories');

  // Test 7.5: Duplicate memory prevention
  console.log('Test 7.5: Duplicate Prevention');
  await memoryService.extractAndStoreMemories(
    'Mi papá está en el hospital',
    testUserId
  );
  const count4 = await memoryService.extractAndStoreMemories(
    'Mi papá está en el hospital',
    testUserId
  );
  assert(count4 === 0, 'Should not create duplicate memory');

  // Test 7.6: Invalid language code (should fallback to English)
  console.log('Test 7.6: Invalid Language Code');
  await memoryService.extractAndStoreMemories('My mom is sick', testUserId);
  const contextInvalid = await memoryService.getRelevantMemories(
    testUserId,
    '',
    'xx' // Invalid language code
  );
  assert(contextInvalid !== null, 'Should fallback to English');
  assert(
    contextInvalid.includes('IMPORTANT MEMORIES'),
    'Should use English as fallback'
  );

  console.log('\n✨ Edge cases: ALL TESTS PASSED\n');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEST 8: Performance Benchmarks
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function testPerformance() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('⚡ TEST 8: Performance Benchmarks');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const testUserId = randomUUID();

  // Setup: Create some memories
  await memoryService.extractAndStoreMemories(
    'Mi mamá está enferma y en el hospital',
    testUserId
  );
  await memoryService.extractAndStoreMemories(
    'Quiero conseguir un nuevo trabajo en Google',
    testUserId
  );

  // Benchmark 8.1: Extraction time
  console.log('Benchmark 8.1: Memory Extraction Speed');
  const extractStart = Date.now();
  await memoryService.extractAndStoreMemories(
    'Tengo una entrevista importante la próxima semana',
    testUserId
  );
  const extractTime = Date.now() - extractStart;
  console.log(`  ⏱️  Extraction time: ${extractTime}ms`);
  assert(extractTime < 200, 'Extraction should take < 200ms');

  // Benchmark 8.2: Retrieval time
  console.log('Benchmark 8.2: Memory Retrieval Speed');
  const retrieveStart = Date.now();
  await memoryService.getRelevantMemories(testUserId, '', 'es');
  const retrieveTime = Date.now() - retrieveStart;
  console.log(`  ⏱️  Retrieval time: ${retrieveTime}ms`);
  assert(retrieveTime < 100, 'Retrieval should take < 100ms');

  // Benchmark 8.3: Resolution time
  console.log('Benchmark 8.3: Resolution Speed');
  const resolveStart = Date.now();
  await memoryService.resolveMemory(testUserId, 'Google', 'Got the job');
  const resolveTime = Date.now() - resolveStart;
  console.log(`  ⏱️  Resolution time: ${resolveTime}ms`);
  assert(resolveTime < 50, 'Resolution should take < 50ms');

  // Benchmark 8.4: Stats calculation
  console.log('Benchmark 8.4: Stats Calculation Speed');
  const statsStart = Date.now();
  await memoryService.getStats(testUserId);
  const statsTime = Date.now() - statsStart;
  console.log(`  ⏱️  Stats time: ${statsTime}ms`);
  assert(statsTime < 100, 'Stats should take < 100ms');

  console.log('\n✨ Performance benchmarks: ALL TESTS PASSED\n');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CLEANUP: Remove test data
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function cleanup(testUserIds) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧹 CLEANUP: Removing Test Data');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  for (const userId of testUserIds) {
    await db.query('DELETE FROM user_memories WHERE user_id = $1', [userId]);
  }

  console.log('✅ Test data cleaned up\n');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN TEST RUNNER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function runAllTests() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║       🧠 MEMORY SYSTEM - COMPREHENSIVE TEST SUITE 🧠          ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  const startTime = Date.now();
  const testUserIds = [];

  try {
    // Run all test suites
    await testDatabaseSchema();

    const extractionUserId = await testMemoryExtraction();
    testUserIds.push(extractionUserId);

    await testMemoryRetrieval(extractionUserId);
    await testResolutionDetection(extractionUserId);
    await testMemoryStats(extractionUserId);
    await testMultilingualSupport();
    await testEdgeCases();
    await testPerformance();

    const totalTime = Date.now() - startTime;

    // All tests passed!
    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║                  🎉 ALL TESTS PASSED! 🎉                      ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');
    console.log(`⏱️  Total test time: ${totalTime}ms`);
    console.log(`✅ 8 test suites executed successfully`);
    console.log(`🧠 Memory system is ready for production!\n`);

  } catch (error) {
    console.error('\n╔═══════════════════════════════════════════════════════════════╗');
    console.error('║                    ❌ TESTS FAILED ❌                          ║');
    console.error('╚═══════════════════════════════════════════════════════════════╝\n');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    // Cleanup test data
    await cleanup(testUserIds);

    // Close database connection
    await db.query('SELECT 1'); // Keep pool alive
    console.log('🔌 Database connection pool maintained\n');
  }
}

// Run tests
if (require.main === module) {
  runAllTests()
    .then(() => {
      console.log('✨ Test suite completed successfully!\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = {
  testDatabaseSchema,
  testMemoryExtraction,
  testMemoryRetrieval,
  testResolutionDetection,
  testMemoryStats,
  testMultilingualSupport,
  testEdgeCases,
  testPerformance,
  runAllTests
};

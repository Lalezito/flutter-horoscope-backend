#!/usr/bin/env node
/**
 * DEBUG SWISS EPHEMERIS RESPONSE
 */

try {
    const sweph = require('sweph');
    console.log('🔍 Debugging Swiss Ephemeris response structure...\n');
    
    const julianDay = sweph.julday(2024, 1, 1, 12.0, 1);
    console.log('Julian Day:', julianDay);
    
    const sunResult = sweph.calc_ut(julianDay, 0, 2);
    console.log('\n☀️ Sun result structure:');
    console.log('Type:', typeof sunResult);
    console.log('Is Array:', Array.isArray(sunResult));
    console.log('Content:', sunResult);
    
    if (Array.isArray(sunResult)) {
        console.log('Array length:', sunResult.length);
        sunResult.forEach((item, index) => {
            console.log(`  [${index}]:`, item, '(type:', typeof item, ')');
        });
    }
    
    if (sunResult && typeof sunResult === 'object') {
        console.log('Object keys:', Object.keys(sunResult));
    }
    
} catch (error) {
    console.error('❌ Error:', error.message);
}
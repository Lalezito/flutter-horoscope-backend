#!/usr/bin/env node
/**
 * CHECK SWISS EPHEMERIS CONSTANTS
 */

try {
    const sweph = require('sweph');
    
    console.log('🔍 Available Swiss Ephemeris constants:\n');
    
    // List all properties
    const properties = Object.keys(sweph).sort();
    
    console.log('📊 Total properties:', properties.length);
    console.log('\n🪐 Planetary constants:');
    
    properties.forEach(prop => {
        if (prop.startsWith('SE_') && !prop.includes('FLG') && !prop.includes('CAL')) {
            console.log(`  ${prop}: ${sweph[prop]}`);
        }
    });
    
    console.log('\n🏛️ Flags:');
    properties.forEach(prop => {
        if (prop.includes('FLG')) {
            console.log(`  ${prop}: ${sweph[prop]}`);
        }
    });
    
    console.log('\n📅 Calendar:');
    properties.forEach(prop => {
        if (prop.includes('CAL')) {
            console.log(`  ${prop}: ${sweph[prop]}`);
        }
    });

    console.log('\n🧪 Testing basic planet IDs:');
    const basicPlanets = [
        { name: 'Sun', id: 0 },
        { name: 'Moon', id: 1 },
        { name: 'Mercury', id: 2 },
        { name: 'Venus', id: 3 },
        { name: 'Mars', id: 4 },
        { name: 'Jupiter', id: 5 },
        { name: 'Saturn', id: 6 },
        { name: 'Uranus', id: 7 },
        { name: 'Neptune', id: 8 },
        { name: 'Pluto', id: 9 }
    ];

    const testJD = sweph.julday(2024, 1, 1, 12.0, 1);
    
    basicPlanets.forEach(planet => {
        try {
            const result = sweph.calc_ut(testJD, planet.id, sweph.SEFLG_SWIEPH || 2);
            if (!result.error) {
                console.log(`  ✅ ${planet.name} (${planet.id}): ${result.longitude.toFixed(2)}°`);
            } else {
                console.log(`  ❌ ${planet.name} (${planet.id}): ${result.error}`);
            }
        } catch (err) {
            console.log(`  ❌ ${planet.name} (${planet.id}): ${err.message}`);
        }
    });

} catch (error) {
    console.error('❌ Error checking Swiss Ephemeris:', error.message);
}
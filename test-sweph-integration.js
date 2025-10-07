#!/usr/bin/env node
/**
 * SWISS EPHEMERIS INTEGRATION TEST
 * 
 * Quick test to validate Swiss Ephemeris is working correctly
 */

console.log('🧪 Testing Swiss Ephemeris Integration...\n');

try {
    const sweph = require('sweph');
    console.log('✅ Swiss Ephemeris module loaded successfully');

    // Test Julian Day calculation
    const testDate = new Date('2024-01-01T12:00:00.000Z');
    const julianDay = sweph.julday(2024, 1, 1, 12.0, 1); // 1 for SE_GREG_CAL
    console.log(`✅ Julian Day calculated: ${julianDay}`);

    // Test planetary position calculation (using Moshier fallback)
    const sunResult = sweph.calc_ut(julianDay, 0, 2); // 0 = Sun, 2 = SEFLG_SWIEPH
    if (sunResult.error && !sunResult.error.includes('using Moshier eph')) {
        console.log(`❌ Sun calculation error: ${sunResult.error}`);
    } else {
        console.log(`✅ Sun position: ${sunResult.longitude.toFixed(6)}° (${getZodiacSign(sunResult.longitude)})`);
        if (sunResult.error) {
            console.log(`  ⚠️ Note: ${sunResult.error.trim()}`);
        }
    }

    // Test Moon calculation
    const moonResult = sweph.calc_ut(julianDay, 1, 2); // 1 = Moon
    if (moonResult.error && !moonResult.error.includes('using Moshier eph')) {
        console.log(`❌ Moon calculation error: ${moonResult.error}`);
    } else {
        console.log(`✅ Moon position: ${moonResult.longitude.toFixed(6)}° (${getZodiacSign(moonResult.longitude)})`);
        if (moonResult.error) {
            console.log(`  ⚠️ Note: Using Moshier ephemeris fallback (less accurate)`);
        }
    }

    // Test house calculation
    const housesResult = sweph.houses(julianDay, 40.7128, -74.0060, 'P'); // NYC coordinates
    if (housesResult.error) {
        console.log(`❌ Houses calculation error: ${housesResult.error}`);
    } else {
        console.log(`✅ Houses calculated - Ascendant: ${housesResult.ascendant.toFixed(6)}° (${getZodiacSign(housesResult.ascendant)})`);
        console.log(`✅ Midheaven: ${housesResult.midheaven.toFixed(6)}° (${getZodiacSign(housesResult.midheaven)})`);
    }

    // Test multiple planets
    const planets = [
        { name: 'Mercury', id: 2 },
        { name: 'Venus', id: 3 },
        { name: 'Mars', id: 4 },
        { name: 'Jupiter', id: 5 },
        { name: 'Saturn', id: 6 }
    ];

    console.log('\n🪐 Planetary Positions for January 1, 2024:');
    planets.forEach(planet => {
        const result = sweph.calc_ut(julianDay, planet.id, 2); // 2 = SEFLG_SWIEPH
        if (result && typeof result.longitude === 'number') {
            const sign = getZodiacSign(result.longitude);
            const degree = result.longitude % 30;
            console.log(`  ${planet.name}: ${degree.toFixed(2)}° ${sign.charAt(0).toUpperCase() + sign.slice(1)}`);
        } else {
            console.log(`  ${planet.name}: Calculation failed`);
        }
    });

    // Test aspect calculation
    console.log('\n📐 Testing Aspect Calculation:');
    const sun = sweph.calc_ut(julianDay, 0, 2); // 0 = Sun
    const moon = sweph.calc_ut(julianDay, 1, 2); // 1 = Moon
    
    if (sun && moon && typeof sun.longitude === 'number' && typeof moon.longitude === 'number') {
        const aspect = calculateAspect(sun.longitude, moon.longitude);
        if (aspect) {
            console.log(`  Sun-Moon aspect: ${aspect.aspect} (orb: ${aspect.orb.toFixed(2)}°)`);
        } else {
            console.log(`  No major Sun-Moon aspect found`);
        }
    }

    console.log('\n🎉 Swiss Ephemeris integration test completed successfully!');
    console.log('\n📝 System Information:');
    console.log(`  Node.js version: ${process.version}`);
    console.log(`  Platform: ${process.platform}`);
    console.log(`  Architecture: ${process.arch}`);

} catch (error) {
    console.error('❌ Swiss Ephemeris integration test failed:');
    console.error(error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Make sure sweph package is installed: npm install sweph');
    console.error('2. Check if ephemeris data files are needed');
    console.error('3. Verify system compatibility with Swiss Ephemeris');
    process.exit(1);
}

function getZodiacSign(longitude) {
    const signs = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 
                  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
    return signs[Math.floor(longitude / 30)];
}

function calculateAspect(pos1, pos2) {
    const diff = Math.abs(pos1 - pos2);
    const angle = Math.min(diff, 360 - diff);

    const aspectTypes = [
        { name: 'conjunction', angle: 0, orb: 8 },
        { name: 'opposition', angle: 180, orb: 8 },
        { name: 'trine', angle: 120, orb: 6 },
        { name: 'square', angle: 90, orb: 6 },
        { name: 'sextile', angle: 60, orb: 4 }
    ];

    for (const aspectType of aspectTypes) {
        const orb = Math.abs(angle - aspectType.angle);
        if (orb <= aspectType.orb) {
            return {
                aspect: aspectType.name,
                orb: orb
            };
        }
    }

    return null;
}
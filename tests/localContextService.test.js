/**
 * 🧪 LOCAL CONTEXT SERVICE - UNIT TESTS
 *
 * Comprehensive test suite for local context functionality
 *
 * Run: npm test tests/localContextService.test.js
 */

const localContextService = require('../src/services/localContextService');

describe('🌍 Local Context Service', () => {

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🎉 HOLIDAY DETECTION TESTS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('Holiday Detection', () => {

    test('should detect Argentina Independence Day', async () => {
      const context = await localContextService.getLocalContext('AR', new Date('2025-07-09'));
      expect(context.holiday).toBe('Día de la Independencia');
      expect(context.country).toBe('AR');
    });

    test('should detect Mexico Independence Day', async () => {
      const context = await localContextService.getLocalContext('MX', new Date('2025-09-16'));
      expect(context.holiday).toBe('Día de la Independencia de México');
    });

    test('should detect Mexico Día de Muertos', async () => {
      const context = await localContextService.getLocalContext('MX', new Date('2025-11-02'));
      expect(context.holiday).toBe('Día de Muertos');
    });

    test('should detect Spain Día de Reyes', async () => {
      const context = await localContextService.getLocalContext('ES', new Date('2025-01-06'));
      expect(context.holiday).toBe('Día de Reyes');
    });

    test('should detect Chile Fiestas Patrias', async () => {
      const context = await localContextService.getLocalContext('CL', new Date('2025-09-18'));
      expect(context.holiday).toBe('Fiestas Patrias - Día de la Independencia');
    });

    test('should detect US Independence Day', async () => {
      const context = await localContextService.getLocalContext('US', new Date('2025-07-04'));
      expect(context.holiday).toBe('Independence Day');
    });

    test('should detect Brazil Carnaval', async () => {
      const context = await localContextService.getLocalContext('BR', new Date('2025-02-13'));
      expect(context.holiday).toBe('Carnaval');
    });

    test('should detect Christmas for all countries', async () => {
      const countries = ['AR', 'MX', 'ES', 'US', 'BR'];
      for (const country of countries) {
        const context = await localContextService.getLocalContext(country, new Date('2025-12-25'));
        expect(context.holiday).toContain('Navidad');
      }
    });

    test('should return null for non-holiday dates', async () => {
      const context = await localContextService.getLocalContext('AR', new Date('2025-03-15'));
      expect(context.holiday).toBeNull();
    });

  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🌤️ SEASON DETECTION TESTS (Hemisphere-Aware)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('Season Detection (Hemisphere-Aware)', () => {

    // NORTHERN HEMISPHERE TESTS

    test('Northern Hemisphere: Summer (US - July)', async () => {
      const context = await localContextService.getLocalContext('US', new Date('2025-07-15'));
      expect(context.season).toBe('Verano');
      expect(context.hemisphere).toBe('norte');
    });

    test('Northern Hemisphere: Winter (US - December)', async () => {
      const context = await localContextService.getLocalContext('US', new Date('2025-12-15'));
      expect(context.season).toBe('Invierno');
    });

    test('Northern Hemisphere: Spring (Mexico - April)', async () => {
      const context = await localContextService.getLocalContext('MX', new Date('2025-04-15'));
      expect(context.season).toBe('Primavera');
    });

    test('Northern Hemisphere: Autumn (Spain - October)', async () => {
      const context = await localContextService.getLocalContext('ES', new Date('2025-10-15'));
      expect(context.season).toBe('Otoño');
    });

    // SOUTHERN HEMISPHERE TESTS (REVERSED SEASONS!)

    test('Southern Hemisphere: Winter (Argentina - July)', async () => {
      const context = await localContextService.getLocalContext('AR', new Date('2025-07-15'));
      expect(context.season).toBe('Invierno'); // Opposite of Northern!
      expect(context.hemisphere).toBe('sur');
    });

    test('Southern Hemisphere: Summer (Argentina - December)', async () => {
      const context = await localContextService.getLocalContext('AR', new Date('2025-12-15'));
      expect(context.season).toBe('Verano'); // Opposite of Northern!
    });

    test('Southern Hemisphere: Autumn (Chile - April)', async () => {
      const context = await localContextService.getLocalContext('CL', new Date('2025-04-15'));
      expect(context.season).toBe('Otoño'); // Opposite of Northern!
    });

    test('Southern Hemisphere: Spring (Brazil - October)', async () => {
      const context = await localContextService.getLocalContext('BR', new Date('2025-10-15'));
      expect(context.season).toBe('Primavera'); // Opposite of Northern!
    });

    // VERIFICATION: Same date, different seasons!

    test('Hemisphere Verification: July 15 - US vs Argentina', async () => {
      const usContext = await localContextService.getLocalContext('US', new Date('2025-07-15'));
      const arContext = await localContextService.getLocalContext('AR', new Date('2025-07-15'));

      expect(usContext.season).toBe('Verano');  // Summer in US
      expect(arContext.season).toBe('Invierno'); // Winter in Argentina
    });

    test('Hemisphere Verification: December 15 - US vs Argentina', async () => {
      const usContext = await localContextService.getLocalContext('US', new Date('2025-12-15'));
      const arContext = await localContextService.getLocalContext('AR', new Date('2025-12-15'));

      expect(usContext.season).toBe('Invierno'); // Winter in US
      expect(arContext.season).toBe('Verano');   // Summer in Argentina
    });

  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🎭 CULTURAL EVENTS TESTS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('Cultural Events Detection', () => {

    test('Argentina: Winter vacation period (July)', async () => {
      const context = await localContextService.getLocalContext('AR', new Date('2025-07-15'));
      expect(context.culturalEvents).toContain('Vacaciones de invierno');
      expect(context.culturalEvents).toContain('Bariloche');
    });

    test('Mexico: Día de Muertos cultural context (November)', async () => {
      const context = await localContextService.getLocalContext('MX', new Date('2025-11-15'));
      expect(context.culturalEvents).toContain('Día de Muertos');
    });

    test('Mexico: Maratón Guadalupe-Reyes period (December)', async () => {
      const context = await localContextService.getLocalContext('MX', new Date('2025-12-15'));
      expect(context.culturalEvents).toContain('Guadalupe-Reyes');
    });

    test('Spain: Summer vacation peak (August)', async () => {
      const context = await localContextService.getLocalContext('ES', new Date('2025-08-15'));
      expect(context.culturalEvents).toContain('verano');
      expect(context.culturalEvents).toContain('vacaciones');
    });

    test('Brazil: Carnaval season (February)', async () => {
      const context = await localContextService.getLocalContext('BR', new Date('2025-02-15'));
      expect(context.culturalEvents).toContain('Carnaval');
    });

    test('Colombia: Feria de las Flores context (August)', async () => {
      const context = await localContextService.getLocalContext('CO', new Date('2025-08-15'));
      expect(context.culturalEvents).toContain('Feria de las Flores');
    });

  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ⭐ SPECIAL PERIODS TESTS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('Special Periods Detection', () => {

    test('Christmas season (Dec 15 - Jan 6)', async () => {
      const context1 = await localContextService.getLocalContext('AR', new Date('2025-12-20'));
      const context2 = await localContextService.getLocalContext('AR', new Date('2026-01-03'));

      expect(context1.specialPeriod).toBe('Temporada navideña');
      expect(context2.specialPeriod).toBe('Temporada navideña');
    });

    test('Maratón Guadalupe-Reyes (Mexico only, Dec 12 - Jan 6)', async () => {
      const context = await localContextService.getLocalContext('MX', new Date('2025-12-15'));
      expect(context.specialPeriod).toBe('Maratón Guadalupe-Reyes');
    });

    test('Summer vacation - Northern Hemisphere (July-August)', async () => {
      const context = await localContextService.getLocalContext('US', new Date('2025-07-20'));
      expect(context.specialPeriod).toBe('Período de vacaciones de verano');
    });

    test('Summer vacation - Southern Hemisphere (Dec-Feb)', async () => {
      const context = await localContextService.getLocalContext('AR', new Date('2025-01-15'));
      expect(context.specialPeriod).toBe('Vacaciones de verano');
    });

    test('No special period for random date', async () => {
      const context = await localContextService.getLocalContext('AR', new Date('2025-05-15'));
      expect(context.specialPeriod).toBeNull();
    });

  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🌎 TIMEZONE & HEMISPHERE TESTS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('Timezone Detection', () => {

    test('Argentina timezone', async () => {
      const context = await localContextService.getLocalContext('AR', new Date());
      expect(context.timezone).toBe('America/Argentina/Buenos_Aires');
    });

    test('Mexico timezone', async () => {
      const context = await localContextService.getLocalContext('MX', new Date());
      expect(context.timezone).toBe('America/Mexico_City');
    });

    test('Spain timezone', async () => {
      const context = await localContextService.getLocalContext('ES', new Date());
      expect(context.timezone).toBe('Europe/Madrid');
    });

    test('Unknown country defaults to UTC', async () => {
      const context = await localContextService.getLocalContext('XX', new Date());
      expect(context.timezone).toBe('UTC');
    });

  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 📅 WEEKEND DETECTION
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('Weekend Detection', () => {

    test('Saturday is weekend', async () => {
      const context = await localContextService.getLocalContext('AR', new Date('2025-07-05')); // Saturday
      expect(context.isWeekend).toBe(true);
    });

    test('Sunday is weekend', async () => {
      const context = await localContextService.getLocalContext('AR', new Date('2025-07-06')); // Sunday
      expect(context.isWeekend).toBe(true);
    });

    test('Monday is not weekend', async () => {
      const context = await localContextService.getLocalContext('AR', new Date('2025-07-07')); // Monday
      expect(context.isWeekend).toBe(false);
    });

  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 📝 PROMPT GENERATION TESTS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('AI Prompt Generation', () => {

    test('should build context prompt for holiday', async () => {
      const context = await localContextService.getLocalContext('AR', new Date('2025-07-09'));
      const prompt = localContextService.buildContextPrompt(context);

      expect(prompt).toContain('CONTEXTO LOCAL DEL USUARIO');
      expect(prompt).toContain('Día de la Independencia');
      expect(prompt).toContain('Argentina');
      expect(prompt).toContain('Invierno');
      expect(prompt).toContain('hemisferio sur');
    });

    test('should include special period in prompt', async () => {
      const context = await localContextService.getLocalContext('MX', new Date('2025-12-15'));
      const prompt = localContextService.buildContextPrompt(context);

      expect(prompt).toContain('Maratón Guadalupe-Reyes');
      expect(prompt).toContain('México');
    });

    test('should include cultural events in prompt', async () => {
      const context = await localContextService.getLocalContext('AR', new Date('2025-07-15'));
      const prompt = localContextService.buildContextPrompt(context);

      expect(prompt).toContain('CONTEXTO CULTURAL DEL MES');
      expect(prompt).toContain('Vacaciones de invierno');
    });

    test('should provide season-specific instructions', async () => {
      const context = await localContextService.getLocalContext('AR', new Date('2025-07-15'));
      const prompt = localContextService.buildContextPrompt(context);

      expect(prompt).toContain('Invierno');
      expect(prompt).toContain('introspectivas');
      expect(prompt).toContain('autocuidado');
    });

    test('should warn about hemisphere-specific references', async () => {
      const context = await localContextService.getLocalContext('AR', new Date('2025-07-15'));
      const prompt = localContextService.buildContextPrompt(context);

      expect(prompt).toContain('EVITA referencias del hemisferio opuesto');
      expect(prompt).toContain('hemisferio SUR');
    });

    test('should return empty string for invalid context', () => {
      const prompt = localContextService.buildContextPrompt(null);
      expect(prompt).toBe('');
    });

  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔍 CONTEXT SUMMARY TESTS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('Context Summary Generation', () => {

    test('should generate summary with holiday', async () => {
      const context = await localContextService.getLocalContext('AR', new Date('2025-07-09'));
      const summary = localContextService.getContextSummary(context);

      expect(summary).toContain('AR');
      expect(summary).toContain('Invierno');
      expect(summary).toContain('Feriado: Día de la Independencia');
    });

    test('should generate summary without holiday', async () => {
      const context = await localContextService.getLocalContext('AR', new Date('2025-03-15'));
      const summary = localContextService.getContextSummary(context);

      expect(summary).toContain('AR');
      expect(summary).toContain('Otoño');
      expect(summary).not.toContain('Feriado');
    });

    test('should handle empty context', () => {
      const summary = localContextService.getContextSummary({});
      expect(summary).toBe('No context');
    });

  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ✅ COUNTRY VALIDATION TESTS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('Country Code Validation', () => {

    test('should validate supported countries', () => {
      expect(localContextService.isValidCountry('AR')).toBe(true);
      expect(localContextService.isValidCountry('MX')).toBe(true);
      expect(localContextService.isValidCountry('ES')).toBe(true);
      expect(localContextService.isValidCountry('US')).toBe(true);
      expect(localContextService.isValidCountry('BR')).toBe(true);
    });

    test('should reject unsupported countries', () => {
      expect(localContextService.isValidCountry('XX')).toBe(false);
      expect(localContextService.isValidCountry('ZZ')).toBe(false);
      expect(localContextService.isValidCountry('ABC')).toBe(false);
    });

    test('should be case-sensitive', () => {
      expect(localContextService.isValidCountry('AR')).toBe(true);
      expect(localContextService.isValidCountry('ar')).toBe(false);
    });

  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔄 COMPREHENSIVE INTEGRATION TESTS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('Full Context Integration', () => {

    test('Complete context for Argentina Independence Day', async () => {
      const context = await localContextService.getLocalContext('AR', new Date('2025-07-09'));

      expect(context).toMatchObject({
        country: 'AR',
        countryName: 'Argentina',
        season: 'Invierno',
        holiday: 'Día de la Independencia',
        hemisphere: 'sur',
        timezone: 'America/Argentina/Buenos_Aires'
      });

      expect(context.culturalEvents).toContain('invierno');
      expect(context.monthName).toBe('julio');
    });

    test('Complete context for Mexico Día de Muertos', async () => {
      const context = await localContextService.getLocalContext('MX', new Date('2025-11-02'));

      expect(context).toMatchObject({
        country: 'MX',
        countryName: 'México',
        season: 'Otoño',
        holiday: 'Día de Muertos',
        hemisphere: 'norte',
        timezone: 'America/Mexico_City'
      });

      expect(context.culturalEvents).toContain('Día de Muertos');
      expect(context.monthName).toBe('noviembre');
    });

    test('Complete context for US Independence Day', async () => {
      const context = await localContextService.getLocalContext('US', new Date('2025-07-04'));

      expect(context).toMatchObject({
        country: 'US',
        countryName: 'United States',
        season: 'Verano',
        holiday: 'Independence Day',
        hemisphere: 'norte'
      });

      expect(context.specialPeriod).toBe('Período de vacaciones de verano');
    });

  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🛡️ ERROR HANDLING TESTS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('Error Handling', () => {

    test('should handle invalid date gracefully', async () => {
      const context = await localContextService.getLocalContext('AR', new Date('invalid'));
      expect(context).toHaveProperty('country');
    });

    test('should handle unsupported country gracefully', async () => {
      const context = await localContextService.getLocalContext('XX', new Date());

      expect(context.country).toBe('XX');
      expect(context.holiday).toBeNull();
      expect(context.culturalEvents).toBeNull();
      expect(context.timezone).toBe('UTC');
    });

    test('should provide fallback context on error', async () => {
      const context = await localContextService.getLocalContext('XX', new Date());

      expect(context).toMatchObject({
        country: 'XX',
        hemisphere: 'norte',
        timezone: 'UTC',
        isWeekend: expect.any(Boolean)
      });
    });

  });

});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📊 PERFORMANCE TESTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('⚡ Performance Tests', () => {

  test('should complete context generation in <10ms', async () => {
    const startTime = Date.now();
    await localContextService.getLocalContext('AR', new Date('2025-07-09'));
    const endTime = Date.now();

    const duration = endTime - startTime;
    expect(duration).toBeLessThan(10);
  });

  test('should handle 100 consecutive requests efficiently', async () => {
    const startTime = Date.now();

    for (let i = 0; i < 100; i++) {
      await localContextService.getLocalContext('AR', new Date());
    }

    const endTime = Date.now();
    const avgTime = (endTime - startTime) / 100;

    expect(avgTime).toBeLessThan(10); // Average <10ms per request
  });

});

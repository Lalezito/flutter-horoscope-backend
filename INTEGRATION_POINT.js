/**
 * 🔌 INTEGRATION INSTRUCTIONS FOR REGIONAL MODISMOS
 *
 * Where to add in aiCoachService.js:
 * Location: In sendMessage method around line 665 (in _generateAIResponse method)
 *
 * STEP 1: Find this section in _generateAIResponse method (around line 665-668):
 */

// Build final system prompt with all enhancements
let finalSystemPrompt = personalizedPrompt;
if (empathyContext) {
  finalSystemPrompt += '\n\n' + empathyContext;
}

/**
 * STEP 2: ADD THIS CODE RIGHT AFTER THE ABOVE (before the response quality guidelines):
 */

// 🌍 Add regional customization if country is known
const metadata = options.metadata || {};
if (metadata.country) {
  const regionalContext = this._buildRegionalPrompt(metadata.country, language);
  if (regionalContext) {
    finalSystemPrompt += '\n\n' + regionalContext;
    logger.logInfo('Regional customization applied', {
      country: metadata.country,
      language: language
    });
  }
}

/**
 * EXPECTED RESULT:
 *
 * The complete section should look like:
 */

// Build final system prompt with all enhancements
let finalSystemPrompt = personalizedPrompt;
if (empathyContext) {
  finalSystemPrompt += '\n\n' + empathyContext;
}

// 🌍 Add regional customization if country is known
const metadata = options.metadata || {};
if (metadata.country) {
  const regionalContext = this._buildRegionalPrompt(metadata.country, language);
  if (regionalContext) {
    finalSystemPrompt += '\n\n' + regionalContext;
    logger.logInfo('Regional customization applied', {
      country: metadata.country,
      language: language
    });
  }
}

// ✨ ENHANCED: Research-backed content guidelines for engagement
finalSystemPrompt += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 RESPONSE QUALITY GUIDELINES (CRITICAL - FOLLOW STRICTLY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
...`

/**
 * HOW TO PASS COUNTRY FROM CLIENT:
 *
 * Frontend should send:
 * {
 *   sessionId: 'session-123',
 *   message: '¿Cómo está mi día?',
 *   userId: 'user-456',
 *   options: {
 *     zodiacSign: 'Leo',
 *     language: 'es',
 *     metadata: {
 *       country: 'AR'  // <-- Country code here
 *     }
 *   }
 * }
 *
 * SUPPORTED COUNTRY CODES (18 total):
 *
 * Spanish: AR, MX, ES, CO, CL, PE, VE, UY, EC
 * English: US, GB, AU, CA, IN
 * Portuguese: BR, PT
 * French: FR
 * German: DE
 * Italian: IT
 *
 * COUNTRY DETECTION STRATEGIES:
 *
 * 1. User Profile Setting (preferred)
 *    - Let users manually select their country in app settings
 *
 * 2. Device Locale (fallback)
 *    - Use iOS/Android locale to infer country
 *    - Swift: Locale.current.regionCode
 *    - Android: Locale.getDefault().getCountry()
 *
 * 3. IP Geolocation (last resort)
 *    - Use IP-based API for country detection
 *    - Only if user hasn't set preference
 *
 * TESTING:
 *
 * curl -X POST http://localhost:3000/api/ai-coach/send-message \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "sessionId": "test-session",
 *     "message": "¿Cómo puedo mejorar mi día?",
 *     "userId": "test-user",
 *     "options": {
 *       "zodiacSign": "Leo",
 *       "language": "es",
 *       "metadata": {
 *         "country": "AR"
 *       }
 *     }
 *   }'
 *
 * Expected AI response should include Argentine voseo and modismos like:
 * "Che, tu energía hoy está re zarpada. Aprovechá que tenés la luna a favor..."
 */

module.exports = {
  note: 'Integration instructions only - not executable code'
};

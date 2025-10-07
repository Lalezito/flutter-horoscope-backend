const { z } = require("@modelcontextprotocol/sdk/server/mcp");
const monitoringController = require("../../controllers/monitoringController");

// Definir signos zodiacales
const ZODIAC_SIGNS = [
  "aries", "taurus", "gemini", "cancer", "leo", "virgo",
  "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces"
];

// Datos de ejemplo para signos zodiacales
const ZODIAC_DATA = {
  aries: {
    element: "fire",
    traits: ["adventurous", "energetic", "courageous", "enthusiastic"],
    compatibility: ["leo", "sagittarius", "gemini", "aquarius"]
  },
  taurus: {
    element: "earth",
    traits: ["reliable", "patient", "practical", "devoted"],
    compatibility: ["virgo", "capricorn", "cancer", "pisces"]
  },
  gemini: {
    element: "air",
    traits: ["versatile", "communicative", "witty", "curious"],
    compatibility: ["libra", "aquarius", "aries", "leo"]
  },
  cancer: {
    element: "water",
    traits: ["emotional", "intuitive", "protective", "sympathetic"],
    compatibility: ["scorpio", "pisces", "taurus", "virgo"]
  },
  leo: {
    element: "fire",
    traits: ["generous", "warm-hearted", "creative", "faithful"],
    compatibility: ["aries", "sagittarius", "gemini", "libra"]
  },
  virgo: {
    element: "earth",
    traits: ["modest", "reliable", "practical", "analytical"],
    compatibility: ["taurus", "capricorn", "cancer", "scorpio"]
  },
  libra: {
    element: "air",
    traits: ["diplomatic", "romantic", "sociable", "idealistic"],
    compatibility: ["gemini", "aquarius", "leo", "sagittarius"]
  },
  scorpio: {
    element: "water",
    traits: ["determined", "passionate", "resourceful", "mysterious"],
    compatibility: ["cancer", "pisces", "virgo", "capricorn"]
  },
  sagittarius: {
    element: "fire",
    traits: ["optimistic", "honest", "adventurous", "independent"],
    compatibility: ["aries", "leo", "libra", "aquarius"]
  },
  capricorn: {
    element: "earth",
    traits: ["responsible", "disciplined", "self-controlled", "goal-oriented"],
    compatibility: ["taurus", "virgo", "scorpio", "pisces"]
  },
  aquarius: {
    element: "air",
    traits: ["progressive", "original", "humanitarian", "detached"],
    compatibility: ["gemini", "libra", "aries", "sagittarius"]
  },
  pisces: {
    element: "water",
    traits: ["compassionate", "artistic", "intuitive", "gentle"],
    compatibility: ["cancer", "scorpio", "taurus", "capricorn"]
  }
};

// Datos de compatibilidad
const COMPATIBILITY_DATA = {
  // Ejemplo de datos de compatibilidad
  "aries-leo": {
    score: 95,
    description: "Aries and Leo share a natural understanding and mutual respect.",
    strengths: ["Both are natural leaders", "Share enthusiasm for life"],
    challenges: ["Both can be dominant", "May compete for control"]
  },
  "taurus-scorpio": {
    score: 80,
    description: "Taurus and Scorpio have a complex but potentially rewarding relationship.",
    strengths: ["Complementary elements", "Deep emotional connection"],
    challenges: ["Different approaches to conflict", "May be too intense"]
  }
  // Más datos de compatibilidad...
};

// Datos de elementos
const ELEMENT_DATA = {
  fire: {
    signs: ["aries", "leo", "sagittarius"],
    traits: ["passionate", "energetic", "spontaneous", "adventurous"]
  },
  earth: {
    signs: ["taurus", "virgo", "capricorn"],
    traits: ["practical", "reliable", "patient", "grounded"]
  },
  air: {
    signs: ["gemini", "libra", "aquarius"],
    traits: ["intellectual", "communicative", "social", "flexible"]
  },
  water: {
    signs: ["cancer", "scorpio", "pisces"],
    traits: ["emotional", "intuitive", "empathetic", "sensitive"]
  }
};

// Registrar recursos zodiacales
async function registerZodiacResources(server) {
  // Recurso para información de signos
  server.resource(
    "zodiac://signs/{sign}",
    "Zodiac Sign Information",
    "Information about a specific zodiac sign",
    "application/json",
    async (uri) => {
      try {
        // Registrar acceso a recurso en el sistema de monitoreo
        monitoringController.incrementMcpResourcesAccessed();
        
        const sign = uri.split('/').pop();
        
        if (!ZODIAC_SIGNS.includes(sign)) {
          throw new Error(`Unknown zodiac sign: ${sign}`);
        }
        
        const data = ZODIAC_DATA[sign] || {};
        
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify({ sign, ...data }, null, 2)
            }
          ]
        };
      } catch (error) {
        console.error(`Error reading zodiac sign resource:`, error);
        throw error;
      }
    }
  );
  
  // Recurso para información de compatibilidad
  server.resource(
    "zodiac://compatibility/{sign1}/{sign2}",
    "Zodiac Compatibility Information",
    "Compatibility information between two zodiac signs",
    "application/json",
    async (uri) => {
      try {
        // Registrar acceso a recurso en el sistema de monitoreo
        monitoringController.incrementMcpResourcesAccessed();
        
        const parts = uri.split('/');
        const sign1 = parts[parts.length - 2];
        const sign2 = parts[parts.length - 1];
        
        if (!ZODIAC_SIGNS.includes(sign1) || !ZODIAC_SIGNS.includes(sign2)) {
          throw new Error(`Invalid zodiac signs: ${sign1}, ${sign2}`);
        }
        
        const key = `${sign1}-${sign2}`;
        const data = COMPATIBILITY_DATA[key] || { score: 0, description: "Compatibility data not available" };
        
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify({ sign1, sign2, ...data }, null, 2)
            }
          ]
        };
      } catch (error) {
        console.error(`Error reading zodiac compatibility resource:`, error);
        throw error;
      }
    }
  );
  
  // Recurso para información de elementos
  server.resource(
    "zodiac://elements/{element}",
    "Zodiac Element Information",
    "Information about a specific zodiac element",
    "application/json",
    async (uri) => {
      try {
        // Registrar acceso a recurso en el sistema de monitoreo
        monitoringController.incrementMcpResourcesAccessed();
        
        const element = uri.split('/').pop();
        
        if (!ELEMENT_DATA[element]) {
          throw new Error(`Unknown zodiac element: ${element}`);
        }
        
        const data = ELEMENT_DATA[element] || {};
        
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify({ element, ...data }, null, 2)
            }
          ]
        };
      } catch (error) {
        console.error(`Error reading zodiac element resource:`, error);
        throw error;
      }
    }
  );
  
  return server;
}

module.exports = {
  registerZodiacResources
};
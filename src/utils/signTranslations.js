/**
 * 🌟 SIGN TRANSLATIONS UTILITY
 * Normaliza nombres de signos zodiacales entre inglés y español
 * Los horóscopos se guardan con nombres en español en la base de datos
 */

// Mapa de traducción de signos (inglés → español)
const SIGN_TRANSLATIONS = {
  aries: "Aries",
  taurus: "Tauro",
  gemini: "Géminis",
  cancer: "Cáncer",
  leo: "Leo",
  virgo: "Virgo",
  libra: "Libra",
  scorpio: "Escorpio",
  sagittarius: "Sagitario",
  capricorn: "Capricornio",
  aquarius: "Acuario",
  pisces: "Piscis",
};

// Mapa inverso (español → inglés)
const SIGN_TRANSLATIONS_REVERSE = {
  aries: "Aries",
  tauro: "Taurus",
  géminis: "Gemini",
  geminis: "Gemini",
  cáncer: "Cancer",
  cancer: "Cancer",
  leo: "Leo",
  virgo: "Virgo",
  libra: "Libra",
  escorpio: "Scorpio",
  sagitario: "Sagittarius",
  capricornio: "Capricorn",
  acuario: "Aquarius",
  piscis: "Pisces",
};

/**
 * Normaliza el nombre del signo al formato español (usado en DB)
 * @param {string} sign - Nombre del signo en cualquier idioma
 * @returns {string} - Nombre del signo en español
 */
function normalizeSignName(sign) {
  if (!sign) return sign;
  const lowerSign = sign.toLowerCase().trim();
  return SIGN_TRANSLATIONS[lowerSign] || sign;
}

/**
 * Convierte el nombre del signo a inglés
 * @param {string} sign - Nombre del signo en cualquier idioma
 * @returns {string} - Nombre del signo en inglés
 */
function toEnglishSign(sign) {
  if (!sign) return sign;
  const lowerSign = sign.toLowerCase().trim();
  return SIGN_TRANSLATIONS_REVERSE[lowerSign] || sign;
}

/**
 * Lista de todos los signos en español
 */
const SPANISH_SIGNS = [
  "Aries",
  "Tauro",
  "Géminis",
  "Cáncer",
  "Leo",
  "Virgo",
  "Libra",
  "Escorpio",
  "Sagitario",
  "Capricornio",
  "Acuario",
  "Piscis",
];

/**
 * Lista de todos los signos en inglés
 */
const ENGLISH_SIGNS = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
];

module.exports = {
  SIGN_TRANSLATIONS,
  SIGN_TRANSLATIONS_REVERSE,
  normalizeSignName,
  toEnglishSign,
  SPANISH_SIGNS,
  ENGLISH_SIGNS,
};

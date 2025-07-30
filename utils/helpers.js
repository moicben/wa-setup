/**
 * Helpers minimalistes
 * Fonctions utilitaires essentielles
 */

const { executeCommand } = require('./adb');

/**
 * Attendre un délai en ms
 */
async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function randomSleep(min, max) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  //console.log(`⌛️ Délai de ${delay}ms...`);
  return await sleep(delay);
}

/**
 * Réessayer une fonction avec backoff
 */
async function retry(fn, attempts = 3, delay = 1000) {
  for (let i = 0; i < attempts; i++) {
        try {
      return await fn();
    } catch (error) {
      if (i === attempts - 1) throw error;
      
      console.log(`⚠️ Tentative ${i + 1}/${attempts} échouée, retry dans ${delay}ms`);
      await sleep(delay);
      delay *= 1.5; // Backoff exponentiel
    }
    }
}

/**
 * Parser un numéro de téléphone
 */
function parsePhone(country, number) {
  const countryPrefixes = {
    'FR': '+33',
    'UK': '+44',
    'US': '+1',
    'PH': '+63',
    'DE': '+49',
    'ES': '+34'
  };
  
  // Nettoyer le numéro
  const cleaned = number.replace(/[^\d]/g, '');
  
  // Ajouter le préfixe si nécessaire
  const prefix = countryPrefixes[country] || '+1';
  if (!number.startsWith('+')) {
    return prefix + cleaned;
    }

  return '+' + cleaned;
}

/**
 * Gestionnaire d'erreurs simple
 */
function errorHandler(error, context = '') {
  const message = error.message || 'Erreur inconnue';
  const code = error.code || 'UNKNOWN';
  
  console.error(`❌ ${context}: ${message} (${code})`);
  
        return {
    success: false,
    error: message,
    code,
            context
  };
}

/**
 * Vérifier si une erreur est retriable
 */
function isRetryableError(error) {
  const retryableCodes = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'];
  const retryableMessages = ['timeout', 'network', 'temporarily'];
  
  return retryableCodes.includes(error.code) ||
  retryableMessages.some(msg => error.message?.toLowerCase().includes(msg));
}


// Fonction utilitaire pour tap
async function tap(device, coords) {
  // Si coords est un objet avec x et y
  if (typeof coords === 'object' && coords.x !== undefined && coords.y !== undefined) {
    await executeCommand(device, `shell input tap ${coords.x} ${coords.y}`);
  } 
  // Sinon si ce sont des paramètres séparés (pour compatibilité)
  else {
    const x = coords;
    const y = arguments[2];
    await executeCommand(device, `shell input tap ${x} ${y}`);
  }
}

// Fonction utilitaire pour appuyer sur espace, tab ou enter
async function press(device, key, repeat = 1) {
  for (let i = 0; i < repeat; i++) {
    await executeCommand(device, `shell input keyevent ${key}`);
    await sleep(100);
  }
}


// Fonction utilitaire pour écrire une phrase entière avec espace
async function writeSentence(device, sentence) {
  // Nettoyer et échapper le texte de manière robuste
  const cleanSentence = sentence
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[ç]/g, 'c')
    .replace(/[ñ]/g, 'n')
    .replace(/[æ]/g, 'ae')
    .replace(/[œ]/g, 'oe')
    .replace(/[À-ÿ]/g, '') // Supprimer les autres caractères spéciaux
    .replace(/['"`]/g, '') // Supprimer les apostrophes et guillemets
    .replace(/[^\w\s\-.,!?]/g, ''); // Garder seulement lettres, chiffres, espaces et ponctuation basique
  
  // Échapper pour le shell
  const formattedSentence = cleanSentence.replace(/ /g, '\\ ');
  
  // Écrire la phrase
  if (formattedSentence.trim().length > 0) {
    await executeCommand(device, `shell input text "${formattedSentence}"`);
  }

  
}


        

// Export des fonctions
module.exports = {
  sleep,
  randomSleep,
  retry,
  parsePhone,
  errorHandler,
  isRetryableError,
  tap,
  press,
  writeSentence
};
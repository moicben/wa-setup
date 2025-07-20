/**
 * Helpers minimalistes
 * Fonctions utilitaires essentielles
 */

/**
 * Attendre un délai en ms
 */
async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

// Export des fonctions
module.exports = {
  sleep,
  retry,
  parsePhone,
  errorHandler,
  isRetryableError
};
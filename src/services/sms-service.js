/**
 * SMS Service consolidé avec retry et gestion des prix
 * Interface avec SMS-Activate API
 */

const axios = require('axios');

// Configuration
const SMS_API_URL = 'https://api.sms-activate.org/stubs/handler_api.php';
const WHATSAPP_SERVICE_ID = 'wa';

// Cache des activations en cours
const activations = new Map();

// Mapping étendu des codes pays
const countryMap = {
  'FR': 1,   // France
  'UK': 16,  // United Kingdom  
  'US': 187, // USA
  'PH': 4,   // Philippines
  'DE': 43,  // Germany
  'ES': 56,  // Spain
  'IT': 86,  // Italy
  'RU': 0,   // Russia
  'UA': 1,   // Ukraine
  'PL': 15,  // Poland
  'IN': 22,  // India
  'ID': 6,   // Indonesia
  'VN': 10,  // Vietnam
  'TH': 52,  // Thailand
  'BR': 73,  // Brazil
  'MX': 54,  // Mexico
  'TR': 62,  // Turkey
  'BD': 60,  // Bangladesh
  'PK': 66,  // Pakistan
  'EG': 21   // Egypt
};

/**
 * Obtenir un numéro avec retry et gestion des prix
 */
async function getPhoneNumber(countryCode, config = {}) {
  const apiKey = process.env.SMS_ACTIVATE_API_KEY;
  if (!apiKey) {
    throw new Error('SMS_ACTIVATE_API_KEY non définie');
  }

  const retryConfig = {
    maxAttempts: config.sms.numberRetry.maxAttempts,
    priceChangeInterval: config.sms.numberRetry.priceChangeInterval,
    fallbackCountries: config.sms.numberRetry.fallbackCountries,
    delayBetweenRetries: config.sms.numberRetry.delayBetweenRetries,
    priceSteps: config.sms.numberRetry.priceSteps,
  };

  let attempts = 0;
  let currentPriceStep = 0;
  let countriesPool = [countryCode, ...retryConfig.fallbackCountries];

  console.log(`🔄 Début de la recherche de numéro avec ${retryConfig.maxAttempts} tentatives max`);

  while (attempts < retryConfig.maxAttempts) {
    attempts++;
    
    // Changer de niveau de prix tous les X tentatives
    if (attempts > 1 && attempts % retryConfig.priceChangeInterval === 1) {
      currentPriceStep = Math.min(currentPriceStep + 1, retryConfig.priceSteps.length - 1);
      const currentStep = retryConfig.priceSteps[currentPriceStep];
      console.log(`💰 [Attempt ${attempts}] Passage au niveau de prix ${currentPriceStep + 1} (max ${currentStep.maxCost})`);
      
      // Utiliser les pays de ce niveau de prix
      countriesPool = [...currentStep.countries, ...retryConfig.fallbackCountries];
    }

    // Essayer chaque pays de la pool
    for (const country of countriesPool) {
      try {
        console.log(`🌍 [Attempt ${attempts}] Tentative avec ${country}...`);
        
        const result = await getPhoneNumberForCountry(country, apiKey);
        if (result.success) {
          console.log(`✅ Numéro obtenu après ${attempts} tentatives: ${result.phoneNumber}`);
          return result.phoneNumber;
        } else {
          console.log(`⚠️ ${country}: ${result.error}`);
        }
      } catch (error) {
        console.log(`❌ ${country}: ${error.message}`);
      }
    }

    // Délai avant la prochaine tentative
    if (attempts < retryConfig.maxAttempts) {
      console.log(`⏳ Attente ${retryConfig.delayBetweenRetries}ms avant retry...`);
      await new Promise(resolve => setTimeout(resolve, retryConfig.delayBetweenRetries));
    }
  }

  throw new Error(`Aucun numéro trouvé après ${retryConfig.maxAttempts} tentatives`);
}

/**
 * Obtenir un numéro pour un pays spécifique
 */
async function getPhoneNumberForCountry(countryCode, apiKey) {
  const country = countryMap[countryCode];
  if (country === undefined) {
    return { success: false, error: `Pays non mappé: ${countryCode}` };
  }

  try {
    const response = await axios.get(SMS_API_URL, {
      params: {
        api_key: apiKey,
        action: 'getNumber',
        service: WHATSAPP_SERVICE_ID,
        country: country
      }
    });

    const data = response.data;
    
    if (data.includes('ACCESS_NUMBER')) {
      const [, activationId, phoneNumber] = data.split(':');
      
      // Sauvegarder l'activation
      activations.set(activationId, {
        id: activationId,
        phone: phoneNumber,
        country: countryCode,
        status: 'waiting'
      });

      return { 
        success: true, 
        phoneNumber: `+${phoneNumber}`, 
        activationId,
        country: countryCode 
      };
    } else if (data === 'NO_NUMBERS') {
      return { success: false, error: 'Pas de numéros disponibles' };
    } else if (data === 'NO_BALANCE') {
      return { success: false, error: 'Solde insuffisant' };
    } else if (data === 'BAD_KEY') {
      throw new Error('Clé API invalide');
    } else {
      return { success: false, error: `Erreur API: ${data}` };
    }
  } catch (error) {
    if (error.response?.status === 429) {
      return { success: false, error: 'Rate limit dépassé' };
    }
    throw error;
  }
}

/**
 * Annuler un numéro
 */
async function cancelNumber(activationId) {
  const apiKey = process.env.SMS_ACTIVATE_API_KEY;
  if (!apiKey) return;

  try {
    await axios.get(SMS_API_URL, {
      params: {
        api_key: apiKey,
        action: 'setStatus',
        id: activationId,
        status: 8 // Cancel
      }
    });
    activations.delete(activationId);
    console.log(`🗑️ Numéro annulé: ${activationId}`);
  } catch (error) {
    console.warn('⚠️ Erreur annulation numéro:', error.message);
  }
}

/**
 * Obtenir le solde du compte
 */
async function getBalance() {
  const apiKey = process.env.SMS_ACTIVATE_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await axios.get(SMS_API_URL, {
      params: {
        api_key: apiKey,
        action: 'getBalance'
      }
    });

    const balance = parseFloat(response.data.replace('ACCESS_BALANCE:', ''));
    console.log(`💳 Solde: ${balance}₽`);
    return balance;
  } catch (error) {
    console.warn('⚠️ Erreur récupération solde:', error.message);
    return null;
  }
}

/**
 * Vérifier la disponibilité des numéros pour un pays
 */
async function checkNumberAvailability(countryCode) {
  const apiKey = process.env.SMS_ACTIVATE_API_KEY;
  if (!apiKey) return false;

  const country = countryMap[countryCode];
  if (country === undefined) return false;

  try {
    const response = await axios.get(SMS_API_URL, {
      params: {
        api_key: apiKey,
        action: 'getNumbersStatus',
        country: country,
        service: WHATSAPP_SERVICE_ID
      }
    });

    const data = response.data;
    if (data.includes('wa_0')) {
      const count = parseInt(data.split('wa_0:')[1]?.split(':')[0] || '0');
      return count > 0;
    }
    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Attendre la réception d'un SMS
 */
async function waitForSMS(phoneNumber, timeout = 120000) {
  const apiKey = process.env.SMS_ACTIVATE_API_KEY;
  if (!apiKey) {
    throw new Error('SMS_ACTIVATE_API_KEY non définie');
  }

  // Trouver l'activation
  let activation = null;
  for (const [id, act] of activations.entries()) {
    if (act.phone === phoneNumber.replace('+', '')) {
      activation = act;
      break;
    }
  }

  if (!activation) {
    throw new Error('Activation non trouvée pour ce numéro');
  }

  const startTime = Date.now();
  const checkInterval = 5000; // 5 secondes

  console.log(`⏳ Attente du SMS pour ${phoneNumber}...`);

  while (Date.now() - startTime < timeout) {
    try {
      const response = await axios.get(SMS_API_URL, {
        params: {
          api_key: apiKey,
          action: 'getStatus',
          id: activation.id
        }
      });

      const data = response.data;
            
      if (data.includes('STATUS_OK')) {
        const code = data.split(':')[1];
        console.log(`✅ Code SMS reçu: ${code}`);
        
        // Marquer comme terminé
        await setStatus(activation.id, 6); // Status "done"
        activations.delete(activation.id);
        
        return code;
      } else if (data === 'STATUS_WAIT_CODE') {
        // Continuer à attendre
        await new Promise(resolve => setTimeout(resolve, checkInterval));
      } else {
        throw new Error(`Status inattendu: ${data}`);
      }
    } catch (error) {
      console.error('❌ Erreur vérification SMS:', error.message);
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
  }

  throw new Error('Timeout: SMS non reçu');
}

/**
 * Changer le status d'une activation
 */
async function setStatus(activationId, status) {
  const apiKey = process.env.SMS_ACTIVATE_API_KEY;
  if (!apiKey) return;

  try {
    await axios.get(SMS_API_URL, {
      params: {
        api_key: apiKey,
        action: 'setStatus',
        id: activationId,
        status: status
      }
    });
  } catch (error) {
    console.warn('⚠️ Erreur changement status:', error.message);
  }
}

/**
 * Annuler toutes les activations en cours
 */
async function cancelAllActivations() {
  for (const [id, activation] of activations.entries()) {
    await setStatus(id, 8); // Status "cancel"
  }
  activations.clear();
  console.log('🧹 Toutes les activations annulées');
}

// Export du service
module.exports = {
  getPhoneNumber,
  getPhoneNumberForCountry,
  cancelNumber,
  getBalance,
  checkNumberAvailability,
  waitForSMS,
  cancelAllActivations,
  getSMSService: () => ({
    getPhoneNumber,
    getPhoneNumberForCountry,
    cancelNumber,
    getBalance,
    checkNumberAvailability,
    waitForSMS,
    cancelAllActivations
  })
};
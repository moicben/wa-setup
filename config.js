/**
 * Configuration par défaut du projet WA-Setup
 * Modifiez ces valeurs selon vos besoins
 */

module.exports = {
  // Environnement d'exécution
  // Options: 'morelogin' (cloud), 'bluestacks' (local), 'cloud' (API)
  env: 'bluestacks',
  
  // Pays par défaut pour les numéros de téléphone
  // Options: 'FR', 'UK', 'US', 'PH', etc.
  country: 'UK',
  
  // Nombre de comptes à créer en parallèle
  parallel: 1,
  
  // Utiliser un device existant au lieu d'en créer un nouveau
  useExistingDevice: false,
  
  // Préfixe de téléphone personnalisé (ex: '+33' pour France)
  // Si non défini, utilise le service SMS pour obtenir un numéro
  phonePrefix: null,
  
  // Script de lancement personnalisé (code JavaScript à exécuter)
  customLaunch: null,
  
  // Configuration SMS
  sms: {
    // Clé API SMS-Activate (peut être définie via SMS_ACTIVATE_API_KEY env var)
    apiKey: process.env.SMS_ACTIVATE_API_KEY,
    // Timeout en ms pour attendre un SMS
    timeout: 120000, // 2 minutes
    // Nombre de tentatives
    retries: 3,
    // Configuration retry pour obtenir un numéro
    numberRetry: {
      maxAttempts: 50,        // AUGMENTÉ: Plus de tentatives
      priceChangeInterval: 3,  // RÉDUIT: Essayer UK plus souvent
      fallbackCountries: ['UK', 'FR', 'ID', 'PH'], // UK en priorité dans fallback
      delayBetweenRetries: 500, // RÉDUIT: Réaction plus rapide
      priceSteps: [
        { maxCost: 50, countries: ['UK', 'FR', 'US'] },    // UK en PREMIER
        { maxCost: 10, countries: ['TH', 'IN', 'UA'] },     
        { maxCost: 5, countries: ['PH', 'ID', 'VN'] },      
        { maxCost: 20, countries: ['RU', 'PL', 'DE'] }      
      ]
    }
  },
  
  // Configuration des devices
  device: {
    // Ports BlueStacks par défaut
    bluestacksPorts: [5705, 5605, 5587, 5588],
    // Configuration MoreLogin
    morelogin: {
      apiUrl: process.env.MORELOGIN_API_URL || 'http://localhost:7001',
      groupId: process.env.MORELOGIN_GROUP_ID || null
    }
  },
  
  // Options de logging
  logging: {
    // Niveau de log: 'debug', 'info', 'warn', 'error'
    level: 'info',
    // Sauvegarder les logs dans des fichiers
    toFile: false,
    // Dossier pour les logs (si toFile est true)
    directory: './logs'
  },
  
  // Options de screenshots
  screenshots: {
    // Prendre des screenshots pendant le workflow
    enabled: true,
    // Dossier pour sauvegarder les screenshots
    directory: './screenshots'
  },


  // Configuration OCR
  ocr: {
    enabled: true,
    maxRetries: 3,
    acceptKeywords: ['SMS', 'Verify by SMS', 'Continue', 'Receive code'],
    rejectKeywords: ['can\'t receive SMS', 'invalid number', 'error', 'try again', 'blocked'],
    lang: 'eng' // Langue pour Tesseract
  }
}; 
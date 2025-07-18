/**
 * Configuration par défaut du projet WA-Setup
 * Modifiez ces valeurs selon vos besoins
 */

module.exports = {
  // Environnement d'exécution
  // Options: 'morelogin' (cloud), 'bluestacks' (local), 'cloud' (API)
  env: 'morelogin',
  
  // Pays par défaut pour les numéros de téléphone
  // Options: 'FR', 'UK', 'US', 'PH', etc.
  country: 'FR',
  
  // Nombre de comptes à créer en parallèle
  parallel: 3,
  
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
    apiKey: process.env.SMS_ACTIVATE_API_KEY || null,
    // Timeout en ms pour attendre un SMS
    timeout: 120000, // 2 minutes
    // Nombre de tentatives
    retries: 3
  },
  
  // Configuration des devices
  device: {
    // Ports BlueStacks par défaut
    bluestacksPorts: [5555, 5585, 5605, 5587, 5588],
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
    enabled: false,
    // Dossier pour sauvegarder les screenshots
    directory: './screenshots'
  }
}; 
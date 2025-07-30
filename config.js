/**
 * Configuration par défaut du projet WA-Setup
 * Modifiez ces valeurs selon vos besoins
 */

module.exports = {
  // Environnement d'exécution
  // Options: 'morelogin' (cloud), 'bluestacks' (local), 'cloud' (API), 'droplet' (remote)
  env: 'bluestacks',
  
  // Pays par défaut pour les numéros de téléphone
  // Options: 'FR', 'UK', 'US', 'PH', etc.
  country: 'FR',
  
  // Nombre de comptes à créer en parallèle
  parallel: 1,

  // Ports des devices
  devicePorts: [
    {id: 0, port: 5555}, 
    {id: 1, port: 5805}, 
    {id: 2, port: 5815}, 
    {id: 3, port: 5615}, 
    {id: 4, port: 5625}, 
    {id: 5, port: 5705}, 
    {id: 6, port: 5715}, 
    {id: 7, port: 5825}, 
    {id: 8, port: 5835}, 
    {id: 9, port: 5845}, 
    {id: 10, port: 5855}, 
    {id: 11, port: 5865}, 
    {id: 12, port: 5875}, 
    {id: 43, port: 5985}, 
    {id: 44, port: 5995}, 
    {id: 45, port: 6005}, 
    {id: 46, port: 6015}, 
    {id: 47, port: 6025}, 
    {id: 48, port: 6035}, 
    {id: 49, port: 6045}, 

  ],
  
  // Utiliser un device existant au lieu d'en créer un nouveau
  useExistingDevice: false,
  
  // Préfixe de téléphone personnalisé (ex: '+33' pour France)
  // Si non défini, utilise le service SMS pour obtenir un numéro
  phonePrefix: null,
  
  // Script de lancement personnalisé (code JavaScript à exécuter)
  customLaunch: null,

  // Data SEND
  send: [
    {
    id: 0,  
    name: 'Campagne test',
    message: `
            Merci de votre réponse.
            \nCordialement`,
    query: 'test', // Query pour la recherche de contacts
    count: 15
    },
    {
    id: 1,  
    name: 'feldmann-levy-1',
    message: `
          Bonjour, je viens de voir sur votre ligne que vous êtes disponible pour du secrétariat en distanciel.
          
          Pour notre cabinet notarial, nous recherchons une secrétaire polyvalente, disponible 4 heures/semaine.
          
          Prenons 15 minutes, pour échanger en fin de journée ou ces prochains jours :
          calendar.google-share.com/calendar/u/0/appointments/schedules/booking/feldmann-levy
          
          Salutations distinguées,
          Maître Karen FELDMANN-LEVY, 
          
          9 avenue Emile Deschanel, 75007
          www.etude-lecomte-feldmann-levy-paris.notaires.fr`,
    query: 'secrétaire', // Query pour la recherche de contacts
    count: 25
    },
    {
    id: 2,
    name: 'mickael-le-maillot',
    message: {
    1: `
          Enchanté, j'ai vu sur votre site que vous proposez du secrétariat.
          
          Nous aurions besoin d'aide sur service client + suivi de paiements.
          
          Avez-vous de la dispo en ce moment pour de nouveaux clients (4-8 heures/semaine début ASAP) ?
          
          Au plaisir,
          Mickael, BIM Digital`,
    2: `
          Bonjour, j'ai vu sur site que vous proposez du secrétariat.
          
          Nous aurions besoin d'aide sur service client + suivi de paiements.
          Avez-vous de la dispo actuellement pour de nouveaux clients (4-8 heures semaine début ASAP) ?
          
          Cordialement,
          Mickael, BIM Digital`,
    3: `
          Salut, j'ai vu que vous proposez du secrétariat.
          
          On aurait besoin d'aide sur service client + suivi de paiements.
          Vous avez de la dispo en ce moment pour nouveaux clients (4-8h/semaine début ASAP) ?
          
          Bien à vous,
          Mickael, BIM Digital`,
    4: `
          Enchanté, j'ai noté sur votre site que vous proposez du secrétariat.
          
          Nous recherchons de l'aide sur service client + suivi de paiements.
          Auriez-vous de la disponibilité pour de nouveaux clients (4-8 heures par semaine début ASAP) ?
          
          Au plaisir d'échanger,
          Mickael, BIM Digital`,
    },
    query: 'télésecrétaire', // Query pour la recherche de contacts
    count: 10 
    },
  ],


  // Data BRAND
  brand: [
    {
    id: 0,
    name: 'Mickael Le Maillot',
    description: 'Co-Fondateur BIM DIGITAL, boostez votre communication digitale avec une agence pro à Lyon !',
    image: 'mickael.webp',
    },
  ],


  //
  
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
    // Configuration MoreLogin
    morelogin: {
      apiUrl: process.env.MORELOGIN_API_URL || 'http://localhost:7001',
      groupId: process.env.MORELOGIN_GROUP_ID || null
    },
    // Configuration Droplet
    droplet: {
      //host: '159.223.28.175', // CLASSIQUE
      host: 'localhost', // MESHNET NORD
      port: 5555
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
    maxRetries: 10,
    acceptKeywords: ['SMS', 'Verify by SMS', 'Continue', 'Receive code'],
    rejectKeywords: ['can\'t receive SMS', 'invalid number', 'error', 'try again', 'blocked', 'phone', 'call'],
    lang: 'eng' // Langue pour Tesseract
  }
}; 
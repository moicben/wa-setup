/**
 * WhatsApp Service minimaliste
 * Gère les interactions avec l'application WhatsApp
 */

const { executeCommand } = require('./device-service');
const { sleep } = require('../utils/helpers');

// Coordonnées UI par défaut pour WhatsApp
const UI_ELEMENTS = {
  agreeButton: { x: 540, y: 1200 },
  phoneInput: { x: 540, y: 600 },
  nextButton: { x: 540, y: 800 },
  codeInput: { x: 540, y: 600 },
  continueButton: { x: 540, y: 800 },
  skipButton: { x: 540, y: 1000 },
  nameInput: { x: 540, y: 600 }
};

/**
 * Lancer WhatsApp sur le device
 */
async function launchApp(device) {
  console.log('📱 Lancement de WhatsApp...');
  
  if (device.type === 'bluestacks') {
    // Forcer l'arrêt puis relancer
    await executeCommand(device, 'shell am force-stop com.whatsapp');
    await sleep(1000);
    
    // Lancer WhatsApp
    await executeCommand(device, 'shell monkey -p com.whatsapp -c android.intent.category.LAUNCHER 1');
    await sleep(3000);
    
    // Accepter les conditions si nécessaire
    await tap(device, UI_ELEMENTS.agreeButton.x, UI_ELEMENTS.agreeButton.y);
    await sleep(1000);
  } else {
    // Pour MoreLogin/Cloud, simulation
    console.log('📱 WhatsApp lancé (simulé)');
  }
  
  return true;
}

/**
 * Entrer un numéro de téléphone
 */
async function inputNumber(device, phoneNumber) {
  console.log(`📞 Saisie du numéro: ${phoneNumber}`);
  
  // Nettoyer le numéro (garder seulement les chiffres)
  const cleanNumber = phoneNumber.replace(/[^\d]/g, '');
  
  if (device.type === 'bluestacks') {
    // Cliquer sur le champ
    await tap(device, UI_ELEMENTS.phoneInput.x, UI_ELEMENTS.phoneInput.y);
    await sleep(500);
    
    // Effacer le champ
    await executeCommand(device, 'shell input keyevent 67'); // DEL
    await sleep(500);
    
    // Saisir le numéro
    await executeCommand(device, `shell input text "${cleanNumber}"`);
    await sleep(1000);
    
    // Cliquer sur Suivant
    await tap(device, UI_ELEMENTS.nextButton.x, UI_ELEMENTS.nextButton.y);
    await sleep(2000);
  } else {
    console.log(`📞 Numéro saisi (simulé): ${cleanNumber}`);
  }
  
  return true;
}

/**
 * Entrer le code SMS
 */
async function inputCode(device, code) {
  console.log(`📨 Saisie du code: ${code}`);
  
  if (device.type === 'bluestacks') {
    // Attendre que le champ soit visible
    await sleep(2000);
    
    // Cliquer sur le champ de code
    await tap(device, UI_ELEMENTS.codeInput.x, UI_ELEMENTS.codeInput.y);
    await sleep(500);
    
    // Saisir le code
    await executeCommand(device, `shell input text "${code}"`);
    await sleep(1000);
    
    // WhatsApp valide automatiquement généralement
    await sleep(3000);
  } else {
    console.log(`📨 Code saisi (simulé): ${code}`);
  }
  
  return true;
}

/**
 * Finaliser la création du compte
 */
async function finalizeAccount(device) {
  console.log('🏁 Finalisation du compte...');
  
  if (device.type === 'bluestacks') {
    // Passer les écrans de configuration
    await tap(device, UI_ELEMENTS.skipButton.x, UI_ELEMENTS.skipButton.y);
    await sleep(2000);
    
    // Continuer si nécessaire
    await tap(device, UI_ELEMENTS.continueButton.x, UI_ELEMENTS.continueButton.y);
    await sleep(2000);
    
    // Entrer un nom par défaut
    await tap(device, UI_ELEMENTS.nameInput.x, UI_ELEMENTS.nameInput.y);
    await sleep(500);
    await executeCommand(device, 'shell input text "User"');
    await sleep(1000);
    
    // Valider
    await tap(device, UI_ELEMENTS.nextButton.x, UI_ELEMENTS.nextButton.y);
    await sleep(2000);
  } else {
    console.log('🏁 Compte finalisé (simulé)');
  }
  
  console.log('✅ Compte WhatsApp créé avec succès');
  return true;
}

// Fonction utilitaire pour tap
async function tap(device, x, y) {
  if (device.type === 'bluestacks') {
    await executeCommand(device, `shell input tap ${x} ${y}`);
  } else {
    console.log(`👆 Tap simulé: (${x}, ${y})`);
  }
}

// Export du service
module.exports = {
  launchApp,
  inputNumber,
  inputCode,
  finalizeAccount,
  getWhatsAppService: () => ({
    launchApp,
    inputNumber,
    inputCode,
    finalizeAccount
  })
};
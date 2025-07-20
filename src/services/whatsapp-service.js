/**
 * WhatsApp Service minimaliste
 * Gère les interactions avec l'application WhatsApp
 */

const { executeCommand } = require('./device-service');
const { sleep } = require('../utils/helpers');
        
// Coordonnées UI par défaut pour WhatsApp
const UI_ELEMENTS = {
  cornerButton: { x: 1000, y: 1840 },
  agreeButton: { x: 540, y: 1660 },
  notificationsButton: { x: 540, y: 1050 },
  indicatifInput: { x: 380, y: 500 },
  phoneInput: { x: 540, y: 500 },
  nextButton: { x: 540, y: 1880 },
  confirmButton: { x: 805, y: 1070 },
  codeInput: { x: 540, y: 415 },
  continueButton: { x: 540, y: 800 },
  skipButton: { x: 540, y: 1000 },
  nameInput: { x: 540, y: 600 }
};

/**
 * Lancer WhatsApp sur le device
 */
async function launchApp(device) {
  console.log('📱 Lancement de WhatsApp...');
  
  // Forcer l'arrêt puis relancer
  await executeCommand(device, 'shell am force-stop com.whatsapp');
  await sleep(3000);

  // Effacer les données
  await executeCommand(device, 'shell pm clear com.whatsapp');
  await sleep(3000);
  
  // Lancer WhatsApp
  await executeCommand(device, 'shell monkey -p com.whatsapp -c android.intent.category.LAUNCHER 1');
  await sleep(4000);

  // Accepter la langue par défaut
  await tap(device, UI_ELEMENTS.cornerButton.x, UI_ELEMENTS.cornerButton.y);
  await sleep(2000);
  
  // Accepter les conditions si nécessaire
  await tap(device, UI_ELEMENTS.agreeButton.x, UI_ELEMENTS.agreeButton.y);
  await sleep(2000);

  // Accepter les notifications What's App
  await tap(device, UI_ELEMENTS.notificationsButton.x, UI_ELEMENTS.notificationsButton.y);
  await sleep(2000);

  return true;
}

    /**
 * Entrer un numéro de téléphone
     */
async function inputNumber(device, phoneNumber) {
  console.log(`📞 Saisie du numéro: ${phoneNumber}`);
  
  // Nettoyer le numéro et récupérer l'indicatif
  const cleanNumber = phoneNumber.replace(/[^\d]/g, '');
  const countryCode = cleanNumber.slice(0, 2);
  const onlyNumber = cleanNumber.slice(2);
  
  if (device.type === 'bluestacks') {

    // Cliquer sur le champ de l'indicatif
    await tap(device, UI_ELEMENTS.indicatifInput.x, UI_ELEMENTS.indicatifInput.y);
    await sleep(1000);

    // Suprimer l'indicatif actuel
    await executeCommand(device, 'shell input keyevent 67'); // DEL
    await sleep(500);
    await executeCommand(device, 'shell input keyevent 67'); // DEL
    await sleep(500);

    // Saisir l'indicatif
    await executeCommand(device, `shell input text ${countryCode}`);
    await sleep(1000);
    
    // Cliquer sur le champ du numéro
    await tap(device, UI_ELEMENTS.phoneInput.x, UI_ELEMENTS.phoneInput.y);
    await sleep(500);
            
    // Effacer le champ
    await executeCommand(device, 'shell input keyevent 67'); // DEL
    await sleep(500);
            
    // Saisir le numéro
    await executeCommand(device, `shell input text "${onlyNumber}"`);
    await sleep(2000);
    
    // Cliquer sur Suivant
    await tap(device, UI_ELEMENTS.nextButton.x, UI_ELEMENTS.nextButton.y);
    await sleep(6000);

    // Confirmer le numéro
    await tap(device, UI_ELEMENTS.confirmButton.x, UI_ELEMENTS.confirmButton.y);
    await sleep(3000);

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
    await sleep(1000);
            
    // Saisir le code
    await executeCommand(device, `shell input text "${code}"`);
    await sleep(2000);
    
    // WhatsApp valide automatiquement généralement
    await sleep(8000);
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
                
/**
 * Reset WhatsApp app
 */
async function resetApp(device) {
  console.log('🧹 Reset de WhatsApp...');
  
  if (device.type === 'bluestacks') {
    await executeCommand(device, 'shell am force-stop com.whatsapp');
    await sleep(2000);
    await executeCommand(device, 'shell pm clear com.whatsapp');
    await sleep(2000);
    console.log('🔄 Redémarrage de WhatsApp...');
    await launchApp(device);
  } else {
    console.log('🧹 Reset simulé');
  }
  
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
  resetApp,  // Ajoutez cette ligne
  getWhatsAppService: () => ({
    launchApp,
    inputNumber,
    inputCode,
    finalizeAccount,
    resetApp  // Et ici aussi
  })
};
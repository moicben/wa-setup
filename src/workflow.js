/**
 * Workflow WhatsApp simplifié et minimaliste
 * Fusion de toutes les étapes en fonctions simples
 */

const { getDeviceService } = require('./services/device-service');
const { getSMSService } = require('./services/sms-service');
const { getWhatsAppService } = require('./services/whatsapp-service');
const { logger } = require('./utils/logger');
const { sleep, retry } = require('./utils/helpers');
const { analyzeScreenshot } = require('./utils/ocr'); // Utilise votre ocr.js existant
const { takeScreenshot } = require('./services/device-service');

// Fonction principale du workflow
async function mainWorkflow(config = {}) {
    // Configuration par défaut
    const finalConfig = {
        env: config.env,
        country: config.country,
        useExistingDevice: config.useExistingDevice,
        phonePrefix: config.phonePrefix,
        customLaunch: config.customLaunch,
        instanceId: config.instanceId,
        ...config
    };

    const startTime = Date.now();
    logger.info(`🚀 [Instance ${finalConfig.instanceId}] Démarrage du workflow WhatsApp`, finalConfig);

    let device = null;
    let phoneNumber = null;
    const results = {
        success: false,
        steps: {},
        errors: []
    };

    try {
        // Étape 1: Lire et valider la configuration
        logger.info(`📋 [Instance ${finalConfig.instanceId}] Étape 1: Validation de la configuration`);
        validateConfig(finalConfig);
        results.steps.config = { success: true };

        // Étape 2: Préparer le device via device-service
        try {
            logger.info(`📱 [Instance ${finalConfig.instanceId}] Étape 2: Préparation du device`);
            device = await prepareDevice(finalConfig);
            results.steps.device = { success: true, deviceId: device.id };
        } catch (error) {
            logger.error(`❌ [Instance ${finalConfig.instanceId}] Erreur préparation device:`, error.message);
            results.errors.push({ step: 'device', error: error.message });
            throw error;
        }

        // Étape 3: Déterminer le numéro à utiliser
        try {
            logger.info(`📞 [Instance ${finalConfig.instanceId}] Étape 3: Détermination du numéro`);
            phoneNumber = await getPhoneNumber(finalConfig);
            results.steps.phoneNumber = { success: true, phoneNumber };
        } catch (error) {
            logger.error(`❌ [Instance ${finalConfig.instanceId}] Erreur détermination numéro:`, error.message);
            results.errors.push({ step: 'phoneNumber', error: error.message });
            throw error;
        }

        // Étape 4: Lancer WhatsApp
        try {
            logger.info(`📱 [Instance ${finalConfig.instanceId}] Étape 4: Lancement de WhatsApp`);
            await launchWhatsApp(device, finalConfig);
            results.steps.whatsapp = { success: true };
        } catch (error) {
            logger.error(`❌ [Instance ${finalConfig.instanceId}] Erreur lancement WhatsApp:`, error.message);
            results.errors.push({ step: 'whatsapp', error: error.message });
            throw error;
        }

        // Étape 5: Gérer téléphone et SMS
        try {
            logger.info(`📞 [Instance ${finalConfig.instanceId}] Étape 5: Gestion téléphone et SMS`);
            phoneNumber = await handlePhoneAndSMS(device, finalConfig);
            results.steps.sms = { success: true, phoneNumber };
        } catch (error) {
            logger.error(`❌ [Instance ${finalConfig.instanceId}] Erreur SMS:`, error.message);
            results.errors.push({ step: 'sms', error: error.message });
            throw error;
        }

        // Étape 6: Finaliser le compte
        try {
            logger.info(`🏁 [Instance ${finalConfig.instanceId}] Étape 6: Finalisation du compte`);
            await finalizeAccount(device, phoneNumber, finalConfig);
            results.steps.finalize = { success: true };
        } catch (error) {
            logger.error(`❌ [Instance ${finalConfig.instanceId}] Erreur finalisation:`, error.message);
            results.errors.push({ step: 'finalize', error: error.message });
            throw error;
            }
            
        // Succès complet
        const duration = Math.round((Date.now() - startTime) / 1000);
        logger.info(`✅ [Instance ${finalConfig.instanceId}] Workflow terminé avec succès en ${duration}s`);
        
        results.success = true;
        return { 
            success: true, 
            phoneNumber, 
            device,
            duration,
            instanceId: finalConfig.instanceId,
            results
        };
        
    } catch (error) {
        const duration = Math.round((Date.now() - startTime) / 1000);
        logger.error(`❌ [Instance ${finalConfig.instanceId}] Workflow échoué après ${duration}s:`, error.message);
        
        return {
            success: false,
            error: error.message,
            phoneNumber,
            device,
            duration,
            instanceId: finalConfig.instanceId,
            results
        };
    }
}

// Valider la configuration
function validateConfig(config) {
    const requiredFields = ['env', 'country'];
    const missingFields = requiredFields.filter(field => !config[field]);
    
    if (missingFields.length > 0) {
        throw new Error(`Configuration invalide: champs manquants ${missingFields.join(', ')}`);
    }
    
    const validEnvs = ['morelogin', 'bluestacks', 'cloud', 'test'];
    if (!validEnvs.includes(config.env)) {
        throw new Error(`Environnement invalide: ${config.env}. Valeurs acceptées: ${validEnvs.join(', ')}`);
    }
    
    logger.debug('✅ Configuration validée', config);
}

// Préparer le device (nouveau ou existant)
async function prepareDevice(config) {
    const deviceService = getDeviceService();
    
    if (config.useExistingDevice) {
        logger.info('📱 Utilisation d\'un device existant');
        return await deviceService.launchExistingDevice(config.env, null, config); // Passer la config
    } else {
        logger.info('📱 Création d\'un nouveau device');
        return await deviceService.createNewDevice(config.env, config); // Passer la config utilisateur
    }
}

// Déterminer le numéro à utiliser
async function getPhoneNumber(config) {
    const smsService = getSMSService();

    const phoneNumber = config.phonePrefix || await smsService.getPhoneNumber(config.country, config);
    logger.info(`📞 Utilisation du numéro: ${phoneNumber}`);
    return { phoneNumber: `+${phoneNumber}`, activationId: null }; // Retourne { phoneNumber, activationId }
}

// Lancer WhatsApp
async function launchWhatsApp(device, config) {
    const whatsappService = getWhatsAppService();
    
    logger.info('📱 Lancement de WhatsApp...');
    await whatsappService.launchApp(device);
    
    // Hook personnalisé si fourni
    if (config.customLaunch) {
        logger.info('🔧 Exécution du lancement personnalisé');
        await eval(config.customLaunch)(device);
    }
    
    await sleep(3000); // Attendre le chargement
}

// Gérer numéro de téléphone et SMS
async function handlePhoneAndSMS(device, config) {
  const whatsappService = getWhatsAppService();
  const smsService = getSMSService();
  const ocrEnabled = config.ocr.enabled;
  const maxRetries = config.ocr.maxRetries;
  const ocrOptions = {
    acceptKeywords: config.ocr.acceptKeywords,
    rejectKeywords: config.ocr.rejectKeywords,
    lang: config.ocr.lang,
    deleteAfter: true // Optionnel : Supprimer screenshot après analyse
  };
  
  let attempts = 0;
  let phoneNumber;
  
  while (attempts < maxRetries) {
    attempts++;
    
    // Obtenir numéro - CORRECTION ICI
    if (config.phoneNumber) {
      phoneNumber = config.phoneNumber;
      logger.info(`📞 [Attempt ${attempts}] Utilisation du numéro manuel: ${phoneNumber}`);
    } else {
      // getPhoneNumber retourne directement la string du numéro
      phoneNumber = await smsService.getPhoneNumber(config.country, config);
      logger.info(`📞 [Attempt ${attempts}] Numéro obtenu: ${phoneNumber}`);
    }
    
    // Entrer le numéro
    await whatsappService.inputNumber(device, phoneNumber);
    await sleep(2000);
    
    // OCR si activé
    if (ocrEnabled) {
      const screenshotFile = `ocr-check-${Date.now()}.png`;
      try {
        await takeScreenshot(device, screenshotFile);
        const analysis = await analyzeScreenshot(screenshotFile, ocrOptions);
        
        if (!analysis.valid) {
          logger.warn(`⚠️ [Attempt ${attempts}] Numéro invalide: ${analysis.reason}`);
          // Note: sans activationId, on ne peut pas cancel - à implémenter si besoin
          await whatsappService.resetApp(device);
          continue;
        }
        logger.info(`✅ [Attempt ${attempts}] Numéro valide (OCR: ${analysis.reason})`);
      } catch (ocrError) {
        logger.warn(`⚠️ Erreur OCR, fallback sur retry: ${ocrError.message}`);
        continue;
      }
    }
    
    // Attendre et entrer code
    const smsCode = await retry(() => smsService.waitForSMS(phoneNumber), 3);
    await whatsappService.inputCode(device, smsCode);
    
    return phoneNumber;
  }
  
  throw new Error(`Échec après ${maxRetries} tentatives`);
}

// Finaliser la création du compte
async function finalizeAccount(device, phoneNumber, config) {
    const whatsappService = getWhatsAppService();
    
    logger.info('🏁 Finalisation du compte...');
    await whatsappService.finalizeAccount(device);
    
    logger.info(`✅ Compte créé avec succès: ${phoneNumber}`);
}

// Export pour utilisation
module.exports = {
    mainWorkflow,
    validateConfig,
    prepareDevice,
    launchWhatsApp,
    handlePhoneAndSMS,
    finalizeAccount
};
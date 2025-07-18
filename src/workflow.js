/**
 * Workflow WhatsApp simplifié et minimaliste
 * Fusion de toutes les étapes en fonctions simples
 */

const { getDeviceService } = require('./services/device-service');
const { getSMSService } = require('./services/sms-service');
const { getWhatsAppService } = require('./services/whatsapp-service');
const { logger } = require('./utils/logger');
const { sleep, retry } = require('./utils/helpers');

// Fonction principale du workflow
async function mainWorkflow(config = {}) {
    // Configuration par défaut
    const finalConfig = {
        env: config.env || 'morelogin',
        country: config.country || 'UK',
        useExistingDevice: config.useExistingDevice || false,
        phonePrefix: config.phonePrefix,
        customLaunch: config.customLaunch,
        instanceId: config.instanceId || 1,
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

        // Étape 3: Lancer WhatsApp
        try {
            logger.info(`📱 [Instance ${finalConfig.instanceId}] Étape 3: Lancement de WhatsApp`);
            await launchWhatsApp(device, finalConfig);
            results.steps.whatsapp = { success: true };
        } catch (error) {
            logger.error(`❌ [Instance ${finalConfig.instanceId}] Erreur lancement WhatsApp:`, error.message);
            results.errors.push({ step: 'whatsapp', error: error.message });
            throw error;
        }

        // Étape 4: Gérer téléphone et SMS
        try {
            logger.info(`📞 [Instance ${finalConfig.instanceId}] Étape 4: Gestion téléphone et SMS`);
            phoneNumber = await handlePhoneAndSMS(device, finalConfig);
            results.steps.sms = { success: true, phoneNumber };
        } catch (error) {
            logger.error(`❌ [Instance ${finalConfig.instanceId}] Erreur SMS:`, error.message);
            results.errors.push({ step: 'sms', error: error.message });
            throw error;
        }

        // Étape 5: Finaliser le compte
        try {
            logger.info(`🏁 [Instance ${finalConfig.instanceId}] Étape 5: Finalisation du compte`);
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
        return await deviceService.launchExistingDevice(config.env);
    } else {
        logger.info('📱 Création d\'un nouveau device');
        return await deviceService.createNewDevice(config.env);
    }
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
    
    // Déterminer le numéro à utiliser
    const phoneNumber = config.phonePrefix || 
                       await smsService.getPhoneNumber(config.country);
    
    logger.info(`📞 Utilisation du numéro: ${phoneNumber}`);
    
    // Entrer le numéro
    await whatsappService.inputNumber(device, phoneNumber);
    
    // Demander le code SMS
    const smsCode = await retry(
        () => smsService.requestSMS(config.country, phoneNumber),
        3
    );
    
    logger.info(`📨 Code SMS reçu: ${smsCode}`);
    
    // Entrer le code
    await whatsappService.inputCode(device, smsCode);
    
    return phoneNumber;
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
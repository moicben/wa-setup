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
        ...config
    };

    logger.info('🚀 Démarrage du workflow WhatsApp', finalConfig);

    try {
        // 1. Préparer le device
        const device = await prepareDevice(finalConfig);
        
        // 2. Lancer WhatsApp
        await launchWhatsApp(device, finalConfig);
        
        // 3. Gérer le téléphone et SMS
        const phoneNumber = await handlePhoneAndSMS(device, finalConfig);
        
        // 4. Finaliser le compte
        await finalizeAccount(device, phoneNumber, finalConfig);
        
        logger.info('✅ Workflow terminé avec succès');
        return { success: true, phoneNumber, device };
        
    } catch (error) {
        logger.error('❌ Erreur dans le workflow:', error);
        throw error;
    }
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
    prepareDevice,
    launchWhatsApp,
    handlePhoneAndSMS,
    finalizeAccount
};
// Workflow de configuration d'un compte WhatsApp

const { getSmsService } = require('../services/sms-service');
const { getWhatsAppService } = require('../services/whatsapp-service');
const { getDeviceService } = require('../services/device-service');
const config = require('../config');
const { randomSleep, sleep } = require('../utils/helpers');
const { connectDevice, executeCommand } = require('../utils/adb');

// Fonction principale du workflow
async function setupWorkflow(device) {
    try {
        const smsService = getSmsService();
        const whatsappService = getWhatsAppService();
        const deviceService = getDeviceService();

        console.log(`⚙️  Initialisation du workflow setup...`);
        console.log(`📱 Device: ${device}`);

        // Étape 1 : Connexion adb au device
        console.log(`⚙️ Connexion adb au device...`);
        await connectDevice(device);

        // Étape 2 : Obtenir un numéro de téléphone
        console.log(`📞 Obtention d'un numéro de téléphone...`);
        const phoneNumber = await smsService.getPhoneNumber(config.country);
        console.log(`📱 Numéro obtenu: ${phoneNumber}`);

        // Étape 3 : Ouvrir WhatsApp et commencer la configuration
        console.log(`📱 Ouverture de WhatsApp...`);
        await whatsappService.openWhatsApp(device);
        await sleep(3000);

        // Étape 4 : Saisir le numéro de téléphone
        console.log(`📝 Saisie du numéro de téléphone...`);
        await whatsappService.inputPhoneNumber(device, phoneNumber);
        await sleep(2000);

        // Étape 5 : Demander le code SMS
        console.log(`📨 Demande du code SMS...`);
        await whatsappService.requestSMSCode(device);
        await sleep(5000);

        // Étape 6 : Attendre et récupérer le SMS
        console.log(`⏳ Attente du SMS...`);
        const smsCode = await smsService.waitForSMS(phoneNumber);
        console.log(`📨 Code SMS reçu: ${smsCode}`);

        // Étape 7 : Saisir le code SMS
        console.log(`📝 Saisie du code SMS...`);
        await whatsappService.inputSMSCode(device, smsCode);
        await sleep(3000);

        // Étape 8 : Finaliser la configuration
        console.log(`✅ Finalisation de la configuration...`);
        await whatsappService.finalizeSetup(device);
        await sleep(5000);

        console.log(`\n✅ Setup terminé avec succès\n`);
        return { success: true, phoneNumber };

    } catch (error) {
        console.error('❌ Erreur dans le workflow setup:', error.message);
        throw error;
    }
}

// Exporter la fonction principale
module.exports = { setupWorkflow };
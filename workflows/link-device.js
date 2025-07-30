// Workflow de liaison d'un device WhatsApp

const { getWhatsAppService } = require('../services/whatsapp-service');
const config = require('../config');
const { randomSleep, sleep } = require('../utils/helpers');
const { connectDevice, executeCommand, takeScreenshot } = require('../utils/adb');

// Fonction principale du workflow
async function linkDeviceWorkflow(device) {
    try {
        const whatsappService = getWhatsAppService();

        console.log(`⚙️  Initialisation du workflow link-device...`);
        console.log(`📱 Device: ${device}`);

        // Étape 1 : Connexion adb au device
        console.log(`⚙️ Connexion adb au device...`);
        await connectDevice(device);

        // Étape 2 : Ouvrir WhatsApp
        console.log(`📱 Ouverture de WhatsApp...`);
        await whatsappService.openWhatsApp(device);
        await sleep(3000);

        // Étape 3 : Aller dans les paramètres
        console.log(`⚙️ Accès aux paramètres...`);
        await whatsappService.openSettings(device);
        await sleep(2000);

        // Étape 4 : Accéder à "Appareils liés"
        console.log(`🔗 Accès aux appareils liés...`);
        await whatsappService.openLinkedDevices(device);
        await sleep(2000);

        // Étape 5 : Ajouter un nouvel appareil
        console.log(`➕ Ajout d'un nouvel appareil...`);
        await whatsappService.addNewDevice(device);
        await sleep(3000);

        // Étape 6 : Capturer le QR code
        console.log(`📷 Capture du QR code...`);
        const qrScreenshot = `qr-${Date.now()}.png`;
        await takeScreenshot(device, qrScreenshot);
        console.log(`📸 QR code capturé: ${qrScreenshot}`);

        // Étape 7 : Attendre la liaison (timeout de 60 secondes)
        console.log(`⏳ Attente de la liaison de l'appareil...`);
        let linked = false;
        let attempts = 0;
        const maxAttempts = 12; // 60 secondes / 5 secondes

        while (!linked && attempts < maxAttempts) {
            await sleep(5000);
            attempts++;
            
            // Vérifier si la liaison est effectuée
            const currentScreen = `link-check-${Date.now()}.png`;
            await takeScreenshot(device, currentScreen);
            
            // Ici vous pourriez ajouter une logique OCR pour vérifier si la liaison est réussie
            console.log(`⏳ Tentative ${attempts}/${maxAttempts}...`);
        }

        if (attempts >= maxAttempts) {
            console.log(`⚠️ Timeout: liaison non détectée après ${maxAttempts * 5} secondes`);
        } else {
            console.log(`✅ Appareil lié avec succès`);
            linked = true;
        }

        console.log(`\n✅ Workflow link-device terminé\n`);
        return { success: linked, qrScreenshot };

    } catch (error) {
        console.error('❌ Erreur dans le workflow link-device:', error.message);
        throw error;
    }
}

// Exporter la fonction principale
module.exports = { linkDeviceWorkflow };
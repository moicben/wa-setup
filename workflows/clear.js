// Workflow de nettoyage d'un device

const { getWhatsAppService } = require('../services/whatsapp-service');
const { getDeviceService } = require('../services/device-service');
const config = require('../config');
const { randomSleep, sleep } = require('../utils/helpers');
const { connectDevice, executeCommand } = require('../utils/adb');

// Fonction principale du workflow
async function clearWorkflow(device) {
    try {
        const whatsappService = getWhatsAppService();
        const deviceService = getDeviceService();

        console.log(`⚙️  Initialisation du workflow clear...`);
        console.log(`📱 Device: ${device}`);

        // Étape 1 : Connexion adb au device
        console.log(`⚙️ Connexion adb au device...`);
        await connectDevice(device);

        // Étape 2 : Arrêter WhatsApp
        console.log(`🛑 Arrêt de WhatsApp...`);
        await executeCommand(device, 'shell am force-stop com.whatsapp');
        await sleep(2000);

        // Étape 3 : Vider le cache de WhatsApp
        console.log(`🗑️ Vidage du cache WhatsApp...`);
        await executeCommand(device, 'shell pm clear com.whatsapp');
        await sleep(3000);

        // Étape 4 : Supprimer les données temporaires
        console.log(`🧹 Suppression des données temporaires...`);
        await executeCommand(device, 'shell rm -rf /sdcard/WhatsApp/');
        await executeCommand(device, 'shell rm -rf /sdcard/Android/data/com.whatsapp/');
        await sleep(2000);

        // Étape 5 : Nettoyer les screenshots
        console.log(`📸 Nettoyage des screenshots...`);
        await executeCommand(device, 'shell rm -f /sdcard/*.png');
        await executeCommand(device, 'shell rm -f /sdcard/DCIM/Screenshots/*.png');
        await sleep(1000);

        // Étape 6 : Redémarrer le device (optionnel)
        if (config.device.restartAfterClear) {
            console.log(`🔄 Redémarrage du device...`);
            await executeCommand(device, 'reboot');
            await sleep(30000); // Attendre le redémarrage
        }

        console.log(`\n✅ Nettoyage terminé avec succès\n`);
        return { success: true };

    } catch (error) {
        console.error('❌ Erreur dans le workflow clear:', error.message);
        throw error;
    }
}

// Exporter la fonction principale
module.exports = { clearWorkflow };
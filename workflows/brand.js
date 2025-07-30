// Workflow de branding d'un profil WhatsApp

const { getWhatsAppService } = require('../services/whatsapp-service');
const config = require('../config');
const { randomSleep, sleep } = require('../utils/helpers');
const { connectDevice, executeCommand } = require('../utils/adb');
const path = require('path');

// Fonction principale du workflow
async function brandWorkflow(brandConfig, device) {
    try {
        const whatsappService = getWhatsAppService();

        console.log(`⚙️  Initialisation du workflow branding...`);
        console.log(`📱 Device: ${device}`);
        console.log(`👤 Profil: ${brandConfig.name}`);
        console.log(`📝 Description: ${brandConfig.description}`);
        console.log(`🖼️ Image: ${brandConfig.image}`);

        // Étape 1 : Connexion adb au device
        console.log(`⚙️ Connexion adb au device...`);
        await connectDevice(device);

        // Étape 2 : Ouvrir WhatsApp
        console.log(`📱 Ouverture de WhatsApp...`);
        await whatsappService.openWhatsApp(device);
        await sleep(3000);

        // Étape 3 : Aller dans les paramètres de profil
        console.log(`⚙️ Accès aux paramètres de profil...`);
        await whatsappService.openProfileSettings(device);
        await sleep(2000);

        // Étape 4 : Changer le nom
        console.log(`✏️ Modification du nom...`);
        await whatsappService.changeProfileName(device, brandConfig.name);
        await sleep(2000);

        // Étape 5 : Changer la description
        console.log(`📝 Modification de la description...`);
        await whatsappService.changeProfileDescription(device, brandConfig.description);
        await sleep(2000);

        // Étape 6 : Changer la photo de profil
        if (brandConfig.image) {
            console.log(`🖼️ Modification de la photo de profil...`);
            const imagePath = path.join(__dirname, '..', 'brands', brandConfig.image);
            await whatsappService.changeProfilePicture(device, imagePath);
            await sleep(3000);
        }

        // Étape 7 : Sauvegarder les modifications
        console.log(`💾 Sauvegarde des modifications...`);
        await whatsappService.saveProfileChanges(device);
        await sleep(2000);

        console.log(`\n✅ Branding terminé avec succès\n`);
        return { success: true, profile: brandConfig };

    } catch (error) {
        console.error('❌ Erreur dans le workflow branding:', error.message);
        throw error;
    }
}

// Exporter la fonction principale
module.exports = { brandWorkflow };
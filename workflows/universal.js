// Workflow universel : setup + branding + envoi

const { setupWorkflow } = require('./setup');
const { brandWorkflow } = require('./brand');
const { sendWorkflow } = require('./send');
const config = require('../config');
const { randomSleep, sleep } = require('../utils/helpers');

// Fonction principale du workflow universel
async function universalWorkflow(device, brandId, campaignId) {
    try {
        console.log(`⚙️  Initialisation du workflow universel...`);
        console.log(`📱 Device: ${device}`);
        console.log(`👤 Brand ID: ${brandId}`);
        console.log(`📨 Campaign ID: ${campaignId}`);

        // Récupérer les configurations
        const brandConfig = config.brand.find(b => b.id === brandId);
        const campaignConfig = config.send.find(c => c.id === campaignId);

        if (!brandConfig) {
            throw new Error(`Brand avec ID ${brandId} non trouvé`);
        }

        if (!campaignConfig) {
            throw new Error(`Campaign avec ID ${campaignId} non trouvée`);
        }

        // Étape 1 : Setup du compte WhatsApp
        console.log(`\n🚀 PHASE 1: Setup du compte...\n`);
        const setupResult = await setupWorkflow(device);
        
        if (!setupResult.success) {
            throw new Error('Échec du setup');
        }

        console.log(`✅ Setup réussi avec le numéro: ${setupResult.phoneNumber}`);
        await sleep(5000);

        // Étape 2 : Branding du profil
        console.log(`\n🎨 PHASE 2: Branding du profil...\n`);
        const brandResult = await brandWorkflow(brandConfig, device);
        
        if (!brandResult.success) {
            throw new Error('Échec du branding');
        }

        console.log(`✅ Branding réussi pour: ${brandConfig.name}`);
        await sleep(5000);

        // Étape 3 : Envoi des messages
        console.log(`\n📨 PHASE 3: Envoi des messages...\n`);
        await sendWorkflow(campaignConfig, device);

        console.log(`\n🎉 WORKFLOW UNIVERSEL TERMINÉ AVEC SUCCÈS 🎉\n`);
        return { 
            success: true, 
            phoneNumber: setupResult.phoneNumber,
            profile: brandResult.profile,
            campaign: campaignConfig.name
        };

    } catch (error) {
        console.error('❌ Erreur dans le workflow universel:', error.message);
        throw error;
    }
}

// Exporter la fonction principale
module.exports = { universalWorkflow };
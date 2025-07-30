// Runner du workflow universal.js

const { universalWorkflow } = require('../workflows/universal');
const config = require('../config');

let device = '127.0.0.1';

// Fonction pour parser les arguments nommés
function parseArgs() {
    const args = {};
    process.argv.slice(2).forEach(arg => {
        if (arg.startsWith('--')) {
            const [key, value] = arg.substring(2).split('=');
            args[key] = value;
        }
    });
    return args;
}

// Récupérer les arguments
const args = parseArgs();

if (!args.device) {
    console.error('❌ Erreur: Device non spécifié, utiliser --device=<device> --brand=<brand_id> --campaign=<campaign_id>');
    process.exit(1);
}

if (!args.brand) {
    console.error('❌ Erreur: Brand non spécifié, utiliser --device=<device> --brand=<brand_id> --campaign=<campaign_id>');
    process.exit(1);
}

if (!args.campaign) {
    console.error('❌ Erreur: Campaign non spécifiée, utiliser --device=<device> --brand=<brand_id> --campaign=<campaign_id>');
    process.exit(1);
}

// Trouver le port du device dans la configuration
const deviceConfig = config.devicePorts.find(d => d.id === parseInt(args.device));
if (!deviceConfig) {
    console.error(`❌ Erreur: Device ${args.device} non trouvé dans la configuration`);
    process.exit(1);
}

device = `${device}:${deviceConfig.port}`;
const brandId = parseInt(args.brand);
const campaignId = parseInt(args.campaign);

console.log(`📱 Démarrage du workflow universel avec le device: ${device}`);
console.log(`👤 Brand ID: ${brandId}`);
console.log(`📨 Campaign ID: ${campaignId}`);

// Lancer le workflow avec gestion d'erreurs
(async () => {
    try {
        await universalWorkflow(device, brandId, campaignId);
    } catch (error) {
        console.error('❌ Erreur fatale:', error.message);
        process.exit(1);
    }
})();
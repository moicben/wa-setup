// Runner du workflow brand.js

const { brandWorkflow } = require('../workflows/brand');
const config = require('../config');

let device = '127.0.0.1';
let brandConfig;

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

// Récupérer le device et le brand
const args = parseArgs();

if (!args.device) {
    console.error('❌ Erreur: Device non spécifié, utiliser --device=<device> et --brand=<brand_id>');
    process.exit(1);
}

if (!args.brand) {
    console.error('❌ Erreur: Brand non spécifié, utiliser --device=<device> et --brand=<brand_id>');
    process.exit(1);
}

// Trouver le port du device dans la configuration
const deviceConfig = config.devicePorts.find(d => d.id === parseInt(args.device));
if (!deviceConfig) {
    console.error(`❌ Erreur: Device ${args.device} non trouvé dans la configuration`);
    process.exit(1);
}

device = `${device}:${deviceConfig.port}`;
brandConfig = config.brand.find(brand => brand.id === parseInt(args.brand));

if (!brandConfig) {
    console.error('❌ Erreur: Brand non trouvé, utiliser --brand=<brand_id>');
    process.exit(1);
}

console.log(`📱 Démarrage du branding avec le device: ${device}`);
console.log(`👤 Brand: ${brandConfig.name}`);

// Lancer le workflow avec gestion d'erreurs
(async () => {
    try {
        await brandWorkflow(brandConfig, device);
    } catch (error) {
        console.error('❌ Erreur fatale:', error.message);
        process.exit(1);
    }
})();
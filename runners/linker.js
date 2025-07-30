// Runner du workflow link-device.js

const { linkDeviceWorkflow } = require('../workflows/link-device');
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

// Récupérer le device
const args = parseArgs();

if (!args.device) {
    console.error('❌ Erreur: Device non spécifié, utiliser --device=<device>');
    process.exit(1);
}

// Trouver le port du device dans la configuration
const deviceConfig = config.devicePorts.find(d => d.id === parseInt(args.device));
if (!deviceConfig) {
    console.error(`❌ Erreur: Device ${args.device} non trouvé dans la configuration`);
    process.exit(1);
}

device = `${device}:${deviceConfig.port}`;

console.log(`📱 Démarrage de la liaison avec le device: ${device}`);

// Lancer le workflow avec gestion d'erreurs
(async () => {
    try {
        await linkDeviceWorkflow(device);
    } catch (error) {
        console.error('❌ Erreur fatale:', error.message);
        process.exit(1);
    }
})();
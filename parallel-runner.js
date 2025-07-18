#!/usr/bin/env node

/**
 * Parallel Runner - Exécute plusieurs workflows WhatsApp en parallèle
 * Chaque workflow utilise un device BlueStacks différent
 */

// Supprimé dotenv - utiliser variables d'environnement directement

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const deviceCount = parseInt(process.env.DEVICE_COUNT || '4');
const country = process.env.COUNTRY || 'UK';
const basePorts = process.env.DEVICE_PORTS ? 
    process.env.DEVICE_PORTS.split(',').map(p => parseInt(p.trim())) :
    [5585, 5605, 5587, 5588, 5589, 5569, 4469];

// Validation
if (deviceCount > basePorts.length) {
    console.error(`❌ Erreur: ${deviceCount} devices demandés mais seulement ${basePorts.length} ports configurés`);
    process.exit(1);
}

console.log('\n🚀 Parallel Runner - WhatsApp Multi-Devices');
console.log('═'.repeat(50));
console.log(`📱 Devices: ${deviceCount}`);
console.log(`🌍 Pays: ${country}`);
console.log(`🔌 Ports: ${basePorts.slice(0, deviceCount).join(', ')}`);
console.log('═'.repeat(50));

// Créer les dossiers de logs si nécessaire
const logsDir = path.join(__dirname, 'logs');
const screenshotsDir = path.join(__dirname, 'screenshots');

// Tracker pour les processus
const processes = new Map();
const results = new Map();
let completedCount = 0;

/**
 * S'assurer que tous les devices sont connectés
 */
async function ensureDevicesConnected() {
    const { execSync } = require('child_process');
    
    console.log('\n🔌 Vérification des connexions ADB...');
    
    for (let i = 0; i < deviceCount; i++) {
        const port = basePorts[i];
        const deviceId = `127.0.0.1:${port}`;
        
        try {
            // Vérifier si le device est déjà connecté
            const devices = execSync('adb devices').toString();
            
            if (!devices.includes(deviceId)) {
                console.log(`📱 Connexion au device sur port ${port}...`);
                execSync(`adb connect ${deviceId}`);
                console.log(`✅ Device connecté: ${deviceId}`);
            } else {
                console.log(`✅ Device déjà connecté: ${deviceId}`);
            }
        } catch (error) {
            console.error(`❌ Impossible de connecter au device ${deviceId}: ${error.message}`);
            console.error(`   Vérifiez que BlueStacks est lancé sur le port ${port}`);
        }
    }
    
    // Attendre un peu pour que les connexions se stabilisent
    await new Promise(resolve => setTimeout(resolve, 2000));
}

/**
 * Lance un workflow pour un device spécifique
 */
function launchWorkflow(deviceIndex) {
    const port = basePorts[deviceIndex];
    const deviceId = `Device${deviceIndex + 1}`;
    const deviceHost = `127.0.0.1:${port}`;
    
    console.log(`\n🚀 Lancement ${deviceId} sur port ${port}...`);
    
    // Créer les dossiers spécifiques au device
    const deviceLogsDir = path.join(logsDir, deviceId.toLowerCase());
    const deviceScreenshotsDir = path.join(screenshotsDir, deviceId.toLowerCase());
    
    if (!fs.existsSync(deviceLogsDir)) {
        fs.mkdirSync(deviceLogsDir, { recursive: true });
    }
    if (!fs.existsSync(deviceScreenshotsDir)) {
        fs.mkdirSync(deviceScreenshotsDir, { recursive: true });
    }
    
    // Environnement pour le processus enfant
    const env = {
        ...process.env,
        DEVICE_PORT: port.toString(),
        DEVICE_ID: deviceId,
        DEVICE_HOST: deviceHost,
        LOGS_DIR: deviceLogsDir,
        SCREENSHOTS_DIR: deviceScreenshotsDir
    };
    
    // Lancer le workflow
    const child = spawn('node', ['src/workflow.js', 'create', country], {
        env,
        stdio: ['inherit', 'pipe', 'pipe']
    });
    
    // Préfixer les logs avec l'ID du device
    child.stdout.on('data', (data) => {
        const lines = data.toString().split('\n').filter(line => line.trim());
        lines.forEach(line => {
            console.log(`[${deviceId}] ${line}`);
        });
    });
    
    child.stderr.on('data', (data) => {
        const lines = data.toString().split('\n').filter(line => line.trim());
        lines.forEach(line => {
            console.error(`[${deviceId}] ❌ ${line}`);
        });
    });
    
    // Gérer la fin du processus
    child.on('close', (code) => {
        completedCount++;
        const success = code === 0;
        results.set(deviceId, { success, code });
        
        console.log(`\n[${deviceId}] ${success ? '✅ Terminé avec succès' : '❌ Échec'} (code: ${code})`);
        console.log(`📊 Progression: ${completedCount}/${deviceCount} workflows terminés`);
        
        // Si tous les workflows sont terminés
        if (completedCount === deviceCount) {
            displayFinalResults();
        }
    });
    
    child.on('error', (error) => {
        console.error(`[${deviceId}] ❌ Erreur processus: ${error.message}`);
        completedCount++;
        results.set(deviceId, { success: false, error: error.message });
        
        if (completedCount === deviceCount) {
            displayFinalResults();
        }
    });
    
    processes.set(deviceId, child);
}

/**
 * Affiche les résultats finaux
 */
function displayFinalResults() {
    console.log('\n' + '═'.repeat(50));
    console.log('📊 RÉSULTATS FINAUX');
    console.log('═'.repeat(50));
    
    let successCount = 0;
    results.forEach((result, deviceId) => {
        if (result.success) {
            successCount++;
            console.log(`✅ ${deviceId}: Succès`);
        } else {
            console.log(`❌ ${deviceId}: Échec ${result.error ? `(${result.error})` : `(code: ${result.code})`}`);
        }
    });
    
    console.log('═'.repeat(50));
    console.log(`📈 Taux de réussite: ${successCount}/${deviceCount} (${Math.round(successCount/deviceCount*100)}%)`);
    console.log('═'.repeat(50));
    
    // Terminer avec le bon code de sortie
    process.exit(successCount === deviceCount ? 0 : 1);
}

/**
 * Gérer l'arrêt propre
 */
function cleanup() {
    console.log('\n⚠️ Arrêt demandé, nettoyage en cours...');
    
    processes.forEach((child, deviceId) => {
        console.log(`🛑 Arrêt de ${deviceId}...`);
        child.kill('SIGTERM');
    });
    
    // Forcer l'arrêt après 10 secondes
    setTimeout(() => {
        processes.forEach((child, deviceId) => {
            if (!child.killed) {
                console.log(`⚠️ Force l'arrêt de ${deviceId}...`);
                child.kill('SIGKILL');
            }
        });
        process.exit(1);
    }, 10000);
}

// Gérer les signaux d'arrêt
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Fonction principale asynchrone
async function main() {
    // S'assurer que tous les devices sont connectés
    await ensureDevicesConnected();
    
    // Lancer les workflows avec un délai entre chaque
    console.log('\n🎬 Démarrage des workflows...\n');
    
    for (let i = 0; i < deviceCount; i++) {
        setTimeout(() => {
            launchWorkflow(i);
        }, i * 2000); // 2 secondes entre chaque lancement
    }
    
    console.log('\n⏳ Tous les workflows sont en cours d\'exécution...');
    console.log('💡 Utilisez Ctrl+C pour arrêter tous les workflows\n');
}

// Démarrer l'application
main().catch(error => {
    console.error('❌ Erreur lors du démarrage:', error.message);
    process.exit(1);
});
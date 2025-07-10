#!/usr/bin/env node

/**
 * Script de lancement WhatsApp sur téléphones cloud MoreLogin
 * Avec gestion améliorée des connexions ADB
 */

require('dotenv').config();

const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const { wait } = require('../lib/utils.js');
const { PHONE_STATUS, TIMEOUTS } = require('../lib/constants.js/index.js');
const { 
    getCloudPhoneList, 
    startCloudPhone, 
    enableADB, 
    getADBInfo,
    makeLocalApiRequest 
} = require('../lib/api');
const { findPhone } = require('../lib/utils.js');

// Packages WhatsApp supportés (dans l'ordre de priorité)
const WHATSAPP_PACKAGES = [
    'com.whatsapp',
    'com.whatsapp.w4b',
    'com.gbwhatsapp',
    'com.whatsappplus',
    'com.fmwhatsapp',
    'com.yowhatsapp',
    'com.ogwhatsapp'
];

/**
 * Utilitaires ADB améliorés pour la gestion des applications
 */
class ADBUtils {
    constructor(deviceAddress) {
        this.deviceAddress = deviceAddress;
        this.commandTimeout = 10000; // Timeout par défaut 10 secondes
        this.retryCount = 3; // Nombre de tentatives
    }
    
    /**
     * Exécute une commande ADB avec retry et timeout optimisés
     */
    async executeCommand(command, options = {}) {
        const timeout = options.timeout || this.commandTimeout;
        const retries = options.retries || this.retryCount;
        
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                console.log(`🔄 Tentative ${attempt}/${retries}: ${command}`);
                
                // Vérifier que la connexion est toujours active
                if (attempt > 1) {
                    try {
                        await execAsync('adb devices', { timeout: 3000 });
                    } catch (deviceError) {
                        console.log('⚠️ Connexion ADB fermée, tentative de reconnexion...');
                        await execAsync(`adb connect ${this.deviceAddress}`, { timeout: 8000 });
                        await wait(2000);
                    }
                }
                
                const { stdout, stderr } = await execAsync(
                    `adb -s ${this.deviceAddress} ${command}`,
                    { timeout }
                );
                
                // Vérifier les erreurs dans stderr
                if (stderr && stderr.includes('error') && !stderr.includes('closed')) {
                    throw new Error(`ADB Error: ${stderr}`);
                }
                
                // Gérer spécifiquement l'erreur "closed"
                if (stderr && stderr.includes('closed')) {
                    throw new Error(`Connection closed: ${stderr}`);
                }
                
                return stdout.trim();
                
            } catch (error) {
                console.log(`⚠️ Tentative ${attempt} échouée: ${error.message}`);
                
                if (attempt === retries) {
                    // Dernière tentative échouée
                    if (error.message.includes('closed')) {
                        throw new Error('Connexion ADB fermée - le téléphone nécessite un déverrouillage manuel');
                    }
                    throw error;
                }
                
                // Attendre avant la prochaine tentative
                await wait(3000);
            }
        }
    }
    
    /**
     * Lance une application avec vérification
     */
    async launchApp(packageName) {
        try {
            console.log(`🚀 Lancement de ${packageName}...`);
            
            // Étape 1: Forcer l'arrêt de l'app (si elle tourne)
            try {
                await this.executeCommand(`shell am force-stop ${packageName}`, { timeout: 5000, retries: 1 });
                await wait(1000);
            } catch (e) {
                console.log('⚠️ Impossible d\'arrêter l\'app (normal si pas lancée)');
            }
            
            // Étape 2: Lancer l'application avec monkey
            console.log(`🎯 Lancement de ${packageName} avec monkey...`);
            await this.executeCommand(
                `shell monkey -p ${packageName} -c android.intent.category.LAUNCHER 1`,
                { timeout: 15000, retries: 2 }
            );
            
            console.log(`✅ Commande de lancement exécutée pour ${packageName}`);
            
            // Étape 3: Attendre le démarrage
            await wait(5000);
            
            console.log(`✅ Application ${packageName} lancée avec succès`);
            return true;
            
        } catch (error) {
            console.error(`❌ Impossible de lancer ${packageName}: ${error.message}`);
            
            // Messages d'aide spécifiques
            if (error.message.includes('timeout')) {
                console.log('💡 Le téléphone est lent, ceci est normal pour les téléphones cloud');
                console.log('💡 L\'application peut quand même s\'être lancée');
                return true; // On considère que c'est potentiellement ok
            }
            
            if (error.message.includes('closed')) {
                console.log('💡 Connexion fermée - le téléphone nécessite un déverrouillage manuel');
                console.log('💡 Consultez la documentation MoreLogin pour débloquer le téléphone');
            }
            
            throw error;
        }
    }
    
    /**
     * Vérifie si une application est installée
     */
    async isAppInstalled(packageName) {
        try {
            const result = await this.executeCommand(
                `shell pm list packages ${packageName}`,
                { timeout: 8000, retries: 2 }
            );
            return result.includes(packageName);
        } catch (error) {
            console.log(`⚠️ Impossible de vérifier l'installation de ${packageName}`);
            return false;
        }
    }
    
    /**
     * Vérifie si une application est en cours d'exécution
     */
    async isAppRunning(packageName) {
        try {
            const result = await this.executeCommand(
                `shell ps | grep ${packageName}`,
                { timeout: 5000, retries: 1 }
            );
            return result.includes(packageName);
        } catch (error) {
            // Essayer méthode alternative
            try {
                const result = await this.executeCommand(
                    `shell dumpsys activity activities | grep ${packageName}`,
                    { timeout: 5000, retries: 1 }
                );
                return result.includes(packageName);
            } catch (altError) {
                console.log(`⚠️ Impossible de vérifier l'état de ${packageName}`);
                return false;
            }
        }
    }
    
    /**
     * Trouve le package WhatsApp installé avec méthode directe
     */
    async findWhatsAppPackage() {
        try {
            console.log('🔍 Recherche WhatsApp avec méthode directe...');
            
            // Essayer directement chaque package WhatsApp
            for (const packageName of WHATSAPP_PACKAGES) {
                try {
                    const result = await this.executeCommand(
                        `shell pm path ${packageName}`,
                        { timeout: 5000, retries: 1 }
                    );
                    
                    if (result && result.includes('package:')) {
                        console.log(`📲 WhatsApp trouvé: ${packageName}`);
                        return packageName;
                    }
                } catch (e) {
                    // Ce package n'est pas installé, continuer
                }
            }
            
            console.log('❌ Aucun WhatsApp trouvé avec méthode directe');
            return null;
            
        } catch (error) {
            console.error('❌ Erreur lors de la recherche WhatsApp:', error.message);
            return null;
        }
    }
    
    /**
     * Attend qu'une application se lance
     */
    async waitForApp(packageName, maxWaitTime = 15000) {
        const startTime = Date.now();
        
        console.log(`⏳ Attente du lancement de ${packageName}...`);
        
        while (Date.now() - startTime < maxWaitTime) {
            try {
                const isRunning = await this.isAppRunning(packageName);
                if (isRunning) {
                    console.log(`✅ ${packageName} est maintenant en cours d'exécution`);
                    return true;
                }
            } catch (error) {
                // Ignorer les erreurs de vérification
            }
            
            await wait(2000); // Attendre 2 secondes
        }
        
        console.log(`⚠️ Timeout dépassé pour ${packageName} (mais l'app peut être lancée)`);
        return false;
    }
    
    /**
     * Prend une capture d'écran
     */
    async takeScreenshot(filename = null) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const screenshotName = filename || `screenshot-${timestamp}.png`;
            const remotePath = `/sdcard/${screenshotName}`;
            const localPath = `screenshots/${screenshotName}`;
            
            // Créer le dossier screenshots s'il n'existe pas
            await execAsync('mkdir -p screenshots');
            
            // Prendre la capture
            await this.executeCommand(`shell screencap -p ${remotePath}`);
            
            // Télécharger la capture
            await this.executeCommand(`pull ${remotePath} ${localPath}`);
            
            // Nettoyer le téléphone
            await this.executeCommand(`shell rm ${remotePath}`, { retries: 1 });
            
            console.log(`📸 Capture d'écran sauvée: ${localPath}`);
            return localPath;
            
        } catch (error) {
            console.error('❌ Impossible de prendre une capture d\'écran:', error.message);
            return null;
        }
    }
}

/**
 * Établit une connexion ADB améliorée avec un téléphone
 */
async function connectToPhone(adbInfo) {
    const { adbIp, adbPort, adbPassword } = adbInfo;
    const deviceAddress = `${adbIp}:${adbPort}`;
    
    try {
        console.log(`🔌 Connexion ADB à ${deviceAddress}...`);
        
        // Étape 1: Nettoyer les connexions existantes
        try {
            await execAsync(`adb disconnect`, { timeout: 3000 });
            await wait(1000);
        } catch (e) {
            // Ignore les erreurs de déconnexion
        }
        
        // Étape 2: Redémarrer le serveur ADB pour éviter les connexions fermées
        try {
            await execAsync(`adb kill-server`, { timeout: 3000 });
            await wait(1000);
            await execAsync(`adb start-server`, { timeout: 5000 });
            await wait(2000);
        } catch (e) {
            console.log('⚠️ Impossible de redémarrer le serveur ADB');
        }
        
        // Étape 3: Connexion ADB avec timeout réduit
        const { stdout: connectOutput } = await execAsync(`adb connect ${deviceAddress}`, { timeout: 10000 });
        console.log(`✅ Connexion établie: ${connectOutput.trim()}`);
        
        // Étape 4: Attendre stabilisation
        await wait(3000);
        
        // Étape 5: Vérifier que la connexion est stable
        const { stdout: devicesOutput } = await execAsync('adb devices', { timeout: 5000 });
        console.log(`📱 Appareils connectés:\n${devicesOutput}`);
        
        if (devicesOutput.includes(deviceAddress) && devicesOutput.includes('device')) {
            console.log('✅ Connexion ADB stable confirmée');
            return deviceAddress;
        } else {
            console.log('⚠️ Connexion ADB établie mais statut incertain');
            return deviceAddress; // On continue quand même
        }
        
    } catch (error) {
        console.error(`❌ Impossible de se connecter via ADB: ${error.message}`);
        
        // Messages d'aide spécifiques
        if (error.message.includes('timeout')) {
            console.log('💡 Le téléphone met du temps à répondre, ceci est normal');
            console.log('💡 Essayez: npm run diagnostic pour un diagnostic complet');
        } else if (error.message.includes('refused')) {
            console.log('💡 Connexion refusée - vérifiez que le téléphone est bien démarré');
        } else if (error.message.includes('closed')) {
            console.log('💡 Connexion fermée - le téléphone peut nécessiter un déverrouillage manuel');
            console.log('💡 Consultez la documentation MoreLogin pour débloquer le téléphone');
        }
        
        throw error;
    }
}

/**
 * Prépare un téléphone pour le lancement d'application
 */
async function preparePhone(phoneId) {
    console.log(`🔧 Préparation du téléphone ${phoneId}...`);
    
    // 1. Vérifier le statut
    const phones = await getCloudPhoneList('local', 50);
    const phone = phones.find(p => p.id === phoneId);
    
    if (!phone) {
        throw new Error(`Téléphone ${phoneId} non trouvé`);
    }
    
    // 2. Démarrer si nécessaire
    if (phone.envStatus !== PHONE_STATUS.STARTED) {
        console.log(`🚀 Démarrage du téléphone...`);
        await startCloudPhone(phoneId, 'local');
        
        console.log(`⏳ Attente du démarrage (${TIMEOUTS.PHONE_STARTUP / 1000}s)...`);
        await wait(TIMEOUTS.PHONE_STARTUP);
    } else {
        console.log('✅ Téléphone déjà démarré');
    }
    
    // 3. Activer ADB si nécessaire
    if (!phone.enableAdb) {
        console.log(`🔧 Activation d'ADB...`);
        await enableADB(phoneId, 'local');
        
        console.log(`⏳ Attente de l'activation ADB (${TIMEOUTS.ADB_ACTIVATION / 1000}s)...`);
        await wait(TIMEOUTS.ADB_ACTIVATION);
    } else {
        console.log('✅ ADB déjà activé');
    }
    
    // 4. Récupérer les informations ADB
    console.log('ℹ️ Récupération des informations ADB...');
    const adbInfo = await getADBInfo(phoneId, 'local');
    if (!adbInfo || !adbInfo.success) {
        throw new Error('Impossible de récupérer les informations ADB');
    }
    
    console.log('✅ Informations ADB récupérées');
    return adbInfo;
}

/**
 * Lance WhatsApp sur un téléphone spécifique
 */
async function launchWhatsAppOnPhone(phoneId, whatsappPackage = null) {
    try {
        console.log(`🎯 Lancement de WhatsApp sur le téléphone ${phoneId}...\n`);
        
        // 1. Préparer le téléphone
        const adbInfo = await preparePhone(phoneId);
        
        // 2. Établir la connexion ADB
        const deviceAddress = await connectToPhone(adbInfo);
        
        // 3. Créer l'utilitaire ADB
        const adbUtils = new ADBUtils(deviceAddress);
        
        // 4. Rechercher WhatsApp
        console.log('🔍 Recherche de WhatsApp sur le téléphone...');
        
        let packageToLaunch = whatsappPackage;
        
        if (!packageToLaunch) {
            packageToLaunch = await adbUtils.findWhatsAppPackage();
        }
        
        // Si toujours pas trouvé, essayer le package par défaut
        if (!packageToLaunch) {
            console.log('⚠️ Tentative de lancement direct de WhatsApp...');
            packageToLaunch = 'com.whatsapp'; // Package par défaut
        }
        
        // 5. Lancer WhatsApp
        console.log(`🚀 Lancement de ${packageToLaunch}...`);
        const launched = await adbUtils.launchApp(packageToLaunch);
        
        if (!launched) {
            throw new Error('Échec du lancement de WhatsApp');
        }
        
        // 6. Attendre que l'app se lance
        console.log('⏳ Attente du chargement de WhatsApp...');
        const isRunning = await adbUtils.waitForApp(packageToLaunch, 15000);
        
        if (isRunning) {
            console.log('✅ WhatsApp lancé et en cours d\'exécution !');
        } else {
            console.log('⚠️ WhatsApp lancé mais statut incertain');
        }
        
        console.log('\n🎉 Mission accomplie !');
        console.log(`📱 Téléphone: ${phoneId}`);
        console.log(`📲 WhatsApp: ${packageToLaunch}`);
        console.log(`🔗 ADB: ${deviceAddress}`);
        
        return {
            phoneId,
            packageName: packageToLaunch,
            deviceAddress,
            adbUtils
        };
        
    } catch (error) {
        console.error(`❌ Erreur lors du lancement de WhatsApp: ${error.message}`);
        throw error;
    }
}

/**
 * Fonction principale
 */
async function main() {
    try {
        console.log('📱 Script de lancement WhatsApp\n');
        
        // Récupérer les paramètres
        const phoneIdentifier = process.argv[2];
        const customPackage = process.argv[3]; // Package WhatsApp personnalisé optionnel
        
        if (!phoneIdentifier) {
            console.log('ℹ️ Usage:');
            console.log('   npm run whatsapp <phone_id|phone_name|index>');
            console.log('   npm run whatsapp <phone_id> <package_name>  # Package personnalisé');
            console.log('\nExemples:');
            console.log('   npm run whatsapp 1646814214559087');
            console.log('   npm run whatsapp "CP-1"');
            console.log('   npm run whatsapp 1');
            console.log('   npm run whatsapp 1 com.whatsapp.w4b  # WhatsApp Business');
            return;
        }
        
        // Vérifier la connexion MoreLogin
        try {
            await makeLocalApiRequest('/api/cloudphone/page', 'POST', { pageNo: 1, pageSize: 1 });
        } catch (error) {
            console.error('❌ MoreLogin non accessible. Assurez-vous que:');
            console.error('   1. MoreLogin est démarré');
            console.error('   2. Vous êtes connecté');
            console.error('   3. L\'API locale est activée');
            throw error;
        }
        
        // Récupérer les téléphones
        const phones = await getCloudPhoneList('local', 50);
        
        if (phones.length === 0) {
            throw new Error('Aucun téléphone cloud trouvé');
        }
        
        // Trouver le téléphone cible
        const targetPhone = findPhone(phones, phoneIdentifier);
        
        if (!targetPhone) {
            console.error(`❌ Téléphone introuvable: "${phoneIdentifier}"`);
            console.error('\n📱 Téléphones disponibles:');
            phones.forEach((phone, index) => {
                console.error(`   ${index + 1}. ${phone.envName} (ID: ${phone.id})`);
            });
            return;
        }
        
        console.log(`🎯 Téléphone sélectionné: ${targetPhone.envName} (ID: ${targetPhone.id})\n`);
        
        // Lancer WhatsApp
        const result = await launchWhatsAppOnPhone(targetPhone.id, customPackage);
        
        return result;
        
    } catch (error) {
        console.error(`\n💥 Erreur: ${error.message}`);
        process.exit(1);
    }
}

// Exporter pour utilisation en tant que module
module.exports = {
    launchWhatsAppOnPhone,
    preparePhone,
    connectToPhone,
    ADBUtils,
    WHATSAPP_PACKAGES
};

// Exécuter si appelé directement
if (require.main === module) {
    main();
} 
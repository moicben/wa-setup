#!/usr/bin/env node

/**
 * Script pour démarrer un téléphone cloud MoreLogin et activer ADB
 * Version refactorisée utilisant les librairies communes et timeouts optimisés
 */

// Charger les variables d'environnement
// dotenv supprimé

const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

// Importer les librairies communes
const { TIMEOUTS, MAX_RETRIES, PHONE_STATUS } = require('../lib/constants');
const { findPhone, wait, withTimeout, retryWithBackoff } = require('../lib/utils');
const { 
    makeLocalApiRequest,
    getCloudPhoneList, 
    startCloudPhone, 
    enableADB,
    getADBInfo
} = require('../lib/api');

/**
 * Vérifie si un téléphone est vraiment prêt pour ADB
 */
async function isPhoneReadyForADB(phoneId, maxRetries = MAX_RETRIES.PHONE_READY) {
    console.log(`🔍 Vérification que le téléphone ${phoneId} est prêt pour ADB...`);
    
    return await retryWithBackoff(async () => {
        const phones = await getCloudPhoneList('local', 50);
        const phone = phones.find(p => p.id === phoneId);
        
        if (!phone) {
            throw new Error(`Téléphone avec l'ID ${phoneId} non trouvé`);
        }
        
        // Vérifier que le téléphone est vraiment démarré (statut 4)
        if (phone.envStatus === PHONE_STATUS.STARTED) {
            console.log(`✅ Téléphone prêt pour ADB`);
            return true;
        }
        
        throw new Error(`Téléphone pas encore prêt (statut: ${phone.envStatus})`);
    }, maxRetries, TIMEOUTS.PHONE_READY);
}

/**
 * Active ADB pour un téléphone cloud avec retry optimisé
 */
async function enableADBWithRetry(phoneId, maxRetries = MAX_RETRIES.ADB_ENABLE) {
    console.log(`🔧 Activation d'ADB pour le téléphone ID: ${phoneId}...`);
    
    return await retryWithBackoff(async () => {
        try {
            const result = await enableADB(phoneId, 'local');
            console.log('✅ ADB activé avec succès');
            return result;
        } catch (error) {
            if (error.message.includes('Cloud phones have not been started') || 
                error.message.includes('do not support ADB')) {
                
                // Vérifier à nouveau le statut du téléphone
                await isPhoneReadyForADB(phoneId, 3);
                throw new Error('Téléphone pas encore complètement prêt pour ADB');
            }
            throw error;
        }
    }, maxRetries, TIMEOUTS.ADB_ACTIVATION);
}

/**
 * Récupère les informations ADB d'un téléphone avec retry optimisé
 */
async function getADBInfoWithRetry(phoneId, maxRetries = MAX_RETRIES.PHONE_STATUS) {
    console.log(`ℹ️ Récupération des informations ADB...`);
    
    return await retryWithBackoff(async () => {
        const adbInfo = await getADBInfo(phoneId, 'local');
        
        if (!adbInfo || !adbInfo.success) {
            throw new Error('Informations ADB non disponibles');
        }
        
        console.log(`✅ Informations ADB récupérées`);
        return adbInfo;
    }, maxRetries, TIMEOUTS.PHONE_READY);
}

/**
 * Se connecte via ADB avec timeout et retry optimisés
 */
async function connectADB(adbInfo, timeoutMs = TIMEOUTS.ADB_CONNECT) {
    console.log('🔌 Connexion ADB...');
    
    const { adbIp, adbPort, adbPassword } = adbInfo;
    const deviceAddress = `${adbIp}:${adbPort}`;
    
    try {
        // Étape 1: Connexion ADB avec timeout optimisé
        console.log(`Connexion à ${deviceAddress}...`);
        
        const { stdout: connectOutput } = await withTimeout(
            execAsync(`adb connect ${deviceAddress}`),
            timeoutMs,
            'Timeout de connexion ADB'
        );
        console.log(connectOutput.trim());
        
        // Attendre un peu que la connexion soit stable
        await wait(2000);
        
        // Étape 2: Test de la connexion avec timeout optimisé
        console.log('🧪 Test de la connexion...');
        try {
            const { stdout: testOutput } = await withTimeout(
                execAsync(`adb -s ${deviceAddress} shell echo "Test connexion ADB"`),
                TIMEOUTS.ADB_TEST,
                'Timeout du test ADB'
            );
            
            console.log(`✅ Test réussi: ${testOutput.trim()}`);
            console.log('✅ Connexion ADB établie sans authentification');
        } catch (testError) {
            console.log('❌ Test initial échoué...');
            
            // Étape 3: Authentification OBLIGATOIRE avec le mot de passe ADB
            if (adbPassword) {
                console.log('🔐 Authentification ADB avec mot de passe...');
                try {
                    // Essayer l'authentification avec le mot de passe
                    await withTimeout(
                        execAsync(`adb -s ${deviceAddress} shell su -c 'echo "Authentification réussie"'`),
                        8000,
                        'Timeout d\'authentification ADB'
                    );
                    console.log('✅ Authentification root réussie');
                } catch (authError) {
                    console.log(`⚠️ Authentification root échouée: ${authError.message}`);
                    
                    // Essayer avec le mot de passe directement
                    try {
                        console.log('🔐 Tentative d\'authentification avec mot de passe...');
                        await withTimeout(
                            execAsync(`adb -s ${deviceAddress} shell "${adbPassword}"`),
                            5000,
                            'Timeout d\'authentification directe'
                        );
                        console.log('✅ Authentification avec mot de passe réussie');
                    } catch (authError2) {
                        console.log(`⚠️ Authentification directe échouée: ${authError2.message}`);
                    }
                }
                
                // Test final après authentification
                try {
                    const { stdout: testOutput2 } = await withTimeout(
                        execAsync(`adb -s ${deviceAddress} shell echo "Test après authentification"`),
                        5000,
                        'Timeout du test final'
                    );
                    console.log(`✅ Test après authentification réussi: ${testOutput2.trim()}`);
                } catch (finalTestError) {
                    console.log(`⚠️ Test final échoué: ${finalTestError.message}`);
                }
            } else {
                console.log('⚠️ Pas de mot de passe ADB disponible, continuons...');
            }
        }
        
        // Étape 4: Vérification finale des appareils connectés
        try {
            const { stdout: devicesOutput } = await execAsync('adb devices');
            console.log('📱 Appareils connectés:');
            console.log(devicesOutput);
            
            // Vérifier que notre appareil est bien dans la liste
            if (devicesOutput.includes(deviceAddress)) {
                console.log('✅ Connexion ADB établie avec succès');
            } else {
                console.log('⚠️ Appareil non visible dans la liste mais connexion probablement OK');
            }
        } catch (devicesError) {
            console.log('⚠️ Impossible de lister les appareils mais connexion probablement OK');
        }
        
        return deviceAddress;
        
    } catch (error) {
        console.error(`❌ Erreur lors de la connexion ADB: ${error.message}`);
        
        // Si le test échoue, essayer de se reconnecter une seule fois avec retry optimisé
        if (error.message.includes('device offline') || error.message.includes('no devices') || error.message.includes('Timeout')) {
            console.log('🔄 Tentative de reconnexion rapide...');
            try {
                await execAsync(`adb disconnect ${deviceAddress}`);
                await wait(2000);
                
                // Reconnexion
                const { stdout: reconnectOutput } = await execAsync(`adb connect ${deviceAddress}`);
                console.log(reconnectOutput.trim());
                
                return deviceAddress;
            } catch (reconnectError) {
                console.error(`❌ Échec de la reconnexion: ${reconnectError.message}`);
            }
        }
        
        throw error;
    }
}

/**
 * Fonctions utilitaires ADB pour interagir avec le téléphone
 */
class ADBUtils {
    constructor(deviceAddress) {
        this.device = deviceAddress;
    }
    
    async click(x, y) {
        await execAsync(`adb -s ${this.device} shell input tap ${x} ${y}`);
    }
    
    async swipe(startX, startY, endX, endY, duration = 100) {
        await execAsync(`adb -s ${this.device} shell input swipe ${startX} ${startY} ${endX} ${endY} ${duration}`);
    }
    
    async inputText(text) {
        await execAsync(`adb -s ${this.device} shell "input text \\"${text}\\""`);
    }
    
    async inputKeyEvent(keycode) {
        await execAsync(`adb -s ${this.device} shell input keyevent ${keycode}`);
    }
    
    async launchApp(packageName, activityName = null) {
        try {
            if (activityName) {
                // Lancer avec une activité spécifique
                await execAsync(`adb -s ${this.device} shell am start -n ${packageName}/${activityName}`);
            } else {
                // Essayer d'abord monkey, puis am start en fallback
                try {
                    await execAsync(`adb -s ${this.device} shell monkey -p ${packageName} -c android.intent.category.LAUNCHER 1`);
                } catch (monkeyError) {
                    // Fallback avec am start
                    await execAsync(`adb -s ${this.device} shell am start -n ${packageName}/.Main`);
                }
            }
            console.log(`✅ Application ${packageName} lancée`);
        } catch (error) {
            console.error(`❌ Erreur lors du lancement de ${packageName}: ${error.message}`);
            throw error;
        }
    }
    
    async getInstalledApps() {
        try {
            const { stdout } = await execAsync(`adb -s ${this.device} shell pm list packages`);
            return stdout.split('\n')
                .filter(line => line.startsWith('package:'))
                .map(line => line.replace('package:', '').trim())
                .filter(pkg => pkg.length > 0);
        } catch (error) {
            console.error(`❌ Erreur lors de la récupération des apps: ${error.message}`);
            throw error;
        }
    }
    
    async findAppByName(searchTerm) {
        const apps = await this.getInstalledApps();
        return apps.filter(app => app.toLowerCase().includes(searchTerm.toLowerCase()));
    }
}

/**
 * Fonction principale optimisée
 */
async function main(phoneIdentifier = null) {
    try {
        console.log('🎯 Démarrage du script MoreLogin...\n');
        
        // Récupérer l'identifiant du téléphone depuis les arguments de ligne de commande
        if (!phoneIdentifier && process.argv.length > 2) {
            phoneIdentifier = process.argv[2];
        }
        
        // Vérifier que MoreLogin est accessible
        try {
            console.log('🔍 Vérification de la connexion à MoreLogin...');
            await makeLocalApiRequest('/api/cloudphone/page', 'POST', { pageNo: 1, pageSize: 1 });
            console.log('✅ MoreLogin est accessible via l\'API locale');
        } catch (error) {
            console.error('❌ Impossible de se connecter à MoreLogin');
            console.error('   Assurez-vous que:');
            console.error('   1. MoreLogin est démarré');
            console.error('   2. Vous êtes connecté à votre compte');
            console.error('   3. L\'API locale est activée (port 40000)');
            throw error;
        }
        
        // 1. Récupérer la liste des téléphones
        const phones = await getCloudPhoneList('local', 50);
        
        if (phones.length === 0) {
            console.error('❌ Aucun téléphone cloud trouvé');
            console.error('   Créez d\'abord un téléphone cloud dans MoreLogin');
            return;
        }
        
        // Trouver le téléphone cible
        const targetPhone = findPhone(phones, phoneIdentifier);
        
        if (!targetPhone) {
            console.error(`❌ Téléphone introuvable: "${phoneIdentifier}"`);
            console.error('💡 Vous pouvez utiliser:');
            console.error('   - L\'ID du téléphone (ex: 1646814214559087)');
            console.error('   - Le nom du téléphone (ex: "CP-10")');
            console.error('   - L\'index du téléphone (ex: 1, 2, 3...)');
            console.error('   - Aucun paramètre pour utiliser le premier téléphone');
            return;
        }
        
        if (phoneIdentifier) {
            console.log(`\n🎯 Téléphone spécifié: ${targetPhone.envName} (ID: ${targetPhone.id})`);
        } else {
            console.log(`\n🎯 Utilisation du premier téléphone: ${targetPhone.envName} (ID: ${targetPhone.id})`);
        }
        
        // 2. Démarrer le téléphone si nécessaire (avec timeout optimisé)
        if (targetPhone.envStatus !== PHONE_STATUS.STARTED) {
            await startCloudPhone(targetPhone.id, 'local');
            // Attendre le démarrage complet avec timeout optimisé
            console.log(`⏳ Attente du démarrage complet (${TIMEOUTS.PHONE_STARTUP / 1000} secondes)...`);
            await wait(TIMEOUTS.PHONE_STARTUP);
            
            // Vérifier que le téléphone est vraiment prêt
            await isPhoneReadyForADB(targetPhone.id);
        } else {
            console.log('✅ Le téléphone est déjà démarré');
            // Même si déjà démarré, vérifier qu'il est vraiment prêt pour ADB
            await isPhoneReadyForADB(targetPhone.id, 3);
        }
        
        // 3. Activer ADB si nécessaire (avec retry optimisé)
        if (!targetPhone.enableAdb) {
            await enableADBWithRetry(targetPhone.id);
            // Attendre que ADB soit activé avec timeout optimisé
            console.log(`⏳ Attente de l'activation ADB (${TIMEOUTS.ADB_ACTIVATION / 1000} secondes)...`);
            await wait(TIMEOUTS.ADB_ACTIVATION);
        } else {
            console.log('✅ ADB est déjà activé');
        }
        
        // 4. Récupérer les informations ADB avec retry optimisé
        const adbInfo = await getADBInfoWithRetry(targetPhone.id);
        console.log('📋 Informations ADB:');
        console.log(`   IP: ${adbInfo.adbIp}`);
        console.log(`   Port: ${adbInfo.adbPort}`);
        console.log(`   Mot de passe: ${adbInfo.adbPassword ? adbInfo.adbPassword : 'Aucun'}`);
        
        // 5. Se connecter via ADB avec timeouts optimisés
        const deviceAddress = await connectADB(adbInfo);
        
        // 6. Créer l'instance utilitaire ADB
        const adbUtils = new ADBUtils(deviceAddress);
        
        console.log('\n🎉 Configuration terminée avec succès !');
        console.log(`📱 Téléphone connecté: ${deviceAddress}`);
        console.log('\n💡 Exemples d\'utilisation:');
        console.log('   - Clic: adbUtils.click(100, 200)');
        console.log('   - Texte: adbUtils.inputText("Hello World")');
        console.log('   - Lancer app: adbUtils.launchApp("com.whatsapp")');
        
        console.log('\n✅ Script terminé. Vous pouvez maintenant utiliser ADB avec ce téléphone.');
        console.log(`🔗 Adresse du téléphone: ${deviceAddress}`);
        console.log('📝 Pour se reconnecter plus tard: adb connect ' + deviceAddress);

        // 7. Lancement simple de WhatsApp
        // try {

        //     console.log(`Liste des applications installées:`);
        //     const installedApps = await adbUtils.getInstalledApps();
        //     console.log(installedApps.join('\n'));

        //     console.log('\n📱 Lancement de WhatsApp...');
        //     await adbUtils.launchApp("com.whatsapp");
        // } catch (error) {
        //     console.log(`⚠️ Erreur lors du lancement de WhatsApp: ${error.message}`);
        // }

        return { 
            utils: adbUtils, 
            device: deviceAddress, 
            phone: targetPhone 
        };
        
    } catch (error) {
        console.error(`❌ Erreur lors du démarrage: ${error.message}`);
        process.exit(1);
    }
}

// Exporter les fonctions pour utilisation en tant que module
module.exports = {
    startPhone: main,
    ADBUtils,
    connectADB,
    isPhoneReadyForADB,
    enableADBWithRetry,
    getADBInfoWithRetry
};

// Exécuter le script principal si appelé directement
if (require.main === module) {
    main();
}
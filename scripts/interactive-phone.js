#!/usr/bin/env node

/**
 * Mode interactif pour tester des commandes ADB en live
 * Utilise launchWhatsApp pour préparer le téléphone puis ouvre un REPL
 */

// dotenv supprimé
const repl = require('repl');
const { launchWhatsAppOnPhone } = require('./launchWhatsApp');

// Variables globales pour le REPL
let adbUtils, deviceAddress, phoneInfo;

/**
 * Commandes prédéfinies disponibles dans le REPL
 */
const commands = {
    // Commandes de base
    click: async (x, y) => {
        if (!adbUtils) throw new Error('Téléphone non connecté');
        await adbUtils.click(x, y);
        console.log(`✅ Clic effectué à (${x}, ${y})`);
    },
    
    swipe: async (startX, startY, endX, endY, duration = 100) => {
        if (!adbUtils) throw new Error('Téléphone non connecté');
        await adbUtils.swipe(startX, startY, endX, endY, duration);
        console.log(`✅ Glissement de (${startX}, ${startY}) à (${endX}, ${endY})`);
    },
    
    text: async (text) => {
        if (!adbUtils) throw new Error('Téléphone non connecté');
        await adbUtils.inputText(text);
        console.log(`✅ Texte saisi: "${text}"`);
    },
    
    key: async (keycode) => {
        if (!adbUtils) throw new Error('Téléphone non connecté');
        await adbUtils.inputKeyEvent(keycode);
        console.log(`✅ Touche pressée: ${keycode} (${getKeyName(keycode)})`);
    },
    
    // Commandes système
    apps: async () => {
        if (!adbUtils) throw new Error('Téléphone non connecté');
        console.log('📱 Récupération des applications...');
        const apps = await adbUtils.getInstalledApps();
        console.log(`📦 ${apps.length} applications trouvées:`);
        return apps;
    },
    
    findApp: async (name) => {
        if (!adbUtils) throw new Error('Téléphone non connecté');
        const matches = await adbUtils.findAppByName(name);
        console.log(`🔍 Applications contenant "${name}":`);
        matches.forEach(app => console.log(`   ${app}`));
        return matches;
    },
    
    launch: async (packageName, activityName = null) => {
        if (!adbUtils) throw new Error('Téléphone non connecté');
        await adbUtils.launchApp(packageName, activityName);
        console.log(`🚀 Application lancée: ${packageName}`);
    },
    
    screenshot: async (filename = null) => {
        if (!deviceAddress) throw new Error('Téléphone non connecté');
        const { exec } = require('child_process');
        const util = require('util');
        const execAsync = util.promisify(exec);
        const fs = require('fs');
        
        try {
            // Créer le dossier screenshots s'il n'existe pas
            if (!fs.existsSync('screenshots')) {
                fs.mkdirSync('screenshots');
            }
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fname = filename || `screenshot-${timestamp}.png`;
            const fullPath = `screenshots/${fname}`;
            
            await execAsync(`adb -s ${deviceAddress} exec-out screencap -p > ${fullPath}`);
            console.log(`📸 Screenshot sauvegardé: ${fullPath}`);
            return fullPath;
        } catch (error) {
            console.error('❌ Erreur screenshot:', error.message);
            throw error;
        }
    },
    
    shell: async (command) => {
        if (!deviceAddress) throw new Error('Téléphone non connecté');
        const { exec } = require('child_process');
        const util = require('util');
        const execAsync = util.promisify(exec);
        
        try {
            console.log(`🖥️ Exécution: ${command}`);
            const { stdout, stderr } = await execAsync(`adb -s ${deviceAddress} shell ${command}`);
            
            if (stdout) {
                console.log('📋 Résultat:');
                console.log(stdout);
            }
            if (stderr) {
                console.log('⚠️ Erreurs:');
                console.log(stderr);
            }
            
            return stdout;
        } catch (error) {
            console.error('❌ Erreur shell:', error.message);
            throw error;
        }
    },
    
    // Commandes WhatsApp spécifiques
    whatsapp: {
        open: async () => {
            await commands.launch('com.whatsapp');
            await commands.wait(3000);
            console.log('📱 WhatsApp ouvert');
        },
        
        business: async () => {
            await commands.launch('com.whatsapp.w4b');
            await commands.wait(3000);
            console.log('💼 WhatsApp Business ouvert');
        },
        
        close: async () => {
            await commands.key(3); // HOME key
            console.log('🏠 Retour à l\'accueil');
        },
        
        back: async () => {
            await commands.key(4); // BACK key
            console.log('⬅️ Retour');
        },
        
        // Coordonnées typiques (à ajuster selon ton téléphone)
        clickPhone: async () => {
            await commands.click(540, 1200);
            console.log('📞 Clic sur le bouton téléphone');
        },
        
        clickSettings: async () => {
            await commands.click(50, 150);
            console.log('⚙️ Clic sur les paramètres');
        },
        
        clickNewChat: async () => {
            await commands.click(500, 1100);
            console.log('💬 Clic sur nouveau chat');
        },
        
        // Saisie rapide
        typePhone: async (phone) => {
            await commands.text(phone);
            console.log(`📱 Numéro saisi: ${phone}`);
        },
        
        typeMessage: async (msg) => {
            await commands.text(msg);
            console.log(`💬 Message saisi: "${msg}"`);
        },
        
        send: async () => {
            await commands.click(600, 1000);
            console.log('📤 Message envoyé');
        },
        
        // Workflow complet d'envoi de message
        sendMessage: async (phone, message) => {
            console.log(`📤 Envoi de message à ${phone}: "${message}"`);
            await commands.whatsapp.open();
            await commands.wait(2000);
            await commands.whatsapp.clickNewChat();
            await commands.wait(1000);
            await commands.whatsapp.typePhone(phone);
            await commands.wait(1000);
            await commands.key(66); // ENTER
            await commands.wait(2000);
            await commands.whatsapp.typeMessage(message);
            await commands.wait(1000);
            await commands.whatsapp.send();
            console.log('✅ Message envoyé avec succès !');
        }
    },
    
    // Utilitaires
    wait: async (ms) => {
        await new Promise(resolve => setTimeout(resolve, ms));
        console.log(`⏳ Attente de ${ms}ms terminée`);
    },
    
    clear: () => {
        console.clear();
        console.log(`📱 ${phoneInfo?.phone?.envName || 'Téléphone'} > Mode interactif actif`);
    },
    
    status: () => {
        if (!phoneInfo) {
            console.log('❌ Aucun téléphone connecté');
            return;
        }
        
        console.log(`
📊 État de la connexion:
📱 Téléphone: ${phoneInfo.phone.envName} (ID: ${phoneInfo.phoneId})
🔗 Adresse ADB: ${phoneInfo.deviceAddress}
📲 Application: ${phoneInfo.packageName}
✅ Statut: Connecté et prêt
        `);
    },
    
    // Commandes de test rapide
    test: {
        click: async () => {
            console.log('🧪 Test de clic au centre de l\'écran...');
            await commands.click(360, 640);
        },
        
        swipe: async () => {
            console.log('🧪 Test de glissement (swipe vers le haut)...');
            await commands.swipe(360, 800, 360, 400, 500);
        },
        
        text: async () => {
            console.log('🧪 Test de saisie de texte...');
            await commands.text('Test de saisie interactive');
        },
        
        screenshot: async () => {
            console.log('🧪 Test de capture d\'écran...');
            return await commands.screenshot('test-capture.png');
        },
        
        whatsapp: async () => {
            console.log('🧪 Test complet WhatsApp...');
            await commands.whatsapp.open();
            await commands.wait(3000);
            await commands.screenshot('whatsapp-ouvert.png');
            await commands.whatsapp.close();
            console.log('✅ Test WhatsApp terminé');
        }
    },
    
    help: () => commands.info(),
    
    info: () => {
        console.log(`
📱 Mode interactif WhatsApp - Commandes disponibles:

🎯 COMMANDES DE BASE:
   click(x, y)                    - Cliquer à une position
   swipe(x1, y1, x2, y2, ms)     - Glisser (ms optionnel, défaut: 100)
   text("message")                - Saisir du texte
   key(keycode)                   - Presser une touche

🔧 TOUCHES COURANTES:
   key(3)   = HOME      key(4)   = RETOUR    key(66)  = ENTRÉE
   key(67)  = SUPPR     key(82)  = MENU      key(26)  = VOLUME+

📱 SYSTÈME:
   apps()                         - Lister toutes les applications
   findApp("whatsapp")           - Chercher une application
   launch("com.whatsapp")        - Lancer une application
   screenshot("nom.png")         - Capture d'écran (nom optionnel)
   shell("commande")             - Exécuter une commande shell

💬 WHATSAPP:
   whatsapp.open()               - Ouvrir WhatsApp
   whatsapp.business()           - Ouvrir WhatsApp Business
   whatsapp.close()              - Fermer (retour accueil)
   whatsapp.back()               - Bouton retour
   whatsapp.typePhone("123456")  - Saisir un numéro
   whatsapp.typeMessage("salut") - Saisir un message
   whatsapp.send()               - Envoyer le message
   whatsapp.sendMessage("123", "salut") - Workflow complet

🧪 TESTS RAPIDES:
   test.click()                  - Test de clic
   test.swipe()                  - Test de glissement
   test.text()                   - Test de saisie
   test.screenshot()             - Test de capture
   test.whatsapp()               - Test complet WhatsApp

🔧 UTILITAIRES:
   wait(2000)                    - Attendre 2 secondes
   clear()                       - Effacer l'écran
   status()                      - État de la connexion
   info() / help()               - Afficher cette aide

💡 EXEMPLES D'UTILISATION:
   await click(100, 200)
   await text("Hello World")
   await whatsapp.open()
   await wait(3000)
   await screenshot()
   await whatsapp.sendMessage("0123456789", "Salut depuis le script!")

⚠️  N'oublie pas le 'await' devant les commandes asynchrones !
🚪 Tapez '.exit' pour quitter le mode interactif
        `);
    }
};

/**
 * Retourne le nom d'une touche selon son code
 */
function getKeyName(keycode) {
    const keys = {
        3: 'HOME',
        4: 'RETOUR',
        26: 'VOLUME+',
        25: 'VOLUME-',
        66: 'ENTRÉE',
        67: 'SUPPR',
        82: 'MENU',
        84: 'RECHERCHE',
        187: 'APP_SWITCH'
    };
    return keys[keycode] || 'Inconnue';
}

/**
 * Initialise le mode interactif
 */
async function startInteractiveMode() {
    try {
        // Récupérer les paramètres
        const phoneIdentifier = process.argv[2];
        const customPackage = process.argv[3] || 'com.whatsapp';
        
        if (!phoneIdentifier) {
            console.log('📱 Mode interactif WhatsApp\n');
            console.log('ℹ️ Usage:');
            console.log('   node scripts/interactive-phone.js <phone_id|phone_name|index>');
            console.log('   npm run interactive <phone_id|phone_name|index>');
            console.log('\nExemples:');
            console.log('   node scripts/interactive-phone.js 1646814214559087');
            console.log('   node scripts/interactive-phone.js "CP-1"');
            console.log('   node scripts/interactive-phone.js 1');
            console.log('   npm run interactive 1');
            return;
        }
        
        console.log('🚀 Initialisation du mode interactif...\n');
        
        // Lancer WhatsApp et préparer la connexion
        phoneInfo = await launchWhatsAppOnPhone(phoneIdentifier, customPackage);
        adbUtils = phoneInfo.adbUtils;
        deviceAddress = phoneInfo.deviceAddress;
        
        console.log('\n🎉 Mode interactif prêt !');
        console.log('📱 Tapez "info()" ou "help()" pour voir les commandes disponibles');
        console.log('🔄 Tapez ".exit" pour quitter\n');
        
        // Créer le REPL
        const replServer = repl.start({
            prompt: `📱 ${phoneInfo.phone.envName} > `,
            useColors: true,
            useGlobal: true,
            ignoreUndefined: true
        });
        
        // Ajouter les commandes au contexte du REPL
        Object.assign(replServer.context, commands);
        
        // Ajouter des variables utiles
        replServer.context.adbUtils = adbUtils;
        replServer.context.deviceAddress = deviceAddress;
        replServer.context.phoneInfo = phoneInfo;
        
        // Afficher l'aide au démarrage
        setTimeout(() => {
            console.log('\n💡 Conseil: Commencez par taper "info()" pour voir toutes les commandes !');
        }, 500);
        
        // Gérer la fermeture propre
        replServer.on('exit', () => {
            console.log('\n👋 Mode interactif terminé !');
            console.log('🔌 Connexion ADB maintenue - vous pouvez utiliser adb directement');
            console.log(`   adb -s ${deviceAddress} shell`);
            process.exit(0);
        });
        
        // Gérer les erreurs
        replServer.on('error', (error) => {
            console.error('❌ Erreur REPL:', error.message);
        });
        
    } catch (error) {
        console.error(`❌ Erreur lors de l'initialisation: ${error.message}`);
        process.exit(1);
    }
}

// Exécuter si appelé directement
if (require.main === module) {
    startInteractiveMode();
}

module.exports = { startInteractiveMode, commands }; 
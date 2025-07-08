/**
 * Contrôleur BlueStack Minimal
 * Version allégée avec seulement les fonctions essentielles
 */

const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

class BlueStackController {
    constructor(config = {}) {
        this.deviceId = config.deviceId || '127.0.0.1:5585';
        this.adbPath = 'adb';
        this.connected = false;
        
        // Délais essentiels uniquement
        this.delays = {
            short: 500,
            medium: 1500,
            long: 3000,
            appLaunch: 8000
        };
    }

    /**
     * Initialiser la connexion
     */
    async initialize() {
        try {
            console.log('🔌 Connexion BlueStack...');
            
            // Vérifier ADB
            await execAsync('adb version');
            
            // Connecter au device
            await execAsync(`adb connect ${this.deviceId}`);
            await this.wait('short');
            
            this.connected = true;
            console.log('✅ BlueStack connecté');
            
            return true;
        } catch (error) {
            throw new Error(`Connexion BlueStack échouée: ${error.message}`);
        }
    }

    /**
     * Exécuter une commande ADB
     */
    async executeADB(command) {
        if (!this.connected) {
            throw new Error('BlueStack non connecté');
        }
        
        try {
            const fullCommand = `adb -s ${this.deviceId} ${command}`;
            return await execAsync(fullCommand);
        } catch (error) {
            throw new Error(`Commande ADB échouée: ${error.message}`);
        }
    }

    /**
     * Lancer une application
     */
    async launchApp(packageName) {
        try {
            console.log(`📱 Lancement ${packageName}...`);
            
            // Forcer stop puis lancer
            await this.executeADB(`shell am force-stop ${packageName}`);
            await this.wait('short');
            
            await this.executeADB(`shell monkey -p ${packageName} -c android.intent.category.LAUNCHER 1`);
            await this.wait('appLaunch');
            
            console.log('✅ Application lancée');
            return true;
        } catch (error) {
            console.error(`❌ Erreur lancement: ${error.message}`);
            return false;
        }
    }

    /**
     * Réinitialiser une application
     */
    async resetApp(packageName) {
        try {
            console.log(`🔄 Reset ${packageName}...`);
            
            await this.executeADB(`shell am force-stop ${packageName}`);
            await this.executeADB(`shell pm clear ${packageName}`);
            await this.wait('medium');
            
            console.log('✅ Application réinitialisée');
            return true;
        } catch (error) {
            console.error(`❌ Erreur reset: ${error.message}`);
            return false;
        }
    }

    /**
     * Cliquer sur l'écran
     */
    async click(x, y) {
        try {
            await this.executeADB(`shell input tap ${x} ${y}`);
            await this.wait('short');
            return true;
        } catch (error) {
            console.error(`❌ Erreur clic: ${error.message}`);
            return false;
        }
    }

    /**
     * Saisir du texte
     */
    async inputText(text) {
        try {
            // Échapper les caractères spéciaux pour le shell
            const escapedText = text.replace(/\s/g, '%s').replace(/['"]/g, '');
            await this.executeADB(`shell input text "${escapedText}"`);
            await this.wait('short');
            return true;
        } catch (error) {
            console.error(`❌ Erreur saisie: ${error.message}`);
            return false;
        }
    }

    /**
     * Appuyer sur une touche
     */
    async pressKey(keyCode) {
        try {
            await this.executeADB(`shell input keyevent ${keyCode}`);
            await this.wait('short');
            return true;
        } catch (error) {
            console.error(`❌ Erreur touche: ${error.message}`);
            return false;
        }
    }

    /**
     * Effacer un champ texte
     */
    async clearField(x, y) {
        try {
            // Clic pour focus
            await this.click(x, y);
            
            // Sélectionner tout (Ctrl+A)
            await this.pressKey(1); // KEYCODE_SOFT_LEFT (pour sélection)
            await this.wait('short');
            
            // Supprimer
            await this.pressKey(67); // KEYCODE_DEL
            await this.wait('short');
            
            return true;
        } catch (error) {
            console.error(`❌ Erreur effacement: ${error.message}`);
            return false;
        }
    }

    /**
     * Prendre un screenshot
     */
    async takeScreenshot(filename = null) {
        try {
            const name = filename || `screenshot_${Date.now()}.png`;
            const devicePath = `/sdcard/${name}`;
            const localPath = `./screenshots/${name}`;
            
            // Capturer
            await this.executeADB(`shell screencap -p ${devicePath}`);
            
            // Télécharger
            await this.executeADB(`pull ${devicePath} ${localPath}`);
            
            // Nettoyer
            await this.executeADB(`shell rm ${devicePath}`);
            
            return localPath;
        } catch (error) {
            console.error(`❌ Erreur screenshot: ${error.message}`);
            return null;
        }
    }

    /**
     * Attendre un délai
     */
    async wait(delayName) {
        const ms = this.delays[delayName] || delayName;
        return new Promise(resolve => setTimeout(resolve, ms));
    }





    /**
     * Diagnostic simple
     */
    async checkStatus() {
        try {
            console.log('🔧 Vérification statut...');
            
            // Test connexion
            await this.executeADB('shell echo "OK"');
            console.log('✅ Connexion ADB OK');
            
            // Vérifier WhatsApp
            const result = await this.executeADB('shell pm list packages com.whatsapp');
            const whatsappInstalled = result.stdout.includes('com.whatsapp');
            console.log(`${whatsappInstalled ? '✅' : '❌'} WhatsApp ${whatsappInstalled ? 'installé' : 'manquant'}`);
            
            return { connected: true, whatsappInstalled };
        } catch (error) {
            console.error(`❌ Diagnostic échoué: ${error.message}`);
            return { connected: false, whatsappInstalled: false };
        }
    }
}

module.exports = { BlueStackController }; 
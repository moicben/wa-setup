/**
 * Contrôleur BlueStack Refactorisé
 * Version modulaire utilisant les composants extraits
 */

const { ADBConnection, InputSimulator } = require('../../core/device');
const { DelayManager } = require('../../utils/timing');

class BlueStackController {
    constructor(config = {}) {
        this.config = {
            deviceId: config.deviceId || '127.0.0.1:5585',
            adbPath: config.adbPath || 'adb',
            customDelays: config.delays || {},
            ...config
        };

        // Composants modulaires
        this.adb = new ADBConnection({
            deviceId: this.config.deviceId,
            adbPath: this.config.adbPath
        });
        
        this.delays = new DelayManager(this.config.customDelays);
        this.input = new InputSimulator(this.adb, this.delays);
        
        // État
        this.initialized = false;
    }

    /**
     * Initialiser tous les composants
     */
    async initialize() {
        try {
            console.log('🚀 Initialisation BlueStack Controller...');
            
            // Initialiser la connexion ADB
            await this.adb.initialize();
            
            // Vérifier le device
            const deviceInfo = await this.adb.getDeviceInfo();
            console.log(`📱 Device: ${deviceInfo.model} (Android ${deviceInfo.androidVersion})`);
            
            this.initialized = true;
            console.log('✅ BlueStack Controller prêt');
            
            return true;
        } catch (error) {
            this.initialized = false;
            throw new Error(`Initialisation BlueStack échouée: ${error.message}`);
        }
    }

    /**
     * Lancer une application
     */
    async launchApp(packageName) {
        this._checkInitialized();
        
        try {
            console.log(`📱 Lancement ${packageName}...`);
            
            // Forcer l'arrêt de l'app
            await this.adb.executeCommand(`shell am force-stop ${packageName}`);
            await this.delays.wait('short');
            
            // Lancer l'application
            await this.adb.executeCommand(
                `shell monkey -p ${packageName} -c android.intent.category.LAUNCHER 1`
            );
            await this.delays.wait('appLaunch');
            
            console.log(`✅ ${packageName} lancé`);
            return true;
        } catch (error) {
            console.error(`❌ Erreur lancement ${packageName}: ${error.message}`);
            return false;
        }
    }

    /**
     * Réinitialiser une application (clear data)
     */
    async resetApp(packageName) {
        this._checkInitialized();
        
        try {
            console.log(`🔄 Reset ${packageName}...`);
            
            // Arrêter l'app
            await this.adb.executeCommand(`shell am force-stop ${packageName}`);
            
            // Effacer les données
            await this.adb.executeCommand(`shell pm clear ${packageName}`);
            await this.delays.wait('medium');
            
            console.log(`✅ ${packageName} réinitialisé`);
            return true;
        } catch (error) {
            console.error(`❌ Erreur reset ${packageName}: ${error.message}`);
            return false;
        }
    }

    /**
     * Prendre un screenshot
     */
    async takeScreenshot(filename = null) {
        this._checkInitialized();
        
        try {
            const name = filename || `screenshot_${Date.now()}.png`;
            const devicePath = `/sdcard/${name}`;
            const localPath = `./screenshots/${name}`;
            
            // Capturer
            await this.adb.executeCommand(`shell screencap -p ${devicePath}`);
            
            // Télécharger
            await this.adb.executeCommand(`pull ${devicePath} ${localPath}`);
            
            // Nettoyer le device
            await this.adb.executeCommand(`shell rm ${devicePath}`);
            
            return localPath;
        } catch (error) {
            console.error(`❌ Erreur screenshot: ${error.message}`);
            return null;
        }
    }

    /**
     * Vérifier le statut du système
     */
    async checkStatus() {
        try {
            if (!this.initialized) {
                return { connected: false, whatsappInstalled: false, error: 'Non initialisé' };
            }

            console.log('🔧 Vérification statut...');
            
            // Test connexion
            const connected = await this.adb.checkConnection();
            if (!connected) {
                return { connected: false, whatsappInstalled: false, error: 'Connexion ADB perdue' };
            }
            
            // Vérifier WhatsApp
            const result = await this.adb.executeCommand('shell pm list packages com.whatsapp');
            const whatsappInstalled = result.stdout.includes('com.whatsapp');
            
            console.log(`✅ Connexion: OK`);
            console.log(`${whatsappInstalled ? '✅' : '❌'} WhatsApp: ${whatsappInstalled ? 'Installé' : 'Manquant'}`);
            
            return { 
                connected: true, 
                whatsappInstalled,
                deviceInfo: await this.adb.getDeviceInfo()
            };
        } catch (error) {
            console.error(`❌ Diagnostic échoué: ${error.message}`);
            return { connected: false, whatsappInstalled: false, error: error.message };
        }
    }

    /**
     * Méthodes déléguées pour compatibilité avec l'ancien code
     */
    
    // Input methods (délégation vers InputSimulator)
    async click(x, y) {
        this._checkInitialized();
        return await this.input.click(x, y);
    }

    async inputText(text) {
        this._checkInitialized();
        return await this.input.inputText(text);
    }

    async pressKey(keyCode) {
        this._checkInitialized();
        return await this.input.pressKey(keyCode);
    }

    async clearField(x, y, method = 'select_all') {
        this._checkInitialized();
        return await this.input.clearField(x, y, method);
    }

    async swipe(startX, startY, endX, endY, duration = 300) {
        this._checkInitialized();
        return await this.input.swipe(startX, startY, endX, endY, duration);
    }

    // Timing methods (délégation vers DelayManager)
    async wait(delayNameOrMs) {
        return await this.delays.wait(delayNameOrMs);
    }

    // ADB methods (délégation vers ADBConnection)
    async executeADB(command) {
        this._checkInitialized();
        return await this.adb.executeCommand(command);
    }

    /**
     * Méthodes étendues utilisant les nouveaux composants
     */

    // Utiliser les nouvelles fonctionnalités d'input
    async longPress(x, y, duration = 1000) {
        this._checkInitialized();
        return await this.input.longPress(x, y, duration);
    }

    async doubleClick(x, y) {
        this._checkInitialized();
        return await this.input.doubleClick(x, y);
    }

    async pressNamedKey(keyName) {
        this._checkInitialized();
        return await this.input.pressNamedKey(keyName);
    }

    // Utiliser les nouvelles fonctionnalités de timing
    async waitUntil(conditionFn, options = {}) {
        return await this.delays.waitUntil(conditionFn, options);
    }

    async retry(fn, options = {}) {
        return await this.delays.retry(fn, options);
    }

    async measure(fn, label) {
        return await this.delays.measure(fn, label);
    }

    /**
     * Nettoyage et fermeture
     */
    async cleanup() {
        try {
            if (this.adb && this.adb.isConnected()) {
                await this.adb.disconnect();
            }
            this.initialized = false;
            console.log('🧹 BlueStack Controller nettoyé');
        } catch (error) {
            console.warn(`⚠️ Erreur nettoyage: ${error.message}`);
        }
    }

    /**
     * Getters pour accès direct aux composants
     */
    getADB() {
        return this.adb;
    }

    getInputSimulator() {
        return this.input;
    }

    getDelayManager() {
        return this.delays;
    }

    isInitialized() {
        return this.initialized && this.adb.isConnected();
    }

    /**
     * Vérification interne d'initialisation
     */
    _checkInitialized() {
        if (!this.initialized || !this.adb.isConnected()) {
            throw new Error('BlueStack Controller non initialisé - appelez initialize() d\'abord');
        }
    }
}

module.exports = { BlueStackController }; 
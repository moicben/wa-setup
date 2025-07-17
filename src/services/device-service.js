/**
 * Device Service - Version simplifiée unifiée  
 * Fusion de DeviceService + BlueStackController + ADBConnection + InputSimulator
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Service Device unifié avec BlueStack/ADB
 */
class DeviceService {
    constructor(config = {}) {
        console.log(`[DIAG] In DeviceService constructor: passed config.deviceId = ${config.deviceId}, process.env.DEVICE_HOST = ${process.env.DEVICE_HOST}, process.env.DEVICE_PORT = ${process.env.DEVICE_PORT}`);
        // Remove redundant fallback
        // const defaultDeviceId = process.env.DEVICE_HOST || (process.env.DEVICE_PORT ? `127.0.0.1:${process.env.DEVICE_PORT}` : '127.0.0.1:5585');
        this.config = {
            deviceId: config.deviceId,  // Assume provided
            adbPath: config.adbPath || 'adb',
            ...config
        };

        this.deviceId = this.config.deviceId;
        this.adbPath = this.config.adbPath;
        this.deviceLabel = process.env.DEVICE_ID || 'Device1';
        this.isConnected = false;
        this.initialized = false;
        
        // Délais standards
        this.delays = {
            short: 500,
            medium: 1000,
            long: 2000,
            appLaunch: 3000,
            sms: 5000,
            network: 10000
        };

        this.metrics = {
            commandsExecuted: 0,
            successfulCommands: 0,
            failedCommands: 0,
            screenshotsTaken: 0
        };
    }

    /**
     * Initialiser le service device
     */
    async initialize() {
        try {
            console.log(`[${this.deviceLabel}] 🚀 Initialisation Device Service (${this.deviceId})...`);
            
            // Vérifier ADB
            await this._checkADB();
            
            // Connecter au device
            await this._connectDevice();
            
            // Vérifier le device
            const deviceInfo = await this._getDeviceInfo();
            console.log(`[${this.deviceLabel}] 📱 Device: ${deviceInfo.model || 'Unknown'} (Android ${deviceInfo.androidVersion || 'Unknown'})`);
            
            this.isConnected = true;
            this.initialized = true;
            console.log(`[${this.deviceLabel}] ✅ Device Service prêt`);
            
            return true;
        } catch (error) {
            this.isConnected = false;
            this.initialized = false;
            throw new Error(`Initialisation Device échouée: ${error.message}`);
        }
    }

    /**
     * Vérifier ADB
     */
    async _checkADB() {
        try {
            const result = await this._executeCommand('version');
            if (!result.stdout.includes('Android Debug Bridge')) {
                throw new Error('ADB non fonctionnel');
            }
            console.log(`[${this.deviceLabel}] ✅ ADB trouvé et fonctionnel`);
        } catch (error) {
            throw new Error(`ADB non disponible: ${error.message}`);
        }
    }

    /**
     * Connecter au device
     */
    async _connectDevice() {
        try {
            // Connecter au device
            if (this.deviceId !== 'emulator-5554' && this.deviceId.includes(':')) {
                await this._executeCommand(`connect ${this.deviceId}`);
                await this.wait(1000);
            }

            // Vérifier la connexion
            const devices = await this._executeCommand('devices');
            if (!devices.stdout.includes(this.deviceId)) {
                throw new Error(`Device ${this.deviceId} non trouvé dans la liste ADB`);
            }

            console.log(`[${this.deviceLabel}] ✅ Connecté au device ${this.deviceId}`);
        } catch (error) {
            throw new Error(`Connexion device échouée: ${error.message}`);
        }
    }

    /**
     * Obtenir les informations du device
     */
    async _getDeviceInfo() {
        try {
            const model = await this._executeShell('getprop ro.product.model');
            const androidVersion = await this._executeShell('getprop ro.build.version.release');
            
            return {
                model: model.stdout.trim(),
                androidVersion: androidVersion.stdout.trim(),
                deviceId: this.deviceId
            };
        } catch (error) {
            console.warn('⚠️ Impossible de récupérer les infos device');
            return { deviceId: this.deviceId };
        }
    }

    /**
     * Cliquer à une position
     */
    async click(x, y) {
        this._checkInitialized();
        
        try {
            console.log(`[${this.deviceLabel}] 👆 Clic (${x}, ${y})`);
            const result = await this._executeShell(`input tap ${x} ${y}`);
            this.recordMetric('click', true);
            await this.wait(this.delays.short);
            return true;
        } catch (error) {
            console.error(`❌ Erreur clic (${x}, ${y}): ${error.message}`);
            this.recordMetric('click', false);
            return false;
        }
    }

    /**
     * Saisir du texte
     */
    async inputText(text) {
        this._checkInitialized();
        
        try {
            // Échapper les caractères spéciaux
            const escapedText = text.replace(/[()&;\|<>"`'"]/g, '\\$&').replace(/ /g, '%s');
            console.log(`[${this.deviceLabel}] ⌨️ Saisie: ${text}`);
            
            const result = await this._executeShell(`input text "${escapedText}"`);
            this.recordMetric('inputText', true);
            await this.wait(this.delays.short);
            return true;
        } catch (error) {
            console.error(`❌ Erreur saisie: ${error.message}`);
            this.recordMetric('inputText', false);
            return false;
        }
    }

    /**
     * Appuyer sur une touche
     */
    async pressKey(keyCode) {
        this._checkInitialized();
        
        try {
            console.log(`[${this.deviceLabel}] 🔘 Touche: ${keyCode}`);
            
            // Convertir les noms de touches en codes
            const keyCodes = {
                'ENTER': 66,
                'BACK': 4,
                'HOME': 3,
                'MENU': 82,
                'VOLUME_UP': 24,
                'VOLUME_DOWN': 25,
                'POWER': 26,
                'DEL': 67,
                'BACKSPACE': 67
            };
            
            const code = keyCodes[keyCode] || keyCode;
            const result = await this._executeShell(`input keyevent ${code}`);
            this.recordMetric('pressKey', true);
            await this.wait(this.delays.short);
            return true;
        } catch (error) {
            console.error(`❌ Erreur touche ${keyCode}: ${error.message}`);
            this.recordMetric('pressKey', false);
            return false;
        }
    }

    /**
     * Effacer un champ
     */
    async clearField(x, y, method = 'select_all') {
        this._checkInitialized();
        
        try {
            console.log(`[${this.deviceLabel}] 🧹 Effacement champ (${x}, ${y})`);
            
            // Cliquer dans le champ
            await this.click(x, y);
            await this.wait(this.delays.short);
            
            if (method === 'select_all') {
                // Sélectionner tout et supprimer
                await this.pressKey(1); // Ctrl+A equivalent
                await this.wait(300);
                await this.pressKey('DEL');
            } else {
                // Méthode alternative: appuis répétés sur backspace
                for (let i = 0; i < 50; i++) {
                    await this.pressKey('BACKSPACE');
                    await this.wait(50);
                }
            }
            
            this.recordMetric('clearField', true);
            await this.wait(this.delays.short);
            return true;
        } catch (error) {
            console.error(`❌ Erreur effacement: ${error.message}`);
            this.recordMetric('clearField', false);
            return false;
        }
    }

    /**
     * Faire un swipe
     */
    async swipe(startX, startY, endX, endY, duration = 300) {
        this._checkInitialized();
        
        try {
            console.log(`[${this.deviceLabel}] 👆 Swipe (${startX},${startY}) → (${endX},${endY})`);
            const result = await this._executeShell(`input swipe ${startX} ${startY} ${endX} ${endY} ${duration}`);
            this.recordMetric('swipe', true);
            await this.wait(this.delays.short);
            return true;
        } catch (error) {
            console.error(`❌ Erreur swipe: ${error.message}`);
            this.recordMetric('swipe', false);
            return false;
        }
    }

    /**
     * Prendre une capture d'écran
     */
    async takeScreenshot(filename = null) {
        this._checkInitialized();
        
        try {
            const name = filename || `screenshot_${Date.now()}.png`;
            const devicePath = `/sdcard/${name}`;
            const localPath = `./screenshots/${name}`;
            
            // S'assurer que le dossier existe
            const screenshotDir = path.dirname(localPath);
            if (!fs.existsSync(screenshotDir)) {
                fs.mkdirSync(screenshotDir, { recursive: true });
            }
            
            // Capturer sur le device
            await this._executeShell(`screencap -p ${devicePath}`);
            
            // Télécharger vers local
            await this._executeCommand(`pull ${devicePath} ${localPath}`);
            
            // Nettoyer le device
            await this._executeShell(`rm ${devicePath}`);
            
            this.metrics.screenshotsTaken++;
            console.log(`[${this.deviceLabel}] 📸 Screenshot: ${localPath}`);
            return localPath;
        } catch (error) {
            console.error(`❌ Erreur screenshot: ${error.message}`);
            return null;
        }
    }

    /**
     * Lancer une application
     */
    async launchApp(packageName) {
        this._checkInitialized();
        
        try {
            console.log(`[${this.deviceLabel}] 📱 Lancement ${packageName}...`);
            
            // Forcer l'arrêt de l'app
            await this._executeShell(`am force-stop ${packageName}`);
            await this.wait(this.delays.short);
            
            // Lancer l'application
            await this._executeShell(`monkey -p ${packageName} -c android.intent.category.LAUNCHER 1`);
            await this.wait(this.delays.appLaunch);
            
            console.log(`[${this.deviceLabel}] ✅ ${packageName} lancé`);
            this.recordMetric('launchApp', true);
            return true;
        } catch (error) {
            console.error(`❌ Erreur lancement ${packageName}: ${error.message}`);
            this.recordMetric('launchApp', false);
            return false;
        }
    }

    /**
     * Arrêter une application
     */
    async killApp(packageName) {
        this._checkInitialized();
        
        try {
            console.log(`[${this.deviceLabel}] 🛑 Arrêt ${packageName}...`);
            await this._executeShell(`am force-stop ${packageName}`);
            console.log(`[${this.deviceLabel}] ✅ ${packageName} arrêté`);
            this.recordMetric('killApp', true);
            return true;
        } catch (error) {
            console.error(`❌ Erreur arrêt ${packageName}: ${error.message}`);
            this.recordMetric('killApp', false);
            return false;
        }
    }

    /**
     * Réinitialiser une application
     */
    async resetApp(packageName) {
        this._checkInitialized();
        
        try {
            console.log(`[${this.deviceLabel}] 🔄 Reset ${packageName}...`);
            
            // Arrêter l'app
            await this._executeShell(`am force-stop ${packageName}`);
            
            // Effacer les données
            await this._executeShell(`pm clear ${packageName}`);
            await this.wait(this.delays.medium);
            
            console.log(`[${this.deviceLabel}] ✅ ${packageName} réinitialisé`);
            this.recordMetric('resetApp', true);
            return true;
        } catch (error) {
            console.error(`❌ Erreur reset ${packageName}: ${error.message}`);
            this.recordMetric('resetApp', false);
            return false;
        }
    }

    /**
     * Attendre avec délai
     */
    async wait(delayNameOrMs) {
        let ms;
        
        if (typeof delayNameOrMs === 'string') {
            ms = this.delays[delayNameOrMs] || 1000;
        } else {
            ms = delayNameOrMs || 1000;
        }
        
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Obtenir le statut du device
     */
    async checkStatus() {
        try {
            if (!this.initialized) {
                return { connected: false, whatsappInstalled: false, error: 'Non initialisé' };
            }

            console.log(`[${this.deviceLabel}] 🔧 Vérification statut...`);
            
            // Test connexion
            const devices = await this._executeCommand('devices');
            const connected = devices.stdout.includes(this.deviceId);
            
            if (!connected) {
                return { connected: false, whatsappInstalled: false, error: 'Connexion ADB perdue' };
            }
            
            // Vérifier WhatsApp
            const result = await this._executeShell('pm list packages com.whatsapp');
            const whatsappInstalled = result.stdout.includes('com.whatsapp');
            
            console.log(`[${this.deviceLabel}] ✅ Connexion: OK`);
            console.log(`[${this.deviceLabel}] ${whatsappInstalled ? '✅' : '❌'} WhatsApp: ${whatsappInstalled ? 'Installé' : 'Manquant'}`);
            
            return { 
                connected: true, 
                whatsappInstalled,
                deviceInfo: await this._getDeviceInfo()
            };
        } catch (error) {
            console.error(`❌ Diagnostic échoué: ${error.message}`);
            return { connected: false, whatsappInstalled: false, error: error.message };
        }
    }

    /**
     * Vérifier les applications installées
     */
    async getInstalledApps() {
        this._checkInitialized();
        
        try {
            const result = await this._executeShell('pm list packages');
            const packages = result.stdout
                .split('\n')
                .filter(line => line.startsWith('package:'))
                .map(line => line.replace('package:', '').trim())
                .filter(pkg => pkg.length > 0);
            
            return packages;
        } catch (error) {
            console.error('❌ Erreur récupération apps:', error);
            return [];
        }
    }

    /**
     * Exécuter une commande ADB
     */
    async _executeCommand(command) {
        return new Promise((resolve, reject) => {
            // Ajouter -s deviceId si pas déjà présent pour éviter l'erreur "more than one device"
            const fullCommand = command.includes('-s') ? 
                `${this.adbPath} ${command}` : 
                `${this.adbPath} -s ${this.deviceId} ${command}`;
            const [cmd, ...args] = fullCommand.split(' ');
            
            const process = spawn(cmd, args);
            let stdout = '';
            let stderr = '';
            
            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            
            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            process.on('close', (code) => {
                this.metrics.commandsExecuted++;
                
                if (code === 0) {
                    this.metrics.successfulCommands++;
                    resolve({ stdout, stderr, code });
                } else {
                    this.metrics.failedCommands++;
                    reject(new Error(`Command failed (${code}): ${stderr || stdout}`));
                }
            });
            
            process.on('error', (error) => {
                this.metrics.commandsExecuted++;
                this.metrics.failedCommands++;
                reject(error);
            });
        });
    }

    /**
     * Exécuter une commande shell sur le device
     */
    async _executeShell(shellCommand) {
        return await this._executeCommand(`-s ${this.deviceId} shell ${shellCommand}`);
    }

    /**
     * Exécuter une commande ADB (méthode publique)
     */
    async executeADB(command) {
        this._checkInitialized();
        
        try {
            console.log(`[${this.deviceLabel}] 🔧 ADB: ${command}`);
            const result = await this._executeCommand(`-s ${this.deviceId} ${command}`);
            this.recordMetric('executeADB', true);
            return result;
        } catch (error) {
            console.error(`❌ Erreur ADB: ${error.message}`);
            this.recordMetric('executeADB', false);
            throw error;
        }
    }

    /**
     * Exécuter une commande shell (méthode publique)
     */
    async executeShell(shellCommand) {
        this._checkInitialized();
        
        try {
            console.log(`[${this.deviceLabel}] 🐚 Shell: ${shellCommand}`);
            const result = await this._executeShell(shellCommand);
            this.recordMetric('executeShell', true);
            return result;
        } catch (error) {
            console.error(`❌ Erreur Shell: ${error.message}`);
            this.recordMetric('executeShell', false);
            throw error;
        }
    }

    /**
     * Enregistrer une métrique
     */
    recordMetric(operation, success) {
        if (success) {
            this.metrics.successfulCommands++;
        } else {
            this.metrics.failedCommands++;
        }
        this.metrics.commandsExecuted++;
    }

    /**
     * Obtenir les métriques
     */
    getMetrics() {
        return {
            ...this.metrics,
            provider: 'bluestacks-adb',
            deviceId: this.deviceId,
            isConnected: this.isConnected,
            successRate: this.metrics.commandsExecuted > 0 ? 
                (this.metrics.successfulCommands / this.metrics.commandsExecuted) * 100 : 0
        };
    }

    /**
     * Vérifier l'initialisation
     */
    _checkInitialized() {
        if (!this.initialized || !this.isConnected) {
            throw new Error('Device Service non initialisé - appelez initialize() d\'abord');
        }
    }

    /**
     * Nettoyer les ressources
     */
    async cleanup(options = {}) {
        try {
            const { forceDisconnect = false } = options;
            
            if (forceDisconnect && this.isConnected) {
                // Déconnecter seulement si explicitement demandé
                if (this.deviceId.includes(':')) {
                    await this._executeCommand(`disconnect ${this.deviceId}`);
                }
                this.isConnected = false;
                this.initialized = false;
                console.log(`[${this.deviceLabel}] 🧹 Device Service déconnecté`);
            } else {
                // Nettoyage léger - garde la connexion active
                console.log(`[${this.deviceLabel}] 🧹 Device Service nettoyé (connexion maintenue)`);
            }
        } catch (error) {
            console.warn(`⚠️ Erreur nettoyage Device: ${error.message}`);
        }
    }

    /**
     * Reconnecter le device si nécessaire
     */
    async reconnectIfNeeded() {
        try {
            if (!this.initialized || !this.isConnected) {
                console.log(`[${this.deviceLabel}] 🔄 Reconnexion du device...`);
                await this.initialize();
                return true;
            }
            
            // Vérifier si la connexion est toujours active
            const devices = await this._executeCommand('devices');
            if (!devices.stdout.includes(this.deviceId)) {
                console.log(`[${this.deviceLabel}] 🔄 Connexion ADB perdue, reconnexion...`);
                await this._connectDevice();
                return true;
            }
            
            return false;
        } catch (error) {
            console.error(`❌ Erreur reconnexion: ${error.message}`);
            throw error;
        }
    }
}

/**
 * Factory functions pour compatibilité
 */
async function createBlueStacksDevice(config = {}) {
    const device = new DeviceService(config);
    await device.initialize();
    return device;
}

async function createDeviceProvider(config = {}) {
    return await createBlueStacksDevice(config);
}

module.exports = {
    DeviceService,
    createBlueStacksDevice,
    createDeviceProvider
};
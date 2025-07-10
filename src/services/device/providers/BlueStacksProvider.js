/**
 * BlueStacksProvider - Provider BlueStacks pour DeviceService
 * Phase 5: Services Unifiés
 * 
 * Adaptation du BlueStackController existant pour le DeviceService unifié
 */

const { DeviceService } = require('../DeviceService');
const { BlueStackController } = require('../../bluestack/BlueStackController');

class BlueStacksProvider extends DeviceService {
    constructor(config = {}) {
        super(config);
        this.bluestack = null;
        this.providerName = 'bluestacks';
    }

    /**
     * Initialiser le provider BlueStacks
     */
    async initialize() {
        try {
            console.log(`🔄 Initialisation BlueStacks (${this.deviceId})...`);
            
            this.bluestack = new BlueStackController({ 
                deviceId: this.deviceId 
            });
            
            await this.bluestack.initialize();
            this.isConnected = true;
            
            console.log(`✅ BlueStacks initialisé: ${this.deviceId}`);
            return true;
            
        } catch (error) {
            console.error(`❌ Erreur initialisation BlueStacks: ${error.message}`);
            this.isConnected = false;
            throw error;
        }
    }

    /**
     * Connecter au device BlueStacks
     */
    async connect() {
        const startTime = Date.now();
        
        try {
            if (!this.bluestack) {
                await this.initialize();
            }
            
            const status = await this.bluestack.checkStatus();
            this.isConnected = status.connected;
            
            this.recordMetric('connect', Date.now() - startTime, this.isConnected);
            return this.isConnected;
            
        } catch (error) {
            this.recordMetric('connect', Date.now() - startTime, false);
            console.error(`❌ Erreur connexion BlueStacks: ${error.message}`);
            return false;
        }
    }

    /**
     * Déconnecter du device BlueStacks
     */
    async disconnect() {
        const startTime = Date.now();
        
        try {
            if (this.bluestack) {
                await this.bluestack.disconnect();
            }
            
            this.isConnected = false;
            this.recordMetric('disconnect', Date.now() - startTime, true);
            return true;
            
        } catch (error) {
            this.recordMetric('disconnect', Date.now() - startTime, false);
            console.error(`❌ Erreur déconnexion BlueStacks: ${error.message}`);
            return false;
        }
    }

    /**
     * Cliquer à une position
     */
    async click(x, y) {
        const startTime = Date.now();
        
        try {
            if (!this.bluestack) {
                throw new Error('BlueStacks non initialisé');
            }
            
            await this.bluestack.click(x, y);
            this.recordMetric('click', Date.now() - startTime, true);
            return true;
            
        } catch (error) {
            this.recordMetric('click', Date.now() - startTime, false);
            console.error(`❌ Erreur clic BlueStacks: ${error.message}`);
            return false;
        }
    }

    /**
     * Saisir du texte
     */
    async inputText(text) {
        const startTime = Date.now();
        
        try {
            if (!this.bluestack) {
                throw new Error('BlueStacks non initialisé');
            }
            
            await this.bluestack.inputText(text);
            this.recordMetric('inputText', Date.now() - startTime, true);
            return true;
            
        } catch (error) {
            this.recordMetric('inputText', Date.now() - startTime, false);
            console.error(`❌ Erreur saisie texte BlueStacks: ${error.message}`);
            return false;
        }
    }

    /**
     * Prendre une capture d'écran
     */
    async takeScreenshot(filename) {
        const startTime = Date.now();
        
        try {
            if (!this.bluestack) {
                throw new Error('BlueStacks non initialisé');
            }
            
            const path = await this.bluestack.takeScreenshot(filename);
            this.recordMetric('takeScreenshot', Date.now() - startTime, true);
            return path;
            
        } catch (error) {
            this.recordMetric('takeScreenshot', Date.now() - startTime, false);
            console.error(`❌ Erreur capture BlueStacks: ${error.message}`);
            throw error;
        }
    }

    /**
     * Lancer une application
     */
    async launchApp(packageName) {
        const startTime = Date.now();
        
        try {
            if (!this.bluestack) {
                throw new Error('BlueStacks non initialisé');
            }
            
            await this.bluestack.launchApp(packageName);
            this.recordMetric('launchApp', Date.now() - startTime, true);
            return true;
            
        } catch (error) {
            this.recordMetric('launchApp', Date.now() - startTime, false);
            console.error(`❌ Erreur lancement app BlueStacks: ${error.message}`);
            return false;
        }
    }

    /**
     * Arrêter une application
     */
    async killApp(packageName) {
        const startTime = Date.now();
        
        try {
            if (!this.bluestack) {
                throw new Error('BlueStacks non initialisé');
            }
            
            await this.bluestack.killApp(packageName);
            this.recordMetric('killApp', Date.now() - startTime, true);
            return true;
            
        } catch (error) {
            this.recordMetric('killApp', Date.now() - startTime, false);
            console.error(`❌ Erreur arrêt app BlueStacks: ${error.message}`);
            return false;
        }
    }

    /**
     * Réinitialiser une application
     */
    async resetApp(packageName) {
        const startTime = Date.now();
        
        try {
            if (!this.bluestack) {
                throw new Error('BlueStacks non initialisé');
            }
            
            await this.bluestack.resetApp(packageName);
            this.recordMetric('resetApp', Date.now() - startTime, true);
            return true;
            
        } catch (error) {
            this.recordMetric('resetApp', Date.now() - startTime, false);
            console.error(`❌ Erreur reset app BlueStacks: ${error.message}`);
            return false;
        }
    }

    /**
     * Obtenir le statut du device
     */
    async getStatus() {
        const startTime = Date.now();
        
        try {
            if (!this.bluestack) {
                throw new Error('BlueStacks non initialisé');
            }
            
            const status = await this.bluestack.checkStatus();
            this.recordMetric('getStatus', Date.now() - startTime, true);
            
            return {
                success: true,
                connected: status.connected,
                whatsappInstalled: status.whatsappInstalled,
                deviceId: this.deviceId,
                provider: this.providerName,
                ...status
            };
            
        } catch (error) {
            this.recordMetric('getStatus', Date.now() - startTime, false);
            return {
                success: false,
                connected: false,
                error: error.message,
                provider: this.providerName
            };
        }
    }

    /**
     * Vérifier les applications installées
     */
    async getInstalledApps() {
        const startTime = Date.now();
        
        try {
            if (!this.bluestack) {
                throw new Error('BlueStacks non initialisé');
            }
            
            // Utiliser les méthodes du BlueStackController pour lister les apps
            const apps = await this.bluestack.getInstalledApps();
            this.recordMetric('getInstalledApps', Date.now() - startTime, true);
            
            return apps;
            
        } catch (error) {
            this.recordMetric('getInstalledApps', Date.now() - startTime, false);
            console.error(`❌ Erreur liste apps BlueStacks: ${error.message}`);
            return [];
        }
    }

    /**
     * Méthodes spécifiques BlueStacks (délégation)
     */
    async swipe(startX, startY, endX, endY) {
        const startTime = Date.now();
        
        try {
            if (!this.bluestack) {
                throw new Error('BlueStacks non initialisé');
            }
            
            await this.bluestack.swipe(startX, startY, endX, endY);
            this.recordMetric('swipe', Date.now() - startTime, true);
            return true;
            
        } catch (error) {
            this.recordMetric('swipe', Date.now() - startTime, false);
            console.error(`❌ Erreur swipe BlueStacks: ${error.message}`);
            return false;
        }
    }

    async pressKey(key) {
        const startTime = Date.now();
        
        try {
            if (!this.bluestack) {
                throw new Error('BlueStacks non initialisé');
            }
            
            await this.bluestack.pressKey(key);
            this.recordMetric('pressKey', Date.now() - startTime, true);
            return true;
            
        } catch (error) {
            this.recordMetric('pressKey', Date.now() - startTime, false);
            console.error(`❌ Erreur touche BlueStacks: ${error.message}`);
            return false;
        }
    }

    /**
     * Obtenir l'instance BlueStackController sous-jacente
     * @returns {BlueStackController} Instance du controller
     */
    getBlueStackController() {
        return this.bluestack;
    }

    /**
     * Nettoyer les ressources BlueStacks
     */
    async cleanup() {
        try {
            if (this.bluestack) {
                await this.bluestack.cleanup();
            }
            
            await super.cleanup();
            console.log(`🧹 BlueStacks nettoyé: ${this.deviceId}`);
            
        } catch (error) {
            console.error(`❌ Erreur nettoyage BlueStacks: ${error.message}`);
        }
    }
}

module.exports = { BlueStacksProvider };
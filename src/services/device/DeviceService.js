/**
 * DeviceService - Service Device unifié
 * Phase 5: Services Unifiés
 * 
 * Service abstrait pour unifier tous les providers de devices
 * Permet de switcher entre BlueStacks, Emulateurs, etc.
 */

/**
 * Interface abstraite pour tous les providers de devices
 */
class DeviceService {
    constructor(config = {}) {
        this.config = config;
        this.deviceId = config.deviceId || '127.0.0.1:5585';
        this.isConnected = false;
        this.metrics = {
            commandsExecuted: 0,
            successfulCommands: 0,
            failedCommands: 0,
            averageResponseTime: 0
        };
    }

    /**
     * Initialiser le service device
     */
    async initialize() {
        throw new Error('initialize() must be implemented by provider');
    }

    /**
     * Connecter au device
     * @returns {Promise<boolean>} Succès de la connexion
     */
    async connect() {
        throw new Error('connect() must be implemented by provider');
    }

    /**
     * Déconnecter du device
     * @returns {Promise<boolean>} Succès de la déconnexion
     */
    async disconnect() {
        throw new Error('disconnect() must be implemented by provider');
    }

    /**
     * Cliquer à une position
     * @param {number} x - Position X
     * @param {number} y - Position Y
     * @returns {Promise<boolean>} Succès du clic
     */
    async click(x, y) {
        throw new Error('click() must be implemented by provider');
    }

    /**
     * Saisir du texte
     * @param {string} text - Texte à saisir
     * @returns {Promise<boolean>} Succès de la saisie
     */
    async inputText(text) {
        throw new Error('inputText() must be implemented by provider');
    }

    /**
     * Prendre une capture d'écran
     * @param {string} filename - Nom du fichier
     * @returns {Promise<string>} Chemin du fichier
     */
    async takeScreenshot(filename) {
        throw new Error('takeScreenshot() must be implemented by provider');
    }

    /**
     * Lancer une application
     * @param {string} packageName - Package de l'app
     * @returns {Promise<boolean>} Succès du lancement
     */
    async launchApp(packageName) {
        throw new Error('launchApp() must be implemented by provider');
    }

    /**
     * Arrêter une application
     * @param {string} packageName - Package de l'app
     * @returns {Promise<boolean>} Succès de l'arrêt
     */
    async killApp(packageName) {
        throw new Error('killApp() must be implemented by provider');
    }

    /**
     * Réinitialiser une application
     * @param {string} packageName - Package de l'app
     * @returns {Promise<boolean>} Succès de la réinitialisation
     */
    async resetApp(packageName) {
        throw new Error('resetApp() must be implemented by provider');
    }

    /**
     * Attendre avec délai
     * @param {number} ms - Délai en millisecondes
     * @returns {Promise<void>}
     */
    async wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Obtenir le statut du device
     * @returns {Promise<Object>} Statut actuel
     */
    async getStatus() {
        throw new Error('getStatus() must be implemented by provider');
    }

    /**
     * Vérifier les applications installées
     * @returns {Promise<Array>} Liste des apps installées
     */
    async getInstalledApps() {
        throw new Error('getInstalledApps() must be implemented by provider');
    }

    /**
     * Obtenir les métriques du provider
     * @returns {Object} Métriques de performance
     */
    getMetrics() {
        return {
            ...this.metrics,
            provider: this.constructor.name,
            deviceId: this.deviceId,
            isConnected: this.isConnected,
            successRate: this.metrics.commandsExecuted > 0 ? 
                (this.metrics.successfulCommands / this.metrics.commandsExecuted) * 100 : 0
        };
    }

    /**
     * Enregistrer une métrique
     * @param {string} command - Commande exécutée
     * @param {number} duration - Durée en ms
     * @param {boolean} success - Succès/échec
     */
    recordMetric(command, duration, success) {
        this.metrics.commandsExecuted++;
        if (success) {
            this.metrics.successfulCommands++;
        } else {
            this.metrics.failedCommands++;
        }
        
        // Mise à jour temps de réponse moyen
        this.metrics.averageResponseTime = 
            (this.metrics.averageResponseTime + duration) / 2;
    }

    /**
     * Nettoyer les ressources
     */
    async cleanup() {
        if (this.isConnected) {
            await this.disconnect();
        }
    }
}

/**
 * Factory pour créer les instances de providers Device
 */
class DeviceServiceFactory {
    static providers = new Map();

    /**
     * Enregistrer un provider
     * @param {string} name - Nom du provider
     * @param {class} providerClass - Classe du provider
     */
    static registerProvider(name, providerClass) {
        this.providers.set(name, providerClass);
    }

    /**
     * Créer une instance de provider
     * @param {string} providerName - Nom du provider (bluestacks, genymotion, etc.)
     * @param {Object} config - Configuration du provider
     * @returns {DeviceService} Instance du provider
     */
    static createProvider(providerName, config = {}) {
        const ProviderClass = this.providers.get(providerName);
        
        if (!ProviderClass) {
            throw new Error(`Provider Device '${providerName}' not found. Available: ${Array.from(this.providers.keys()).join(', ')}`);
        }

        return new ProviderClass(config);
    }

    /**
     * Obtenir la liste des providers disponibles
     * @returns {Array} Liste des noms de providers
     */
    static getAvailableProviders() {
        return Array.from(this.providers.keys());
    }
}

/**
 * Pool de devices pour gérer plusieurs instances
 */
class DevicePool {
    constructor(config = {}) {
        this.config = config;
        this.devices = new Map();
        this.activeDevices = new Set();
        this.maxDevices = config.maxDevices || 5;
        this.metrics = {
            totalDevices: 0,
            activeDevices: 0,
            createdDevices: 0,
            destroyedDevices: 0
        };
    }

    /**
     * Créer un device dans le pool
     * @param {string} deviceId - ID unique du device
     * @param {string} providerName - Nom du provider
     * @param {Object} config - Configuration
     * @returns {Promise<DeviceService>} Instance du device
     */
    async createDevice(deviceId, providerName, config = {}) {
        if (this.devices.has(deviceId)) {
            throw new Error(`Device ${deviceId} already exists`);
        }

        if (this.devices.size >= this.maxDevices) {
            throw new Error(`Maximum devices reached (${this.maxDevices})`);
        }

        const device = DeviceServiceFactory.createProvider(providerName, {
            ...config,
            deviceId
        });

        await device.initialize();
        
        this.devices.set(deviceId, device);
        this.activeDevices.add(deviceId);
        this.metrics.totalDevices++;
        this.metrics.createdDevices++;
        this.metrics.activeDevices = this.activeDevices.size;

        console.log(`📱 Device créé: ${deviceId} (${providerName})`);
        return device;
    }

    /**
     * Obtenir un device du pool
     * @param {string} deviceId - ID du device
     * @returns {DeviceService|null} Instance du device ou null
     */
    getDevice(deviceId) {
        return this.devices.get(deviceId) || null;
    }

    /**
     * Obtenir le premier device disponible
     * @returns {DeviceService|null} Premier device disponible
     */
    getAvailableDevice() {
        for (const deviceId of this.activeDevices) {
            const device = this.devices.get(deviceId);
            if (device && device.isConnected) {
                return device;
            }
        }
        return null;
    }

    /**
     * Détruire un device
     * @param {string} deviceId - ID du device
     * @returns {Promise<boolean>} Succès de la destruction
     */
    async destroyDevice(deviceId) {
        const device = this.devices.get(deviceId);
        if (!device) {
            return false;
        }

        await device.cleanup();
        this.devices.delete(deviceId);
        this.activeDevices.delete(deviceId);
        this.metrics.destroyedDevices++;
        this.metrics.activeDevices = this.activeDevices.size;

        console.log(`🗑️ Device détruit: ${deviceId}`);
        return true;
    }

    /**
     * Obtenir les métriques du pool
     * @returns {Object} Métriques du pool
     */
    getMetrics() {
        return {
            pool: this.metrics,
            devices: Array.from(this.devices.entries()).map(([id, device]) => ({
                id,
                metrics: device.getMetrics()
            }))
        };
    }

    /**
     * Nettoyer tous les devices
     */
    async cleanup() {
        for (const [deviceId] of this.devices) {
            await this.destroyDevice(deviceId);
        }
    }
}

module.exports = {
    DeviceService,
    DeviceServiceFactory,
    DevicePool
};
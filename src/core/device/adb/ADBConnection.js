/**
 * Gestionnaire de connexion ADB
 * Module extrait de bluestack.js pour une architecture modulaire
 */

const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

class ADBConnection {
    constructor(config = {}) {
        this.deviceId = config.deviceId || '127.0.0.1:5585';
        this.adbPath = config.adbPath || 'adb';
        this.connected = false;
    }

    /**
     * Initialiser la connexion ADB
     */
    async initialize() {
        try {
            console.log('🔌 Connexion ADB...');
            
            // Vérifier ADB disponible
            await execAsync(`${this.adbPath} version`);
            
            // Connecter au device
            await execAsync(`${this.adbPath} connect ${this.deviceId}`);
            
            // Vérifier la connexion
            const { stdout } = await execAsync(`${this.adbPath} devices`);
            if (!stdout.includes(this.deviceId)) {
                throw new Error(`Device ${this.deviceId} non trouvé`);
            }
            
            this.connected = true;
            console.log(`✅ ADB connecté à ${this.deviceId}`);
            
            return true;
        } catch (error) {
            this.connected = false;
            throw new Error(`Connexion ADB échouée: ${error.message}`);
        }
    }

    /**
     * Exécuter une commande ADB brute
     */
    async executeCommand(command) {
        if (!this.connected) {
            throw new Error('ADB non connecté - appelez initialize() d\'abord');
        }
        
        try {
            const fullCommand = `${this.adbPath} -s ${this.deviceId} ${command}`;
            return await execAsync(fullCommand);
        } catch (error) {
            throw new Error(`Commande ADB échouée: ${error.message}`);
        }
    }

    /**
     * Vérifier l'état de la connexion
     */
    async checkConnection() {
        try {
            const result = await this.executeCommand('shell echo "OK"');
            return result.stdout.trim() === 'OK';
        } catch (error) {
            this.connected = false;
            return false;
        }
    }

    /**
     * Déconnecter ADB
     */
    async disconnect() {
        try {
            if (this.connected) {
                await execAsync(`${this.adbPath} disconnect ${this.deviceId}`);
                this.connected = false;
                console.log('✅ ADB déconnecté');
            }
        } catch (error) {
            console.warn(`⚠️ Erreur déconnexion ADB: ${error.message}`);
        }
    }

    /**
     * Obtenir les informations du device
     */
    async getDeviceInfo() {
        try {
            const model = await this.executeCommand('shell getprop ro.product.model');
            const version = await this.executeCommand('shell getprop ro.build.version.release');
            const api = await this.executeCommand('shell getprop ro.build.version.sdk');
            
            return {
                deviceId: this.deviceId,
                model: model.stdout.trim(),
                androidVersion: version.stdout.trim(),
                apiLevel: parseInt(api.stdout.trim()),
                connected: this.connected
            };
        } catch (error) {
            throw new Error(`Impossible d'obtenir les infos device: ${error.message}`);
        }
    }

    /**
     * Getter pour l'état de connexion
     */
    isConnected() {
        return this.connected;
    }

    /**
     * Getter pour le device ID
     */
    getDeviceId() {
        return this.deviceId;
    }
}

module.exports = { ADBConnection }; 
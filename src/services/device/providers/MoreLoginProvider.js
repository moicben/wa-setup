/**
 * MoreLoginProvider - Provider Device pour MoreLogin
 * Étend DeviceService pour gérer les profils cloud MoreLogin
 */

const { DeviceService } = require('../DeviceService');
const { MoreLoginApiClient } = require('./MoreLoginApiClient');
const { CloudPhoneManager } = require('../../../cloud/cloud-phone-manager');

class MoreLoginProvider extends DeviceService {
    constructor(config = {}) {
        super(config);
        
        this.apiClient = new MoreLoginApiClient(config);
        this.cloudPhoneManager = new CloudPhoneManager(config);
        
        // État du profil
        this.profileId = null;
        this.profileInfo = null;
        this.cloudPhone = null;
        this.adbPort = null;
        
        // Métriques spécifiques MoreLogin
        this.moreLoginMetrics = {
            profilesCreated: 0,
            profilesDestroyed: 0,
            apiCalls: 0,
            cloudAllocations: 0,
            connectionTime: 0
        };
    }

    /**
     * Initialiser le provider MoreLogin
     */
    async initialize() {
        try {
            console.log('🌥️ Initialisation MoreLoginProvider...');
            
            // Vérifier la santé de l'API
            const health = await this.apiClient.healthCheck();
            if (health.status !== 'healthy') {
                throw new Error(`API MoreLogin non disponible: ${health.error}`);
            }
            
            // Initialiser le CloudPhoneManager
            await this.cloudPhoneManager.initialize();
            
            console.log('✅ MoreLoginProvider initialisé avec succès');
            return true;
            
        } catch (error) {
            console.error(`❌ Erreur initialisation MoreLoginProvider: ${error.message}`);
            throw error;
        }
    }

    /**
     * Connecter au profile cloud MoreLogin
     */
    async connect() {
        try {
            const startTime = Date.now();
            console.log('🔗 Connexion au profil cloud MoreLogin...');
            
            // Étape 1: Allouer un téléphone cloud
            await this.allocateCloudPhone();
            
            // Étape 2: Créer le profil MoreLogin
            await this.createProfile();
            
            // Étape 3: Démarrer le profil
            await this.startProfile();
            
            // Étape 4: Configurer la connexion ADB
            await this.setupAdbConnection();
            
            this.isConnected = true;
            this.moreLoginMetrics.connectionTime = Date.now() - startTime;
            
            console.log(`✅ Connexion établie - Profil: ${this.profileId}, Port ADB: ${this.adbPort}`);
            return true;
            
        } catch (error) {
            console.error(`❌ Erreur connexion: ${error.message}`);
            await this.cleanup();
            throw error;
        }
    }

    /**
     * Déconnecter du profil cloud
     */
    async disconnect() {
        try {
            console.log('🔌 Déconnexion du profil cloud...');
            
            if (this.profileId) {
                await this.stopProfile();
                await this.deleteProfile();
            }
            
            if (this.cloudPhone) {
                await this.releaseCloudPhone();
            }
            
            this.isConnected = false;
            
            console.log('✅ Déconnexion réussie');
            return true;
            
        } catch (error) {
            console.error(`❌ Erreur déconnexion: ${error.message}`);
            throw error;
        }
    }

    /**
     * Allouer un téléphone cloud
     */
    async allocateCloudPhone() {
        try {
            console.log('📱 Allocation téléphone cloud...');
            
            // Utiliser le CloudPhoneManager existant
            this.cloudPhone = await this.cloudPhoneManager.allocateProfile(
                this.config.country || 'UK',
                {
                    whatsappCapable: true,
                    androidVersion: '10+',
                    provider: 'morelogin'
                }
            );
            
            this.moreLoginMetrics.cloudAllocations++;
            
            console.log(`✅ Téléphone cloud alloué: ${this.cloudPhone.profileId}`);
            
        } catch (error) {
            console.error(`❌ Erreur allocation téléphone cloud: ${error.message}`);
            throw error;
        }
    }

    /**
     * Libérer le téléphone cloud
     */
    async releaseCloudPhone() {
        try {
            if (this.cloudPhone) {
                console.log('🔄 Libération téléphone cloud...');
                
                await this.cloudPhoneManager.releaseProfile(this.cloudPhone.profileId);
                this.cloudPhone = null;
                
                console.log('✅ Téléphone cloud libéré');
            }
            
        } catch (error) {
            console.error(`❌ Erreur libération téléphone cloud: ${error.message}`);
            throw error;
        }
    }

    /**
     * Créer le profil MoreLogin
     */
    async createProfile() {
        try {
            console.log('🏗️ Création profil MoreLogin...');
            
            const profileData = {
                name: `WhatsApp-${Date.now()}`,
                platform: 'android',
                country: this.config.country || 'UK',
                proxy: this.cloudPhone?.proxy,
                phoneNumber: this.cloudPhone?.phoneNumber,
                androidVersion: '10.0',
                deviceModel: 'Samsung Galaxy S10',
                tags: ['whatsapp', 'automation']
            };
            
            const response = await this.apiClient.createProfile(profileData);
            
            this.profileId = response.profileId || response.id;
            this.profileInfo = response;
            this.moreLoginMetrics.profilesCreated++;
            this.moreLoginMetrics.apiCalls++;
            
            console.log(`✅ Profil créé: ${this.profileId}`);
            
        } catch (error) {
            console.error(`❌ Erreur création profil: ${error.message}`);
            throw error;
        }
    }

    /**
     * Supprimer le profil MoreLogin
     */
    async deleteProfile() {
        try {
            if (this.profileId) {
                console.log(`🗑️ Suppression profil ${this.profileId}...`);
                
                await this.apiClient.deleteProfile(this.profileId);
                
                this.profileId = null;
                this.profileInfo = null;
                this.moreLoginMetrics.profilesDestroyed++;
                this.moreLoginMetrics.apiCalls++;
                
                console.log('✅ Profil supprimé');
            }
            
        } catch (error) {
            console.error(`❌ Erreur suppression profil: ${error.message}`);
            throw error;
        }
    }

    /**
     * Démarrer le profil MoreLogin
     */
    async startProfile() {
        try {
            console.log(`🚀 Démarrage profil ${this.profileId}...`);
            
            const startInfo = await this.apiClient.startProfile(this.profileId);
            
            this.adbPort = startInfo.adbPort || 5555;
            this.deviceId = `127.0.0.1:${this.adbPort}`;
            this.moreLoginMetrics.apiCalls++;
            
            console.log(`✅ Profil démarré - Port ADB: ${this.adbPort}`);
            
        } catch (error) {
            console.error(`❌ Erreur démarrage profil: ${error.message}`);
            throw error;
        }
    }

    /**
     * Arrêter le profil MoreLogin
     */
    async stopProfile() {
        try {
            if (this.profileId) {
                console.log(`🛑 Arrêt profil ${this.profileId}...`);
                
                await this.apiClient.stopProfile(this.profileId);
                this.moreLoginMetrics.apiCalls++;
                
                console.log('✅ Profil arrêté');
            }
            
        } catch (error) {
            console.error(`❌ Erreur arrêt profil: ${error.message}`);
            throw error;
        }
    }

    /**
     * Configurer la connexion ADB
     */
    async setupAdbConnection() {
        try {
            console.log('🔧 Configuration connexion ADB...');
            
            // Attendre que le profil soit complètement démarré
            await this.wait(2000);
            
            // Vérifier la connexion ADB
            const status = await this.getStatus();
            if (!status.connected) {
                throw new Error('Connexion ADB non établie');
            }
            
            console.log('✅ Connexion ADB configurée');
            
        } catch (error) {
            console.error(`❌ Erreur configuration ADB: ${error.message}`);
            throw error;
        }
    }

    /**
     * Cliquer à une position
     */
    async click(x, y) {
        try {
            this.checkConnection();
            
            const startTime = Date.now();
            
            // Simuler un clic ADB (à adapter selon votre implémentation ADB)
            console.log(`👆 Clic à (${x}, ${y})`);
            
            // Vous pouvez utiliser votre logique ADB existante ici
            // Par exemple: await this.executeAdbCommand(`input tap ${x} ${y}`);
            
            const duration = Date.now() - startTime;
            this.recordMetric('click', duration, true);
            
            return true;
            
        } catch (error) {
            this.recordMetric('click', 0, false);
            throw error;
        }
    }

    /**
     * Saisir du texte
     */
    async inputText(text) {
        try {
            this.checkConnection();
            
            const startTime = Date.now();
            
            console.log(`⌨️ Saisie texte: "${text}"`);
            
            // Simuler la saisie ADB
            // await this.executeAdbCommand(`input text "${text}"`);
            
            const duration = Date.now() - startTime;
            this.recordMetric('inputText', duration, true);
            
            return true;
            
        } catch (error) {
            this.recordMetric('inputText', 0, false);
            throw error;
        }
    }

    /**
     * Prendre une capture d'écran
     */
    async takeScreenshot(filename) {
        try {
            this.checkConnection();
            
            const startTime = Date.now();
            
            console.log(`📸 Capture d'écran: ${filename}`);
            
            // Simuler la capture d'écran ADB
            // await this.executeAdbCommand(`screencap -p /sdcard/${filename}`);
            // await this.executeAdbCommand(`pull /sdcard/${filename} ./screenshots/${filename}`);
            
            const duration = Date.now() - startTime;
            this.recordMetric('screenshot', duration, true);
            
            return `./screenshots/${filename}`;
            
        } catch (error) {
            this.recordMetric('screenshot', 0, false);
            throw error;
        }
    }

    /**
     * Lancer une application
     */
    async launchApp(packageName) {
        try {
            this.checkConnection();
            
            const startTime = Date.now();
            
            console.log(`🚀 Lancement app: ${packageName}`);
            
            // Simuler le lancement ADB
            // await this.executeAdbCommand(`am start -n ${packageName}`);
            
            const duration = Date.now() - startTime;
            this.recordMetric('launchApp', duration, true);
            
            return true;
            
        } catch (error) {
            this.recordMetric('launchApp', 0, false);
            throw error;
        }
    }

    /**
     * Arrêter une application
     */
    async killApp(packageName) {
        try {
            this.checkConnection();
            
            const startTime = Date.now();
            
            console.log(`🛑 Arrêt app: ${packageName}`);
            
            // Simuler l'arrêt ADB
            // await this.executeAdbCommand(`am force-stop ${packageName}`);
            
            const duration = Date.now() - startTime;
            this.recordMetric('killApp', duration, true);
            
            return true;
            
        } catch (error) {
            this.recordMetric('killApp', 0, false);
            throw error;
        }
    }

    /**
     * Obtenir le statut du device
     */
    async getStatus() {
        try {
            let profileStatus = null;
            
            if (this.profileId) {
                profileStatus = await this.apiClient.getProfileStatus(this.profileId);
                this.moreLoginMetrics.apiCalls++;
            }
            
            return {
                connected: this.isConnected,
                profileId: this.profileId,
                deviceId: this.deviceId,
                adbPort: this.adbPort,
                profileStatus: profileStatus?.status || 'unknown',
                cloudPhone: this.cloudPhone?.profileId || null
            };
            
        } catch (error) {
            console.error(`❌ Erreur getStatus: ${error.message}`);
            return {
                connected: false,
                error: error.message
            };
        }
    }

    /**
     * Obtenir les métriques du provider
     */
    getMetrics() {
        const baseMetrics = super.getMetrics();
        const apiMetrics = this.apiClient.getMetrics();
        
        return {
            ...baseMetrics,
            morelogin: this.moreLoginMetrics,
            api: apiMetrics,
            provider: 'MoreLogin',
            profileId: this.profileId,
            cloudPhone: this.cloudPhone?.profileId || null
        };
    }

    /**
     * Vérifier la connexion
     */
    checkConnection() {
        if (!this.isConnected) {
            throw new Error('Provider MoreLogin non connecté - appelez connect() d\'abord');
        }
    }

    /**
     * Nettoyer les ressources
     */
    async cleanup() {
        try {
            console.log('🧹 Nettoyage MoreLoginProvider...');
            
            if (this.isConnected) {
                await this.disconnect();
            }
            
            // Nettoyer le CloudPhoneManager
            if (this.cloudPhoneManager) {
                await this.cloudPhoneManager.cleanup();
            }
            
            console.log('✅ Nettoyage terminé');
            
        } catch (error) {
            console.error(`❌ Erreur nettoyage: ${error.message}`);
        }
    }
}

module.exports = { MoreLoginProvider };
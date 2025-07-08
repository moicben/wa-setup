/**
 * MoreLoginStep - Étape de workflow pour intégration cloud phones
 * Hérite de BaseStep et intègre CloudPhoneManager, ProfileManager et ProxyRotator
 */

const { BaseStep } = require('../base/BaseStep');
const { CloudPhoneManager, ProfileManager, ProxyRotator } = require('../../cloud');

class MoreLoginStep extends BaseStep {
    constructor(name = 'MoreLogin Cloud Setup', dependencies = []) {
        super(name, dependencies);
        
        // Modules cloud
        this.cloudPhoneManager = null;
        this.profileManager = null;
        this.proxyRotator = null;
        
        // Configuration
        this.config = {
            enableCloudPhones: true,
            enableProfileRotation: true,
            enableProxyRotation: true,
            country: 'UK',
            profileTimeout: 30000,
            proxyTimeout: 10000
        };
        
        // État cloud
        this.cloudState = {
            profileId: null,
            profileAllocated: false,
            proxyId: null,
            proxyAllocated: false,
            cloudPhoneId: null,
            cloudPhoneAllocated: false
        };
    }

    /**
     * Exécuter l'étape d'initialisation cloud
     */
    async _execute(context) {
        try {
            console.log('🌥️ Initialisation environnement cloud MoreLogin...');
            
            // Étape 1: Initialiser les gestionnaires cloud
            await this._initializeCloudManagers(context);
            
            // Étape 2: Allouer un profil cloud
            const profileAllocation = await this._allocateProfile(context);
            
            // Étape 3: Allouer un proxy géolocalisé
            const proxyAllocation = await this._allocateProxy(context);
            
            // Étape 4: Allouer un téléphone cloud
            const cloudPhoneAllocation = await this._allocateCloudPhone(context);
            
            // Étape 5: Configurer l'environnement cloud
            await this._configureCloudEnvironment(context, {
                profile: profileAllocation,
                proxy: proxyAllocation,
                cloudPhone: cloudPhoneAllocation
            });
            
            // Étape 6: Valider la configuration
            await this._validateCloudConfiguration(context);
            
            const result = {
                success: true,
                profile: profileAllocation,
                proxy: proxyAllocation,
                cloudPhone: cloudPhoneAllocation,
                metrics: this._getMetrics(),
                timestamp: Date.now()
            };
            
            console.log('✅ Environnement cloud MoreLogin configuré');
            return result;
            
        } catch (error) {
            // Nettoyage en cas d'erreur
            await this._cleanupCloudResources();
            throw error;
        }
    }

    /**
     * Initialiser les gestionnaires cloud
     */
    async _initializeCloudManagers(context) {
        try {
            console.log('🔧 Initialisation gestionnaires cloud...');
            
            // Configuration depuis le contexte
            const config = {
                ...this.config,
                country: context.getCountry(),
                apiKey: context.config.moreLoginApiKey || process.env.MORELOGIN_API_KEY
            };

            // Initialiser CloudPhoneManager
            if (config.enableCloudPhones) {
                this.cloudPhoneManager = new CloudPhoneManager({
                    apiKey: config.apiKey,
                    maxConcurrentProfiles: 5,
                    profileTimeout: config.profileTimeout
                });
                
                await this.cloudPhoneManager.initialize();
                console.log('✅ CloudPhoneManager initialisé');
            }

            // Initialiser ProfileManager
            if (config.enableProfileRotation) {
                this.profileManager = new ProfileManager({
                    profilesPath: './profiles',
                    maxProfilesPerAccount: 3,
                    encryptionKey: process.env.PROFILE_ENCRYPTION_KEY
                });
                
                await this.profileManager.initialize();
                console.log('✅ ProfileManager initialisé');
            }

            // Initialiser ProxyRotator
            if (config.enableProxyRotation) {
                this.proxyRotator = new ProxyRotator({
                    timeout: config.proxyTimeout,
                    allowedCountries: [config.country]
                });
                
                await this.proxyRotator.initialize();
                console.log('✅ ProxyRotator initialisé');
            }
            
        } catch (error) {
            throw new Error(`Initialisation gestionnaires cloud échouée: ${error.message}`);
        }
    }

    /**
     * Allouer un profil cloud
     */
    async _allocateProfile(context) {
        try {
            if (!this.config.enableProfileRotation || !this.profileManager) {
                return null;
            }
            
            console.log('👤 Allocation profil cloud...');
            
            const accountId = context.session.accountId || `account_${Date.now()}`;
            const country = context.getCountry();
            
            // Chercher un profil existant
            let profile = await this.profileManager.getCurrentProfile(accountId);
            
            if (!profile) {
                // Créer un nouveau profil
                profile = await this.profileManager.createProfile(accountId, country, {
                    workflow: 'whatsapp-automation',
                    session: context.session
                });
            }
            
            // Activer le profil
            await this.profileManager.activateProfile(profile.id);
            
            this.cloudState.profileId = profile.id;
            this.cloudState.profileAllocated = true;
            
            console.log(`✅ Profil ${profile.id} alloué pour ${accountId}`);
            return profile;
            
        } catch (error) {
            throw new Error(`Allocation profil échouée: ${error.message}`);
        }
    }

    /**
     * Allouer un proxy géolocalisé
     */
    async _allocateProxy(context) {
        try {
            if (!this.config.enableProxyRotation || !this.proxyRotator) {
                return null;
            }
            
            console.log('🌐 Allocation proxy géolocalisé...');
            
            const country = context.getCountry();
            const proxy = await this.proxyRotator.getProxy(country);
            
            if (!proxy) {
                throw new Error(`Aucun proxy ${country} disponible`);
            }
            
            // Valider la géolocalisation
            const geoValidation = await this.proxyRotator.validateProxyGeolocation(proxy);
            
            if (!geoValidation.isValid) {
                console.warn(`⚠️ Proxy ${proxy.id} géolocalisation invalide, rotation...`);
                await this.proxyRotator.rotateProxy(country);
                return await this._allocateProxy(context);
            }
            
            this.cloudState.proxyId = proxy.id;
            this.cloudState.proxyAllocated = true;
            
            console.log(`✅ Proxy ${proxy.id} alloué (${proxy.expectedCountry}, ${geoValidation.responseTime}ms)`);
            return proxy;
            
        } catch (error) {
            throw new Error(`Allocation proxy échouée: ${error.message}`);
        }
    }

    /**
     * Allouer un téléphone cloud
     */
    async _allocateCloudPhone(context) {
        try {
            if (!this.config.enableCloudPhones || !this.cloudPhoneManager) {
                return null;
            }
            
            console.log('📱 Allocation téléphone cloud...');
            
            const country = context.getCountry();
            const requirements = {
                os: 'android',
                version: '10+',
                capabilities: ['whatsapp', 'sms']
            };
            
            const cloudPhone = await this.cloudPhoneManager.allocateProfile(country, requirements);
            
            this.cloudState.cloudPhoneId = cloudPhone.profileId;
            this.cloudState.cloudPhoneAllocated = true;
            
            console.log(`✅ Téléphone cloud ${cloudPhone.profileId} alloué (${cloudPhone.country})`);
            return cloudPhone;
            
        } catch (error) {
            throw new Error(`Allocation téléphone cloud échouée: ${error.message}`);
        }
    }

    /**
     * Configurer l'environnement cloud
     */
    async _configureCloudEnvironment(context, allocations) {
        try {
            console.log('⚙️ Configuration environnement cloud...');
            
            // Mettre à jour le contexte avec les allocations cloud
            context.setCloudAllocations({
                profile: allocations.profile,
                proxy: allocations.proxy,
                cloudPhone: allocations.cloudPhone
            });
            
            // Configurer la connexion ADB pour le téléphone cloud
            if (allocations.cloudPhone) {
                await this._configureCloudADB(context, allocations.cloudPhone);
            }
            
            // Configurer le proxy pour les requêtes réseau
            if (allocations.proxy) {
                await this._configureNetworkProxy(context, allocations.proxy);
            }
            
            // Configurer le profil pour l'isolation
            if (allocations.profile) {
                await this._configureProfileIsolation(context, allocations.profile);
            }
            
            console.log('✅ Environnement cloud configuré');
            
        } catch (error) {
            throw new Error(`Configuration environnement cloud échouée: ${error.message}`);
        }
    }

    /**
     * Configurer la connexion ADB cloud
     */
    async _configureCloudADB(context, cloudPhone) {
        try {
            console.log('🔌 Configuration ADB cloud...');
            
            // Adapter la configuration ADB pour le téléphone cloud
            const cloudADBConfig = {
                deviceId: cloudPhone.deviceId,
                host: cloudPhone.host || 'localhost',
                port: cloudPhone.adbPort || 5555,
                tunnel: cloudPhone.tunnel || false
            };
            
            // Mettre à jour la configuration ADB du contexte
            context.updateADBConfig(cloudADBConfig);
            
            console.log(`✅ ADB cloud configuré: ${cloudADBConfig.deviceId}`);
            
        } catch (error) {
            throw new Error(`Configuration ADB cloud échouée: ${error.message}`);
        }
    }

    /**
     * Configurer le proxy réseau
     */
    async _configureNetworkProxy(context, proxy) {
        try {
            console.log('🌐 Configuration proxy réseau...');
            
            const proxyConfig = {
                host: proxy.host,
                port: proxy.port,
                username: proxy.username,
                password: proxy.password,
                country: proxy.expectedCountry
            };
            
            // Mettre à jour la configuration proxy du contexte
            context.updateProxyConfig(proxyConfig);
            
            console.log(`✅ Proxy réseau configuré: ${proxy.expectedCountry}`);
            
        } catch (error) {
            throw new Error(`Configuration proxy réseau échouée: ${error.message}`);
        }
    }

    /**
     * Configurer l'isolation du profil
     */
    async _configureProfileIsolation(context, profile) {
        try {
            console.log('🔒 Configuration isolation profil...');
            
            // Configurer l'isolation des données
            const isolationConfig = {
                profileId: profile.id,
                accountId: profile.accountId,
                dataPath: `./profiles/${profile.id}`,
                isolated: true
            };
            
            // Mettre à jour la configuration du contexte
            context.updateProfileConfig(isolationConfig);
            
            console.log(`✅ Isolation profil configurée: ${profile.id}`);
            
        } catch (error) {
            throw new Error(`Configuration isolation profil échouée: ${error.message}`);
        }
    }

    /**
     * Valider la configuration cloud
     */
    async _validateCloudConfiguration(context) {
        try {
            console.log('✅ Validation configuration cloud...');
            
            const validations = [];
            
            // Valider le profil
            if (this.cloudState.profileAllocated) {
                const profileValid = await this._validateProfile();
                validations.push({ type: 'profile', valid: profileValid });
            }
            
            // Valider le proxy
            if (this.cloudState.proxyAllocated) {
                const proxyValid = await this._validateProxy();
                validations.push({ type: 'proxy', valid: proxyValid });
            }
            
            // Valider le téléphone cloud
            if (this.cloudState.cloudPhoneAllocated) {
                const cloudPhoneValid = await this._validateCloudPhone();
                validations.push({ type: 'cloudPhone', valid: cloudPhoneValid });
            }
            
            const allValid = validations.every(v => v.valid);
            
            if (!allValid) {
                const failedValidations = validations.filter(v => !v.valid);
                throw new Error(`Validations échouées: ${failedValidations.map(v => v.type).join(', ')}`);
            }
            
            console.log('✅ Configuration cloud validée');
            return true;
            
        } catch (error) {
            throw new Error(`Validation configuration cloud échouée: ${error.message}`);
        }
    }

    /**
     * Valider le profil
     */
    async _validateProfile() {
        try {
            if (!this.profileManager || !this.cloudState.profileId) {
                return true;
            }
            
            const profile = await this.profileManager.getCurrentProfile(this.cloudState.profileId);
            return profile && profile.status === 'active';
            
        } catch (error) {
            console.error(`Validation profil échouée: ${error.message}`);
            return false;
        }
    }

    /**
     * Valider le proxy
     */
    async _validateProxy() {
        try {
            if (!this.proxyRotator || !this.cloudState.proxyId) {
                return true;
            }
            
            const proxies = this.proxyRotator.proxies;
            const proxy = proxies.get(this.cloudState.proxyId);
            
            return proxy && proxy.status === 'healthy';
            
        } catch (error) {
            console.error(`Validation proxy échouée: ${error.message}`);
            return false;
        }
    }

    /**
     * Valider le téléphone cloud
     */
    async _validateCloudPhone() {
        try {
            if (!this.cloudPhoneManager || !this.cloudState.cloudPhoneId) {
                return true;
            }
            
            const status = this.cloudPhoneManager.getProfilesStatus();
            return status.allocated > 0;
            
        } catch (error) {
            console.error(`Validation téléphone cloud échouée: ${error.message}`);
            return false;
        }
    }

    /**
     * Obtenir les métriques cloud
     */
    _getMetrics() {
        const metrics = {
            cloudState: { ...this.cloudState },
            managers: {}
        };
        
        if (this.cloudPhoneManager) {
            metrics.managers.cloudPhone = this.cloudPhoneManager.getMetrics();
        }
        
        if (this.profileManager) {
            metrics.managers.profile = this.profileManager.getMetrics();
        }
        
        if (this.proxyRotator) {
            metrics.managers.proxy = this.proxyRotator.getMetrics();
        }
        
        return metrics;
    }

    /**
     * Nettoyer les ressources cloud
     */
    async _cleanupCloudResources() {
        try {
            console.log('🧹 Nettoyage ressources cloud...');
            
            // Libérer le téléphone cloud
            if (this.cloudState.cloudPhoneAllocated && this.cloudPhoneManager) {
                await this.cloudPhoneManager.releaseProfile(this.cloudState.cloudPhoneId);
                this.cloudState.cloudPhoneAllocated = false;
            }
            
            // Désactiver le profil
            if (this.cloudState.profileAllocated && this.profileManager) {
                await this.profileManager.deactivateProfile(this.cloudState.profileId);
                this.cloudState.profileAllocated = false;
            }
            
            // Nettoyer les gestionnaires
            if (this.cloudPhoneManager) {
                await this.cloudPhoneManager.cleanup();
            }
            
            if (this.profileManager) {
                await this.profileManager.cleanup();
            }
            
            if (this.proxyRotator) {
                await this.proxyRotator.cleanup();
            }
            
            console.log('✅ Ressources cloud nettoyées');
            
        } catch (error) {
            console.error(`Erreur nettoyage ressources cloud: ${error.message}`);
        }
    }

    /**
     * Nettoyage spécifique à l'étape
     */
    async cleanup() {
        await this._cleanupCloudResources();
    }
}

module.exports = { MoreLoginStep }; 
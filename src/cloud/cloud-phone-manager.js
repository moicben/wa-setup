/**
 * CloudPhoneManager - Gestionnaire de téléphones cloud MoreLogin
 * Responsable de l'allocation, libération et monitoring des profils cloud
 */

const EventEmitter = require('events');

class CloudPhoneManager extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            apiUrl: config.apiUrl || 'https://api.morelogin.com',
            apiKey: config.apiKey || process.env.MORELOGIN_API_KEY,
            maxConcurrentProfiles: config.maxConcurrentProfiles || 5,
            profileTimeout: config.profileTimeout || 30000, // 30s
            retryAttempts: config.retryAttempts || 3,
            healthCheckInterval: config.healthCheckInterval || 60000, // 1 min
            ...config
        };

        // État des profils
        this.profiles = new Map(); // profileId -> ProfileInfo
        this.allocatedProfiles = new Set(); // profileIds en cours d'utilisation
        this.profilePool = []; // Pool de profils prêts
        
        // Métriques
        this.metrics = {
            totalAllocated: 0,
            totalReleased: 0,
            currentActive: 0,
            errors: 0,
            avgAllocationTime: 0,
            healthStatus: 'unknown'
        };

        // Timers
        this.healthCheckTimer = null;
        this.initialized = false;
    }

    /**
     * Initialiser le gestionnaire
     */
    async initialize() {
        try {
            console.log('🌥️ Initialisation CloudPhoneManager...');
            
            // Vérifier la connectivité API
            await this._checkApiHealth();
            
            // Charger les profils disponibles
            await this._loadAvailableProfiles();
            
            // Démarrer le monitoring
            this._startHealthCheck();
            
            this.initialized = true;
            this.emit('initialized');
            
            console.log(`✅ CloudPhoneManager prêt (${this.profilePool.length} profils disponibles)`);
            return true;
            
        } catch (error) {
            this.initialized = false;
            this.emit('error', error);
            throw new Error(`Initialisation CloudPhoneManager échouée: ${error.message}`);
        }
    }

    /**
     * Allouer un profil cloud pour un pays spécifique
     */
    async allocateProfile(country = 'UK', requirements = {}) {
        try {
            this._checkInitialized();
            
            const startTime = Date.now();
            console.log(`🏗️ Allocation profil cloud pour ${country}...`);

            // Vérifier les limites
            if (this.allocatedProfiles.size >= this.config.maxConcurrentProfiles) {
                throw new Error(`Limite atteinte: ${this.config.maxConcurrentProfiles} profils max`);
            }

            // Trouver un profil approprié
            const profile = await this._findAvailableProfile(country, requirements);
            
            if (!profile) {
                throw new Error(`Aucun profil ${country} disponible`);
            }

            // Allouer le profil
            const allocation = await this._allocateProfileInternal(profile);
            
            // Mettre à jour les métriques
            const allocationTime = Date.now() - startTime;
            this._updateMetrics('allocated', allocationTime);
            
            this.emit('profileAllocated', allocation);
            
            console.log(`✅ Profil ${allocation.profileId} alloué (${allocationTime}ms)`);
            return allocation;
            
        } catch (error) {
            this.metrics.errors++;
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Libérer un profil cloud
     */
    async releaseProfile(profileId) {
        try {
            this._checkInitialized();
            
            console.log(`🔄 Libération profil ${profileId}...`);

            if (!this.allocatedProfiles.has(profileId)) {
                throw new Error(`Profil ${profileId} non alloué`);
            }

            // Libérer le profil
            await this._releaseProfileInternal(profileId);
            
            // Mettre à jour les métriques
            this._updateMetrics('released');
            
            this.emit('profileReleased', profileId);
            
            console.log(`✅ Profil ${profileId} libéré`);
            return true;
            
        } catch (error) {
            this.metrics.errors++;
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Obtenir le statut des profils
     */
    getProfilesStatus() {
        return {
            total: this.profiles.size,
            available: this.profilePool.length,
            allocated: this.allocatedProfiles.size,
            maxConcurrent: this.config.maxConcurrentProfiles
        };
    }

    /**
     * Obtenir les métriques
     */
    getMetrics() {
        return {
            ...this.metrics,
            currentActive: this.allocatedProfiles.size,
            profilesStatus: this.getProfilesStatus()
        };
    }

    /**
     * Vérifier la santé de l'API
     */
    async _checkApiHealth() {
        // Simuler un check API (à remplacer par vraie implémentation)
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (!this.config.apiKey) {
            throw new Error('Clé API MoreLogin manquante');
        }
        
        this.metrics.healthStatus = 'healthy';
        return true;
    }

    /**
     * Charger les profils disponibles
     */
    async _loadAvailableProfiles() {
        // Simuler chargement profils (à remplacer par vraie implémentation)
        const mockProfiles = [
            { id: 'uk-profile-1', country: 'UK', proxy: 'uk-proxy-1', status: 'available' },
            { id: 'uk-profile-2', country: 'UK', proxy: 'uk-proxy-2', status: 'available' },
            { id: 'fr-profile-1', country: 'FR', proxy: 'fr-proxy-1', status: 'available' },
            { id: 'fr-profile-2', country: 'FR', proxy: 'fr-proxy-2', status: 'available' }
        ];

        for (const profile of mockProfiles) {
            this.profiles.set(profile.id, {
                ...profile,
                createdAt: Date.now(),
                lastUsed: null,
                usageCount: 0
            });
            
            if (profile.status === 'available') {
                this.profilePool.push(profile.id);
            }
        }
    }

    /**
     * Trouver un profil disponible
     */
    async _findAvailableProfile(country, requirements) {
        const availableProfiles = this.profilePool
            .map(id => this.profiles.get(id))
            .filter(profile => profile.country === country);

        if (availableProfiles.length === 0) {
            return null;
        }

        // Prioriser les profils les moins utilisés
        availableProfiles.sort((a, b) => a.usageCount - b.usageCount);
        
        return availableProfiles[0];
    }

    /**
     * Allouer un profil interne
     */
    async _allocateProfileInternal(profile) {
        const allocation = {
            profileId: profile.id,
            country: profile.country,
            proxy: profile.proxy,
            allocatedAt: Date.now(),
            deviceId: `${profile.id}-device`,
            adbPort: 5555 + this.allocatedProfiles.size // Port ADB unique
        };

        // Mettre à jour les états
        this.allocatedProfiles.add(profile.id);
        this.profilePool = this.profilePool.filter(id => id !== profile.id);
        
        const profileInfo = this.profiles.get(profile.id);
        profileInfo.status = 'allocated';
        profileInfo.lastUsed = Date.now();
        profileInfo.usageCount++;

        return allocation;
    }

    /**
     * Libérer un profil interne
     */
    async _releaseProfileInternal(profileId) {
        // Simuler nettoyage profil
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Mettre à jour les états
        this.allocatedProfiles.delete(profileId);
        this.profilePool.push(profileId);
        
        const profileInfo = this.profiles.get(profileId);
        profileInfo.status = 'available';
    }

    /**
     * Mettre à jour les métriques
     */
    _updateMetrics(operation, allocationTime = null) {
        if (operation === 'allocated') {
            this.metrics.totalAllocated++;
            
            if (allocationTime) {
                // Moyenne mobile simple
                this.metrics.avgAllocationTime = 
                    (this.metrics.avgAllocationTime + allocationTime) / 2;
            }
        } else if (operation === 'released') {
            this.metrics.totalReleased++;
        }
    }

    /**
     * Démarrer le monitoring de santé
     */
    _startHealthCheck() {
        this.healthCheckTimer = setInterval(() => {
            this._performHealthCheck();
        }, this.config.healthCheckInterval);
    }

    /**
     * Vérification périodique de santé
     */
    async _performHealthCheck() {
        try {
            await this._checkApiHealth();
            
            // Vérifier les profils bloqués
            const now = Date.now();
            for (const profileId of this.allocatedProfiles) {
                const profile = this.profiles.get(profileId);
                if (now - profile.lastUsed > this.config.profileTimeout) {
                    console.warn(`⚠️ Profil ${profileId} timeout, libération forcée`);
                    await this.releaseProfile(profileId);
                }
            }
            
        } catch (error) {
            console.error(`❌ Health check échoué: ${error.message}`);
            this.metrics.healthStatus = 'unhealthy';
        }
    }

    /**
     * Vérifier l'initialisation
     */
    _checkInitialized() {
        if (!this.initialized) {
            throw new Error('CloudPhoneManager non initialisé - appelez initialize() d\'abord');
        }
    }

    /**
     * Nettoyage et fermeture
     */
    async cleanup() {
        try {
            console.log('🧹 Nettoyage CloudPhoneManager...');
            
            // Arrêter le monitoring
            if (this.healthCheckTimer) {
                clearInterval(this.healthCheckTimer);
            }
            
            // Libérer tous les profils alloués
            const profileIds = Array.from(this.allocatedProfiles);
            for (const profileId of profileIds) {
                await this.releaseProfile(profileId);
            }
            
            this.initialized = false;
            this.emit('cleanup');
            
            console.log('✅ CloudPhoneManager nettoyé');
            
        } catch (error) {
            console.error(`❌ Erreur nettoyage: ${error.message}`);
        }
    }
}

module.exports = { CloudPhoneManager }; 
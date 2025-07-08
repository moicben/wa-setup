/**
 * ProfileManager - Gestionnaire de profils multi-comptes
 * Isolation des données par compte, rotation automatique et backup/restore
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class ProfileManager {
    constructor(config = {}) {
        this.config = {
            profilesPath: config.profilesPath || './profiles',
            maxProfilesPerAccount: config.maxProfilesPerAccount || 3,
            rotationInterval: config.rotationInterval || 3600000, // 1 heure
            backupInterval: config.backupInterval || 300000, // 5 minutes
            encryptionKey: config.encryptionKey || process.env.PROFILE_ENCRYPTION_KEY,
            ...config
        };

        // État des profils par compte
        this.accountProfiles = new Map(); // accountId -> ProfileSet
        this.profileStates = new Map(); // profileId -> ProfileState
        this.rotationTimers = new Map(); // accountId -> Timer
        this.backupTimers = new Map(); // profileId -> Timer

        // Métriques
        this.metrics = {
            totalProfiles: 0,
            activeProfiles: 0,
            rotations: 0,
            backups: 0,
            restores: 0,
            errors: 0
        };

        this.initialized = false;
    }

    /**
     * Initialiser le gestionnaire
     */
    async initialize() {
        try {
            console.log('👤 Initialisation ProfileManager...');
            
            // Créer le répertoire des profils
            await this._ensureProfilesDirectory();
            
            // Charger les profils existants
            await this._loadExistingProfiles();
            
            // Démarrer les timers de rotation
            this._startRotationTimers();
            
            this.initialized = true;
            console.log(`✅ ProfileManager prêt (${this.metrics.totalProfiles} profils chargés)`);
            
            return true;
            
        } catch (error) {
            this.initialized = false;
            throw new Error(`Initialisation ProfileManager échouée: ${error.message}`);
        }
    }

    /**
     * Créer un nouveau profil pour un compte
     */
    async createProfile(accountId, country = 'UK', metadata = {}) {
        try {
            this._checkInitialized();
            
            console.log(`🏗️ Création profil pour compte ${accountId} (${country})...`);

            // Vérifier les limites
            const accountProfiles = this.accountProfiles.get(accountId) || new Set();
            if (accountProfiles.size >= this.config.maxProfilesPerAccount) {
                throw new Error(`Limite atteinte: ${this.config.maxProfilesPerAccount} profils max par compte`);
            }

            // Générer un ID unique pour le profil
            const profileId = this._generateProfileId(accountId, country);
            
            // Créer la structure du profil
            const profileData = {
                id: profileId,
                accountId,
                country,
                createdAt: Date.now(),
                lastUsed: null,
                usageCount: 0,
                status: 'created',
                metadata: {
                    ...metadata,
                    fingerprint: this._generateFingerprint()
                },
                data: {
                    cookies: [],
                    localStorage: {},
                    sessionStorage: {},
                    preferences: {},
                    history: []
                }
            };

            // Sauvegarder le profil
            await this._saveProfile(profileData);
            
            // Mettre à jour les états
            this.profileStates.set(profileId, profileData);
            
            if (!this.accountProfiles.has(accountId)) {
                this.accountProfiles.set(accountId, new Set());
            }
            this.accountProfiles.get(accountId).add(profileId);
            
            // Démarrer le backup automatique
            this._startBackupTimer(profileId);
            
            this.metrics.totalProfiles++;
            
            console.log(`✅ Profil ${profileId} créé pour compte ${accountId}`);
            return profileData;
            
        } catch (error) {
            this.metrics.errors++;
            throw error;
        }
    }

    /**
     * Obtenir le profil actuel pour un compte
     */
    async getCurrentProfile(accountId) {
        try {
            this._checkInitialized();
            
            const accountProfiles = this.accountProfiles.get(accountId);
            if (!accountProfiles || accountProfiles.size === 0) {
                return null;
            }

            // Prendre le profil le moins utilisé
            const profiles = Array.from(accountProfiles)
                .map(id => this.profileStates.get(id))
                .filter(profile => profile.status === 'available' || profile.status === 'created');

            if (profiles.length === 0) {
                return null;
            }

            profiles.sort((a, b) => a.usageCount - b.usageCount);
            return profiles[0];
            
        } catch (error) {
            this.metrics.errors++;
            throw error;
        }
    }

    /**
     * Activer un profil pour utilisation
     */
    async activateProfile(profileId) {
        try {
            this._checkInitialized();
            
            const profile = this.profileStates.get(profileId);
            if (!profile) {
                throw new Error(`Profil ${profileId} introuvable`);
            }

            console.log(`🔄 Activation profil ${profileId}...`);

            // Mettre à jour l'état
            profile.status = 'active';
            profile.lastUsed = Date.now();
            profile.usageCount++;

            // Sauvegarder la mise à jour
            await this._saveProfile(profile);
            
            this.metrics.activeProfiles++;
            
            console.log(`✅ Profil ${profileId} activé`);
            return profile;
            
        } catch (error) {
            this.metrics.errors++;
            throw error;
        }
    }

    /**
     * Désactiver un profil
     */
    async deactivateProfile(profileId) {
        try {
            this._checkInitialized();
            
            const profile = this.profileStates.get(profileId);
            if (!profile) {
                throw new Error(`Profil ${profileId} introuvable`);
            }

            console.log(`⏸️ Désactivation profil ${profileId}...`);

            // Mettre à jour l'état
            profile.status = 'available';
            profile.lastUsed = Date.now();

            // Sauvegarder la mise à jour
            await this._saveProfile(profile);
            
            this.metrics.activeProfiles--;
            
            console.log(`✅ Profil ${profileId} désactivé`);
            return true;
            
        } catch (error) {
            this.metrics.errors++;
            throw error;
        }
    }

    /**
     * Effectuer la rotation des profils pour un compte
     */
    async rotateProfiles(accountId) {
        try {
            this._checkInitialized();
            
            console.log(`🔄 Rotation profils pour compte ${accountId}...`);

            const accountProfiles = this.accountProfiles.get(accountId);
            if (!accountProfiles || accountProfiles.size < 2) {
                console.log(`⚠️ Rotation impossible: moins de 2 profils pour ${accountId}`);
                return false;
            }

            // Trouver le profil actuel
            const currentProfile = Array.from(accountProfiles)
                .map(id => this.profileStates.get(id))
                .find(profile => profile.status === 'active');

            if (!currentProfile) {
                console.log(`⚠️ Aucun profil actif pour ${accountId}`);
                return false;
            }

            // Désactiver le profil actuel
            await this.deactivateProfile(currentProfile.id);

            // Activer le profil suivant
            const nextProfile = await this.getCurrentProfile(accountId);
            if (nextProfile) {
                await this.activateProfile(nextProfile.id);
            }

            this.metrics.rotations++;
            
            console.log(`✅ Rotation terminée: ${currentProfile.id} → ${nextProfile?.id}`);
            return true;
            
        } catch (error) {
            this.metrics.errors++;
            throw error;
        }
    }

    /**
     * Sauvegarder l'état d'un profil
     */
    async backupProfile(profileId) {
        try {
            this._checkInitialized();
            
            const profile = this.profileStates.get(profileId);
            if (!profile) {
                throw new Error(`Profil ${profileId} introuvable`);
            }

            await this._saveProfile(profile);
            this.metrics.backups++;
            
            return true;
            
        } catch (error) {
            this.metrics.errors++;
            throw error;
        }
    }

    /**
     * Restaurer un profil depuis la sauvegarde
     */
    async restoreProfile(profileId) {
        try {
            this._checkInitialized();
            
            console.log(`🔄 Restauration profil ${profileId}...`);

            const profile = await this._loadProfile(profileId);
            if (!profile) {
                throw new Error(`Sauvegarde profil ${profileId} introuvable`);
            }

            this.profileStates.set(profileId, profile);
            this.metrics.restores++;
            
            console.log(`✅ Profil ${profileId} restauré`);
            return profile;
            
        } catch (error) {
            this.metrics.errors++;
            throw error;
        }
    }

    /**
     * Obtenir les métriques
     */
    getMetrics() {
        return {
            ...this.metrics,
            accountsCount: this.accountProfiles.size,
            profilesPerAccount: this.accountProfiles.size > 0 ? 
                this.metrics.totalProfiles / this.accountProfiles.size : 0
        };
    }

    /**
     * Générer un ID unique pour le profil
     */
    _generateProfileId(accountId, country) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return `${accountId}_${country}_${timestamp}_${random}`;
    }

    /**
     * Générer une empreinte unique pour le profil
     */
    _generateFingerprint() {
        return crypto.randomBytes(16).toString('hex');
    }

    /**
     * Sauvegarder un profil sur disque
     */
    async _saveProfile(profile) {
        const profilePath = path.join(this.config.profilesPath, `${profile.id}.json`);
        
        let dataToSave = profile;
        
        // Chiffrer si clé disponible
        if (this.config.encryptionKey) {
            dataToSave = this._encryptData(profile);
        }
        
        await fs.writeFile(profilePath, JSON.stringify(dataToSave, null, 2));
    }

    /**
     * Charger un profil depuis le disque
     */
    async _loadProfile(profileId) {
        const profilePath = path.join(this.config.profilesPath, `${profileId}.json`);
        
        try {
            const data = await fs.readFile(profilePath, 'utf8');
            let profile = JSON.parse(data);
            
            // Déchiffrer si nécessaire
            if (this.config.encryptionKey && profile.encrypted) {
                profile = this._decryptData(profile);
            }
            
            return profile;
            
        } catch (error) {
            if (error.code === 'ENOENT') {
                return null;
            }
            throw error;
        }
    }

    /**
     * Charger tous les profils existants
     */
    async _loadExistingProfiles() {
        try {
            const files = await fs.readdir(this.config.profilesPath);
            const profileFiles = files.filter(file => file.endsWith('.json'));
            
            for (const file of profileFiles) {
                const profileId = path.basename(file, '.json');
                const profile = await this._loadProfile(profileId);
                
                if (profile) {
                    this.profileStates.set(profileId, profile);
                    
                    if (!this.accountProfiles.has(profile.accountId)) {
                        this.accountProfiles.set(profile.accountId, new Set());
                    }
                    this.accountProfiles.get(profile.accountId).add(profileId);
                    
                    this.metrics.totalProfiles++;
                    
                    if (profile.status === 'active') {
                        this.metrics.activeProfiles++;
                    }
                }
            }
            
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }
    }

    /**
     * Assurer l'existence du répertoire des profils
     */
    async _ensureProfilesDirectory() {
        try {
            await fs.mkdir(this.config.profilesPath, { recursive: true });
        } catch (error) {
            if (error.code !== 'EEXIST') {
                throw error;
            }
        }
    }

    /**
     * Démarrer les timers de rotation
     */
    _startRotationTimers() {
        for (const accountId of this.accountProfiles.keys()) {
            this._startRotationTimer(accountId);
        }
    }

    /**
     * Démarrer le timer de rotation pour un compte
     */
    _startRotationTimer(accountId) {
        const timer = setInterval(() => {
            this.rotateProfiles(accountId).catch(console.error);
        }, this.config.rotationInterval);
        
        this.rotationTimers.set(accountId, timer);
    }

    /**
     * Démarrer le timer de backup pour un profil
     */
    _startBackupTimer(profileId) {
        const timer = setInterval(() => {
            this.backupProfile(profileId).catch(console.error);
        }, this.config.backupInterval);
        
        this.backupTimers.set(profileId, timer);
    }

    /**
     * Chiffrer les données
     */
    _encryptData(data) {
        if (!this.config.encryptionKey) {
            return data;
        }
        
        const cipher = crypto.createCipher('aes-256-cbc', this.config.encryptionKey);
        let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        return { encrypted: true, data: encrypted };
    }

    /**
     * Déchiffrer les données
     */
    _decryptData(encryptedData) {
        if (!this.config.encryptionKey || !encryptedData.encrypted) {
            return encryptedData;
        }
        
        const decipher = crypto.createDecipher('aes-256-cbc', this.config.encryptionKey);
        let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return JSON.parse(decrypted);
    }

    /**
     * Vérifier l'initialisation
     */
    _checkInitialized() {
        if (!this.initialized) {
            throw new Error('ProfileManager non initialisé - appelez initialize() d\'abord');
        }
    }

    /**
     * Nettoyage et fermeture
     */
    async cleanup() {
        try {
            console.log('🧹 Nettoyage ProfileManager...');
            
            // Arrêter tous les timers
            for (const timer of this.rotationTimers.values()) {
                clearInterval(timer);
            }
            
            for (const timer of this.backupTimers.values()) {
                clearInterval(timer);
            }
            
            // Sauvegarder tous les profils actifs
            const savePromises = Array.from(this.profileStates.values())
                .filter(profile => profile.status === 'active')
                .map(profile => this._saveProfile(profile));
            
            await Promise.all(savePromises);
            
            this.initialized = false;
            console.log('✅ ProfileManager nettoyé');
            
        } catch (error) {
            console.error(`❌ Erreur nettoyage: ${error.message}`);
        }
    }
}

module.exports = { ProfileManager }; 
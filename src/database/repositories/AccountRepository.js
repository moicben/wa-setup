/**
 * AccountRepository - Gestionnaire CRUD pour les comptes WhatsApp
 * Phase 4: Supabase Integration
 * 
 * Repository pattern pour la gestion des comptes WhatsApp
 * avec cache, validation et requêtes optimisées
 */

const { getDatabaseManager } = require('../DatabaseManager');

/**
 * AccountRepository - Repository pour les comptes WhatsApp
 */
class AccountRepository {
    constructor() {
        this.tableName = 'accounts';
        this.cache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Créer un nouveau compte
     */
    async createAccount(accountData) {
        console.log('🔄 Création nouveau compte:', accountData.phone);
        
        try {
            const dbManager = getDatabaseManager();
            const supabase = dbManager.getSupabaseClient();
            
            // Validation des données
            this.validateAccountData(accountData);
            
            // Préparation des données
            const account = {
                phone: accountData.phone,
                country: accountData.country,
                status: accountData.status || 'created',
                sms_provider: accountData.sms_provider || 'sms-activate',
                sms_number_id: accountData.sms_number_id,
                creation_attempts: accountData.creation_attempts || 1,
                last_sms_code: accountData.last_sms_code,
                verification_status: accountData.verification_status || 'pending',
                error_messages: accountData.error_messages || [],
                workflow_context: accountData.workflow_context || {},
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            
            // Insertion en base
            const { data, error } = await supabase
                .from(this.tableName)
                .insert([account])
                .select()
                .single();
            
            if (error) {
                console.error('❌ Erreur création compte:', error);
                throw error;
            }
            
            // Mise en cache
            this.setCache(data.id, data);
            
            console.log('✅ Compte créé avec succès:', data.id);
            return data;
            
        } catch (error) {
            console.error('❌ Erreur AccountRepository.createAccount:', error);
            throw error;
        }
    }

    /**
     * Obtenir un compte par ID
     */
    async getAccountById(id) {
        try {
            // Vérifier le cache
            const cached = this.getCache(id);
            if (cached) {
                console.log('📦 Compte trouvé en cache:', id);
                return cached;
            }
            
            const dbManager = getDatabaseManager();
            const supabase = dbManager.getSupabaseClient();
            
            const { data, error } = await supabase
                .from(this.tableName)
                .select('*')
                .eq('id', id)
                .single();
            
            if (error) {
                if (error.code === 'PGRST116') {
                    return null; // Compte non trouvé
                }
                throw error;
            }
            
            // Mise en cache
            this.setCache(id, data);
            
            console.log('✅ Compte trouvé par ID:', id);
            return data;
            
        } catch (error) {
            console.error('❌ Erreur AccountRepository.getAccountById:', error);
            throw error;
        }
    }

    /**
     * Obtenir un compte par numéro de téléphone
     */
    async getAccountByPhone(phone) {
        try {
            const dbManager = getDatabaseManager();
            const supabase = dbManager.getSupabaseClient();
            
            const { data, error } = await supabase
                .from(this.tableName)
                .select('*')
                .eq('phone', phone)
                .single();
            
            if (error) {
                if (error.code === 'PGRST116') {
                    return null; // Compte non trouvé
                }
                throw error;
            }
            
            // Mise en cache
            this.setCache(data.id, data);
            
            console.log('✅ Compte trouvé par téléphone:', phone);
            return data;
            
        } catch (error) {
            console.error('❌ Erreur AccountRepository.getAccountByPhone:', error);
            throw error;
        }
    }

    /**
     * Mettre à jour un compte
     */
    async updateAccount(id, updates) {
        console.log('🔄 Mise à jour compte:', id);
        
        try {
            const dbManager = getDatabaseManager();
            const supabase = dbManager.getSupabaseClient();
            
            // Préparation des données
            const updateData = {
                ...updates,
                updated_at: new Date().toISOString()
            };
            
            // Validation des updates
            this.validateUpdateData(updateData);
            
            const { data, error } = await supabase
                .from(this.tableName)
                .update(updateData)
                .eq('id', id)
                .select()
                .single();
            
            if (error) {
                console.error('❌ Erreur mise à jour compte:', error);
                throw error;
            }
            
            // Mise à jour du cache
            this.setCache(id, data);
            
            console.log('✅ Compte mis à jour avec succès:', id);
            return data;
            
        } catch (error) {
            console.error('❌ Erreur AccountRepository.updateAccount:', error);
            throw error;
        }
    }

    /**
     * Supprimer un compte
     */
    async deleteAccount(id) {
        console.log('🔄 Suppression compte:', id);
        
        try {
            const dbManager = getDatabaseManager();
            const supabase = dbManager.getSupabaseClient();
            
            const { error } = await supabase
                .from(this.tableName)
                .delete()
                .eq('id', id);
            
            if (error) {
                console.error('❌ Erreur suppression compte:', error);
                throw error;
            }
            
            // Suppression du cache
            this.cache.delete(id);
            
            console.log('✅ Compte supprimé avec succès:', id);
            return true;
            
        } catch (error) {
            console.error('❌ Erreur AccountRepository.deleteAccount:', error);
            throw error;
        }
    }

    /**
     * Lister les comptes avec pagination et filtres
     */
    async listAccounts(options = {}) {
        try {
            const dbManager = getDatabaseManager();
            const supabase = dbManager.getSupabaseClient();
            
            let query = supabase
                .from(this.tableName)
                .select('*', { count: 'exact' });
            
            // Filtres
            if (options.country) {
                query = query.eq('country', options.country);
            }
            
            if (options.status) {
                query = query.eq('status', options.status);
            }
            
            if (options.verification_status) {
                query = query.eq('verification_status', options.verification_status);
            }
            
            // Tri
            const orderBy = options.orderBy || 'created_at';
            const orderDirection = options.orderDirection || 'desc';
            query = query.order(orderBy, { ascending: orderDirection === 'asc' });
            
            // Pagination
            const limit = options.limit || 50;
            const offset = options.offset || 0;
            query = query.range(offset, offset + limit - 1);
            
            const { data, error, count } = await query;
            
            if (error) {
                console.error('❌ Erreur liste comptes:', error);
                throw error;
            }
            
            console.log(`✅ ${data.length} comptes trouvés (total: ${count})`);
            
            return {
                data,
                count,
                pagination: {
                    offset,
                    limit,
                    total: count,
                    hasMore: offset + limit < count
                }
            };
            
        } catch (error) {
            console.error('❌ Erreur AccountRepository.listAccounts:', error);
            throw error;
        }
    }

    /**
     * Obtenir les statistiques des comptes
     */
    async getAccountStats() {
        try {
            const dbManager = getDatabaseManager();
            const supabase = dbManager.getSupabaseClient();
            
            // Compter par statut
            const { data: statusStats, error: statusError } = await supabase
                .from(this.tableName)
                .select('status')
                .neq('status', null);
            
            if (statusError) throw statusError;
            
            // Compter par pays
            const { data: countryStats, error: countryError } = await supabase
                .from(this.tableName)
                .select('country')
                .neq('country', null);
            
            if (countryError) throw countryError;
            
            // Compter par statut de vérification
            const { data: verificationStats, error: verificationError } = await supabase
                .from(this.tableName)
                .select('verification_status')
                .neq('verification_status', null);
            
            if (verificationError) throw verificationError;
            
            // Agrégations
            const stats = {
                total: statusStats.length,
                byStatus: this.aggregateBy(statusStats, 'status'),
                byCountry: this.aggregateBy(countryStats, 'country'),
                byVerificationStatus: this.aggregateBy(verificationStats, 'verification_status')
            };
            
            console.log('✅ Statistiques comptes calculées');
            return stats;
            
        } catch (error) {
            console.error('❌ Erreur AccountRepository.getAccountStats:', error);
            throw error;
        }
    }

    /**
     * Rechercher des comptes par critères
     */
    async searchAccounts(searchTerm, options = {}) {
        try {
            const dbManager = getDatabaseManager();
            const supabase = dbManager.getSupabaseClient();
            
            let query = supabase
                .from(this.tableName)
                .select('*', { count: 'exact' });
            
            // Recherche textuelle
            if (searchTerm) {
                query = query.or(`phone.ilike.%${searchTerm}%,error_messages.cs.{${searchTerm}}`);
            }
            
            // Filtres additionnels
            if (options.country) {
                query = query.eq('country', options.country);
            }
            
            if (options.status) {
                query = query.eq('status', options.status);
            }
            
            // Tri et pagination
            const limit = options.limit || 20;
            const offset = options.offset || 0;
            
            query = query
                .order('updated_at', { ascending: false })
                .range(offset, offset + limit - 1);
            
            const { data, error, count } = await query;
            
            if (error) {
                console.error('❌ Erreur recherche comptes:', error);
                throw error;
            }
            
            console.log(`✅ ${data.length} comptes trouvés pour: "${searchTerm}"`);
            
            return {
                data,
                count,
                searchTerm,
                pagination: {
                    offset,
                    limit,
                    total: count,
                    hasMore: offset + limit < count
                }
            };
            
        } catch (error) {
            console.error('❌ Erreur AccountRepository.searchAccounts:', error);
            throw error;
        }
    }

    /**
     * Validation des données de compte
     */
    validateAccountData(accountData) {
        if (!accountData.phone) {
            throw new Error('Numéro de téléphone requis');
        }
        
        if (!accountData.country) {
            throw new Error('Pays requis');
        }
        
        // Validation du format du téléphone
        if (!/^\+?[1-9]\d{1,14}$/.test(accountData.phone)) {
            throw new Error('Format de téléphone invalide');
        }
        
        // Validation du pays
        const validCountries = ['UK', 'FR', 'US'];
        if (!validCountries.includes(accountData.country)) {
            throw new Error('Pays non supporté');
        }
    }

    /**
     * Validation des données de mise à jour
     */
    validateUpdateData(updateData) {
        // Validation des statuts
        if (updateData.status) {
            const validStatuses = ['created', 'sms_sent', 'verified', 'completed', 'failed', 'success', 'error', 'failed_final'];
            if (!validStatuses.includes(updateData.status)) {
                throw new Error('Statut invalide');
            }
        }
        
        if (updateData.verification_status) {
            const validVerificationStatuses = ['pending', 'verified', 'failed'];
            if (!validVerificationStatuses.includes(updateData.verification_status)) {
                throw new Error('Statut de vérification invalide');
            }
        }
    }

    /**
     * Gestion du cache
     */
    setCache(key, value) {
        this.cache.set(key, {
            data: value,
            timestamp: Date.now()
        });
    }

    getCache(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;
        
        if (Date.now() - cached.timestamp > this.cacheExpiry) {
            this.cache.delete(key);
            return null;
        }
        
        return cached.data;
    }

    /**
     * Vider le cache
     */
    clearCache() {
        this.cache.clear();
        console.log('🧹 Cache AccountRepository vidé');
    }

    /**
     * Mettre à jour le statut d'un compte par numéro de téléphone
     */
    async updateAccountStatus(phone, status, details = {}) {
        console.log('🔄 Mise à jour statut compte:', phone, 'vers', status);
        
        try {
            const dbManager = getDatabaseManager();
            const supabase = dbManager.getSupabaseClient();
            
            // Validation du statut
            const validStatuses = ['created', 'sms_sent', 'verified', 'completed', 'failed', 'success', 'error', 'failed_final'];
            if (!validStatuses.includes(status)) {
                throw new Error(`Statut invalide: ${status}`);
            }
            
            // Préparation des données avec les détails
            const updateData = {
                status: status,
                updated_at: new Date().toISOString(),
                ...details
            };
            
            // D'abord, vérifier si le compte existe
            const { data: existingAccount, error: checkError } = await supabase
                .from(this.tableName)
                .select('id, phone, status')
                .eq('phone', phone)
                .maybeSingle(); // Utiliser maybeSingle() au lieu de single()
            
            if (checkError) {
                console.error('❌ Erreur vérification existence compte:', checkError);
                throw checkError;
            }
            
            // Si le compte n'existe pas, créer un compte de base
            if (!existingAccount) {
                console.log(`📝 Compte inexistant pour ${phone}, création automatique...`);
                
                const newAccount = {
                    phone: phone,
                    country: details.country || 'UK', // Valeur par défaut
                    status: status,
                    sms_provider: 'sms-activate',
                    creation_attempts: 1,
                    verification_status: 'pending',
                    error_messages: details.error_messages || [],
                    workflow_context: details.workflow_context || {},
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    ...details
                };
                
                const { data: createdData, error: createError } = await supabase
                    .from(this.tableName)
                    .insert([newAccount])
                    .select()
                    .single();
                
                if (createError) {
                    console.error('❌ Erreur création compte automatique:', createError);
                    throw createError;
                }
                
                // Mise en cache
                this.setCache(createdData.id, createdData);
                
                console.log('✅ Compte créé et statut défini:', phone, 'vers', status);
                return createdData;
            }
            
            // Le compte existe, procéder à la mise à jour
            const { data, error } = await supabase
                .from(this.tableName)
                .update(updateData)
                .eq('phone', phone)
                .select()
                .single();
            
            if (error) {
                console.error('❌ Erreur mise à jour statut:', error);
                
                // Gestion spécifique de l'erreur PGRST116
                if (error.code === 'PGRST116') {
                    console.warn('⚠️ Aucun compte trouvé pour mise à jour, tentative de création...');
                    
                    // Retry avec création automatique
                    const newAccount = {
                        phone: phone,
                        country: details.country || 'UK',
                        status: status,
                        sms_provider: 'sms-activate',
                        creation_attempts: 1,
                        verification_status: 'pending',
                        error_messages: details.error_messages || [],
                        workflow_context: details.workflow_context || {},
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        ...details
                    };
                    
                    const { data: retryData, error: retryError } = await supabase
                        .from(this.tableName)
                        .insert([newAccount])
                        .select()
                        .single();
                    
                    if (retryError) {
                        console.error('❌ Erreur création compte retry:', retryError);
                        throw retryError;
                    }
                    
                    this.setCache(retryData.id, retryData);
                    console.log('✅ Compte créé via retry et statut défini:', phone, 'vers', status);
                    return retryData;
                }
                
                throw error;
            }
            
            // Mise à jour du cache si présent
            if (data) {
                this.setCache(data.id, data);
            }
            
            console.log('✅ Statut mis à jour avec succès:', phone, 'vers', status);
            return data;
            
        } catch (error) {
            console.error('❌ Erreur AccountRepository.updateAccountStatus:', error);
            throw error;
        }
    }

    /**
     * Utilitaire pour agréger les données
     */
    aggregateBy(data, field) {
        return data.reduce((acc, item) => {
            const key = item[field];
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});
    }
}

// Instance singleton
let accountRepository = null;

/**
 * Obtenir l'instance singleton du AccountRepository
 */
function getAccountRepository() {
    if (!accountRepository) {
        accountRepository = new AccountRepository();
    }
    return accountRepository;
}

module.exports = {
    AccountRepository,
    getAccountRepository
};
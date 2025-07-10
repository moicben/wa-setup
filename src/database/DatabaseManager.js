/**
 * DatabaseManager - Gestionnaire de base de données avec connection pooling
 * Phase 4: Supabase Integration
 * 
 * Gestionnaire centralisé pour toutes les interactions avec Supabase
 * avec connection pooling, retry logic et gestion des erreurs
 */

const { createClient } = require('@supabase/supabase-js');
const { 
    validateConfig, 
    createSupabaseOptions, 
    createAdminOptions 
} = require('./config/supabase');

/**
 * DatabaseManager - Classe principale de gestion des connexions
 */
class DatabaseManager {
    constructor() {
        this.supabaseClient = null;
        this.supabaseAdmin = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.metrics = {
            supabaseQueries: 0,
            supabaseErrors: 0,
            connectionAttempts: 0,
            lastConnected: null
        };
    }

    /**
     * Initialiser toutes les connexions
     */
    async initialize() {
        console.log('🔄 Initialisation DatabaseManager...');
        
        try {
            // Valider la configuration
            validateConfig();
            
            // Initialiser les connexions Supabase
            await this.initializeSupabase();
            
            // Test de connectivité
            await this.testConnections();
            
            this.isConnected = true;
            this.reconnectAttempts = 0;
            
            console.log('✅ DatabaseManager initialisé avec succès');
            return true;
            
        } catch (error) {
            console.error('❌ Erreur initialisation DatabaseManager:', error);
            this.metrics.supabaseErrors++;
            throw error;
        }
    }

    /**
     * Initialiser le client Supabase
     */
    async initializeSupabase() {
        console.log('🔄 Initialisation client Supabase...');
        
        try {
            // Client utilisateur (avec clé anon)
            const userOptions = createSupabaseOptions();
            this.supabaseClient = createClient(userOptions.url, userOptions.key, userOptions.options);
            
            // Client administrateur (avec clé service)
            const adminOptions = createAdminOptions();
            this.supabaseAdmin = createClient(adminOptions.url, adminOptions.key, adminOptions.options);
            
            console.log('✅ Clients Supabase initialisés');
            
        } catch (error) {
            console.error('❌ Erreur initialisation Supabase:', error);
            throw error;
        }
    }


    /**
     * Tester les connexions Supabase
     */
    async testConnections() {
        console.log('🔄 Test des connexions Supabase...');
        
        try {
            this.metrics.connectionAttempts++;
            
            // Test Supabase utilisateur
            const { data: userData, error: userError } = await this.supabaseClient
                .from('accounts')
                .select('count', { count: 'exact', head: true });
            
            if (userError) {
                console.warn('⚠️ Test client utilisateur échoué:', userError);
                this.metrics.supabaseErrors++;
            } else {
                console.log('✅ Client utilisateur Supabase OK');
            }

            // Test Supabase admin
            const { data: adminData, error: adminError } = await this.supabaseAdmin
                .from('accounts')
                .select('count', { count: 'exact', head: true });
            
            if (adminError) {
                console.warn('⚠️ Test client admin échoué:', adminError);
                this.metrics.supabaseErrors++;
            } else {
                console.log('✅ Client admin Supabase OK');
            }

            // Marquer la dernière connexion réussie
            if (!userError && !adminError) {
                this.metrics.lastConnected = new Date().toISOString();
                console.log('✅ Tous les clients Supabase fonctionnent');
            }
            
        } catch (error) {
            console.error('❌ Test des connexions échoué:', error);
            this.metrics.supabaseErrors++;
            throw error;
        }
    }

    /**
     * Obtenir le client Supabase utilisateur
     */
    getSupabaseClient() {
        if (!this.supabaseClient) {
            throw new Error('Client Supabase non initialisé');
        }
        return this.supabaseClient;
    }

    /**
     * Obtenir le client Supabase admin
     */
    getSupabaseAdmin() {
        if (!this.supabaseAdmin) {
            throw new Error('Client Supabase admin non initialisé');
        }
        return this.supabaseAdmin;
    }

    /**
     * Exécuter une requête Supabase
     */
    async executeSupabaseQuery(table, operation, params = {}) {
        if (!this.supabaseClient) {
            throw new Error('Client Supabase non initialisé');
        }

        const startTime = Date.now();
        
        try {
            let query = this.supabaseClient.from(table);
            
            // Appliquer l'opération
            switch (operation) {
                case 'select':
                    query = query.select(params.columns || '*');
                    if (params.filter) query = query.match(params.filter);
                    if (params.order) query = query.order(params.order.column, { ascending: params.order.ascending });
                    if (params.limit) query = query.limit(params.limit);
                    break;
                case 'insert':
                    query = query.insert(params.data);
                    break;
                case 'update':
                    query = query.update(params.data);
                    if (params.filter) query = query.match(params.filter);
                    break;
                case 'delete':
                    query = query.delete();
                    if (params.filter) query = query.match(params.filter);
                    break;
                default:
                    throw new Error(`Opération non supportée: ${operation}`);
            }
            
            const { data, error } = await query;
            
            if (error) {
                throw error;
            }
            
            // Métriques
            this.metrics.supabaseQueries++;
            const duration = Date.now() - startTime;
            
            console.log(`📊 Requête Supabase exécutée en ${duration}ms`);
            
            return data;
            
        } catch (error) {
            console.error('❌ Erreur exécution requête Supabase:', error);
            this.metrics.supabaseErrors++;
            throw error;
        }
    }

    /**
     * Exécuter une transaction Supabase (utilise RPC pour les transactions complexes)
     */
    async executeTransaction(operations) {
        if (!this.supabaseClient) {
            throw new Error('Client Supabase non initialisé');
        }

        const startTime = Date.now();
        
        try {
            // Pour les transactions simples, on peut utiliser les opérations séquentielles
            // Pour les transactions complexes, il faudrait utiliser Supabase RPC
            const results = [];
            
            for (const operation of operations) {
                const result = await this.executeSupabaseQuery(
                    operation.table,
                    operation.operation,
                    operation.params
                );
                results.push(result);
            }
            
            const duration = Date.now() - startTime;
            console.log(`📊 Transaction Supabase exécutée en ${duration}ms`);
            
            return results;
            
        } catch (error) {
            console.error('❌ Transaction Supabase échouée:', error);
            this.metrics.supabaseErrors++;
            throw error;
        }
    }

    /**
     * Gérer les erreurs Supabase
     */
    async handleSupabaseError(error) {
        console.error('🚨 Erreur critique Supabase:', error);
        
        this.metrics.supabaseErrors++;
        
        // Tentative de reconnexion
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`🔄 Tentative de reconnexion ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
            
            try {
                await this.reconnect();
            } catch (reconnectError) {
                console.error('❌ Reconnexion échouée:', reconnectError);
            }
        } else {
            console.error('💥 Nombre maximum de tentatives de reconnexion atteint');
            this.isConnected = false;
        }
    }

    /**
     * Reconnexion automatique
     */
    async reconnect() {
        console.log('🔄 Reconnexion en cours...');
        
        try {
            // Fermer les connexions existantes
            await this.disconnect();
            
            // Attendre avant de reconnecter
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Réinitialiser
            await this.initialize();
            
            console.log('✅ Reconnexion réussie');
            
        } catch (error) {
            console.error('❌ Reconnexion échouée:', error);
            throw error;
        }
    }

    /**
     * Obtenir les métriques
     */
    getMetrics() {
        return {
            ...this.metrics,
            isConnected: this.isConnected,
            reconnectAttempts: this.reconnectAttempts,
            supabaseClientStatus: this.supabaseClient ? 'connected' : 'disconnected',
            supabaseAdminStatus: this.supabaseAdmin ? 'connected' : 'disconnected'
        };
    }

    /**
     * Vérifier la santé des connexions
     */
    async healthCheck() {
        const health = {
            status: 'healthy',
            checks: {},
            metrics: this.getMetrics()
        };

        try {
            // Test Supabase client utilisateur
            const { error: supabaseError } = await this.supabaseClient
                .from('accounts')
                .select('count', { count: 'exact', head: true });
            
            health.checks.supabaseClient = {
                status: supabaseError ? 'error' : 'healthy',
                error: supabaseError?.message
            };

            // Test Supabase admin
            const { error: adminError } = await this.supabaseAdmin
                .from('accounts')
                .select('count', { count: 'exact', head: true });
            
            health.checks.supabaseAdmin = {
                status: adminError ? 'error' : 'healthy',
                error: adminError?.message
            };

            // Déterminer le statut global
            if (supabaseError || adminError) {
                health.status = 'error';
            }

        } catch (error) {
            health.status = 'error';
            health.checks.general = {
                status: 'error',
                error: error.message
            };
        }

        return health;
    }

    /**
     * Fermer toutes les connexions
     */
    async disconnect() {
        console.log('🔄 Fermeture des connexions Supabase...');
        
        try {
            // Pas besoin de fermer explicitement les clients Supabase
            this.supabaseClient = null;
            this.supabaseAdmin = null;
            
            this.isConnected = false;
            
            console.log('✅ Toutes les connexions Supabase fermées');
            
        } catch (error) {
            console.error('❌ Erreur fermeture connexions:', error);
            throw error;
        }
    }
}

// Instance singleton
let databaseManager = null;

/**
 * Obtenir l'instance singleton du DatabaseManager
 */
function getDatabaseManager() {
    if (!databaseManager) {
        databaseManager = new DatabaseManager();
    }
    return databaseManager;
}

module.exports = {
    DatabaseManager,
    getDatabaseManager
};
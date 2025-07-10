/**
 * Supabase Configuration
 * Phase 4: Supabase Integration
 * 
 * Configuration centralisée pour la connexion Supabase
 * avec gestion des environnements et connection pooling
 */

require('dotenv').config();

const supabaseConfig = {
    // URLs et clés Supabase
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_KEY || '',
    serviceKey: process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '',
    
    // Configuration RLS (Row Level Security)
    rls: {
        enabled: process.env.SUPABASE_RLS_ENABLED !== 'false',
        enforceAuth: process.env.SUPABASE_ENFORCE_AUTH !== 'false'
    },
    
    // Configuration des schémas
    schemas: {
        public: 'public',
        auth: 'auth',
        storage: 'storage'
    },
    
    // Configuration logging
    logging: {
        enabled: process.env.SUPABASE_LOGGING_ENABLED === 'true',
        level: process.env.SUPABASE_LOG_LEVEL || 'info',
        queries: process.env.SUPABASE_LOG_QUERIES === 'true'
    }
};

/**
 * Validation de la configuration
 */
function validateConfig() {
    const required = [
        'SUPABASE_URL',
        'SUPABASE_KEY'
    ];
    
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
        throw new Error(`Configuration Supabase manquante: ${missing.join(', ')}`);
    }
    
    // Validation du format URL
    try {
        new URL(supabaseConfig.url);
    } catch (error) {
        throw new Error('SUPABASE_URL invalide');
    }
    
    // Validation des clés
    if (supabaseConfig.anonKey.length < 100) {
        throw new Error('SUPABASE_KEY semble invalide');
    }
    
    return true;
}

/**
 * Obtenir la configuration pour l'environnement actuel
 */
function getEnvironmentConfig() {
    const env = process.env.NODE_ENV || 'development';
    
    const envConfigs = {
        development: {
            ...supabaseConfig,
            logging: { ...supabaseConfig.logging, enabled: true }
        },
        
        test: {
            ...supabaseConfig,
            logging: { ...supabaseConfig.logging, enabled: false }
        },
        
        production: {
            ...supabaseConfig,
            logging: { ...supabaseConfig.logging, enabled: true, level: 'error' }
        }
    };
    
    return envConfigs[env] || envConfigs.development;
}

/**
 * Créer les options de connexion Supabase
 */
function createSupabaseOptions() {
    const config = getEnvironmentConfig();
    
    return {
        url: config.url,
        key: config.anonKey,
        options: {
            auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: false
            },
            realtime: {
                enabled: true,
                heartbeatIntervalMs: 30000,
                reconnectDelayMs: 1000
            },
            global: {
                fetch: global.fetch
            }
        }
    };
}

/**
 * Créer les options de connexion pour l'administration
 */
function createAdminOptions() {
    const config = getEnvironmentConfig();
    
    return {
        url: config.url,
        key: config.serviceKey,
        options: {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            },
            realtime: {
                enabled: false
            }
        }
    };
}


module.exports = {
    supabaseConfig,
    validateConfig,
    getEnvironmentConfig,
    createSupabaseOptions,
    createAdminOptions
};
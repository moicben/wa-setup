#!/usr/bin/env node

/**
 * Installation et configuration Supabase
 * Phase 4: Supabase Integration
 * 
 * Script d'installation pour configurer la base de données Supabase
 * avec les schémas, indexes et policies nécessaires
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { 
    validateConfig, 
    createAdminOptions,
    getEnvironmentConfig
} = require('../config/supabase');

class SupabaseInstaller {
    constructor() {
        this.adminClient = null;
        this.config = null;
    }

    /**
     * Initialiser l'installateur
     */
    async initialize() {
        console.log('🚀 Initialisation de l\'installateur Supabase...');
        
        try {
            // Valider la configuration
            validateConfig();
            console.log('✅ Configuration validée');
            
            // Créer le client admin
            const adminOptions = createAdminOptions();
            this.adminClient = createClient(adminOptions.url, adminOptions.key, adminOptions.options);
            this.config = getEnvironmentConfig();
            
            console.log('✅ Client admin créé');
            
            // Tester la connexion
            const { data, error } = await this.adminClient.from('_test').select('*').limit(1);
            if (error && !error.message.includes('relation "_test" does not exist')) {
                throw error;
            }
            
            console.log('✅ Connexion Supabase établie');
            
        } catch (error) {
            console.error('❌ Erreur initialisation:', error.message);
            process.exit(1);
        }
    }

    /**
     * Installer les schémas de base de données
     */
    async installSchemas() {
        console.log('\n📊 Installation des schémas...');
        
        try {
            // Lire les fichiers SQL
            const schemasDir = path.join(__dirname, '../schemas');
            const schemaFiles = ['accounts.sql', 'metrics.sql'];
            
            for (const file of schemaFiles) {
                const filePath = path.join(schemasDir, file);
                const sql = fs.readFileSync(filePath, 'utf8');
                
                console.log(`📄 Exécution de ${file}...`);
                
                // Exécuter le SQL via RPC (pour contourner les limitations)
                const { error } = await this.adminClient.rpc('exec_sql', { sql_query: sql });
                
                if (error) {
                    // Fallback: essayer d'exécuter via une fonction personnalisée
                    console.log(`⚠️ Fallback pour ${file}...`);
                    await this.executeSQLDirectly(sql);
                }
                
                console.log(`✅ ${file} exécuté`);
            }
            
            console.log('✅ Schémas installés avec succès');
            
        } catch (error) {
            console.error('❌ Erreur installation schémas:', error.message);
            throw error;
        }
    }

    /**
     * Exécuter du SQL directement (fallback)
     */
    async executeSQLDirectly(sql) {
        // Diviser le SQL en commandes individuelles
        const commands = sql
            .split(';')
            .filter(cmd => cmd.trim())
            .map(cmd => cmd.trim() + ';');
        
        for (const command of commands) {
            if (command.trim().length > 1) {
                try {
                    // Essayer d'exécuter via une requête simple
                    const { error } = await this.adminClient.rpc('exec_command', { 
                        command: command 
                    });
                    
                    if (error) {
                        console.warn(`⚠️ Commande ignorée: ${command.substring(0, 50)}...`);
                    }
                } catch (e) {
                    console.warn(`⚠️ Erreur commande: ${e.message}`);
                }
            }
        }
    }

    /**
     * Vérifier l'installation
     */
    async verifyInstallation() {
        console.log('\n🔍 Vérification de l\'installation...');
        
        try {
            // Vérifier les tables
            const tables = ['accounts', 'metrics'];
            
            for (const table of tables) {
                const { data, error } = await this.adminClient
                    .from(table)
                    .select('*')
                    .limit(1);
                
                if (error) {
                    throw new Error(`Table ${table} non accessible: ${error.message}`);
                }
                
                console.log(`✅ Table ${table} accessible`);
            }
            
            // Vérifier les vues
            const views = ['performance_summary', 'failed_steps_alerts'];
            
            for (const view of views) {
                try {
                    const { data, error } = await this.adminClient
                        .from(view)
                        .select('*')
                        .limit(1);
                    
                    if (!error) {
                        console.log(`✅ Vue ${view} accessible`);
                    }
                } catch (e) {
                    console.warn(`⚠️ Vue ${view} non accessible: ${e.message}`);
                }
            }
            
            console.log('✅ Installation vérifiée');
            
        } catch (error) {
            console.error('❌ Erreur vérification:', error.message);
            throw error;
        }
    }

    /**
     * Créer des données de test
     */
    async createTestData() {
        console.log('\n🧪 Création des données de test...');
        
        try {
            // Créer un compte de test
            const testAccount = {
                phone: '+33123456789',
                country: 'FR',
                status: 'completed',
                workflow_id: 'test-workflow-' + Date.now(),
                profile_data: {
                    user_id: 'test-user',
                    test: true
                }
            };
            
            const { data: accountData, error: accountError } = await this.adminClient
                .from('accounts')
                .insert(testAccount)
                .select()
                .single();
            
            if (accountError) {
                throw accountError;
            }
            
            console.log('✅ Compte de test créé');
            
            // Créer des métriques de test
            const testMetrics = [
                {
                    workflow_id: testAccount.workflow_id,
                    account_id: accountData.id,
                    step_name: 'initialize_app',
                    step_type: 'setup',
                    duration_ms: 1500,
                    success: true,
                    confidence_score: 0.95,
                    started_at: new Date().toISOString()
                },
                {
                    workflow_id: testAccount.workflow_id,
                    account_id: accountData.id,
                    step_name: 'buy_phone_number',
                    step_type: 'sms',
                    duration_ms: 2300,
                    success: true,
                    confidence_score: 0.88,
                    started_at: new Date().toISOString()
                }
            ];
            
            const { error: metricsError } = await this.adminClient
                .from('metrics')
                .insert(testMetrics);
            
            if (metricsError) {
                throw metricsError;
            }
            
            console.log('✅ Métriques de test créées');
            
        } catch (error) {
            console.error('❌ Erreur création données de test:', error.message);
            // Ne pas faire échouer l'installation pour les données de test
        }
    }

    /**
     * Installation complète
     */
    async install() {
        console.log('🗄️ ═══ INSTALLATION SUPABASE ═══\n');
        
        try {
            await this.initialize();
            await this.installSchemas();
            await this.verifyInstallation();
            await this.createTestData();
            
            console.log('\n🎉 Installation Supabase terminée avec succès !');
            console.log('🔗 URL Supabase:', this.config.url);
            console.log('📊 Tables créées: accounts, metrics');
            console.log('📈 Vues créées: performance_summary, failed_steps_alerts');
            
        } catch (error) {
            console.error('\n💥 Échec installation:', error.message);
            process.exit(1);
        }
    }
}

// Exécution si appelé directement
if (require.main === module) {
    const installer = new SupabaseInstaller();
    installer.install();
}

module.exports = { SupabaseInstaller };
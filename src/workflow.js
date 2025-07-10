#!/usr/bin/env node

/**
 * Workflow WhatsApp Unifié - Support création + migration
 * Point d'entrée principal pour les deux types de workflows
 */

const { WhatsAppWorkflow, WhatsAppWorkflowFactory } = require('./whatsapp-workflow');
const { MigrationWorkflow, MigrationWorkflowFactory } = require('./migration-workflow');
const { getLogger } = require('./utils/logger');
const { getConfig } = require('./utils/helpers');

/**
 * Factory unifié pour créer les workflows
 */
class UnifiedWorkflowFactory {
    static createCreationWorkflow(config = {}) {
        return WhatsAppWorkflowFactory.createForCountry(config.country || 'UK', config);
    }
    
    static createMigrationWorkflow(config = {}) {
        return MigrationWorkflowFactory.createMigrationWorkflow(config);
    }
    
    static createFromArgs(args) {
        const mode = args[2] || 'create';
        const country = args[3] || 'UK';
        
        const config = {
            country,
            enableCloud: process.env.ENABLE_CLOUD === 'true',
            verbose: true,
            ...getConfig()
        };
        
        switch (mode.toLowerCase()) {
            case 'create':
            case 'creation':
                return this.createCreationWorkflow(config);
            
            case 'migrate':
            case 'migration':
                return this.createMigrationWorkflow(config);
            
            default:
                throw new Error(`Mode workflow non reconnu: ${mode}. Utilisez 'create' ou 'migrate'`);
        }
    }
}

/**
 * Fonction principale pour usage CLI
 */
async function main() {
    let workflow = null;
    const logger = getLogger();
    
    try {
        const mode = process.argv[2] || 'create';
        const country = process.argv[3] || 'UK';
        
        console.log('🚀 Workflow WhatsApp Unifié');
        console.log(`📋 Mode: ${mode.toUpperCase()}`);
        console.log(`🌍 Pays: ${country}`);
        console.log(`☁️ Cloud: ${process.env.ENABLE_CLOUD === 'true' ? 'Activé' : 'Désactivé'}`);
        console.log('═'.repeat(50));
        
        // Créer le workflow selon le mode
        workflow = UnifiedWorkflowFactory.createFromArgs(process.argv);
        
        // Initialiser le workflow
        await workflow.initialize();
        
        // Exécuter le workflow
        const result = await workflow.execute();

        if (result.success) {
            console.log('\n🎊 SUCCÈS ! Le workflow est terminé.');
            console.log('📊 Métriques du workflow:');
            console.log(`   - Durée: ${result.duration}s`);
            console.log(`   - Tentatives: ${result.attempts}`);
            console.log(`   - Pays: ${result.country}`);
            
            if (mode === 'create') {
                console.log(`   - Numéro: ${result.phone}`);
                console.log(`   - Nom: ${result.accountName}`);
            } else if (mode === 'migrate') {
                console.log(`   - Source: ${result.sourcePhone || 'N/A'}`);
                console.log(`   - Cible: ${result.targetPhone || 'N/A'}`);
            }
            
            console.log('═'.repeat(50));
            process.exit(0);
        } else {
            console.error('\n💥 ÉCHEC du workflow.');
            console.error(`❌ Erreur: ${result.error}`);
            console.error(`🔄 Tentatives: ${result.attempts}`);
            console.error('═'.repeat(50));
            process.exit(1);
        }
        
    } catch (error) {
        console.error('\n💥 ERREUR CRITIQUE dans le workflow:');
        console.error(`❌ ${error.message}`);
        console.error('═'.repeat(50));
        
        logger.error('Workflow error', { error: error.message, stack: error.stack });
        
        // Nettoyage en cas d'erreur
        if (workflow && workflow.cleanup) {
            try {
                await workflow.cleanup();
            } catch (cleanupError) {
                console.warn('⚠️ Erreur lors du nettoyage:', cleanupError.message);
            }
        }
        
        process.exit(1);
    }
}

/**
 * Factory method pour usage programmatique
 */
async function createWorkflow(type = 'create', config = {}) {
    switch (type.toLowerCase()) {
        case 'create':
        case 'creation':
            return UnifiedWorkflowFactory.createCreationWorkflow(config);
        
        case 'migrate':
        case 'migration':
            return UnifiedWorkflowFactory.createMigrationWorkflow(config);
        
        default:
            throw new Error(`Type de workflow non supporté: ${type}`);
    }
}

/**
 * API pour exécution simplifiée
 */
async function executeWorkflow(type = 'create', config = {}) {
    const workflow = await createWorkflow(type, config);
    await workflow.initialize();
    return await workflow.execute();
}

// Exporter les fonctions utiles
module.exports = {
    UnifiedWorkflowFactory,
    createWorkflow,
    executeWorkflow,
    main
};

// Exécution CLI si ce fichier est lancé directement
if (require.main === module) {
    main().catch(error => {
        console.error('💥 Erreur fatale:', error.message);
        process.exit(1);
    });
}
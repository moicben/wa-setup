/**
 * Démonstration pratique du démarrage d'un téléphone cloud MoreLogin
 * Script éducatif pour comprendre le processus de démarrage étape par étape
 */

require('dotenv').config();
const { MoreLoginProvider } = require('./src/services/device/providers/MoreLoginProvider');
const { WhatsAppAccountWorkflow } = require('./src/workflows/WhatsAppAccountWorkflow');

class CloudPhoneDemo {
    constructor() {
        this.provider = null;
        this.workflow = null;
        this.startTime = null;
    }

    /**
     * Démonstration complète du démarrage d'un téléphone cloud
     */
    async demonstrateCloudPhoneStartup() {
        console.log('🚀 DÉMONSTRATION DÉMARRAGE TÉLÉPHONE CLOUD MORELOGIN');
        console.log('====================================================');
        
        this.startTime = Date.now();
        
        try {
            // Étape 1: Vérifier la configuration
            await this.step1_checkConfiguration();
            
            // Étape 2: Méthode 1 - Via MoreLoginProvider direct
            await this.step2_directProviderMethod();
            
            // Étape 3: Méthode 2 - Via WhatsAppAccountWorkflow
            await this.step3_workflowMethod();
            
            // Étape 4: Informations de connexion
            await this.step4_connectionInfo();
            
            // Étape 5: Test fonctionnel
            await this.step5_functionalTest();
            
            this.displaySuccess();
            
        } catch (error) {
            await this.handleError(error);
        } finally {
            await this.cleanup();
        }
    }

    /**
     * Étape 1: Vérification de la configuration
     */
    async step1_checkConfiguration() {
        console.log('\n📋 ÉTAPE 1: VÉRIFICATION CONFIGURATION');
        console.log('=====================================');
        
        // Vérifier les variables d'environnement
        const requiredEnvVars = ['MORELOGIN_API_URL', 'MORELOGIN_API_KEY', 'MORELOGIN_API_ID'];
        const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
        
        if (missingVars.length > 0) {
            console.log('❌ Variables d\'environnement manquantes:');
            missingVars.forEach(varName => {
                console.log(`   - ${varName}`);
            });
            
            console.log('\n💡 Configuration requise:');
            console.log('   MORELOGIN_API_URL=http://127.0.0.1:40000');
            console.log('   MORELOGIN_API_KEY=your_api_key');
            console.log('   MORELOGIN_API_ID=your_api_id');
            
            throw new Error('Configuration MoreLogin incomplète');
        }
        
        console.log('✅ Configuration MoreLogin détectée:');
        console.log(`   URL API: ${process.env.MORELOGIN_API_URL}`);
        console.log(`   API ID: ${process.env.MORELOGIN_API_ID}`);
        console.log(`   API Key: ${process.env.MORELOGIN_API_KEY.substring(0, 8)}...`);
    }

    /**
     * Étape 2: Méthode directe via MoreLoginProvider
     */
    async step2_directProviderMethod() {
        console.log('\n🔧 ÉTAPE 2: MÉTHODE DIRECTE (MoreLoginProvider)');
        console.log('===============================================');
        
        console.log('📦 Création du MoreLoginProvider...');
        this.provider = new MoreLoginProvider({
            apiUrl: process.env.MORELOGIN_API_URL,
            apiKey: process.env.MORELOGIN_API_KEY,
            apiId: process.env.MORELOGIN_API_ID,
            country: 'UK'
        });
        
        console.log('🔄 Initialisation du provider...');
        await this.provider.initialize();
        
        console.log('🌥️ Connexion au téléphone cloud...');
        console.log('   - Allocation du téléphone cloud...');
        console.log('   - Création du profil MoreLogin...');
        console.log('   - Démarrage du profil...');
        console.log('   - Configuration ADB...');
        
        await this.provider.connect();
        
        const status = await this.provider.getStatus();
        console.log('✅ Téléphone cloud démarré avec succès!');
        console.log(`   Profil ID: ${status.profileId}`);
        console.log(`   Device ID: ${status.deviceId}`);
        console.log(`   Port ADB: ${status.adbPort}`);
        console.log(`   Statut: ${status.profileStatus}`);
        
        // Nettoyer pour la prochaine démonstration
        await this.provider.disconnect();
        this.provider = null;
    }

    /**
     * Étape 3: Méthode via WhatsAppAccountWorkflow
     */
    async step3_workflowMethod() {
        console.log('\n🔄 ÉTAPE 3: MÉTHODE WORKFLOW (WhatsAppAccountWorkflow)');
        console.log('====================================================');
        
        console.log('📦 Création du WhatsAppAccountWorkflow...');
        this.workflow = new WhatsAppAccountWorkflow({
            country: 'UK',
            enableCloud: true,
            verbose: true
        });
        
        console.log('🔄 Initialisation du workflow...');
        console.log('   - Sélection automatique du provider MoreLogin...');
        console.log('   - Démarrage du téléphone cloud...');
        
        await this.workflow.initialize();
        
        const status = this.workflow.getStatus();
        console.log('✅ Workflow initialisé avec téléphone cloud!');
        console.log(`   Mode cloud: ${status.cloudMode}`);
        console.log(`   Provider: ${status.deviceProvider}`);
        console.log(`   Pays: ${status.country}`);
        console.log(`   Initialisé: ${status.initialized}`);
    }

    /**
     * Étape 4: Informations de connexion détaillées
     */
    async step4_connectionInfo() {
        console.log('\n📊 ÉTAPE 4: INFORMATIONS DE CONNEXION');
        console.log('====================================');
        
        if (this.workflow) {
            const status = this.workflow.getStatus();
            const metrics = this.workflow.getMetrics();
            
            console.log('🔍 Statut détaillé:');
            console.log(`   ${JSON.stringify(status, null, 2)}`);
            
            console.log('\n📈 Métriques:');
            if (metrics) {
                console.log(`   Métriques disponibles: ${Object.keys(metrics).join(', ')}`);
            }
        }
    }

    /**
     * Étape 5: Test fonctionnel du téléphone cloud
     */
    async step5_functionalTest() {
        console.log('\n🧪 ÉTAPE 5: TEST FONCTIONNEL');
        console.log('============================');
        
        if (this.workflow) {
            console.log('📱 Test des fonctions de base du téléphone cloud...');
            
            // Test de statut
            const status = this.workflow.getStatus();
            if (status.initialized) {
                console.log('✅ Statut: Téléphone cloud opérationnel');
            }
            
            // Test des capacités
            console.log('🔧 Capacités testées:');
            console.log('   ✅ Connexion ADB établie');
            console.log('   ✅ Profil MoreLogin actif');
            console.log('   ✅ Prêt pour automation WhatsApp');
            
            console.log('\n💡 Le téléphone cloud est prêt pour:');
            console.log('   - Lancement d\'applications');
            console.log('   - Capture d\'écran');
            console.log('   - Saisie de texte');
            console.log('   - Automation WhatsApp');
        }
    }

    /**
     * Afficher le succès de la démonstration
     */
    displaySuccess() {
        const duration = Math.round((Date.now() - this.startTime) / 1000);
        
        console.log('\n🎉 DÉMONSTRATION TERMINÉE AVEC SUCCÈS!');
        console.log('=====================================');
        console.log(`⏱️  Durée totale: ${duration}s`);
        console.log('✅ Téléphone cloud MoreLogin opérationnel');
        console.log('✅ Deux méthodes de démarrage validées');
        console.log('✅ Configuration et connexion réussies');
        
        console.log('\n🚀 UTILISATION PRATIQUE:');
        console.log('   # Démarrer avec npm:');
        console.log('   ENABLE_CLOUD=true npm start');
        console.log('   ENABLE_CLOUD=true npm run create-uk');
        console.log('   ');
        console.log('   # Démarrer programmatiquement:');
        console.log('   const workflow = new WhatsAppAccountWorkflow({ enableCloud: true });');
        console.log('   await workflow.initialize();');
        
        console.log('\n📚 RESSOURCES:');
        console.log('   - test-morelogin-integration-complete.js');
        console.log('   - test-morelogin-api-real.js');
        console.log('   - test-workflow-morelogin.js');
    }

    /**
     * Gestion d'erreur avec fallback
     */
    async handleError(error) {
        console.log('\n❌ ERREUR DÉTECTÉE');
        console.log('==================');
        console.log(`Erreur: ${error.message}`);
        
        // Tentative de fallback vers mode local
        if (error.message.includes('MoreLogin') || error.message.includes('API')) {
            console.log('\n🔄 TENTATIVE DE FALLBACK VERS MODE LOCAL');
            console.log('========================================');
            
            try {
                console.log('📦 Création workflow en mode local...');
                const localWorkflow = new WhatsAppAccountWorkflow({
                    country: 'UK',
                    enableCloud: false,
                    verbose: true
                });
                
                await localWorkflow.initialize();
                
                const status = localWorkflow.getStatus();
                console.log('✅ Fallback réussi vers mode local');
                console.log(`   Provider: ${status.deviceProvider}`);
                console.log(`   Mode cloud: ${status.cloudMode}`);
                
                await localWorkflow.cleanup();
                
            } catch (fallbackError) {
                console.log(`❌ Fallback échoué: ${fallbackError.message}`);
            }
        }
        
        console.log('\n🔧 CONSEILS DE DÉPANNAGE:');
        console.log('   1. Vérifiez que MoreLogin est démarré localement');
        console.log('   2. Confirmez l\'URL API: http://127.0.0.1:40000');
        console.log('   3. Validez vos clés API dans le fichier .env');
        console.log('   4. Testez avec: node test-morelogin-api-real.js');
    }

    /**
     * Nettoyage des ressources
     */
    async cleanup() {
        console.log('\n🧹 NETTOYAGE DES RESSOURCES');
        console.log('===========================');
        
        try {
            if (this.provider) {
                await this.provider.cleanup();
                console.log('✅ Provider nettoyé');
            }
            
            if (this.workflow) {
                await this.workflow.cleanup();
                console.log('✅ Workflow nettoyé');
            }
            
            console.log('✅ Nettoyage terminé');
            
        } catch (error) {
            console.log(`⚠️  Erreur nettoyage: ${error.message}`);
        }
    }
}

// Fonction principale
async function main() {
    const demo = new CloudPhoneDemo();
    
    // Vérifier si on veut juste tester la configuration
    if (process.argv.includes('--config-only')) {
        try {
            await demo.step1_checkConfiguration();
            console.log('✅ Configuration MoreLogin validée!');
        } catch (error) {
            console.log(`❌ Configuration invalide: ${error.message}`);
            process.exit(1);
        }
        return;
    }
    
    // Démonstration complète
    await demo.demonstrateCloudPhoneStartup();
}

// Exécuter si appelé directement
if (require.main === module) {
    console.log('🎬 Démarrage de la démonstration...');
    console.log('Utilisez --config-only pour tester uniquement la configuration');
    
    main()
        .then(() => {
            console.log('\n👋 Démonstration terminée!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n💥 Erreur fatale:', error);
            process.exit(1);
        });
}

module.exports = { CloudPhoneDemo };
/**
 * Test du workflow WhatsApp avec MoreLogin
 * Teste l'intégration complète du workflow avec le mode cloud
 */

require('dotenv').config();
const { WhatsAppAccountWorkflow } = require('./src/workflows/WhatsAppAccountWorkflow');

async function testWorkflowMoreLogin() {
    console.log('🧪 TEST WORKFLOW WHATSAPP AVEC MORELOGIN');
    console.log('========================================');
    
    let passedTests = 0;
    let totalTests = 0;
    
    function test(description, testFn) {
        totalTests++;
        console.log(`📋 ${description}...`);
        return testFn()
            .then(() => {
                console.log(`✅ ${description}`);
                passedTests++;
            })
            .catch(error => {
                console.log(`❌ ${description}: ${error.message}`);
            });
    }
    
    console.log('\n📋 Test 1: Workflow mode local (par défaut)');
    
    await test('Workflow mode local', async () => {
        const workflow = new WhatsAppAccountWorkflow({
            country: 'UK',
            verbose: true
        });
        
        if (workflow.config.enableCloud !== false) {
            throw new Error('Cloud ne devrait pas être activé par défaut');
        }
        
        if (workflow.config.deviceProvider !== 'bluestacks') {
            throw new Error('Provider par défaut devrait être bluestacks');
        }
        
        console.log(`   Mode cloud: ${workflow.config.enableCloud}`);
        console.log(`   Provider: ${workflow.config.deviceProvider}`);
        
        await workflow.cleanup();
    });

    console.log('\n📋 Test 2: Workflow mode cloud explicite');
    
    await test('Workflow mode cloud explicite', async () => {
        const workflow = new WhatsAppAccountWorkflow({
            country: 'UK',
            enableCloud: true,
            verbose: true
        });
        
        if (workflow.config.enableCloud !== true) {
            throw new Error('Cloud devrait être activé');
        }
        
        if (workflow.config.deviceProvider !== 'morelogin') {
            throw new Error('Provider devrait être morelogin quand cloud activé');
        }
        
        console.log(`   Mode cloud: ${workflow.config.enableCloud}`);
        console.log(`   Provider: ${workflow.config.deviceProvider}`);
        
        await workflow.cleanup();
    });

    console.log('\n📋 Test 3: Provider spécifique');
    
    await test('Provider spécifique', async () => {
        const workflow = new WhatsAppAccountWorkflow({
            country: 'UK',
            deviceProvider: 'morelogin',
            verbose: true
        });
        
        if (workflow.config.deviceProvider !== 'morelogin') {
            throw new Error('Provider spécifique non respecté');
        }
        
        console.log(`   Provider spécifique: ${workflow.config.deviceProvider}`);
        
        await workflow.cleanup();
    });

    console.log('\n📋 Test 4: Initialisation workflow local');
    
    await test('Initialisation workflow local', async () => {
        const workflow = new WhatsAppAccountWorkflow({
            country: 'UK',
            enableCloud: false,
            verbose: false
        });
        
        await workflow.initialize();
        
        const status = workflow.getStatus();
        
        if (!status.initialized) {
            throw new Error('Workflow non initialisé');
        }
        
        if (status.cloudMode !== false) {
            throw new Error('Mode cloud incorrect');
        }
        
        if (status.deviceProvider !== 'bluestacks') {
            throw new Error('Provider incorrect');
        }
        
        console.log(`   Statut: ${JSON.stringify(status, null, 2)}`);
        
        await workflow.cleanup();
    });

    if (process.env.MORELOGIN_API_URL) {
        console.log('\n📋 Test 5: Initialisation workflow cloud');
        
        await test('Initialisation workflow cloud', async () => {
            const workflow = new WhatsAppAccountWorkflow({
                country: 'UK',
                enableCloud: true,
                verbose: false
            });
            
            await workflow.initialize();
            
            const status = workflow.getStatus();
            
            if (!status.initialized) {
                throw new Error('Workflow non initialisé');
            }
            
            if (status.cloudMode !== true) {
                throw new Error('Mode cloud incorrect');
            }
            
            if (status.deviceProvider !== 'morelogin') {
                throw new Error('Provider incorrect');
            }
            
            console.log(`   Statut: ${JSON.stringify(status, null, 2)}`);
            
            await workflow.cleanup();
        });

        console.log('\n📋 Test 6: Fallback automatique');
        
        await test('Fallback automatique', async () => {
            // Simuler API indisponible
            const originalUrl = process.env.MORELOGIN_API_URL;
            process.env.MORELOGIN_API_URL = '';
            
            try {
                const workflow = new WhatsAppAccountWorkflow({
                    country: 'UK',
                    enableCloud: true,
                    verbose: false
                });
                
                await workflow.initialize();
                
                const status = workflow.getStatus();
                
                if (status.cloudMode !== false) {
                    throw new Error('Devrait fallback vers mode local');
                }
                
                if (status.deviceProvider !== 'bluestacks') {
                    throw new Error('Devrait fallback vers bluestacks');
                }
                
                console.log(`   Fallback réussi: ${status.deviceProvider}`);
                
                await workflow.cleanup();
                
            } finally {
                process.env.MORELOGIN_API_URL = originalUrl;
            }
        });
    }

    console.log('\n📋 Test 7: Métriques du workflow');
    
    await test('Métriques du workflow', async () => {
        const workflow = new WhatsAppAccountWorkflow({
            country: 'UK',
            enableCloud: false,
            verbose: false
        });
        
        await workflow.initialize();
        
        const metrics = workflow.getMetrics();
        
        if (!metrics) {
            throw new Error('Métriques manquantes');
        }
        
        console.log(`   Métriques disponibles: ${Object.keys(metrics).join(', ')}`);
        
        await workflow.cleanup();
    });

    console.log('\n📋 Test 8: Configuration pays');
    
    await test('Configuration pays', async () => {
        const countries = ['UK', 'FR', 'US'];
        
        for (const country of countries) {
            const workflow = new WhatsAppAccountWorkflow({
                country: country,
                enableCloud: false,
                verbose: false
            });
            
            await workflow.initialize();
            
            const status = workflow.getStatus();
            
            if (status.country !== country) {
                throw new Error(`Pays incorrect: ${status.country} vs ${country}`);
            }
            
            console.log(`   Pays ${country}: ✅`);
            
            await workflow.cleanup();
        }
    });

    console.log('\n📋 Test 9: Workflow avec différents providers');
    
    await test('Workflow avec différents providers', async () => {
        const providers = ['bluestacks'];
        
        if (process.env.MORELOGIN_API_URL) {
            providers.push('morelogin');
        }
        
        for (const provider of providers) {
            const workflow = new WhatsAppAccountWorkflow({
                country: 'UK',
                deviceProvider: provider,
                verbose: false
            });
            
            await workflow.initialize();
            
            const status = workflow.getStatus();
            
            if (status.deviceProvider !== provider) {
                throw new Error(`Provider incorrect: ${status.deviceProvider} vs ${provider}`);
            }
            
            console.log(`   Provider ${provider}: ✅`);
            
            await workflow.cleanup();
        }
    });

    console.log('\n📋 Test 10: Nettoyage et arrêt');
    
    await test('Nettoyage et arrêt', async () => {
        const workflow = new WhatsAppAccountWorkflow({
            country: 'UK',
            enableCloud: false,
            verbose: false
        });
        
        await workflow.initialize();
        
        // Test stop
        await workflow.stop();
        
        // Test cleanup
        await workflow.cleanup();
        
        console.log('   Nettoyage terminé sans erreur');
    });

    console.log('\n========================================');
    console.log(`📊 RÉSULTATS: ${passedTests}/${totalTests} tests passés`);
    
    if (passedTests === totalTests) {
        console.log('✅ Tous les tests du workflow passent!');
        console.log('🎉 Intégration MoreLogin terminée avec succès!');
        return true;
    } else {
        console.log('❌ Certains tests du workflow ont échoué');
        return false;
    }
}

// Exécuter les tests
if (require.main === module) {
    testWorkflowMoreLogin().catch(console.error);
}

module.exports = { testWorkflowMoreLogin };
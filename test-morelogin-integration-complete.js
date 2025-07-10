/**
 * Test d'intégration complet MoreLogin
 * Teste toute la chaîne d'intégration MoreLogin
 */

require('dotenv').config();

const { testMoreLoginApiClient } = require('./test-morelogin-api-client');
const { testRealMoreLoginApi } = require('./test-morelogin-api-real');
const { testMoreLoginProvider } = require('./test-morelogin-provider');
const { testServiceRegistryMoreLogin } = require('./test-service-registry-morelogin');
const { testWorkflowMoreLogin } = require('./test-workflow-morelogin');

async function runCompleteIntegrationTest() {
    console.log('🚀 TEST D\'INTÉGRATION COMPLET MORELOGIN');
    console.log('==========================================');
    
    const startTime = Date.now();
    let totalTests = 0;
    let passedTests = 0;
    const results = [];
    
    async function runTestSuite(name, testFn) {
        console.log(`\n📦 ${name}`);
        console.log('='.repeat(name.length + 4));
        
        try {
            const result = await testFn();
            results.push({ name, success: result });
            
            if (result) {
                passedTests++;
                console.log(`✅ ${name}: SUCCÈS`);
            } else {
                console.log(`❌ ${name}: ÉCHEC`);
            }
            
        } catch (error) {
            results.push({ name, success: false, error: error.message });
            console.log(`❌ ${name}: ERREUR - ${error.message}`);
        }
        
        totalTests++;
    }
    
    // Étape 1: Tests unitaires ApiClient
    await runTestSuite('Tests unitaires MoreLoginApiClient', testMoreLoginApiClient);
    
    // Étape 2: Tests API réelle
    await runTestSuite('Tests API MoreLogin réelle', testRealMoreLoginApi);
    
    // Étape 3: Tests Provider
    await runTestSuite('Tests MoreLoginProvider', testMoreLoginProvider);
    
    // Étape 4: Tests ServiceRegistry
    await runTestSuite('Tests ServiceRegistry avec MoreLogin', testServiceRegistryMoreLogin);
    
    // Étape 5: Tests Workflow
    await runTestSuite('Tests Workflow avec MoreLogin', testWorkflowMoreLogin);
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 RÉSULTATS FINAUX');
    console.log('='.repeat(50));
    
    results.forEach(({ name, success, error }) => {
        const status = success ? '✅' : '❌';
        const errorMsg = error ? ` (${error})` : '';
        console.log(`${status} ${name}${errorMsg}`);
    });
    
    console.log(`\n📈 STATISTIQUES:`);
    console.log(`   Tests passés: ${passedTests}/${totalTests}`);
    console.log(`   Taux de réussite: ${Math.round((passedTests / totalTests) * 100)}%`);
    console.log(`   Durée totale: ${duration}s`);
    
    if (passedTests === totalTests) {
        console.log('\n🎉 INTÉGRATION MORELOGIN COMPLÈTE ET FONCTIONNELLE!');
        console.log('📋 RÉSUMÉ DES FONCTIONNALITÉS:');
        console.log('   ✅ API Client MoreLogin opérationnel');
        console.log('   ✅ Provider Device MoreLogin intégré');
        console.log('   ✅ ServiceRegistry avec sélection automatique');
        console.log('   ✅ Workflow avec mode cloud et fallback');
        console.log('   ✅ Configuration flexible par environnement');
        
        console.log('\n🚀 UTILISATION:');
        console.log('   Mode cloud: new WhatsAppAccountWorkflow({ enableCloud: true })');
        console.log('   Mode local: new WhatsAppAccountWorkflow({ enableCloud: false })');
        console.log('   Auto-detect: new WhatsAppAccountWorkflow()');
        
        return true;
    } else {
        console.log('\n❌ CERTAINES PARTIES DE L\'INTÉGRATION ONT ÉCHOUÉ');
        console.log('🔧 Vérifiez les erreurs ci-dessus pour diagnostic');
        return false;
    }
}

// Fonction pour tester uniquement les composants de base
async function runBasicTest() {
    console.log('🧪 TEST DE BASE MORELOGIN');
    console.log('=========================');
    
    if (!process.env.MORELOGIN_API_URL) {
        console.log('❌ Variables d\'environnement MoreLogin manquantes');
        console.log('📋 Configurez d\'abord:');
        console.log('   MORELOGIN_API_URL=http://127.0.0.1:40000');
        console.log('   MORELOGIN_API_KEY=your_api_key');
        console.log('   MORELOGIN_API_ID=your_api_id');
        return false;
    }
    
    try {
        console.log('🔗 Test connexion API...');
        const apiResult = await testRealMoreLoginApi();
        
        if (apiResult) {
            console.log('✅ API MoreLogin locale fonctionnelle!');
            console.log('🎉 Prêt pour l\'intégration complète!');
            return true;
        } else {
            console.log('❌ API MoreLogin locale non fonctionnelle');
            return false;
        }
        
    } catch (error) {
        console.log(`❌ Erreur test de base: ${error.message}`);
        return false;
    }
}

// Fonction principale
async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--basic')) {
        return await runBasicTest();
    } else {
        return await runCompleteIntegrationTest();
    }
}

// Exécuter si appelé directement
if (require.main === module) {
    main()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('❌ Erreur fatale:', error);
            process.exit(1);
        });
}

module.exports = { runCompleteIntegrationTest, runBasicTest };
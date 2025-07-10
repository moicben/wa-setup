/**
 * Test d'intégration avec la vraie API MoreLogin locale
 * Teste les vraies API calls vers votre endpoint local
 */

// Charger les variables d'environnement
require('dotenv').config();

const { MoreLoginApiClient } = require('./src/services/device/providers/MoreLoginApiClient');

async function testRealMoreLoginApi() {
    console.log('🧪 TEST INTÉGRATION MORELOGIN API RÉELLE');
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
    
    // Vérifier que les variables d'environnement sont présentes
    if (!process.env.MORELOGIN_API_URL) {
        console.log('❌ MORELOGIN_API_URL non définie');
        return false;
    }
    
    if (!process.env.MORELOGIN_API_KEY) {
        console.log('❌ MORELOGIN_API_KEY non définie');
        return false;
    }
    
    if (!process.env.MORELOGIN_API_ID) {
        console.log('❌ MORELOGIN_API_ID non définie');
        return false;
    }
    
    console.log(`🔗 API URL: ${process.env.MORELOGIN_API_URL}`);
    console.log(`🔑 API ID: ${process.env.MORELOGIN_API_ID}`);
    console.log(`🔐 API Key: ${process.env.MORELOGIN_API_KEY.substring(0, 8)}...`);
    
    const client = new MoreLoginApiClient();
    
    console.log('\n📋 Test 1: Configuration du client');
    
    await test('Configuration du client', async () => {
        const metrics = client.getMetrics();
        if (metrics.config.apiUrl !== process.env.MORELOGIN_API_URL) {
            throw new Error('Configuration API URL incorrecte');
        }
        if (metrics.config.timeout !== 30000) {
            throw new Error('Configuration timeout incorrecte');
        }
    });

    console.log('\n📋 Test 2: Health Check API');
    
    await test('Health Check API', async () => {
        const health = await client.healthCheck();
        
        if (!health.status) {
            throw new Error('Health check ne retourne pas de status');
        }
        
        console.log(`   Status: ${health.status}`);
        if (health.status === 'unhealthy') {
            throw new Error(`API unhealthy: ${health.error}`);
        }
    });

    console.log('\n📋 Test 3: Obtenir la liste des profils');
    
    await test('Obtenir la liste des profils', async () => {
        const profiles = await client.getProfiles();
        
        if (!Array.isArray(profiles)) {
            throw new Error('getProfiles() ne retourne pas un tableau');
        }
        
        console.log(`   Profils trouvés: ${profiles.length}`);
        
        if (profiles.length > 0) {
            console.log(`   Premier profil: ${JSON.stringify(profiles[0], null, 2)}`);
        }
    });

    console.log('\n📋 Test 4: Métriques du client');
    
    await test('Métriques du client', async () => {
        const metrics = client.getMetrics();
        
        if (metrics.totalRequests === 0) {
            throw new Error('Aucune requête enregistrée dans les métriques');
        }
        
        console.log(`   Requêtes totales: ${metrics.totalRequests}`);
        console.log(`   Requêtes réussies: ${metrics.successfulRequests}`);
        console.log(`   Requêtes échouées: ${metrics.failedRequests}`);
        console.log(`   Taux de succès: ${metrics.successRate.toFixed(2)}%`);
        console.log(`   Temps de réponse moyen: ${metrics.averageResponseTime.toFixed(2)}ms`);
    });

    console.log('\n📋 Test 5: Test d\'erreur API');
    
    await test('Test d\'erreur API (endpoint inexistant)', async () => {
        try {
            await client.request('GET', '/api/endpoint-inexistant');
            throw new Error('Devrait avoir échoué');
        } catch (error) {
            if (error.message.includes('404') || error.message.includes('Not Found')) {
                // Erreur attendue
                console.log('   Erreur 404 correctement gérée');
            } else {
                throw error;
            }
        }
    });

    console.log('\n📋 Test 6: Timeout et robustesse');
    
    await test('Test timeout', async () => {
        const quickClient = new MoreLoginApiClient({
            timeout: 100 // 100ms très court
        });
        
        try {
            await quickClient.healthCheck();
            // Si ça passe, c'est que l'API est très rapide
            console.log('   API très rapide (< 100ms)');
        } catch (error) {
            if (error.message.includes('timeout')) {
                console.log('   Timeout correctement géré');
            } else {
                throw error;
            }
        }
    });

    console.log('\n========================================');
    console.log(`📊 RÉSULTATS: ${passedTests}/${totalTests} tests passés`);
    
    if (passedTests === totalTests) {
        console.log('✅ Tous les tests d\'intégration passent!');
        console.log('🎉 Votre API MoreLogin locale fonctionne correctement!');
        return true;
    } else {
        console.log('❌ Certains tests d\'intégration ont échoué');
        console.log('🔧 Vérifiez que votre API MoreLogin locale est démarrée');
        return false;
    }
}

// Exécuter les tests
if (require.main === module) {
    testRealMoreLoginApi().catch(console.error);
}

module.exports = { testRealMoreLoginApi };
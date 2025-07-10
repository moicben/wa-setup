/**
 * Test du MoreLoginProvider
 * Teste les fonctionnalités du provider device MoreLogin
 */

require('dotenv').config();
const { MoreLoginProvider } = require('./src/services/device/providers/MoreLoginProvider');

async function testMoreLoginProvider() {
    console.log('🧪 TEST MORELOGIN PROVIDER');
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
    
    // Vérifier les variables d'environnement
    if (!process.env.MORELOGIN_API_URL) {
        console.log('❌ Variables d\'environnement MoreLogin manquantes');
        return false;
    }
    
    const provider = new MoreLoginProvider({
        country: 'UK',
        timeout: 10000
    });
    
    console.log('\n📋 Test 1: Construction du provider');
    
    await test('Construction du provider', async () => {
        if (!provider.apiClient) {
            throw new Error('ApiClient non initialisé');
        }
        
        if (!provider.cloudPhoneManager) {
            throw new Error('CloudPhoneManager non initialisé');
        }
        
        if (provider.isConnected) {
            throw new Error('Provider ne devrait pas être connecté initialement');
        }
    });

    console.log('\n📋 Test 2: Initialisation du provider');
    
    await test('Initialisation du provider', async () => {
        const result = await provider.initialize();
        
        if (result !== true) {
            throw new Error('Initialisation a échoué');
        }
        
        console.log('   Provider initialisé avec succès');
    });

    console.log('\n📋 Test 3: Métriques initiales');
    
    await test('Métriques initiales', async () => {
        const metrics = provider.getMetrics();
        
        if (!metrics.morelogin) {
            throw new Error('Métriques MoreLogin manquantes');
        }
        
        if (metrics.morelogin.profilesCreated !== 0) {
            throw new Error('Profiles créés devrait être 0');
        }
        
        console.log(`   Métriques: ${JSON.stringify(metrics.morelogin, null, 2)}`);
    });

    console.log('\n📋 Test 4: Statut initial');
    
    await test('Statut initial', async () => {
        const status = await provider.getStatus();
        
        if (status.connected !== false) {
            throw new Error('Statut connecté devrait être false');
        }
        
        if (status.profileId !== null) {
            throw new Error('Profile ID devrait être null');
        }
        
        console.log(`   Statut: ${JSON.stringify(status, null, 2)}`);
    });

    console.log('\n📋 Test 5: Vérification de connexion non connecté');
    
    await test('Vérification connexion non connecté', async () => {
        try {
            await provider.click(100, 100);
            throw new Error('Devrait échouer - pas connecté');
        } catch (error) {
            if (error.message.includes('non connecté')) {
                console.log('   Erreur de connexion correctement gérée');
            } else {
                throw error;
            }
        }
    });

    console.log('\n📋 Test 6: Test des méthodes sans connexion');
    
    const methodsToTest = ['inputText', 'takeScreenshot', 'launchApp', 'killApp'];
    
    for (const method of methodsToTest) {
        await test(`Méthode ${method} sans connexion`, async () => {
            try {
                await provider[method]('test');
                throw new Error(`${method} devrait échouer - pas connecté`);
            } catch (error) {
                if (error.message.includes('non connecté')) {
                    console.log(`   ${method} correctement protégé`);
                } else {
                    throw error;
                }
            }
        });
    }

    console.log('\n📋 Test 7: Test de nettoyage');
    
    await test('Nettoyage sans connexion', async () => {
        await provider.cleanup();
        console.log('   Nettoyage effectué sans erreur');
    });

    console.log('\n📋 Test 8: Métriques API');
    
    await test('Métriques API', async () => {
        const metrics = provider.getMetrics();
        
        if (!metrics.api) {
            throw new Error('Métriques API manquantes');
        }
        
        if (metrics.api.totalRequests === 0) {
            throw new Error('Aucune requête API enregistrée');
        }
        
        console.log(`   Requêtes API: ${metrics.api.totalRequests}`);
        console.log(`   Taux de succès: ${metrics.api.successRate}%`);
    });

    console.log('\n========================================');
    console.log(`📊 RÉSULTATS: ${passedTests}/${totalTests} tests passés`);
    
    if (passedTests === totalTests) {
        console.log('✅ Tous les tests du provider passent!');
        return true;
    } else {
        console.log('❌ Certains tests du provider ont échoué');
        return false;
    }
}

// Test de connexion complète (optionnel - peut être long)
async function testFullConnection() {
    console.log('\n🔗 TEST CONNEXION COMPLÈTE (OPTIONNEL)');
    console.log('========================================');
    
    const provider = new MoreLoginProvider({
        country: 'UK',
        timeout: 30000
    });
    
    try {
        console.log('🚀 Initialisation...');
        await provider.initialize();
        
        console.log('🔗 Connexion au profil cloud...');
        await provider.connect();
        
        console.log('📊 Statut après connexion:');
        const status = await provider.getStatus();
        console.log(JSON.stringify(status, null, 2));
        
        console.log('📈 Métriques finales:');
        const metrics = provider.getMetrics();
        console.log(JSON.stringify(metrics, null, 2));
        
        console.log('🧹 Nettoyage...');
        await provider.cleanup();
        
        console.log('✅ Test de connexion complète réussi!');
        return true;
        
    } catch (error) {
        console.log(`❌ Test de connexion échoué: ${error.message}`);
        
        try {
            await provider.cleanup();
        } catch (cleanupError) {
            console.log(`❌ Erreur nettoyage: ${cleanupError.message}`);
        }
        
        return false;
    }
}

// Exécuter les tests
if (require.main === module) {
    testMoreLoginProvider()
        .then(success => {
            if (success) {
                console.log('\n🤔 Voulez-vous tester la connexion complète ?');
                console.log('(Cela créera et supprimera un profil MoreLogin)');
                console.log('Décommentez la ligne suivante pour tester:');
                console.log('// return testFullConnection();');
                
                // Décommentez cette ligne pour tester la connexion complète
                // return testFullConnection();
            }
        })
        .catch(console.error);
}

module.exports = { testMoreLoginProvider, testFullConnection };
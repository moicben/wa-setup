/**
 * Test du ServiceRegistry avec MoreLogin
 * Teste l'intégration du provider MoreLogin dans le ServiceRegistry
 */

require('dotenv').config();
const { getServiceRegistry, resetServiceRegistry } = require('./src/services/ServiceRegistry');

async function testServiceRegistryMoreLogin() {
    console.log('🧪 TEST SERVICE REGISTRY AVEC MORELOGIN');
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
    
    // Réinitialiser le registry
    resetServiceRegistry();
    
    const registry = getServiceRegistry();
    
    console.log('\n📋 Test 1: Enregistrement des factories');
    
    await test('Vérification des factories disponibles', async () => {
        const services = registry.getAvailableServices();
        console.log(`   Services disponibles: ${services.join(', ')}`);
        
        if (!services.includes('device')) {
            throw new Error('Factory device manquante');
        }
        
        if (process.env.MORELOGIN_API_URL) {
            if (!services.includes('morelogin')) {
                throw new Error('Factory morelogin manquante (API URL définie)');
            }
            console.log('   ✅ Factory MoreLogin enregistrée');
        } else {
            console.log('   ℹ️ Factory MoreLogin non enregistrée (API URL manquante)');
        }
        
        if (!services.includes('bluestacks')) {
            throw new Error('Factory bluestacks manquante');
        }
    });

    console.log('\n📋 Test 2: Création service device par défaut');
    
    await test('Création device par défaut', async () => {
        const device = await registry.get('device');
        
        if (!device) {
            throw new Error('Device service non créé');
        }
        
        console.log(`   Provider: ${device.constructor.name}`);
        console.log(`   Device ID: ${device.deviceId}`);
        
        await device.cleanup();
    });

    console.log('\n📋 Test 3: Création explicite BlueStacks');
    
    await test('Création explicite BlueStacks', async () => {
        // Réinitialiser le registry pour un test clean
        resetServiceRegistry();
        const freshRegistry = getServiceRegistry();
        
        const device = await freshRegistry.get('bluestacks');
        
        if (!device) {
            throw new Error('BlueStacks device non créé');
        }
        
        console.log(`   Provider: ${device.constructor.name}`);
        await device.cleanup();
    });

    if (process.env.MORELOGIN_API_URL) {
        console.log('\n📋 Test 4: Création explicite MoreLogin');
        
        await test('Création explicite MoreLogin', async () => {
            // Réinitialiser le registry pour un test clean
            resetServiceRegistry();
            const freshRegistry = getServiceRegistry();
            
            const device = await freshRegistry.get('morelogin');
            
            if (!device) {
                throw new Error('MoreLogin device non créé');
            }
            
            console.log(`   Provider: ${device.constructor.name}`);
            await device.cleanup();
        });

        console.log('\n📋 Test 5: Sélection automatique cloud');
        
        await test('Sélection automatique cloud', async () => {
            // Réinitialiser le registry pour un test clean
            resetServiceRegistry();
            const freshRegistry = getServiceRegistry();
            
            const device = await freshRegistry.createDeviceProvider({
                enableCloud: true,
                country: 'UK'
            });
            
            if (!device) {
                throw new Error('Device cloud non créé');
            }
            
            console.log(`   Provider sélectionné: ${device.constructor.name}`);
            await device.cleanup();
        });

        console.log('\n📋 Test 6: Fallback vers BlueStacks');
        
        await test('Fallback vers BlueStacks', async () => {
            // Simuler une API MoreLogin indisponible
            const originalUrl = process.env.MORELOGIN_API_URL;
            process.env.MORELOGIN_API_URL = 'http://localhost:99999'; // Port invalide
            
            try {
                // Réinitialiser le registry pour un test clean
                resetServiceRegistry();
                const freshRegistry = getServiceRegistry();
                
                const device = await freshRegistry.createDeviceProvider({
                    enableCloud: true,
                    country: 'UK'
                });
                
                if (!device) {
                    throw new Error('Device fallback non créé');
                }
                
                console.log(`   Provider fallback: ${device.constructor.name}`);
                await device.cleanup();
                
            } finally {
                // Restaurer l'URL originale
                process.env.MORELOGIN_API_URL = originalUrl;
            }
        });

        console.log('\n📋 Test 7: Provider spécifique par config');
        
        await test('Provider spécifique par config', async () => {
            // Réinitialiser le registry pour un test clean
            resetServiceRegistry();
            const freshRegistry = getServiceRegistry();
            
            const moreLoginDevice = await freshRegistry.createDeviceProvider({
                deviceProvider: 'morelogin',
                country: 'UK'
            });
            
            if (!moreLoginDevice) {
                throw new Error('MoreLogin device spécifique non créé');
            }
            
            console.log(`   Provider spécifique: ${moreLoginDevice.constructor.name}`);
            await moreLoginDevice.cleanup();
            
            // Test BlueStacks spécifique
            const blueStacksDevice = await freshRegistry.createDeviceProvider({
                deviceProvider: 'bluestacks'
            });
            
            if (!blueStacksDevice) {
                throw new Error('BlueStacks device spécifique non créé');
            }
            
            console.log(`   Provider spécifique: ${blueStacksDevice.constructor.name}`);
            await blueStacksDevice.cleanup();
        });
    }

    console.log('\n📋 Test 8: Health Check du registry');
    
    await test('Health Check du registry', async () => {
        // Réinitialiser le registry pour un test clean
        resetServiceRegistry();
        const freshRegistry = getServiceRegistry();
        
        // Créer quelques services
        await freshRegistry.get('device');
        
        const health = await freshRegistry.healthCheck();
        
        if (!health.status) {
            throw new Error('Health check sans statut');
        }
        
        console.log(`   Statut global: ${health.status}`);
        console.log(`   Services: ${health.summary.total}`);
        console.log(`   Sains: ${health.summary.healthy}`);
        console.log(`   Problèmes: ${health.summary.unhealthy}`);
    });

    console.log('\n📋 Test 9: Métriques du registry');
    
    await test('Métriques du registry', async () => {
        const metrics = registry.getAllMetrics();
        
        if (!metrics.registry) {
            throw new Error('Métriques registry manquantes');
        }
        
        console.log(`   Services créés: ${metrics.registry.servicesCreated}`);
        console.log(`   Services initialisés: ${metrics.registry.servicesInitialized}`);
        console.log(`   Dépendances résolues: ${metrics.registry.dependenciesResolved}`);
        console.log(`   Erreurs: ${metrics.registry.errors}`);
    });

    console.log('\n📋 Test 10: Nettoyage final');
    
    await test('Nettoyage final', async () => {
        await registry.cleanup();
        console.log('   Registry nettoyé');
    });

    console.log('\n========================================');
    console.log(`📊 RÉSULTATS: ${passedTests}/${totalTests} tests passés`);
    
    if (passedTests === totalTests) {
        console.log('✅ Tous les tests du ServiceRegistry passent!');
        return true;
    } else {
        console.log('❌ Certains tests du ServiceRegistry ont échoué');
        return false;
    }
}

// Exécuter les tests
if (require.main === module) {
    testServiceRegistryMoreLogin().catch(console.error);
}

module.exports = { testServiceRegistryMoreLogin };
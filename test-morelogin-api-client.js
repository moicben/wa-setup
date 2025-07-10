/**
 * Test simple pour MoreLoginApiClient
 * Test les fonctionnalités de base sans Jest
 */

const { MoreLoginApiClient } = require('./src/services/device/providers/MoreLoginApiClient');

async function testMoreLoginApiClient() {
    console.log('🧪 TEST MORELOGIN API CLIENT');
    console.log('========================================');
    
    let passedTests = 0;
    let totalTests = 0;
    
    function test(description, testFn) {
        totalTests++;
        try {
            testFn();
            console.log(`✅ ${description}`);
            passedTests++;
        } catch (error) {
            console.log(`❌ ${description}: ${error.message}`);
        }
    }
    
    function expect(value) {
        return {
            toBe: (expected) => {
                if (value !== expected) {
                    throw new Error(`Expected ${expected}, got ${value}`);
                }
            },
            toThrow: (expectedError) => {
                let threw = false;
                try {
                    if (typeof value === 'function') {
                        value();
                    }
                } catch (error) {
                    threw = true;
                    if (expectedError && !error.message.includes(expectedError)) {
                        throw new Error(`Expected error to contain "${expectedError}", got "${error.message}"`);
                    }
                }
                if (!threw) {
                    throw new Error('Expected function to throw an error');
                }
            },
            toHaveProperty: (prop) => {
                if (!(prop in value)) {
                    throw new Error(`Expected object to have property "${prop}"`);
                }
            }
        };
    }

    console.log('\n📋 Test 1: Construction avec variables d\'environnement');
    
    // Sauvegarder les variables d'environnement actuelles
    const originalEnv = {
        MORELOGIN_API_URL: process.env.MORELOGIN_API_URL,
        MORELOGIN_API_KEY: process.env.MORELOGIN_API_KEY,
        MORELOGIN_API_ID: process.env.MORELOGIN_API_ID
    };
    
    // Définir des valeurs de test
    process.env.MORELOGIN_API_URL = 'http://127.0.0.1:40000';
    process.env.MORELOGIN_API_KEY = 'test-api-key';
    process.env.MORELOGIN_API_ID = 'test-api-id';
    
    test('Construction avec variables d\'environnement', () => {
        const client = new MoreLoginApiClient();
        expect(client.config.apiUrl).toBe('http://127.0.0.1:40000');
        expect(client.config.apiKey).toBe('test-api-key');
        expect(client.config.apiId).toBe('test-api-id');
    });

    console.log('\n📋 Test 2: Configuration personnalisée');
    
    test('Configuration personnalisée', () => {
        const customConfig = {
            apiUrl: 'http://custom-url:8080',
            apiKey: 'custom-key',
            apiId: 'custom-id',
            timeout: 5000,
            retries: 5
        };
        
        const client = new MoreLoginApiClient(customConfig);
        expect(client.config.apiUrl).toBe('http://custom-url:8080');
        expect(client.config.apiKey).toBe('custom-key');
        expect(client.config.timeout).toBe(5000);
    });

    console.log('\n📋 Test 3: Validation des paramètres requis');
    
    test('Erreur si API URL manque', () => {
        delete process.env.MORELOGIN_API_URL;
        expect(() => new MoreLoginApiClient()).toThrow('MoreLogin API URL est requis');
        process.env.MORELOGIN_API_URL = 'http://127.0.0.1:40000';
    });
    
    test('Erreur si API Key manque', () => {
        delete process.env.MORELOGIN_API_KEY;
        expect(() => new MoreLoginApiClient()).toThrow('MoreLogin API Key est requis');
        process.env.MORELOGIN_API_KEY = 'test-api-key';
    });
    
    test('Erreur si API ID manque', () => {
        delete process.env.MORELOGIN_API_ID;
        expect(() => new MoreLoginApiClient()).toThrow('MoreLogin API ID est requis');
        process.env.MORELOGIN_API_ID = 'test-api-id';
    });

    console.log('\n📋 Test 4: Détection HTTPS');
    
    test('Détection HTTPS correcte', () => {
        const httpsClient = new MoreLoginApiClient({
            apiUrl: 'https://api.example.com',
            apiKey: 'key',
            apiId: 'id'
        });
        expect(httpsClient.isHttps).toBe(true);
        
        const httpClient = new MoreLoginApiClient({
            apiUrl: 'http://api.example.com',
            apiKey: 'key',
            apiId: 'id'
        });
        expect(httpClient.isHttps).toBe(false);
    });

    console.log('\n📋 Test 5: Métriques');
    
    test('Initialisation des métriques', () => {
        const client = new MoreLoginApiClient();
        const metrics = client.getMetrics();
        
        expect(metrics.totalRequests).toBe(0);
        expect(metrics.successfulRequests).toBe(0);
        expect(metrics.failedRequests).toBe(0);
        expect(metrics.successRate).toBe(0);
    });

    console.log('\n📋 Test 6: Configuration avec vraies variables d\'environnement');
    
    if (originalEnv.MORELOGIN_API_URL) {
        test('Construction avec vraies variables d\'environnement', () => {
            // Restaurer les vraies variables
            process.env.MORELOGIN_API_URL = originalEnv.MORELOGIN_API_URL;
            process.env.MORELOGIN_API_KEY = originalEnv.MORELOGIN_API_KEY;
            process.env.MORELOGIN_API_ID = originalEnv.MORELOGIN_API_ID;
            
            const client = new MoreLoginApiClient();
            expect(client.config.apiUrl).toBe(originalEnv.MORELOGIN_API_URL);
            expect(client.config.apiKey).toBe(originalEnv.MORELOGIN_API_KEY);
            expect(client.config.apiId).toBe(originalEnv.MORELOGIN_API_ID);
        });
    }

    console.log('\n📋 Test 7: Test de healthCheck (sans vraie API)');
    
    test('healthCheck structure', async () => {
        const client = new MoreLoginApiClient();
        
        // Mock de la méthode request pour éviter les vraies API calls
        client.request = async (method, endpoint) => {
            if (method === 'GET' && endpoint === '/api/health') {
                return { status: 'ok', version: '1.0.0' };
            }
            throw new Error('Unexpected request');
        };
        
        const result = await client.healthCheck();
        expect(result).toHaveProperty('status');
    });

    // Restaurer les variables d'environnement originales
    Object.keys(originalEnv).forEach(key => {
        if (originalEnv[key] !== undefined) {
            process.env[key] = originalEnv[key];
        } else {
            delete process.env[key];
        }
    });

    console.log('\n========================================');
    console.log(`📊 RÉSULTATS: ${passedTests}/${totalTests} tests passés`);
    
    if (passedTests === totalTests) {
        console.log('✅ Tous les tests passent!');
        return true;
    } else {
        console.log('❌ Certains tests ont échoué');
        return false;
    }
}

// Exécuter les tests
if (require.main === module) {
    testMoreLoginApiClient().catch(console.error);
}

module.exports = { testMoreLoginApiClient };
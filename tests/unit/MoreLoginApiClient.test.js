/**
 * Tests unitaires pour MoreLoginApiClient
 * Teste toutes les fonctionnalités du client API
 */

const { MoreLoginApiClient } = require('../../src/services/device/providers/MoreLoginApiClient');

describe('MoreLoginApiClient', () => {
    let originalEnv;
    
    beforeEach(() => {
        // Sauvegarder les variables d'environnement originales
        originalEnv = {
            MORELOGIN_API_URL: process.env.MORELOGIN_API_URL,
            MORELOGIN_API_KEY: process.env.MORELOGIN_API_KEY,
            MORELOGIN_API_ID: process.env.MORELOGIN_API_ID
        };
        
        // Définir des valeurs de test
        process.env.MORELOGIN_API_URL = 'http://127.0.0.1:40000';
        process.env.MORELOGIN_API_KEY = 'test-api-key';
        process.env.MORELOGIN_API_ID = 'test-api-id';
    });

    afterEach(() => {
        // Restaurer les variables d'environnement
        Object.keys(originalEnv).forEach(key => {
            if (originalEnv[key] !== undefined) {
                process.env[key] = originalEnv[key];
            } else {
                delete process.env[key];
            }
        });
    });

    describe('Constructor', () => {
        test('doit créer une instance avec les variables d\'environnement', () => {
            const client = new MoreLoginApiClient();
            
            expect(client.config.apiUrl).toBe('http://127.0.0.1:40000');
            expect(client.config.apiKey).toBe('test-api-key');
            expect(client.config.apiId).toBe('test-api-id');
            expect(client.config.timeout).toBe(30000);
            expect(client.config.retries).toBe(3);
        });

        test('doit accepter une configuration personnalisée', () => {
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
            expect(client.config.apiId).toBe('custom-id');
            expect(client.config.timeout).toBe(5000);
            expect(client.config.retries).toBe(5);
        });

        test('doit lancer une erreur si API URL manque', () => {
            delete process.env.MORELOGIN_API_URL;
            
            expect(() => {
                new MoreLoginApiClient();
            }).toThrow('MoreLogin API URL est requis (MORELOGIN_API_URL)');
        });

        test('doit lancer une erreur si API Key manque', () => {
            delete process.env.MORELOGIN_API_KEY;
            
            expect(() => {
                new MoreLoginApiClient();
            }).toThrow('MoreLogin API Key est requis (MORELOGIN_API_KEY)');
        });

        test('doit lancer une erreur si API ID manque', () => {
            delete process.env.MORELOGIN_API_ID;
            
            expect(() => {
                new MoreLoginApiClient();
            }).toThrow('MoreLogin API ID est requis (MORELOGIN_API_ID)');
        });

        test('doit détecter correctement HTTPS', () => {
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
    });

    describe('Métriques', () => {
        test('doit initialiser les métriques à zéro', () => {
            const client = new MoreLoginApiClient();
            const metrics = client.getMetrics();
            
            expect(metrics.totalRequests).toBe(0);
            expect(metrics.successfulRequests).toBe(0);
            expect(metrics.failedRequests).toBe(0);
            expect(metrics.averageResponseTime).toBe(0);
            expect(metrics.successRate).toBe(0);
            expect(metrics.lastRequestTime).toBeNull();
        });

        test('doit retourner les informations de configuration', () => {
            const client = new MoreLoginApiClient();
            const metrics = client.getMetrics();
            
            expect(metrics.config.apiUrl).toBe('http://127.0.0.1:40000');
            expect(metrics.config.timeout).toBe(30000);
            expect(metrics.config.retries).toBe(3);
        });
    });

    describe('Parsing URL', () => {
        test('doit parser correctement les URLs HTTP', () => {
            const client = new MoreLoginApiClient({
                apiUrl: 'http://localhost:8080',
                apiKey: 'key',
                apiId: 'id'
            });
            
            expect(client.baseUrl).toBe('http://localhost:8080');
            expect(client.isHttps).toBe(false);
        });

        test('doit parser correctement les URLs HTTPS', () => {
            const client = new MoreLoginApiClient({
                apiUrl: 'https://secure.api.com:443',
                apiKey: 'key',
                apiId: 'id'
            });
            
            expect(client.baseUrl).toBe('https://secure.api.com:443');
            expect(client.isHttps).toBe(true);
        });
    });

    describe('Gestion des erreurs', () => {
        test('doit gérer les erreurs de validation', () => {
            const scenarios = [
                { env: 'MORELOGIN_API_URL', error: 'MoreLogin API URL est requis' },
                { env: 'MORELOGIN_API_KEY', error: 'MoreLogin API Key est requis' },
                { env: 'MORELOGIN_API_ID', error: 'MoreLogin API ID est requis' }
            ];

            scenarios.forEach(({ env, error }) => {
                // Supprimer la variable d'environnement
                const originalValue = process.env[env];
                delete process.env[env];
                
                expect(() => {
                    new MoreLoginApiClient();
                }).toThrow(error);
                
                // Restaurer la variable
                if (originalValue !== undefined) {
                    process.env[env] = originalValue;
                }
            });
        });
    });

    describe('Configuration par défaut', () => {
        test('doit avoir des valeurs par défaut sensées', () => {
            const client = new MoreLoginApiClient();
            
            expect(client.config.timeout).toBe(30000); // 30 secondes
            expect(client.config.retries).toBe(3);
            expect(client.httpModule).toBeDefined();
        });
    });
});

// Tests d'intégration de base (sans vraie API)
describe('MoreLoginApiClient - Méthodes API', () => {
    let client;
    
    beforeEach(() => {
        process.env.MORELOGIN_API_URL = 'http://127.0.0.1:40000';
        process.env.MORELOGIN_API_KEY = 'test-key';
        process.env.MORELOGIN_API_ID = 'test-id';
        
        client = new MoreLoginApiClient();
    });

    test('healthCheck doit retourner un objet avec status', async () => {
        // Mock de la méthode request pour éviter les vraies API calls
        client.request = jest.fn().mockResolvedValue({ status: 'ok' });
        
        const result = await client.healthCheck();
        
        expect(result).toHaveProperty('status');
        expect(client.request).toHaveBeenCalledWith('GET', '/api/health');
    });

    test('getProfiles doit retourner un tableau', async () => {
        const mockProfiles = [
            { id: 'profile1', name: 'Test Profile 1' },
            { id: 'profile2', name: 'Test Profile 2' }
        ];
        
        client.request = jest.fn().mockResolvedValue({ profiles: mockProfiles });
        
        const profiles = await client.getProfiles();
        
        expect(Array.isArray(profiles)).toBe(true);
        expect(profiles).toEqual(mockProfiles);
        expect(client.request).toHaveBeenCalledWith('GET', '/api/profiles');
    });

    test('createProfile doit envoyer les données correctement', async () => {
        const profileData = { name: 'New Profile', country: 'UK' };
        const mockResponse = { id: 'new-profile-id', ...profileData };
        
        client.request = jest.fn().mockResolvedValue(mockResponse);
        
        const result = await client.createProfile(profileData);
        
        expect(result).toEqual(mockResponse);
        expect(client.request).toHaveBeenCalledWith('POST', '/api/profile/create', profileData);
    });

    test('deleteProfile doit retourner true en cas de succès', async () => {
        client.request = jest.fn().mockResolvedValue({});
        
        const result = await client.deleteProfile('profile-id');
        
        expect(result).toBe(true);
        expect(client.request).toHaveBeenCalledWith('DELETE', '/api/profile/profile-id');
    });

    test('startProfile doit retourner les informations de démarrage', async () => {
        const mockResponse = { profileId: 'profile-id', port: 5555 };
        
        client.request = jest.fn().mockResolvedValue(mockResponse);
        
        const result = await client.startProfile('profile-id');
        
        expect(result).toEqual(mockResponse);
        expect(client.request).toHaveBeenCalledWith('POST', '/api/profile/profile-id/start');
    });

    test('stopProfile doit retourner true en cas de succès', async () => {
        client.request = jest.fn().mockResolvedValue({});
        
        const result = await client.stopProfile('profile-id');
        
        expect(result).toBe(true);
        expect(client.request).toHaveBeenCalledWith('POST', '/api/profile/profile-id/stop');
    });

    test('getProfileStatus doit retourner le statut', async () => {
        const mockStatus = { profileId: 'profile-id', status: 'running' };
        
        client.request = jest.fn().mockResolvedValue(mockStatus);
        
        const result = await client.getProfileStatus('profile-id');
        
        expect(result).toEqual(mockStatus);
        expect(client.request).toHaveBeenCalledWith('GET', '/api/profile/profile-id/status');
    });
});

module.exports = { MoreLoginApiClient };
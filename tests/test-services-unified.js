#!/usr/bin/env node
/**
 * Tests unifiés pour tous les services
 * Phase 7: Tests essentiels simplifiés
 * 
 * Tests simplifiés mais complets pour les services unifiés
 */

const { getServiceRegistry } = require('../src/services');
const { setupInfrastructure } = require('../src/infrastructure');

class SimpleTestRunner {
    constructor() {
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
    }

    addTest(name, testFn) {
        this.tests.push({ name, testFn });
    }

    async runTests() {
        console.log('🧪 TESTS SERVICES UNIFIÉS');
        console.log(`📋 ${this.tests.length} tests\n`);

        for (const test of this.tests) {
            try {
                console.log(`🔄 ${test.name}`);
                await test.testFn();
                console.log(`✅ ${test.name}`);
                this.passed++;
            } catch (error) {
                console.log(`❌ ${test.name}: ${error.message}`);
                this.failed++;
            }
        }

        console.log(`\n🏁 RÉSULTATS`);
        console.log(`✅ Réussis: ${this.passed}`);
        console.log(`❌ Échoués: ${this.failed}`);
        console.log(`📊 Taux: ${Math.round((this.passed / (this.passed + this.failed)) * 100)}%`);
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

async function runTests() {
    const runner = new SimpleTestRunner();

    // ═══ TESTS INFRASTRUCTURE ═══
    runner.addTest('Infrastructure - Setup', async () => {
        const infra = setupInfrastructure();
        assert(infra.logger, 'Logger initialisé');
        assert(infra.validator, 'Validator initialisé');
        assert(infra.config, 'Config initialisé');
    });

    runner.addTest('Infrastructure - Logger', async () => {
        const { getLogger } = require('../src/infrastructure');
        const logger = getLogger();
        
        logger.info('Test log message');
        assert(logger.currentLevel >= 0, 'Logger fonctionnel');
    });

    runner.addTest('Infrastructure - Validator', async () => {
        const { getValidator } = require('../src/infrastructure');
        const validator = getValidator();
        
        const result = validator.validate(
            { phone: '+447700900123', country: 'UK' },
            { phone: ['required', 'string'], country: ['required', 'string'] }
        );
        
        assert(result.valid, 'Validation réussie');
    });

    runner.addTest('Infrastructure - Helpers', async () => {
        const { FileHelper, CryptoHelper, DateHelper } = require('../src/infrastructure');
        
        const id = CryptoHelper.generateId();
        assert(id.length === 16, 'ID généré');
        
        const formatted = DateHelper.format(new Date(), 'YYYY-MM-DD');
        assert(formatted.includes('-'), 'Date formatée');
    });

    // ═══ TESTS SERVICES ═══
    runner.addTest('Services - Registry création', async () => {
        const registry = getServiceRegistry();
        assert(registry, 'Registry créé');
        assert(typeof registry.get === 'function', 'Méthode get disponible');
    });

    runner.addTest('Services - SMS Factory', async () => {
        const { SMSServiceFactory } = require('../src/services');
        const providers = SMSServiceFactory.getAvailableProviders();
        assert(providers.includes('sms-activate'), 'Provider SMS-Activate disponible');
    });

    runner.addTest('Services - Device Factory', async () => {
        const { DeviceServiceFactory } = require('../src/services');
        const providers = DeviceServiceFactory.getAvailableProviders();
        assert(providers.includes('bluestacks'), 'Provider BlueStacks disponible');
    });

    runner.addTest('Services - WhatsApp Service', async () => {
        const { WhatsAppService } = require('../src/services');
        const whatsapp = new WhatsAppService();
        assert(whatsapp, 'WhatsApp service créé');
        assert(typeof whatsapp.launchAndWait === 'function', 'Méthodes disponibles');
    });

    // ═══ TESTS INTÉGRATION ═══
    runner.addTest('Intégration - Workflow Context', async () => {
        try {
            const { createWorkflowServices } = require('../src/services');
            const services = await createWorkflowServices();
            
            assert(services.sms, 'SMS service créé');
            assert(services.device, 'Device service créé');
            assert(services.whatsapp, 'WhatsApp service créé');
            assert(services.database, 'Database service créé');
            
            await services.cleanup();
        } catch (error) {
            // Ignorer les erreurs de connexion en mode test
            if (error.message.includes('ECONNREFUSED')) {
                console.log('⚠️  Connexion DB non disponible (normal en test)');
            } else {
                throw error;
            }
        }
    });

    runner.addTest('Intégration - Health Check', async () => {
        try {
            const { checkServicesHealth } = require('../src/services');
            const health = await checkServicesHealth();
            
            assert(health, 'Health check disponible');
            assert(health.status, 'Status présent');
        } catch (error) {
            // Ignorer les erreurs de connexion en mode test
            if (error.message.includes('ECONNREFUSED')) {
                console.log('⚠️  Connexion DB non disponible (normal en test)');
            } else {
                throw error;
            }
        }
    });

    // ═══ TESTS MÉTRIQUES ═══
    runner.addTest('Métriques - SMS Service', async () => {
        const { SMSActivateProvider } = require('../src/services');
        const provider = new SMSActivateProvider({ apiKey: 'test' });
        
        const metrics = provider.getMetrics();
        assert(metrics.provider === 'SMSActivateProvider', 'Métriques SMS disponibles');
        assert(typeof metrics.successRate === 'number', 'Taux de succès calculé');
    });

    runner.addTest('Métriques - Device Service', async () => {
        const { DeviceService } = require('../src/services');
        const device = new DeviceService({ deviceId: 'test' });
        
        const metrics = device.getMetrics();
        assert(metrics.deviceId === 'test', 'Métriques Device disponibles');
        assert(typeof metrics.commandsExecuted === 'number', 'Commandes comptées');
    });

    // ═══ TESTS ROBUSTESSE ═══
    runner.addTest('Robustesse - Erreurs gracieuses', async () => {
        const { SMSServiceFactory } = require('../src/services');
        
        try {
            SMSServiceFactory.createProvider('inexistant');
            assert(false, 'Exception attendue');
        } catch (error) {
            assert(error.message.includes('not found'), 'Erreur explicite');
        }
    });

    runner.addTest('Robustesse - Validation config', async () => {
        const { getValidator } = require('../src/infrastructure');
        const validator = getValidator();
        
        const result = validator.validateWithSchema(
            { phone: 'invalid', country: 'XX' },
            'account'
        );
        
        assert(!result.valid, 'Validation échoue pour données invalides');
        assert(result.errors, 'Erreurs détaillées');
    });

    // ═══ TESTS PERFORMANCE ═══
    runner.addTest('Performance - Création services', async () => {
        const start = Date.now();
        
        for (let i = 0; i < 10; i++) {
            const registry = getServiceRegistry();
            // Simulation rapide
        }
        
        const duration = Date.now() - start;
        assert(duration < 1000, 'Création rapide (< 1s)');
    });

    await runner.runTests();
}

// Exécuter si appelé directement
if (require.main === module) {
    runTests().catch(console.error);
}

module.exports = { runTests };
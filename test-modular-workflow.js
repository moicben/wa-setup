#!/usr/bin/env node

/**
 * Test de l'architecture modulaire des workflows
 */

const { BaseStep } = require('./src/workflows/base/BaseStep');
const { WorkflowContext } = require('./src/workflows/base/WorkflowContext');
const { InitializeAppStep } = require('./src/workflows/account/steps/InitializeAppStep');

async function testModularWorkflow() {
    console.log('🧪 TEST ARCHITECTURE MODULAIRE WORKFLOW');
    console.log('=' .repeat(50));

    let passed = 0;
    let failed = 0;

    function assert(condition, message) {
        if (condition) {
            console.log(`✅ ${message}`);
            passed++;
        } else {
            console.error(`❌ ${message}`);
            failed++;
        }
    }

    try {
        // Test 1: BaseStep
        console.log('\n🏗️ Test 1: BaseStep...');
        const baseStep = new BaseStep('Test Step');
        assert(baseStep.name === 'Test Step', 'BaseStep name');
        assert(baseStep.executed === false, 'BaseStep initial state');
        assert(baseStep.dependencies.length === 0, 'BaseStep default dependencies');
        assert(typeof baseStep.execute === 'function', 'BaseStep execute method');

        // Test 2: WorkflowContext
        console.log('\n📋 Test 2: WorkflowContext...');
        const context = new WorkflowContext({
            country: 'UK',
            smsApiKey: 'test-key'
        });
        assert(context.config.country === 'UK', 'Context country config');
        assert(context.session.attempt === 1, 'Context initial attempt');
        assert(typeof context.setServices === 'function', 'Context setServices method');
        assert(typeof context.getStepResult === 'function', 'Context getStepResult method');

        // Test 3: InitializeAppStep
        console.log('\n📱 Test 3: InitializeAppStep...');
        const initStep = new InitializeAppStep();
        assert(initStep.name === 'Initialize App', 'InitializeAppStep name');
        assert(initStep.dependencies.length === 0, 'InitializeAppStep no dependencies');
        assert(initStep.whatsappPackage === 'com.whatsapp', 'InitializeAppStep package');
        assert(typeof initStep._execute === 'function', 'InitializeAppStep _execute method');

        // Test 4: Gestion des résultats
        console.log('\n📊 Test 4: Gestion des résultats...');
        context.setStepResult('test_step', { success: true, data: 'test' });
        assert(context.hasStepResult('test_step'), 'Context hasStepResult');
        assert(context.getStepResult('test_step').success === true, 'Context getStepResult value');
        assert(!context.hasStepResult('nonexistent'), 'Context missing step');

        // Test 5: Métriques
        console.log('\n📈 Test 5: Métriques...');
        context.recordError('test_step', new Error('Test error'));
        context.recordScreenshot('test.png', 'test_step');
        const metrics = context.getMetrics();
        assert(metrics.errors.length === 1, 'Context error recording');
        assert(metrics.screenshots.length === 1, 'Context screenshot recording');
        assert(metrics.stepsExecuted === 1, 'Context steps executed count');

        // Test 6: Services mock pour test complet
        console.log('\n🔧 Test 6: Services mock...');
        const mockBluestack = {
            resetApp: async () => true,
            launchApp: async () => true,
            takeScreenshot: async (name) => `./screenshots/${name}`,
            executeADB: async () => ({ stdout: 'com.whatsapp' }),
            checkStatus: async () => ({ connected: true, whatsappInstalled: true }),
            wait: async () => true
        };
        
        const mockSMS = {
            buyNumberWithFallbackAndPricing: async () => ({ success: true })
        };

        context.setServices(mockBluestack, mockSMS);
        context.validate(); // Ne devrait pas lever d'erreur
        assert(context.bluestack !== null, 'Context BlueStack service set');
        assert(context.sms !== null, 'Context SMS service set');

        // Test 7: Exécution d'étape simulée
        console.log('\n⚙️ Test 7: Exécution d\'étape simulée...');
        
        // Test canExecute
        const canExecute = await initStep.canExecute(context);
        assert(canExecute === true, 'InitializeAppStep canExecute with mocks');

        // Test de la description
        const description = initStep.getDescription();
        assert(typeof description.name === 'string', 'InitializeAppStep description name');
        assert(Array.isArray(description.inputs), 'InitializeAppStep description inputs');
        assert(Array.isArray(description.outputs), 'InitializeAppStep description outputs');

        // Test 8: Gestion des tentatives
        console.log('\n🔄 Test 8: Gestion des tentatives...');
        assert(context.getCurrentAttempt() === 1, 'Context initial attempt');
        assert(!context.isLastAttempt(), 'Context not last attempt initially');
        
        context.incrementAttempt();
        assert(context.getCurrentAttempt() === 2, 'Context incremented attempt');
        
        // Test 9: Workflow Context helpers
        console.log('\n🛠️ Test 9: Context helpers...');
        context.updateSession({ phone: '+441234567890', smsId: 'test123' });
        assert(context.getPhoneNumber() === '+441234567890', 'Context phone number');
        assert(context.getSMSId() === 'test123', 'Context SMS ID');

        // Test 10: Résultat final
        console.log('\n🏁 Test 10: Résultat final...');
        const finalResult = context.createResult(true, { customData: 'test' });
        assert(finalResult.success === true, 'Final result success');
        assert(finalResult.phone === '+441234567890', 'Final result phone');
        assert(finalResult.attempts === 2, 'Final result attempts');
        assert(finalResult.customData === 'test', 'Final result custom data');

        console.log('\n📊 Résultats:');
        console.log(`✅ Tests réussis: ${passed}`);
        console.log(`❌ Tests échoués: ${failed}`);
        console.log(`🎯 Taux de réussite: ${Math.round((passed / (passed + failed)) * 100)}%`);

        if (failed === 0) {
            console.log('\n🎉 ARCHITECTURE MODULAIRE VALIDÉE !');
            console.log('🏗️ Prêt pour l\'extraction des étapes suivantes');
            console.log('🔧 BaseStep, WorkflowContext et InitializeAppStep fonctionnent');
        } else {
            console.log('\n⚠️ Certains tests ont échoué, vérifiez l\'architecture');
        }

        return failed === 0;

    } catch (error) {
        console.error(`\n💥 Erreur test: ${error.message}`);
        console.error(error.stack);
        return false;
    }
}

// Exécution
if (require.main === module) {
    testModularWorkflow()
        .then(success => process.exit(success ? 0 : 1))
        .catch(error => {
            console.error(`Fatal error: ${error.message}`);
            process.exit(1);
        });
}

module.exports = { testModularWorkflow }; 
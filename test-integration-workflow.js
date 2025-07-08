#!/usr/bin/env node

/**
 * Test d'intégration du workflow modulaire
 * Simule un workflow complet avec les nouvelles étapes
 */

const { WorkflowContext } = require('./src/workflows/base/WorkflowContext');
const { InitializeAppStep } = require('./src/workflows/account/steps/InitializeAppStep');
const { BuyPhoneNumberStep } = require('./src/workflows/account/steps/BuyPhoneNumberStep');
const { BlueStackController } = require('./src/services/bluestack/BlueStackController');
const { SMSManagerExtended } = require('./src/core/sms');

async function testIntegrationWorkflow() {
    console.log('🧪 TEST D\'INTÉGRATION WORKFLOW MODULAIRE');
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
        // Setup du contexte
        console.log('\n🏗️ Setup du contexte...');
        const context = new WorkflowContext({
            country: 'UK',
            smsApiKey: 'test-key-simulation',
            deviceId: '127.0.0.1:5555'
        });
        
        // Services simulés (plus réalistes que les mocks basiques)
        const mockBlueStack = {
            resetApp: async (pkg) => {
                console.log(`📱 Simulation: Reset ${pkg}`);
                await new Promise(r => setTimeout(r, 100));
                return true;
            },
            launchApp: async (pkg) => {
                console.log(`🚀 Simulation: Launch ${pkg}`);
                await new Promise(r => setTimeout(r, 200));
                return true;
            },
            takeScreenshot: async (name) => {
                console.log(`📸 Simulation: Screenshot ${name}`);
                return `./screenshots/${name}`;
            },
            executeADB: async (cmd) => {
                console.log(`🔧 Simulation: ADB ${cmd}`);
                return { stdout: 'com.whatsapp' };
            },
            checkStatus: async () => {
                return { connected: true, whatsappInstalled: true };
            },
            wait: async (delay) => {
                await new Promise(r => setTimeout(r, 10)); // Délai réduit pour test
                return true;
            }
        };

        const mockSMS = {
            buyNumberWithFallbackAndPricing: async (country) => {
                console.log(`📞 Simulation: Achat numéro ${country}`);
                await new Promise(r => setTimeout(r, 300));
                return {
                    success: true,
                    number: '441234567890',
                    fullNumber: '+441234567890',
                    id: 'test_sms_id_123',
                    parsed: {
                        success: true,
                        countryCode: '44',
                        localNumber: '1234567890',
                        country: 'UK'
                    },
                    countryUsed: country,
                    price: 0.15,
                    operator: 'three'
                };
            },
            getBalance: async () => {
                return { success: true, balance: 5.0 };
            }
        };

        context.setServices(mockBlueStack, mockSMS);
        assert(true, 'Contexte et services configurés');

        // Test 1: Création et exécution InitializeAppStep
        console.log('\n📱 Test 1: InitializeAppStep...');
        const initStep = new InitializeAppStep();
        
        const canExecuteInit = await initStep.canExecute(context);
        assert(canExecuteInit === true, 'InitializeAppStep can execute');
        
        const startTime = Date.now();
        const initResult = await initStep.execute(context);
        const initDuration = Date.now() - startTime;
        
        assert(initResult.success === true, 'InitializeAppStep execution success');
        assert(initResult.appPackage === 'com.whatsapp', 'InitializeAppStep correct package');
        assert(typeof initResult.screenshotPath === 'string', 'InitializeAppStep screenshot taken');
        assert(initDuration < 1000, `InitializeAppStep performance (${initDuration}ms)`);
        
        context.setStepResult('Initialize App', initResult);

        // Test 2: Création et exécution BuyPhoneNumberStep
        console.log('\n📞 Test 2: BuyPhoneNumberStep...');
        const buyStep = new BuyPhoneNumberStep();
        
        const canExecuteBuy = await buyStep.canExecute(context);
        assert(canExecuteBuy === true, 'BuyPhoneNumberStep can execute');
        
        const buyStartTime = Date.now();
        const buyResult = await buyStep.execute(context);
        const buyDuration = Date.now() - buyStartTime;
        
        assert(buyResult.success === true, 'BuyPhoneNumberStep execution success');
        assert(buyResult.number === '441234567890', 'BuyPhoneNumberStep correct number');
        assert(buyResult.fullNumber === '+441234567890', 'BuyPhoneNumberStep correct full number');
        assert(buyResult.smsId === 'test_sms_id_123', 'BuyPhoneNumberStep correct SMS ID');
        assert(buyResult.operator === 'three', 'BuyPhoneNumberStep correct operator');
        assert(buyDuration < 1000, `BuyPhoneNumberStep performance (${buyDuration}ms)`);
        
        context.setStepResult('Buy Phone Number', buyResult);

        // Test 3: Vérification contexte après exécution
        console.log('\n📊 Test 3: État du contexte...');
        assert(context.getPhoneNumber() === '441234567890', 'Context phone number updated');
        assert(context.getSMSId() === 'test_sms_id_123', 'Context SMS ID updated');
        assert(context.hasStepResult('Initialize App'), 'Context has init step result');
        assert(context.hasStepResult('Buy Phone Number'), 'Context has buy step result');

        const allResults = context.getAllStepResults();
        assert(Object.keys(allResults).length === 2, 'Context has both step results');

        // Test 4: Métriques et logs
        console.log('\n📈 Test 4: Métriques...');
        const metrics = context.getMetrics();
        assert(metrics.stepsExecuted === 2, 'Context steps executed count');
        assert(metrics.totalDuration > 0, 'Context total duration recorded');
        assert(!metrics.hasErrors, 'Context no errors recorded');

        // Test 5: Gestion des dépendances
        console.log('\n🔗 Test 5: Dépendances...');
        
        // BuyPhoneNumberStep dépend de InitializeAppStep
        assert(buyStep.dependencies.includes('Initialize App'), 'BuyPhoneNumberStep has correct dependency');
        
        // Tester avec contexte sans dépendance
        const contextWithoutInit = new WorkflowContext({ country: 'UK' });
        contextWithoutInit.setServices(mockBlueStack, mockSMS);
        
                 const buyStepWithoutDep = new BuyPhoneNumberStep();
         try {
             await buyStepWithoutDep.execute(contextWithoutInit);
             assert(false, 'BuyPhoneNumberStep should fail without dependency');
         } catch (error) {
             assert(error.message.includes('Dépendance manquante'), 'BuyPhoneNumberStep fails correctly without dependency');
         }

        // Test 6: Performance globale
        console.log('\n⚡ Test 6: Performance globale...');
        const totalWorkflowDuration = Date.now() - context.session.startTime;
        assert(totalWorkflowDuration < 2000, `Workflow total performance (${totalWorkflowDuration}ms)`);

        // Test 7: Résultat final
        console.log('\n🏁 Test 7: Résultat final...');
        const finalResult = context.createResult(true, { 
            testMode: true,
            stepsCompleted: ['Initialize App', 'Buy Phone Number']
        });
        
        assert(finalResult.success === true, 'Final result success');
        assert(finalResult.phone === '441234567890', 'Final result phone');
        assert(finalResult.country === 'UK', 'Final result country');
        assert(finalResult.testMode === true, 'Final result custom data');
        assert(finalResult.metrics.stepsExecuted === 2, 'Final result metrics');

        // Test 8: Comparaison avec workflow original
        console.log('\n🔄 Test 8: Compatibilité workflow original...');
        
        // Importer le workflow original
        const { WhatsAppWorkflow } = require('./src/workflow');
        const originalWorkflow = new WhatsAppWorkflow({ 
            country: 'UK',
            smsApiKey: 'test-key'
        });
        
        // Vérifier que les méthodes essentielles existent toujours
        const essentialMethods = ['initialize', 'createAccount', 'inputPhoneNumber'];
        for (const method of essentialMethods) {
            assert(typeof originalWorkflow[method] === 'function', `Original workflow ${method} method exists`);
        }

        console.log('\n📊 Résultats du test d\'intégration:');
        console.log(`✅ Tests réussis: ${passed}`);
        console.log(`❌ Tests échoués: ${failed}`);
        console.log(`🎯 Taux de réussite: ${Math.round((passed / (passed + failed)) * 100)}%`);
        console.log(`⏱️ Durée totale: ${totalWorkflowDuration}ms`);

        if (failed === 0) {
            console.log('\n🎉 TEST D\'INTÉGRATION RÉUSSI !');
            console.log('🏗️ Architecture modulaire entièrement fonctionnelle');
            console.log('⚡ Performance excellente');
            console.log('🔗 Gestion des dépendances opérationnelle');
            console.log('📊 Métriques et logging complets');
            console.log('✅ Prêt pour l\'intégration MoreLogin et Supabase');
        } else {
            console.log('\n⚠️ Certains tests d\'intégration ont échoué');
        }

        return failed === 0;

    } catch (error) {
        console.error(`\n💥 Erreur test d'intégration: ${error.message}`);
        console.error(error.stack);
        return false;
    }
}

// Exécution
if (require.main === module) {
    testIntegrationWorkflow()
        .then(success => process.exit(success ? 0 : 1))
        .catch(error => {
            console.error(`Fatal error: ${error.message}`);
            process.exit(1);
        });
}

module.exports = { testIntegrationWorkflow }; 
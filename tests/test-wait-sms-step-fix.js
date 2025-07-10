/**
 * Test rapide pour vérifier que WaitForSMSStep ne plante plus
 * Vérifie que l'erreur "Cannot read properties of undefined (reading 'info')" est résolue
 */

const { WaitForSMSStep } = require('../src/workflows/account/steps/WaitForSMSStep');

async function testWaitForSMSStepFix() {
    console.log('🧪 TEST CORRECTION WAITFORSMSSTEP');
    console.log('================================');
    
    let testsPassed = 0;
    let totalTests = 0;
    
    function test(description, testFn) {
        totalTests++;
        console.log(`📋 ${description}...`);
        try {
            testFn();
            console.log(`✅ ${description}`);
            testsPassed++;
        } catch (error) {
            console.log(`❌ ${description}: ${error.message}`);
        }
    }
    
    console.log('\n📋 Test 1: Construction de WaitForSMSStep');
    
    test('Construction de WaitForSMSStep', () => {
        const step = new WaitForSMSStep();
        
        if (!step.name || step.name !== 'WaitForSMSStep') {
            throw new Error('Nom de step incorrect');
        }
        
        if (!step.description) {
            throw new Error('Description manquante');
        }
        
        console.log(`   Nom: ${step.name}`);
        console.log(`   Description: ${step.description}`);
        console.log(`   Timeout: ${step.timeout}ms`);
    });

    console.log('\n📋 Test 2: Validation des prérequis (sans contexte valide)');
    
    test('Validation prérequis avec contexte invalide', () => {
        const step = new WaitForSMSStep();
        
        // Contexte mock sans SMS ID
        const mockContext = {
            getSMSId: () => null,
            smsManager: null
        };
        
        try {
            step.validatePrerequisites(mockContext);
            throw new Error('Devrait échouer avec contexte invalide');
        } catch (error) {
            if (error.message.includes('SMS ID requis')) {
                console.log('   Validation correctly rejette contexte sans SMS ID');
            } else {
                throw error;
            }
        }
    });

    console.log('\n📋 Test 3: Validation avec SMS ID mais sans SMS Manager');
    
    test('Validation avec SMS ID mais sans manager', () => {
        const step = new WaitForSMSStep();
        
        const mockContext = {
            getSMSId: () => '123456',
            smsManager: null
        };
        
        try {
            step.validatePrerequisites(mockContext);
            throw new Error('Devrait échouer sans SMS Manager');
        } catch (error) {
            if (error.message.includes('SMS Manager requis')) {
                console.log('   Validation correctly rejette contexte sans SMS Manager');
            } else {
                throw error;
            }
        }
    });

    console.log('\n📋 Test 4: Validation avec prérequis valides');
    
    test('Validation avec prérequis valides', () => {
        const step = new WaitForSMSStep();
        
        const mockContext = {
            getSMSId: () => '123456',
            smsManager: { waitForSMS: () => {} }
        };
        
        const result = step.validatePrerequisites(mockContext);
        
        if (result !== true) {
            throw new Error('Validation devrait réussir avec prérequis valides');
        }
        
        console.log('   Validation réussie avec prérequis valides');
    });

    console.log('\n📋 Test 5: Test de l\'exécution (simulation d\'erreur)');
    
    test('Test exécution avec erreur simulée', async () => {
        const step = new WaitForSMSStep();
        
        const mockContext = {
            getSMSId: () => '123456',
            smsManager: {
                waitForSMS: async () => {
                    throw new Error('Erreur simulée SMS');
                }
            },
            recordMetric: () => {}
        };
        
        try {
            await step._execute(mockContext);
            throw new Error('Devrait échouer avec erreur simulée');
        } catch (error) {
            if (error.message.includes('Erreur simulée SMS')) {
                console.log('   Erreur simulée correctement gérée');
            } else {
                throw error;
            }
        }
    });

    console.log('\n📋 Test 6: Test de cleanup avec erreur');
    
    test('Test cleanup avec erreur', async () => {
        const step = new WaitForSMSStep();
        
        const mockContext = {
            getSMSId: () => '123456',
            smsManager: {
                cancelNumber: async () => {
                    console.log('   Mock cancelNumber appelé');
                }
            }
        };
        
        const mockError = new Error('Erreur de test');
        
        // Cette opération ne devrait plus planter avec "Cannot read properties of undefined"
        await step.cleanup(mockContext, mockError);
        
        console.log('   Cleanup exécuté sans erreur logger');
    });

    console.log('\n📋 Test 7: Test des métriques');
    
    test('Test getStepMetrics', () => {
        const step = new WaitForSMSStep();
        
        const mockContext = {
            getSMSId: () => '123456',
            getSMSCode: () => '654321'
        };
        
        const metrics = step.getStepMetrics(mockContext);
        
        if (!metrics || typeof metrics !== 'object') {
            throw new Error('Métriques manquantes');
        }
        
        if (metrics.sms_id !== '123456') {
            throw new Error('SMS ID incorrect dans métriques');
        }
        
        console.log(`   Métriques: ${JSON.stringify(metrics, null, 2)}`);
    });

    console.log('\n================================');
    console.log(`📊 RÉSULTATS: ${testsPassed}/${totalTests} tests passés`);
    
    if (testsPassed === totalTests) {
        console.log('✅ TOUTES LES CORRECTIONS FONCTIONNENT!');
        console.log('🎉 WaitForSMSStep ne devrait plus planter avec "Cannot read properties of undefined"');
        return true;
    } else {
        console.log('❌ Certaines corrections ont des problèmes');
        return false;
    }
}

// Exécuter le test
if (require.main === module) {
    testWaitForSMSStepFix().catch(console.error);
}

module.exports = { testWaitForSMSStepFix };
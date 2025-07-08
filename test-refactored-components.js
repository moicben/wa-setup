#!/usr/bin/env node

/**
 * Test des composants refactorisés
 */

const { PhoneNumberParser } = require('./src/core/sms/parsers');
const { ADBConnection, InputSimulator } = require('./src/core/device');
const { DelayManager } = require('./src/utils/timing');
const { BlueStackController } = require('./src/services/bluestack/BlueStackController');

async function testRefactoredComponents() {
    console.log('🧪 TEST DES COMPOSANTS REFACTORISÉS');
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
        // Test 1: PhoneNumberParser (déjà testé mais on vérifie l'import)
        console.log('\n📱 Test 1: PhoneNumberParser...');
        const ukNumber = PhoneNumberParser.parseNumber('441234567890', 'UK');
        assert(ukNumber.success === true, 'PhoneNumberParser UK parsing');
        assert(ukNumber.countryCode === '44', 'UK country code correct');

        // Test 2: DelayManager
        console.log('\n⏱️ Test 2: DelayManager...');
        const delayManager = new DelayManager();
        
        const startTime = Date.now();
        await delayManager.wait(100); // 100ms
        const elapsed = Date.now() - startTime;
        assert(elapsed >= 95 && elapsed <= 150, `DelayManager wait timing (${elapsed}ms)`);
        
        assert(typeof delayManager.getDelays === 'function', 'DelayManager getDelays method');
        const defaultDelays = delayManager.getDelays();
        assert(defaultDelays.short === 500, 'DelayManager default short delay');

        // Test 3: ADBConnection (sans connexion réelle)
        console.log('\n🔌 Test 3: ADBConnection...');
        const adbConnection = new ADBConnection({ deviceId: '127.0.0.1:5555' });
        assert(adbConnection.getDeviceId() === '127.0.0.1:5555', 'ADBConnection device ID');
        assert(adbConnection.isConnected() === false, 'ADBConnection initial state');

        // Test 4: InputSimulator
        console.log('\n🎮 Test 4: InputSimulator...');
        const inputSimulator = new InputSimulator(adbConnection, delayManager);
        assert(typeof inputSimulator.click === 'function', 'InputSimulator click method');
        assert(typeof inputSimulator.inputText === 'function', 'InputSimulator inputText method');
        assert(typeof inputSimulator.pressNamedKey === 'function', 'InputSimulator pressNamedKey method');

        // Test 5: BlueStackController refactorisé
        console.log('\n🖥️ Test 5: BlueStackController refactorisé...');
        const controller = new BlueStackController({ deviceId: '127.0.0.1:5555' });
        assert(controller.isInitialized() === false, 'BlueStackController initial state');
        assert(typeof controller.click === 'function', 'BlueStackController click delegation');
        assert(typeof controller.wait === 'function', 'BlueStackController wait delegation');
        assert(typeof controller.getADB === 'function', 'BlueStackController getADB method');
        assert(typeof controller.getInputSimulator === 'function', 'BlueStackController getInputSimulator method');
        assert(typeof controller.getDelayManager === 'function', 'BlueStackController getDelayManager method');

        // Test des nouvelles fonctionnalités étendues
        assert(typeof controller.longPress === 'function', 'BlueStackController longPress method');
        assert(typeof controller.doubleClick === 'function', 'BlueStackController doubleClick method');
        assert(typeof controller.waitUntil === 'function', 'BlueStackController waitUntil method');
        assert(typeof controller.retry === 'function', 'BlueStackController retry method');

        // Test 6: Intégration des composants
        console.log('\n🔗 Test 6: Intégration des composants...');
        const adb = controller.getADB();
        const input = controller.getInputSimulator();
        const delayMgr = controller.getDelayManager();
        
        assert(adb instanceof ADBConnection, 'Controller ADB component type');
        assert(input instanceof InputSimulator, 'Controller Input component type');
        assert(delayMgr instanceof DelayManager, 'Controller Delay component type');

        // Test 7: Compatibilité avec l'ancien workflow
        console.log('\n🔄 Test 7: Compatibilité ancien workflow...');
        const { BlueStackController: OldController } = require('./src/core/bluestack');
        const oldController = new OldController({ deviceId: '127.0.0.1:5555' });
        
        // Vérifier que les méthodes essentielles existent
        const essentialMethods = ['initialize', 'click', 'inputText', 'pressKey', 'wait', 'takeScreenshot', 'checkStatus'];
        for (const method of essentialMethods) {
            assert(typeof oldController[method] === 'function', `Old controller ${method} method`);
            assert(typeof controller[method] === 'function', `New controller ${method} method`);
        }

        console.log('\n📊 Résultats:');
        console.log(`✅ Tests réussis: ${passed}`);
        console.log(`❌ Tests échoués: ${failed}`);
        console.log(`🎯 Taux de réussite: ${Math.round((passed / (passed + failed)) * 100)}%`);

        if (failed === 0) {
            console.log('\n🎉 TOUS LES COMPOSANTS REFACTORISÉS FONCTIONNENT !');
            console.log('🏗️ Architecture modulaire validée');
            console.log('🔧 Prêt pour la migration du workflow');
        } else {
            console.log('\n⚠️ Certains tests ont échoué, vérifiez les composants');
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
    testRefactoredComponents()
        .then(success => process.exit(success ? 0 : 1))
        .catch(error => {
            console.error(`Fatal error: ${error.message}`);
            process.exit(1);
        });
}

module.exports = { testRefactoredComponents }; 
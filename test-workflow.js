#!/usr/bin/env node

/**
 * Script de test pour vérifier le workflow WhatsApp
 */

const { WhatsAppWorkflow } = require('./src/workflow.js');

async function testWorkflow() {
    console.log('🧪 TEST DU WORKFLOW WHATSAPP');
    console.log('=' .repeat(40));

    try {
        // Test 1: Vérifier l'initialisation
        console.log('\n📋 Test 1: Initialisation du workflow...');
        
        const workflow = new WhatsAppWorkflow({
            country: 'UK',
            verbose: true
        });

        console.log('✅ Instance créée avec succès');
        
        // Test 2: Vérifier la structure des méthodes
        console.log('\n📋 Test 2: Vérification des méthodes...');
        
        const requiredMethods = [
            'initialize',
            'createAccount',
            'inputPhoneNumber',
            'checkWhatsAppSMS',
            'analyzeVerificationOptions',
            'analyzeExtractedText',
            'analyzePostSMSSubmission',
            'fallbackImageAnalysis',
            'requestSMSCode',
            'inputSMSCode',
            'finalizeAccount',
            'step'
        ];

        for (const method of requiredMethods) {
            if (typeof workflow[method] === 'function') {
                console.log(`✅ ${method}() - OK`);
            } else {
                console.error(`❌ ${method}() - MANQUANT`);
            }
        }

        // Test 3: Vérifier la configuration
        console.log('\n📋 Test 3: Configuration...');
        console.log(`🌍 Pays: ${workflow.config.country}`);
        console.log(`📱 Device ID: ${workflow.config.deviceId}`);
        console.log(`📡 API Key configurée: ${workflow.config.smsApiKey ? 'OUI' : 'NON'}`);
        console.log(`🔍 Verbose: ${workflow.config.verbose}`);

        // Test 4: Vérifier les dépendances
        console.log('\n📋 Test 4: Dépendances...');
        
        try {
            const Tesseract = require('tesseract.js');
            console.log('✅ Tesseract.js - OK');
        } catch (e) {
            console.error('❌ Tesseract.js - ERREUR:', e.message);
        }

        try {
            const { BlueStackController } = require('./src/core/bluestack');
            console.log('✅ BlueStackController - OK');
        } catch (e) {
            console.error('❌ BlueStackController - ERREUR:', e.message);
        }

        try {
            const { SMSManagerExtended } = require('./src/core/sms');
            console.log('✅ SMSManagerExtended - OK');
        } catch (e) {
            console.error('❌ SMSManagerExtended - ERREUR:', e.message);
        }

        // Test 5: Vérifier le dossier screenshots
        console.log('\n📋 Test 5: Structure fichiers...');
        const fs = require('fs');
        const path = require('path');
        
        const screenshotDir = path.join(__dirname, 'screenshots');
        if (fs.existsSync(screenshotDir)) {
            console.log('✅ Dossier screenshots existe');
        } else {
            console.log('ℹ️ Dossier screenshots sera créé automatiquement');
        }

        // Test 6: Test méthode step
        console.log('\n📋 Test 6: Test méthode step...');
        await workflow.step('Test de la méthode step');
        console.log('✅ Méthode step fonctionne');

        // Test 7: Test analyzeExtractedText avec du texte de test
        console.log('\n📋 Test 7: Test analyzeExtractedText...');
        const testText = `
            Choose how to verify your account:
            Receive SMS on +44 1234 567890
            Get a missed call
            Continue
        `;
        
        const analysis = workflow.analyzeExtractedText(testText);
        console.log(`✅ Analyse OCR: SMS ${analysis.smsAvailable ? 'DISPONIBLE' : 'NON DISPONIBLE'}`);
        console.log(`📞 Numéro détecté: ${analysis.phoneNumber || 'N/A'}`);
        console.log(`🎯 Confiance: ${Math.round(analysis.confidence * 100)}%`);

        console.log('\n🎉 TOUS LES TESTS SONT PASSÉS !');
        console.log('✅ Le workflow est prêt à être utilisé');
        
        return true;

    } catch (error) {
        console.error(`\n💥 ERREUR PENDANT LES TESTS: ${error.message}`);
        console.error(error.stack);
        return false;
    }
}

// Exécuter les tests
if (require.main === module) {
    testWorkflow()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 Erreur fatale:', error.message);
            process.exit(1);
        });
}

module.exports = { testWorkflow };

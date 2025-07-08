#!/usr/bin/env node

/**
 * Script de configuration de l'API SMS
 * Aide à configurer et tester la connexion SMS-Activate.io
 */

require('dotenv').config();
const { SMSManager, SMSManagerExtended } = require('./src/core/sms');
const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
    console.log('🔧 === CONFIGURATION API SMS ===\n');
    
    // Vérifier si .env existe
    if (!fs.existsSync('.env')) {
        console.log('📝 Création du fichier .env...');
        fs.writeFileSync('.env', `# Configuration SMS-Activate.io
SMS_ACTIVATE_API_KEY=YOUR_API_KEY

# Configuration BlueStack
BLUESTACK_DEVICE_ID=127.0.0.1:5585

# Configuration générale
DEFAULT_COUNTRY=UK
VERBOSE_LOGGING=true
`);
    }

    // Lire la clé API actuelle
    const currentApiKey = process.env.SMS_ACTIVATE_API_KEY;
    
    if (!currentApiKey || currentApiKey === 'YOUR_API_KEY') {
        console.log('❌ Aucune clé API SMS configurée');
        console.log('\n📋 Pour obtenir une clé API:');
        console.log('1. Allez sur https://sms-activate.org/');
        console.log('2. Créez un compte');
        console.log('3. Allez dans "API" dans votre profil');
        console.log('4. Copiez votre clé API');
        
        const apiKey = await question('\n🔑 Entrez votre clé API SMS-Activate.io: ');
        
        if (!apiKey.trim()) {
            console.log('❌ Clé API vide. Abandon.');
            rl.close();
            return;
        }
        
        // Mettre à jour le fichier .env
        let envContent = fs.readFileSync('.env', 'utf8');
        envContent = envContent.replace('SMS_ACTIVATE_API_KEY=YOUR_API_KEY', `SMS_ACTIVATE_API_KEY=${apiKey.trim()}`);
        fs.writeFileSync('.env', envContent);
        
        console.log('✅ Clé API sauvegardée dans .env');
        
        // Recharger la config
        delete require.cache[require.resolve('dotenv')];
        require('dotenv').config();
    } else {
        console.log('✅ Clé API trouvée');
    }

    // Tester la connexion
    console.log('\n🧪 Test de la connexion...');
    
    try {
        const sms = new SMSManagerExtended(process.env.SMS_ACTIVATE_API_KEY);
        
        console.log('📡 Vérification du solde...');
        const balance = await sms.getBalance();
        
        if (balance.success) {
            console.log(`✅ Connexion réussie !`);
            console.log(`💰 Solde: ${balance.balance}₽`);
            
            if (balance.balance < 1) {
                console.log('⚠️ Solde faible. Pensez à recharger votre compte.');
            }

            // Test des pays disponibles
            console.log('\n🌍 Vérification des pays disponibles...');
            const countries = await sms.getAvailableCountries();
            
        } else {
            console.log('❌ Erreur de connexion');
        }
        
    } catch (error) {
        console.log(`❌ Erreur: ${error.message}`);
        console.log('\n🔍 Vérifiez que:');
        console.log('- Votre clé API est correcte');
        console.log('- Votre compte SMS-Activate.io est actif');
        console.log('- Vous avez une connexion internet');
    }

    // Test d'achat de numéro (optionnel)
    const testBuy = await question('\n🧪 Voulez-vous tester l\'achat d\'un numéro ? (y/N): ');
    
    if (testBuy.toLowerCase() === 'y' || testBuy.toLowerCase() === 'yes') {
        console.log('\n📞 Test de diagnostic pour UK...');
        
        try {
            const sms = new SMSManagerExtended(process.env.SMS_ACTIVATE_API_KEY);
            const diagnosis = await sms.diagnoseBuyNumber('UK');
            
            if (diagnosis.success) {
                console.log(`✅ Pays: ${diagnosis.countryCode}`);
                console.log(`🆔 Code API: ${diagnosis.apiCode}`);
                console.log(`📱 Numéros WhatsApp disponibles: ${diagnosis.whatsappAvailable}`);
                
                if (diagnosis.canBuy) {
                    console.log('✅ Achat possible !');
                    
                    // Test réel d'achat
                    const buyTest = await question('Voulez-vous vraiment acheter un numéro ? (y/N): ');
                    if (buyTest.toLowerCase() === 'y') {
                        const result = await sms.buyNumber('UK');
                        
                        if (result.success) {
                            console.log(`✅ Numéro acheté: ${result.fullNumber}`);
                            console.log(`🆔 ID: ${result.id}`);
                            
                            // Annuler immédiatement
                            console.log('🗑️ Annulation du numéro (test)...');
                            await sms.cancelNumber(result.id);
                            console.log('✅ Numéro annulé');
                        } else {
                            console.log(`❌ Erreur achat: ${result.error}`);
                        }
                    }
                } else {
                    console.log('❌ Aucun numéro WhatsApp disponible pour UK');
                    console.log('💡 Essayez un autre pays: FR, US, DE, ES');
                }
            } else {
                console.log(`❌ Diagnostic échoué: ${diagnosis.error}`);
                if (diagnosis.suggestions) {
                    console.log(`💡 Pays supportés: ${diagnosis.suggestions.join(', ')}`);
                }
            }
            
        } catch (error) {
            console.log(`❌ Erreur: ${error.message}`);
        }
    }

    console.log('\n🎉 Configuration terminée !');
    console.log('Vous pouvez maintenant utiliser:');
    console.log('- npm start (pour UK)');
    console.log('- npm run create-fr (pour France)');
    console.log('- npm run create-us (pour USA)');
    
    rl.close();
}

if (require.main === module) {
    main().catch(console.error);
} 
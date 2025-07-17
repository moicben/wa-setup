#!/usr/bin/env node

/**
 * Script de lancement WhatsApp sur téléphones cloud MoreLogin
 * Version simplifiée utilisant les fonctions du script startPhone.js
 */

require('dotenv').config();

const { startPhone: startPhoneMain } = require('./startPhone');

/**
 * Lance WhatsApp sur un téléphone spécifique
 */
async function launchWhatsAppOnPhone(phoneId, whatsappPackage = 'com.whatsapp') {
    try {
        console.log(`🚀 Lancement de WhatsApp sur le téléphone ${phoneId}...\n`);
        
        // Utiliser le script startPhone pour préparer le téléphone et la connexion ADB
        const { utils: adbUtils, device: deviceAddress, phone } = await startPhoneMain(phoneId);
        
        console.log('📱 Lancement de WhatsApp...');
        await adbUtils.launchApp(whatsappPackage);
        
        console.log(`✅ WhatsApp lancé avec succès sur ${phone.envName}`);
        
        return {
            phoneId,
            packageName: whatsappPackage,
            deviceAddress,
            adbUtils,
            phone
        };
        
    } catch (error) {
        console.error(`❌ Erreur lors du lancement de WhatsApp: ${error.message}`);
        throw error;
    }
}

/**
 * Fonction principale
 */
async function main() {
    try {
        // Récupérer les paramètres
        const phoneIdentifier = process.argv[2];
        const customPackage = process.argv[3] || 'com.whatsapp';
        
        if (!phoneIdentifier) {
            console.log('📱 Script de lancement WhatsApp\n');
            console.log('ℹ️ Usage:');
            console.log('   npm run whatsapp <phone_id|phone_name|index>');
            console.log('   npm run whatsapp <phone_id> <package_name>');
            console.log('\nExemples:');
            console.log('   npm run whatsapp 1646814214559087');
            console.log('   npm run whatsapp "CP-1"');
            console.log('   npm run whatsapp 1');
            console.log('   npm run whatsapp 1 com.whatsapp.w4b  # WhatsApp Business');
            return;
        }
        
        // Lancer WhatsApp
        const result = await launchWhatsAppOnPhone(phoneIdentifier, customPackage);
        
        console.log('\n🎉 Mission accomplie !');
        console.log(`📱 Téléphone: ${result.phone.envName} (${result.phoneId})`);
        console.log(`📲 WhatsApp: ${result.packageName}`);
        console.log(`🔗 ADB: ${result.deviceAddress}`);
        
        return result;
        
    } catch (error) {
        console.error(`\n💥 Erreur: ${error.message}`);
        process.exit(1);
    }
}

// Exporter pour utilisation en tant que module
module.exports = {
    launchWhatsApp: launchWhatsAppOnPhone,
    main
};

// Exécuter si appelé directement
if (require.main === module) {
    main();
} 
/**
 * Configuration centralisée du projet
 */

// dotenv supprimé

const config = {
    // BlueStack
    bluestack: {
        deviceId: process.env.BLUESTACK_DEVICE_ID || '127.0.0.1:5585',
        whatsappPackage: 'com.whatsapp'
    },

    // SMS-activate.io
    sms: {
        apiKey: process.env.SMS_ACTIVATE_API_KEY,
        baseUrl: 'https://sms-activate.org/stubs/handler_api.php',
        timeout: 300000, // 5 minutes
        supportedCountries: ['UK', 'US', 'FR', 'DE', 'ES', 'ID']
    },

    // Paramètres par défaut
    defaults: {
        country: 'UK',
        verbose: true
    },

    // Chemins
    paths: {
        screenshots: './screenshots',
        logs: './logs'
    }
};

module.exports = config; 
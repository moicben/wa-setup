/**
 * Device Services - Point d'entrée unifié
 * Phase 5: Services Unifiés
 * 
 * Enregistrement automatique des providers Device et export des services
 */

const { DeviceService, DeviceServiceFactory, DevicePool } = require('./DeviceService');
const { BlueStacksProvider } = require('./providers/BlueStacksProvider');

// Enregistrement automatique des providers
DeviceServiceFactory.registerProvider('bluestacks', BlueStacksProvider);

// Export des classes principales
module.exports = {
    DeviceService,
    DeviceServiceFactory,
    DevicePool,
    
    // Providers
    BlueStacksProvider,
    
    // Fonction utilitaire pour créer un device BlueStacks
    createBlueStacksDevice: async (config = {}) => {
        const device = DeviceServiceFactory.createProvider('bluestacks', config);
        await device.initialize();
        return device;
    },
    
    // Fonction utilitaire pour créer un pool de devices
    createDevicePool: (config = {}) => {
        return new DevicePool(config);
    }
};
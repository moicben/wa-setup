/**
 * MoreLogin WhatsApp Workflow - Workflow pour création de comptes WhatsApp sur MoreLogin cloud phones
 * Inspiré de whatsapp-workflow.js, avec réutilisation des scripts existants comme modules.
 */

require('dotenv').config();
const { SimpleWorkflowContext, WhatsAppWorkflow, WorkflowFactory } = require('./whatsapp-workflow');
const { createCloudPhoneWithProxy } = require('../scripts/createCloudPhone');
const { startPhone } = require('../scripts/startPhone');
const { launchWhatsApp } = require('../scripts/launchWhatsApp');
const { BaseStep } = require('./base/BaseStep');
const path = require('path');
const fs = require('fs');

/**
 * Contexte étendu pour MoreLogin
 */
class MoreLoginWorkflowContext extends SimpleWorkflowContext {
    constructor(config = {}) {
        super({
            ...config,
            enableCloud: true,
            deviceProvider: 'morelogin'
        });
        this.session.cloudPhoneId = null;
        this.session.deviceAddress = null;
        this.session.adbUtils = null;
    }

    // Setters supplémentaires
    setCloudPhoneId(id) { this.session.cloudPhoneId = id; }
    getCloudPhoneId() { return this.session.cloudPhoneId; }
    setDeviceAddress(address) { this.session.deviceAddress = address; }
    getDeviceAddress() { return this.session.deviceAddress; }
    setAdbUtils(utils) { this.session.adbUtils = utils; }
    getAdbUtils() { return this.session.adbUtils; }

    async initialize() {
        console.log('Initialisation contexte MoreLogin...');
        await this._createServices(); // Créer tous les services
        await this._initializeNonDeviceServices(); // Initialiser seulement SMS et WhatsApp
    }

    async _createServices() {
        const { SMSService } = require('./services/sms-service'); // Utiliser la classe directement sans create qui initialise
        const { createWhatsAppService } = require('./services/whatsapp-service');
        if (!this.services.sms) {
            this.services.sms = new SMSService(this.config);
        }
        if (!this.services.whatsapp) {
            this.services.whatsapp = createWhatsAppService(this.config);
        }
    }

    async _initializeNonDeviceServices() {
        if (this.services.sms && this.services.sms.initialize) {
            await this.services.sms.initialize();
        }
        if (this.services.whatsapp && this.services.whatsapp.initialize) {
            await this.services.whatsapp.initialize(null); // Passer null pour device, sera set plus tard
        }
    }

    async initializeDevice(deviceAddress) {
        const { createBlueStacksDevice } = require('./services/device-service');
        const deviceConfig = {
            ...this.config,
            deviceId: deviceAddress
        };
        this.services.bluestack = await createBlueStacksDevice(deviceConfig);
        // Supprimer la seconde initialisation, car createBlueStacksDevice appelle déjà initialize
        if (this.services.whatsapp.initialize) {
            await this.services.whatsapp.initialize(this.services.bluestack);
        }
        console.log(`Device initialise avec adresse: ${deviceAddress}`);
    }

    async cleanup() {
        await super.cleanup();
        // Cleanup spécifique MoreLogin, ex: arrêter le phone si needed
        console.log('🧹 Cleanup MoreLogin terminé');
    }
}

/**
 * Étapes custom pour MoreLogin
 */
class CreateCloudPhoneStep extends BaseStep {
    constructor() {
        super('CreateCloudPhone');
    }

    async execute(context) {
        console.log('Creation d un nouveau cloud phone MoreLogin...');
        try {
            const quantity = 1; // Pour un workflow unique; gere par parallel pour multi
            const customName = `WA-Cloud-${Date.now()}`;
            const newPhone = await createCloudPhoneWithProxy(quantity, customName, true, 'local');
            
            if (!newPhone || !newPhone[0]) {
                throw new Error('Echec de la creation du cloud phone');
            }
            
            const phoneId = Array.isArray(newPhone) ? newPhone[0] : newPhone.id;
            context.setCloudPhoneId(phoneId);
            
            console.log(`Cloud phone cree: ID ${phoneId}, Nom: ${customName}`);
            return { success: true, phoneId };
        } catch (error) {
            console.error(`Erreur creation cloud phone: ${error.message}`);
            throw error;
        }
    }
}

class StartCloudPhoneStep extends BaseStep {
    constructor() {
        super('StartCloudPhone');
    }

    async execute(context) {
        console.log('🚀 Démarrage du cloud phone...');
        try {
            const phoneId = context.getCloudPhoneId();
            if (!phoneId) {
                throw new Error('Aucun phone ID disponible');
            }
            
            const { utils: adbUtils, device: deviceAddress, phone } = await startPhone(phoneId);
            
            context.setDeviceAddress(deviceAddress);
            context.setAdbUtils(adbUtils);
            
            console.log(`✅ Cloud phone démarré: ${deviceAddress}`);
            return { success: true, deviceAddress };
        } catch (error) {
            console.error(`❌ Erreur démarrage cloud phone: ${error.message}`);
            throw error;
        }
    }
}

class LaunchWhatsAppStep extends BaseStep {
    constructor() {
        super('LaunchWhatsApp');
    }

    async execute(context) {
        console.log('📲 Lancement de WhatsApp sur le cloud phone...');
        try {
            const phoneId = context.getCloudPhoneId();
            const result = await launchWhatsApp(phoneId, 'com.whatsapp');
            
            console.log(`✅ WhatsApp lancé sur ${result.deviceAddress}`);
            return { success: true, packageName: result.packageName };
        } catch (error) {
            console.error(`❌ Erreur lancement WhatsApp: ${error.message}`);
            throw error;
        }
    }
}

class InitializeDeviceServiceStep extends BaseStep {
    constructor() {
        super('InitializeDeviceService');
    }

    async execute(context) {
        console.log('Initialisation du DeviceService avec adresse dynamique...');
        try {
            const deviceAddress = context.getDeviceAddress();
            if (!deviceAddress) {
                throw new Error('Aucune adresse device disponible');
            }
            await context.initializeDevice(deviceAddress);
            return { success: true };
        } catch (error) {
            console.error(`Erreur initialisation device: ${error.message}`);
            throw error;
        }
    }
}

/**
 * Workflow MoreLogin étendu
 */
class MoreLoginWorkflow extends WhatsAppWorkflow {
    constructor(config = {}) {
        super(config);
        this.config.enableCloud = true;
        this.config.deviceProvider = 'morelogin';
    }

    async initialize() {
        this.context = new MoreLoginWorkflowContext(this.config);
        await this.context.initialize();
        this.steps = this._buildSteps();
        console.log('✅ Workflow MoreLogin initialisé');
    }

    _buildSteps() {
        return [
            new CreateCloudPhoneStep(),
            new StartCloudPhoneStep(),
            new InitializeDeviceServiceStep(),
            new LaunchWhatsAppStep(),
            // Sauter InitializeAppStep car app déjà lancée
            // new InitializeAppStep(), // Commenté pour éviter redondance
            ...super._buildSteps().slice(1) // Commencer après InitializeApp dans le parent
        ];
    }

    // Méthode pour exécution en parallèle
    async executeParallel(quantity = 1, country = null) {
        console.log(`🚀 Lancement de ${quantity} workflows en parallèle...`);
        const promises = [];
        
        for (let i = 0; i < quantity; i++) {
            const workflow = new MoreLoginWorkflow(this.config);
            await workflow.initialize();
            promises.push(workflow.execute(country || this.config.country));
        }
        
        try {
            const results = await Promise.allSettled(promises);
            const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
            console.log(`🎉 ${successful}/${quantity} workflows réussis`);
            return results;
        } catch (error) {
            console.error(`❌ Erreur exécution parallèle: ${error.message}`);
            throw error;
        }
    }
}

/**
 * Factory pour MoreLogin
 */
class MoreLoginWorkflowFactory extends WorkflowFactory {
    static createMoreLoginWorkflow(config = {}) {
        return new MoreLoginWorkflow(config);
    }
}

// Logique CLI pour exécution directe
if (require.main === module) {
    const args = process.argv.slice(2);
    let country = 'UK';
    let quantity = 1;
    
    for (let i = 0; i < args.length; i += 2) {
        if (args[i] === '--country' && args[i+1]) {
            country = args[i+1];
        } else if (args[i] === '--quantity' && args[i+1]) {
            quantity = parseInt(args[i+1], 10);
        }
    }
    
    if (args.length === 0) {
        console.log('Usage: npm run morelogin -- --country <pays> --quantity <nombre>');
        console.log('Exemple: npm run morelogin -- --country UK --quantity 2');
        process.exit(0);
    }
    
    (async () => {
        try {
            const workflow = new MoreLoginWorkflow();
            await workflow.initialize();
            
            let result;
            if (quantity > 1) {
                result = await workflow.executeParallel(quantity, country);
            } else {
                result = await workflow.execute(country);
            }
            
            console.log('Resultat du workflow:', JSON.stringify(result, null, 2));
        } catch (error) {
            console.error('Erreur:', error.message);
            process.exit(1);
        }
    })();
}

module.exports = {
    MoreLoginWorkflow,
    MoreLoginWorkflowContext,
    MoreLoginWorkflowFactory,
    CreateCloudPhoneStep,
    StartCloudPhoneStep,
    LaunchWhatsAppStep
}; 
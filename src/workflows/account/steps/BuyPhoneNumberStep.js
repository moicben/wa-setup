/**
 * Étape d'achat d'un numéro de téléphone SMS
 * Achète un numéro SMS avec fallback automatique et gestion des prix
 */

const { BaseStep } = require('../../base/BaseStep');

class BuyPhoneNumberStep extends BaseStep {
    constructor() {
        super('Buy Phone Number', ['Initialize App']); // Dépend de l'initialisation
    }

    /**
     * Exécuter l'étape d'achat du numéro
     */
    async _execute(context) {
        try {
            const targetCountry = context.getCountry();
            
            console.log(`📞 Achat numéro SMS pour ${targetCountry}...`);
            
            // Acheter un numéro avec fallback automatique et prix multiples pour UK
            const numberResult = await context.sms.buyNumberWithFallbackAndPricing(targetCountry);
            
            if (!numberResult.success) {
                throw new Error(`Impossible d'acheter un numéro: ${numberResult.error}`);
            }

            // Mettre à jour la session avec les informations du numéro
            context.updateSession({
                phone: numberResult.number,
                smsId: numberResult.id,
                parsedNumber: numberResult.parsed,
                countryUsed: numberResult.countryUsed || targetCountry
            });

            // Logging des informations
            this._logNumberInfo(numberResult, targetCountry);
            
            // Vérifier le parsing du numéro
            if (numberResult.parsed && numberResult.parsed.success) {
                console.log(`🌍 Indicatif: +${numberResult.parsed.countryCode}`);
                console.log(`📞 Local: ${numberResult.parsed.localNumber}`);
            } else {
                console.warn('⚠️ Parsing du numéro échoué, utilisation du numéro brut');
            }

            const result = {
                success: true,
                number: numberResult.number,
                fullNumber: numberResult.fullNumber,
                smsId: numberResult.id,
                parsedNumber: numberResult.parsed,
                countryUsed: numberResult.countryUsed,
                originalCountry: targetCountry,
                price: numberResult.price || null,
                operator: numberResult.operator || null,
                attempt: numberResult.attempt || null,
                timestamp: Date.now()
            };
            
            console.log(`✅ Numéro acheté avec succès: ${numberResult.fullNumber}`);
            return result;
            
        } catch (error) {
            // En cas d'erreur, enregistrer pour metrics
            context.recordError(this.name, error);
            throw new Error(`Échec achat numéro SMS: ${error.message}`);
        }
    }

    /**
     * Logger les informations du numéro acheté
     */
    _logNumberInfo(numberResult, targetCountry) {
        // Afficher le prix si disponible
        if (numberResult.price) {
            console.log(`💰 Prix: ${numberResult.price}₽`);
        }
        
        console.log(`✅ Numéro: ${numberResult.fullNumber}`);
        
        // Si fallback de pays utilisé
        if (numberResult.originalCountry && numberResult.originalCountry !== numberResult.countryUsed) {
            console.log(`🔄 Pays utilisé: ${numberResult.countryUsed} (au lieu de ${numberResult.originalCountry})`);
        }
        
        // Si opérateur spécifique (pour UK notamment)
        if (numberResult.operator) {
            console.log(`📡 Opérateur: ${numberResult.operator}`);
            if (numberResult.operator === 'three') {
                console.log('🎯 Opérateur Three prioritaire obtenu !');
            }
        }
        
        // Si multiple tentatives
        if (numberResult.attempt && numberResult.attempt > 1) {
            console.log(`🔄 Obtenu à la tentative ${numberResult.attempt}`);
        }
    }

    /**
     * Vérifications préalables
     */
    async canExecute(context) {
        try {
            // Vérifier que l'initialisation est terminée
            const initResult = this._getDependencyResult(context, 'Initialize App');
            if (!initResult || !initResult.success) {
                throw new Error('Initialisation de l\'app non terminée');
            }
            
            // Vérifier le service SMS
            if (!context.sms) {
                throw new Error('Service SMS non configuré');
            }
            
            // Vérifier la clé API
            if (!context.config.smsApiKey) {
                throw new Error('Clé API SMS non configurée');
            }
            
            // Vérifier le solde SMS (optionnel, ne pas échouer si impossible)
            try {
                const balance = await context.sms.getBalance();
                if (balance.balance < 0.1) { // Minimum 0.1₽
                    console.warn(`⚠️ Solde SMS faible: ${balance.balance}₽`);
                }
            } catch (error) {
                console.warn('⚠️ Impossible de vérifier le solde SMS');
            }
            
            return true;
        } catch (error) {
            console.error(`❌ Prérequis non satisfaits pour achat numéro: ${error.message}`);
            return false;
        }
    }

    /**
     * Nettoyage si l'étape échoue
     */
    async cleanup(context) {
        try {
            // Annuler le numéro SMS si il a été acheté mais que l'étape a échoué
            const smsId = context.getSMSId();
            if (smsId) {
                try {
                    await context.cancelSMS(smsId);
                    console.log('🗑️ Numéro SMS annulé lors du nettoyage');
                } catch (e) {
                    console.warn('⚠️ Impossible d\'annuler le numéro SMS lors du nettoyage');
                }
            }
        } catch (error) {
            console.warn(`⚠️ Erreur nettoyage BuyPhoneNumber: ${error.message}`);
        }
    }

    /**
     * Gestion des erreurs spécifiques à cette étape
     */
    handleError(error, context) {
        // Errors de retry spécifiques au SMS
        if (error.message.includes('NO_NUMBERS') || 
            error.message.includes('INSUFFICIENT_BALANCE')) {
            return {
                shouldRetry: false,
                isFatal: true,
                reason: 'Problème permanent avec le service SMS'
            };
        }
        
        // Erreurs temporaires réseau
        if (error.message.includes('TIMEOUT') || 
            error.message.includes('NETWORK_ERROR')) {
            return {
                shouldRetry: true,
                isFatal: false,
                reason: 'Erreur temporaire réseau'
            };
        }
        
        // Erreur par défaut
        return {
            shouldRetry: true,
            isFatal: false,
            reason: 'Erreur générique, retry possible'
        };
    }

    /**
     * Validation des résultats
     */
    validateResult(result) {
        if (!result.success) {
            throw new Error('Résultat d\'achat invalide');
        }
        
        if (!result.number || !result.smsId) {
            throw new Error('Numéro ou ID SMS manquant dans le résultat');
        }
        
        if (!result.fullNumber || !result.fullNumber.startsWith('+')) {
            throw new Error('Format de numéro complet invalide');
        }
        
        return true;
    }

    /**
     * Obtenir le nom d'étape pour les screenshots
     */
    _getStepNumber() {
        return '02';
    }

    /**
     * Informations sur cette étape
     */
    getDescription() {
        return {
            name: this.name,
            description: 'Achète un numéro de téléphone SMS avec fallback automatique',
            inputs: ['App initialisée', 'Service SMS', 'Solde suffisant'],
            outputs: ['Numéro acheté', 'ID SMS', 'Numéro parsé'],
            duration: '~5-15 secondes',
            canFail: true,
            retryable: true,
            fallbackCountries: ['UK -> US/FR/DE', 'US -> FR/DE/ES'],
            specialFeatures: ['Opérateur Three prioritaire pour UK', 'Pricing multiple', 'Auto-fallback pays']
        };
    }
}

module.exports = { BuyPhoneNumberStep }; 
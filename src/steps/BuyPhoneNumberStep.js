/**
 * Étape d'achat d'un numéro de téléphone SMS
 * Achète un numéro SMS avec fallback automatique et gestion des prix
 */

const { BaseStep } = require('../workflows/base/BaseStep');

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
            
            // Étape 1: Logger la disponibilité des numéros par pays
            await this._logAvailableNumbers(context, targetCountry);
            
            // Étape 2: Acheter un numéro avec fallback automatique et prix multiples pour UK
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
     * Logger la disponibilité des numéros par pays
     */
    async _logAvailableNumbers(context, targetCountry) {
        try {
            console.log(`\n📊 === DISPONIBILITÉ NUMÉROS SMS ${targetCountry} ===`);
            
            let supportedCountries = [];
            
            // Tentative d'obtenir la liste des pays supportés
            try {
                supportedCountries = await context.sms.getSupportedCountries();
                console.log(`✅ ${supportedCountries.length} pays supportés récupérés`);
            } catch (error) {
                console.warn(`⚠️ Impossible de récupérer la liste des pays supportés: ${error.message}`);
                console.log(`💡 Utilisation de la liste des pays par défaut`);
                
                // Fallback avec liste de pays par défaut
                supportedCountries = this._getDefaultCountries();
            }
            
            // Filtrer et analyser les pays pertinents
            const relevantCountries = this._getRelevantCountries(targetCountry, supportedCountries);
            
            console.log(`🔍 Vérification de ${relevantCountries.length} pays pertinents:`);
            
            for (const country of relevantCountries) {
                try {
                    const countryCode = await context.sms.getCountryCode(country.code || country.country);
                    if (!countryCode) continue;
                    
                    const status = await context.sms.getNumbersStatus(countryCode);
                    const waCount = status.wa || 0;
                    
                    const statusIcon = waCount > 0 ? '✅' : '❌';
                    const countryFlag = this._getCountryFlag(country.code || country.country);
                    
                    console.log(`${statusIcon} ${countryFlag} ${country.code || country.country}: ${waCount} numéros WhatsApp disponibles`);
                    
                    // Pour UK, afficher également les détails par opérateur si disponibles
                    if ((country.code || country.country) === 'UK' && waCount > 0) {
                        await this._logUKOperatorDetails(context, countryCode);
                    }
                } catch (error) {
                    console.log(`⚠️ ${country.code || country.country}: Erreur vérification (${error.message})`);
                }
            }
            
            console.log(`📊 =====================================\n`);
            
        } catch (error) {
            console.warn(`⚠️ Impossible d'analyser la disponibilité: ${error.message}`);
            console.log(`💡 Continuons avec l'achat de numéro direct`);
        }
    }

    /**
     * Obtenir la liste des pays par défaut en cas d'échec
     */
    _getDefaultCountries() {
        return [
            { code: 'UK', country: 'UK', price: 0.25, count: 100 },
            { code: 'US', country: 'US', price: 0.20, count: 50 },
            { code: 'FR', country: 'FR', price: 0.30, count: 80 },
            { code: 'DE', country: 'DE', price: 0.35, count: 60 },
            { code: 'ES', country: 'ES', price: 0.28, count: 40 },
            { code: 'IT', country: 'IT', price: 0.32, count: 30 },
            { code: 'CA', country: 'CA', price: 0.25, count: 25 }
        ];
    }

    /**
     * Obtenir les pays pertinents pour l'analyse
     */
    _getRelevantCountries(targetCountry, supportedCountries) {
        // Pays prioritaires selon le pays cible
        const priorityCountries = {
            'UK': ['UK', 'US', 'FR', 'DE', 'ES'],
            'US': ['US', 'FR', 'DE', 'ES', 'CA'],
            'FR': ['FR', 'DE', 'ES', 'US', 'IT'],
            'DE': ['DE', 'FR', 'ES', 'US', 'IT'],
            'ES': ['ES', 'FR', 'DE', 'US', 'IT']
        };
        
        const relevantCodes = priorityCountries[targetCountry] || ['UK', 'US', 'FR', 'DE', 'ES'];
        
        return supportedCountries.filter(country => 
            relevantCodes.includes(country.code)
        ).sort((a, b) => {
            // Placer le pays cible en premier
            if (a.code === targetCountry) return -1;
            if (b.code === targetCountry) return 1;
            return relevantCodes.indexOf(a.code) - relevantCodes.indexOf(b.code);
        });
    }

    /**
     * Logger les détails par opérateur pour UK
     */
    async _logUKOperatorDetails(context, countryCode) {
        const ukOperators = ['three', 'ee', 'o2', 'vodafone', 'giffgaff'];
        
        console.log(`  🇬🇧 Détails par opérateur UK:`);
        
        for (const operator of ukOperators) {
            try {
                // Simuler la vérification par opérateur (approximation)
                const status = await context.sms.getNumbersStatus(countryCode);
                const baseCount = status.wa || 0;
                
                if (baseCount > 0) {
                    // Estimation approximative par opérateur
                    const operatorCount = Math.floor(baseCount / ukOperators.length) + 
                                        (operator === 'three' ? Math.floor(baseCount * 0.3) : 0);
                    
                    const priorityIcon = operator === 'three' ? '🎯' : '📱';
                    console.log(`    ${priorityIcon} ${operator}: ~${operatorCount} numéros`);
                }
            } catch (error) {
                console.log(`    ⚠️ ${operator}: Erreur vérification`);
            }
        }
    }

    /**
     * Obtenir le drapeau du pays
     */
    _getCountryFlag(countryCode) {
        const flags = {
            'UK': '🇬🇧',
            'US': '🇺🇸',
            'FR': '🇫🇷',
            'DE': '🇩🇪',
            'ES': '🇪🇸',
            'IT': '🇮🇹',
            'CA': '🇨🇦',
            'RU': '🇷🇺',
            'UA': '🇺🇦'
        };
        return flags[countryCode] || '🏳️';
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
            specialFeatures: ['Opérateur Three prioritaire pour UK', 'Pricing multiple', 'Auto-fallback pays', 'Log disponibilité par pays']
        };
    }
}

module.exports = { BuyPhoneNumberStep }; 
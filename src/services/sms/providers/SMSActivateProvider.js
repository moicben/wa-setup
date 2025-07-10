/**
 * SMSActivateProvider - Provider SMS-Activate.io
 * Phase 5: Services Unifiés
 * 
 * Implémentation du provider SMS-Activate pour le SMSService unifié
 */

const { SMSService } = require('../SMSService');
const { PhoneNumberParser } = require('../../../core/sms/parsers');
const { createTimeout, withTimeout, sleep, retryWithBackoff } = require('../../../config/timeouts');
const fetch = require('node-fetch');

class SMSActivateProvider extends SMSService {
    constructor(config = {}) {
        super(config);
        this.apiKey = config.apiKey || process.env.SMS_ACTIVATE_API_KEY;
        this.baseUrl = 'https://api.sms-activate.ae/stubs/handler_api.php';
        this.countryMap = {
            'UK': '16',   // Updated to match original module
            'US': '187',  // USA (numéros réels)
            'US_VIRTUAL': '12', // USA Virtual
            'FR': '78',   // France
            'DE': '43',   // Germany
            'ES': '56',   // Spain
            'CA': '36',   // Canada
            'IT': '86',   // Italy
            'RU': '0',    // Russia
            'UA': '1'     // Ukraine
        };
        this.serviceId = 'wa'; // WhatsApp service ID
        this.countryCodes = null; // Cache for dynamic country codes
        this.purchaseTimes = new Map(); // Track purchase times for cancel delay
        
        // Fallback countries for intelligent switching
        this.countryFallbacks = {
            'UK': ['US', 'FR', 'DE'],
            'GB': ['US', 'FR', 'DE'],
            'US': ['FR', 'DE', 'ES'],
            'FR': ['US', 'DE', 'ES'],
            'DE': ['US', 'FR', 'ES'],
            'ES': ['US', 'FR', 'DE']
        };
        
        // High availability countries
        this.highAvailabilityCountries = ['US', 'FR', 'DE'];
    }

    /**
     * Initialiser le provider
     */
    async initialize() {
        if (!this.apiKey) {
            throw new Error('SMS-Activate API key required');
        }

        try {
            // Tester la connexion
            const balance = await this.getBalance();
            console.log(`✅ SMS-Activate connecté, solde: $${balance}`);
            return true;
        } catch (error) {
            console.error('❌ Erreur connexion SMS-Activate:', error);
            throw error;
        }
    }

    /**
     * Acheter un numéro de téléphone
     * @param {string} country - Code pays (UK, FR, US)
     * @param {Object} options - Options additionnelles
     * @returns {Promise<Object>} Résultat avec numéro et ID
     */
    async buyNumber(country, options = {}) {
        const startTime = Date.now();
        
        try {
            const countryCode = await this.getCountryCode(country);
            if (!countryCode) {
                throw new Error(`Pays non supporté: ${country}`);
            }

            console.log(`📞 Achat numéro SMS-Activate pour ${country}...`);
            
            const params = {
                api_key: this.apiKey,
                action: 'getNumber',
                service: this.serviceId,
                country: countryCode
            };
            
            // Add operator if specified in options
            if (options.operator) {
                params.operator = options.operator;
            }
            
            const url = new URL(this.baseUrl);
            for (const [key, value] of Object.entries(params)) {
                url.searchParams.append(key, value);
            }
            
            const response = await fetch(url.toString(), { timeout: 10000 });
            const result = await response.text();
            
            if (result.startsWith('ACCESS_NUMBER:')) {
                const [, id, phone] = result.split(':');
                const formattedPhone = this.formatPhone(phone, country);
                const purchaseTime = Date.now();
                
                // Enregistrer le temps d'achat pour la gestion d'annulation
                this.purchaseTimes.set(id, purchaseTime);
                
                this.recordMetric('buyNumber', purchaseTime - startTime, true);
                
                // Parse the number using PhoneNumberParser
                const parsedNumber = PhoneNumberParser.parseNumber(phone, country);
                
                return {
                    success: true,
                    id: id,
                    number: phone,
                    phone: formattedPhone,
                    fullNumber: formattedPhone,
                    rawNumber: phone,
                    country: country,
                    provider: 'sms-activate',
                    parsed: parsedNumber,
                    operator: options.operator || 'standard',
                    purchaseTime: purchaseTime
                };
            } else {
                throw new Error(`Erreur SMS-Activate: ${result}`);
            }
            
        } catch (error) {
            this.recordMetric('buyNumber', Date.now() - startTime, false);
            return {
                success: false,
                error: error.message,
                provider: 'sms-activate'
            };
        }
    }

    /**
     * Attendre la réception d'un SMS
     * @param {string} numberId - ID du numéro
     * @param {number|Object} timeoutParam - Timeout en ms ou objet options
     * @returns {Promise<Object>} Résultat avec code SMS
     */
    async waitForSMS(numberId, timeoutParam = null) {
        const startTime = Date.now();
        
        // Extraire timeout si objet passé (rétrocompatibilité)
        let timeout;
        if (typeof timeoutParam === 'object' && timeoutParam !== null) {
            timeout = timeoutParam.timeout || 120000; // 2 minutes par défaut
            console.log(`📨 Paramètre objet détecté, timeout extrait: ${timeout}ms`);
        } else if (typeof timeoutParam === 'number') {
            timeout = timeoutParam;
        } else {
            timeout = createTimeout('SMS', 'WAIT_SMS_TIMEOUT', 120000); // 2 minutes par défaut
        }
        
        // Validation du timeout
        if (typeof timeout !== 'number' || timeout <= 0) {
            throw new Error(`Timeout invalide: ${timeout} (doit être un nombre positif)`);
        }
        
        const waitTimeout = timeout;
        const maxTime = startTime + waitTimeout;
        const checkInterval = createTimeout('SMS', 'SMS_CHECK_INTERVAL', 10000);
        
        console.log(`📨 Attente SMS pour ${numberId} avec timeout ${waitTimeout}ms (${Math.round(waitTimeout/1000)}s)`);
        
        try {
            
            while (Date.now() < maxTime) {
                const response = await fetch(
                    `${this.baseUrl}?api_key=${this.apiKey}&action=getStatus&id=${numberId}`,
                    { timeout: 10000 }
                );

                const result = await response.text();
                
                if (result.startsWith('STATUS_OK:')) {
                    const code = result.split(':')[1];
                    console.log(`✅ Code SMS reçu: ${code}`);
                    
                    this.recordMetric('waitForSMS', Date.now() - startTime, true);
                    
                    return {
                        success: true,
                        code: code,
                        provider: 'sms-activate'
                    };
                } else if (result === 'STATUS_WAIT_CODE') {
                    console.log('⏳ En attente du SMS...');
                    await new Promise(resolve => setTimeout(resolve, checkInterval));
                } else if (result === 'STATUS_CANCEL') {
                    throw new Error('Numéro annulé');
                } else {
                    console.log(`📱 Statut: ${result}`);
                    await new Promise(resolve => setTimeout(resolve, checkInterval));
                }
            }
            
            throw new Error('Timeout - Aucun SMS reçu');
            
        } catch (error) {
            this.recordMetric('waitForSMS', Date.now() - startTime, false);
            return {
                success: false,
                error: error.message,
                provider: 'sms-activate'
            };
        }
    }

    /**
     * Annuler un numéro
     * @param {string} numberId - ID du numéro à annuler
     * @param {Object} options - Options d'annulation
     * @returns {Promise<boolean>} Succès de l'annulation
     */
    async cancelNumber(numberId, options = {}) {
        const startTime = Date.now();
        const minDelayMs = options.minDelay || createTimeout('SMS', 'MIN_CANCEL_DELAY', 30000);
        const forceCancel = options.force || false;
        
        try {
            // Récupérer le temps d'achat depuis le cache ou les options
            const purchaseTime = options.purchaseTime || this.purchaseTimes.get(numberId);
            
            // Vérifier le délai minimum avant annulation si pas forcé
            if (!forceCancel && purchaseTime) {
                const elapsed = Date.now() - purchaseTime;
                if (elapsed < minDelayMs) {
                    const remaining = minDelayMs - elapsed;
                    console.log(`⏳ Attente ${Math.ceil(remaining / 1000)}s avant annulation (délai minimum SMS-Activate)`);
                    await sleep(remaining);
                }
            }

            const timeout = createTimeout('SMS', 'API_TIMEOUT', 10000);
            const response = await withTimeout(
                fetch(`${this.baseUrl}?api_key=${this.apiKey}&action=setStatus&status=8&id=${numberId}`, 
                     { timeout }),
                timeout,
                'SMS-Activate cancelNumber timeout'
            );

            const result = await response.text();
            
            if (result === 'ACCESS_CANCEL') {
                this.recordMetric('cancelNumber', Date.now() - startTime, true);
                console.log(`✅ Numéro ${numberId} annulé avec succès`);
                
                // Nettoyer le cache du temps d'achat
                this.purchaseTimes.delete(numberId);
                
                return true;
            } else if (result === 'EARLY_CANCEL_DENIED') {
                console.warn(`⚠️ Annulation refusée (trop tôt): ${numberId}`);
                
                // Si annulation refusée, tenter de confirmer comme utilisé pour éviter les frais
                if (!forceCancel) {
                    console.log(`🔄 Tentative de confirmation SMS pour éviter les frais...`);
                    try {
                        await this.confirmSMS(numberId);
                        console.log(`✅ SMS confirmé comme utilisé: ${numberId}`);
                    } catch (confirmError) {
                        console.warn(`⚠️ Impossible de confirmer le SMS: ${confirmError.message}`);
                    }
                }
                
                this.recordMetric('cancelNumber', Date.now() - startTime, false);
                return false;
            } else {
                throw new Error(`Erreur annulation: ${result}`);
            }
            
        } catch (error) {
            this.recordMetric('cancelNumber', Date.now() - startTime, false);
            
            // Gestion spécifique des erreurs connues
            if (error.message.includes('EARLY_CANCEL_DENIED')) {
                console.warn(`⚠️ Annulation refusée (délai insuffisant): ${numberId}`);
                return false;
            } else if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
                console.warn(`⚠️ Timeout lors de l'annulation: ${numberId}`);
                return false;
            } else {
                console.error('❌ Erreur annulation SMS-Activate:', error);
                return false;
            }
        }
    }

    /**
     * Obtenir le statut d'un numéro
     * @param {string} numberId - ID du numéro
     * @returns {Promise<Object>} Statut actuel
     */
    async getNumberStatus(numberId) {
        try {
            const response = await fetch(
                `${this.baseUrl}?api_key=${this.apiKey}&action=getStatus&id=${numberId}`,
                { timeout: 10000 }
            );

            const result = await response.text();
            
            return {
                success: true,
                status: result,
                provider: 'sms-activate'
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message,
                provider: 'sms-activate'
            };
        }
    }

    /**
     * Obtenir la liste des pays supportés
     * @returns {Promise<Array>} Liste des pays avec prix
     */
    async getSupportedCountries() {
        try {
            const response = await fetch(
                `${this.baseUrl}?api_key=${this.apiKey}&action=getPrices&service=${this.serviceId}`,
                { timeout: 10000 }
            );

            const result = await response.json();
            
            const countries = [];
            for (const [country, code] of Object.entries(this.countryMap)) {
                if (result[code] && result[code][this.serviceId]) {
                    countries.push({
                        country: country,
                        code: code,
                        price: result[code][this.serviceId].cost,
                        count: result[code][this.serviceId].count
                    });
                }
            }
            
            return countries;
            
        } catch (error) {
            console.error('❌ Erreur récupération pays:', error);
            return [];
        }
    }

    /**
     * Obtenir le solde du compte
     * @returns {Promise<number>} Solde en dollars
     */
    async getBalance() {
        try {
            const response = await fetch(
                `${this.baseUrl}?api_key=${this.apiKey}&action=getBalance`,
                { timeout: 10000 }
            );

            const result = await response.text();
            
            if (result.includes('ACCESS_BALANCE')) {
                const [, balance] = result.split(':');
                return parseFloat(balance);
            } else {
                throw new Error(`Erreur balance: ${result}`);
            }
            
        } catch (error) {
            console.error('❌ Erreur récupération solde:', error);
            return 0;
        }
    }

    /**
     * Valider la configuration du provider
     * @returns {boolean} True si configuration valide
     */
    validateConfig() {
        if (!this.apiKey) {
            console.error('❌ SMS-Activate API key manquante');
            return false;
        }
        
        if (this.apiKey.length < 32) {
            console.error('❌ SMS-Activate API key invalide');
            return false;
        }
        
        return true;
    }

    /**
     * Formater un numéro selon le pays
     * @param {string} phone - Numéro brut
     * @param {string} country - Code pays
     * @returns {string} Numéro formaté
     */
    formatPhone(phone, country) {
        // Supprimer les espaces et caractères spéciaux
        const cleaned = phone.replace(/\D/g, '');
        
        switch (country) {
            case 'UK':
                return cleaned.startsWith('44') ? `+${cleaned}` : `+44${cleaned}`;
            case 'FR':
                return cleaned.startsWith('33') ? `+${cleaned}` : `+33${cleaned}`;
            case 'US':
                return cleaned.startsWith('1') ? `+${cleaned}` : `+1${cleaned}`;
            default:
                return `+${cleaned}`;
        }
    }

    /**
     * Récupérer et mettre en cache les codes pays
     */
    async getCountryCode(countryName) {
        if (!this.countryCodes) {
            try {
                const countries = await this.getCountries();
                this.countryCodes = {};
                
                // Construire un mapping des noms de pays vers les IDs
                for (const [countryKey, countryData] of Object.entries(countries)) {
                    if (countryData.eng) {
                        this.countryCodes[countryData.eng.toUpperCase()] = countryData.id;
                    }
                }
                
                // Ajouter des mappings personnalisés (forcés pour éviter les écrasements)
                this.countryCodes['UK'] = '16';  // Forcer UK = 16
                this.countryCodes['US'] = '187'; // Forcer US = 187
                this.countryCodes['FR'] = '78';  // Forcer FR = 78
                this.countryCodes['DE'] = '43';  // Forcer DE = 43
                this.countryCodes['ES'] = '56';  // Forcer ES = 56
                
            } catch (error) {
                console.warn('⚠️ Impossible de récupérer les codes pays depuis l\'API, utilisation des codes par défaut');
                this.countryCodes = this.countryMap;
            }
        }
        
        return this.countryCodes[countryName.toUpperCase()];
    }

    /**
     * Récupérer la liste des pays disponibles
     */
    async getCountries() {
        try {
            const response = await fetch(
                `${this.baseUrl}?api_key=${this.apiKey}&action=getCountries`,
                { timeout: 10000 }
            );
            const result = await response.text();
            return JSON.parse(result);
        } catch (error) {
            throw new Error(`Impossible de récupérer les pays: ${error.message}`);
        }
    }

    /**
     * Vérifier la disponibilité des numéros pour un pays et service
     */
    async getNumbersStatus(countryCode, operator = null) {
        try {
            const params = {
                api_key: this.apiKey,
                action: 'getNumbersStatus',
                country: countryCode
            };
            
            if (operator) {
                params.operator = operator;
            }
            
            const url = new URL(this.baseUrl);
            for (const [key, value] of Object.entries(params)) {
                url.searchParams.append(key, value);
            }
            
            const response = await fetch(url.toString(), { timeout: 10000 });
            const result = await response.text();
            return JSON.parse(result);
        } catch (error) {
            throw new Error(`Impossible de vérifier le statut des numéros: ${error.message}`);
        }
    }

    /**
     * Confirmer réception du SMS
     */
    async confirmSMS(id) {
        try {
            const response = await fetch(
                `${this.baseUrl}?api_key=${this.apiKey}&action=setStatus&id=${id}&status=6`,
                { timeout: 10000 }
            );
            const result = await response.text();
            console.log(`✅ SMS confirmé pour ${id}`);
            return true;
        } catch (error) {
            console.error(`❌ Erreur confirmation: ${error.message}`);
            return false;
        }
    }

    /**
     * Diagnostiquer la disponibilité pour un pays
     */
    async diagnoseBuyNumber(countryCode) {
        try {
            const code = await this.getCountryCode(countryCode);
            if (!code) {
                return {
                    success: false,
                    error: `Pays ${countryCode} non supporté`,
                    suggestions: ['UK', 'US', 'FR', 'DE', 'ES']
                };
            }

            // Vérifier la disponibilité des numéros
            const status = await this.getNumbersStatus(code);
            const waAvailable = status.wa || 0;
            
            return {
                success: true,
                countryCode,
                apiCode: code,
                whatsappAvailable: waAvailable,
                canBuy: waAvailable > 0
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Acheter un numéro avec fallback intelligent
     */
    async buyNumberWithFallback(countryCode) {
        const code = await this.getCountryCode(countryCode);
        if (!code) {
            return {
                success: false,
                error: `Pays ${countryCode} non supporté`
            };
        }

        // D'abord essayer le pays demandé
        console.log(`📞 Tentative d'achat pour ${countryCode} (code ${code})...`);
        
        try {
            const status = await this.getNumbersStatus(code);
            const waCount = status.wa || 0;
            
            if (waCount > 0) {
                console.log(`✅ ${waCount} numéros WhatsApp disponibles pour ${countryCode}`);
                const result = await this.buyNumber(countryCode);
                
                if (result.success) {
                    result.countryUsed = countryCode;
                }
                return result;
            } else {
                console.log(`⚠️ Aucun numéro WhatsApp disponible pour ${countryCode}`);
            }
        } catch (error) {
            console.log(`❌ Erreur pour ${countryCode}: ${error.message}`);
        }
        
        // Essayer les pays de fallback
        const fallbacks = this.countryFallbacks[countryCode] || this.highAvailabilityCountries;
        console.log(`🔄 Essai des pays alternatifs: ${fallbacks.join(', ')}`);
        
        for (const fallbackCountry of fallbacks) {
            try {
                const fallbackCode = await this.getCountryCode(fallbackCountry);
                if (!fallbackCode) continue;
                
                console.log(`📞 Tentative d'achat pour ${fallbackCountry} (code ${fallbackCode})...`);
                const status = await this.getNumbersStatus(fallbackCode);
                const waCount = status.wa || 0;
                
                if (waCount > 0) {
                    console.log(`✅ ${waCount} numéros WhatsApp disponibles pour ${fallbackCountry}`);
                    const result = await this.buyNumber(fallbackCountry);
                    
                    if (result.success) {
                        result.countryUsed = fallbackCountry;
                        result.originalCountry = countryCode;
                        console.log(`🎯 Numéro acheté avec succès pour ${fallbackCountry} (au lieu de ${countryCode})`);
                    }
                    return result;
                } else {
                    console.log(`⚠️ Aucun numéro disponible pour ${fallbackCountry}`);
                }
            } catch (error) {
                console.log(`❌ Erreur pour ${fallbackCountry}: ${error.message}`);
                continue;
            }
        }
        
        return {
            success: false,
            error: `Aucun numéro WhatsApp disponible pour ${countryCode} ou ses alternatives (${fallbacks.join(', ')})`
        };
    }

    /**
     * Acheter un numéro UK en essayant différents niveaux de prix/opérateurs
     * Privilégie l'opérateur "Three" en premier pour une meilleure fiabilité
     */
    async buyUKNumberWithPricing(maxRetries = 5) {
        console.log('🇬🇧 Tentative d\'achat numéro UK avec priorité opérateur Three...');
        
        // Opérateurs UK par ordre de priorité (Three en premier pour fiabilité)
        const ukOperators = [
            'three',     // Opérateur Three (priorité absolue)
            'ee',        // EE (deuxième, souvent fiable)
            'o2',        // O2 (troisième)
            'vodafone',  // Vodafone (quatrième)
            'giffgaff',  // GiffGaff (cinquième)
            'tesco',     // Tesco Mobile (sixième)
            'sky',       // Sky Mobile (septième)
            'plusnet',   // PlusNet (huitième)
            'bt',        // BT Mobile (neuvième)
            null,        // Prix standard (le moins cher)
            'any',       // Tout opérateur disponible
            'virtual',   // Numéros virtuels
            'real'       // Numéros réels (plus chers)
        ];
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            console.log(`\n🔄 Tentative ${attempt + 1}/${maxRetries}`);
            
            // Essayer chaque niveau de prix
            for (const operator of ukOperators) {
                try {
                    if (operator === 'three') {
                        console.log(`📞 🎯 Test prioritaire opérateur Three pour UK...`);
                    } else {
                        console.log(`📞 Test ${operator ? `opérateur ${operator}` : 'prix standard'} pour UK...`);
                    }
                    
                    const result = await this.buyNumber('UK', { operator });
                    
                    if (result.success) {
                        if (operator === 'three') {
                            console.log(`✅ 🎯 Numéro UK Three acheté avec succès: ${result.fullNumber} (ID: ${result.id})`);
                        } else {
                            console.log(`✅ Numéro UK acheté: ${result.fullNumber} (ID: ${result.id})`);
                        }
                        console.log(`💰 Niveau: ${operator || 'standard'}`);
                        
                        // Essayer de récupérer le prix
                        let price = null;
                        try {
                            const priceData = await this.getPrices('16', 'wa');
                            price = priceData?.cost || null;
                        } catch (e) {
                            // Ignore si impossible de récupérer le prix
                        }
                        
                        return {
                            ...result,
                            operator: operator || 'standard',
                            attempt: attempt + 1,
                            price: price
                        };
                    } else if (result.error && result.error.includes('NO_NUMBERS')) {
                        if (operator === 'three') {
                            console.log(`❌ 🎯 Opérateur Three: Aucun numéro disponible (passage aux alternatives)`);
                        } else {
                            console.log(`❌ ${operator || 'standard'}: Aucun numéro disponible`);
                        }
                        continue;
                    } else {
                        if (operator === 'three') {
                            console.log(`⚠️ 🎯 Opérateur Three: ${result.error} (passage aux alternatives)`);
                        } else {
                            console.log(`⚠️ ${operator || 'standard'}: ${result.error}`);
                        }
                        continue;
                    }
                    
                } catch (error) {
                    if (operator === 'three') {
                        console.log(`⚠️ 🎯 Erreur opérateur Three: ${error.message} (passage aux alternatives)`);
                    } else {
                        console.log(`⚠️ Erreur ${operator || 'standard'}: ${error.message}`);
                    }
                    continue;
                }
            }
            
            // Pause entre les tentatives
            if (attempt < maxRetries - 1) {
                console.log('⏳ Pause 2s avant nouvelle tentative...');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        return {
            success: false,
            error: `Impossible d'acheter un numéro UK après ${maxRetries} tentatives avec tous les niveaux de prix (Three prioritaire)`,
            attempts: maxRetries
        };
    }

    /**
     * Découvrir les opérateurs UK disponibles pour WhatsApp
     */
    async discoverUKOperators() {
        console.log('🔍 Découverte des opérateurs UK disponibles...');
        
        const knownOperators = [
            'three', 'o2', 'ee', 'vodafone', 'tesco', 'giffgaff', 'asda',
            'any', 'virtual', 'real'
        ];
        
        const availableOperators = [];
        const unavailableOperators = [];
        
        for (const operator of knownOperators) {
            try {
                console.log(`🔍 Test disponibilité opérateur: ${operator}`);
                
                const status = await this.getNumbersStatus('16', operator);
                
                if (status && status !== 'NO_NUMBERS' && !JSON.stringify(status).includes('ERROR')) {
                    availableOperators.push({
                        operator,
                        status: status
                    });
                    console.log(`✅ ${operator}: Disponible`);
                } else {
                    unavailableOperators.push({
                        operator,
                        status: status || 'NO_RESPONSE'
                    });
                    console.log(`❌ ${operator}: Indisponible`);
                }
                
                // Petite pause pour éviter la surcharge API
                await new Promise(resolve => setTimeout(resolve, 500));
                
            } catch (error) {
                unavailableOperators.push({
                    operator,
                    status: `ERROR: ${error.message}`
                });
                console.log(`⚠️ ${operator}: Erreur (${error.message})`);
            }
        }
        
        console.log('\n📊 Résumé opérateurs UK:');
        console.log(`✅ Disponibles (${availableOperators.length}):`, availableOperators.map(op => op.operator));
        console.log(`❌ Indisponibles (${unavailableOperators.length}):`, unavailableOperators.map(op => op.operator));
        
        return {
            available: availableOperators,
            unavailable: unavailableOperators,
            priorityOperatorAvailable: availableOperators.some(op => op.operator === 'three')
        };
    }

    /**
     * Acheter un numéro avec fallback intelligent incluant les prix UK
     */
    async buyNumberWithFallbackAndPricing(countryCode) {
        // Si c'est UK, utiliser la méthode spécialisée avec prix et priorité Three
        if (countryCode.toUpperCase() === 'UK') {
            console.log('🎯 Achat UK détecté - utilisation méthode avec priorité Three');
            const ukResult = await this.buyUKNumberWithPricing();
            
            if (ukResult.success) {
                ukResult.countryUsed = 'UK';
                
                // Marquer si c'est un numéro Three (prioritaire)
                if (ukResult.operator === 'three') {
                    console.log('🎯 ✅ Numéro UK Three obtenu avec succès (opérateur prioritaire)');
                }
                
                return ukResult;
            } else {
                console.warn('⚠️ Échec achat UK avec tous les opérateurs (Three inclus), tentative fallback normal...');
                // Continuer avec la méthode normale en cas d'échec
            }
        }
        
        // Utiliser la méthode normale pour les autres pays ou en fallback
        return await this.buyNumberWithFallback(countryCode);
    }

    /**
     * Récupérer les prix pour un pays et service
     */
    async getPrices(countryCode, service = null) {
        try {
            const params = {
                api_key: this.apiKey,
                action: 'getPrices',
                country: countryCode
            };
            
            if (service) {
                params.service = service;
            }
            
            const url = new URL(this.baseUrl);
            for (const [key, value] of Object.entries(params)) {
                url.searchParams.append(key, value);
            }
            
            const response = await fetch(url.toString(), { timeout: 10000 });
            const result = await response.text();
            const prices = JSON.parse(result);
            
            // Retourner les prix pour le service demandé
            if (service && prices[countryCode] && prices[countryCode][service]) {
                return prices[countryCode][service];
            }
            
            return prices[countryCode] || null;
        } catch (error) {
            throw new Error(`Impossible de récupérer les prix: ${error.message}`);
        }
    }

    /**
     * Récupérer tous les numéros actifs (en attente ou utilisés)
     * @returns {Promise<Array>} Liste des numéros actifs
     */
    async getActiveNumbers() {
        try {
            const timeout = createTimeout('SMS', 'API_TIMEOUT', 10000);
            const response = await withTimeout(
                fetch(`${this.baseUrl}?api_key=${this.apiKey}&action=getCurrentActivationsList`, 
                     { timeout }),
                timeout,
                'SMS-Activate getActiveNumbers timeout'
            );

            const result = await response.text();
            
            if (result === 'NO_DATA') {
                console.log('✅ Aucun numéro SMS actif trouvé');
                return [];
            }

            // Parse JSON response si disponible
            try {
                const activeNumbers = JSON.parse(result);
                console.log(`📱 ${Object.keys(activeNumbers).length} numéros SMS actifs trouvés`);
                return Object.entries(activeNumbers).map(([id, data]) => ({
                    id,
                    phone: data.phone,
                    service: data.service,
                    country: data.country,
                    status: data.status,
                    createDate: data.createDate
                }));
            } catch (parseError) {
                console.warn('⚠️ Impossible de parser la liste des numéros actifs:', result);
                return [];
            }
            
        } catch (error) {
            console.warn(`⚠️ Erreur récupération numéros actifs: ${error.message}`);
            return [];
        }
    }

    /**
     * Annuler tous les numéros actifs avec gestion des erreurs non-bloquantes
     * @param {Object} options - Options de nettoyage
     * @returns {Promise<Object>} Résultats du nettoyage
     */
    async cancelAllActiveNumbers(options = {}) {
        const {
            maxConcurrent = 5, // Maximum 5 annulations en parallèle
            ignoreErrors = true, // Ignorer les erreurs d'annulation
            onlyWhatsApp = true, // Annuler seulement les numéros WhatsApp
            logProgress = true
        } = options;

        console.log('🧹 Début du nettoyage global des numéros SMS...');
        
        try {
            // Récupérer tous les numéros actifs
            const activeNumbers = await this.getActiveNumbers();
            
            if (activeNumbers.length === 0) {
                console.log('✅ Aucun numéro SMS à nettoyer');
                return {
                    success: true,
                    total: 0,
                    cancelled: 0,
                    failed: 0,
                    errors: []
                };
            }

            // Filtrer les numéros WhatsApp si demandé
            const numbersToCancel = onlyWhatsApp 
                ? activeNumbers.filter(num => num.service === 'wa')
                : activeNumbers;

            if (logProgress) {
                console.log(`🎯 ${numbersToCancel.length} numéros à annuler (total actifs: ${activeNumbers.length})`);
            }

            const results = {
                success: true,
                total: numbersToCancel.length,
                cancelled: 0,
                failed: 0,
                errors: []
            };

            // Annuler par batches pour éviter la surcharge
            for (let i = 0; i < numbersToCancel.length; i += maxConcurrent) {
                const batch = numbersToCancel.slice(i, i + maxConcurrent);
                
                if (logProgress) {
                    console.log(`🔄 Traitement batch ${Math.floor(i / maxConcurrent) + 1}/${Math.ceil(numbersToCancel.length / maxConcurrent)}`);
                }

                // Annuler en parallèle pour ce batch
                const promises = batch.map(async (numberInfo) => {
                    try {
                        const success = await this.cancelNumber(numberInfo.id, {
                            force: true, // Forcer l'annulation pour le nettoyage global
                            minDelay: 0   // Pas de délai pour le nettoyage
                        });
                        
                        if (success) {
                            results.cancelled++;
                            if (logProgress) {
                                console.log(`✅ Annulé: ${numberInfo.phone} (${numberInfo.id})`);
                            }
                        } else {
                            results.failed++;
                            if (logProgress) {
                                console.log(`⚠️ Échec annulation: ${numberInfo.phone} (${numberInfo.id})`);
                            }
                        }
                        
                        return { success, numberInfo };
                    } catch (error) {
                        results.failed++;
                        results.errors.push({
                            numberId: numberInfo.id,
                            phone: numberInfo.phone,
                            error: error.message
                        });
                        
                        if (logProgress) {
                            console.log(`❌ Erreur annulation ${numberInfo.phone}: ${error.message}`);
                        }
                        
                        if (!ignoreErrors) {
                            throw error;
                        }
                        
                        return { success: false, numberInfo, error };
                    }
                });

                // Attendre que tous les numéros du batch soient traités
                await Promise.all(promises);

                // Petite pause entre les batches
                if (i + maxConcurrent < numbersToCancel.length) {
                    await sleep(1000); // 1 seconde entre les batches
                }
            }

            // Nettoyer le cache des temps d'achat
            this.purchaseTimes.clear();

            if (logProgress) {
                console.log(`🎯 Nettoyage terminé: ${results.cancelled}/${results.total} annulés, ${results.failed} échecs`);
            }

            return results;

        } catch (error) {
            console.error(`❌ Erreur nettoyage global SMS: ${error.message}`);
            
            if (!options.ignoreErrors) {
                throw error;
            }
            
            return {
                success: false,
                total: 0,
                cancelled: 0,
                failed: 0,
                errors: [{ global: error.message }]
            };
        }
    }

    /**
     * Nettoyer les ressources
     */
    async cleanup() {
        // Nettoyer le cache des temps d'achat
        this.purchaseTimes.clear();
        console.log('🧹 Cache des temps d\'achat nettoyé');
    }
}

module.exports = { SMSActivateProvider };
/**
 * Gestionnaire SMS Minimal
 * Version allégée pour SMS-activate.io avec seulement les fonctions essentielles
 */

// Import modules extraits
const { PhoneNumberParser, PHONE_COUNTRY_CODES } = require('./sms/parsers');

// Robust fetch implementation that works with both Node.js versions
let fetch;
try {
    // Try to use built-in fetch (Node.js 18+)
    fetch = globalThis.fetch;
    if (!fetch) {
        // Fall back to node-fetch for older versions
        fetch = require('node-fetch');
    }
} catch (error) {
    try {
        // Try to require node-fetch as fallback
        fetch = require('node-fetch');
    } catch (fetchError) {
        console.error('❌ Impossible de charger fetch. Installez node-fetch ou utilisez Node.js 18+');
        process.exit(1);
    }
}

/**
 * Codes pays supportés avec leurs indicatifs téléphoniques
 * Codes mis à jour selon la documentation SMS-Activate.io (vérifiés le 2025-01-08)
 */
const COUNTRY_CODES = {
    UK: '16',   // United Kingdom (souvent pas disponible)
    US: '187',  // USA (numéros réels)
    US_VIRTUAL: '12', // USA Virtual
    FR: '78',   // France
    DE: '43',   // Germany
    ES: '56',   // Spain
    CA: '36',   // Canada
    IT: '86',   // Italy
    RU: '0',    // Russia
    UA: '1'     // Ukraine
};

/**
 * Pays avec disponibilité élevée (priorité)
 */
const HIGH_AVAILABILITY_COUNTRIES = ['US', 'FR', 'DE'];

/**
 * Fallback automatique si le pays demandé n'a pas de numéros
 */
const COUNTRY_FALLBACKS = {
    'UK': ['US', 'FR', 'DE'],
    'GB': ['US', 'FR', 'DE'],
    'US': ['FR', 'DE', 'ES'],
    'FR': ['US', 'DE', 'ES'],
    'DE': ['US', 'FR', 'ES'],
    'ES': ['US', 'FR', 'DE']
};

/**
 * Mapping des noms de pays vers les codes API
 */
const COUNTRY_NAME_TO_CODE = {
    'UK': 'United Kingdom',
    'US': 'USA',
    'FR': 'France',
    'DE': 'Germany',
    'ES': 'Spain'
};

// Note: PhoneNumberParser est maintenant importé depuis ./sms/parsers
// Note: PHONE_COUNTRY_CODES est maintenant importé depuis ./sms/parsers

class SMSManager {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://api.sms-activate.ae/stubs/handler_api.php';
        this.defaultService = 'wa'; // WhatsApp
    }

    /**
     * Effectuer une requête API
     */
    async makeRequest(params) {
        try {
            const url = new URL(this.baseUrl);
            url.searchParams.append('api_key', this.apiKey);
            
            for (const [key, value] of Object.entries(params)) {
                url.searchParams.append(key, value);
            }

            const response = await fetch(url.toString());
            const text = await response.text();
            
            return text.trim();
        } catch (error) {
            throw new Error(`Erreur API SMS: ${error.message}`);
        }
    }

    /**
     * Vérifier le solde
     */
    async getBalance() {
        try {
            const result = await this.makeRequest({ action: 'getBalance' });
            
            if (result.startsWith('ACCESS_BALANCE:')) {
                const balance = parseFloat(result.split(':')[1]);
                return { success: true, balance };
            }
            
            throw new Error(`Erreur solde: ${result}`);
        } catch (error) {
            throw new Error(`Impossible de récupérer le solde: ${error.message}`);
        }
    }

    /**
     * Récupérer la liste des pays disponibles
     */
    async getCountries() {
        try {
            const result = await this.makeRequest({ action: 'getCountries' });
            return JSON.parse(result);
        } catch (error) {
            throw new Error(`Impossible de récupérer les pays: ${error.message}`);
        }
    }

    /**
     * Récupérer les pays disponibles avec leurs codes
     */
    async getAvailableCountries() {
        try {
            const countries = await this.getCountries();
            const availableCountries = [];
            
            for (const [countryId, countryData] of Object.entries(countries)) {
                if (countryData && countryData.eng) {
                    availableCountries.push({
                        id: countryId,
                        name: countryData.eng,
                        code: countryData.country || countryData.eng.substring(0, 2).toUpperCase()
                    });
                }
            }
            
            return availableCountries;
        } catch (error) {
            throw new Error(`Impossible de récupérer les pays disponibles: ${error.message}`);
        }
    }

    /**
     * Vérifier la disponibilité des numéros pour un pays et service
     */
    async getNumbersStatus(countryCode, operator = null) {
        try {
            const params = {
                action: 'getNumbersStatus',
                country: countryCode
            };
            
            if (operator) {
                params.operator = operator;
            }
            
            const result = await this.makeRequest(params);
            return JSON.parse(result);
        } catch (error) {
            throw new Error(`Impossible de vérifier le statut des numéros: ${error.message}`);
        }
    }

    /**
     * Acheter un numéro pour un pays
     */
    async buyNumber(countryCode) {
        try {
            console.log(`📞 Achat numéro ${countryCode}...`);
            
            const result = await this.makeRequest({
                action: 'getNumber',
                service: this.defaultService,
                country: countryCode
            });

            if (result.startsWith('ACCESS_NUMBER:')) {
                const [, id, number] = result.split(':');
                console.log(`✅ Numéro acheté: +${number} (ID: ${id})`);
                
                return {
                    success: true,
                    id,
                    number,
                    fullNumber: `+${number}`
                };
            }
            
            throw new Error(`Échec achat: ${result}`);
        } catch (error) {
            throw new Error(`Impossible d'acheter un numéro: ${error.message}`);
        }
    }

    /**
     * Attendre et récupérer le code SMS
     */
    async waitForSMS(id, timeoutMs = 300000) {
        try {
            console.log(`📨 Attente SMS pour ID: ${id}...`);
            
            const startTime = Date.now();
            const checkInterval = 10000; // 10 secondes
            
            while (Date.now() - startTime < timeoutMs) {
                const result = await this.makeRequest({
                    action: 'getStatus',
                    id: id
                });

                if (result.startsWith('STATUS_OK:')) {
                    const code = result.split(':')[1];
                    console.log(`✅ Code SMS reçu: ${code}`);
                    return { success: true, code };
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
            throw new Error(`Erreur récupération SMS: ${error.message}`);
        }
    }

    /**
     * Annuler un numéro
     */
    async cancelNumber(id) {
        try {
            await this.makeRequest({
                action: 'setStatus',
                id: id,
                status: '8' // CANCEL
            });
            console.log(`🗑️ Numéro ${id} annulé`);
            return true;
        } catch (error) {
            console.error(`❌ Erreur annulation: ${error.message}`);
            return false;
        }
    }

    /**
     * Confirmer réception du SMS
     */
    async confirmSMS(id) {
        try {
            await this.makeRequest({
                action: 'setStatus',
                id: id,
                status: '6' // ACCESS_ACTIVATION
            });
            console.log(`✅ SMS confirmé pour ${id}`);
            return true;
        } catch (error) {
            console.error(`❌ Erreur confirmation: ${error.message}`);
            return false;
        }
    }

    /**
     * Récupérer les prix pour un pays et service
     */
    async getPrices(countryCode, service = null) {
        try {
            const params = {
                action: 'getPrices',
                country: countryCode
            };
            
            if (service) {
                params.service = service;
            }
            
            const result = await this.makeRequest(params);
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
}

/**
 * Gestionnaire SMS étendu avec auto-detection des codes pays
 */
class SMSManagerExtended extends SMSManager {
    constructor(apiKey) {
        super(apiKey);
        this.countryCodes = null;
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
                this.countryCodes = COUNTRY_CODES;
            }
        }
        
        return this.countryCodes[countryName.toUpperCase()];
    }

    /**
     * Acheter un numéro pour un pays (méthode simple, sans fallback)
     */
    async buyNumber(countryCode) {
        const code = await this.getCountryCode(countryCode);
        if (!code) {
            return {
                success: false,
                error: `Pays ${countryCode} non supporté`
            };
        }

        const result = await super.buyNumber(code);
        
        // Ajouter le parsing du numéro si succès
        if (result.success) {
            const parsedNumber = PhoneNumberParser.parseNumber(result.number, countryCode);
            result.parsed = parsedNumber;
            result.countryUsed = countryCode;
        }

        return result;
    }

    /**
     * Récupérer les pays disponibles avec diagnostic
     */
    async getAvailableCountries() {
        try {
            const countries = await super.getAvailableCountries();
            
            // Ajouter des informations de diagnostic
            console.log(`📊 ${countries.length} pays disponibles`);
            
            // Vérifier spécifiquement UK, US, FR
            const priorityCountries = ['UK', 'US', 'FR', 'DE', 'ES'];
            for (const priority of priorityCountries) {
                const found = countries.find(c => 
                    c.code === priority || 
                    c.name.toLowerCase().includes(priority.toLowerCase())
                );
                if (found) {
                    console.log(`✅ ${priority}: ID ${found.id} (${found.name})`);
                } else {
                    console.log(`❌ ${priority}: Non trouvé`);
                }
            }
            
            return countries;
        } catch (error) {
            console.warn('⚠️ Utilisation des codes pays par défaut');
            return [
                { id: '16', name: 'United Kingdom', code: 'UK' },
                { id: '187', name: 'USA', code: 'US' },
                { id: '78', name: 'France', code: 'FR' },
                { id: '43', name: 'Germany', code: 'DE' },
                { id: '56', name: 'Spain', code: 'ES' }
            ];
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
     * Workflow complet: acheter numéro + attendre SMS
     */
    async getNumberWithSMS(countryCode) {
        const code = await this.getCountryCode(countryCode);
        if (!code) {
            return {
                success: false,
                error: `Pays ${countryCode} non supporté`
            };
        }

        const result = await super.getNumberWithSMS(code);
        
        // Ajouter le parsing du numéro si succès
        if (result.success) {
            const parsedNumber = PhoneNumberParser.parseNumber(result.number, countryCode);
            result.parsed = parsedNumber;
        }

        return result;
    }

    /**
     * Vérifier la disponibilité et acheter un numéro avec fallback intelligent
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
                const result = await super.buyNumber(code);
                
                if (result.success) {
                    const parsedNumber = PhoneNumberParser.parseNumber(result.number, countryCode);
                    result.parsed = parsedNumber;
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
        const fallbacks = COUNTRY_FALLBACKS[countryCode] || HIGH_AVAILABILITY_COUNTRIES;
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
                    const result = await super.buyNumber(fallbackCode);
                    
                    if (result.success) {
                        const parsedNumber = PhoneNumberParser.parseNumber(result.number, fallbackCountry);
                        result.parsed = parsedNumber;
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
                    
                    const params = {
                        action: 'getNumber',
                        service: this.defaultService,
                        country: '16' // UK code
                    };
                    
                    if (operator) {
                        params.operator = operator;
                    }
                    
                    const result = await this.makeRequest(params);
                    
                    if (result.startsWith('ACCESS_NUMBER:')) {
                        const [, id, number] = result.split(':');
                        if (operator === 'three') {
                            console.log(`✅ 🎯 Numéro UK Three acheté avec succès: +${number} (ID: ${id})`);
                        } else {
                            console.log(`✅ Numéro UK acheté: +${number} (ID: ${id})`);
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
                            success: true,
                            id,
                            number,
                            fullNumber: `+${number}`,
                            operator: operator || 'standard',
                            attempt: attempt + 1,
                            price: price
                        };
                    } else if (result === 'NO_NUMBERS') {
                        if (operator === 'three') {
                            console.log(`❌ 🎯 Opérateur Three: Aucun numéro disponible (passage aux alternatives)`);
                        } else {
                            console.log(`❌ ${operator || 'standard'}: Aucun numéro disponible`);
                        }
                        // Continuer avec l'opérateur suivant
                        continue;
                    } else {
                        if (operator === 'three') {
                            console.log(`⚠️ 🎯 Opérateur Three: ${result} (passage aux alternatives)`);
                        } else {
                            console.log(`⚠️ ${operator || 'standard'}: ${result}`);
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
     * Utile pour debugging et optimisation
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
                
                const params = {
                    action: 'getNumbersStatus',
                    service: 'wa',
                    country: '16', // UK
                    operator: operator
                };
                
                const result = await this.makeRequest(params);
                
                if (result && result !== 'NO_NUMBERS' && !result.includes('ERROR')) {
                    availableOperators.push({
                        operator,
                        status: result
                    });
                    console.log(`✅ ${operator}: Disponible (${result})`);
                } else {
                    unavailableOperators.push({
                        operator,
                        status: result || 'NO_RESPONSE'
                    });
                    console.log(`❌ ${operator}: Indisponible (${result})`);
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
     * Privilégie automatiquement l'opérateur Three pour les numéros UK
     */
    async buyNumberWithFallbackAndPricing(countryCode) {
        // Si c'est UK, utiliser la méthode spécialisée avec prix et priorité Three
        if (countryCode.toUpperCase() === 'UK') {
            console.log('🎯 Achat UK détecté - utilisation méthode avec priorité Three');
            const ukResult = await this.buyUKNumberWithPricing();
            
            if (ukResult.success) {
                // Parser le numéro
                const parsedNumber = PhoneNumberParser.parseNumber(ukResult.number, 'UK');
                ukResult.parsed = parsedNumber;
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
}

module.exports = { 
    SMSManager, 
    SMSManagerExtended,
    COUNTRY_CODES,
    PhoneNumberParser 
};
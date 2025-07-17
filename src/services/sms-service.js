/**
 * SMS Service - Version simplifiée unifiée
 * Fusion de SMSService + SMSActivateProvider + core/sms.js
 */

const fetch = require('node-fetch');

/**
 * Parser simple pour les numéros de téléphone
 */
class PhoneNumberParser {
    static parseNumber(phone, country) {
        try {
            if (!phone || !country) {
                return {
                    success: false,
                    error: 'Numéro ou pays manquant'
                };
            }

            const cleaned = phone.replace(/\D/g, '');
            
            if (cleaned.length < 10) {
                return {
                    success: false,
                    error: 'Numéro trop court'
                };
            }
            
            const countryData = {
                'UK': { code: '44', prefix: '44' },
                'FR': { code: '33', prefix: '33' },
                'US': { code: '1', prefix: '1' },
                'DE': { code: '49', prefix: '49' },
                'ES': { code: '34', prefix: '34' },
                'ID': { code: '62', prefix: '62' }
            };
            
            const data = countryData[country.toUpperCase()];
            
            if (!data) {
                return {
                    success: false,
                    error: `Pays ${country} non supporté`
                };
            }

            // Extraire le numéro local (supprimer le code pays s'il est présent)
            let localNumber = cleaned;
            if (cleaned.startsWith(data.prefix)) {
                localNumber = cleaned.substring(data.prefix.length);
            }
            
            return {
                success: true,
                country: country.toUpperCase(),
                countryCode: data.code,
                localNumber: localNumber,
                nationalNumber: cleaned,
                internationalNumber: `+${data.code}${localNumber}`,
                formatted: `+${data.code}${localNumber}`
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

/**
 * Service SMS unifié avec SMS-Activate
 */
class SMSService {
    constructor(config = {}) {
        this.apiKey = config.apiKey || config.smsApiKey || process.env.SMS_ACTIVATE_API_KEY;
        this.baseUrl = 'https://api.sms-activate.ae/stubs/handler_api.php';
        this.serviceId = 'wa'; // WhatsApp
        
        this.countryMap = {
            'UK': '16',
            'US': '187',
            'US_VIRTUAL': '12',
            'FR': '78',
            'DE': '43',
            'ES': '56',
            'CA': '36',
            'IT': '86',
            'ID': '6'
        };
        
        this.countryFallbacks = {
            'UK': ['US', 'FR', 'DE'],
            'US': ['FR', 'DE', 'ES'],
            'FR': ['US', 'DE', 'ES'],
            'DE': ['US', 'FR', 'ES'],
            'ID': ['US', 'FR', 'DE']
        };
        
        this.purchaseTimes = new Map();
        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0
        };
    }

    /**
     * Initialiser le service SMS
     */
    async initialize() {
        if (!this.apiKey) {
            throw new Error('SMS-Activate API key required');
        }

        try {
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
     */
    async buyNumber(country, options = {}) {
        const startTime = Date.now();
        
        try {
            const countryCode = this.getCountryCode(country);
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
            
            if (options.operator) {
                params.operator = options.operator;
            }
            
            const url = new URL(this.baseUrl);
            Object.entries(params).forEach(([key, value]) => {
                url.searchParams.append(key, value);
            });
            
            const response = await fetch(url.toString(), { timeout: 10000 });
            const result = await response.text();
            
            if (result.startsWith('ACCESS_NUMBER:')) {
                const [, id, phone] = result.split(':');
                const formattedPhone = this.formatPhone(phone, country);
                const purchaseTime = Date.now();
                
                this.purchaseTimes.set(id, purchaseTime);
                this.recordMetric(true);
                
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
            this.recordMetric(false);
            return {
                success: false,
                error: error.message,
                provider: 'sms-activate'
            };
        }
    }

    /**
     * Attendre la réception d'un SMS
     */
    async waitForSMS(numberId, timeout = 120000) {
        const startTime = Date.now();
        const maxTime = startTime + timeout;
        const checkInterval = 10000;
        
        console.log(`📨 Attente SMS pour ${numberId} avec timeout ${timeout}ms`);
        
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
                    
                    this.recordMetric(true);
                    
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
            this.recordMetric(false);
            return {
                success: false,
                error: error.message,
                provider: 'sms-activate'
            };
        }
    }

    /**
     * Annuler un numéro
     */
    async cancelNumber(numberId, options = {}) {
        const minDelayMs = options.minDelay || 30000;
        const forceCancel = options.force || false;
        
        try {
            const purchaseTime = options.purchaseTime || this.purchaseTimes.get(numberId);
            
            if (!forceCancel && purchaseTime) {
                const elapsed = Date.now() - purchaseTime;
                if (elapsed < minDelayMs) {
                    const remaining = minDelayMs - elapsed;
                    console.log(`⏳ Attente ${Math.ceil(remaining / 1000)}s avant annulation`);
                    await new Promise(resolve => setTimeout(resolve, remaining));
                }
            }

            const response = await fetch(
                `${this.baseUrl}?api_key=${this.apiKey}&action=setStatus&status=8&id=${numberId}`,
                { timeout: 10000 }
            );

            const result = await response.text();
            
            if (result === 'ACCESS_CANCEL') {
                console.log(`✅ Numéro ${numberId} annulé avec succès`);
                this.purchaseTimes.delete(numberId);
                return true;
            } else if (result === 'EARLY_CANCEL_DENIED') {
                console.warn(`⚠️ Annulation refusée (trop tôt): ${numberId}`);
                return false;
            } else {
                throw new Error(`Erreur annulation: ${result}`);
            }
        } catch (error) {
            console.error('❌ Erreur annulation:', error);
            return false;
        }
    }

    /**
     * Obtenir le solde du compte
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
                return { balance: parseFloat(balance) };
            } else {
                throw new Error(`Erreur balance: ${result}`);
            }
        } catch (error) {
            console.error('❌ Erreur récupération solde:', error);
            return { balance: 0 };
        }
    }

    /**
     * Obtenir les pays supportés
     */
    getSupportedCountries() {
        return Object.keys(this.countryMap);
    }

    /**
     * Obtenir le statut des numéros pour un pays
     */
    async getNumbersStatus(country) {
        try {
            const countryCode = this.getCountryCode(country);
            if (!countryCode) {
                return { available: false, count: 0, error: 'Pays non supporté' };
            }

            const response = await fetch(
                `${this.baseUrl}?api_key=${this.apiKey}&action=getNumbersStatus&country=${countryCode}&service=${this.serviceId}`,
                { timeout: 10000 }
            );

            const result = await response.text();
            
            if (result.includes('COUNT')) {
                const [, count] = result.split(':');
                return { 
                    available: parseInt(count) > 0, 
                    count: parseInt(count),
                    country: country 
                };
            } else {
                return { available: false, count: 0, error: result };
            }
        } catch (error) {
            console.error(`❌ Erreur statut numéros ${country}:`, error);
            return { available: false, count: 0, error: error.message };
        }
    }

    /**
     * Acheter un numéro avec fallback intelligent
     */
    async buyNumberWithFallbackAndPricing(countryCode) {
        // Si c'est UK, essayer différents opérateurs
        if (countryCode.toUpperCase() === 'UK') {
            return await this.buyUKNumberWithPricing();
        }
        
        return await this.buyNumberWithFallback(countryCode);
    }

    /**
     * Acheter un numéro avec fallback sur d'autres pays
     */
    async buyNumberWithFallback(countryCode) {
        const code = this.getCountryCode(countryCode);
        if (!code) {
            return {
                success: false,
                error: `Pays ${countryCode} non supporté`
            };
        }

        console.log(`📞 Tentative d'achat pour ${countryCode}...`);
        
        try {
            const result = await this.buyNumber(countryCode);
            
            if (result.success) {
                result.countryUsed = countryCode;
                return result;
            }
        } catch (error) {
            console.log(`❌ Erreur pour ${countryCode}: ${error.message}`);
        }
        
        // Essayer les pays de fallback
        const fallbacks = this.countryFallbacks[countryCode] || ['US', 'FR', 'DE'];
        console.log(`🔄 Essai des pays alternatifs: ${fallbacks.join(', ')}`);
        
        for (const fallbackCountry of fallbacks) {
            try {
                console.log(`📞 Tentative d'achat pour ${fallbackCountry}...`);
                const result = await this.buyNumber(fallbackCountry);
                
                if (result.success) {
                    result.countryUsed = fallbackCountry;
                    result.originalCountry = countryCode;
                    console.log(`🎯 Numéro acheté avec succès pour ${fallbackCountry}`);
                    return result;
                }
            } catch (error) {
                console.log(`❌ Erreur pour ${fallbackCountry}: ${error.message}`);
                continue;
            }
        }
        
        return {
            success: false,
            error: `Aucun numéro disponible pour ${countryCode} ou ses alternatives`
        };
    }

    /**
     * Acheter un numéro UK avec différents opérateurs
     */
    async buyUKNumberWithPricing(maxRetries = 5) {
        console.log('🇬🇧 Tentative d\'achat numéro UK avec opérateurs...');
        
        const ukOperators = [
            'three', 'ee', 'o2', 'vodafone', 'giffgaff',
            null, 'any', 'virtual', 'real'
        ];
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            console.log(`\n🔄 Tentative ${attempt + 1}/${maxRetries}`);
            
            for (const operator of ukOperators) {
                try {
                    console.log(`📞 Test ${operator ? `opérateur ${operator}` : 'prix standard'} pour UK...`);
                    
                    const result = await this.buyNumber('UK', { operator });
                    
                    if (result.success) {
                        console.log(`✅ Numéro UK acheté: ${result.fullNumber} (${operator || 'standard'})`);
                        return {
                            ...result,
                            operator: operator || 'standard',
                            attempt: attempt + 1
                        };
                    }
                } catch (error) {
                    console.log(`⚠️ Erreur ${operator || 'standard'}: ${error.message}`);
                    continue;
                }
            }
            
            if (attempt < maxRetries - 1) {
                console.log('⏳ Pause 2s avant nouvelle tentative...');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        return {
            success: false,
            error: `Impossible d'acheter un numéro UK après ${maxRetries} tentatives`,
            attempts: maxRetries
        };
    }

    /**
     * Annuler tous les numéros actifs
     */
    async cancelAllActiveNumbers(options = {}) {
        const {
            maxConcurrent = 3,
            ignoreErrors = true,
            onlyWhatsApp = true,
            logProgress = true
        } = options;

        console.log('🧹 Début du nettoyage global des numéros SMS...');
        
        try {
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

            const numbersToCancel = onlyWhatsApp 
                ? activeNumbers.filter(num => num.service === 'wa')
                : activeNumbers;

            if (logProgress) {
                console.log(`🎯 ${numbersToCancel.length} numéros à annuler`);
            }

            const results = {
                success: true,
                total: numbersToCancel.length,
                cancelled: 0,
                failed: 0,
                errors: []
            };

            // Annuler par batches
            for (let i = 0; i < numbersToCancel.length; i += maxConcurrent) {
                const batch = numbersToCancel.slice(i, i + maxConcurrent);
                
                const promises = batch.map(async (numberInfo) => {
                    try {
                        const success = await this.cancelNumber(numberInfo.id, {
                            force: true,
                            minDelay: 0
                        });
                        
                        if (success) {
                            results.cancelled++;
                            if (logProgress) {
                                console.log(`✅ Annulé: ${numberInfo.phone}`);
                            }
                        } else {
                            results.failed++;
                        }
                        
                        return { success, numberInfo };
                    } catch (error) {
                        results.failed++;
                        results.errors.push({
                            numberId: numberInfo.id,
                            error: error.message
                        });
                        
                        if (!ignoreErrors) {
                            throw error;
                        }
                        
                        return { success: false, numberInfo, error };
                    }
                });

                await Promise.all(promises);

                if (i + maxConcurrent < numbersToCancel.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            this.purchaseTimes.clear();

            if (logProgress) {
                console.log(`🎯 Nettoyage terminé: ${results.cancelled}/${results.total} annulés`);
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
     * Récupérer tous les numéros actifs
     */
    async getActiveNumbers() {
        try {
            const response = await fetch(
                `${this.baseUrl}?api_key=${this.apiKey}&action=getCurrentActivationsList`,
                { timeout: 10000 }
            );

            const result = await response.text();
            
            if (result === 'NO_DATA') {
                return [];
            }

            try {
                const activeNumbers = JSON.parse(result);
                return Object.entries(activeNumbers).map(([id, data]) => ({
                    id,
                    phone: data.phone,
                    service: data.service,
                    country: data.country,
                    status: data.status,
                    createDate: data.createDate
                }));
            } catch (parseError) {
                return [];
            }
        } catch (error) {
            console.warn(`⚠️ Erreur récupération numéros actifs: ${error.message}`);
            return [];
        }
    }

    /**
     * Utilitaires
     */
    getCountryCode(country) {
        return this.countryMap[country.toUpperCase()];
    }

    formatPhone(phone, country) {
        const cleaned = phone.replace(/\D/g, '');
        
        switch (country.toUpperCase()) {
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

    recordMetric(success) {
        this.metrics.totalRequests++;
        if (success) {
            this.metrics.successfulRequests++;
        } else {
            this.metrics.failedRequests++;
        }
    }

    getMetrics() {
        return {
            ...this.metrics,
            provider: 'sms-activate',
            successRate: this.metrics.totalRequests > 0 ? 
                (this.metrics.successfulRequests / this.metrics.totalRequests) * 100 : 0
        };
    }

    async cleanup() {
        this.purchaseTimes.clear();
        console.log('🧹 SMS Service nettoyé');
    }
}

/**
 * Factory functions pour compatibilité
 */
async function createSMSManager(config = {}) {
    const service = new SMSService(config);
    await service.initialize();
    return service;
}

async function createSMSManagerExtended(apiKey) {
    const service = new SMSService({ apiKey });
    await service.initialize();
    return service;
}

module.exports = {
    SMSService,
    PhoneNumberParser,
    createSMSManager,
    createSMSManagerExtended
};
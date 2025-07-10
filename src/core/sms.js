/**
 * SMS Core Module - Refactored to use Services Architecture
 * 
 * This module now serves as a compatibility layer that delegates to the
 * new services-based SMS architecture while maintaining the original API.
 */

const { createSMSManager, createSMSManagerExtended, PhoneNumberParser } = require('../services/sms');

// Re-export the parser for backward compatibility
const { PHONE_COUNTRY_CODES } = require('./sms/parsers');

/**
 * Codes pays supportés avec leurs indicatifs téléphoniques
 * Maintained for backward compatibility
 */
const COUNTRY_CODES = {
    UK: '16',   // United Kingdom
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
 * Legacy SMSManager class - now delegates to services
 */
class SMSManager {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this._serviceManager = null;
        this._initialized = false;
    }

    async _ensureInitialized() {
        if (!this._initialized) {
            this._serviceManager = await createSMSManager({ apiKey: this.apiKey });
            this._initialized = true;
        }
        return this._serviceManager;
    }

    async makeRequest(params) {
        const manager = await this._ensureInitialized();
        // This method is not directly used in the new architecture
        // but maintained for compatibility if needed
        throw new Error('makeRequest is deprecated - use specific methods instead');
    }

    async getBalance() {
        const manager = await this._ensureInitialized();
        const balance = await manager.getBalance();
        return { success: true, balance };
    }

    async getCountries() {
        const manager = await this._ensureInitialized();
        return await manager.getCountries();
    }

    async getAvailableCountries() {
        const manager = await this._ensureInitialized();
        return await manager.getAvailableCountries();
    }

    async getNumbersStatus(countryCode, operator = null) {
        const manager = await this._ensureInitialized();
        return await manager.getNumbersStatus(countryCode, operator);
    }

    async buyNumber(countryCode) {
        const manager = await this._ensureInitialized();
        return await manager.buyNumber(countryCode);
    }

    async waitForSMS(id, timeoutMs = 300000) {
        const manager = await this._ensureInitialized();
        return await manager.waitForSMS(id, timeoutMs);
    }

    async cancelNumber(id) {
        const manager = await this._ensureInitialized();
        return await manager.cancelNumber(id);
    }

    async confirmSMS(id) {
        const manager = await this._ensureInitialized();
        return await manager.confirmSMS(id);
    }

    async getPrices(countryCode, service = null) {
        const manager = await this._ensureInitialized();
        return await manager.getPrices(countryCode, service);
    }
}

/**
 * Legacy SMSManagerExtended class - now delegates to services
 */
class SMSManagerExtended extends SMSManager {
    constructor(apiKey) {
        super(apiKey);
    }

    async _ensureInitialized() {
        if (!this._initialized) {
            this._serviceManager = await createSMSManagerExtended(this.apiKey);
            this._initialized = true;
        }
        return this._serviceManager;
    }

    async getCountryCode(countryName) {
        const manager = await this._ensureInitialized();
        return await manager.getCountryCode(countryName);
    }

    async buyNumberWithFallback(countryCode) {
        const manager = await this._ensureInitialized();
        return await manager.buyNumberWithFallback(countryCode);
    }

    async diagnoseBuyNumber(countryCode) {
        const manager = await this._ensureInitialized();
        return await manager.diagnoseBuyNumber(countryCode);
    }

    async getNumberWithSMS(countryCode) {
        const manager = await this._ensureInitialized();
        return await manager.getNumberWithSMS(countryCode);
    }

    async buyUKNumberWithPricing(maxRetries = 5) {
        const manager = await this._ensureInitialized();
        return await manager.buyUKNumberWithPricing(maxRetries);
    }

    async discoverUKOperators() {
        const manager = await this._ensureInitialized();
        return await manager.discoverUKOperators();
    }

    async buyNumberWithFallbackAndPricing(countryCode) {
        const manager = await this._ensureInitialized();
        return await manager.buyNumberWithFallbackAndPricing(countryCode);
    }
}

module.exports = { 
    SMSManager, 
    SMSManagerExtended,
    COUNTRY_CODES,
    PhoneNumberParser 
};
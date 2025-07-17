/**
 * Helpers - Version simplifiée unifiée
 * Fusion de Helpers + Validator + utilitaires divers
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Helper pour la gestion des fichiers
 */
class FileHelper {
    static ensureDirectoryExists(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
            return true;
        }
        return false;
    }

    static deleteFileIfExists(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                return true;
            }
            return false;
        } catch (error) {
            console.warn(`⚠️ Erreur suppression fichier ${filePath}:`, error.message);
            return false;
        }
    }

    static readFileIfExists(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                return fs.readFileSync(filePath, 'utf8');
            }
            return null;
        } catch (error) {
            console.warn(`⚠️ Erreur lecture fichier ${filePath}:`, error.message);
            return null;
        }
    }

    static writeFileSync(filePath, content) {
        try {
            const dir = path.dirname(filePath);
            this.ensureDirectoryExists(dir);
            fs.writeFileSync(filePath, content, 'utf8');
            return true;
        } catch (error) {
            console.error(`❌ Erreur écriture fichier ${filePath}:`, error.message);
            return false;
        }
    }

    static getFileSize(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                return stats.size;
            }
            return 0;
        } catch (error) {
            return 0;
        }
    }

    static getFileAge(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                return Date.now() - stats.mtime.getTime();
            }
            return null;
        } catch (error) {
            return null;
        }
    }
}

/**
 * Helper pour la configuration
 */
class ConfigHelper {
    static getEnvVar(name, defaultValue = null) {
        return process.env[name] || defaultValue;
    }

    static getRequiredEnvVar(name) {
        const value = process.env[name];
        if (!value) {
            throw new Error(`Variable d'environnement requise manquante: ${name}`);
        }
        return value;
    }

    static validateRequired(envVars) {
        const missing = [];
        for (const envVar of envVars) {
            if (!process.env[envVar]) {
                missing.push(envVar);
            }
        }
        
        if (missing.length > 0) {
            throw new Error(`Variables d'environnement manquantes: ${missing.join(', ')}`);
        }
        return true;
    }

    static getConfig() {
        return {
            smsApiKey: this.getEnvVar('SMS_ACTIVATE_API_KEY'),
            supabaseUrl: this.getEnvVar('SUPABASE_URL'),
            supabaseKey: this.getEnvVar('SUPABASE_KEY'),
            enableCloud: this.getEnvVar('ENABLE_CLOUD') === 'true',
            moreLoginApiUrl: this.getEnvVar('MORELOGIN_API_URL'),
            enableGlobalSMSCleanup: this.getEnvVar('ENABLE_GLOBAL_SMS_CLEANUP') === 'true'
        };
    }
}

/**
 * Helper pour les opérations crypto
 */
class CryptoHelper {
    static generateId(length = 8) {
        return crypto.randomBytes(length).toString('hex');
    }

    static generateTimestampId() {
        const timestamp = Date.now().toString(36);
        const random = crypto.randomBytes(4).toString('hex');
        return `${timestamp}_${random}`;
    }

    static hash(data, algorithm = 'sha256') {
        return crypto.createHash(algorithm).update(data).digest('hex');
    }

    static hashObject(obj, algorithm = 'sha256') {
        const jsonString = JSON.stringify(obj, Object.keys(obj).sort());
        return this.hash(jsonString, algorithm);
    }
}

/**
 * Helper pour les dates
 */
class DateHelper {
    static now() {
        return new Date();
    }

    static timestamp() {
        return Date.now();
    }

    static formatTimestamp(timestamp = null) {
        const date = timestamp ? new Date(timestamp) : new Date();
        return date.toISOString();
    }

    static formatDate(date = null, format = 'YYYY-MM-DD') {
        const d = date || new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        
        switch (format) {
            case 'YYYY-MM-DD':
                return `${year}-${month}-${day}`;
            case 'DD/MM/YYYY':
                return `${day}/${month}/${year}`;
            case 'MM-DD-YYYY':
                return `${month}-${day}-${year}`;
            default:
                return d.toISOString().split('T')[0];
        }
    }

    static formatTime(date = null) {
        const d = date || new Date();
        return d.toTimeString().split(' ')[0];
    }

    static formatDateTime(date = null) {
        const d = date || new Date();
        return `${this.formatDate(d)} ${this.formatTime(d)}`;
    }

    static addMinutes(date, minutes) {
        return new Date(date.getTime() + minutes * 60000);
    }

    static addHours(date, hours) {
        return new Date(date.getTime() + hours * 3600000);
    }

    static addDays(date, days) {
        return new Date(date.getTime() + days * 86400000);
    }

    static diffInSeconds(date1, date2) {
        return Math.abs(date2.getTime() - date1.getTime()) / 1000;
    }

    static diffInMinutes(date1, date2) {
        return this.diffInSeconds(date1, date2) / 60;
    }

    static diffInHours(date1, date2) {
        return this.diffInMinutes(date1, date2) / 60;
    }
}

/**
 * Helper pour la gestion des erreurs
 */
class ErrorHelper {
    static createError(message, code = null, details = null) {
        const error = new Error(message);
        if (code) error.code = code;
        if (details) error.details = details;
        return error;
    }

    static isRetryableError(error) {
        const retryableCodes = [
            'ECONNRESET',
            'ECONNREFUSED', 
            'ETIMEDOUT',
            'ENOTFOUND',
            'EAI_AGAIN'
        ];
        
        const retryableMessages = [
            'timeout',
            'connection',
            'network',
            'temporarily unavailable'
        ];
        
        return retryableCodes.includes(error.code) ||
               retryableMessages.some(msg => error.message.toLowerCase().includes(msg));
    }

    static formatError(error) {
        return {
            message: error.message,
            code: error.code || 'UNKNOWN',
            stack: error.stack,
            details: error.details || null,
            timestamp: DateHelper.formatTimestamp()
        };
    }

    static logError(error, context = null) {
        const formatted = this.formatError(error);
        console.error('❌ Erreur:', {
            ...formatted,
            context
        });
        return formatted;
    }
}

/**
 * Validator simplifié
 */
class Validator {
    static isValidPhoneNumber(phone) {
        if (!phone || typeof phone !== 'string') return false;
        
        // Nettoyer le numéro
        const cleaned = phone.replace(/[^\d+]/g, '');
        
        // Vérifier le format
        const phoneRegex = /^\+\d{10,15}$/;
        return phoneRegex.test(cleaned);
    }

    static isValidSMSCode(code) {
        if (!code || typeof code !== 'string') return false;
        
        // Codes SMS généralement 4-8 chiffres
        const codeRegex = /^\d{4,8}$/;
        return codeRegex.test(code.replace(/\s+/g, ''));
    }

    static isValidCountryCode(country) {
        const validCountries = ['UK', 'FR', 'US', 'DE', 'ES', 'CA', 'IT', 'ID'];
        return validCountries.includes(country?.toUpperCase());
    }

    static isValidDeviceId(deviceId) {
        if (!deviceId || typeof deviceId !== 'string') return false;
        
        // Format IP:PORT ou emulator-XXXX
        const deviceRegex = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d{4,5}|emulator-\d{4})$/;
        return deviceRegex.test(deviceId);
    }

    static isValidApiKey(apiKey) {
        if (!apiKey || typeof apiKey !== 'string') return false;
        
        // Clé API généralement 32+ caractères
        return apiKey.length >= 16;
    }

    static validateConfig(config) {
        const errors = [];
        
        if (!this.isValidApiKey(config.smsApiKey)) {
            errors.push('Invalid SMS API key');
        }
        
        if (config.deviceId && !this.isValidDeviceId(config.deviceId)) {
            errors.push('Invalid device ID format');
        }
        
        if (config.country && !this.isValidCountryCode(config.country)) {
            errors.push('Invalid country code');
        }
        
        if (errors.length > 0) {
            throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
        }
        
        return true;
    }
}

/**
 * Utilitaires généraux
 */
class Utils {
    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    static retry(fn, maxRetries = 3, delay = 1000) {
        return new Promise(async (resolve, reject) => {
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    const result = await fn();
                    resolve(result);
                    return;
                } catch (error) {
                    if (attempt === maxRetries) {
                        reject(error);
                        return;
                    }
                    
                    console.warn(`⚠️ Tentative ${attempt}/${maxRetries} échouée, retry dans ${delay}ms`);
                    await this.sleep(delay);
                    delay *= 1.5; // Backoff exponentiel
                }
            }
        });
    }

    static timeout(promise, ms, message = 'Operation timed out') {
        return Promise.race([
            promise,
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error(message)), ms)
            )
        ]);
    }

    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    static throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    static chunk(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    static deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    static isEmpty(value) {
        if (value == null) return true;
        if (Array.isArray(value) || typeof value === 'string') {
            return value.length === 0;
        }
        if (typeof value === 'object') {
            return Object.keys(value).length === 0;
        }
        return false;
    }
}

/**
 * Factory function pour obtenir la configuration
 */
function getConfig() {
    return ConfigHelper.getConfig();
}

/**
 * Factory function pour obtenir un validator
 */
function getValidator() {
    return new Validator();
}

module.exports = {
    FileHelper,
    ConfigHelper,
    CryptoHelper,
    DateHelper,
    ErrorHelper,
    Validator,
    Utils,
    getConfig,
    getValidator
};
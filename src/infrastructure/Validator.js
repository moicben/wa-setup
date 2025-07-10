/**
 * Validator - Validation simple et efficace
 * Phase 6: Infrastructure Simple
 * 
 * Validator simple avec schémas et sanitization
 */

class Validator {
    constructor() {
        this.schemas = new Map();
        this.rules = {
            required: (value) => value !== undefined && value !== null && value !== '',
            string: (value) => typeof value === 'string',
            number: (value) => typeof value === 'number' && !isNaN(value),
            boolean: (value) => typeof value === 'boolean',
            email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
            phone: (value) => /^\+?[1-9]\d{1,14}$/.test(value),
            url: (value) => {
                try {
                    new URL(value);
                    return true;
                } catch {
                    return false;
                }
            },
            minLength: (value, min) => value && value.length >= min,
            maxLength: (value, max) => value && value.length <= max,
            min: (value, min) => value >= min,
            max: (value, max) => value <= max,
            oneOf: (value, options) => options.includes(value)
        };
    }

    /**
     * Définir un schéma
     * @param {string} name - Nom du schéma
     * @param {Object} schema - Définition du schéma
     */
    defineSchema(name, schema) {
        this.schemas.set(name, schema);
    }

    /**
     * Valider une valeur selon les règles
     * @param {any} value - Valeur à valider
     * @param {Array} rules - Règles de validation
     * @returns {Object} Résultat de la validation
     */
    validateValue(value, rules) {
        const errors = [];
        
        for (const rule of rules) {
            if (typeof rule === 'string') {
                // Règle simple
                if (!this.rules[rule]) {
                    errors.push(`Règle inconnue: ${rule}`);
                    continue;
                }
                
                if (!this.rules[rule](value)) {
                    errors.push(`Validation ${rule} échouée`);
                }
            } else if (typeof rule === 'object') {
                // Règle avec paramètres
                const [ruleName, ...params] = Object.entries(rule)[0];
                
                if (!this.rules[ruleName]) {
                    errors.push(`Règle inconnue: ${ruleName}`);
                    continue;
                }
                
                if (!this.rules[ruleName](value, ...params)) {
                    errors.push(`Validation ${ruleName} échouée`);
                }
            }
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Valider un objet selon un schéma
     * @param {Object} data - Données à valider
     * @param {Object} schema - Schéma de validation
     * @returns {Object} Résultat de la validation
     */
    validate(data, schema) {
        const errors = {};
        let isValid = true;
        
        // Vérifier chaque champ du schéma
        for (const [field, rules] of Object.entries(schema)) {
            const value = data[field];
            const result = this.validateValue(value, rules);
            
            if (!result.valid) {
                errors[field] = result.errors;
                isValid = false;
            }
        }
        
        return {
            valid: isValid,
            errors: isValid ? null : errors
        };
    }

    /**
     * Valider avec un schéma nommé
     * @param {Object} data - Données à valider
     * @param {string} schemaName - Nom du schéma
     * @returns {Object} Résultat de la validation
     */
    validateWithSchema(data, schemaName) {
        const schema = this.schemas.get(schemaName);
        if (!schema) {
            throw new Error(`Schéma non trouvé: ${schemaName}`);
        }
        
        return this.validate(data, schema);
    }

    /**
     * Sanitizer les données
     * @param {any} value - Valeur à sanitizer
     * @param {string} type - Type de sanitization
     * @returns {any} Valeur sanitisée
     */
    sanitize(value, type) {
        if (value === null || value === undefined) {
            return value;
        }
        
        switch (type) {
            case 'string':
                return String(value).trim();
            
            case 'number':
                const num = Number(value);
                return isNaN(num) ? 0 : num;
            
            case 'boolean':
                return Boolean(value);
            
            case 'email':
                return String(value).toLowerCase().trim();
            
            case 'phone':
                return String(value).replace(/\D/g, '');
            
            case 'alphanumeric':
                return String(value).replace(/[^a-zA-Z0-9]/g, '');
            
            case 'noHtml':
                return String(value).replace(/<[^>]*>/g, '');
            
            default:
                return value;
        }
    }

    /**
     * Sanitizer un objet selon un schéma
     * @param {Object} data - Données à sanitizer
     * @param {Object} sanitizeSchema - Schéma de sanitization
     * @returns {Object} Données sanitisées
     */
    sanitizeObject(data, sanitizeSchema) {
        const sanitized = {};
        
        for (const [field, type] of Object.entries(sanitizeSchema)) {
            if (data.hasOwnProperty(field)) {
                sanitized[field] = this.sanitize(data[field], type);
            }
        }
        
        return sanitized;
    }
}

// Instance globale
let globalValidator = null;

/**
 * Obtenir l'instance globale du validator
 */
function getValidator() {
    if (!globalValidator) {
        globalValidator = new Validator();
        
        // Définir les schémas par défaut
        globalValidator.defineSchema('account', {
            phone: ['required', 'string', 'phone'],
            country: ['required', 'string', { oneOf: ['UK', 'FR', 'US'] }],
            status: ['string', { oneOf: ['created', 'sms_sent', 'verified', 'completed', 'failed'] }],
            creation_attempts: ['number', { min: 1 }, { max: 10 }]
        });
        
        globalValidator.defineSchema('smsConfig', {
            apiKey: ['required', 'string', { minLength: 32 }],
            timeout: ['number', { min: 1000 }, { max: 600000 }]
        });
        
        globalValidator.defineSchema('deviceConfig', {
            deviceId: ['required', 'string'],
            timeout: ['number', { min: 1000 }]
        });
    }
    
    return globalValidator;
}

module.exports = { Validator, getValidator };
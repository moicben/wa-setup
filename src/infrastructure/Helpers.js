/**
 * Helpers - Utilitaires simples et efficaces
 * Phase 6: Infrastructure Simple
 * 
 * Collection d'helpers pour files, config, crypto, dates
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * FileHelper - Gestion des fichiers
 */
class FileHelper {
    /**
     * Créer un dossier s'il n'existe pas
     */
    static ensureDir(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }

    /**
     * Nettoyer un dossier
     */
    static cleanDir(dirPath, extensions = []) {
        if (!fs.existsSync(dirPath)) return;
        
        const files = fs.readdirSync(dirPath);
        
        for (const file of files) {
            const filePath = path.join(dirPath, file);
            const ext = path.extname(file);
            
            if (extensions.length === 0 || extensions.includes(ext)) {
                fs.unlinkSync(filePath);
            }
        }
    }

    /**
     * Obtenir la taille d'un fichier
     */
    static getFileSize(filePath) {
        try {
            const stats = fs.statSync(filePath);
            return stats.size;
        } catch {
            return 0;
        }
    }

    /**
     * Copier un fichier
     */
    static copyFile(source, destination) {
        this.ensureDir(path.dirname(destination));
        fs.copyFileSync(source, destination);
    }

    /**
     * Lire un fichier JSON
     */
    static readJSON(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            throw new Error(`Erreur lecture JSON: ${error.message}`);
        }
    }

    /**
     * Écrire un fichier JSON
     */
    static writeJSON(filePath, data) {
        try {
            this.ensureDir(path.dirname(filePath));
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        } catch (error) {
            throw new Error(`Erreur écriture JSON: ${error.message}`);
        }
    }
}

/**
 * ConfigHelper - Gestion de configuration
 */
class ConfigHelper {
    constructor() {
        this.config = {};
        this.loaded = false;
    }

    /**
     * Charger la configuration depuis .env
     */
    loadEnv() {
        require('dotenv').config();
        this.loaded = true;
    }

    /**
     * Obtenir une valeur de configuration
     */
    get(key, defaultValue = null) {
        if (!this.loaded) {
            this.loadEnv();
        }
        
        return process.env[key] || defaultValue;
    }

    /**
     * Définir une valeur de configuration
     */
    set(key, value) {
        this.config[key] = value;
        process.env[key] = value;
    }

    /**
     * Obtenir toute la configuration
     */
    getAll() {
        return {
            ...process.env,
            ...this.config
        };
    }

    /**
     * Valider la configuration requise
     */
    validateRequired(requiredKeys) {
        const missing = [];
        
        for (const key of requiredKeys) {
            if (!this.get(key)) {
                missing.push(key);
            }
        }
        
        if (missing.length > 0) {
            throw new Error(`Configuration manquante: ${missing.join(', ')}`);
        }
    }
}

/**
 * CryptoHelper - Utilitaires crypto
 */
class CryptoHelper {
    /**
     * Générer un ID unique
     */
    static generateId(length = 8) {
        return crypto.randomBytes(length).toString('hex');
    }

    /**
     * Générer un token
     */
    static generateToken(length = 32) {
        return crypto.randomBytes(length).toString('base64url');
    }

    /**
     * Hasher une valeur
     */
    static hash(value, algorithm = 'sha256') {
        return crypto.createHash(algorithm).update(value).digest('hex');
    }

    /**
     * Chiffrer une valeur
     */
    static encrypt(text, key) {
        const cipher = crypto.createCipher('aes-256-cbc', key);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return encrypted;
    }

    /**
     * Déchiffrer une valeur
     */
    static decrypt(encryptedText, key) {
        const decipher = crypto.createDecipher('aes-256-cbc', key);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
}

/**
 * DateHelper - Utilitaires de dates
 */
class DateHelper {
    /**
     * Formater une date
     */
    static format(date, format = 'YYYY-MM-DD HH:mm:ss') {
        const d = new Date(date);
        
        const replacements = {
            'YYYY': d.getFullYear(),
            'MM': String(d.getMonth() + 1).padStart(2, '0'),
            'DD': String(d.getDate()).padStart(2, '0'),
            'HH': String(d.getHours()).padStart(2, '0'),
            'mm': String(d.getMinutes()).padStart(2, '0'),
            'ss': String(d.getSeconds()).padStart(2, '0')
        };
        
        let formatted = format;
        for (const [key, value] of Object.entries(replacements)) {
            formatted = formatted.replace(key, value);
        }
        
        return formatted;
    }

    /**
     * Ajouter du temps à une date
     */
    static addTime(date, amount, unit = 'minutes') {
        const d = new Date(date);
        
        switch (unit) {
            case 'seconds':
                d.setSeconds(d.getSeconds() + amount);
                break;
            case 'minutes':
                d.setMinutes(d.getMinutes() + amount);
                break;
            case 'hours':
                d.setHours(d.getHours() + amount);
                break;
            case 'days':
                d.setDate(d.getDate() + amount);
                break;
        }
        
        return d;
    }

    /**
     * Calculer la différence entre deux dates
     */
    static diff(date1, date2, unit = 'minutes') {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        const diffMs = Math.abs(d2 - d1);
        
        switch (unit) {
            case 'seconds':
                return Math.floor(diffMs / 1000);
            case 'minutes':
                return Math.floor(diffMs / (1000 * 60));
            case 'hours':
                return Math.floor(diffMs / (1000 * 60 * 60));
            case 'days':
                return Math.floor(diffMs / (1000 * 60 * 60 * 24));
            default:
                return diffMs;
        }
    }

    /**
     * Vérifier si une date est aujourd'hui
     */
    static isToday(date) {
        const d = new Date(date);
        const today = new Date();
        
        return d.toDateString() === today.toDateString();
    }
}

/**
 * ErrorHelper - Gestion des erreurs
 */
class ErrorHelper {
    /**
     * Créer une erreur personnalisée
     */
    static createError(message, code = 'GENERIC_ERROR', details = {}) {
        const error = new Error(message);
        error.code = code;
        error.details = details;
        error.timestamp = new Date().toISOString();
        return error;
    }

    /**
     * Vérifier si une erreur est récupérable
     */
    static isRecoverable(error) {
        const recoverableCodes = [
            'NETWORK_ERROR',
            'TIMEOUT_ERROR',
            'TEMPORARY_ERROR',
            'RATE_LIMIT_ERROR'
        ];
        
        return recoverableCodes.includes(error.code);
    }

    /**
     * Formater une erreur pour le logging
     */
    static formatError(error) {
        return {
            message: error.message,
            code: error.code || 'UNKNOWN',
            stack: error.stack,
            timestamp: error.timestamp || new Date().toISOString(),
            details: error.details || {}
        };
    }
}

// Instances globales
const configHelper = new ConfigHelper();

module.exports = {
    FileHelper,
    ConfigHelper,
    CryptoHelper,
    DateHelper,
    ErrorHelper,
    
    // Instance globale pour config
    getConfig: () => configHelper
};
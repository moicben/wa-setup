/**
 * Parser de numéros de téléphone
 * Module extrait de sms.js pour une architecture modulaire
 */

/**
 * Indicatifs téléphoniques internationaux
 */
const PHONE_COUNTRY_CODES = {
    UK: '44',
    US: '1', 
    FR: '33',
    DE: '49',
    ES: '34'
};

/**
 * Utilitaire pour parser les numéros de téléphone
 */
class PhoneNumberParser {
    /**
     * Parser un numéro de téléphone complet
     */
    static parseNumber(fullNumber, expectedCountry = null) {
        // Nettoyer le numéro (supprimer +, espaces, etc.)
        const cleanNumber = fullNumber.replace(/[^\d]/g, '');
        
        // Si on connaît le pays attendu, utiliser son indicatif
        if (expectedCountry && PHONE_COUNTRY_CODES[expectedCountry]) {
            const countryCode = PHONE_COUNTRY_CODES[expectedCountry];
            
            // Vérifier si le numéro commence par cet indicatif
            if (cleanNumber.startsWith(countryCode)) {
                return {
                    success: true,
                    countryCode,
                    localNumber: cleanNumber.substring(countryCode.length),
                    fullNumber: `+${cleanNumber}`,
                    country: expectedCountry
                };
            }
        }
        
        // Sinon, essayer de détecter automatiquement
        for (const [country, code] of Object.entries(PHONE_COUNTRY_CODES)) {
            if (cleanNumber.startsWith(code)) {
                return {
                    success: true,
                    countryCode: code,
                    localNumber: cleanNumber.substring(code.length),
                    fullNumber: `+${cleanNumber}`,
                    country
                };
            }
        }
        
        // Si aucun indicatif reconnu, retourner une erreur
        return {
            success: false,
            error: `Impossible de parser le numéro: ${fullNumber}`,
            fullNumber: `+${cleanNumber}`
        };
    }

    /**
     * Formater un numéro pour l'affichage
     */
    static formatNumber(countryCode, localNumber) {
        return `+${countryCode}${localNumber}`;
    }

    /**
     * Obtenir les codes pays supportés
     */
    static getSupportedCountries() {
        return { ...PHONE_COUNTRY_CODES };
    }

    /**
     * Valider un indicatif pays
     */
    static isValidCountryCode(countryCode) {
        return Object.values(PHONE_COUNTRY_CODES).includes(countryCode);
    }
}

module.exports = {
    PhoneNumberParser,
    PHONE_COUNTRY_CODES
}; 
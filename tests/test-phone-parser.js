/**
 * Tests unitaires pour PhoneNumberParser
 */

const { PhoneNumberParser, PHONE_COUNTRY_CODES } = require('../src/core/sms/parsers/PhoneNumberParser');

function testPhoneNumberParser() {
    console.log('🧪 Tests PhoneNumberParser');
    console.log('=' .repeat(40));
    
    let passed = 0;
    let failed = 0;
    
    function assert(condition, message) {
        if (condition) {
            console.log(`✅ ${message}`);
            passed++;
        } else {
            console.error(`❌ ${message}`);
            failed++;
        }
    }
    
    // Test 1: Parsing numéro UK avec pays attendu
    const ukResult = PhoneNumberParser.parseNumber('441234567890', 'UK');
    assert(ukResult.success === true, 'UK parsing success');
    assert(ukResult.countryCode === '44', 'UK country code');
    assert(ukResult.localNumber === '1234567890', 'UK local number');
    assert(ukResult.country === 'UK', 'UK country');
    assert(ukResult.fullNumber === '+441234567890', 'UK full number');
    
    // Test 2: Parsing numéro US avec auto-detection
    const usResult = PhoneNumberParser.parseNumber('+15551234567');
    assert(usResult.success === true, 'US parsing success');
    assert(usResult.countryCode === '1', 'US country code');
    assert(usResult.localNumber === '5551234567', 'US local number');
    assert(usResult.country === 'US', 'US country');
    
    // Test 3: Parsing numéro FR avec espaces
    const frResult = PhoneNumberParser.parseNumber('+33 1 23 45 67 89', 'FR');
    assert(frResult.success === true, 'FR parsing success');
    assert(frResult.countryCode === '33', 'FR country code');
    assert(frResult.localNumber === '123456789', 'FR local number');
    
    // Test 4: Parsing numéro invalide
    const invalidResult = PhoneNumberParser.parseNumber('999999999999');
    assert(invalidResult.success === false, 'Invalid number rejection');
    assert(invalidResult.error.includes('Impossible de parser'), 'Invalid number error message');
    
    // Test 5: Formatage
    const formatted = PhoneNumberParser.formatNumber('44', '1234567890');
    assert(formatted === '+441234567890', 'Number formatting');
    
    // Test 6: Pays supportés
    const supportedCountries = PhoneNumberParser.getSupportedCountries();
    assert(Object.keys(supportedCountries).includes('UK'), 'UK supported');
    assert(Object.keys(supportedCountries).includes('US'), 'US supported');
    assert(Object.keys(supportedCountries).includes('FR'), 'FR supported');
    
    // Test 7: Validation code pays
    assert(PhoneNumberParser.isValidCountryCode('44') === true, 'Valid country code UK');
    assert(PhoneNumberParser.isValidCountryCode('999') === false, 'Invalid country code');
    
    console.log('\n📊 Résultats:');
    console.log(`✅ Tests réussis: ${passed}`);
    console.log(`❌ Tests échoués: ${failed}`);
    console.log(`🎯 Taux de réussite: ${Math.round((passed / (passed + failed)) * 100)}%`);
    
    return failed === 0;
}

// Exécuter les tests si le script est lancé directement
if (require.main === module) {
    const success = testPhoneNumberParser();
    process.exit(success ? 0 : 1);
}

module.exports = { testPhoneNumberParser }; 
/**
 * Export point pour les modules device
 */

const { ADBConnection } = require('./adb/ADBConnection');
const { InputSimulator } = require('./InputSimulator');

module.exports = {
    ADBConnection,
    InputSimulator
}; 
/**
 * Simulateur d'entrées pour périphériques Android
 * Module extrait de bluestack.js pour une architecture modulaire
 */

class InputSimulator {
    constructor(adbConnection, delayManager = null) {
        this.adb = adbConnection;
        this.delayManager = delayManager;
    }

    /**
     * Cliquer sur l'écran à des coordonnées spécifiques
     */
    async click(x, y) {
        try {
            await this.adb.executeCommand(`shell input tap ${x} ${y}`);
            if (this.delayManager) {
                await this.delayManager.wait('short');
            }
            return true;
        } catch (error) {
            console.error(`❌ Erreur clic à (${x}, ${y}): ${error.message}`);
            return false;
        }
    }

    /**
     * Saisir du texte
     */
    async inputText(text) {
        try {
            // Échapper les caractères spéciaux pour le shell Android
            const escapedText = text
                .replace(/\s/g, '%s')       // Espaces
                .replace(/['"]/g, '')       // Quotes
                .replace(/[&()]/g, '');     // Caractères shell
            
            await this.adb.executeCommand(`shell input text "${escapedText}"`);
            
            if (this.delayManager) {
                await this.delayManager.wait('short');
            }
            return true;
        } catch (error) {
            console.error(`❌ Erreur saisie texte "${text}": ${error.message}`);
            return false;
        }
    }

    /**
     * Appuyer sur une touche par son code
     */
    async pressKey(keyCode) {
        try {
            await this.adb.executeCommand(`shell input keyevent ${keyCode}`);
            if (this.delayManager) {
                await this.delayManager.wait('short');
            }
            return true;
        } catch (error) {
            console.error(`❌ Erreur pression touche ${keyCode}: ${error.message}`);
            return false;
        }
    }

    /**
     * Appuyer sur des touches nommées
     */
    async pressNamedKey(keyName) {
        const keyMappings = {
            'BACK': 4,
            'HOME': 3,
            'MENU': 82,
            'ENTER': 66,
            'TAB': 61,
            'SPACE': 62,
            'DELETE': 67,
            'VOLUME_UP': 24,
            'VOLUME_DOWN': 25,
            'POWER': 26
        };

        const keyCode = keyMappings[keyName.toUpperCase()];
        if (keyCode === undefined) {
            throw new Error(`Touche non supportée: ${keyName}`);
        }

        return await this.pressKey(keyCode);
    }

    /**
     * Effectuer un swipe/glissement
     */
    async swipe(startX, startY, endX, endY, duration = 300) {
        try {
            await this.adb.executeCommand(
                `shell input swipe ${startX} ${startY} ${endX} ${endY} ${duration}`
            );
            if (this.delayManager) {
                await this.delayManager.wait('medium');
            }
            return true;
        } catch (error) {
            console.error(`❌ Erreur swipe de (${startX},${startY}) à (${endX},${endY}): ${error.message}`);
            return false;
        }
    }

    /**
     * Appui long sur l'écran
     */
    async longPress(x, y, duration = 1000) {
        try {
            // Simuler un appui long avec un swipe de 0 pixel
            await this.adb.executeCommand(
                `shell input swipe ${x} ${y} ${x} ${y} ${duration}`
            );
            if (this.delayManager) {
                await this.delayManager.wait('medium');
            }
            return true;
        } catch (error) {
            console.error(`❌ Erreur appui long à (${x}, ${y}): ${error.message}`);
            return false;
        }
    }

    /**
     * Effacer un champ texte (méthode simple)
     */
    async clearField(x, y, method = 'select_all') {
        try {
            // Clic pour donner le focus
            await this.click(x, y);
            
            if (method === 'select_all') {
                // Sélectionner tout puis supprimer
                await this.pressKey(1);  // KEYCODE_SOFT_LEFT (pour sélection)
                if (this.delayManager) {
                    await this.delayManager.wait('short');
                }
                await this.pressKey(67); // KEYCODE_DEL
            } else if (method === 'ctrl_a') {
                // Ctrl+A puis Delete (pour certains champs)
                await this.pressKey(29); // CTRL gauche
                await this.pressKey(29); // A
                await this.pressKey(67); // DELETE
            } else if (method === 'backspace_all') {
                // Appuyer sur backspace plusieurs fois
                for (let i = 0; i < 50; i++) {
                    await this.pressKey(67); // BACKSPACE
                }
            }
            
            if (this.delayManager) {
                await this.delayManager.wait('short');
            }
            return true;
        } catch (error) {
            console.error(`❌ Erreur effacement champ à (${x}, ${y}): ${error.message}`);
            return false;
        }
    }

    /**
     * Double-clic
     */
    async doubleClick(x, y, interval = 100) {
        try {
            await this.click(x, y);
            await new Promise(resolve => setTimeout(resolve, interval));
            await this.click(x, y);
            return true;
        } catch (error) {
            console.error(`❌ Erreur double-clic à (${x}, ${y}): ${error.message}`);
            return false;
        }
    }

    /**
     * Scroll vertical
     */
    async scrollVertical(startX, startY, distance, direction = 'down') {
        const endY = direction === 'down' ? startY + distance : startY - distance;
        return await this.swipe(startX, startY, startX, endY);
    }

    /**
     * Scroll horizontal
     */
    async scrollHorizontal(startX, startY, distance, direction = 'right') {
        const endX = direction === 'right' ? startX + distance : startX - distance;
        return await this.swipe(startX, startY, endX, startY);
    }
}

module.exports = { InputSimulator }; 
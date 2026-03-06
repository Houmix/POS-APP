// config.js
// URL du serveur chargée dynamiquement depuis AsyncStorage.
// Utiliser getPosUrl() dans vos composants/hooks.
import { getPosUrl } from './utils/serverConfig';

export const idRestaurant = 1;

// Pour compatibilité : utilise getPosUrl() partout à la place
export { getPosUrl as getPosUrl };

// DEPRECATED - ne plus utiliser POS_URL directement
// L'URL est maintenant dynamique, utilisez getPosUrl()
export const POS_URL = 'http://127.0.0.1:8000';

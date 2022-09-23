/**
 * User model for authentication
 */
const logger = require('../utils/logger');
const authService = require('../service/authService');

const logMeta = {
    file: 'model/User'
};

class User {
    _name = '';
    _psw = '';
    _token = null;
    _isAuthenticated = false;
    _apiServer = '';

    constructor(props) {
        this._name = props.username;
        this._psw = props.userpsw;
        this._token = props.token;
        logger.info('[model/User] Initiating user...', logMeta);
        this._apiServer = props.authServerUrl;
    }

    /**
     * Log in user
     * @return {Promise<boolean>}
     */
    async login() {
        if (this._token) {
            return await this.isAuthenticated();
        }

        logger.info(`[model/User] Logging user [${this._name}]...`, logMeta);
        let result;
        try {
            result = await authService.login(this._apiServer, this._name, this._psw);
            if (result.data) {
                this._token = result.data.accessToken;
                logger.info(`[model/User] Login success and jwt saved`, logMeta);
                logger.info(`[model/User] JWT: ${this._token}`, logMeta, global.debugMode);
                return true;
            } else {
                logger.error('[model/User] No login data retrieved', logMeta);
                return false;
            }
        } catch (e) {
            logger.error(`[model/User] Login error: ${JSON.stringify(e)}`, logMeta);
            return false;
        }
    }

    /**
     * Get token
     * @return {Promise<null>}
     */
    async getToken() {
        const validated = await this.isAuthenticated();
        if (validated) {
            return this._token;
        }
        logger.error('[model/User] Authentication failure', logMeta);
        return null;
    }

    /**
     * getter for jsw token
     * @return {string|null}
     */
    get token() {
        return this._token;
    }

    /**
     * validate jwt
     * @returns {Promise<boolean>}
     */
    async isAuthenticated() {
        if (!this._token) return false;
        const result = await authService.verifyJWT(this._apiServer, this._token);
        logger.debug(`[model/User] verify JWT finished, callback from server is: ${JSON.stringify(result)}`, logMeta);
        if (result.tokenStatus && result.tokenStatus === 'VALID_TOKEN') {
            this._isAuthenticated = true;
            return true;
        }
        return false;
    }

}

module.exports = User;
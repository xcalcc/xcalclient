const logger = require('../utils/logger');
const axios = require('axios');
const logMeta = {
    file: 'service/authService',
};

module.exports = {
    /**
     * Verify jwt token
     * @param serverUrl
     * @param jwt
     * @param correlationId
     * @return {Promise<{code: string, error: (any|T), status: number}|any>}
     */
    async verifyJWT(serverUrl, jwt, correlationId='') {
        logger.debug(`[Auth service] Verifying JWT: ${jwt}`, logMeta);
        if (!serverUrl) {
            throw new Error('Server URL not defined, exits');
        }
        const validateJWTAPIPath = '/api/auth_service/v2/token_status';
        const serverPath = `${serverUrl}${validateJWTAPIPath}`;
        try {
            const callback = await axios.get(serverPath, {
                headers: {
                    'X-B3-TraceId': correlationId,
                    'X-B3-SpanId': correlationId,
                    Authorization: `Bearer ${jwt}`, //pass directly from web UI, format as "Bearer ${jwt}"
                }
            });
            return callback.data;
        } catch (e) {
            const errorMsg = e.response && e.response.data || e.stack;
            logger.error(`[AuthService/verifyJWT], ${JSON.stringify(errorMsg)}`, {
                ...logMeta,
                correlationId,
                method: 'verifyJWT()'
            });
            return {
                error: errorMsg,
                code: 'E_WEB_API_AUTH_FAILED',
                status: 1
            };
        }
    },

    /**
     * Login to server with username and password
     * @param serverUrl
     * @param username
     * @param psw
     * @param correlationId
     * @return {Promise<AxiosResponse<any>>}
     */
    async login(serverUrl, username, psw, correlationId = '') {
        logger.debug(`[Auth service] Logging in user ${username} to ${serverUrl}`, {
            ...logMeta,
            method: 'login()'
        });
        if (!serverUrl) {
            throw new Error('Server URL not defined, exits');
        }
        const loginPath = '/api/auth_service/v2/login';

        const serverPath = `${serverUrl}${loginPath}`;
        logger.debug(`[Auth service/login]Calling login API: ${serverPath}`, {
            ...logMeta,
            method: 'login'
        });
        try {
            return await axios.post(serverPath, {
                "password": psw,
                "username": username
            }, {
                headers: {
                    'X-B3-TraceId': correlationId,
                    'X-B3-SpanId': correlationId,
                }
            });
        } catch (e) {
            const errorMsg = e.response && e.response.data || e.stack;
            logger.error('[Auth service]Login failed', {
                correlationId,
                method: 'login()'
            });
            throw {
                error: errorMsg,
                code: 'E_WEB_API_AUTH_FAILED'
            };
        }

    }
};

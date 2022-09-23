const axios = require('axios');
const logger = require('../utils/logger');

const logMeta = {
    file: 'service/scanService',
};

module.exports = {
    /**
     * Create new project
     * @param apiServer
     * @param projectName
     * @param projectId
     * @param configName
     * @param projectConfig
     * @param scanConfig
     * @param attributes
     * @param jwt
     * @param correlationId
     * @return {Promise<{error: (any|T)}|*>}
     */
    async createProject(apiServer, {
        projectName,
        projectId,
        configName,
        projectConfig = {},
        scanConfig = {},
        attributes = {}
    }, jwt, correlationId = '') {
        const resourcePath = `/api/project_service/v2/project`;
        const serverUrl = `${apiServer}${resourcePath}`;
        const payload = {
            projectName,
            projectId,
            configName,
            projectConfig,
            scanConfig,
            attributes
        };
        let callback = {};
        logger.debug(`[Project service] Start creating online project`, {
            ...logMeta,
            method: 'createProject()'
        });
        logger.debug(`[Project service][POST] ${serverUrl} payload: ${JSON.stringify(payload)}`, {
            ...logMeta,
            method: 'createProject()'
        });
        try {
            callback = await axios.post(serverUrl, payload, {
                    headers: {
                        'X-B3-TraceId': correlationId,
                        'X-B3-SpanId': correlationId,
                        Authorization: `Bearer ${jwt}`
                    }
                }
            );
            return callback.data;
        } catch (e) {
            const errorMsg = e.response && e.response.data || e.stack;
            logger.debug(`ERROR [Project service] Create project failed, error ${JSON.stringify(e)}`, {
                ...logMeta,
                method: 'createProject()'
            });
            return {
                error: errorMsg,
                httpCode: e.response.status
            };
        }
    },

    /**
     * Fetch project entity from Db
     * @param apiServer
     * @param jwt
     * @param projectId
     * @param correlationId
     * @return {Promise<{error: (any|T|Set<string>|Object|string|T[])}|*>}
     */
    async fetchProjectByProjectId(apiServer, jwt, projectId, correlationId = '') {
        const resourcePath = `/api/project_service/v2/projectId/${projectId}`;
        const serverUrl = `${apiServer}${resourcePath}`;

        let callback = {};
        logger.info(`[Project service] Fetching project instance by projectId, [POST] ${serverUrl}`, {
            ...logMeta,
            method: 'fetchProjectByProjectId()'
        });
        try {
            callback = await axios.get(serverUrl, {
                    headers: {
                        'X-B3-TraceId': correlationId,
                        'X-B3-SpanId': correlationId,
                        Authorization: `Bearer ${jwt}`
                    }
                }
            );
            return callback.data;
        } catch (e) {
            const errorMsg = e.response && e.response.data || e.stack;
            logger.debug(`ERROR [Project service] Fetch project failed, error ${JSON.stringify(e)}`, {
                ...logMeta,
                method: 'fetchProjectByProjectId()'
            });
            return {
                error: errorMsg
            };
        }


    },

    /**
     * Fetch project config by project uuid
     * @param apiServer
     * @param jwt
     * @param projectUUID
     * @param correlationId
     * @return {Promise<{error: (any|T)}|*>}
     */
    async fetchProjectConfByProjectUuid(apiServer, jwt, projectUUID, correlationId = '') {
        const resourcePath = `/api/project_service/v2/project/${projectUUID}`;
        const serverUrl = `${apiServer}${resourcePath}`;

        let callback = {};
        logger.debug(`[Project service] Fetching project config by project UUID, [GET] ${serverUrl}`, {
            ...logMeta,
            method: 'fetchProjectConfByProjectUuid()'
        });
        try {
            callback = await axios.get(serverUrl, {
                    headers: {
                        'X-B3-TraceId': correlationId,
                        'X-B3-SpanId': correlationId,
                        Authorization: `Bearer ${jwt}`
                    }
                }
            );
        } catch (e) {
            logger.debug(`ERROR [Project service]Fetch project config by project UUID failed, error ${JSON.stringify(e)}`, {
                ...logMeta,
                method: 'fetchProjectConfByProjectUuid()'
            });
            const errorMsg = e.response && e.response.data || e.stack;
            return {
                error: errorMsg
            };
        }
        return callback.data;
    },

    /**
     * Fetch project config by project ID
     * @param apiServer
     * @param jwt
     * @param projectId
     * @param correlationId
     * @return {Promise<{error: (any|T)}|*>}
     */
    async fetchProjectConfByProjectId(apiServer, jwt, payload, correlationId = '') {
        const {projectId, configId, repoAction} = payload;
        const resourcePath = `/api/project_service/v2/project/project_id/${projectId}/config`;
        const serverUrl = `${apiServer}${resourcePath}`;

        const params = {
            configId,
            repoAction,
        };
        let callback = {};
        logger.debug(`[Project service] Fetching project config by project id, [GET] ${serverUrl}, params: ${JSON.stringify(params)}`, {
            ...logMeta,
            method: 'fetchProjectConfByProjectId()'
        });

        try {
            callback = await axios.get(serverUrl, {
                    params,
                    headers: {
                        'X-B3-TraceId': correlationId,
                        'X-B3-SpanId': correlationId,
                        Authorization: `Bearer ${jwt}`
                    },
                }
            );
            const responseCode = callback.response && callback.response.status;
            if (responseCode === 204) {
                throw Error("Cannot find config");
            }
        } catch (e) {
            logger.debug(`ERROR [Project service]Fetch project config by projectId failed, error ${JSON.stringify(e)}`, {
                ...logMeta,
                method: 'fetchProjectConfByProjectId()'
            });
            const errorMsg = e.response && e.response.data || e.stack;
            const responseCode = e.response && e.response.status;
            if (responseCode === 404) {
                return {
                    warn: 'Online project config not found'
                };
            }
            return {
                error: errorMsg
            };
        }
        return callback.data;
    },

    /**
     * Update project
     * @param apiServer
     * @param payload
     * @param jwt
     * @param correlationId
     * @return {Promise<{error: (any|T)}|*>}
     */
    async updateProjectConf(apiServer, payload, jwt, correlationId = '') {
        const resourcePath = `/api/project_service/v2/project`;
        const serverUrl = `${apiServer}${resourcePath}`;

        let callback = {};
        logger.info(`[PUT] ${serverUrl} payload: ${JSON.stringify(payload)}`, logMeta, false)
        try {
            callback = await axios.put(serverUrl, payload, {
                    headers: {
                        'X-B3-TraceId': correlationId,
                        'X-B3-SpanId': correlationId,
                        Authorization: `Bearer ${jwt}`
                    }
                }
            );
        } catch (e) {
            const errorMsg = e.response && e.response.data || e.stack;
            return {
                error: errorMsg,
                httpCode: e.response.status
            };
        }
        return callback.data;
    },

    async checkIfFirstScan(apiServer, jwt, projectUuid = null, correlationId = '') {
        const resourcePath = `/api/project_service/v3/is_first_scan`;
        const serverUrl = `${apiServer}${resourcePath}`;

        let callback = {};
        logger.debug(`[GET] ${serverUrl}?projectUuid=${projectUuid}`, logMeta);
        try {
            callback = await axios.get(serverUrl, {
                    params: {
                        projectUuid,
                    },
                    headers: {
                        'X-B3-TraceId': correlationId,
                        'X-B3-SpanId': correlationId,
                        Authorization: `Bearer ${jwt}`
                    }
                }
            );

            if (callback.data) {
                logger.debug(`[service/projectService] checkIfFirstScan result: ${JSON.stringify(callback.data)}`, logMeta);
                logger.debug(`[service/projectService] checkIfFirstScan isFirstTime: ${callback.data.isFirstTime}`, logMeta);
                return !!callback.data.isFirstTime;
            }
        } catch (e) {
            logger.warn(`Check if first scan failed: ${e}`, logMeta);
        }
        //when error we always consider it is first scan
        return true;
    },
};

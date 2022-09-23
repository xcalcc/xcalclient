const position = 'service/scanService';
const logger = require('../utils/logger');
const path = require('path');
const envFile = path.resolve(__dirname, '../.env');
require('dotenv').config({path: envFile});
const axios = require('axios');

const logMeta = {
    file: 'service/scanService',
}
module.exports = {
    /**
     * Create scan task in old way
     * @param apiServer
     * @param jwt
     * @param projectUUID
     * @param lang
     * @param correlationId
     * @return {Promise<{error: (any|T)}|*>}
     */
    async createScanTask(apiServer, jwt, projectUUID, lang = 'en', correlationId = '') {
        const meta = {
            correlationId,
            ...logMeta,
            method: 'createScanTask()'
        };

        const createScanTaskPath = `/api/scan_service/v2/project/${projectUUID}/scan_task/PENDING?locale=${lang}`;
        const serverPath = `${apiServer}${createScanTaskPath}`;
        let scanTask = {};
        logger.info(`Posting projectUUID [${projectUUID}] to ${serverPath}`, meta);
        try {
            scanTask = await axios.post(serverPath, {}, {
                headers: {
                    'X-B3-TraceId': correlationId,
                    'X-B3-SpanId': correlationId,
                    Authorization: `Bearer ${jwt}`, //pass directly from web UI, format as "Bearer ${jwt}"
                }
            });
            return scanTask.data;
        } catch (e) {
            const errorMsg = e.response && e.response.data || e.stack;
            logger.error(`Create scan task failed, ${JSON.stringify(errorMsg)}`, meta);
            return {
                error: errorMsg,
            };
        }
    },
    /**
     *
     * @param apiServer
     * @param jwt
     * @param args
     * @param lang
     * @param correlationId
     * @return {Promise<{error: (any|T|Set<string>|Object|string|T[])}|*>}
     */
    async createScanTaskWithCommitInfo(apiServer, jwt, args, lang = 'en', correlationId = '') {
        const meta = {
            ...logMeta,
            method: 'createScanTaskWithCommitInfo()'
        };

        const createScanTaskPath = `/api/scan_service/v2/scan_task?locale=${lang}`;
        const serverPath = `${apiServer}${createScanTaskPath}`;
        let scanTask = {};
        const payload = {
            "projectId": args.projectUUID["value"],
            "startNow": 0, //?@raymond, hardcoded 0/1
            "attributes": []
        };

        Object.keys(args).forEach(key => {
            if (args[key]) {
                payload.attributes.push({
                    "type": args[key]["type"] || "SCAN",
                    "name": key,
                    "value": args[key]["value"],
                });
            }
        });

        logger.info(`Creating scan task for project [${args.projectUUID.value}] with baselineCommitId [${args.baselineCommitId.value}], commitId [${args.commitId.value}] from repoAction [${args.repoAction.value}]`, meta);
        logger.info(`[POST] ${serverPath} ,Payload: ${JSON.stringify(payload)}`, meta, global.debugMode);
        try {
            scanTask = await axios.post(serverPath, payload, {
                headers: {
                    'X-B3-TraceId': correlationId,
                    'X-B3-SpanId': correlationId,
                    Authorization: `Bearer ${jwt}`, //pass directly from web UI, format as "Bearer ${jwt}"
                }
            });
            return scanTask.data;
        } catch (e) {
            const errorMsg = e.response && e.response.data || e.stack;
            logger.error(`Create scan task failed, ${JSON.stringify(errorMsg)}`, {
                correlationId,
                file: position,
                method: 'createScanTask()'
            }, meta);
            return {
                error: errorMsg,
            };
        }
    },
    async updateScanTaskStatus(apiServer, jwt, {scanTaskId, stage, status}, correlationId = '') {
        try {
            logger.info(`Updating scan task status:`, {
                correlationId,
                file: position,
                method: 'updateScanTaskStatus()'
            });
            const createScanTaskPath = `/api/scan_service/v2/scan_task/${scanTaskId}`;
            const serverPath = `${apiServer}${createScanTaskPath}`;
            const payload = {
                id: scanTaskId,
                stage: Policy.enums.STATE.CLIENT_FINI, //'AGENT_END',
                status: status, //'PROCESSING',
                unifyErrorCode: ''
            };

            logger.info(`[PUT] ${serverPath}, payload ${JSON.stringify(payload)}`, logMeta, false);

            const callback = await axios.put(serverPath, payload,
                {
                    headers: {
                        'X-B3-TraceId': correlationId,
                        'X-B3-SpanId': correlationId,
                        Authorization: `Bearer ${jwt}`,
                    }
                });

            if (callback.status !== 200) {
                logger.error(`UpdateScanTaskStatus, error: ${callback.data}`, logMeta);
                return false;
            }
            return true;
        } catch (e) {
            const errorMsg = e.response && e.response.data || e.stack;
            logger.error(`updateScanTaskStatus failed, ${JSON.stringify(errorMsg)}`, {
                correlationId,
                file: position,
                method: 'updateScanTaskStatus()'
            });
            return false;
        }
    },
    async submitScanTask(apiServer, jwt, payload, correlationId = '') {
        try {
            logger.info(`Sending scan request to ScanService`, {
                correlationId,
                file: position,
                method: 'submitScanTask()'
            });
            const statusPath = `/api/scan_task_service/v3`;
            const serverPath = `${apiServer}${statusPath}`;
            logger.info(`[POST] ${serverPath}, payload ${JSON.stringify(payload)}`, logMeta, false);
            const callback = await axios.post(serverPath, payload, {
                headers: {
                    'X-B3-TraceId': correlationId,
                    'X-B3-SpanId': correlationId,
                    Authorization: `Bearer ${jwt}`,
                }
            });
            if (callback.status !== 200) {
                logger.error(`Submit scan task failed, error: ${callback.data}`, logMeta);
                return {
                    error: callback
                };
            }

            return callback.data;
        } catch (e) {
            const errorMsg = e.response && e.response.data || e.stack;
            logger.error(`Start scan task pipeline failed, ${JSON.stringify(errorMsg)}`, {
                correlationId,
                file: position,
                method: 'submitScanTask()'
            });
            return {
                error: errorMsg
            };
        }
    },
    async cancelScan(apiServer, jwt, scanTaskId = null, correlationId = '') {
        const meta = {
            correlationId,
            file: position,
            method: 'cancelScan()'
        };
        const resourcePath = '/api/scan_task_service/v3/cancel_scan_task';
        const url = `${apiServer}${resourcePath}`;
        if (!scanTaskId) {
            logger.error(`Cannot cancel scan without scan task ID`, meta);
            return false;
        }
        const payload = {
            scanTaskId,
            token: `Bearer ${jwt}`,
        };

        try {
            logger.info(`Cancelling [${scanTaskId}]`, meta);
            logger.info(`[POST] ${url} payload: ${JSON.stringify(payload)}`, meta, false);
            const result = await axios.post(url, payload);

            logger.info(`Response: ${JSON.stringify(result.data)}`, meta);

            return result;
        } catch (e) {
            const errorMsg = e.response && e.response.data || e.stack;
            logger.error(`Cancelling [${scanTaskId}] failed, ${JSON.stringify(errorMsg)}`, {
                correlationId,
                file: position,
                method: 'submitScanTask()'
            });
            return {
                error: errorMsg
            };
        }
    }
};

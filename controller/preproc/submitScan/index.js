/**
 * Create scan task on main service
 * Submit scan task
 */

const scanService = require('../../../service/scanService');
const logger = require('../../../utils/logger');
const system = require('../../../utils/system');
const SubPhase = require('../../../model/SubPhase');

const logMeta = {
    file: 'controller/preproc/submitScan'
};

const submitScan = (policy, context) => {
    const client = context.projectInstance.client;

    return new SubPhase({
        name: 'SUBMIT_SCAN_TASK',
        type: Policy.enums.SUB_PHASE_TYPES.HTTP,
        policy,
        run: async function() {
            const jwt = await client.user.getToken();
            if (!jwt) {
                system.exit(Policy.enums.EXIT_CODES.GENERAL_ERROR, ErrorCodes.lookup('E_AUTH_FAILED'));
            }
            const scanTaskId = context.scanInstance.onlineScanId;
            logger.debug(`[${this.name}] context.projectInstance.config: ${JSON.stringify(context.projectInstance.config)}`, logMeta);
            try {
                const payload = {
                    "agentType": "offline_agent",
                    "sourceStorageName": "agent",
                    "sourceStorageType": "agent",
                    "scanFilePath": context.projectInstance.sourceCodePath,
                    "sourceCodePath": context.projectInstance.sourceCodePath,
                    "preprocessPath": context.projectInstance.sourceCodePath,
                    "projectId": context.projectInstance.id,
                    "projectUUID": context.projectInstance.uuid,
                    "scanTaskId": scanTaskId,
                    "uploadSource": !!context.projectInstance.config.uploadSource,
                    "build": context.projectInstance.config.scanConfig.build || 'make',
                    "clientType": "DEBUG",
                    "scanMode": context.projectInstance.config.scanConfig.scanMode,
                    "lang": context.projectInstance.config.scanConfig.lang,
                    "token": jwt,
                    "doAll": true,
                    "buildPreprocess": false,
                    "buildFileInfo": false,
                    "buildSourceCode": false,
                    "commitId": context.scanInstance.commitInfo.commitId || "",
                    "baselineCommitId": context.scanInstance.commitInfo.baselineCommitId || "",
                    "gitRepoPath": context.projectInstance.sourceCodePath,
                    "projectName": context.projectInstance.name,
                    "scanAll": !context.scanInstance.partialScan,
                    "fileBlacklist": context.scanInstance.config[Policy.enums.CONFIGURATION.SCAN.FILE_BLACKLIST] || "",
                    "ruleWhitelist": context.scanInstance.config[Policy.enums.CONFIGURATION.SCAN.RULE_WHITELIST] || "",
                    "repoAction": context.projectInstance.config.repoAction,
                };

                if (context.projectInstance.config.scanConfig.hasOwnProperty(Policy.enums.CONFIGURATION.SCAN.PARALLEL_JOBS)) {
                    payload[Policy.enums.CONFIGURATION.SCAN.PARALLEL_JOBS] = context.projectInstance.config.scanConfig[Policy.enums.CONFIGURATION.SCAN.PARALLEL_JOBS];
                }

                //workaround - below are whitelist for extra commands
                const extraScanConfOptions = [
                    'xvsaOptions',
                    'profile',
                ];
                extraScanConfOptions.forEach(option => {
                    if(context.projectInstance.config.scanConfig.hasOwnProperty(option)) {
                        payload[option] = context.projectInstance.config.scanConfig[option];
                    }
                });
                logger.debug(`[${this.name}]sending payload to scan service, payload: ${JSON.stringify(payload)}`, logMeta);

                const result = await scanService.submitScanTask(client.config.apiServerUrl, jwt, payload);

                if (result.error) {
                    return Promise.reject({
                        status: 1,
                        logs: {
                            error: JSON.stringify(result.error)
                        }
                    });
                }
                return Promise.resolve({
                    status: 0,
                });
            } catch (e) {
                return Promise.reject({
                    status: 1,
                    logs: {
                        error: `Submit scan task failed, ${JSON.stringify(e)}`
                    }
                });
            }

        },
        context
    });
};

module.exports = submitScan;

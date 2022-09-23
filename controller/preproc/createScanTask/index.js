/**
 * Subphase to prepare data for scanning after build task
 */

const scanService = require('../../../service/scanService');
const SubPhase = require('../../../model/SubPhase');
const logger = require("../../../utils/logger");
const system = require("../../../utils/system");

const logMeta = {
    file: 'controller/preproc/createScanTask'
}

const createScanTask = (policy, context) => {
    const client = context.projectInstance.client;

    const jwt = client.user.token;

    if (!jwt) {
        system.exit(Policy.enums.EXIT_CODES.GENERAL_ERROR, ErrorCodes.lookup('E_AUTH_FAILED_USERNAME_PSW'));
    }

    return new SubPhase({
        name: 'CREATE_SCAN_TASK',
        type: Policy.enums.SUB_PHASE_TYPES.HTTP,
        policy,
        run: async () => {
            try {
                // logger.info(`Creating scan task for project [${context.projectInstance.uuid}]`, logMeta);
                let result = {};

                if (Policy.configs.CLIENT.ENABLE_CICD_CONTROL) {
                    let payload = {
                        projectUUID: {
                            value: context.projectInstance.uuid,
                        },
                        commitId: {
                            value: context.projectInstance.cicd.commitId,
                        },
                        baselineCommitId: {
                            value: context.projectInstance.cicd.baselineCommitId,
                        },
                        repoAction: {
                            value: context.projectInstance.config.repoAction,
                        },
                        configId: {
                            value: context.projectInstance.config.configId,
                        },
                        nextStateOnSuccess: {
                            value: context.projectInstance.cicd.nextState,
                        },
                        nextStateOnFail: {
                            value: context.projectInstance.cicd.cicdFsmState, //fallback to current cicd fsm state
                        },
                        buildInfo: {
                            value: context.scanInstance.extraInfo && context.scanInstance.extraInfo.buildInfo,
                        },
                        relativeSourcePath: {
                            value: context.projectInstance.config.projectPath,
                            type: 'PROJECT',
                        },
                        relativeBuildPath: {
                            value: context.projectInstance.config.buildPath,
                            type: 'PROJECT',
                        },
                    };

                    if (context.projectInstance.config.houseKeeping[Policy.enums.CONFIGURATION.PROJECT.KEEP_LOCAL_TEMP_FILES]) {
                        payload['preprocessResultPath'] = {
                            value: `${context.scanInstance.workFolder}/${Policy.configs.CLIENT.FILES_FOLDERS.PREPROCESS_PACKAGE}`,
                            type: 'SCAN'
                        };
                    }
                    result = await scanService.createScanTaskWithCommitInfo(client.config.apiServerUrl, jwt, payload);
                } else {
                    // tobe @deprecated
                    result = await scanService.createScanTask(client.config.apiServerUrl, jwt, context.projectInstance.uuid)
                }

                const scanTaskId = result.id;
                if (!scanTaskId) {
                    return Promise.reject({
                        status: 1,
                        logs: {
                            error: `Failed to create online scan task, callback from api server ${JSON.stringify(result)}`
                        }
                    });
                }
                context.scanInstance.onlineScanId = scanTaskId;
            } catch (e) {
                logger.error(e, logMeta);
                return Promise.reject({
                    status: 1,
                    logs: {
                        error: e
                    }
                });
            }

            return Promise.resolve({
                status: 0,
            });
        },
        context
    });
}

module.exports = createScanTask;

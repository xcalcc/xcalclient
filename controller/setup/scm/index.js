const fs = require('fs-extra');
const path = require('path');
const scriptRunner = require('../../../utils/commandExec');
const logger = require('../../../utils/logger');
const SubPhase = require('../../../model/SubPhase');
const validator = require('../../../validator');
const system = require("../../../utils/system");

const logMeta = {
    file: 'controller/setup/scm'
};

const scm = (policy, context) => {
    const client = context.projectInstance.client;

    if (!fs.pathExistsSync(path.resolve(client.config.executableFilePath, Policy.configs.CLIENT.FILES_FOLDERS.EXECUTABLE_SCM))) {
        const errorMsg = `No executable found for scm`;
        logger.error(errorMsg, logMeta);
        throw errorMsg;
    }

    if (context.projectInstance.cicd &&
        context.projectInstance.cicd.baselineCommitId &&
        context.projectInstance.cicd.commitId &&
        context.projectInstance.cicd.baselineCommitId === context.projectInstance.cicd.commitId) {
        system.exit(Policy.enums.EXIT_CODES.CUSTOM.SAME_COMMIT_ID, {
            msg: "Commit_ids from source control system for the delta scan are the same. This delta scan will not produce meaningful results. Therefore, no scan takes place."
        }, Policy.enums.STATUS.ABORTED);
    }
    const jwt = client.user.token;
    const projectConf = context.projectInstance.config;
    const projectUuid = context.projectInstance.uuid;
    const command = `cd ${client.config.executableFilePath} && ${Policy.configs.CLIENT.FILES_FOLDERS.EXECUTABLE_SCM}`;

    const SCM_ARGS = Policy.arguments['SUBPHASE']['SCM'];

    const argArray = [
        `${SCM_ARGS.OUTPUT_FOLDER.prefix}${SCM_ARGS.OUTPUT_FOLDER.arg}`, context.scanInstance.workFolder,
        `${SCM_ARGS.API_SERVER.prefix}${SCM_ARGS.API_SERVER.arg}`, client.config.apiServerUrl,
        `${SCM_ARGS.PROJECT_ID.prefix}${SCM_ARGS.PROJECT_ID.arg}`, projectUuid,
        `${SCM_ARGS.TOKEN.prefix}${SCM_ARGS.TOKEN.arg}`, `'Bearer ${jwt}'`,
        `${SCM_ARGS.BACK_TRACK.prefix}${SCM_ARGS.BACK_TRACK.arg}`, projectConf.dsr && projectConf.dsr.maxGetCommit || 10,
        `${SCM_ARGS.REPO_PATH.prefix}${SCM_ARGS.REPO_PATH.arg}`, projectConf.dsr && projectConf.dsr.repoPath,
        `${SCM_ARGS.REPO_BRANCH.prefix}${SCM_ARGS.REPO_BRANCH.arg}`, projectConf.dsr && projectConf.dsr.repoBranch,
    ];
    if (context.projectInstance.cicd && context.projectInstance.cicd.commitId) {
        logger.debug(`[SCM] commit id "${context.projectInstance.cicd.commitId}" found, pass to scm for writing directly.`, logMeta);
        argArray.push(`${SCM_ARGS.COMMIT_ID.prefix}${SCM_ARGS.COMMIT_ID.arg}`);
        argArray.push(context.projectInstance.cicd.commitId);
    }
    if (context.projectInstance.cicd && context.projectInstance.cicd.baselineCommitId) {
        logger.debug(`[SCM] baseline commit id "${context.projectInstance.cicd.baselineCommitId}" found, pass to scm for writing directly.`, logMeta);
        argArray.push(`${SCM_ARGS.BASELINE_COMMIT_ID.prefix}${SCM_ARGS.BASELINE_COMMIT_ID.arg}`);
        argArray.push(context.projectInstance.cicd.baselineCommitId);
    }

    if (context.scanInstance.deltaResult) {
        logger.info(`[SCM] --delta-result argument passed in, partial scan enabled`, logMeta);
        argArray.push(`${SCM_ARGS.DELTA_RESULT.prefix}${SCM_ARGS.DELTA_RESULT.arg}`);
    }

    if (projectConf.dsr[Policy.enums.CONFIGURATION.PROJECT.GIT_FOLDER_TOLERANCE]) {
        logger.info(`[SCM] scan config found dsr.gitFolderTolerance set to be true, allowing .git folder in parent folder`, logMeta);
        argArray.push(`${SCM_ARGS.GIT_FOLDER_TOLERANCE.prefix}${SCM_ARGS.GIT_FOLDER_TOLERANCE.arg}`);
    }

    // TODO: check if is first scan and first baseline commit id still required for SCM subphase

    let commitInfo = {};

    const subPhase = new SubPhase({
        name: 'SCM_CODE_DIFF',
        type: Policy.enums.SUB_PHASE_TYPES.COMMAND,
        executeCommand: `${command} ${argArray.join(' ')}`,
        policy,
        run: async () => {
            if (projectConf.dsr) {
                logger.debug(`[SCM] project config dsr: ${JSON.stringify(projectConf.dsr)}`, logMeta);
                logger.debug(`[SCM] needDsr in config, dsr.needDsr = ${projectConf.dsr.needDsr}`, logMeta);
            }
            if (!projectConf.dsr || !projectConf.dsr.repoPath || !projectConf.dsr.repoBranch) {
                const errorMsg = `[SCM] Neither repository path nor repository branch defined in ${context.projectInstance.scanConfigPath}, no diff will be executed...`;
                logger.warn(errorMsg, logMeta);
                return Promise.reject({
                    status: 1,
                    logs: {
                        error: errorMsg
                    }
                });
            }
            if (projectConf.dsr && projectConf.dsr.needDsr) {
                logger.info(`[SCM] needDsr in project config is detected as true, scm will be mandatory`, logMeta);
                subPhase.setPolicy({
                    ...policy,
                    MANDATORY: true,
                });
            }
            const result = scriptRunner.runScriptSync(
                'SCM_CODE_DIFF',
                command,
                argArray,
                policy.TIMEOUT
            );

            //when the commit id has been scanned before and can be found in db
            //todo run the full scan model cycle to generate aborted status
            if (result.status === Policy.enums.EXIT_CODES.CUSTOM.SAME_COMMIT_ID) {
                system.exit(Policy.enums.EXIT_CODES.CUSTOM.SAME_COMMIT_ID, {
                    msg: "Commit_ids from source control system for the delta scan are the same. This delta scan will not produce meaningful results. Therefore, no scan takes place."
                }, Policy.enums.STATUS.ABORTED);
            }

            if (result.status !== 0) {
                return Promise.reject(result);
            }

            const commitInfoFilePath = path.resolve(context.scanInstance.workFolder, Policy.configs.CLIENT.FILES_FOLDERS.SCM_COMMIT_INFO_FILE);
            //read file into scan conf, none mandatory
            if (!fs.pathExistsSync(commitInfoFilePath)) {
                logger.error(`[SCM] No commit info found at ${commitInfoFilePath}`, logMeta);
                return Promise.resolve({
                    state: 1,
                    logs: {
                        error: ErrorCodes.lookup('E_SCM_ERROR').err_message,
                        stdout: result.logs.stdout
                    }
                });
            }
            if (fs.pathExistsSync(commitInfoFilePath)) {
                logger.debug(`[SCM] commit info generated by scm`, logMeta);
                commitInfo = fs.readJsonSync(commitInfoFilePath, {encoding: 'utf8'});
                logger.debug(`[SCM] read json content from ${commitInfoFilePath}, content is ${JSON.stringify(commitInfo)}`);
                logger.info(`[SCM] commit id: ${commitInfo.commit_id}`, logMeta);
                logger.info(`[SCM] baseline commit id: ${commitInfo.baseline_commit_id}`, logMeta);
            } else {
                logger.warn(`[SCM] commit info has not generated by scm, please check the scm running script`, logMeta);
            }
            const validateResult = validator.validateCommitInfo(commitInfo);

            if (!commitInfo || !validateResult.valid || (!commitInfo.commit_id && !commitInfo.baseline_commit_id)) {
                logger.warn(`[SCM] Commit info validation error at ${commitInfoFilePath}, ${JSON.stringify(validateResult.errors)}`, logMeta);

                return Promise.resolve({
                    state: 1,
                    logs: {
                        error: ErrorCodes.lookup('E_SCM_ERROR').err_message,
                        stdout: result.logs.stdout
                    }
                });
            }

            context.scanInstance.setCommitInfo({
                commitId: commitInfo.commit_id,
                baselineCommitId: commitInfo.baseline_commit_id,
            });
            return Promise.resolve(result);
        },
        async finish() {
            subPhase.summary = {
                commitId: commitInfo.commit_id || '',
                baselineCommitId: commitInfo.baseline_commit_id || '',
            }
            logger.debug(`[SCM] Going to set if scan needs partial scan`, logMeta);
            await context.scanInstance.checkIfPerformPartialScan();
        },
        context,
    });

    return subPhase;
}
module.exports = scm;

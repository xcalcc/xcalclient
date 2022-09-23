//Using 'let' for unit test rewire rewrite
/*** Xcalscan client entry ***/
const path = require('path');
const envPath = path.resolve(__dirname, '.env');
require('dotenv').config({path: envPath});

const policy = require('./policy');
//set globals
global.Policy = policy;
global.ErrorCodes = policy.errorCodes;
global.debugMode = false;

const fs = require('fs-extra');
const logger = require('./utils/logger');
const packageJson = require('./package.json');
const system = require('./utils/system');
const tools = require('./utils/tools');
const commandExec = require("./utils/commandExec");

const Client = require('./model/Client');
const Arguments = require('./model/Arguments');
const User = require('./model/User');
const Project = require('./model/Project');

const {
    CICDFsm,
    FsmState,
    FsmTransition
} = require('./controller/fsm/fsmController');

const logMeta = {
    file: 'index.js'
};


const buildInfoPath = path.resolve(__dirname, 'build-info');
let buildInfo = '';
if (fs.pathExistsSync(buildInfoPath)) {
    buildInfo = fs.readFileSync(buildInfoPath, {
        encoding: 'utf8'
    });
}
const versionFromFile = fs.readFileSync('./ver', {encoding: 'utf8'});
const versionFull = `${packageJson.name} ${versionFromFile}${buildInfo ? `/${buildInfo}` : ''}`;

const CICDStart = async project => {
    const toTrialScanStateTransition = new FsmTransition({
        nextState: Policy.enums.CICDFSM_STATE.TRIAL_SCAN,
        input: project.cicd,
        validate: () => {
            logger.debug(`[CICDFSM][toTrialScanStateTransition][validate()] Transition validation success`, logMeta);
            return {
                isValid: true,
            };
        },
    });
    const toCleanScanStateTransition = new FsmTransition({
        nextState: Policy.enums.CICDFSM_STATE.CLEAN_SCAN_DONE,
        input: project.cicd,
        validate: () => {
            if (!project.cicd.commitId) {
                logger.debug(`[CICDFSM][toCleanScanStateTransition][validate()] Transition validation failure, commit id cannot be found`, logMeta);
                return {
                    isValid: false,
                    error: '[CICD] No commit id found before executing clean scan',
                    action: () => {
                    }
                };
            }
            logger.debug(`[CICDFSM][toCleanScanStateTransition][validate()] Transition validation success`, logMeta);
            return {
                isValid: true,
            };
        },
    });
    const toCdDsrScanTransition = new FsmTransition({
        nextState: Policy.enums.CICDFSM_STATE.CD_DSR_SCAN_DONE,
        input: project.cicd,
        validate: () => {
            if (!project.cicd.commitId) {
                logger.debug(`[CICDFSM][toCdDsrScanTransition][validate()] Transition validation failure, commit id cannot be found`, logMeta);
                return {
                    isValid: false,
                    error: '[CICD] No commit id found before executing dsr scan',
                    action: () => {
                    }
                };
            }
            logger.debug(`[CICDFSM][toCdDsrScanTransition][validate()] Transition validation success`, logMeta);
            return {
                isValid: true,
            };
        },
    });
    const toCiDsrScanTransition = new FsmTransition({
        nextState: Policy.enums.CICDFSM_STATE.CI_DSR_SCAN_DONE,
        input: project.cicd,
        validate: () => {
            if (!project.cicd.commitId) {
                logger.debug(`[CICDFSM][toCiDsrScanTransition][validate()] Transition validation failure, commit id cannot be found`, logMeta);
                return {
                    isValid: false,
                    error: '[CICD] No commit id found before executing dsr scan',
                    action: () => {
                    }
                };
            }
            logger.debug(`[CICDFSM][toCiDsrScanTransition][validate()] Transition validation success`, logMeta);
            return {
                isValid: true,
            };
        },
    });

    const executeDecisionTable = repoAction => {
        logger.debug(`[CICDFSM][executeDecisionTable] Executing decision table, repoAction=${repoAction}`, logMeta);
        switch (repoAction) {
            case Policy.enums.REPO_ACTION.CI:
                logger.debug(`[CICDFSM][executeDecisionTable] next state is ${toCiDsrScanTransition.nextState}`, logMeta);
                return toCiDsrScanTransition;
            case Policy.enums.REPO_ACTION.CD:
                //will generate baseline commit id
                logger.debug(`[CICDFSM][executeDecisionTable] next state is ${toCdDsrScanTransition.nextState}`, logMeta);
                return toCdDsrScanTransition;
            default:
                logger.debug(`[CICDFSM][executeDecisionTable] repoAction is not specified, cannot decide next CICD state`, logMeta);
                system.exit(Policy.enums.EXIT_CODES.GENERAL_ERROR, ErrorCodes.lookup('E_DSR_STATE_MISSING_REPO_ACTION'));
        }
    }

    const cicdFSM = new CICDFsm(project, [
        new FsmState({
            name: Policy.enums.CICDFSM_STATE.START,
            transit: () => {
                logger.debug(`[CICDFSM] Transit from ${Policy.enums.CICDFSM_STATE.START} state to next state`, logMeta);
                if (!project.cicd.commitId || project.cicd.repoAction !== Policy.enums.REPO_ACTION.CD) {
                    logger.debug(`[CICDFSM] No commit id found, or not "${Policy.enums.REPO_ACTION.CD}" action, next state is ${toTrialScanStateTransition.nextState}`, logMeta);
                    return toTrialScanStateTransition;
                }

                logger.debug(`[CICDFSM] Commit id [${project.cicd.commitId}] found, next state is ${toCleanScanStateTransition.nextState}`, logMeta);
                return toCleanScanStateTransition;
            },
        }),
        new FsmState({
            name: Policy.enums.CICDFSM_STATE.TRIAL_SCAN,
            transit: () => {
                logger.debug(`[CICDFSM] Transit from ${Policy.enums.CICDFSM_STATE.TRIAL_SCAN} state to next state`, logMeta);
                if (!project.cicd.commitId || project.cicd.repoAction !== Policy.enums.REPO_ACTION.CD) {
                    logger.debug(`[CICDFSM] No commit id found, or not "${Policy.enums.REPO_ACTION.CD}" action, next state is ${toTrialScanStateTransition.nextState}`, logMeta);
                    return toTrialScanStateTransition;
                }
                logger.debug(`[CICDFSM] Commit id [${project.cicd.commitId}] found, next state is ${toCleanScanStateTransition.nextState}`, logMeta);
                return toCleanScanStateTransition;
            },
        }),
        new FsmState({
            name: Policy.enums.CICDFSM_STATE.CLEAN_SCAN_DONE,
            transit: () => {
                logger.debug(`[CICDFSM] Transit from ${Policy.enums.CICDFSM_STATE.CLEAN_SCAN_DONE} state to next state`, logMeta);
                if (!project.cicd.commitId) {
                    logger.debug(`[CICDFSM] No commit id found, exit directly, error: ${ErrorCodes.lookup('E_SCM_NO_COMMIT_BASELINE_ID').err_message} `, logMeta);
                    system.exit(Policy.enums.EXIT_CODES.SUCCESS, ErrorCodes.lookup('E_SCM_NO_COMMIT_BASELINE_ID'));
                }
                return executeDecisionTable(project.cicd.repoAction);
            },
        }),
        new FsmState({
            name: Policy.enums.CICDFSM_STATE.CI_DSR_SCAN_DONE,
            transit: () => {
                logger.debug(`[CICDFSM] Transit from ${Policy.enums.CICDFSM_STATE.CI_DSR_SCAN_DONE} state to next state`, logMeta);
                if (!project.cicd.commitId) {
                    logger.debug(`[CICDFSM] No commit id found, exit directly, error: ${ErrorCodes.lookup('E_SCM_NO_COMMIT_BASELINE_ID').err_message} `, logMeta);
                    system.exit(Policy.enums.EXIT_CODES.SUCCESS, ErrorCodes.lookup('E_SCM_NO_COMMIT_BASELINE_ID'));
                }

                return executeDecisionTable(project.cicd.repoAction);
            },
        }),
        new FsmState({
            name: Policy.enums.CICDFSM_STATE.CD_DSR_SCAN_DONE,
            transit: () => {
                logger.debug(`[CICDFSM] Transit from ${Policy.enums.CICDFSM_STATE.CD_DSR_SCAN_DONE} state to next state`, logMeta);
                if (!project.cicd.commitId) {
                    logger.debug(`[CICDFSM] No commit id found, exit directly, error: ${ErrorCodes.lookup('E_SCM_NO_COMMIT_BASELINE_ID').err_message} `, logMeta);
                    system.exit(Policy.enums.EXIT_CODES.SUCCESS, ErrorCodes.lookup('E_SCM_NO_COMMIT_BASELINE_ID'));
                }

                return executeDecisionTable(project.cicd.repoAction);
            },
        }),
    ]);

    return cicdFSM.start();
}

const macHandler = () => {
    const meta = {
        ...logMeta,
        method: 'macHandler()'
    };
    logger.info(`[main/macHandler] Checking if bear has been installed`, meta);
    const result = commandExec.runScriptSync("check bear", `which bear`);
    logger.debug(result, meta);

    if (result.status === 1 || !result.logs.stdout || result.logs.stdout.includes('not found')) {
        logger.debug(`[main/macHandler] not found bear for mac`);
        system.exit(Policy.enums.EXIT_CODES.GENERAL_ERROR, {
            errorMsg: `Dependency checking failed, you need to install bear by "brew install bear" to continue`
        });
    }
}

const macDetection = async () => {
    const meta = {
        ...logMeta,
        method: 'macDetection()'
    };
    const sysInfo = await system.osResource();
    const osString = sysInfo.os;
    logger.info(`[main/macHandler] Current OS is ${osString}`, meta);
    if (osString.toLowerCase().includes('mac')) {
        return true;
    }
    return false;
}

const main = async () => {
    Policy.configs.CLIENT.PRINT_VERSION_AT_START && tools.stdout(versionFull);
    const isMacOS = await macDetection();

    if (isMacOS) {
        macHandler();
    }

    const arguments = new Arguments();
    const args = arguments.userArgs;
    logger.debug(`[ENV] Node version: ${process.version}`, logMeta);

    logger.debug(`[ENV] .env: ${fs.readFileSync(envPath)}`, logMeta);
    logger.debug(`[ENV] Environments: ${JSON.stringify(process.env, null, 4)}`, logMeta);

    /**
     * Print version of application
     *
     */
    const printStartMessage = (projectId, projectName) => {
        const data = {
            processId: process.pid,
            projectId,
            projectName,
            action: args.cancel ? 'CANCEL' : 'SCAN'
        };
        buildInfo && (data.build = buildInfo);
        tools.stdoutFlowState(Policy.enums.STATE.CLIENT_START, Policy.enums.STATUS.PENDING, data);
    }

    if (args.version) {
        tools.stdout(versionFull);
        process.exit(0);
    }
    if (args.help) {
        tools.stdout(arguments.generateHelpTxt());
        process.exit(0);
    }
    //make sure user is authorized
    const client = new Client(args);

    const user = new User({
        username: client.config.user,
        userpsw: client.config.psw,
        token: client.config.token,
        authServerUrl: client.config.apiServerUrl
    });
    const isLoggedIn = await user.login();

    //scan start
    if (isLoggedIn) {
        client.user = user;
        if (!user.token) {
            system.exit(Policy.enums.EXIT_CODES.GENERAL_ERROR, ErrorCodes.lookup('E_AUTH_FAILED_USERNAME_PSW'));
        }

        const project = new Project(client, {
            sourceCodePath: args.sourceCodePath,
            configPath: args.configFile,
        });
        if (!args.cancel) {
            await project.setup({
                sourceCodePath: args.sourceCodePath,
                buildPath: args.buildPath,
                serverUrl: client.config.apiServerUrl,
                token: user.token,
                configPath: args.configFile,
                projectConfig: {
                    scanMode: args.scanMode,
                    projectName: args.projectName,
                    projectId: args.projectId,
                    repoPath: args.repoPath,
                    repoBranch: args.repoBranch,
                    repoAction: args.repoAction,
                },
                createNew: args.createNew,
            });
        }
        await project.init(args.taskFolder);

        printStartMessage(project.id, project.name);
        if (args.cancel) {
            await project.cancelScanByProjectId({
                apiServer: client.config.apiServerUrl,
                token: await user.getToken(),
            });
            return;
        }

        let extraInfoForScan = {
            buildInfo: args.buildInfo,
        };
        // patching for mac
        if (isMacOS) {
            extraInfoForScan.xvsaOptions = '-clang';
        }
        const scanTask = project.createScanTask(args.deltaResult, extraInfoForScan);

        // scan config patching
        logger.debug(`[main] Patching scanConfig for mac`, logMeta);

        if (Policy.configs.CLIENT.ENABLE_CICD_CONTROL) {
            await CICDStart(project).then(async state => {
                logger.info(`[CICD] Going to execute scan with next CICD state [${state}]`, logMeta);
                await scanTask.start(state);
            });
        } else {
            await scanTask.start();
        }

    } else {
        system.exit(Policy.enums.EXIT_CODES.GENERAL_ERROR, ErrorCodes.lookup('E_LOGIN_FAILED'));
    }
}

main().catch(e => logger.error(`${e.messsage} ${e.stack} `, logMeta));

module.exports = main;

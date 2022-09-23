const fs = require("fs-extra");
const path = require("path");
const extractArgs = require("../utils/extractArgs");
const logger = require("../utils/logger");
const system = require("../utils/system");
const validator = require("../validator");
const tools = require("../utils/tools");

const logMeta = {
    file: 'model/index.js'
};

class Arguments {
    _supportArgs = Policy.arguments['CLIENT'];
    _userInputArgs = {};

    constructor() {
        this._userInputArgs = this._extractFromCommandLine();
    }

    //todo refactor
    _validate(args) {
        const clientArgList = Object.keys(this._supportArgs).map(key => this._supportArgs[key]);
        //iterate policy for basic validation
        Object.keys(args)
            .filter(key => key !== '_')
            .forEach(key => {
                const found = clientArgList.find(item => item.arg === key);
                if (!found) {
                    logger.warn(`[Args] Argument "${key}" is not supported`, logMeta);
                }
                if (found && found.type !== typeof args[key]) {
                    logger.warn(`[Args] Argument "${key}" type needs to be "${found.type}"`, logMeta);
                }
            });

        //biz level validation
        if (args.c && !fs.lstatSync(args.c).isFile()) {
            return {
                exitCode: Policy.enums.EXIT_CODES.GENERAL_ERROR,
                err: {err_message: 'Config file path invalid'}
            };
        }
        //when project config provided, it will override source code path from the config file
        if (args.c) {
            logger.debug(`Assigned config path: ${args.c}`, logMeta);
            //extract source code path
            const projectConfigData = fs.readJsonSync(args.c, {encoding: 'utf8'});
            const validateResult = validator.validateProjectConfig(projectConfigData);
            if (!validateResult.valid) {
                return {
                    exitCode: Policy.enums.EXIT_CODES.GENERAL_ERROR,
                    err: {err_message: 'Malformed project config data'}
                };
            }
            if (!projectConfigData.projectPath || !fs.pathExistsSync(projectConfigData.projectPath)) {
                return {
                    exitCode: Policy.enums.EXIT_CODES.GENERAL_ERROR,
                    err: {err_message: 'Project path in project config invalid'}
                };
            }
            // -s for source code path has higher priority unless the source code path is not provided
            args.s = args.s || path.resolve(projectConfigData.projectPath);
        }

        if (args.m) {
            const scanModeValidateResult = tools.validateScanMode(args.m);
            if (!scanModeValidateResult.valid) {
                return {
                    exitCode: Policy.enums.EXIT_CODES.GENERAL_ERROR,
                    err: {err_message: scanModeValidateResult.errorMsg}
                };
            }
        }
        //auto fix path
        const fixedPath = args.s ? path.resolve(args.s) : null;
        if (!fs.pathExistsSync(fixedPath)) {
            return {
                exitCode: Policy.enums.EXIT_CODES.GENERAL_ERROR,
                err: ErrorCodes.lookup('E_CLIENT_SOURCE_CODE_PATH_NOT_FOUND')
            };
        }
        return {
            ...args,
            s: fixedPath
        };
    }

    generateHelpTxt() {
        let helpTxt = 'usage: Xcalclient \n';
        const paddingFront = helpTxt.length;
        const devMode = this._userInputArgs.devMode;
        helpTxt = helpTxt.concat(' ').concat(Array(paddingFront).join(' '));
        const printALine = (data, index) => {
            let lineTxt = `[${data.prefix ? data.prefix : '-'}${data.arg} ${data.description}]`;
            if ((index + 1) % 2 === 0) {
                lineTxt = lineTxt.concat('\n');
                lineTxt = lineTxt.concat(' ').concat(Array(paddingFront).join(' '));
            } else {
                lineTxt = lineTxt.concat(' ');
            }
            return lineTxt;
        }

        Object.keys(this._supportArgs)
            .filter(key => !this._supportArgs[key].internal)
            .forEach((key, idx) => {
                const argObj = this._supportArgs[key];
                helpTxt = helpTxt.concat(printALine(argObj, idx));
            });

        if (devMode) {
            const subPhaseArgPolicies = Policy.arguments['SUBPHASE'];
            helpTxt = helpTxt.concat(`\n------------------Dev mode------------------\n`);
            //print trigger
            const triggerArgPolicies = Policy.arguments['TRIGGER'];
            const triggerTxt = 'usage: Jenkins Trigger \n';
            helpTxt = helpTxt.concat(`\n---TRIGGER----\n`);
            helpTxt = helpTxt.concat(triggerTxt);
            helpTxt = helpTxt.concat(' ').concat(Array(paddingFront).join(' '));

            Object.keys(triggerArgPolicies)
                .forEach((key, idx) => {
                    const argObj = triggerArgPolicies[key];
                    helpTxt = helpTxt.concat(printALine(argObj, idx));
                });

            //print subphases
            helpTxt = helpTxt.concat(`\n---SUBPHASES---\n`);
            Object.keys(subPhaseArgPolicies).forEach(subPhaseName => {
                const subPhase = subPhaseArgPolicies[subPhaseName];
                const subPhaseHeader = `usage: [${subPhaseName}] \n`;
                helpTxt = helpTxt.concat(' ').concat(subPhaseHeader).concat(Array(paddingFront).join(' '));
                Object.keys(subPhase).forEach((key, index) => {
                    const argObj = subPhase[key];
                    helpTxt = helpTxt.concat(printALine(argObj, index));
                });
                helpTxt = helpTxt.concat('\n');
            });
        }
        return helpTxt;
    }

    /**
     * Extracting arguments
     * @return Object
     */
    _extractFromCommandLine() {
        try {
            const meta = {
                ...logMeta,
                method: 'extractArgsFromCommand()'
            }
            const userArgs = extractArgs();
            if (Object.keys(userArgs).length === 1) {
                userArgs.help = true;
            }
            if (userArgs.help) {
                return {
                    help: true,
                    devMode: userArgs.dev,
                }
            }
            if (userArgs.v || userArgs.version) {
                return {
                    version: true,
                };
            }
            global.debugMode = !!userArgs.debug;
            global.devMode = !!userArgs.dev;

            const args = this._validate(userArgs);

            if (args.err) {
                throw args;
            }

            logger.setDebugMode(global.debugMode);

            logger.info(`Extracting arguments from command line`, meta);
            logger.debug(`Args: ${JSON.stringify(args)}`, meta);

            logger.info(`Source code path is ${args.s}`, meta);

            if (args.cancel) {
                logger.debug(`[Argument] Action is cancel`, meta);
                return {
                    serverUrl: args.h,
                    serverPort: args.p,
                    psw: args.psw,
                    user: args.u,
                    cancel: args.cancel,
                    sourceCodePath: args.s, //project source code
                };
            }

            logger.debug('Consume client args finished!', meta);
            //set locale
            global.locale = args.locale || 'en';

            return {
                serverUrl: args[this._supportArgs['API_SERVER'].arg],
                deltaResult: args[this._supportArgs['DELTA_RESULT'].arg],
                serverPort: args[this._supportArgs['API_PORT'].arg],
                scanMode: args[this._supportArgs['SCAN_MODE'].arg],
                psw: args[this._supportArgs['PASSWORD'].arg],
                user: args[this._supportArgs['USER'].arg],
                configFile: args[this._supportArgs['SCAN_CONFIG_PATH'].arg],
                debug: args[this._supportArgs['DEBUG'].arg],
                fileServiceUrl: args[this._supportArgs['API_SERVER'].arg],
                fileServicePort: args[this._supportArgs['FILE_SERVICE_PORT'].arg],
                createNew: args[this._supportArgs['CREATE_NEW'].arg],
                projectName: args[this._supportArgs['PROJECT_NAME'].arg],
                repoPath: args[this._supportArgs['REPO_PATH'].arg],
                repoBranch: args[this._supportArgs['REPO_BRANCH'].arg],
                maxGetCommit: args[this._supportArgs['MAX_GET_COMMIT'].arg],
                projectId: args[this._supportArgs['PROJECT_ID'].arg],
                sourceCodePath: args[this._supportArgs['SOURCE_CODE_PATH'].arg], //project source code
                buildPath: args[this._supportArgs['BUILD_PATH'].arg], //project build path
                devMode: args[this._supportArgs['DEV_MODE'].arg],
                taskFolder: args[this._supportArgs['TASK_FOLDER'].arg],
                repoAction: args[this._supportArgs['REPO_ACTION'].arg],
                buildInfo: args[this._supportArgs['BUILD_INFO'].arg],
                token: args[this._supportArgs['TOKEN'].arg],
            };
        } catch (e) {
            logger.debug(JSON.stringify(e), logMeta);
            if (e.exitCode) {
                system.exit(e.exitCode, e.err);
            } else {
                logger.error(`[Project] Error with extracting args, ${JSON.stringify(e)}`, logMeta);
                system.exit(1, e);
            }
        }
    }

    get userArgs() {
        return this._userInputArgs;
    }

}

module.exports = Arguments;

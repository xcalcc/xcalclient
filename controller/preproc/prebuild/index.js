const path = require('path');
const scriptRunner = require('../../../utils/commandExec');
const logger = require('../../../utils/logger');
const SubPhase = require('../../../model/SubPhase');
const fs = require("fs-extra");
const system = require("../../../utils/system");

const logMeta = {
    file: 'controller/preproc/prebuild',
};

const prebuild = (policy, context) => {
    const client = context.projectInstance.client;
    const scanConf = context.scanInstance.config;

    if (!fs.pathExistsSync(path.resolve(client.config.executableFilePath, Policy.configs.CLIENT.FILES_FOLDERS.EXECUTABLE_PREBUILD))) {
        return Promise.reject({
            status: 1,
            logs: {
                error: 'No executable found for prebuilder',
            }
        });
    }
    const prepairArg = policyArg => `${policyArg.prefix || '-'}${policyArg.arg}`;

    const workFolderPath = context.scanInstance.workFolder;
    const scanConfPath = context.projectInstance.scanConfigPath;

    const command = `cd ${client.config.executableFilePath} && ${Policy.configs.CLIENT.FILES_FOLDERS.EXECUTABLE_PREBUILD}`;
    const PREBUILD_ARGS = Policy.arguments['SUBPHASE']['PREBUILD'];
    let argArray = [
        prepairArg(PREBUILD_ARGS.SCAN_CONFIG_PATH), scanConfPath,
        prepairArg(PREBUILD_ARGS.XCALBUILD_PATH), path.resolve(client.config.executableFilePath, Policy.configs.CLIENT.FILES_FOLDERS.EXECUTABLE_BUILD),
        prepairArg(PREBUILD_ARGS.OUTPUT_PATH), workFolderPath,
    ];
    if (scanConf[Policy.enums.CONFIGURATION.SCAN.FILE_WHITELIST_CMD]) {
        logger.info(`[Prebuild] Injecting arg --${PREBUILD_ARGS.FILE_WHITELIST_CMD.arg} "${scanConf[Policy.enums.CONFIGURATION.SCAN.FILE_WHITELIST_CMD]}"`, logMeta);
        argArray.push(prepairArg(PREBUILD_ARGS.FILE_WHITELIST_CMD));
        argArray.push(scanConf[Policy.enums.CONFIGURATION.SCAN.FILE_WHITELIST_CMD]);
    }

    if (
        scanConf[Policy.enums.CONFIGURATION.SCAN.PROCESS_LINK_USING_COMPILER] &&
        (scanConf[Policy.enums.CONFIGURATION.SCAN.PROCESS_LINK_USING_COMPILER] === false ||
        scanConf[Policy.enums.CONFIGURATION.SCAN.PROCESS_LINK_USING_COMPILER] === "false")
    ) {
        logger.info(`[Prebuild] Arg --${PREBUILD_ARGS.PROCESS_LINK_USING_COMPILER.arg} found in config, "${scanConf[Policy.enums.CONFIGURATION.SCAN.PROCESS_LINK_USING_COMPILER].toString()}"`, logMeta);
    } else {
        logger.info(`[Prebuild] Injecting arg --${PREBUILD_ARGS.PROCESS_LINK_USING_COMPILER.arg} as default`, logMeta);
        argArray.push(prepairArg(PREBUILD_ARGS.PROCESS_LINK_USING_COMPILER));
    }

    if (scanConf[Policy.enums.CONFIGURATION.SCAN.FILE_BLACKLIST_CMD]) {
        logger.info(`[Prebuild] Injecting arg --${PREBUILD_ARGS.FILE_BLACKLIST_CMD.arg} "${scanConf[Policy.enums.CONFIGURATION.SCAN.FILE_BLACKLIST_CMD]}"`, logMeta);
        argArray.push(prepairArg(PREBUILD_ARGS.FILE_BLACKLIST_CMD));
        argArray.push(scanConf[Policy.enums.CONFIGURATION.SCAN.FILE_BLACKLIST_CMD]);
    }


    if (scanConf[Policy.enums.CONFIGURATION.SCAN.SUPPRESS_RULES_LIST_FILE]) {
        logger.info(`[Prebuild] Injecting arg --${PREBUILD_ARGS.SUPPRESS_RULES_LIST_FILE.arg} "${scanConf[Policy.enums.CONFIGURATION.SCAN.SUPPRESSION_RULES_LIST_FILE]}"`, logMeta);
        argArray.push(prepairArg(PREBUILD_ARGS.SUPPRESS_RULES_LIST_FILE));
        argArray.push(scanConf[Policy.enums.CONFIGURATION.SCAN.SUPPRESS_RULES_LIST_FILE]);
    }

    if (global.debugMode) {
        argArray.push(prepairArg(PREBUILD_ARGS.DEBUG));
        argArray.push(prepairArg(PREBUILD_ARGS.LOCAL_LOG));
    }

    const subPhase = new SubPhase({
        name: 'PREBUILD',
        type: Policy.enums.SUB_PHASE_TYPES.COMMAND,
        executeCommand: `${command} ${argArray.join(' ')}`,
        policy,
        async run() {
            logger.debug(`[Prebuild] perform partial scan: ${context.scanInstance.partialScan}`, logMeta);
            if (!context.scanInstance.partialScan) {
                logger.debug(`[Prebuild] Perform full scan prebuild`, logMeta);
                argArray.push(prepairArg(PREBUILD_ARGS.SCAN_ALL));
            }
            const result = scriptRunner.runScriptSync(
                'BUILD_TASK',
                command,
                argArray,
                policy.TIMEOUT,
            );

            const errorEnum = result.logs.stderr.pop();
            if (result.status === Policy.enums.EXIT_CODES.CUSTOM.BUILD_SUCCESS_WITHOUT_I_FILE || result.status === Policy.enums.EXIT_CODES.CUSTOM.BUILD_FAIL) {
                system.exit(result.status, {
                    msg: ErrorCodes.lookup(errorEnum).err_message,
                }, Policy.enums.STATUS.ABORTED);
            }

            if (result.status !== 0) {
                return Promise.reject(result);
            }

            return Promise.resolve(result);
        },
        context
    });

    return subPhase;
}

module.exports = prebuild;

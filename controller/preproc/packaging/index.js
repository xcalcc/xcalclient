/**
 * Subphase to prepare data for scanning after build task
 */

const scriptRunner = require('../../../utils/commandExec');

const SubPhase = require('../../../model/SubPhase');
const fs = require("fs-extra");
const path = require("path");

const packager = (policy, context) => {
    const client = context.projectInstance.client;

    if (!fs.pathExistsSync(path.resolve(client.config.executableFilePath, Policy.configs.CLIENT.FILES_FOLDERS.EXECUTABLE_PACKAGER))) {
        return Promise.reject({
            status: 1,
            logs: {
                error: 'No executable found for packaging',
            }
        });
    }
    const workFolder = context.scanInstance.workFolder;

    const readFileInfo = () => {
        const fileInfoPath = path.resolve(workFolder, Policy.configs.CLIENT.FILES_FOLDERS.FILE_INFO);
        if (fs.pathExistsSync(fileInfoPath)) {
            return fs.readJsonSync(fileInfoPath, {encoding: 'utf8'});
        }
        return {};
    };


    const command = `cd ${client.config.executableFilePath} && ${Policy.configs.CLIENT.FILES_FOLDERS.EXECUTABLE_PACKAGER}`;
    const PACKAGING_ARGS = Policy.arguments['SUBPHASE']['PACKAGING'];
    const argArray = [
        `-${PACKAGING_ARGS.SCAN_CONFIG_PATH.arg}`, context.projectInstance.scanConfigPath,
        `-${PACKAGING_ARGS.OUTPUT_PATH.arg}`,  workFolder,
    ];
    if (global.debugMode) {
        argArray.push(`-${PACKAGING_ARGS.DEBUG.arg}`);
    }

    const subPhase = new SubPhase({
        name: 'PACKAGING',
        type: Policy.enums.SUB_PHASE_TYPES.COMMAND,
        executeCommand: `${command} ${argArray.join(' ')}`,
        policy,
        run() {
            const result = scriptRunner.runScriptSync(
                'PACKAGING',
                command,
                argArray,
                policy.TIMEOUT,
            );

            const fileInfo = readFileInfo();
            this.summary = {
                fileCounts: Number(fileInfo.numberOfFiles),
                lineOfCode: Number(fileInfo.totalLineNum),
                dirCounts: Number(fileInfo.numberOfDirs),
            };
            return Promise.resolve(result);
        },
        context
    });
    return subPhase;
}

module.exports = packager;

const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');
const scriptRunner = require('../../../utils/commandExec');
const logger = require('../../../utils/logger');
const SubPhase = require('../../../model/SubPhase');

const logMeta = {
    file: 'controller/setup/syncCustomRuleMI'
};

/**
 * Package mi files
 * @param miFilesPath
 * @param outputFile
 * @return {Promise<unknown>}
 */
const packageMiFiles = async (miFilesPath, outputFile) => {
    logger.info(`[MI handler] Start to package .mi files in ${miFilesPath} => mi.tar.gz compression`, logMeta);

    const output = fs.createWriteStream(outputFile);
    const archive = archiver('tar', {
        gzip: true
    });
    output.on('close', function () {
        logger.info(`[MI handler] ${archive.pointer()} total bytes`, logMeta);
        logger.info('[MI handler] archiver has been finalized and the output file descriptor has closed.', logMeta);
    });
    output.on('end', function () {
        logger.info('Data has been drained', logMeta);
    });
    archive.on('warning', function (err) {
        logger.warning(`[MI handler] Warning in zip file, "${JSON.stringify(err)}"`, logMeta);
        if (err.code === 'ENOENT') {
            // log warning
        } else {
            // throw error
            throw err;
        }
    });
    archive.on('error', function (err) {
        logger.error(`[MI handler] Error in zip file, error: "${JSON.stringify(err)}"`, logMeta);
        throw err;
    });

    // pipe archive data to the file
    archive.pipe(output);
    archive.glob('**/*.mi', {
        cwd: miFilesPath
    });
    return archive.finalize().then(() => outputFile);
}

/**
 * Sync rule by uploader
 * @param policy
 * @param context
 * @return {SubPhase}
 */
const customRuleMISync = (policy, context) => {
    const client = context.projectInstance.client;
    const workFolder = context.scanInstance.workFolder;
    const miPackageFileName = Policy.configs.CLIENT.FILES_FOLDERS.MI_PACKAGE;

    const miPackageOutputFilePath = path.resolve(workFolder, miPackageFileName);

    const command = `cd ${client.config.executableFilePath} && ${Policy.configs.CLIENT.FILES_FOLDERS.EXECUTABLE_UPLOADER}`;
    const UPLOAD_ARGS = Policy.arguments['SUBPHASE']['UPLOAD'];
    const argArray = [
        `-${UPLOAD_ARGS.SCAN_CONFIG_PATH.arg}`, context.projectInstance.scanConfigPath,
        `-${UPLOAD_ARGS.FILE_SERVICE_URL.arg}`, client.config.fileServiceUrl,
        `-${UPLOAD_ARGS.FILE_PATH.arg}`, miPackageOutputFilePath,
    ];

    const subPhase = new SubPhase({
        isMandatory: false,
        type: Policy.enums.SUB_PHASE_TYPES.COMMAND,
        executeCommand: `${command} ${argArray.join(' ')}`,
        name: 'SYNC_CUSTOM_RULE_MI',
        configs: {
            customRuleFolderPath: workFolder,
            projectId: context.projectInstance.id || 'not-specified-projectId'
        },
        run: async () => {
            const outputFile = await packageMiFiles(workFolder, miPackageOutputFilePath);
            if (fs.pathExistsSync(outputFile)) {
                logger.info(`[MI handler] Finish compressing [${miPackageFileName}]`, logMeta);
            } else {
                logger.error(`[MI handler] Failed to compress [${miPackageFileName}]`, logMeta);
            }
            logger.info(`[MI handler] Start to upload ${miPackageOutputFilePath}`, logMeta);

            //call uploader
            const result = scriptRunner.runScriptSync('UPLOADER',
                command,
                argArray,
                policy.TIMEOUT,
            );
            return Promise.resolve(result);
        },
        policy,
        context
    });
    return subPhase;
}

module.exports = customRuleMISync;

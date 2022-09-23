const fs = require("fs-extra");
const path = require("path");
const prettyBytes = require('pretty-bytes');
const scriptRunner = require('../../../utils/commandExec');
const logger = require('../../../utils/logger');

const SubPhase = require('../../../model/SubPhase');

const logMeta = {
    file: 'controller/preproc/upload',
}

const uploader = (policy, context) => {
    const client = context.projectInstance.client;
    const sourceCodePath = path.resolve(context.scanInstance.workFolder, Policy.configs.CLIENT.FILES_FOLDERS.SOURCE_CODE);
    const filesToUpload = [
        Policy.configs.CLIENT.FILES_FOLDERS.UPLOAD_LIST_FILE,
        Policy.configs.CLIENT.FILES_FOLDERS.FILE_INFO,
        Policy.configs.CLIENT.FILES_FOLDERS.PREPROCESS_PACKAGE,
        //clean up temp files
        Policy.configs.CLIENT.FILES_FOLDERS.COMPILE_COMMANDS,
        Policy.configs.CLIENT.FILES_FOLDERS.SOURCE_CODE,
        Policy.configs.CLIENT.FILES_FOLDERS.SOURCE_FILES,
    ];
    logger.debug(`[Uploader] File list to upload ${JSON.stringify(filesToUpload)}`, logMeta);

    if (!fs.pathExistsSync(path.resolve(client.config.executableFilePath, Policy.configs.CLIENT.FILES_FOLDERS.EXECUTABLE_UPLOADER))) {
        return Promise.reject({
            status: 1,
            logs: {
                error: 'No executable found for uploader',
            }
        });
    }
    const command = `cd ${client.config.executableFilePath} && ${Policy.configs.CLIENT.FILES_FOLDERS.EXECUTABLE_UPLOADER}`;
    const UPLOAD_ARGS = Policy.arguments['SUBPHASE']['UPLOAD'];
    const argArray = [
        `-${UPLOAD_ARGS.SCAN_CONFIG_PATH.arg}`, context.projectInstance.scanConfigPath,
        `-${UPLOAD_ARGS.FILE_SERVICE_URL.arg}`, client.config.fileServiceUrl,
        `-${UPLOAD_ARGS.WORK_DIRECTORY.arg}`, context.scanInstance.workFolder,
    ];
    if (global.debugMode) {
        argArray.push(`-${UPLOAD_ARGS.DEBUG.arg}`);
    }

    /**
     * Check if source code file exceeds limit
     * @return {boolean}
     */
    const allowUploadSourceCodeFile = maxSourceCodeFileSize => {
        if (!context.projectInstance.config.uploadSource) {
            return false;
        }
        const sourceCodeStat = fs.statSync(sourceCodePath);
        logger.debug(`[Uploader] sourceCodeStat: ${JSON.stringify(sourceCodeStat)}`, logMeta);
        if (sourceCodeStat && sourceCodeStat.size && (sourceCodeStat.size > maxSourceCodeFileSize)) {
            logger.warn(`[Uploader] source_code.zip file size "${sourceCodeStat.size}" is greater than max allowed size "${maxSourceCodeFileSize}", skip uploading`, logMeta);
            logger.warn(`[Uploader] To modify the max source code file size, please go to flowPolicy.json and search for "MAX_SOURCE_FILE_SIZE", size in bytes`, logMeta);
            return false;
        }
        return true;
    }

    const subPhase = new SubPhase({
        name: 'UPLOAD',
        type: Policy.enums.SUB_PHASE_TYPES.COMMAND,
        executeCommand: `${command} ${argArray.join(' ')}`,
        policy,
        run: () => {
            //make sure source_code.zip always exists, uploader presume it will be there
            if (!fs.pathExistsSync(sourceCodePath)) {
                fs.ensureFileSync(sourceCodePath);
            }
            const maxSourceCodeFileSize = policy.OTHERS && policy.OTHERS.MAX_SOURCE_FILE_SIZE || Policy.configs.CLIENT.MAX_SOURCE_FILE_SIZE;
            if (!allowUploadSourceCodeFile(maxSourceCodeFileSize)) {
                logger.debug(`[Uploader] Source code is too large or being set "uploadSource" as "false" in config, removing source code file: ${sourceCodePath} `, logMeta);
                fs.removeSync(sourceCodePath);
            }

            const fileList = {};

            fs.readdirSync(context.scanInstance.workFolder).forEach(file => {
                logger.debug(`[Uploader] File ${file} read from ${path.resolve(context.scanInstance.workFolder, file)}`, logMeta);
                if (filesToUpload.includes(file)) {
                    const fullPath = path.resolve(context.scanInstance.workFolder, file);
                    const fileStat = fs.statSync(fullPath);
                    fileList[file] = {
                        path: fullPath,
                        size: fileStat.size,
                        prettySize: prettyBytes(fileStat.size)
                    }
                    logger.debug(`[Uploader] File ${file} found from file upload list, getting file stat`, logMeta);
                    logger.debug(`[Uploader] File ${file} stat: ${JSON.stringify(fileList[file])}`, logMeta);
                }
            });
            subPhase.summary = {
                fileList,
            }
            const result = scriptRunner.runScriptSync('UPLOADER',
                command,
                argArray,
                policy.TIMEOUT
            );

            return Promise.resolve(result);
        },
        context
    });

    return subPhase;
}

module.exports = uploader;

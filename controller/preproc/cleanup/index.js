const fs = require('fs-extra');
const SubPhase = require('../../../model/SubPhase');
const glob = require("glob");
const logger = require("../../../utils/logger");

const logMeta = {
    file: 'controller/prebuild/cleanup'
};

const cleanup = (policy, context) => {
    const workFolder = context.scanInstance.workFolder;
    const filesToClean = [
        Policy.configs.CLIENT.FILES_FOLDERS.CUSTOM_RULE_FILE,
        Policy.configs.CLIENT.FILES_FOLDERS.CUSTOM_PATH_MSG_FILE,
        Policy.configs.CLIENT.FILES_FOLDERS.MI_PACKAGE,
        Policy.configs.CLIENT.FILES_FOLDERS.UPLOAD_LIST_FILE,
        Policy.configs.CLIENT.FILES_FOLDERS.FILE_INFO,
        //clean up temp files
        Policy.configs.CLIENT.FILES_FOLDERS.COMPILE_COMMANDS,
        Policy.configs.CLIENT.FILES_FOLDERS.SOURCE_CODE,
        Policy.configs.CLIENT.FILES_FOLDERS.SOURCE_FILES,
    ];

    if (!context.projectInstance.config.houseKeeping[Policy.enums.CONFIGURATION.PROJECT.KEEP_LOCAL_TEMP_FILES]) {
        filesToClean.push(Policy.configs.CLIENT.FILES_FOLDERS.PREPROCESS_PACKAGE);
    }
    const deletedFileList = filesToClean.map(file => {
        return `${workFolder}/${file}`;
    });

    const subPhase = new SubPhase({
        name: 'CLEAN_UP',
        type: Policy.enums.SUB_PHASE_TYPES.UTILS,
        policy,
        run: async () => {
            if(global.debugMode) {
                logger.debug(`[Cleanup] Debug mode enabled, nothing will be cleaned...`, logMeta);
                return {
                    status: 0
                };
            }
            await glob(`${workFolder}/*.mi`, {}, (err, paths) => {
                if (err) {
                    logger.error(`Deleting custom mi files error: ${err}`, logMeta);
                    return;
                }
                paths.forEach(filePath => {
                    if (fs.pathExistsSync(filePath)) {
                        logger.info(`Deleting ${filePath} `, logMeta);
                        fs.unlinkSync(filePath);
                    }
                });
            });
            deletedFileList.forEach(deleteFilePath => {
                if (fs.pathExistsSync(deleteFilePath)) {
                    logger.info(`Deleting ${deleteFilePath} `, logMeta);
                    fs.unlinkSync(deleteFilePath);
                }
            });

            return {
                status: 0,
            };
        },
        finish() {
            subPhase.summary = {
                cleanedFiles: deletedFileList
            }
        },
        context
    });

    return subPhase;
}

module.exports = cleanup;

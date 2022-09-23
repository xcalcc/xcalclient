const enums = require('../data/enums');
module.exports = {
    [enums.CONFIGURATION.PROJECT.CONFIG_ID]: "", // represents its id in db
    [enums.CONFIGURATION.PROJECT.PROJECT_ID]: "",
    [enums.CONFIGURATION.PROJECT.PROJECT_NAME]: "",
    [enums.CONFIGURATION.PROJECT.PROJECT_PATH]: "",
    [enums.CONFIGURATION.PROJECT.BUILD_PATH]: "",
    [enums.CONFIGURATION.PROJECT.UPLOAD_SOURCE]: true,
    [enums.CONFIGURATION.PROJECT.SCAN_CONFIG]: {},
    [enums.CONFIGURATION.PROJECT.REPO_ACTION]: "",
    [enums.CONFIGURATION.PROJECT.HOUSE_KEEPING]: {
        [enums.CONFIGURATION.PROJECT.MAX_TASK_FOLDERS]: 3,
        [enums.CONFIGURATION.PROJECT.KEEP_LOCAL_TEMP_FILES]: false, // if keep the preprocess files
    },
    [enums.CONFIGURATION.PROJECT.DSR]: {
        [enums.CONFIGURATION.PROJECT.REPO_PATH]: "",
        [enums.CONFIGURATION.PROJECT.REPO_BRANCH]: "",
        [enums.CONFIGURATION.PROJECT.MAX_GIT_COMMIT]: 10,
        [enums.CONFIGURATION.PROJECT.NEED_DSR]: false,
        [enums.CONFIGURATION.PROJECT.GIT_FOLDER_TOLERANCE]: false
    },
    // [enums.CONFIGURATION.PROJECT.TASK_FOLDER]: '' // dont show in default
}

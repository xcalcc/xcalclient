module.exports = {
    JS_MAX_TIMING_POLICY: Math.pow(2, 31) - 2,
    EXIT_CODES: {
        "OK": 0,
        "GENERAL_ERROR": 1,
        "MISUSE_OF_SHELL": 2,
        "CANNOT_EXECUTE": 126,
        "COMMAND_NOT_FOUND": 127,
        "INVALID_ARGUMENT_TO_EXIT": 128,
        "CTRL_C_FATAL": 130,
        "EXIT_STATUS_OUT_OF_RANGE": 255,
        "CUSTOM": {
            "BUILD_SUCCESS_WITHOUT_I_FILE": 4,
            "BUILD_FAIL": 5,
            "NO_SCAN_RECORD": 10,
            "SAME_SOURCE_CODE": 11,
            "SAME_COMMIT_ID": 12,
        }
    },
    CONFIGURATION: {
        "PROJECT": {
            "CONFIG_ID": "configId",
            "PROJECT_ID": "projectId",
            "PROJECT_NAME": "projectName",
            "PROJECT_PATH": "projectPath",
            "BUILD_PATH": "buildPath",
            "UPLOAD_SOURCE": "uploadSource",
            "SCAN_CONFIG": "scanConfig",
            "HOUSE_KEEPING": "houseKeeping",
            "MAX_TASK_FOLDERS": "maxTaskFolders",
            "DSR": "dsr",
            "REPO_PATH": "repoPath",
            "REPO_BRANCH": "repoBranch",
            "MAX_GIT_COMMIT": "maxGetCommit",
            "NEED_DSR": "needDsr",
            "GIT_FOLDER_TOLERANCE": "gitFolderTolerance",
            "TASK_FOLDER": "taskFolder",
            "REPO_ACTION": "repoAction",
            "KEEP_LOCAL_TEMP_FILES": "keepLocalTempFiles",
        },
        "SCAN": {
            "SCAN_MEM_LIMIT": "scanMemLimit",
            "PROCESS_LINK_USING_COMPILER": "processLinkUsingCompiler",
            "LANG": "lang",
            "BUILD": "build",
            "SCAN_MODE": "scanMode",
            "FILE_WHITELIST_CMD": "fileWhitelistCmd",
            "FILE_BLACKLIST_CMD": "fileBlacklistCmd",
            "RULE_WHITELIST": "ruleWhitelist",
            "FILE_BLACKLIST": "fileBlacklist",
            "PARALLEL_JOBS": "parallelJobs",
            "SUPPRESS_RULES_LIST_FILE": "suppressRulesListFile",
        }
    },
    STATUS: {
        FAILED: 'FAILED',
        ABORTED: 'ABORTED',
        SUCCESS: 'SUCCESS',
        PENDING: 'PENDING',
        PROCESSING: 'PROCESSING',
    },
    STATE: {
        CLIENT_START: 'CLIENT_START',

        // SP_SETUP_NOERR: 0,
        // SP_SETUP_INT: 0,
        // SP_SETUP_CONFIG: 0,
        // SP_SETUP_FINI: 0,
        // SP_PRE_NOERR: 0,
        // SP_PRE_SCM: 0,
        // SP_PRE_BLD_COLLECT: 0,
        // SP_PRE_BLD_RES: 0,
        // SP_PRE_FINI: 0,

        CLIENT_FINI: 'AGENT_END'
    },
    REPO_ACTION: {
        CD: 'CD',
        CI: 'CI',
        TRIAL: 'TRIAL',
    },
    CICDFSM_STATE: {
        START: "START",
        TRIAL_SCAN: "TRIAL_SCAN_DONE",
        CLEAN_SCAN_DONE: "CLEAN_SCAN_DONE",
        CI_DSR_SCAN_DONE: "CI_DSR_SCAN_DONE", //dev
        CD_DSR_SCAN_DONE: "CD_DSR_SCAN_DONE", //release
    },
    STAGE: {
        PHASE: {
            SETUP: 0,
            PREPROC: 1,
        },
        SUB_PHASE: {
            PRE_PREPARE_SRC: 0,
            PRE_GET_SRC: 1,
            PRE_BUILD: 2,
            PRE_UPLOAD_FILE: 3,
        }
    },
    EVENTS: {
        COMMAND_ON_STDOUT: 'command-stdout',
        COMMAND_ON_STDERR: 'command-stderr',
        COMMAND_ON_EXIT: 'command-exit',
        COMMAND_ON_ERROR: 'command-error',
        COMMAND_ON_CLOSED: 'command-closed',
    },
    SUB_PHASE_TYPES: {
        HTTP: 'HTTP',
        COMMAND: 'COMMAND',
        UTILS: 'UTILS'
    },

}
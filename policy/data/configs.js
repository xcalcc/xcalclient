module.exports = {
    CLIENT: {
        ENTRIES: {
            V: 'vscode',
            E: 'eclipse',
            J: 'jenkins',
            C: 'commandLine',
        },
        MAX_SOURCE_FILE_SIZE: 5 * 1024 * 1024 * 1024, //in bytes 4 GB
        MAX_BUFFER_FOR_SPAWN_SYNC: 500 * 1024 * 1024, //in bytes 500M
        DEFAULT_MAX_TASK_FOLDERS: 10, //default value for how many work folders keep locally for a particular project
        SCAN_MODE:  {
            SINGLE: '-single',
            CROSS: '-cross',
            SINGLE_XSCA: '-single-xsca',
            XSCA: '-xsca',
        },
        FILES_FOLDERS: {
            // CLIENT_CONFIG_PATH: path.resolve(process.env.HOME, './.xcalsetting'),
            CLIENT_CONFIG_FILE: '.xcalsetting',
            TASK_RECORD_FILE_NAME: 'task_records.json',
            CANCEL_RECORD_FILE_NAME: 'cancel_records.json',
            SECRET_KEY_FILE: 'key',
            SECRET_IV_FILE: 'iv',
            // custom rules
            CUSTOM_RULE_FOLDER: '.xcalscan-rules',
            CUSTOM_RULE_FILE: 'rules.json',
            CUSTOM_PATH_MSG_FILE: 'path-msg.json',

            // output
            MI_PACKAGE: 'mi.tar.gz',
            STATE_FOLDER_NAME: '.xcalscan',
            STATE_FILE: 'state.json',
            SCAN_CONFIG_FILE: 'xcalscan.conf',

            // files to upload
            UPLOAD_LIST_FILE: 'uploadlist.json',
            FILE_INFO: 'fileinfo.json',
            PREPROCESS_PACKAGE: 'preprocess.tar.gz',

            // CLIENT_CONF_FILE: 'run.conf',
            // USER_CONF_FILE: 'user.conf',

            // xcalbuild generated crap
            COMPILE_COMMANDS: 'compile_commands.json',
            SOURCE_CODE: 'source_code.zip',
            SOURCE_FILES: 'source_files.json',

            // executables //todo, change name to /bin
            EXECUTABLE_FOLDER: './executable',
            EXECUTABLE_UPLOADER: './uploadfile',
            EXECUTABLE_PACKAGER: './packager',
            EXECUTABLE_PREBUILD: './buildtask',
            EXECUTABLE_SCM: './scmSubPhase',
            EXECUTABLE_BUILD: './xcalbuild/bin/xcalbuild',

            // scm
            SCM_COMMIT_INFO_FILE: './commit_id.txt',

            // log file
            LOG_FILE_NAME: 'client-logs',
            LOGFILE_TRANSPORT_KEY: 'FileLog'
        },

        ENABLE_CUSTOM_RULE_UPLOAD: false,
        ENABLE_CICD_CONTROL: true,
        ENABLE_DSR: true,
        PRINT_VERSION_AT_START: false,
    },
}
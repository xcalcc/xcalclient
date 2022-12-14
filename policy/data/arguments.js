module.exports = {
    TRIGGER:{
        SOURCE_CODE_PATH: {
            arg: 's',
            prefix: '-',
            type: 'string',
            description: 'Source code absolute path',
            consumer: 'trigger',
            default: null,
            required: false,
            internal: false,
            remark: '',
            example: '-s "/a/b/c"',
            owner: 'PM',
        },
        PROJECT_CONFIG_PATH: {
            arg: 'c',
            prefix: '-',
            type: 'string',
            description: 'Project config path',
            consumer: 'trigger',
            default: null,
            required: false,
            internal: false,
            remark: '',
            example: '-c "/a/b/c/xcalclient.conf"',
            owner: 'PM',
        },
        CLIENT_TIMEOUT: {
            arg: 'client-timeout',
            prefix: '--',
            type: 'string',
            description: 'How long to wait for client in seconds',
            consumer: 'trigger',
            default: 0,
            required: false,
            internal: false,
            remark: '',
            example: '--client-timeout 10000',
            owner: 'PM',
        },
        LISTEN_TIMEOUT: {
            arg: 'listen-timeout',
            prefix: '--',
            type: 'string',
            description: 'How long to wait for notification service event',
            consumer: 'trigger',
            default: 0,
            required: false,
            internal: false,
            remark: '',
            example: '--listen-timeout 10000',
            owner: 'PM',
        },
        USERNAME: {
            arg: 'u',
            prefix: '-',
            type: 'string',
            description: 'scan service authentication user name',
            consumer: 'trigger',
            default: null,
            required: true,
            internal: false,
            remark: '',
            example: '-u xcaluser',
            owner: 'PM',
        },
        PASSWORD: {
            arg: 'p',
            prefix: '-',
            type: 'string',
            description: 'scan service authentication password',
            consumer: 'trigger',
            default: null,
            required: true,
            internal: false,
            remark: '',
            example: '-p xcaluser123',
            owner: 'PM',
        },
        CANCEL: {
            arg: 'cancel',
            prefix: '--',
            type: 'boolean',
            description: 'cancel scan action',
            consumer: 'trigger',
            default: null,
            required: false,
            internal: false,
            example: '--cancel',
            remark: 'Default client will try to cancel last scan which is in process',
            owner: 'R&D',
        },
        DEBUG: {
            arg: 'debug',
            prefix: '--',
            type: 'boolean',
            description: 'Verbose mode',
            consumer: 'trigger',
            default: null,
            required: false,
            internal: true,
            example: '--debug',
            remark: '',
            owner: 'R&D',
        },
    },
    CLIENT: {
        "API_SERVER": {
            arg: 'h',
            prefix: '-',
            type: 'string',
            description: 'Scan server URL',
            consumer: 'utility',
            default: null,
            required: true,
            internal: false,
            example: '-h "http://scan-service"',
            remark: '',
            owner: 'PM',
        },
        "API_PORT": {
            arg: 'p',
            prefix: '-',
            type: 'decimal',
            description: 'Scan server port',
            consumer: 'utility',
            default: null,
            required: true,
            internal: false,
            example: '-p 80',
            remark: '',
            owner: 'PM',
        },
        "SCAN_MODE": {
            arg: 'm',
            prefix: '-',
            type: 'string',
            description: 'Scan mode',
            consumer: 'controller',
            default: 'single',
            required: true,
            internal: false,
            example: '-m cross',
            remark: '',
            owner: 'PM',
        },
        "SCAN_CONFIG_PATH": {
            arg: 'c',
            prefix: '-',
            type: 'string',
            description: 'Scan config path',
            consumer: 'controller',
            default: null,
            required: true,
            internal: false,
            example: '-c "a/b/c/xcalscan.conf"',
            remark: '',
            owner: 'PM',
        },
        "SOURCE_CODE_PATH": {
            arg: 's',
            prefix: '-',
            type: 'string',
            description: 'Source code path',
            consumer: 'controller',
            default: null,
            required: true,
            internal: false,
            example: '-s "a/b/c"',
            remark: '',
            owner: 'PM',
        },
        "USER": {
            arg: 'u',
            prefix: '-',
            type: 'string',
            description: 'User name login to scan server',
            consumer: 'controller',
            default: null,
            required: true,
            internal: false,
            example: '-u xcaluser',
            remark: '',
            owner: 'PM',
        },
        "PASSWORD": {
            arg: 'psw',
            prefix: '--',
            type: 'string',
            description: 'User password login to scan server',
            consumer: 'controller',
            default: null,
            required: true,
            internal: false,
            example: '--psw xcaluser123',
            remark: '',
            owner: 'PM',
        },
        "TOKEN": {
            arg: 'token',
            prefix: '--',
            type: 'string',
            description: 'pass token directly for scanning',
            consumer: 'controller',
            default: null,
            required: true,
            internal: false,
            example: '--token {jwt token}',
            remark: 'if token assigned in argument, username/password will be ignored',
            owner: 'PM',
        },
        "FILE_SERVICE_PORT": {
            arg: 'fsp',
            prefix: '--',
            type: 'boolean',
            description: 'Port for file uploading service',
            consumer: 'uploader',
            default: null,
            required: true,
            internal: false,
            example: '--fsp 9000',
            remark: '',
            owner: 'R&D',
        },
        "CREATE_NEW": {
            arg: 'new',
            prefix: '--',
            type: 'boolean',
            description: 'If create a new project',
            consumer: 'controller',
            default: null,
            required: false,
            internal: false,
            example: '--new',
            remark: '',
            owner: 'PM',
        },
        "PROJECT_NAME": {
            arg: 'project-name',
            prefix: '--',
            type: 'string',
            description: 'Project name',
            consumer: 'controller',
            default: null,
            required: false,
            internal: false,
            example: '--project-name "testProject"',
            remark: '',
            owner: 'PM',
        },
        "PROJECT_ID": {
            arg: 'project-id',
            prefix: '--',
            type: 'string',
            description: 'Project Id',
            consumer: 'controller',
            default: null,
            required: false,
            internal: false,
            example: '--project-id "testProject123456"',
            remark: '',
            owner: 'PM',
        },
        "REPO_PATH": {
            arg: 'repo-path',
            prefix: '--',
            type: 'string',
            description: 'Path of your source code contains .git folder',
            consumer: 'scm',
            default: null,
            required: false,
            internal: false,
            example: '--repo-path "/a/b/c"',
            remark: '',
            owner: 'PM',
        },
        "REPO_BRANCH": {
            arg: 'repo-branch',
            prefix: '--',
            type: 'string',
            description: 'scm branch name',
            consumer: 'scm',
            default: null,
            required: false,
            internal: false,
            example: '--repo-branch dev',
            remark: '',
            owner: 'PM',
        },
        "DELTA_RESULT": {
            arg: 'delta-result',
            prefix: '--',
            type: 'string',
            description: 'Show delta scan result instead of full scan',
            consumer: 'scm',
            default: null,
            required: false,
            internal: false,
            example: '--delta-result',
            remark: '',
            owner: 'PM',
        },
        "MAX_GET_COMMIT": {
            arg: 'max-get-commit',
            prefix: '--',
            type: 'string',
            description: 'Back trace counts until the baseline commit id found',
            consumer: 'scm',
            default: 10,
            required: false,
            internal: false,
            example: '--max-get-commit 20',
            remark: '',
            owner: 'PM',
        },
        "LOCALE": {
            arg: 'locale',
            prefix: '--',
            type: 'string',
            description: 'Showing other locale error messages',
            consumer: 'scm',
            default: 'en',
            required: false,
            internal: true,
            example: '--locale cn',
            remark: '',
            owner: 'R&D',
        },
        "REPORT": {
            arg: 'report',
            prefix: '--',
            type: 'string',
            description: 'Generate report for a particular scan',
            consumer: 'controller',
            default: null,
            required: false,
            internal: true,
            example: '--report',
            remark: '',
            owner: 'R&D',
        },
        "CALL_FROM": {
            arg: 'call-from',
            prefix: '--',
            type: 'string',
            description: 'A tag states where Xcalclient is called from',
            consumer: 'controller',
            default: null,
            required: false,
            internal: true,
            example: '--call-from "jenkins"',
            remark: '',
            owner: 'R&D',
        },
        "DEBUG": {
            arg: 'debug',
            prefix: '--',
            type: 'boolean',
            description: 'Verbose log',
            consumer: 'controller',
            default: null,
            required: false,
            internal: true,
            example: '--debug',
            remark: '',
            owner: 'R&D',
        },
        "HELP": {
            arg: 'help',
            prefix: '--',
            type: 'boolean',
            description: 'Show help information',
            consumer: 'controller',
            default: null,
            required: false,
            internal: false,
            example: '--help',
            remark: '',
            owner: 'R&D'
        },
        "DEV_MODE": {
            arg: 'dev',
            prefix: '--',
            type: 'boolean',
            description: 'dev mode for some internal functions',
            consumer: 'utility',
            default: null,
            required: false,
            internal: true,
            example: '--dev',
            remark: '',
            owner: 'R&D'
        },
        "BUILD_PATH": {
            arg: 'build-path',
            prefix: '--',
            type: 'string',
            description: 'where project should build to',
            consumer: 'utility',
            default: null,
            required: false,
            internal: false,
            example: '--build-path "/a/b/c"',
            remark: '',
            owner: 'R&D'
        },
        "TASK_FOLDER": {
            arg: 'task-folder',
            prefix: '--',
            type: 'string',
            description: 'assign a custom folder to save scan task temp files',
            consumer: 'utility',
            default: null,
            required: false,
            internal: false,
            example: '--task-folder "/a/b/c"',
            remark: '',
            owner: 'R&D'
        },
        "VERSION_SHORT": {
            arg: 'v',
            prefix: '-',
            type: 'boolean',
            description: 'show version',
            consumer: 'utility',
            default: null,
            required: false,
            internal: false,
            example: '-v',
            remark: '',
            owner: 'R&D'
        },
        "VERSION": {
            arg: 'version',
            prefix: '--',
            type: 'boolean',
            description: 'show version',
            consumer: 'utility',
            default: null,
            required: false,
            internal: false,
            example: '-v',
            remark: '',
            owner: 'R&D'
        },
        "REPO_ACTION": {
            "arg": "repo-action",
            "prefix": "--",
            "type": "string",
            "description": "A tag states what git action triggered this scan",
            "consumer": "controller",
            "default": null,
            "required": false,
            "internal": false,
            "example": "--repo-action \"CD\"",
            "remark": "",
            "owner": "R&D"
        },
        BUILD_INFO: {
            arg: 'build-info',
            prefix: '--',
            type: 'string',
            description: 'pass extra jenkins build info',
            consumer: 'trigger',
            default: null,
            required: false,
            internal: false,
            example: '--build-info "#123"',
            remark: 'Default client will try to cancel last scan which is in process',
            owner: 'R&D',
        },
    },
    SUBPHASE: {
        "SCM": {
            "OUTPUT_FOLDER": {
                arg: 'op',
                prefix: '-',
                type: 'string',
                description: 'scm output path',
                consumer: 'scm',
                default: null,
                required: true,
                internal: true,
                example: '--dev',
                remark: '',
            },
            "API_SERVER": {
                arg: 'api',
                prefix: '-',
                type: 'string',
                description: 'api server',
                consumer: 'scm',
                default: null,
                required: true,
                internal: true,
                example: '-api "http://api.com:999"',
                remark: '',
            },
            "PROJECT_ID": {
                arg: 'pid',
                prefix: '-',
                type: 'string',
                description: 'project id (uuid) to lookup for baseline',
                consumer: 'scm',
                default: null,
                required: true,
                internal: true,
                example: '-pid abcd-xcasd-zxcz-sss',
                remark: '',
            },
            "TOKEN": {
                arg: 'token',
                prefix: '-',
                type: 'string',
                description: 'jwt token, expired in 24 hrs',
                consumer: 'scm',
                default: null,
                required: true,
                internal: true,
                example: '-token "Bearer asdadadasdadadasdadas211asdaa"',
                remark: '',
            },
            "BACK_TRACK": {
                arg: 'bt',
                prefix: '-',
                type: 'string',
                description: 'back track, look back steps until commit id matches baseline id',
                consumer: 'scm',
                default: null,
                required: false,
                internal: true,
                example: '-bt 12',
                remark: '',
            },
            "REPO_PATH": {
                arg: 'rp',
                prefix: '-',
                type: 'string',
                description: 'repo path, project folder with .git folder',
                consumer: 'scm',
                default: null,
                required: true,
                internal: true,
                example: '-rp "/a/b/c"',
                remark: '',
            },
            "REPO_BRANCH": {
                arg: 'rb',
                prefix: '-',
                type: 'string',
                description: 'repo branch',
                consumer: 'scm',
                default: null,
                required: true,
                internal: true,
                example: '-rb dev',
                remark: '',
            },
            "DELTA_RESULT": {
                arg: 'dr',
                prefix: '-',
                type: 'string',
                description: 'Delta result for partial scan',
                consumer: 'scm',
                default: null,
                required: false,
                internal: true,
                example: '-dr',
                remark: '',
            },
            "GIT_FOLDER_TOLERANCE": {
                arg: 'git-folder-tolerance',
                prefix: '--',
                type: 'boolean',
                description: 'Allowing .git folder in parent folder or not',
                consumer: 'scm',
                default: false,
                required: false,
                internal: true,
                example: '--git-folder-tolerance',
                remark: '',
            },
            "COMMIT_ID": {
                arg: 'commit-id',
                prefix: '--',
                type: 'string',
                description: 'Commit ID carried over from CICD FSM, if this passed in, no need to do extra git action for fetching commit id',
                consumer: 'scm',
                default: null,
                required: false,
                internal: false,
                example: '--commit-id abc',
                remark: 'Need validation of baseline commit id in git commit tree',
            },
            "BASELINE_COMMIT_ID": {
                arg: 'baseline-commit-id',
                prefix: '--',
                type: 'string',
                description: 'Baseline commit ID carried over from CICD FSM, if this passed in, no need to do extra git action for API calling fro baseline commit id',
                consumer: 'scm',
                default: null,
                required: false,
                internal: false,
                example: '--baseline-commit-id abcd',
                remark: 'Need validation of baseline commit id in git commit tree',
            }
        },
        "UPLOAD": {
            "SCAN_CONFIG_PATH": {
                arg: 'pc',
                prefix: '-',
                type: 'string',
                description: '',
                consumer: 'upload',
                default: null,
                required: true,
                internal: true,
                example: '-pc "a/b/c/abc.conf"',
                remark: '',
            },
            "FILE_SERVICE_URL": {
                arg: 'url',
                prefix: '-',
                type: 'string',
                description: '',
                consumer: 'scm',
                default: null,
                required: true,
                internal: true,
                example: '-url "http://fs.example"',
                remark: '',
            },
            "WORK_DIRECTORY": {
                arg: 'fd',
                prefix: '-',
                type: 'string',
                description: 'file directory to upload',
                consumer: 'scm',
                default: null,
                required: true,
                internal: true,
                example: '-fd "a/b/c/files"',
                remark: '',
            },
            "FILE_PATH": {
                arg: 'fp',
                prefix: '-',
                type: 'string',
                description: 'file to upload',
                consumer: 'scm',
                default: null,
                required: true,
                internal: true,
                example: '-fp "a/b/c/file.example"',
                remark: '',
            },
            "DEBUG": {
                arg: 'd',
                prefix: '-',
                type: 'boolean',
                description: 'file to upload',
                consumer: 'scm',
                default: null,
                required: false,
                internal: true,
                example: '-d',
                remark: '',
            }
        },
        "PREBUILD": {
            "SCAN_CONFIG_PATH": {
                arg: 'pc',
                prefix: '-',
                type: 'string',
                description: 'scan config path, where xcalscan.conf persists',
                consumer: 'prebuild',
                default: null,
                required: true,
                internal: true,
                example: '-pc "a/b/c/abc.conf"',
                remark: '',
            },
            "XCALBUILD_PATH": {
                arg: 'xp',
                prefix: '-',
                type: 'string',
                description: 'xcalbuilder binary path',
                consumer: 'prebuild',
                default: null,
                required: true,
                internal: true,
                example: '-xp "a/b/c/bin/xcalbiuild"',
                remark: '',
            },
            "OUTPUT_PATH": {
                arg: 'op',
                prefix: '-',
                type: 'string',
                description: 'file output path',
                consumer: 'prebuild',
                default: null,
                required: true,
                internal: true,
                example: '-op "a/b/c"',
                remark: '',
            },
            "FILE_WHITELIST_CMD": {
                arg: 'fwl',
                prefix: '--',
                type: 'string',
                description: 'File whitelist command pass to xcalbuild',
                consumer: 'xcalbuild',
                default: null,
                required: false,
                internal: true,
                example: '--fwl "find -name *.c | xargs grep -l -E -ri \'allwinner|sunxi\'"',
                remark: '',
            },
            "FILE_BLACKLIST_CMD": {
                arg: 'fbl',
                prefix: '--',
                type: 'string',
                description: 'File blacklist command pass to xcalbuild',
                consumer: 'xcalbuild',
                default: null,
                required: false,
                internal: true,
                example: '--fbl "find -name *.c | xargs grep -l -E -ri \'allwinner|sunxi\'"',
                remark: '',
            },
            "SCAN_ALL": {
                arg: 'scan-all',
                prefix: '--',
                type: 'boolean',
                description: 'Do full build other than partial build',
                consumer: 'xcalbuild',
                default: null,
                required: false,
                internal: true,
                example: '--scan-all',
                remark: '',
            },
            "PROCESS_LINK_USING_COMPILER": {
                arg: 'process-link-using-compiler',
                prefix: '--',
                type: 'boolean',
                description: `process source code file whose target file is linked through use of compiler command, default is true.
source code file whose target file is linked through use of linker command such as ld will be processed directly by xcalbuild.`,
                consumer: 'xcalbuild',
                default: true,
                required: false,
                internal: true,
                example: '--process-link-using-compiler',
                remark: '',
            },
            "DEBUG": {
                arg: 'd',
                prefix: '-',
                type: 'boolean',
                description: 'enable debug mode',
                consumer: 'prebuild',
                default: null,
                required: false,
                internal: true,
                example: '-d',
                remark: '',
            },
            "LOCAL_LOG": {
                arg: 'local_log',
                prefix: '--',
                type: 'boolean',
                description: 'enable debug mode',
                consumer: 'prebuild',
                default: null,
                required: false,
                internal: true,
                example: '-d',
                remark: '',
            },
            "SUPPRESS_RULES_LIST_FILE": {
                arg: 'suppress-rules-list-file',
                prefix: '--',
                type: 'string',
                description: 'Suppress any scan result that is attributed to rules appear in the list. This file is only used by the cppcheck plugin, not used by the Xcalibyte scan engine.',
                consumer: 'prebuild',
                default: null,
                required: false,
                internal: true,
                example: '--suppression-rules-list-file /a/b/c.txt',
                remark: '',
            }
        },
        "PACKAGING": {
            "SCAN_CONFIG_PATH": {
                arg: 'pc',
                prefix: '-',
                type: 'string',
                description: 'scan config path, where xcalscan.conf persists',
                consumer: 'packaging',
                default: null,
                required: true,
                internal: true,
                example: '-pc "a/b/c/abc.conf"',
                remark: '',
            },
            "OUTPUT_PATH": {
                arg: 'op',
                prefix: '-',
                type: 'string',
                description: 'file output path',
                consumer: 'packaging',
                default: null,
                required: true,
                internal: true,
                example: '-op "a/b/c"',
                remark: '',
            },
            "DEBUG": {
                arg: 'd',
                prefix: '-',
                type: 'boolean',
                description: 'enable debug mode',
                consumer: 'packaging',
                default: null,
                required: false,
                internal: true,
                example: '-d',
                remark: '',
            }
        }
    }
}
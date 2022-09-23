//N.B. timeout should be limited to 32-bit int which is smaller than 2147483647
module.exports = {
    PHASE: {
        'SETUP': {
            TIMEOUT: 3 * 60 * 60 * 1000 * 2,
            NAME: 'SETUP',
            SUB_PHASE: {
                'SYNC_CUSTOM_RULE_INFO': {
                    MANDATORY: false,
                    NAME: 'SYNC_CUSTOM_RULE_INFO',
                    RETRY: 1,
                    TIMEOUT: 60 * 10 * 1000,
                    NEXT: 'SYNC_CUSTOM_RULE_MI'
                },
                'SYNC_CUSTOM_RULE_MI': {
                    MANDATORY: false,
                    NAME: 'SYNC_CUSTOM_RULE_MI',
                    RETRY: 1,
                    TIMEOUT:  60 * 10 * 1000,
                    NEXT: 'SCM_CODE_DIFF'
                },
                'SCM_CODE_DIFF': {
                    MANDATORY: false,
                    NAME: 'SCM_CODE_DIFF',
                    RETRY: 1,
                    TIMEOUT:  60 * 10 * 1000,
                    NEXT: 'PREBUILD'
                }
            }

        },
        'PREPROC': {
            TIMEOUT: 3 * 60 * 60 * 1000 * 2,
            NAME: 'PREPROC',
            SUB_PHASE: {
                'PREBUILD': {
                    NAME: 'PREBUILD',
                    MANDATORY: true,
                    RETRY: 0,
                    TIMEOUT: 4 * 60 * 60 * 1000,
                    NEXT: 'PACKAGING',
                },
                'PACKAGING': {
                    NAME: 'PACKAGING',
                    MANDATORY: true,
                    RETRY: 0,
                    TIMEOUT: 60 * 60 * 1000,
                    NEXT: 'CREATE_SCAN_TASK'
                },
                'CREATE_SCAN_TASK': {
                    NAME: 'CREATE_SCAN_TASK',
                    MANDATORY: true,
                    RETRY: 3,
                    TIMEOUT: 60 * 60 * 1000,
                    NEXT: 'UPLOAD'
                },
                'UPLOAD': {
                    NAME: 'UPLOAD',
                    MANDATORY: true,
                    RETRY: 0,
                    TIMEOUT: 60 * 60 * 1000,
                    NEXT: 'SUBMIT_SCAN_TASK',
                    OTHERS: {
                        MAX_SOURCE_FILE_SIZE: 5 * 1024 * 1024 * 1024 //in bytes 4 GB
                    }
                },
                'SUBMIT_SCAN_TASK': {
                    NAME: 'SUBMIT_SCAN_TASK',
                    MANDATORY: true,
                    RETRY: 3,
                    TIMEOUT: 60 * 60 * 1000,
                    NEXT: 'CLEAN_UP'
                },
                'CLEAN_UP': {
                    NAME: 'CLEAN_UP',
                    MANDATORY: false,
                    RETRY: 0,
                    TIMEOUT: 60 * 60 * 1000,
                    NEXT: null
                }
            }
        },
    }
};

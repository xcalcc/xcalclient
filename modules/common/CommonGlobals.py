#
#  Copyright (C) 2021 Xcalibyte (Shenzhen) Limited.
#


import logging
from enum import Enum

log_level = logging.NOTSET
dir_stack = []  # Mutable Directory Stack

# jaeger related
jaeger_agent_host = None
jaeger_agent_port = None
use_jaeger = True
old_tracer = None  # Set for initializing a fake tracer as an in-mem one first
tracer = None  # Tracer, initially as none
jaeger_service_name = "default-service"
enable_memory_cache = False

# common file name constant variable which will be used by both agent and scan service
SOURCE_CODE_ARCHIVE_FILE_NAME = "source_code.zip"
FILE_INFO_FILE_NAME = "fileinfo.json"
PREPROCESS_FILE_NAME = "preprocess.tar.gz"
VCS_DIFF_RESULT_FILE_NAME = "scm_diff.txt"
SOURCE_FILES_NAME = "source_files.json"
COMMIT_FILE_NAME = 'commit_id.txt'

# common constant variable which will be used by both agent and scan service
OFFLINE_AGENT_TYPE = "offline_agent"
AGENT_SOURCE_STORAGE = 'agent'
GERRIT_SOURCE_STORAGE = 'gerrit'
BASE_SCAN_PATH = "/share/scan/"


GIT_METADATA_FILE_NAME = ".git"     # git metadata directory

ERROR_CODE_VISIBLE = 0x80000000



#
# This should be generated from the error code description excel / database.
#
# Generation Algorithm:
# user visible: 1bit, what: 16bit, which : 3bit, where: 3 bit, who: 3 bit
# error code: ((user visible << 31) | (what << 16) | (which << 8) | (where << 3) | who)
#
class TaskErrorNo(Enum):
    SUCCESS = 0x00030338
    E_PARAMETERS = 0x00040310
    E_JOB_TYPE_UNKNOWN = 0x80050311
    E_SUBPROCESS_FAIL = 0x80060112
    E_COLLECT_TAR_FAILED = 0x00070310
    E_UPLOAD_PREPROCESS_TAR_FAILED = 0x00080310
    E_REPORT_RESULT_FAILED = 0x00090310
    E_API_INVOKE_FAIL = 0x000A0310
    E_XCALBUILD_NOT_FOUND = 0x800B0013
    E_CMD_RETURN_NONZERO = 0x000C0310
    E_JOB_TYPE_NONE = 0x800D0311
    E_XCALBUILD_FAIL = 0x800E0013
    E_JAVA_SCAN_FAIL = 0x000F0310
    E_FILE_INFO_PJ_NULL = 0x80100112
    E_FILE_INFO_GATHER_FAIL = 0x80110311
    E_PLUGIN_RETURN_NONZERO = 0x80120311
    E_PLUGIN_EXEC_ERR = 0x80130112
    E_PRESCAN_RESULT_DIR_NONEXIST = 0x80140112
    E_NO_VIABLE_MIDDLE_RESULT = 0x80150112
    E_NOT_FOUND_FILE = 0x80160112
    E_COMPRESS_FAIL = 0x80170112
    E_EXTRACT_UNKNOWN_FILEKIND = 0x80180311
    E_CONFIG_PARM_ERROR = 0x00190308
    E_CONFIG_SET_VALUE_WRONGKIND = 0x001A0310
    E_FILEUTIL_DIRSTACK = 0x801B0311
    E_FOLDER_PERMISSION_ERROR = 0x801C0013
    E_GIT_CLONE_FAILED = 0x801D010A
    E_FILEINFO_FOLDER_NONEXIST = 0x801E0112
    E_NO_I_FILE_GENERATED = 0x801F0311
    E_JAVA_PREPROCESS_NO_OUTPUT = 0x00200310
    E_JAVA_HOME_NOTVALID = 0x80210013
    E_JAVA_RT_JAR_NOT_READABLE = 0x80220013
    E_JOB_CONFIG_APPEND_FAIL = 0x80230112
    E_CHECK_CACHE_FILE_FAILED = 0x80240112
    E_CHECK_CACHE_NONE_FILEID = 0x80250112
    E_FILE_INFO_NO_UPLOADRESULTS = 0x80260112
    E_FILE_INFO_NO_FILEID = 0x80270112
    E_FOLDER_NOTEXIST = 0x80280112
    E_VARIABLE_MUST_HAVE_VALUE = 0x80290311
    E_SCAN_SERVICE_VERSION_MISMATCH = 0x802A0013
    E_FE_UTIL_DIR_NOTFOUND = 0x802B0013
    E_FE_UTIL_DIR_UNREADABLE = 0x802C0013
    E_FE_UTIL_LIB_NOTFOUND = 0x802D0013
    E_FE_UTIL_LIB_UNREADABLE = 0x802E0013
    E_FE_UTIL_JAR_NOTFOUND = 0x802F0013
    E_FE_UTIL_JAR_UNREADABLE = 0x80300013
    E_JDK_JAR_NOTFOUND = 0x80310013
    E_JDK_JAR_UNREADABLE = 0x80320013
    E_JFE_RETURN_NONZERO = 0x00330138
    E_RT_OBJ_NON_EXIST = 0x00340138
    E_RT_TAR_NOT_EXIST = 0x80350112
    E_CHECK_FILE_CACHED_NON_JSON = 0x80360112
    E_SCAN_CONN_RES_NOT_EXIST = 0x80370122
    E_FE_UTIL_CONN_NOTFOUND = 0x80380112
    E_FE_UTIL_CONN_UNREADABLE = 0x8039001B
    E_SCAN_CONN_RET_NONZERO = 0x803A0319
    E_CONNECTOR_NOTFOUND = 0x803B001B
    E_CONNECTOR_UNREADABLE = 0x803C001B
    E_POLL_TASK_FAILED = 0x803D0311
    E_UPLOAD_FILE_FAILED = 0x803E0311
    E_INVALID_JSON_FORMAT = 0x803F0311
    E_CHECK_FILE_CACHED_NET_FAIL = 0x80400311
    E_LOGIN_FAIL = 0x00410310
    E_LOGIN_RESPONSE_NON_JSON = 0x00420310
    E_SAVE_FILE_CACHED_NON_JSON = 0x80430311
    E_SAVE_FILE_CACHED_NET_FAIL = 0x80440112
    E_SAVE_FILE_CACHE_SERVER_FAIL = 0x80450311
    E_SAVE_FILE_ID_NOT_FOUND = 0x80460311
    E_JAVA_PRESCAN_PLUGIN_NOT_VIABLE = 0x80470013
    E_JAVA_PREPROCESS_RESULT_DIR_NOT_EXIST = 0x80480112
    E_COMMON_FOLDER_NONEXIST = 0x00490138
    E_COMMON_FOLDER_PERMISSION = 0x804A0112
    E_COMMON_TIMEOUT = 0x004B0138
    E_COMMON_FILE_NOT_EXIST = 0x804C0112
    E_COMMON_INVALID_CONTENT = 0x004D0000
    E_AGENT_CHECK_TYPE_NOT_SUPPORT = 0x804E0301
    E_SYS_DEPENDENCY_NOT_EXIST = 0x804F0003
    E_PY_DEPENDENCY_NOT_EXIST = 0x80500003
    E_PLUGIN_TYPE_NOT_SUPPORT = 0x80510003
    E_PLUGIN_INSTALLATION_FAILED = 0x80520003
    E_COMPONENT_MISSING = 0x80530003
    E_JAVA_HOME_NOT_FOUND = 0x80540003
    E_NO_SUFFICIENT_MEMORY = 0x80550003
    E_BEAR_INSTALLATION_FAILED = 0x80560102
    E_NO_AGENT_CONN_TIMEOUT = 0x8057000B
    E_SCAN_TIME_EXCEED = 0x00580318
    E_SCAN_UPLOAD_TIMEOUT = 0x00590318
    E_QUEUEING_EXPIRED = 0x805A011A
    E_SCAN_SERVICE_STAGE_TIMEOUT = 0x805B011A
    E_SOURCE_DIRECTORY_NOT_EXIST = 0x805C0013
    E_BUILD_MAIN_DIRECTORY_NOT_EXIST = 0x805D000B
    E_AGENT_NAME_INVALID = 0x805E000B
    E_JOB_QUEUE_NAME_INVALID = 0x805F000B
    E_NO_AGENT_TOKEN = 0x00600318
    E_JAVA_PARSE_USER_ENVOPT = 0x00610038
    E_UTIL_TAR_COMPRESS = 0x00620138
    E_UTIL_UNKNOWN_ARCHIVE_TYPE = 0x80630319
    E_UTIL_CONFOBJ_PARAM = 0x00640310
    E_UTIL_CONFOBJ_TOKEN = 0x00650310
    E_UTIL_CONFOBJ_USERCONTENT = 0x00660310
    E_UTIL_CONFOBJ_SCANID = 0x00670310
    E_UTIL_CONFOBJ_SCANFILE = 0x00680310
    E_UTIL_CONFOBJ_PREPROCPATH = 0x00690310
    E_UTIL_CONFOBJ_SET = 0x006A0310
    E_UTIL_EXPIRE_NONE_HOOKTYPE = 0x006B0338
    E_STAGE_NOT_RECOGNIZE = 0x006C0338
    E_UTIL_EXPIRE_UNKNOWN_LIST_NAME = 0x006D0338
    E_UTIL_EXPIRE_IGNORE_DURATION = 0x006E0338
    E_UTIL_ZIP_COMPRESS = 0x006F0338
    E_SCAN_JOB_FAILED = 0x00700318
    E_NO_PIPELINE = 0x8071011A
    E_PIPELINE_OFFSET = 0x8072011A
    E_SRV_JOBLISTEN_KAFKA_RECEIVE = 0x8073011A
    E_JOB_EXPIRE = 0x8074011A
    E_SRV_KAFKA_FAILED = 0x8075011A
    E_API_AGENT_PARAM_TARGET = 0x00760338
    E_SRV_AGENT_INVOKE_KEY_IN_CONFIG = 0x00770338
    E_SRV_AGENT_INVOKE_GITLAB = 0x00780310
    E_SRV_AGENT_SRC_ADDRESS = 0x00790310
    E_SRV_AGENT_NO_PREPROCESS_LOC = 0x007A0310
    E_SRV_AGENT_SSH_FAILED = 0x007B0338
    E_SRV_AGENT_SSH_PARAM = 0x007C0338
    E_SRV_FILE_SCP_SEND = 0x007D0338
    E_SRV_FILE_SCP_GET_FAIL = 0x007E0338
    E_SRV_GETPREPROC_NO_PRESCAN_RESULT = 0x807F011A
    E_SRV_AGENT_UNKNOWN = 0x80800319
    E_SRV_AGENT_CHECK_CACHE = 0x80810311
    E_SRV_XVSA_UNKNOWN_EXECTUTE_TYPE = 0x00820338
    E_SRV_FLATTEN_OVERSIZE = 0x8083011A
    E_SRV_FLATTEN_FID_INVALID = 0x80840319
    E_SRV_FLATTEN_PATH_FID_INVALID = 0x80850319
    E_UTIL_CACHE_NONE_PARAM = 0x00860338
    E_UTIL_CACHE_JSON_INVALID = 0x80870319
    E_SETTING_SET_PARM_ERROR = 0x00880338
    E_DOCKER_CONATINER_EXITNZERO = 0x80890319
    E_DOCKER_NOIMAGEFOUND = 0x808A011A
    E_DOCKER_API_ERROR = 0x808B011A
    E_SRV_XVSA_EXECUTE_FAIL = 0x808C011A
    E_SRV_XVSA_DOCKER_FAIL = 0x808D011A
    E_SRV_UPLOAD_NO_V_FILE = 0x808E011A
    E_SRV_UPLOAD_V_NOT_READABLE = 0x808F011A
    E_SRV_UPLOAD_FILEINFO_NEXIST = 0x8090011A
    E_SRV_UPLOAD_FILEINFO_NOT_READABLE = 0x8091011A
    E_SRV_UPLOAD_V_FILE_OVERSIZE = 0x80920023
    E_SRV_UPLOAD_FILEINFO_OVERSIZE = 0x80930122
    E_CONNECT_API_LIST_SETTING = 0x00940138
    E_CONNECT_API_UPLOAD_PROGRESS = 0x00950338
    E_GET_CURRENT_USER_INFO_FAILED = 0x00960113
    E_CREATE_PROJECT_FAILED = 0x80970111
    E_GET_PROJECT_CONFIG_FAILED = 0x80980111
    E_ADD_SCAN_TASK_FAILED = 0x00990111
    E_CALL_SCAN_SERVICE_FAILED = 0x809A0111
    E_KEY_NOT_FOUND = 0x809B0311
    E_NO_SCAN_RESULT = 0x809C0021
    E_API_VALIDATION_CONSTRAINTS_NOTBLANK = 0x00B40338
    E_API_VALIDATION_CONSTRAINTS_NOTNULL = 0x00B50338
    E_API_VALIDATION_CONSTRAINTS_PATTERN = 0x00B60338
    E_API_VALIDATION_CONSTRAINTS_EMAIL = 0x00B70338
    E_API_VALIDATION_CONSTRAINTS_SIZE = 0x00B80338
    E_API_VALIDATION_CONSTRAINTS_PORT = 0x00B90338
    E_API_VALIDATION_CONSTRAINTS_MIN = 0x00BA0338
    E_API_COMMON_COMMON_INTERNAL_ERROR = 0x80BB013A
    E_API_COMMON_COMMON_NOT_IMPLEMENT = 0x00BC0338
    E_API_COMMON_COMMON_INVALID_CONFIG = 0x80BD000B
    E_API_COMMON_COMMON_INVALID_STATUS = 0x00BE0338
    E_API_COMMON_DTO_CONVERT_PARAMETER_NOT_EXIST = 0x00BF0338
    E_API_COMMON_DTO_INVALID_CONTENT = 0x00C00138
    E_API_COMMON_MISSING_FILE = 0x00C10338
    E_API_EMAIL_COMMON_SENDMAIL = 0x80C2013A
    E_API_EMAIL_COMMON_UNASSIGNED_ISSUE = 0x80C3003B
    E_API_EMAIL_PREPARE_FAILED = 0x00C40338
    E_API_FILE_ADD_ALREADY_EXIST = 0x00C50338
    E_API_FILE_CHECKINTEGRITY_FAILED = 0x00C60338
    E_API_FILE_CHECKSUM_NOT_PARSABLE = 0x00C70338
    E_API_FILE_COMMON_FILEINFORMATION_ALREADY_EXIST = 0x00C80338
    E_API_FILE_COMMON_FILEINFORMATION_NOT_FOUND = 0x00C90338
    E_API_FILE_COMMON_INVALID_FORMAT = 0x00CA0038
    E_API_FILE_COMMON_INVALID_TYPE = 0x00CB0038
    E_API_FILE_COMMON_INVALID_VALUE = 0x00CC0038
    E_API_FILE_COMMON_INVALID_STORAGE_TYPE = 0x00CD0038
    E_API_FILE_COMMON_NOT_AVAILABLE = 0x00CE0038
    E_API_FILE_COMMON_NOT_FOUND = 0x00CF0038
    E_API_FILE_COMMON_OBTAIN_FAILED = 0x00D00000
    E_API_FILE_COMMON_CREATE_TEMP_FILE_FAILED = 0x00D10000
    E_API_FILE_COMPRESSFILE_COPYCODE_FAILED = 0x00D20000
    E_API_FILE_COMPRESSFILE_DECOMPRESS_FAILED = 0x80D3011A
    E_API_FILE_COMPRESSFILE_DELETE_EXISTING_FAILED = 0x00D40000
    E_API_FILE_COMPRESSFILE_FAILED = 0x00D50000
    E_API_FILE_COMPRESSFILE_FILE_NOT_GENERATED = 0x00D60000
    E_API_FILE_COMPRESSFILE_FILE_OR_DIRECTORY_NOT_FOUND = 0x00D70138
    E_API_FILE_GETFILESTORAGE_FAILED = 0x00D80000
    E_API_FILE_UPLOAD_FILE_FAILED = 0x80D90112
    E_API_FILE_IMPORT_FILE_FAILED = 0x80DA0112
    E_API_FILE_IMPORTFILEINFO_ROOT_NOT_FOUND = 0x00DB0138
    E_API_FILE_IMPORTFILEINFO_PARENT_NOT_FOUND = 0x00DC0138
    E_API_FILESTORAGE_ADD_ALREADY_EXIST = 0x00DD0038
    E_API_FILESTORAGE_COMMON_NOT_FOUND = 0x00DE0038
    E_API_GIT_COMMON_CLONE_FAILED = 0x80DF010A
    E_API_GIT_COMMON_COMMIT_NOT_FOUND = 0x80E0000B
    E_API_GIT_COMMON_GITLABERROR = 0x80E1000B
    E_API_GIT_COMMON_LAST_COMMITID_NOT_FOUND = 0x80E2000B
    E_API_GIT_COMMON_PROJECTID_NOT_BLANK = 0x80E3000B
    E_API_GIT_COMMON_PROJECTIDORPATH_NOT_BLANK = 0x80E4000B
    E_API_GIT_GETRAWFILE_FAILED = 0x80E5000B
    E_API_GIT_GETREPO_FAILED = 0x80E6010A
    E_API_GIT_GITHUBPROJECTURL_NOT_BLANK = 0x80E7000B
    E_API_ISSUE_COMMON_INVALID_SEVERITY = 0x00E80000
    E_API_ISSUE_COMMON_NOT_FOUND = 0x00E90038
    E_API_ISSUE_UPDATEISSUE_INVALID_ACTION = 0x00EA0000
    E_API_ISSUE_IMPORTISSUE_INVALID_FILE = 0x00EB0338
    E_API_LICENSE_COMMON_EXPIRED = 0x80EC003B
    E_API_LICENSE_COMMON_INVALID_LICENSE = 0x80ED013A
    E_API_LICENSE_COMMON_NOT_FOUND = 0x80EE013A
    E_API_LICENSE_UPDATE_PUBLIC_KEY_NOT_FOUND = 0x80EF013A
    E_API_LICENSE_UPDATE_ENCRYPT_AES_KEY_NOT_FOUND = 0x80F0013A
    E_API_PROJECT_COMMON_NOT_FOUND = 0x00F10038
    E_API_PROJECT_CREATE_ALREADY_EXIST = 0x80F2000B
    E_API_PROJECT_UPDATE_INCONSISTENT = 0x00F30020
    E_API_PROJECTCONFIG_CAN_NOT_UPDATE_IN_SCANNING = 0x80F4000B
    E_API_PROJECTCONFIG_COMMON_NOT_FOUND = 0x80F5000B
    E_API_PROJECTCONFIG_CREATE_ALREADY_EXIST = 0x80F6000B
    E_API_PROJECTCONFIG_NOT_EXIST = 0x00F70038
    E_API_PERFORMANCE_QUERY_DATA_FAILED = 0x00F80038
    E_API_PERFORMANCE_COPY_LOG_FILE_FAILED = 0x00F90338
    E_API_REPORT_COMMON_COMPILE_REPORT_ERROR = 0x80FA0122
    E_API_REPORT_COMMON_GENERATE_REPORT_ERROR = 0x80FB0122
    E_API_RULE_COMMON_ALREADY_EXIST = 0x00FC0000
    E_API_RULE_COMMON_CATEGORY_NULL = 0x00FD0000
    E_API_RULE_COMMON_CODE_NULL = 0x00FE0000
    E_API_RULE_COMMON_NAME_NULL = 0x00FF0000
    E_API_RULE_COMMON_NOT_FOUND = 0x01000320
    E_API_RULE_COMMON_RULESET_NOT_FOUND = 0x01010320
    E_API_RULE_INVALID_SCAN_ENGINE = 0x01020320
    E_API_SCANTASK_ADDSCAN_INVALID_OPERATION = 0x8103000B
    E_API_SCANTASK_CALLSCAN_CREATEBODY_FAILED = 0x01040308
    E_API_SCANTASK_CALLSCAN_EXECUTE_FAILED = 0x81050309
    E_API_SCANTASK_CAN_NOT_COMPARE_DIFF_PROJECT = 0x01060008
    E_API_SCANTASK_COMMON_NOT_FOUND = 0x01070318
    E_API_SCANTASK_SUMMARY_DATA_INCONSISTENT = 0x01080318
    E_API_SCANTASK_CONSTRUCTSCANPARAM_INVALID_PREPROCESSPATH = 0x8109000B
    E_API_SCANTASK_CONSTRUCTSCANPARAM_INVALID_SCANFILEPATH = 0x810A000B
    E_API_SCANTASK_CONSTRUCTSCANPARAM_INVALID_SOURCESTORAGENAME = 0x810B000B
    E_API_SCANTASK_CONSTRUCTSCANPARAM_INVALID_TOKEN = 0x810C000B
    E_API_SCANTASK_PREPAREFORSCAN_ONLY_SUPPORT_UPLOAD = 0x010D0008
    E_API_SCANTASK_PREPAREFORSCAN_INVALID_FILESTORAGE_TYPE = 0x010E0008
    E_API_SCANTASK_UPDATE_SCANCONFIG_FAILED = 0x810F0309
    E_API_SCANTASK_UPDATE_INCONSISTENT = 0x01100318
    E_API_SCANTASKSTATUS_COMMON_INVALID_STATUS = 0x01110318
    E_API_SCANTASKSTATUS_COMMON_INVALID_STAGE = 0x01120318
    E_API_SCANTASKSTATUS_COMMON_NOT_FOUND = 0x01130318
    E_API_SETTING_ADD_ALREADY_EXIST = 0x01140018
    E_API_SETTING_COMMON_NOT_FOUND = 0x01150018
    E_API_SYSTEM_PING_NOT_AVAILABLE = 0x01160000
    E_API_USER_AUTH_USERNAME_PASSWORD_NOT_CORRECT = 0x8117003B
    E_API_USER_COMMON_INSUFFICIENT_PRIVILEGE = 0x01180000
    E_API_USER_COMMON_LOCKED = 0x8119013A
    E_API_USER_COMMON_NOT_FOUND = 0x011A0038
    E_API_USER_COMMON_SUSPENDED = 0x811B013A
    E_API_USER_CREATEUSERS_EXCEEDLICENSENUMBER = 0x811C003B
    E_API_USER_UPDATEPASSWORD_INCORRECT_PASSWORD = 0x811D003B
    E_API_USER_VALIDATEUSERS_EMAILEXIST = 0x811E003B
    E_API_USER_VALIDATEUSERS_USERNAMEEXIST = 0x811F003B
    E_API_USER_VALIDATEUSERS_ROWERROR = 0x8120003B
    E_API_USER_VALIDATEUSERS_VALIDATIONFAILED = 0x8121003B
    E_API_USERGROUP_ADDUSERGROUPS_ALREADYEXIST = 0x01220038
    E_API_USERGROUP_COMMON_CAN_NOT_DELETE = 0x01230038
    E_API_USERGROUP_COMMON_NOTFOUND = 0x01240038
    E_API_SCANTASK_TERMINATED_BY_USER = 0x812B011B
    E_API_FILE_COMMON_GET_PATH_FAILED = 0x012C0339
    E_API_USER_UPDATE_VALIDATE_FAIL = 0x812D000B
    E_API_PROJECT_UPDATE_VALIDATE_FAIL = 0x812E000B
    E_API_USER_VALIDATE_PASSWORD_VALIDATE_FAIL = 0x812F003B
    E_API_USERGROUP_CREATE_VALIDATE_FAIL = 0x8130003B
    E_API_USER_LOGIN_VALIDATE_FAIL = 0x8131003B
    E_API_PROJECT_CREATE_VALIDATE_FAIL = 0x8132000B
    E_API_PROJECTCONFIG_CREATE_VALIDATE_FAIL = 0x8133000B
    E_API_PRESET_CREATE_VALIDATE_FAIL = 0x8134000B
    E_API_PRESET_UPDATE_VALIDATE_FAIL = 0x8135000B
    E_API_SCANTASKSTATUS_UPDATE_VALIDATE_FAIL = 0x8136031B
    E_API_PRESET_CREATE_SETTING_VALIDATE_FAIL = 0x8137000B
    E_API_PRESET_UPDATE_SETTING_VALIDATE_FAIL = 0x8138000B
    E_API_EMAILCONFIG_UPDATE_SETTING_VALIDATE_FAIL = 0x8139000B
    E_API_CONTACTUS_VALIDATE_FAIL = 0x813A033A
    E_AGENT_IS_BUSY = 0x013B0013
    E_COMMON_UNKNOWN_ERROR = 0x013C0011
    E_NO_ACTIVE_AGENT_FOR_THIS_JOB = 0x813D0013
    E_COMMON_INVALID_VALUE = 0x013E0339
    E_SRV_UPLOAD_FILEINFO_FAILED = 0x813F0122
    E_IMPORT_RESULT_ALL_FAILED = 0x81400122
    E_SRV_SCAN_CANCELLED = 0x81410023
    E_SRV_SCAN_UNKNOWN_ERROR = 0x81420338
    I_SCAN_PROGRESS = 0x81440318
    E_SCAN_LIB_INCOMPATIBLE = 0x81450301
    E_GIT_DIFF_FAILED = 0x8149010A
    E_GIT_FETCH_CHECKOUT_FAILED = 0x814A010A
    E_MAVEN_SETTING_NOT_FOUND = 0x815A0003
    E_BACKUP_MAVEN_LIBRARY_FAILED = 0x815B0302
    E_SCAN_SERVICE_TIMEOUT = 0x8184013A
    E_SERVICE_TIMEOUT = 0x8185013A
    E_COMMIT_ID_NOT_FOUND = 0x81870013
    E_SRC_PATH_NOT_FOUND = 0x8186000B
    E_IDENTICAL_COMMIT_IDS = 0x81880013
    E_PREPARE_BUCKET = 0x80000000



class Stage(Enum):
    PENDING = 1
    PREPARE_SCAN_TASK_PIPELINE = 2
    SCAN_QUEUE_PRESCAN = 3
    PREPARE_WORKER_PIPELINE = 4
    PRE_SCAN_QUEUE = 5
    AGENT_START = 6
    FETCH_SOURCE = 7
    PRE_PROCESS = 8
    COMPRESS_SOURCE_CODE = 9
    UPLOAD_SOURCE_CODE = 10
    COLLECT_FILE_INFO = 11
    DIFF = 24
    UPLOAD_FILE_INFO = 12
    UPLOAD_PRE_PROCESS_INFO = 13
    AGENT_END = 14
    SCAN_QUEUE_GET_PRESCAN_RESULT = 15
    FETCH_PRE_PROCESS_INFO = 16
    SCAN_QUEUE_XVSA = 17
    SCAN_ENGINE_QUEUE = 18
    SCANNING = 19
    SCAN_QUEUE_IMPORT_RESULT = 20
    IMPORT_FILE_INFO = 21
    IMPORT_RESULT = 22
    SCAN_COMPLETE = 23
    IMPORT_RESULT_DIFF = 25
    # the next number is 26, 25 is IMPORT_RESULT_DIFF, need to find better method


class Percentage(Enum):
    START = 10
    MIDDLE = 50
    END = 100


class Status(Enum):
    PENDING = 1
    PROCESSING = 2
    COMPLETED = 3
    FAILED = 4
    TERMINATED = 5
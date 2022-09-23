#
#  Copyright (C) 2021 Xcalibyte (Shenzhen) Limited.
#


# =====================================================================================
#
# Globals
#
# =====================================================================================
import os
import platform
from enum import Enum

AGENT_VERSION = "0.0.20"
XVSA_MAVEN_PLUGIN_JAR = "xvsa-maven-plugin-1.39.jar"
XVSA_MAVEN_PLUGIN_POM = "xvsa-maven-plugin-1.39.pom"
XVSA_GRADLE_PLUGIN_JAR = "xvsa-1.0.jar"
XVSA_GRADLE_PLUGIN_POM = "xvsa-1.0.pom"

# this may be used as a guidance to package source code and collect file information
# maybe later will be open to users to config which types file they want to see in server side?
# Seems like a policy problem
SOURCE_CODE_SUFFIX = [".java", ".c", ".cc", ".cpp", ".cxx", ".h", ".hh", ".hxx", ".h++", ".hpp"]

os_info = "linux"
if platform.system() == "Windows":
    os_info = "win"
elif platform.system() == "Darwin":
    os_info = "osx"


# common file name constant variable
AGENT_RUN_LOG_FILE_NAME = "xcalagent.run.log"
AGENT_LOG_FILE_NAME = "xcalagent.log"
XCALBUILD_LOG_NAME = "xcalbuild.log"
JAVA_PREPROCESS_LOG_NAME = "javapreprocess.log"
DIAGNOSTIC_FILE_NAME = "agent_diagnostic_info.tar.gz"
SCAN_MISRA_RESULT_FILE_NAME = "misra_scan_result.xml"
CPPCHECK_SUPPRESSION_FILE_NAME = "suppressions.txt"

# hardcode file service access_key & secret_key
FILE_SERVICE_ACCESS_KEY = "AdminFileService"
FILE_SERVICE_SECRET_KEY = "AdminFileService"

#UI and other plug_in
CLIENT_TYPE_UI = "UI"
CLIENT_TYPE_VSCODE = "VSCODE"
CLIENT_TYPE_JENKINS = "JENKINS"
CLIENT_TYPE_ECLIPSE = "ECLIPSE"
CLIENT_TYPE_DEBUG = "DEBUG"

NOTSET = 0

# C++ file format
CPP_FILES = {"*.cc","*.cpp","*.cxx","*.hh","*.hpp", "*.hxx", "*.h++"}

# os command
CMD_FIND_FILE = {"windows":"findstr /s /r \"[^A-Za-z0-9]\" %s | find /C /V \"\" ",
                 "linux":"find %s -type f %s  | wc -l"
                 }

#count src lines script
CMD_COUNT_LINES = {"windows":"findstr /s /r \"[^A-Za-z0-9]\" %s | find /C /V \"\" ",
                 "linux":"find %s -type f | xargs cat | wc -l"
                 }

class FileType(Enum):
    LIB = 1
    SOURCE = 2
    TEMP = 3


# A Default Configuration / Template for user to override,
# User could write a file to override part of this
DEFAULT_CONFIG = {
    "JAEGER_PORT": None,
    "jaegerHost": None,
    "jaegerServiceName": None,
    # HTTP Polling interval, 5 is default
    "POLL_SPAN": 5,
    "RECONNECT_SPAN": 5,
    # Default Config
    "AGENT_NAME": "default-agent",
    "agentToken": "04bfe0cffbda602114c336d418cfa37a4c0270fd",
    "MATCHING_SCAN_SERVICE_VERSION": ["0.0.16"],  # Version: X.Y.Z or A.B.C->X.Y.Z
    "SKIP_SERVER_VERSION_MISMATCH": "NO",
    "API_SERVER": {
        "URL": "http://127.0.0.1:80",
        "loginApi": "/api/auth_service/v2/login",
        "pollApi": "/api/scan_task_service/v3/agent/get_task",
        "progressReportApi": "/api/scan_task_service/v3/agent/progress_report",
        "agentStatusReportApi": "/api/scan_task_service/v3/agent/status",
        "fileInfoUploadApi": "/api/file_service/v2/file/file_info",
        "scanTaskDiagnosticUploadApi": "/api/scan_service/v2/scan_task/{id}/diagnostic_info",
        "fileDownloadApi": "/api/file_service/v2/file_info/{fileInfoId}/file?token={token}",
        "checkFileCacheApi": "/api/scan_task_service/v2/agent/check_file_cache?token={token}&checksum={fileHash}",
        "saveFileCacheApi": "/api/scan_task_service/v2/agent/save_file_cache?token={token}&checksum={fileHash}&fileId={fileId}",
        "scanServiceVersionApi": "/api/scan_task_service/system/version",
        "createProjectApi": "/api/project_service/v2/project?token={token}",                          # added for offline agent
        "getProjectApi": "/api/project_service/v2/project/project_id/{projectId}/config?token={token}",      # added for offline agent
        "addScanTaskApi": "/api/scan_service/v2/project/{id}/scan_task/{status}?token={token}",  # added for offline agent
        "addScanTaskWithAttributesApi": "/api/scan_service/v2/scan_task?token={token}",          # added for offline agent
        "scanServiceApi": "/api/scan_task_service/v3",    # added for offline agent
#For Plugin
        "getRuleInformation": "/api/rule_service/v2/rule/{id}?token={token}&locale={lang}",
        "getProjects": "/api/project_service/v2/projects?token={token}",
        "getScanTask": "/api/scan_service/v2/project/{id}/scan_task?token={token}",
        "getScanResult": "/api/issue_service/v2/scan_task/{id}/scan_summary/scan_result?token={token}&locale={lang}",
#For Plugin
        "fileSystemApi": "/api/file_service/v2/file/file_system", #added for filesystem
        "updateProject": "/api/project_service/v2/project?token={token}", #added for offline agent
        "getProjectByIdApi": "/api/project_service/v2/project/{projectId}?token={token}"
},
    "XCAL_BUILD_SCRIPT_PATH": os.path.join("$XCALAGENT", "xcalbuild", os_info, "bin", "xcalbuild"),
    "XCAL_AGENT_INSTALL_DIR": "--autofill--",
    "XCAL_FEUTILITY_DIR": os.path.join("$XCALAGENT", "feutil"),
    # Debug purpose
    "SKIP_XCAL_BUILD": "NO",
    # Debug purpose
    "SKIP_JAVA_BUILD": "NO",
    # LogLevel
    "LOG_LEVEL": "WARN",
    "FORCE_USE_HEX_TEMP_NAME": "NO", # Force usage of temporary file name with hex based filename
    # XcalBuild Option
    "XCAL_BUILD_TIMEOUT": "3600.00",
    "FORCE_PREBUILD_CLEANUP": "YES", # Remove preprocess and preprocess.tar.gz before prescan
    "ALLOW_PRE_BUILD_CLEANUP": "YES", # Whether allowing remote specified removal of preprocess and preprocess.tar.gz before prescan
    "ALLOW_CLEANUP_SRC_DOWNLOADED": "NO", # Cleanup src after build fileinfo collected
    "DEFAULT_BUILD_COMMAND": "make", # C/C++ Building Options
    # Java Scan Option
    "JAVA_ARTIFACT_PATTERNS": ["*.o", "*.B"],
    "JAVA_RUNTIME_GEN_TIMEOUT": "1800.00",
    "JAVA_PLUGIN_TIMEOUT": "1800.00",
    "JAVA_SCANNER_CONNECTOR_TIMEOUT": "1800.00",
    "JFE_ON_SERVER": "YES",
    # Runtime Upload
    "FORCE_RUNTIME_OBJECT_GENERATION": "NO",
    # Scanner Connector Related Configuration
    "SCANNER_NAME": "spotbugs",
    "SCANNER_CONNECTOR_ARGS": "-jvmArgs \"-Xmx$CONNMAXMEMm\" ",
    # Java Plugin running line
    "javaMavenBuildLine": "$BUILDERPATH io.xc5:xvsa-maven-plugin:1.39:gather $REMOTEJFEARGS -Dxvsa.dir=$FEUTILDIR -Dxvsa.phantom=true -Dxvsa.result=$RESULTDIR -Dxvsa.srclist=$SRCLISTFILE -X $EXTRABUILDOPTS",
    "javaGradleBuildLine": "$BUILDERPATH xvsa $REMOTEJFEARGS -PXVSA_HOME=$FEUTILDIR -PXVSA_GRADLE_OUTPUT=$RESULTDIR -PXVSA_SRC_LIST=$SRCLISTFILE --info $EXTRABUILDOPTS",
    "javaDefaultGradleExecPath":"gradle",
    "javaDefaultMavenExecPath":"mvn",
    "javaDefaultExtraOpts": {},
    # Memory usage limit
    "scannerConnectorMaxMemory": "4000",
    "runtimeGenMinMemory": "2048", # Runtime Object Generation Memory Limit, in MiB
    "runtimeGenMaxMemory": "3300",
    # Miscellaneous Options
    "PRINT_SUBPROCESS_OUTPUT": "NO",
    "collectDiagnosticInfo": "YES",

    # Auto clean for c/c++
    "autoClean": "YES",
    "buildTools": {
        "aos make":"aos make clean",
        "catkin_make":"catkin_make clean",
        "catkin":"catkin clean --yes",
        "scons":"scons -c",
        "make":"make clean",
        "ninja":"ninja -t clean",
        "bazel":"bazel clean --expunge"
    }

}

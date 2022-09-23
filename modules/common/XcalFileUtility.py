#
#  Copyright (C) 2021 Xcalibyte (Shenzhen) Limited.
#
import logging
import platform
import os
import sys

from common import XcalGlobals
from common.CommonGlobals import TaskErrorNo, SOURCE_FILES_NAME
from common.XcalException import XcalException

from xcal_common.py.error import EFolderPermissionError, ESourceDirectoryNotExist, EXcalbuildNotFound, \
    EBuildMainDirectoryNotExist

logger = logging.getLogger(__name__)


class FilePathResolver(object):
    def __init__(self):
        pass

    def get_job_dir(self, global_ctx, job_config):
        job_dir = os.path.join(str(global_ctx.get("XCAL_AGENT_INSTALL_DIR")),
                               "workdir", "jobs", job_config.get("taskConfig").get("projectId"))
        self.make_sure_usable(job_dir)

        if not os.access(job_dir, os.W_OK | os.R_OK):
            logger.error("work path is not readable/writable: %s" % job_dir)
            raise EFolderPermissionError

        return str(job_dir)

    def get_output_path_dir(self, job_config):
        job_dir = os.path.join(str(job_config.get("outputPath")))
        self.make_sure_usable(job_dir)

        if not os.access(job_dir, os.W_OK | os.R_OK):
            logger.error("output path is not readable/writable: %s" % job_dir)
            raise EFolderPermissionError

        return str(job_dir)

    def get_precsan_res_save_dir(self, global_ctx, job_config, step_config):
        return self.get_job_dir(global_ctx, job_config)

    def get_precsan_res_save_output_path(self, job_config):
        return self.get_output_path_dir(job_config)

    def get_upload_dir(self, global_ctx, job_config, one_step):
        return self.get_job_dir(global_ctx, job_config)

    @staticmethod
    def get_file_path_in_xcalagent_install_dir(global_ctx, file_name: str):
        return os.path.join(str(global_ctx.get("XCAL_AGENT_INSTALL_DIR")), file_name)

    def get_file_path_in_job_dir(self, global_ctx, job_config, file_name: str):
        return os.path.join(self.get_job_dir(global_ctx, job_config), file_name)

    def get_source_temp_dir(self, global_ctx, job_config, one_step):
        src_dir = os.path.join(self.get_job_dir(global_ctx, job_config), "src")
        self.make_sure_usable(src_dir)
        return src_dir

    def get_source_temp_output_path(self, job_config):
        src_dir = os.path.join(self.get_output_path_dir(job_config), "src")
        self.make_sure_usable(src_dir)
        return src_dir

    # deprecated, use get_file_path_in_job_dir method
    def get_log_file_path(self, global_ctx, job_config, one_step):
        return os.path.join(self.get_job_dir(global_ctx, job_config), XcalGlobals.AGENT_LOG_FILE_NAME)

    def get_log_file_output_path(self, job_config):
        return os.path.join(self.get_output_path_dir(job_config), XcalGlobals.AGENT_LOG_FILE_NAME)

    def get_download_dir(self, global_ctx, job_config, one_step):
        download_dir = os.path.join(self.get_job_dir(global_ctx, job_config), "download")
        self.make_sure_usable(download_dir)
        return download_dir

    def get_download_temp_file_name(self, global_ctx, job_config, step_config):
        logger.info("get_download_temp_file_name")
        download_dir = self.get_download_dir(global_ctx, job_config, step_config)
        return os.path.join(download_dir, "src.zip")

    def get_xcalbuild_script_path(self, global_ctx):
        default_path = str(global_ctx.get("XCAL_BUILD_SCRIPT_PATH"))
        default_path = default_path.replace("$XCALAGENT", global_ctx.get("XCAL_AGENT_INSTALL_DIR"))

        #Implement .sh/.bat file to call executable file  of xcalbuild
        if platform.system() == "Windows":
            default_path = default_path +".exe"
        else:
            default_path = default_path

        if (not os.path.exists(default_path)) or (not os.path.isfile(default_path)):
            raise XcalException("XcalFileUtility", "get_xcalbuild_executable",
                                "Cannot find XcalBuild under : %s, please check xcalBuildPath variable "
                                "is set properly" % default_path,
                                TaskErrorNo.E_XCALBUILD_NOT_FOUND)
        return str(default_path)

    def get_xcalbuild_script_path_new(self, job_config):
        default_path = str(job_config.get("xcalbuildPath"))

        if (not os.path.exists(default_path)) or (not os.path.isfile(default_path)):
            logger.error("xcal build does not exist in path: %s" % default_path)
            raise EXcalbuildNotFound

        return str(default_path)

    def get_preprocessed_tar_path(self, global_ctx, job_config, step_config):
        tarfile_name = step_config.get("outputFileName")
        if tarfile_name is None:
            tarfile_name = "preprocess.tar.gz"
        return os.path.join(self.get_precsan_res_save_dir(global_ctx, job_config, step_config), tarfile_name)

    def get_preprocessed_tar_output_path(self, job_config):
        tarfile_name = "preprocess.tar.gz"
        return os.path.join(self.get_precsan_res_save_output_path(job_config), tarfile_name)

    def get_source_dir(self, global_ctx, job_config, step_config):
        project_path = step_config.get("srcDir")

        if step_config.get("sourceStorageName") != "agent":
            project_path = self.get_source_temp_dir(global_ctx, job_config, step_config)

        if (not os.path.exists(project_path)) or (not os.path.isdir(project_path)):
            raise XcalException("XcalFileUtility", "get_source_dir", "Source code path %s does not exist or is not a directory" % project_path,
                                TaskErrorNo.E_SOURCE_DIRECTORY_NOT_EXIST)

        if not os.access(project_path, os.R_OK):
            raise XcalException("XcalFileUtility", "get_source_dir", "Source code in %s is not readable" % project_path,
                                TaskErrorNo.E_FOLDER_PERMISSION_ERROR)
        return project_path

    def get_source_dir_output_path(self, job_config):
        project_path = job_config.get("projectPath")

        if (not os.path.exists(project_path)) or (not os.path.isdir(project_path)):
            logger.error("project path does not exist: %s" % project_path)
            raise ESourceDirectoryNotExist

        if not os.access(project_path, os.R_OK | os.W_OK):
            logger.error("project path is not readable/writable: %s" % project_path)
            raise EFolderPermissionError

        return project_path

    def make_sure_usable(self, path):
        if not os.path.exists(path):
            os.makedirs(path)

    # Non-win system use work path, while windows use a project file or work path
    def get_build_work_path(self, job_config):
        work_path = str(job_config.get("buildPath"))
        if XcalGlobals.os_info != "win":
            if (not os.path.exists(work_path)) or (not os.path.isdir(work_path)):
                logger.error("build path does not exist: %s" % work_path)
                raise EBuildMainDirectoryNotExist

            if not os.access(work_path, os.W_OK | os.R_OK):
                logger.error("build path is not readable/writable: %s" % work_path)
                raise EFolderPermissionError
        else:
            # when scan projects on windows, build path is a project file or work path.
            if not os.path.exists(work_path):
                logger.error("build path does not exist: %s" % work_path)
                raise EBuildMainDirectoryNotExist

            if not os.access(work_path, os.W_OK | os.R_OK):
                logger.error("build path is not readable/writable: %s" % work_path)
                raise EFolderPermissionError

        return str(work_path)

    def get_java_log_path(self, global_ctx, job_config, one_step):
        return os.path.join(self.get_job_dir(global_ctx, job_config), XcalGlobals.JAVA_PREPROCESS_LOG_NAME)

    def get_scanner_log_path(self, global_ctx, job_config, one_step):
        return os.path.join(self.get_job_dir(global_ctx, job_config), "scanner-connector.log")

    def get_java_preprocess_result_dir(self, global_ctx, job_config, step_config, must_exist=True):
        preprocess_dir = os.path.join(self.get_job_dir(global_ctx, job_config), "xvsa-out")
        if not must_exist:
            if not os.path.exists(preprocess_dir):
                os.makedirs(preprocess_dir)
        if (not os.path.exists(preprocess_dir)) or (not os.path.isdir(preprocess_dir)):
            raise XcalException("XcalFileUtility", "get_java_preprocess_result_dir", "output directory not created properly",
                                TaskErrorNo.E_JAVA_PREPROCESS_RESULT_DIR_NOT_EXIST)

        if not os.access(preprocess_dir, os.R_OK | os.W_OK):
            raise XcalException("XcalFileUtility", "get_java_preprocess_result_dir", "Cannot read/write outputDir = %s" %
                                preprocess_dir, TaskErrorNo.E_FE_UTIL_DIR_UNREADABLE)
        return preprocess_dir

    def get_java_jdk_path(self, global_ctx, job_config, step_config):
        java_path = os.getenv("JAVA_HOME")
        if os.path.exists(java_path) and os.path.isdir(java_path):
            return java_path
        else:
            raise XcalException("XcalFileUtility", "get_java_jdk_path", "JAVA_HOME = %s is not set properly" % java_path,
                                TaskErrorNo.E_JAVA_HOME_NOTVALID)

    def get_fe_util_base_dir(self, global_ctx, job_config, step_config):
        util_base = global_ctx.get("XCAL_FEUTILITY_DIR")
        util_base = util_base.replace("$XCALAGENT", global_ctx.get("XCAL_AGENT_INSTALL_DIR"))
        if (not os.path.exists(util_base)) or (not os.path.isdir(util_base)):
            raise XcalException("XcalFileUtility", "get_fe_util_base_dir", "Cannot locate feutil directory under %s" %
                                util_base, TaskErrorNo.E_FE_UTIL_DIR_NOTFOUND)
        if not os.access(util_base, os.R_OK):
            raise XcalException("XcalFileUtility", "get_fe_util_base_dir", "Cannot read feutil directory under %s" %
                                util_base, TaskErrorNo.E_FE_UTIL_DIR_UNREADABLE)
        return util_base

    def get_fe_util_lib_path(self, global_ctx, job_config, step_config):
        base_dir = self.get_fe_util_base_dir(global_ctx, job_config, step_config)
        lib_path = os.path.join(base_dir, "lib", "1.0")
        if (not os.path.exists(base_dir)) or (not os.path.isdir(base_dir)):
            raise XcalException("XcalFileUtility", "get_fe_util_lib_path", "Cannot locate feutil library directory under %s" %
                                base_dir, TaskErrorNo.E_FE_UTIL_LIB_NOTFOUND)
        if not os.access(base_dir, os.R_OK):
            raise XcalException("XcalFileUtility", "get_fe_util_lib_path", "Cannot read feutil library directory under %s" %
                                base_dir, TaskErrorNo.E_FE_UTIL_LIB_UNREADABLE)
        return lib_path

    def get_fe_util_jar_path(self, global_ctx, job_config, step_config):
        util_lib_dir = self.get_fe_util_lib_path(global_ctx, job_config, step_config)
        jar_path = os.path.join(util_lib_dir, "macbcr.jar")
        if (not os.path.exists(jar_path)) or (not os.path.isfile(jar_path)):
            raise XcalException("XcalFileUtility", "get_fe_util_jar_path", "Cannot locate feutil java jar under %s" %
                                jar_path, TaskErrorNo.E_FE_UTIL_JAR_NOTFOUND)
        if not os.access(jar_path, os.R_OK):
            raise XcalException("XcalFileUtility", "get_fe_util_jar_path", "Cannot read feutil java jar under %s" %
                                jar_path, TaskErrorNo.E_FE_UTIL_JAR_UNREADABLE)
        return jar_path

    def get_fe_util_connector_script_path(self, global_ctx, job_config, step_config):
        util_dir = self.get_fe_util_base_dir(global_ctx, job_config, step_config)
        script_path = os.path.join(util_dir, "connector", "scanner-run.py")
        if (not os.path.exists(script_path)) or (not os.path.isfile(script_path)):
            raise XcalException("XcalFileUtility", "get_fe_util_connector_script_path", "Cannot locate feutil connector script under %s" %
                                script_path, TaskErrorNo.E_FE_UTIL_CONN_NOTFOUND)
        if not os.access(script_path, os.R_OK):
            raise XcalException("XcalFileUtility", "get_fe_util_connector_script_path", "Cannot read feutil connector script under %s" %
                                script_path, TaskErrorNo.E_FE_UTIL_CONN_UNREADABLE)
        return script_path

    def get_fe_util_connector_script_dir(self, global_ctx, job_config, step_config):
        util_dir = self.get_fe_util_base_dir(global_ctx, job_config, step_config)
        connect_dir = os.path.join(util_dir, "connector")
        if (not os.path.exists(connect_dir)) or (not os.path.isdir(connect_dir)):
            raise XcalException("XcalFileUtility", "get_fe_util_connector_script_dir", "Cannot locate feutil connector dir under %s" %
                                connect_dir, TaskErrorNo.E_CONNECTOR_NOTFOUND)
        if not os.access(connect_dir, os.R_OK):
            raise XcalException("XcalFileUtility", "get_fe_util_connector_script_dir", "Cannot read feutil connector dir under %s" %
                                connect_dir, TaskErrorNo.FE_CONNECTOR_UNREADABLE)
        return connect_dir

    def get_jdk_jar_path(self, global_ctx, job_config, step_config, jar_basename):
        java_dir = self.get_java_jdk_path(global_ctx, job_config, step_config)
        jar_paths = [os.path.join(java_dir, "lib", jar_basename), os.path.join(java_dir, "jre", "lib", jar_basename)]
        for candidate in jar_paths:
            if (not os.path.exists(candidate)) or (not os.path.isfile(candidate)):
                continue
            if not os.access(candidate, os.R_OK):
                logger.warning("Cannot read JDK java jar under %s" % candidate)
            return candidate
        raise XcalException("XcalFileUtility", "get_jdk_jar_path", "Cannot locate JDK java jar under %s" %
                            str(jar_paths), TaskErrorNo.E_JDK_JAR_NOTFOUND)

    def get_java_rt_jar_path(self, global_ctx, job_config, step_config):
        return self.get_jdk_jar_path(global_ctx, job_config, step_config, "rt.jar")

    # This file would be created if not exists
    def get_output_runtime_object_file(self, global_ctx, job_config, step_config):
        work_dir = self.get_job_dir(global_ctx, job_config)
        runtime_object_file = os.path.join(work_dir, "rt.o")
        return runtime_object_file

    # This file would be created if not exists
    def get_runtime_object_tarball_path(self, global_ctx, job_config, step_config):
        work_dir = self.get_upload_dir(global_ctx, job_config, step_config)
        runtime_object_file = os.path.join(work_dir, "rt.tgz")
        return runtime_object_file

    # This file would be created if not exists
    def get_scanner_connector_result_temp_file(self, global_ctx, job_config, step_config):
        work_dir = self.get_upload_dir(global_ctx, job_config, step_config)
        connect_result_file = os.path.join(work_dir, "connector.v")
        return connect_result_file

    # Get Source_files.json path, which is inside upload directory
    def get_src_list_path(self, global_ctx, job_config, step_config):
        work_dir = self.get_upload_dir(global_ctx, job_config, step_config)
        src_list_file = os.path.join(work_dir, SOURCE_FILES_NAME)
        return src_list_file

    # Get the executing python path
    def get_python_exec_path(self, global_ctx, job_config, step_config):
        python_path = os.path.abspath(sys.executable)
        return python_path

    # Read the file into an list
    def read_file_into_list(self, fn: str):
        all_res = []
        with open(fn, "r") as f:
            # Read list of lines
            while True:
                # Read next line
                line = f.readline()
                # If line is blank, then you struck the EOF
                if not line:
                    break
                all_res.append(line.strip("\n"))
        return all_res

    def get_temporary_folder(self, global_ctx, job_config):
        """
        Get the temporary to store the data to be cleaned after agent preprocessing
        :param global_ctx:
        :param job_config:
        :return:
        """
        temp_dir = os.path.join(self.get_job_dir(global_ctx, job_config), "tempdir")
        if not os.path.exists(temp_dir):
            os.makedirs(temp_dir)
        return temp_dir

    def get_temporary_file_name(self, global_ctx, job_config, internal_name:str=None):
        """
        Get a temporary file name, used for creating a file to write agent generated data such as xcalibyte.properties
        :param global_ctx:
        :param job_config:
        :param internal_name:
        :return:
        """
        temp_dir = self.get_temporary_folder(global_ctx, job_config)
        if internal_name is None or internal_name.startswith("/") or internal_name.startswith("\\") or global_ctx.get("FORCE_USE_HEX_TEMP_NAME", "NO") == "YES":
            # The temp_dir should be existing
            res = os.path.join(temp_dir, os.urandom(24).hex())
        else:
            res = os.path.join(temp_dir, internal_name)
            res_dir = os.path.dirname(res)
            if not(os.path.exists(res_dir)):
                os.makedirs(res_dir)
        return res

    def open_temporary_file(self, global_ctx:dict, job_config:dict, mode:str, internal_name = None):
        """
        Open a file with name given by get_temporary_file_name
        :param global_ctx:
        :param job_config:
        :param mode:
        :param internal_name:
        :return:
        """
        return open(self.get_temporary_file_name(global_ctx, job_config, internal_name), mode)

    def write_to_temporary_file(self, global_ctx, job_config, string_val:str, internal_name = None):
        """
        Write the string to a temporary file, using UTF-8 format, writing it in binary form
        (for Windows compatibility)
        :param global_ctx:
        :param job_config:
        :param string_val:
        :param internal_name:
        :return:
        """
        file_name = self.get_temporary_file_name(global_ctx, job_config, internal_name=internal_name)
        with open(file_name, "w+b") as f:
            f.write(string_val.encode("UTF-8"))
        return file_name

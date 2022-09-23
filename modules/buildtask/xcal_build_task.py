#
#  Copyright (C) 2021 Xcalibyte (Shenzhen) Limited.
#

import sys, os
currentdir = os.path.dirname(os.path.realpath(__file__))
parentdir = os.path.dirname(currentdir)
parentparentdir = os.path.dirname(parentdir)
sys.path.append(parentdir)
sys.path.append(parentparentdir)

import logging
import json
import re
import shlex
import tarfile
import shutil
from common import XcalGlobals
from common.CommonGlobals import SOURCE_FILES_NAME
from common.RunCommandService import ExecuteCommandService
from common.XcalFileUtility import FilePathResolver
from xcal_common.py.error import EXcalbuildFail, ENoIFileGenerated

logger = logging.getLogger(__name__)


class XcalBuildTask(object):
    def __init__(self):
        pass

    def prepare_build_command(self, job_config: dict, global_ctx: dict, unknown_args: dict):
        logger.info("prepare build command")

        path_resolver = FilePathResolver()
        default_path = path_resolver.get_xcalbuild_script_path_new(job_config)
        work_path = path_resolver.get_build_work_path(job_config)
        result_dir = path_resolver.get_precsan_res_save_output_path(job_config)

        logger.debug("default_path: %s, work_path: %s, result_dir: %s" % (default_path, work_path, result_dir))

        # prepare build command & prebuild Command
        default_build_command = global_ctx.get("DEFAULT_BUILD_COMMAND")
        build_command = job_config.get("build", default_build_command) + ' ' + job_config.get("buildArgs", "")
        pre_build_command = job_config.get("prebuildCommand")
        scan_all = job_config.get("scan_all")
        pre_cmd = pre_build_command
        if scan_all:
            build_tools = global_ctx.get("buildTools")
            logger.debug("build_tools: %s" % (str(build_tools)))
            build_command_only = job_config.get("build", default_build_command)
            logger.debug("build_command_only: %s" % (str(build_command_only)))
            pre_cmd = self.build_scan_all_prebuild_command(pre_build_command, build_tools, build_command_only)

        # prepare final pre_build_command for xcalbuild
        pre_build_command = "-p %s" % shlex.quote(pre_cmd)

        select_profile = job_config.get("profile")

        fwl_cmd = job_config.get("fwl")
        if fwl_cmd is not None:
            whitelist_filter_command = "--fwl %s" % shlex.quote(fwl_cmd)
        else:
            whitelist_filter_command = ""

        fbl_cmd = job_config.get("fbl")
        if fbl_cmd is not None:
            blacklist_filter_command = "--fbl %s" % shlex.quote(fbl_cmd)
        else:
            blacklist_filter_command = ""

        logger.debug("system: %s" % XcalGlobals.os_info)

        process_link_using_compiler = ""
        if job_config.get("processLinkUsingCompiler"):
            process_link_using_compiler = '--process_link_using_compiler '

        debug_option = ""
        unknown_options = ""
        # add debug flag
        if job_config.get("debug"):
            debug_option = '--debug '

        # append unknown args
        unknown_options += ' ' + ' '.join(unknown_args)

        if XcalGlobals.os_info == "linux" or XcalGlobals.os_info == "osx":
            if select_profile is None:
                command = "%s -i %s -o %s %s %s %s %s %s %s -- %s" % \
                          (shlex.quote(default_path),
                           shlex.quote(work_path),
                           shlex.quote(result_dir),
                           whitelist_filter_command,
                           blacklist_filter_command,
                           pre_build_command,
                           process_link_using_compiler,
                           debug_option,
                           unknown_options,
                           build_command
                           )
            else:
                command = "%s -i %s -o %s %s %s %s --profile %s %s %s %s -- %s" % \
                          (shlex.quote(default_path),
                           shlex.quote(work_path),
                           shlex.quote(result_dir),
                           whitelist_filter_command,
                           blacklist_filter_command,
                           pre_build_command,
                           select_profile,
                           debug_option,
                           process_link_using_compiler,
                           unknown_options,
                           build_command
                           )
        else:
            command = "\"%s\" -i \"%s\" -o \"%s\" %s %s -c \"%s\"" % \
                      (
                          default_path,
                          work_path,
                          result_dir,
                          debug_option,
                          unknown_options,
                          build_command
                      )

        return command

    def build_task(self, job_config: dict, unknown_args: dict):
        logger.info("begin build task")

        global_ctx = XcalGlobals.DEFAULT_CONFIG.copy()
        if global_ctx.get("skipXcalBuild") == "YES":
            return

        path_resolver = FilePathResolver()
        log_path = path_resolver.get_log_file_output_path(job_config)

        command = self.prepare_build_command(job_config, global_ctx, unknown_args)

        logger.debug("xcalbuild command: %s" % command)
        logger.debug("xcalbuild log path: %s" % log_path)

        rc = ExecuteCommandService.execute_command(command, logfile = log_path)

        logger.debug("xcalbuild command return code: %s" % str(rc))
        if rc != 0:
            logger.error("xcalbuild failed, please check the log: %s" % log_path)
            raise EXcalbuildFail

        # Assertion for the directory layout, hard code intentionally
        with tarfile.open(FilePathResolver().get_preprocessed_tar_output_path(job_config), "r") as tf:
            names = tf.getnames()
            assert len(names) > 0
            assert 'xcalibyte.properties' in names

            i_file_count = 0

            for one_item in names:
                if re.search("\.ii$", one_item) is not None or re.search("\.i$", one_item) is not None:
                    i_file_count += 1

            if i_file_count <= 0:
                logger.warning("no .i/.ii files generated, please check the log: %s" % log_path)
                raise ENoIFileGenerated

        default_path = path_resolver.get_xcalbuild_script_path_new(job_config)
        result_dir = path_resolver.get_precsan_res_save_output_path(job_config)
        # by default, suppressions.txt placed at client root path,
        # and default_path(xcalbuild path) is {client_root_path}/executable/xcalbuild/bin/xcalbuild,
        # so use 4 dirname method to get cppcheck suppression file path
        suppression_file_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(default_path)))),
                                          XcalGlobals.CPPCHECK_SUPPRESSION_FILE_NAME)
        if job_config.get("suppressRulesListFile") is not None and os.path.isfile(job_config.get("suppressRulesListFile")):
            suppression_file_path = job_config.get("suppressRulesListFile")
        else:
            logger.warning("value of suppressRulesListFile is invalid, will use default suppress rules list file path")
        logger.info("suppress rules list file path: %s" % suppression_file_path)
        source_code_file_path = os.path.join(result_dir, SOURCE_FILES_NAME)
        is_cppcheck_scan_success = False
        # check cppcheck, and scan with cppcheck misra addon
        if job_config.get("scanMode") in ["-xsca", "-single-xsca"] \
            and XcalBuildTask._is_tool("cppcheck") \
            and os.path.exists(source_code_file_path) \
                and os.path.exists(suppression_file_path):
            output_file = os.path.join(result_dir, XcalGlobals.SCAN_MISRA_RESULT_FILE_NAME)
            source_code_file_list = XcalBuildTask._get_source_code_file_list(job_config.get("projectPath"), source_code_file_path)
            if len(source_code_file_list) > 0:
                cppcheck_command = "cppcheck --addon=misra.py --suppressions-list=%s %s --xml 2> %s" % (suppression_file_path, " ".join(source_code_file_list), output_file)
                logger.info("begin to do cppcheck scan")
                rc = ExecuteCommandService.execute_command(cppcheck_command, logfile = log_path)
                if rc != 0:
                    logger.warning("cppcheck failed, ignore cppcheck scan. return code: %s, log path: %s" % (str(rc), log_path))
                else:
                    logger.info("cppcheck scan successfully")
                    is_cppcheck_scan_success = True
            else:
                logger.info("invalid file info in %s, ignore cppcheck scan", SOURCE_FILES_NAME)

        # Add one logic to tar preprocess.tar.gz and source_files.json together
        # And upload the tar file to server side
        preprocess_file_path = FilePathResolver().get_preprocessed_tar_output_path(job_config)
        tmp_preprocess = preprocess_file_path.replace("preprocess.tar.gz", "tmp_preprocess_tgz")
        src_files_json = preprocess_file_path.replace("preprocess.tar.gz", "source_files.json")
        if os.path.exists(tmp_preprocess):
            shutil.rmtree(tmp_preprocess)
        os.mkdir(tmp_preprocess)
        shutil.move(preprocess_file_path, tmp_preprocess)
        shutil.copy(src_files_json, tmp_preprocess)     # this file will also be used for generate file info
        if is_cppcheck_scan_success:
            shutil.move(output_file, tmp_preprocess)
        try:
            with tarfile.open(preprocess_file_path, 'w:gz') as tf:
                tf.add(tmp_preprocess, '')
            # when finish tar file, del useless tmp folder
            shutil.rmtree(tmp_preprocess)
        except Exception as e:
            logger.error("package preprocess.tar.gz and source_files.json to one package failed.")
            logger.exception(e)
            raise e

    @staticmethod
    def _is_tool(name):
        """Check whether `name` is on PATH and marked as executable."""
        from shutil import which
        return which(name) is not None

    @staticmethod
    def _get_source_code_file_list(project_path, file_name):
        """
        get all the source code file path name in the specified file
        :param project_path: project source code path
        :param file_name: json file which contains all the file paths being preprocessed
        :return: list type object which is empty or contains all the source code file path
        """
        logger.info("begin to parse the file to get source code file path list")

        file_list = list()
        with open(file_name) as json_file:
            source_code_files = json.load(json_file)
            if not isinstance(source_code_files, list) or len(source_code_files) == 0:
                logger.warning("source code file content is invalid: %s" % source_code_files)
                return file_list

            for source_code_file in source_code_files:
                # file path may contain .., normpath can make the path canonical
                source_code_file = os.path.normpath(source_code_file)
                if source_code_file.startswith(project_path):
                    file_list.append(source_code_file)
        return file_list

    def build_scan_all_prebuild_command(self, pre_build_command:str, build_tools:dict, build_command_only:str):
        pre_cmd = ""

        if build_command_only in build_tools: # key build command exist in our build tool list
            pre_cmd = build_tools[build_command_only]

            if pre_build_command is not None:  # have prebuild command
                pre_cmd = pre_cmd + " && " + pre_build_command

        return pre_cmd
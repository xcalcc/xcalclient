#
#  Copyright (C) 2021 Xcalibyte (Shenzhen) Limited.
#
import logging
import os
import time

from common.CommonGlobals import SOURCE_CODE_ARCHIVE_FILE_NAME, SOURCE_FILES_NAME, \
    FILE_INFO_FILE_NAME, AGENT_SOURCE_STORAGE, GERRIT_SOURCE_STORAGE
from common.CompressionUtility import CompressionUtility
from common.XcalFileUtility import FilePathResolver
from common import XcalFileInfoCollector

from xcal_common.py.error import EFolderNotexist, EFileinfoFolderNonexist

logger = logging.getLogger(__name__)


class PackageService(object):
    def __init__(self, project_conf: dict):
        self.job_config = project_conf

    def compress_source_code(self):
        logger.info("Prepare to Compress source code")

        dest_path = FilePathResolver().get_precsan_res_save_output_path(self.job_config)
        if not os.path.exists(dest_path):
            logger.error("source code package output path does not exist: %s" % dest_path)
            raise EFolderNotexist

        source_code_path = self.job_config.get("projectPath")
        filename = SOURCE_CODE_ARCHIVE_FILE_NAME
        input_filename = SOURCE_FILES_NAME

        logger.debug("source_code_path: %s, filename: %s, input_filename: %s, dest_path: %s" % (source_code_path, filename, input_filename, dest_path))

        logger.info("Compress start at: %s" % time.asctime())
        archive_file_path = CompressionUtility.get_archive(filename, source_code_path, input_filename, destination_path=dest_path)
        logger.info("Compress complete at: %s" % time.asctime())
        logger.debug("Compress source code complete, path: %s" % archive_file_path)

    def prepare_file_info(self):
        logger.info("Prepare to generate file info")

        project_path = FilePathResolver().get_source_dir_output_path(self.job_config)
        dest_path = FilePathResolver().get_output_path_dir(self.job_config)

        step_config = dict()

        step_config["sourceStorageName"] = AGENT_SOURCE_STORAGE
        step_config["sourceStorageType"] = AGENT_SOURCE_STORAGE
        step_config["gitUrl"] = self.job_config.get("gitUrl")
        step_config["inputFileName"] = SOURCE_FILES_NAME
        step_config["uploadSource"] = self.job_config.get("uploadSource")

        if self.job_config.get("gitUrl"):
            step_config["sourceStorageName"] = GERRIT_SOURCE_STORAGE
            step_config["sourceStorageType"] = GERRIT_SOURCE_STORAGE

        logger.debug("project_path : %s, job_config : %s., step_config : %s., destination_path : %s., filename : %s." % (project_path, self.job_config, step_config, dest_path, FILE_INFO_FILE_NAME))

        if not os.path.exists(dest_path):
            logger.error("file info output path does not exist: %s" % dest_path)
            raise EFileinfoFolderNonexist

        logger.info("generate file info start at: %s" % time.asctime())
        fileinfo_path = XcalFileInfoCollector.generate_file(project_path,
                                                            self.job_config,
                                                            step_config,
                                                            destination_path = dest_path,
                                                            filename = FILE_INFO_FILE_NAME,
                                                            )
        logger.info("generate file info complete at: %s" % time.asctime())
        logger.debug("generate file info complete, path: %s" % fileinfo_path)
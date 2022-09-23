#
#  Copyright (C) 2021 Xcalibyte (Shenzhen) Limited.
#
import logging
import os

from common.CommonGlobals import SOURCE_CODE_ARCHIVE_FILE_NAME, FILE_INFO_FILE_NAME, PREPROCESS_FILE_NAME, \
    VCS_DIFF_RESULT_FILE_NAME
from file_util import FileUtil, get_client, PREPROCESS_DATA_BUCKET_NAME

logger = logging.getLogger(__name__)


class FileService(object):
    def __init__(self, file_dir):
        self.files = [FILE_INFO_FILE_NAME, PREPROCESS_FILE_NAME, VCS_DIFF_RESULT_FILE_NAME]
        self.file_dir = file_dir

    def prepare_files_to_upload(self):
        self.files.append(SOURCE_CODE_ARCHIVE_FILE_NAME)

    def upload_files(self, url, project_id):
        client = get_client(url)
        file_util = FileUtil(client)
        file_util.create_bucket(PREPROCESS_DATA_BUCKET_NAME)

        for file_name in self.files:
            file_path = os.path.join(self.file_dir, file_name)
            if os.path.exists(file_path) and os.path.isfile(file_path):
                file_util.upload_file(PREPROCESS_DATA_BUCKET_NAME, os.path.join(project_id, file_name), file_path)

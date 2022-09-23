#!/usr/bin/env python3
# -*- coding:utf-8 -*-

import argparse
import json
import os
import sys
import zipfile
import datetime

from scmErrorRecover import POST_STATUS, STATUS, SUB_SUB_PHASE

SOURCE_CODE_FILE_NAME = 'source_code.zip'


class SPGetSourceCode:

    def __init__(self, work_dir: str, source_files_file: str, host_path: str):
        self.work_dir = work_dir
        self.source_files_file = source_files_file
        self.host_path = host_path

        self.workspace = os.path.abspath(os.curdir)
        self.source_code_file = os.path.join(self.work_dir, SOURCE_CODE_FILE_NAME)

        self.error_code = 0

    def init(self):
        context = {
            'work_dir': self.work_dir,
            'source_files_file': self.source_files_file,
            'host_path': self.host_path
        }
        ret, msg = POST_STATUS.health_check(SUB_SUB_PHASE.PREPROC_SCM_SOURCE, context)
        if ret != 0:
            self.error_code = ret
            raise Exception(msg)

    def exec(self):
        if os.path.exists(self.source_code_file):
            return

        with open(self.source_files_file, 'r') as f:
            source_files = json.load(f)

        if source_files is None or len(source_files) == 0:
            self.error_code = -1
            raise Exception('%s does not exists or empty' % self.source_files_file)

        files, file_set, dir_set = [], set(), set()
        for file_name in source_files:
            if not os.path.exists(file_name):
                continue
            if not file_name.startswith(self.host_path):
                continue
            file_set.add(file_name)
            while file_name != self.host_path:
                file_name = os.path.dirname(file_name)
                dir_set.add(file_name)

        os.chdir(self.host_path)
        with zipfile.ZipFile(self.source_code_file, 'w') as f:
            for file_name in file_set:
                f.write(os.path.relpath(file_name, self.host_path))
        os.chdir(self.workspace)

    def fini(self):
        pass


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--work-dir', required=True)
    parser.add_argument('--source-files', required=True)
    parser.add_argument('--host-path', required=True)
    args = parser.parse_args()

    worker = SPGetSourceCode(args.work_dir, args.source_files, args.host_path)
    init_time=datetime.datetime.utcnow()
    try:
        POST_STATUS.EXEC_PARAMETERS = '--work-dir %s --source-files %s --host-path %s' % (
            args.work_dir, args.source_files, args.host_path
        )
        POST_STATUS.init(SUB_SUB_PHASE.PREPROC_SCM_SOURCE, init_time=init_time)
        worker.init()
        worker.exec()
        worker.fini()
    except Exception as e:
        print(e, flush=True)
        POST_STATUS.FINI_STATUS = worker.error_code
        POST_STATUS.print_to_controller('Error Code: %s' % worker.error_code)
        POST_STATUS.print_to_controller('Error Message: %s' % e)
        sys.exit(1)
    finally:
        POST_STATUS.fini(SUB_SUB_PHASE.PREPROC_SCM_SOURCE, init_time=init_time)

    # client need this return code to continue
    sys.exit(0)

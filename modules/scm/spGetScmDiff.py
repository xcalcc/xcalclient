#!/usr/bin/env python3
# -*- coding:utf-8 -*-

import argparse
import datetime
import os
import subprocess
import sys

from scmErrorRecover import POST_STATUS, SUB_SUB_PHASE

SCM_DIFF_FILE_NAME = 'scm_diff.txt'


class SPGetScmDiff:
    def __init__(self, work_dir: str, commit_id: str, baseline_commit_id: str, repo_path: str, repo_branch: str):
        self.work_dir = work_dir
        self.commit_id = commit_id if commit_id != '--worked' else ''
        self.baseline_commit_id = baseline_commit_id
        self.repo_path = repo_path
        self.repo_branch = repo_branch

        self.workspace = os.path.abspath(os.curdir)
        self.scm_diff_file = os.path.join(self.work_dir, SCM_DIFF_FILE_NAME)

        self.error_code = 0

    def init(self):
        context = {
            'work_dir': self.work_dir,
            'repo_path': self.repo_path,
            'repo_branch': self.repo_branch
        }
        ret, msg = POST_STATUS.health_check(SUB_SUB_PHASE.PREPROC_SCM_DODIFF, context)
        if ret != 0:
            self.error_code = ret
            raise Exception(msg)

    def exec(self):
        if os.path.exists(self.scm_diff_file):
            return

        if len(self.baseline_commit_id) == 0:
            with open(self.scm_diff_file, 'w') as stdout:
                pass
            return

        os.chdir(self.repo_path)
        params = ['git', 'diff', self.baseline_commit_id, self.commit_id, '--unified=0', '--output=%s' % self.scm_diff_file]
        command = ' '.join(params)
        print(command)
        ret = subprocess.run(command, shell=True)
        os.chdir(self.workspace)
        if ret.returncode != 0:
            self.error_code = -1
            raise Exception('call git diff failed, return code: %s' % ret.returncode)

    def fini(self):
        pass


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--work-dir', required=True)
    parser.add_argument('--commit-id', required=True)
    parser.add_argument('--baseline-commit-id', required=True)
    parser.add_argument('--repo-path', required=True)
    parser.add_argument('--repo-branch', type=str, default='')
    args = parser.parse_args()

    worker = SPGetScmDiff(args.work_dir, args.commit_id, args.baseline_commit_id, args.repo_path, args.repo_branch)
    init_time = datetime.datetime.utcnow()
    try:
        POST_STATUS.EXEC_PARAMETERS = '--work-dir %s --commit-id %s --baseline-commit-id %s --repo-path %s --repo-branch %s' % (
            args.work_dir, args.commit_id, args.baseline_commit_id, args.repo_path, args.repo_branch
        )
        POST_STATUS.init(SUB_SUB_PHASE.PREPROC_SCM_DODIFF, init_time=init_time)
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
        POST_STATUS.fini(SUB_SUB_PHASE.PREPROC_SCM_DODIFF, init_time=init_time)

    # client need this return code to continue
    sys.exit(0)

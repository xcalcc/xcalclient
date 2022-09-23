#!/usr/bin/env python3
# -*- coding:utf-8 -*-

import argparse
import datetime
import json
import os
import subprocess
import sys
import time

import requests

from scmErrorRecover import POST_STATUS, CONST_STR, SUB_SUB_PHASE

COMMIT_FILE_NAME = 'commit_id.txt'
REQUESTS_TIMEOUT = 10
EXIT_CODE_COMMIT_ID_SCANNED = 12
REQUESTS_RETRIES = 3
RETRIES_INTERVAL = 2

def search_scan_task_by_commit_id(h: str, s: str, c: str, t: str):
    try:
        url = '%s/api/scan_service/v2/scan_task/search?page=0&size=1&sort=modifiedOn,DESC' % h
        headers = {'Authorization': t}
        payload = {
            'projectId': s,
            'status': ['COMPLETED'],
            'equalAttributes': [{'type': 'SCAN', 'name': 'commitId', 'value': c}]
        }
        retry_times = 0
        while retry_times < REQUESTS_RETRIES:
            try:
                res = requests.post(url, json=payload, headers=headers, timeout=REQUESTS_TIMEOUT).json()
                return res['totalElements'], res['content'], None
            except requests.exceptions.RequestException:
                time.sleep(RETRIES_INTERVAL)
            finally:
                retry_times += 1
    except Exception as ex:
        return 0, None, ex


class SPGetCommitId:

    def __init__(self, work_dir: str, api_host: str, project_id: str, token: str, repo_path: str, repo_branch: str,
                 backtrack_times: int, delta_result: bool, git_folder_tolerance: bool,
                 commit_id: str, baseline_commit_id: str):
        self.work_dir = work_dir
        self.api_host = api_host
        self.project_id = project_id
        self.token = token
        self.repo_path = repo_path
        self.repo_branch = repo_branch
        self.backtrack_times = backtrack_times
        self.delta_result = delta_result
        self.git_folder_tolerance = git_folder_tolerance

        self.workspace = os.path.abspath(os.curdir)
        self.commit_file = os.path.join(self.work_dir, COMMIT_FILE_NAME)
        self.commit_id = commit_id
        self.baseline_commit_id = baseline_commit_id

        self.error_code = 0

    def init(self):
        context = {
            'work_dir': self.work_dir,
            'api_host': self.api_host,
            'project_id': self.project_id,
            'token': self.token,
            'repo_path': self.repo_path,
            'repo_branch': self.repo_branch,
            'backtrack_times': self.backtrack_times
        }
        ret, msg = POST_STATUS.health_check(SUB_SUB_PHASE.PREPROC_SCM_COMMIT, context)
        if ret != 0:
            self.error_code = ret
            raise Exception(msg)

    def exec(self):
        # commit id or baseline commit id is provided from args
        if self.commit_id or self.baseline_commit_id:
            with open(self.commit_file, 'w') as f:
                json.dump({'commit_id': self.commit_id, 'baseline_commit_id': self.baseline_commit_id}, f)
            return

        # commit id file already exist
        if os.path.exists(self.commit_file):
            with open(self.commit_file, 'r') as f:
                ctx = json.load(f)
                self.commit_id = ctx.get('commit_id', '') or ''
                self.baseline_commit_id = ctx.get('baseline_commit_id', '') or ''
            return

        # get commit id and baseline commit id
        while True:
            print("[INFO] git folder tolerance set to be %s" % self.git_folder_tolerance)
            found_git_folder_in_repo = os.path.exists(os.path.join(self.repo_path, '.git'))
            if not found_git_folder_in_repo:
               print("[INFO] .git folder cannot be found in %s" % self.repo_path)
               if not self.git_folder_tolerance:
                    print("[ERROR] Repo path [%s] does not contain .git folder and gitFolderTolerance is set to false, skip commit id fetching" % self.repo_path)
                    break
               else:
                    print("[INFO] Allowing git to search from parent folders")
            
            '''
            > cd repo_path
            > git log -2 --no-merges --pretty=format:%H/%an
            commit_id/author
            baseline_commit_id/author
            > cd workspace
            '''
            os.chdir(self.repo_path)            
            params = ['git', 'log', '-%d' % (self.backtrack_times + 1), '--no-merges', '--pretty=format:%H/%an']
            print(' '.join(params))
            print("[INFO] Call git command [%s]" % (' '.join(params)))
            ret = subprocess.run(params, stdout=subprocess.PIPE)
            lines = ret.stdout.decode().split('\n')
            os.chdir(self.workspace)

            if not self.delta_result:
                if len(lines) > 0:
                    self.commit_id = lines[0][:lines[0].index('/')]
                    lines = lines[1:]

                if self.commit_id is not None:
                    # cancel scan when commit id already has completed scan task
                    st_count, st_list, err = search_scan_task_by_commit_id(
                        self.api_host,
                        self.project_id,
                        self.commit_id,
                        self.token
                    )
                    if err is not None:
                        self.error_code = -1
                        raise Exception('search scan task by commit id (%s) failed, error: %s' % (
                            self.commit_id, repr(err)
                        ))
                    if st_count > 0:
                        self.error_code = EXIT_CODE_COMMIT_ID_SCANNED
                        raise Exception('commit id (%s) has already scan completed' % self.commit_id)
            else:
                self.commit_id = '--worked'

            if len(self.commit_id) == 0:
                break

            # need checkout repo_branch to find baseline commit id
            # because baseline commit id in repo_path maybe temporary
            if len(self.repo_branch) != 0:
                '''
                > cd repo_path
                > git checkout repo_branch
                > git pull
                > git log -1 --no-merges --pretty=format:%H/%an
                baseline_commit_id/author
                > git checkout -f commit_id
                > cd workspace
                '''
                os.chdir(self.repo_path)
                params = ['git', 'checkout', self.repo_branch]
                print(' '.join(params))
                subprocess.run(params, stdout=subprocess.PIPE)
                params = ['git', 'pull']
                print(' '.join(params))
                subprocess.run(params, stdout=subprocess.PIPE)
                params = ['git', 'log', '-%d' % self.backtrack_times, '--no-merges', '--pretty=format:%H/%an']
                print(' '.join(params))
                ret = subprocess.run(params, stdout=subprocess.PIPE)
                lines = ret.stdout.decode().split('\n')
                params = ['git', 'checkout', '-f', self.commit_id]
                print(' '.join(params))
                subprocess.run(params, stdout=subprocess.PIPE)
                os.chdir(self.workspace)

            backtrack, index = 0, 0
            while backtrack < self.backtrack_times and index < len(lines) and len(self.baseline_commit_id) == 0:
                self.baseline_commit_id = lines[index][:lines[index].index('/')]
                backtrack += 1
                index += 1

                st_count, st_list, err = search_scan_task_by_commit_id(
                    self.api_host,
                    self.project_id,
                    self.baseline_commit_id,
                    self.token
                )
                if err is not None:
                    self.error_code = -1
                    raise Exception('search scan task by baseline commit id (%s) failed, error: %s' % (
                        self.baseline_commit_id, repr(err)
                    ))
                if st_count == 0:
                    self.baseline_commit_id = ''

            if len(self.commit_id) > 0 and len(self.baseline_commit_id) > 0:
                # cancel scan when commit id is equal to baseline commit id
                if self.commit_id == self.baseline_commit_id:
                    self.error_code = -1
                    raise Exception('commit id (%s) is same to baseline commit id' % self.commit_id)

            break

        with open(self.commit_file, 'w') as f:
            json.dump({'commit_id': self.commit_id, 'baseline_commit_id': self.baseline_commit_id}, f)

    def fini(self):
        pass


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--work-dir', required=True)
    parser.add_argument('--api-host', required=True)
    parser.add_argument('--project-id', required=True)
    parser.add_argument('--token', required=True)
    parser.add_argument('--repo-path', required=True)
    parser.add_argument('--repo-branch', type=str, default='')
    parser.add_argument('--backtrack-times', type=int, default=CONST_STR.BACKTRACK_TIMES.value)
    parser.add_argument('--delta-result', action='store_true')
    args = parser.parse_args()

    worker = SPGetCommitId(args.work_dir, args.api_host, args.project_id, args.token, args.repo_path, args.repo_branch,
                           args.backtrack_times, args.delta_result)
    init_time = datetime.datetime.utcnow()
    try:
        POST_STATUS.EXEC_PARAMETERS = '--work-dir %s --api-host %s --project-id %s --token %s --repo-path %s --repo-branch %s --backtrack-times %d --delta-result %s' % (
            args.work_dir, args.api_host, args.project_id, args.token, args.repo_path, args.repo_branch,
            args.backtrack_times, args.delta_result
        )
        POST_STATUS.init(SUB_SUB_PHASE.PREPROC_SCM_COMMIT, init_time=init_time)
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
        POST_STATUS.fini(SUB_SUB_PHASE.PREPROC_SCM_COMMIT, init_time=init_time)

    # client need this return code to continue
    sys.exit(0)

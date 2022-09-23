#!/usr/bin/env python3
# -*- coding:utf-8 -*-

import argparse
import datetime
import logging
import sys, os

currentdir = os.path.dirname(os.path.realpath(__file__))
parentdir = os.path.dirname(currentdir)
parentparentdir = os.path.dirname(parentdir)
sys.path.append(parentdir)
sys.path.append(parentparentdir)

from scmErrorRecover import POST_STATUS, CONST_STR, SUB_SUB_PHASE
from spGetCommitId import SPGetCommitId
from spGetScmDiff import SPGetScmDiff

# Read version
from common.ReadVersion import read_ver
VERSION = read_ver()
print('starting SCM module with version: %s' % VERSION)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('-op', required=True)
    parser.add_argument('-api', required=True)
    parser.add_argument('-pid', required=True)
    parser.add_argument('-token', required=True)
    parser.add_argument('-rp', required=True)
    parser.add_argument('-rb', type=str, default='')
    parser.add_argument('-bt', type=int, default=CONST_STR.BACKTRACK_TIMES.value)
    parser.add_argument('-dr', action='store_true')
    parser.add_argument('--git-folder-tolerance', action = 'store_true', default=False)
    parser.add_argument('--commit-id', type=str, required=False, default='')
    parser.add_argument('--baseline-commit-id', type=str, required=False, default='')

    args = parser.parse_args()

    # scm sub phase --- get commit id and baseline commit id
    sp1 = SPGetCommitId(args.op, args.api, args.pid, args.token, args.rp, args.rb, int(args.bt), args.dr, args.git_folder_tolerance, args.commit_id, args.baseline_commit_id)

    try:
        POST_STATUS.EXEC_PARAMETERS = '--work-dir %s --api-host %s --project-id %s --token %s --repo-path %s --repo-branch %s --backtrack-times %d --delta-result %s --commit-id %s --baseline-commit-id %s' % (
            args.op, args.api, args.pid, args.token, args.rp, args.rb, int(args.bt), args.dr, args.commit_id, args.baseline_commit_id
        )
        POST_STATUS.init(SUB_SUB_PHASE.PREPROC_SCM_COMMIT)
        sp1.init()
        sp1.exec()
        sp1.fini()
    except Exception as e:
        logging.exception(e)
        POST_STATUS.FINI_STATUS = sp1.error_code
        # POST_STATUS.print_to_controller('Error Code : %s' % sp1.error_code)
        # POST_STATUS.print_to_controller('Error Message : %s' % e)
    finally:
        POST_STATUS.fini(SUB_SUB_PHASE.PREPROC_SCM_COMMIT)

    # scm sub phase --- get scm_diff.txt
    sp2 = SPGetScmDiff(args.op, sp1.commit_id, sp1.baseline_commit_id, args.rp, args.rb)
    init_time = datetime.datetime.utcnow()
    try:
        POST_STATUS.EXEC_PARAMETERS = '--work-dir %s --commit-id %s --baseline-commit-id %s --repo-path %s --repo-branch %s' % (
            args.op, sp1.commit_id, sp1.baseline_commit_id, args.rp, args.rb
        )

        POST_STATUS.init(SUB_SUB_PHASE.PREPROC_SCM_DODIFF, init_time=init_time)
        sp2.init()
        sp2.exec()
        sp2.fini()
    except Exception as e:
        print(e, flush=True)
        POST_STATUS.FINI_STATUS = sp2.error_code
        # POST_STATUS.print_to_controller('Error Code : %s' % sp2.error_code)
        # POST_STATUS.print_to_controller('Error Message : %s' % e)
    finally:
        POST_STATUS.fini(SUB_SUB_PHASE.PREPROC_SCM_DODIFF, init_time=init_time)

    # client need this return code to continue
    sys.exit(0)

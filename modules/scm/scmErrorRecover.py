#!/usr/bin/env python3
# -*- coding:utf-8 -*-

import datetime
import os
import sys

from enum import Enum, IntEnum, unique

import psutil

PHASE_OFFSET = 4
SUBPHASE_OFFSET = 4
SUBSUBPHASE_OFFSET = 8

DEFAULT_MASK = 0x00000000
USERVIS_MASK = 0x10000000

UNKNOWN_ERROR = 'unknown'


@unique
class CONST_STR(Enum):
    LOG_FORMATTER = "'%(asctime)20s - %(levelname)-8s - %(message)s'"
    BACKTRACK_TIMES = 10


@unique
class STATUS(IntEnum):
    SUCC = 0
    COND_SUCC = 1
    FAILED = 2
    FATAL = 3
    ABORTED = 4


@unique
class PHASE(IntEnum):
    SETUP = 1
    PREPROC = 2
    PROC = 3
    POSTPROC = 4


@unique
class SUB_PHASE(IntEnum):
    PREPROC_SCM = (PHASE.SETUP << PHASE_OFFSET) + 1


@unique
class SUB_SUB_PHASE(IntEnum):
    PREPROC_SCM_COMMIT = (SUB_PHASE.PREPROC_SCM << SUBPHASE_OFFSET) + 1
    PREPROC_SCM_DODIFF = (SUB_PHASE.PREPROC_SCM << SUBPHASE_OFFSET) + 2
    PREPROC_SCM_SOURCE = (SUB_PHASE.PREPROC_SCM << SUBPHASE_OFFSET) + 3


@unique
class ERROR_CODE(IntEnum):
    PREPROC_SCM_COMMIT_INVALID_WORK_DIR = (SUB_SUB_PHASE.PREPROC_SCM_COMMIT << SUBSUBPHASE_OFFSET) + 1 | USERVIS_MASK
    PREPROC_SCM_COMMIT_INVALID_API_HOST = (SUB_SUB_PHASE.PREPROC_SCM_COMMIT << SUBSUBPHASE_OFFSET) + 2 | USERVIS_MASK
    PREPROC_SCM_COMMIT_INVALID_PROJECT_ID = (SUB_SUB_PHASE.PREPROC_SCM_COMMIT << SUBSUBPHASE_OFFSET) + 3 | USERVIS_MASK
    PREPROC_SCM_COMMIT_INVALID_TOKEN = (SUB_SUB_PHASE.PREPROC_SCM_COMMIT << SUBSUBPHASE_OFFSET) + 4 | USERVIS_MASK
    PREPROC_SCM_COMMIT_INVALID_REPO_PATH = (SUB_SUB_PHASE.PREPROC_SCM_COMMIT << SUBSUBPHASE_OFFSET) + 5 | USERVIS_MASK
    PREPROC_SCM_COMMIT_INVALID_BACKTRACK = (SUB_SUB_PHASE.PREPROC_SCM_COMMIT << SUBSUBPHASE_OFFSET) + 6 | USERVIS_MASK
    PREPROC_SCM_DODIFF_INVALID_WORK_DIR = (SUB_SUB_PHASE.PREPROC_SCM_COMMIT << SUBSUBPHASE_OFFSET) + 7 | USERVIS_MASK
    PREPROC_SCM_DODIFF_INVALID_REPO_PATH = (SUB_SUB_PHASE.PREPROC_SCM_COMMIT << SUBSUBPHASE_OFFSET) + 8 | USERVIS_MASK
    PREPROC_SCM_SOURCE_INVALID_WORK_DIR = (SUB_SUB_PHASE.PREPROC_SCM_COMMIT << SUBSUBPHASE_OFFSET) + 9 | USERVIS_MASK
    PREPROC_SCM_SOURCE_INVALID_SOURCES = (SUB_SUB_PHASE.PREPROC_SCM_COMMIT << SUBSUBPHASE_OFFSET) + 10 | USERVIS_MASK
    PREPROC_SCM_SOURCE_INVALID_HOST_PATH = (SUB_SUB_PHASE.PREPROC_SCM_COMMIT << SUBSUBPHASE_OFFSET) + 11 | USERVIS_MASK


# error message table
error_message = {
    ERROR_CODE.PREPROC_SCM_COMMIT_INVALID_WORK_DIR: 'work dir does not exists',
    ERROR_CODE.PREPROC_SCM_COMMIT_INVALID_API_HOST: 'api host is empty',
    ERROR_CODE.PREPROC_SCM_COMMIT_INVALID_PROJECT_ID: 'project id is empty',
    ERROR_CODE.PREPROC_SCM_COMMIT_INVALID_TOKEN: 'token is empty',
    ERROR_CODE.PREPROC_SCM_COMMIT_INVALID_REPO_PATH: 'repo path does not exists',
    ERROR_CODE.PREPROC_SCM_COMMIT_INVALID_BACKTRACK: 'backtrack times is less than 1',
    ERROR_CODE.PREPROC_SCM_DODIFF_INVALID_WORK_DIR: 'work dir does not exists',
    ERROR_CODE.PREPROC_SCM_DODIFF_INVALID_REPO_PATH: 'repo path does not exists',
    ERROR_CODE.PREPROC_SCM_SOURCE_INVALID_WORK_DIR: 'work dir does not exists',
    ERROR_CODE.PREPROC_SCM_SOURCE_INVALID_SOURCES: 'source files file does not exists',
    ERROR_CODE.PREPROC_SCM_SOURCE_INVALID_HOST_PATH: 'host path does not exists'
}


# -------------------------default health check function------------------------- #


def default_scm_get_commit_id_health_check(context: dict):
    work_dir = context.get('work_dir', '') or ''
    if len(work_dir) == 0 or not os.path.exists(work_dir):
        return ERROR_CODE.PREPROC_SCM_COMMIT_INVALUD_WORK_DIR.value, \
               error_message.get(ERROR_CODE.PREPROC_SCM_COMMIT_INVALUD_WORK_DIR, UNKNOWN_ERROR)
    api_host = context.get('api_host', '') or ''
    if len(api_host) == 0:
        return ERROR_CODE.PREPROC_SCM_COMMIT_INVALID_API_HOST.value, \
               error_message.get(ERROR_CODE.PREPROC_SCM_COMMIT_INVALID_API_HOST, UNKNOWN_ERROR)
    project_id = context.get('project_id', '') or ''
    if len(project_id) == 0:
        return ERROR_CODE.PREPROC_SCM_COMMIT_INVALID_PROJECT_ID.value, \
               error_message.get(ERROR_CODE.PREPROC_SCM_COMMIT_INVALID_PROJECT_ID, UNKNOWN_ERROR)
    token = context.get('token', '') or ''
    if len(token) == 0:
        return ERROR_CODE.PREPROC_SCM_COMMIT_INVALID_TOKEN.value, \
               error_message.get(ERROR_CODE.PREPROC_SCM_COMMIT_INVALID_TOKEN, UNKNOWN_ERROR)
    repo_path = context.get('repo_path', '') or ''
    if len(repo_path) == 0 or not os.path.exists(work_dir):
        return ERROR_CODE.PREPROC_SCM_COMMIT_INVALID_REPO_PATH.value, \
               error_message.get(ERROR_CODE.PREPROC_SCM_COMMIT_INVALID_REPO_PATH, UNKNOWN_ERROR)
    backtrack_times = context.get('backtrack_times', 0) or 0
    if int(backtrack_times) < 1:
        return ERROR_CODE.PREPROC_SCM_COMMIT_INVALID_BACKTRACK.value, \
               error_message.get(ERROR_CODE.PREPROC_SCM_COMMIT_INVALID_BACKTRACK, UNKNOWN_ERROR)
    return 0, ''


def default_scm_get_diff_file_health_check(context: dict):
    work_dir = context.get('work_dir', '') or ''
    if len(work_dir) == 0 or not os.path.exists(work_dir):
        return ERROR_CODE.PREPROC_SCM_DODIFF_INVALID_WORK_DIR.value, \
               error_message.get(ERROR_CODE.PREPROC_SCM_DODIFF_INVALID_WORK_DIR, UNKNOWN_ERROR)
    repo_path = context.get('repo_path', '') or ''
    if len(repo_path) == 0 or not os.path.exists(work_dir):
        return ERROR_CODE.PREPROC_SCM_DODIFF_INVALID_REPO_PATH.value, \
               error_message.get(ERROR_CODE.PREPROC_SCM_DODIFF_INVALID_REPO_PATH, UNKNOWN_ERROR)
    return 0, ''


def default_scm_get_source_code_health_check(context: dict):
    work_dir = context.get('work_dir', '') or ''
    if len(work_dir) == 0 or not os.path.exists(work_dir):
        return ERROR_CODE.PREPROC_SCM_SOURCE_INVALID_WORK_DIR.value, \
               error_message.get(ERROR_CODE.PREPROC_SCM_SOURCE_INVALID_WORK_DIR, UNKNOWN_ERROR)
    source_files_file = context.get('source_files_file', '') or ''
    if len(source_files_file) == 0 or not os.path.exists(work_dir):
        return ERROR_CODE.PREPROC_SCM_SOURCE_INVALID_SOURCES.value, \
               error_message.get(ERROR_CODE.PREPROC_SCM_SOURCE_INVALID_SOURCES, UNKNOWN_ERROR)
    host_path = context.get('host_path', '') or ''
    if len(host_path) == 0 or not os.path.exists(work_dir):
        return ERROR_CODE.PREPROC_SCM_SOURCE_INVALID_HOST_PATH.value, \
               error_message.get(ERROR_CODE.PREPROC_SCM_SOURCE_INVALID_HOST_PATH, UNKNOWN_ERROR)
    return 0, ''


# ------------------------------------------------------------------------------- #


# health check function table
health_check_func = {
    SUB_SUB_PHASE.PREPROC_SCM_COMMIT: default_scm_get_commit_id_health_check,
    SUB_SUB_PHASE.PREPROC_SCM_DODIFF: default_scm_get_diff_file_health_check,
    SUB_SUB_PHASE.PREPROC_SCM_SOURCE: default_scm_get_source_code_health_check
}


class POST_STATUS:
    """
    POST_STATUS() will do init, health check, fini and post status of main()
    the format of output message of post_status() is:
        "[FLOW]$stage_enum: $status_enum ($arguments of main())"
    the format of output message of init() is:
        "[FLOW]$stage_str: init"
    the format of output message of fini() is:
        "[FLOW]$stage_str: fini"
    """
    SCAN_TASK_ID = ""
    EXEC_PARAMETERS = ""
    FINI_STATUS = 0

    @staticmethod
    def print_to_controller(msg: str, time: datetime = None):
        gmt_format = '%Y-%m-%d %H:%M:%S'
        if time:
            log_time = time.strftime(gmt_format)
        else:
            log_time = datetime.datetime.utcnow().strftime(gmt_format)
        print("%s, %s\n" % (log_time, msg))

    @staticmethod
    def status(sub_sub_phase: SUB_SUB_PHASE):
        msg = "[FLOW]%s, %s (%s)" % (sub_sub_phase.name, POST_STATUS.FINI_STATUS, POST_STATUS.EXEC_PARAMETERS)
        POST_STATUS.print_to_controller(msg)

    @staticmethod
    def health_query(sub_sub_phase: SUB_SUB_PHASE):
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        health_msg = "Memory: total=%0.2fG used=%0.2fG free=%0.2fG, Disk: total=%0.2fG used=%0.2fG free=%0.2fG" % \
                     (memory.total / 1024 / 1024 / 1024,
                      memory.used / 1024 / 1024 / 1024,
                      memory.free / 1024 / 1024 / 1024,
                      disk.total / 1024 / 1024 / 1024,
                      disk.used / 1024 / 1024 / 1024,
                      disk.free / 1024 / 1024 / 1024)
        msg = "[FLOW]%s, %s" % (sub_sub_phase.name, health_msg)
        POST_STATUS.print_to_controller(msg)

    @staticmethod
    def health_check(sub_sub_phase: SUB_SUB_PHASE, context: dict):
        return health_check_func[sub_sub_phase](context) if sub_sub_phase in health_check_func else (0, '')

    @staticmethod
    def init(sub_sub_phase: SUB_SUB_PHASE, init_time: datetime = None):
        msg = "[FLOW]%s, init" % sub_sub_phase.name
        if init_time is None:
            init_time = datetime.datetime.utcnow()
        POST_STATUS.print_to_controller(msg, time=init_time)
        POST_STATUS.health_query(sub_sub_phase)

    @staticmethod
    def fini(sub_sub_phase: SUB_SUB_PHASE, init_time: datetime = None):
        if init_time is None:
            init_time = datetime.datetime.utcnow()

        fini_time = datetime.datetime.utcnow()
        elapse_time = fini_time - init_time

        POST_STATUS.status(sub_sub_phase)
        msg = "[FLOW]%s, fini,Elapse Time(%s mSec)" % (sub_sub_phase.name, elapse_time.total_seconds() * 1000)
        POST_STATUS.print_to_controller(msg, time=fini_time)

        if POST_STATUS.FINI_STATUS != 0:
            POST_STATUS.print_to_stderr('0x%08X' % POST_STATUS.FINI_STATUS)
            sys.exit(POST_STATUS.FINI_STATUS)

    @staticmethod
    def print_to_stderr(msg: str):
        print(msg, file=sys.stderr)

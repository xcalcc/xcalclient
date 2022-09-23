#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import psutil
import sys
import datetime
from sys import stderr
from enum import Enum, unique


class CONST_STR(Enum):
    LOG_FORMATTER = '\'%(asctime)20s - %(levelname)-8s - %(message)s\''
    BACKTRACK_TIMES = 10


class ERROR(Exception):
    pass


# PRE_SCM is sub phase of preprocess
class E_PRE_SCM_FAILURE(ERROR):
    def __init__(self, ErrMsg):
        self.ErrMsg = ErrMsg

    def __str__(self):
        return repr(self.ErrMsg)


class E_PRE_SCM_TIMEOUT(ERROR):
    pass

@unique
class SETUP(Enum):
    PROJ_CONF = 0
    CR_PROJ = 1
    SCM_SRC = 2


@unique
class PREPROC(Enum):
    PREP_SRC = 8
    GET_SRC = 9
    BUILD = 10
    UP_FILE = 11
    SP_COMMIT_ID = 12
    SP_SCM_DIFF = 13
    SP_SRC_ZIP = 14


@unique
class PROC(Enum):
    ENGINE_MERGE = 16
    VTXTDIFF = 17
    V2CSF = 18
    UP_CSF = 19


@unique
class POSTPROC(Enum):
    INJECT_DB = 24
    HISTORY = 25
    COLL_RES = 26
    RPT_RES = 27


@unique
class STATUS(Enum):
    SUCC = 0
    COND_SUCC = 1
    FAILED = 2
    FATAL = 3
    ABORTED = 4


class POST_STATUS(object):
    """
    POST_STATUS() will do init, health check, fini and post status of main()
    the format of output message of post_status() is:
        "[FLOW]$stage_enum, $status_enum ($arguments of main())"
    the format of output message of init() is:
        "[FLOW]$stage_str, init"
    the format of output message of fini() is:
        "[FLOW]$stage_str, fini"
    """
    SCAN_TASK_ID = ""
    EXEC_PARAMETERS = ""
    FINI_STATUS = ""
    EXIT_CODE = 1

    @staticmethod
    def error(errorCode: str, errorMessage: str):
        if not errorCode is None:
            POST_STATUS.print_to_controller("Error Code : %s" % errorCode)
        if not errorMessage is None:
            POST_STATUS.print_to_controller("Error Message : %s" % errorMessage)

    @staticmethod
    def print_to_controller(msg: str, time:datetime = None):
        gmt_format = '%Y-%m-%d %H:%M:%S'
        if time:
            log_time = time.strftime(gmt_format)
        else:
            log_time = datetime.datetime.utcnow().strftime(gmt_format)
        print("%s, %s\n" % (log_time, msg))

    @staticmethod
    def status(stage: str, stage_enum: int):
        msg = "[FLOW]%s, %s (%s)" % (stage, POST_STATUS.FINI_STATUS, POST_STATUS.EXEC_PARAMETERS)
        POST_STATUS.print_to_controller(msg)

    @staticmethod
    def health_query(stage: str):
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        health_msg = "Memory: total=%0.2fG used=%0.2fG free=%0.2fG, Disk: total=%0.2fG used=%0.2fG free=%0.2fG" % \
                     (memory.total / 1024 / 1024 / 1024,
                      memory.used / 1024 / 1024 / 1024,
                      memory.free / 1024 / 1024 / 1024,
                      disk.total / 1024 / 1024 / 1024,
                      disk.used / 1024 / 1024 / 1024,
                      disk.free / 1024 / 1024 / 1024)
        msg = "[FLOW]%s, %s" % (stage, health_msg)
        POST_STATUS.print_to_controller(msg)

    @staticmethod
    def init(stage: str, stage_enum: int, init_time:datetime=None):
        msg = "[FLOW]%s, init" % stage

        if init_time is None:
            init_time=datetime.datetime.utcnow()

        POST_STATUS.print_to_controller(msg, time=init_time )
        POST_STATUS.health_query(stage)

    @staticmethod
    def fini(stage: str, stage_enum: int, init_time:datetime=None):
        if init_time is None:
            init_time=datetime.datetime.utcnow()

        fini_time=datetime.datetime.utcnow()
        elapse_time=fini_time-init_time

        POST_STATUS.status(stage, stage_enum)
        msg = "[FLOW]%s, fini,Elapse Time(%s mSec)" % (stage,elapse_time.total_seconds()*1000)
        POST_STATUS.print_to_controller(msg, time=fini_time)

        if not POST_STATUS.FINI_STATUS == "":
            POST_STATUS.print_to_stderr(POST_STATUS.FINI_STATUS)
            sys.exit(POST_STATUS.EXIT_CODE)

    @staticmethod
    def print_to_stderr(mess: str):
        print(mess, file=stderr)

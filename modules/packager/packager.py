#!/usr/bin/env python3

#
#  Copyright (C) 2021 Xcalibyte (Shenzhen) Limited.
#
import json
import logging
import os, sys
import argparse
import datetime

currentdir = os.path.dirname(os.path.realpath(__file__))
parentdir = os.path.dirname(currentdir)
parentparentdir = os.path.dirname(parentdir)
sys.path.append(parentdir)
sys.path.append(parentparentdir)

from common.ConfigObject import ConfigObject
from common.XcalException import XcalException
from common.ErrorRecover import POST_STATUS, PREPROC
from package_service import PackageService

from xcal_common.py.error import EFolderNotexist, EFolderPermissionError, XcalError
from xcal_common.py.utils import get_canonical_error_name
from common.xcal_logging import setup_logging

# Read version
from common.ReadVersion import read_ver
VERSION = read_ver()
print('starting packager module with version: %s' % VERSION)

logger = logging.getLogger(__name__)


def get_parser():
    parser = argparse.ArgumentParser(description = 'Packager, driving the prepare pack process')
    parser.add_argument('--output-path', '-op', dest = 'output_path', required = True,
                        help = "Output file path")
    parser.add_argument('--project-conf', '-pc', dest = 'project_conf', type = argparse.FileType('r'),
                        metavar = 'xcal-project.conf', required = True, help = 'project config file')
    parser.add_argument('--debug', '-d', dest = 'debug', action = 'store_true', default = False,
                        help = 'enable debug mode')
    return parser


class InputProcess(object):

    @staticmethod
    def check_args(args):
        logger.info("begin to check input: %s" % args)

        if not os.path.isdir(args.output_path) or not os.path.exists(args.output_path):
            logger.error("output path does not exist: %s" % args.output_path)
            raise EFolderNotexist

        if not os.access(os.path.join(str(args.output_path)), os.W_OK | os.R_OK):
            logger.error("output path is not readable/writable: %s" % args.output_path)
            raise EFolderPermissionError

    @staticmethod
    def process_args(args):
        """
        parse all the command line options, fill it into a dict object.
        command line option may override the value which filled in the conf file
        :param args:
        :return: a dict object
        """
        logger.info("begin to process input: %s" % args)

        project_conf = ConfigObject.merge_two_dicts(None, json.load(args.project_conf))
        if args.output_path is not None:
            project_conf['outputPath'] = args.output_path

        return project_conf


if __name__ == "__main__":
    init_time = datetime.datetime.utcnow()
    try:
        args = get_parser().parse_args()

        log_level = logging.DEBUG if args.debug else logging.INFO
        setup_logging(default_level = log_level)

        InputProcess.check_args(args)
        project_conf = InputProcess.process_args(args)

        logger.debug("after process, arguments: %s" % project_conf)

        POST_STATUS.EXEC_PARAMETERS = " --project-conf " + str(args.project_conf.name) \
                                      + " --output-path " + str(args.output_path)
        POST_STATUS.init(PREPROC.PREP_SRC.name, PREPROC.PREP_SRC.value, init_time=init_time)

        package_service = PackageService(project_conf)
        if project_conf.get("gitUrl") is None:
            if project_conf.get("uploadSource") is True:
                package_service.compress_source_code()
        package_service.prepare_file_info()
    except XcalError as err:
        POST_STATUS.FINI_STATUS = get_canonical_error_name(err)
    except XcalException as err:
        POST_STATUS.FINI_STATUS = err.err_code.name
    except Exception as err:
        logger.exception(err)
        POST_STATUS.FINI_STATUS = err.__class__.__name__
    finally:
        POST_STATUS.fini(PREPROC.PREP_SRC.name, PREPROC.PREP_SRC.value, init_time=init_time)
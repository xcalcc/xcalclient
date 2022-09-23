#!/usr/bin/env python3

#
#  Copyright (C) 2021 Xcalibyte (Shenzhen) Limited.
#
import json
import sys, os

currentdir = os.path.dirname(os.path.realpath(__file__))
parentdir = os.path.dirname(currentdir)
parentparentdir = os.path.dirname(parentdir)
sys.path.append(parentdir)
sys.path.append(parentparentdir)

from common.ConfigObject import ConfigObject
from common.xcal_logging import setup_logging


import logging
import argparse
import datetime

from common.XcalException import XcalException
from xcal_build_task import XcalBuildTask
from common.ErrorRecover import POST_STATUS, PREPROC
from xcal_common.py.utils import get_canonical_error_name
from xcal_common.py.error import EFolderNotexist, EFolderPermissionError, XcalError, EXcalbuildFail, ENoIFileGenerated

# Read version
from common.ReadVersion import read_ver
VERSION = read_ver()
print('starting packager module with version: %s' % VERSION)

logger = logging.getLogger(__name__)


def get_parser():
    parser = argparse.ArgumentParser(description = 'xcal build, driving the entire preprocess process')

    parser.add_argument('--output-path', '-op', dest = 'output_path', required = True
                        , help = "Output file path")
    parser.add_argument('--xcalbuild-path', '-xp', dest = 'xcalbuild_path', required = True
                        , help = "xcalbuild's path")
    parser.add_argument('--project-conf', '-pc', dest = 'project_conf', type = argparse.FileType('r'),
                        metavar = 'xcal-project.conf', required = True, help = 'project config file')
    parser.add_argument('--suppress-rules-list-file', '-srlf', dest = 'suppress_rules_list_file', required = False
                        , help = "Suppress any scan result that is attributed to rules appear in the list. This file is only used by the cppcheck plugin, not used by the Xcalibyte scan engine")
    parser.add_argument('--process-link-using-compiler', '-pluc', dest = 'process_link_using_compiler', action = 'store_true', default = False,
                        help = 'enable process link using compiler option for xcalbuild')
    parser.add_argument('--debug', '-d', dest = 'debug', action = 'store_true', default = False,
                        help = 'enable debug mode')

    parser.add_argument('--scan-all', dest = 'scan_all', action = 'store_true', default = False,
                        help = 'scan all file')

    parser.add_argument('--fwl', dest = 'fwl', required = False,
                        help = 'whitelist filter command')
    parser.add_argument('--fbl', dest = 'fbl', required = False,
                        help = 'blacklist filter command')
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

        if not os.path.exists(args.xcalbuild_path):
            logger.error("xcal build tool does not exist: %s" % args.xcalbuild_path)
            raise EFolderNotexist

        if not os.access(os.path.join(str(args.xcalbuild_path)), os.X_OK):
            logger.error("xcal build tool is not executable: %s" % args.xcalbuild_path)
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
        if args.xcalbuild_path is not None:
            project_conf['xcalbuildPath'] = args.xcalbuild_path
        if args.suppress_rules_list_file is not None:
            project_conf['suppressRulesListFile'] = args.suppress_rules_list_file
        if args.scan_all is not None:
            project_conf['scan_all'] = args.scan_all
        if args.fwl is not None:
            project_conf['fwl'] = args.fwl
        if args.fbl is not None:
            project_conf['fbl'] = args.fbl
        if args.debug is not None:
            project_conf['debug'] = args.debug
        if args.process_link_using_compiler is not None:
            project_conf['processLinkUsingCompiler'] = args.process_link_using_compiler

        project_conf = ConfigObject.merge_two_dicts(project_conf, project_conf.get("scanConfig"))

        return project_conf


if __name__ == "__main__":
    init_time=datetime.datetime.utcnow()
    try:
        args, unknown_args = get_parser().parse_known_args()

        log_level = logging.DEBUG if args.debug else logging.INFO
        setup_logging(default_level = log_level)

        InputProcess.check_args(args)
        project_conf = InputProcess.process_args(args)

        logger.debug("after process, arguments: %s" % project_conf)

        POST_STATUS.EXEC_PARAMETERS = " --project-conf " + str(args.project_conf.name) \
                                      + " --xcalbuild-path " + str(args.xcalbuild_path) \
                                      + " --output-path " + str(args.output_path)

        if 'suppressRulesListFile' in project_conf.keys():
            POST_STATUS.EXEC_PARAMETERS += " --suppress-rules-list-file " + str(args.suppress_rules_list_file)

        if 'fwl' in project_conf.keys():
            POST_STATUS.EXEC_PARAMETERS += " --fwl " + str(args.fwl)

        if 'fbl' in project_conf.keys():
            POST_STATUS.EXEC_PARAMETERS += " --fbl " + str(args.fbl)

        POST_STATUS.init(PREPROC.BUILD.name, PREPROC.BUILD.value, init_time = init_time)

        XcalBuildTask().build_task(project_conf, unknown_args)
    except ENoIFileGenerated as err:
        POST_STATUS.FINI_STATUS = get_canonical_error_name(err)
        POST_STATUS.EXIT_CODE = 4
    except EXcalbuildFail as err:
        POST_STATUS.FINI_STATUS = get_canonical_error_name(err)
        POST_STATUS.EXIT_CODE = 5
    except XcalError as err:
        POST_STATUS.FINI_STATUS = get_canonical_error_name(err)
        POST_STATUS.EXIT_CODE = 1
    except XcalException as err:
        POST_STATUS.FINI_STATUS = err.err_code.name
        POST_STATUS.EXIT_CODE = 1
    except Exception as err:
        logger.exception(err)
        POST_STATUS.FINI_STATUS = err.__class__.__name__
        POST_STATUS.EXIT_CODE = 1
    finally:
        POST_STATUS.fini(PREPROC.BUILD.name, PREPROC.BUILD.value, init_time=init_time)




#!/usr/bin/env python3

#
#  Copyright (C) 2021 Xcalibyte (Shenzhen) Limited.
#
import json
import re
import sys
import os
import logging
import argparse
import datetime

currentdir = os.path.dirname(os.path.realpath(__file__))
parentdir = os.path.dirname(currentdir)
parentparentdir = os.path.dirname(parentdir)
sys.path.append(parentdir)
sys.path.append(parentparentdir)

from common.ConfigObject import ConfigObject
from common.xcal_logging import setup_logging
from file_service import FileService


from common.ErrorRecover import POST_STATUS, PREPROC
from xcal_common.py.error import XcalError, EFolderNotexist, EFolderPermissionError
from xcal_common.py.utils import get_canonical_error_name

# Read version
from common.ReadVersion import read_ver
VERSION = read_ver()
print('starting uploader module with version: %s' % VERSION)

logger = logging.getLogger(__name__)


def get_parser():
    parser = argparse.ArgumentParser(description = 'xcal upload, driving the entire upload process')

    parser.add_argument('--project-conf', '-pc', dest = 'project_conf', type = argparse.FileType('r'),
                        metavar = 'xcal-project.conf', required = True, help = 'project config file')
    parser.add_argument('--url', '-url', dest = 'url', required = True,
                        help = 'file service url')
    parser.add_argument('--file-dir', '-fd', dest = 'file_dir', required = True,
                        help = "upload file dir")

    parser.add_argument('--project-id', '-pid', dest = 'project_id', required = False,
                        help = 'the unique id of the project')
    parser.add_argument('--debug', '-d', dest = 'debug', action = 'store_true', default = False,
                        help = 'enable debug mode')
    return parser


class InputProcess(object):

    @staticmethod
    def url_is_valid(url: str):
        # refer: https://github.com/django/django/blob/stable/1.3.x/django/core/validators.py#L45
        regex = re.compile(
            r'^(?:http)s?://'  # http:// or https://
            r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+(?:[A-Z]{2,6}\.?|[A-Z0-9-]{2,}\.?)|'  # domain...
            r'localhost|'  # localhost...
            r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # ...or ip
            r'(?::\d+)?'  # optional port
            r'(?:/?|[/?]\S+)$', re.IGNORECASE)

        return re.match(regex, url) is not None

    @staticmethod
    def check_args(args):
        logger.info("begin to check input: %s" % args)

        if not isinstance(args.url, str):
            logger.error("file service url is not valid format")
            raise TypeError("file service url is not valid")

        if not InputProcess.url_is_valid(args.url):
            logger.error("file service url is not valid format")
            raise ValueError("file service url is not valid")

        if not os.path.isdir(args.file_dir) or not os.path.exists(args.file_dir):
            logger.error("upload file directory does not exist: %s" % args.file_dir)
            raise EFolderNotexist

        if not os.access(os.path.join(str(args.file_dir)), os.W_OK | os.R_OK):
            logger.error("upload file directory is not readable/writable: %s" % args.output_path)
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

        input_conf = ConfigObject.merge_two_dicts(None, json.load(args.project_conf))
        if args.file_dir is not None:
            input_conf['fileDir'] = args.file_dir
        if args.project_id is not None:
            input_conf['projectId'] = args.project_id
        if args.url is not None:
            input_conf['url'] = args.url

        return input_conf


if __name__ == "__main__":
    init_time = datetime.datetime.utcnow()
    try:
        args = get_parser().parse_args()

        log_level = logging.DEBUG if args.debug else logging.INFO
        setup_logging(default_level = log_level)

        InputProcess.check_args(args)
        input_conf = InputProcess.process_args(args)

        POST_STATUS.EXEC_PARAMETERS = " --project-conf " + str(args.project_conf.name) \
                                      + " --file-dir " + str(args.file_dir) \
                                      + " --url " + str(args.url)
        POST_STATUS.init(PREPROC.UP_FILE.name, PREPROC.UP_FILE.value, init_time=init_time)

        file_service = FileService(input_conf.get("fileDir"))
        if input_conf.get("gitUrl") is None and input_conf.get("uploadSource") is True:
            file_service.prepare_files_to_upload()
        file_service.upload_files(input_conf.get("url"), input_conf.get("projectId"))
    except XcalError as err:
        POST_STATUS.FINI_STATUS = get_canonical_error_name(err)
    except Exception as err:
        logger.exception(err)
        POST_STATUS.FINI_STATUS = err.__class__.__name__
    finally:
        POST_STATUS.fini(PREPROC.UP_FILE.name, PREPROC.UP_FILE.value, init_time=init_time)
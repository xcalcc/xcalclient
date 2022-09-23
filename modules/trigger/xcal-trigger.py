#!/usr/bin/env python3
# -*- coding:utf-8 -*-

#
# Copyright (C) 2021 Xcalibyte (Shenzhen) Limited.
#

import argparse
import json
import os
import re
import subprocess
import sys
import threading
import time
import logging

currentdir = os.path.dirname(os.path.realpath(__file__))
parentdir = os.path.dirname(currentdir)
parentparentdir = os.path.dirname(parentdir)
sys.path.append(parentdir)
sys.path.append(parentparentdir)

from enum import IntEnum, Enum

import requests
import sseclient
import urllib3

from common.xcrypto import decrypt

# we cannot use sys.argv[0] while using staticx, it is changed to meet the requirement of the bootloader
# https://github.com/JonathonReinhart/staticx/pull/81
staticx_pro_path = os.environ.get('STATICX_PROG_PATH')

# Read version
from common.ReadVersion import read_ver
VERSION = read_ver()

# Global
BROWSER_INFO = 'To view all the defects on a browser, click %s'
DELTA_BROWSER_INFO = 'To view all the new and fixed defects on a browser, click %s'
REPORT_INFO = 'To view all the defects in csv, click %s'
DELTA_REPORT_INFO = 'To view all the new and fixed defects in csv, click %s'
CONTACT = 'If you have any questions about Xcalscan then please contact Xcalibyte at support@xcalibyte.com.'
EXIT_CODE_COMMIT_ID_SCANNED = 12
EXIT_CODE_BUILD_SUCCESS_WITHOUT_I_FILE = 4
EXIT_CODE_BUILD_FAIL = 5
EXIT_CODE_SCAN_TASK_FAILED = 0
EXIT_CODE_SCAN_TASK_ABORTED = 0
EXIT_CODE_SCAN_TASK_PENDING = 0
EXIT_CODE_SCAN_TASK_WAITING_SCAN_FAILED = 0

IGNORED_ERROR_CODES = [0, 10, EXIT_CODE_COMMIT_ID_SCANNED, EXIT_CODE_BUILD_SUCCESS_WITHOUT_I_FILE, EXIT_CODE_BUILD_FAIL]

# Email
FAILED_EMAIL_TEMPLATE = '''
Hi,

Xcalscan triggered at %s failed.
This is a copy of the log for your reference.

%s

%s
'''
SCAN_SUCCESS_EMAIL_TEMPLATE = '''
Hi,

Here is a copy of a Xcalscan summary for %s that was triggered by %s at %s.

%s

%s
'''
SCAN_FAILED_EMAIL_TEMPLATE = '''
Hi,

Xcalscan for %s triggered by %s at %s was failed.

%s
'''
SCAN_TERMINATED_EMAIL_TEMPLATE = '''
Hi,

Xcalscan for %s triggered by %s at %s was aborted.

%s
'''
WAITING_SCAN_TIMEOUT_EMAIL_TEMPLATE = '''
Hi,

Xcalscan for %s triggered by %s at %s failed due to the scanning time surpassing the preset time limit of 5 hours.

Please change the input argument by --listen-timeout.

%s
'''
WAITING_SCAN_FAILED_EMAIL_TEMPLATE = '''
Hi,

Xcalscan for %s triggered by %s at %s was waiting failed.

%s
'''

# Utils
OUTPUT_FORMAT = '[%5s] %s'

# AppException
EXCEPTION_FORMAT = '%s(%s:0x%08X)'

# Api
# set default value to 30 seconds and also use env variable to control it.
REQUESTS_TIMEOUT = os.getenv("REQUEST_TIMEOUT", 30)
API_USER_LOGIN_URL = '%s/api/auth_service/v2/login'
API_GET_PROJECT_UUID_URL = '%s/api/project_service/v2/project/project_id/%s/config'
API_GET_SCAN_TASK_SUMMARY_URL = '%s/api/scan_service/v2/scan_task/%s/scan_summary'
API_GET_SCAN_TASK_STATUS_BY_PROJECT_UUID_URL = '%s/api/scan_service/v2/project/%s/scan_task'
API_GET_SCAN_TASK_STATUS_URL = '%s/api/scan_service/v2/scan_task/%s/status'
API_SEARCH_ISSUE_GROUP_URL = '%s/api/issue_service/v3/search_issue_group?page=%d&size=%d'
API_GET_RULE_INFO_MAP_URL = '%s/api/rule_service/v3/rule/rule_list'
# TODO: Risk: currently below urls with token display to the console
API_GET_GENERAL_MISRA_RESULT_URL = '%s/misra/project/%s?token=%s'
API_GET_MISRA_DETAILS_RESULT_URL = '%s/misra/project/%s/commit/%s?token=%s'
API_GET_GENERAL_RESULT_URL = '%s/project/%s?token=%s'
API_GET_DETAILS_RESULT_URL = '%s/project/%s/commit/%s?token=%s'
API_GET_CSV_REPORT_URL = '%s/api/report_service/v2/issue_report/format/csv?scanTaskId=%s&reportType=%s&delta=%s&token=%s'

# Sse
SSE_SUBSCRIBE_URL = '%s/subscribe?kafkaTopic=proc-done&kafkaTopic=postproc-done'

# App
EMAIL_CONTENT_FILE_NAME = 'email-content.txt'
PROJECT_CONFIG_FILE_NAME = 'xcalscan.conf'
CLIENT_CONFIG_FILE_NAME = '.xcalsetting'
CLIENT_FILE_NAME = 'client'
RUN_SCAN_TIMEOUT = os.getenv("RUN_SCAN_TIMEOUT", 10800)
LISTENER_TIMEOUT = os.getenv("LISTENER_TIMEOUT", 10800)
WAITING_INTERVAL = os.getenv("WAITING_INTERVAL", 10)


CRITICALITY = {"HIGH": "MANDATORY", "MEDIUM": "REQUIRED", "LOW": "ADVISORY"}

REPO_ACTION = {"CI": "PUSH", "CD": "MERGE", "TRIAL": "TRIAL SCAN"}

class RuleSet(Enum):
    BUILTIN = 'X'
    CERT = 'S'
    MISRA = 'M'
    AUTOSAR = 'A'

class ScanMode(Enum):
    SINGLE = '-single'
    CROSS = '-cross'
    SINGLE_XSCA = '-single-xsca'    # composite of single and xsca
    XSCA = '-xsca'


class ReportType(IntEnum):
    SINGLE = 1
    CROSS = 2
    MISRA = 3


class ScanTaskStatus(IntEnum):
    PENDING = 1
    PROCESSING = 2
    COMPLETED = 3
    FAILED = 4
    TERMINATED = 5


class SseStatus(IntEnum):
    SUCC = 0
    COND_SUCC = 1
    FAILED = 2
    FATAL = 3
    CANCEL = 4


class SsePhase(IntEnum):
    SETUP = 1
    PREPROC = 2
    PROC = 3
    POSTPROC = 4


class LogLevel(IntEnum):
    DEBUG = 10
    INFO = 20
    TRACE = 25
    WARN = 30
    ERROR = 40
    FATAL = 50


class ErrorCode(IntEnum):
    SUCCESS = 0x00000000
    FAILED = 0xFFFFFFFF


class Utils:

    @staticmethod
    def output(level: LogLevel, log: str):
        print(OUTPUT_FORMAT % (level.name, log), flush=True)

    @staticmethod
    def write_email(file_name: str, email_content: str):
        try:
            with open(file_name, 'w') as f:
                f.write('%s\n' % email_content)
        except Exception as e:
            Utils.output(LogLevel.ERROR, str(e))


class AppException(Exception):

    def __init__(self, error_code: ErrorCode, error_message: str):
        self.error_code = error_code
        self.error_message = error_message

    def __str__(self):
        return EXCEPTION_FORMAT % (self.error_message, self.error_code.name, self.error_code.value)


class Api:

    def __init__(self, host: str):
        self.host = host

    def user_login(self, username: str, password: str):
        try:
            url = API_USER_LOGIN_URL % self.host
            payload = {'username': username, 'password': password}
            res = requests.post(url, json=payload, timeout=REQUESTS_TIMEOUT).json()
            return '%s %s' % (res['tokenType'], res['accessToken']), None
        except Exception as ex:
            logging.exception(ex)
            return None, ex

    def get_project_uuid(self, project_id: str, token: str):
        try:
            url = API_GET_PROJECT_UUID_URL % (self.host, project_id)
            headers = {'Authorization': token}
            res = requests.get(url, headers=headers, timeout=REQUESTS_TIMEOUT).json()
            return res['project']['id'], None
        except Exception as ex:
            logging.exception(ex)
            return None, ex

    def get_scan_task_summary(self, scan_task_id: str, token: str, rule_set: list = None):
        try:
            url = API_GET_SCAN_TASK_SUMMARY_URL % (self.host, scan_task_id)
            headers = {'Authorization': token}
            payload = {'ruleSets': rule_set}
            res = requests.get(url, headers=headers, json=payload, timeout=REQUESTS_TIMEOUT).json()
            return res['status'], res, None
        except Exception as ex:
            logging.exception(ex)
            return None, None, ex

    def get_scan_task_status_by_project_uuid(self, project_uuid: str, token: str):
        try:
            url = API_GET_SCAN_TASK_STATUS_BY_PROJECT_UUID_URL % (self.host, project_uuid)
            headers = {'Authorization': token}
            res = requests.get(url, headers=headers, timeout=REQUESTS_TIMEOUT).json()
            return res['status'], res, None
        except Exception as ex:
            logging.exception(ex)
            return None, None, ex

    def get_scan_task_status(self, scan_task_id: str, token: str):
        try:
            url = API_GET_SCAN_TASK_STATUS_URL % (self.host, scan_task_id)
            headers = {'Authorization': token}
            res = requests.get(url, headers=headers, timeout=REQUESTS_TIMEOUT).json()
            return res['status'], res, None
        except Exception as ex:
            logging.exception(ex)
            return None, None, ex

    def search_issue_group(self, scan_task_id: str, dsr_type: str, token: str, rule_set: list = None, page: int = 0, size: int = 10):
        try:
            url = API_SEARCH_ISSUE_GROUP_URL % (self.host, page, size)
            headers = {'Authorization': token}
            payload = {'scanTaskId': scan_task_id, 'ruleSets': rule_set, 'dsrType': [dsr_type]}
            res = requests.post(url, json=payload, headers=headers, timeout=REQUESTS_TIMEOUT).json()
            return res['totalElements'], res['content'], None
        except Exception as ex:
            logging.exception(ex)
            return 0, None, ex

    def get_rule_info_map(self):
        try:
            url = API_GET_RULE_INFO_MAP_URL % self.host
            res = requests.get(url, timeout=REQUESTS_TIMEOUT).json()
            rules = {}
            for r in res['rules']:
                if 'csv_string' in r:
                    for c in r['csv_string']:
                        rules[c] = r['code']
                else:
                    code = r['code']
                    rules[code] = code
            return rules, None
        except Exception as ex:
            return {}, ex


class Sse:

    def __init__(self, host: str):
        self.host = host
        self.scan_task_id = None
        self.scan_task_status = ScanTaskStatus.PROCESSING.name
        self.lock = threading.Lock()
        self.histories = {}

    def subscribe(self):
        http = urllib3.PoolManager()
        url = SSE_SUBSCRIBE_URL % self.host
        response = http.request('GET', url, preload_content=False)
        try:
            sse_client = sseclient.SSEClient(response)
            for event in sse_client.events():
                sse_status = json.loads(event.data)
                Utils.output(LogLevel.INFO, 'sse status: %s' % sse_status)

                # add sse to histories when scan task id did not set
                if self.scan_task_id is None:
                    self.lock.acquire()
                    if self.scan_task_id is None:
                        if sse_status['scanTaskId'] not in self.histories:
                            self.histories[sse_status['scanTaskId']] = []
                        self.histories[sse_status['scanTaskId']].append(sse_status)
                    self.lock.release()
                    continue

                if sse_status['scanTaskId'] == self.scan_task_id:
                    self.scan_task_status = Sse.calc_scan_task_status(sse_status)
                    if self.scan_task_status != ScanTaskStatus.PROCESSING.name:
                        break
        finally:
            response.release_conn()

    def set_scan_task_id(self, scan_task_id: str):
        if self.scan_task_id is None:
            self.lock.acquire()
            if self.scan_task_id is None:
                self.scan_task_id = scan_task_id
                for sse_status in self.histories.get(scan_task_id, []):
                    self.scan_task_status = Sse.calc_scan_task_status(sse_status)
                    if self.scan_task_status != ScanTaskStatus.PROCESSING.name:
                        break
            self.lock.release()
        return self.scan_task_status

    # set scan_task_status to failed or terminated when received proc-done and status is failed or cancel
    # set scan_task_status to failed or terminated when received postproc-done and status is failed or cancel
    # set scan_task_status to completed when received postproc-done and status is succ
    @staticmethod
    def calc_scan_task_status(sse_status: dict):
        if sse_status['source'] == SsePhase.PROC.name:
            if sse_status['status'] in [SseStatus.FAILED.name, SseStatus.FATAL.name]:
                return ScanTaskStatus.FAILED.name
            elif sse_status['status'] == SseStatus.CANCEL.name:
                return ScanTaskStatus.TERMINATED.name
        elif sse_status['source'] == SsePhase.POSTPROC.name:
            if sse_status['status'] in [SseStatus.FAILED.name, SseStatus.FATAL.name]:
                return ScanTaskStatus.FAILED.name
            elif sse_status['status'] == SseStatus.CANCEL.name:
                return ScanTaskStatus.TERMINATED.name
            elif sse_status['status'] == SseStatus.SUCC.name:
                return ScanTaskStatus.COMPLETED.name
        return ScanTaskStatus.PROCESSING.name


class App:

    def __init__(self):
        self.workspace = ''
        self.email_content_file = ''
        self.project_path = ''
        self.build_path = ''
        self.project_config = ''
        self.client_path = ''
        self.client_config = ''
        self.client = ''
        self.project_id = ''
        self.scan_mode = ''
        self.project_name = ''
        self.author_name = ''
        self.api_host = ''
        self.sse_host = ''
        self.queue_timeout = 0
        self.run_scan_timeout = RUN_SCAN_TIMEOUT
        self.listener_timeout = LISTENER_TIMEOUT
        self.waiting_interval = WAITING_INTERVAL
        self.username = None
        self.password = None
        self.cancel = False
        self.debug = False
        self.repo_action = None
        self.api = None
        self.token = ''
        self.scan_task_id = None
        self.scan_task_status = ScanTaskStatus.PROCESSING.name
        self.unknown_args = []

    def run(self):
        try:
            Utils.output(LogLevel.INFO, 'starting trigger with version: %s' % VERSION)
            self.init()
            self.exec()
            self.fini()
        except Exception as e:
            Utils.output(LogLevel.ERROR, str(e))
            text = FAILED_EMAIL_TEMPLATE % (
                time.strftime('%Y-%m-%d %H:%M:%S'), str(e), CONTACT
            )
            Utils.write_email(self.email_content_file, text)
            sys.exit(1)

    def init(self):
        parser = argparse.ArgumentParser()
        parser.add_argument('-s', type=str, required=False)
        parser.add_argument('-c', type=str, required=False)
        parser.add_argument('--client-path', type=str, required=False)
        parser.add_argument('--build-path', type=str, required=False)
        parser.add_argument('--client-timeout', type=int, default=0)
        parser.add_argument('--listen-timeout', type=int, default=0)
        parser.add_argument('-u', type=str)
        parser.add_argument('-p', type=str)
        parser.add_argument('--cancel', action='store_true')
        parser.add_argument('--debug', action='store_true')
        args, unknown_args = parser.parse_known_args()

        self.unknown_args = unknown_args

        Utils.output(LogLevel.INFO, 'starting... %s version: %s' % (os.path.basename(__file__), VERSION))
        Utils.output(LogLevel.INFO, '')

        self.workspace = os.path.abspath(os.curdir)
        Utils.output(LogLevel.INFO, 'workspace: %s' % self.workspace)

        self.email_content_file = os.path.join(self.workspace, EMAIL_CONTENT_FILE_NAME)
        Utils.output(LogLevel.INFO, 'email content file: %s' % self.email_content_file)

        self.project_path = args.s
        self.project_config = args.c
        self.client_path = args.client_path
        self.build_path = args.build_path
        # check if either s or c is provided
        if self.project_path is None and self.project_config is None:
            msg = 'Either -s or -c have to be specified.'
            raise AppException(ErrorCode.FAILED, msg)
        if self.client_path is None:
           self.client_path = os.path.dirname(os.path.dirname(staticx_pro_path))
           Utils.output(LogLevel.WARN, 'Client path not provided, using current path "%s" as client path' % self.client_path)

        # project path
        if self.project_path is not None:
            self.project_path = os.path.abspath(self.project_path)
            Utils.output(LogLevel.INFO, 'project path: %s' % self.project_path)

        # get project config absolut path
        self.project_config = self.get_project_config_path(self.project_path, self.project_config)
        Utils.output(LogLevel.INFO, 'project config path: %s' % self.project_config)

        if not os.path.exists(self.project_config):
            msg = 'Project config "%s" cannot be found.' % self.project_config
            raise AppException(ErrorCode.FAILED, msg)

        # find client
        self.client = os.path.join(self.client_path, CLIENT_FILE_NAME)
        if not os.path.exists(self.client):
            msg = 'Client path "%s" cannot be found, please provide --client for absolute client execution path' % self.client_path
            raise AppException(ErrorCode.FAILED, msg)

        Utils.output(LogLevel.INFO, 'client path: %s' % self.client_path)
        if not os.path.exists(self.client_path):
            msg = 'Client path "%s" cannot be found.' % self.client_path
            raise AppException(ErrorCode.FAILED, msg)

        self.client_config = os.path.join(self.client_path, CLIENT_CONFIG_FILE_NAME)
        Utils.output(LogLevel.INFO, 'client config: %s' % self.client_config)
        if not os.path.exists(self.client_config):
            msg = 'Client config "%s" cannot be found.' % self.client_config
            raise AppException(ErrorCode.FAILED, msg)

        try:
            with open(self.project_config, 'r') as f:
                data = json.load(f)
                scan_config = data.get('scanConfig', {})
                self.project_id = data.get('projectId', '')
                self.scan_mode = scan_config.get('scanMode', '')
                self.project_name = data.get('projectName', '')
        except Exception:
            msg = 'Invalid project config format "%s".' % self.project_config
            raise AppException(ErrorCode.FAILED, msg)

        try:
            with open(self.client_config, 'r') as f:
                data = json.load(f)

                self.api_host = data.get('apiServer', '')
                self.sse_host = data.get('sseServer', '')
                self.queue_timeout = max(0, int(data.get('queueTimeout', 0)))

                self.username = data.get('user')
                self.password = data.get('psw')
                if data.get('freshInstall') is None:
                    Utils.output(LogLevel.INFO, 'decrypting username and password in client config')
                    iv = open(os.path.join(self.client_path, 'iv'), 'rb').read()
                    key = open(os.path.join(self.client_path, 'key'), 'rb').read()
                    # decrypt with AES 256 cbc
                    self.username = decrypt(self.username, key, iv)
                    self.password = decrypt(self.password, key, iv)
        except Exception as e:
            Utils.output(LogLevel.ERROR, e)
            msg = 'Invalid client config format "%s".' % self.client_config
            raise AppException(ErrorCode.FAILED, msg)

        if len(self.api_host) == 0:
            msg = 'Invalid apiServer in client config "%s".' % self.client_config
            raise AppException(ErrorCode.FAILED, msg)
        if len(self.sse_host) == 0:
            msg = 'Invalid sseServer in client config "%s".' % self.client_config
            raise AppException(ErrorCode.FAILED, msg)

        if args.client_timeout > 0:
            self.run_scan_timeout = args.client_timeout
        if args.listen_timeout > 0:
            self.listener_timeout = args.listen_timeout

        if (args.u is not None and args.p is None) or (args.u is None and args.p is not None):
            msg = 'username and password must be provided together.'
            raise AppException(ErrorCode.FAILED, msg)
        # username and password get from command option will override the value from client config file
        if args.u is not None:
            self.username = args.u
        if args.p is not None:
            self.password = args.p

        self.cancel = args.cancel
        Utils.output(LogLevel.INFO, 'cancel: %s' % self.cancel)

        self.debug = args.debug
        Utils.output(LogLevel.INFO, 'debug: %s' % self.debug)

        self.api = Api(self.api_host)

    def get_project_config_path(self, project_path:str, project_config_path:str):
        if project_config_path is not None: # have project config path
            return os.path.abspath(project_config_path)
        elif project_path is not None: # have project path, then get default config file under it
            return os.path.join(project_path, PROJECT_CONFIG_FILE_NAME)
        else:
            msg = 'Either -s or -c have to be specified.'
            raise AppException(ErrorCode.FAILED, msg)

    def exec(self):
        Utils.output(LogLevel.INFO, 'login, server: %s, username: %s' % (self.api_host, self.username))
        self.token, err = self.api.user_login(self.username, self.password)
        if err is not None:
            msg = 'Login failed. Please make sure the username and password are correct and retry.'
            raise AppException(ErrorCode.FAILED, msg)

        while True:
            if self.cancel:
                break
            if self.queue_timeout <= 0:
                Utils.output(LogLevel.INFO, 'no need to queuing')
                break
            if len(self.project_id) == 0:
                Utils.output(LogLevel.INFO, 'no project info')
                break
            project_uuid, _ = self.api.get_project_uuid(self.project_id, self.token)
            if project_uuid is None:
                Utils.output(LogLevel.INFO, 'no project info')
                break

            Utils.output(LogLevel.DEBUG, 'project info: %s' % project_uuid)

            st, et, scan_task_status = time.time(), time.time(), ScanTaskStatus.PROCESSING.name

            while (et - st) < self.queue_timeout:
                Utils.output(LogLevel.INFO, 'queuing...')
                Utils.output(LogLevel.INFO, '')

                scan_task_status, _, err = self.api.get_scan_task_status_by_project_uuid(project_uuid, self.token)
                if err is not None:
                    Utils.output(LogLevel.WARN, 'get scan task status failed, error: %s' % str(err))
                    break
                if scan_task_status not in [ScanTaskStatus.PENDING.name, ScanTaskStatus.PROCESSING.name]:
                    break

                time.sleep(self.waiting_interval)
                et = time.time()

            if (et - st) >= self.queue_timeout and scan_task_status is not None:
                msg = 'Queued timeout (%ds), scan task status (%s), exit!' % (int(et - st), scan_task_status)
                raise AppException(ErrorCode.FAILED, msg)

            break

        params = [self.client, '--call-from', 'jenkins']
        if self.project_path is not None:
            params.extend(['-s', self.project_path])
            
        if self.build_path is not None:
            params.extend(['--build-path', self.build_path])

        if self.project_config is not None:
            params.extend(['-c', self.project_config])

        if self.username is not None:
            params.extend(['-u', self.username])
        if self.password is not None:
            params.extend(['--psw', self.password])

        if self.cancel:
            params.extend(['--cancel'])
        if self.debug:
            params.extend(['--debug'])

        params.extend(self.unknown_args)

        Utils.output(LogLevel.INFO, '%s...' % 'scanning' if not self.cancel else 'canceling')
        Utils.output(LogLevel.INFO, '')
        Utils.output(LogLevel.INFO, ' '.join(params))
        Utils.output(LogLevel.INFO, '')

        sse = Sse(self.sse_host)
        t = threading.Thread(target=Sse.subscribe, args=(sse,))
        t.setDaemon(True)
        t.start()

        try:
            ret = subprocess.run(params, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=self.run_scan_timeout)
            # remove ansi color tag
            Utils.output(LogLevel.INFO, re.sub(r'.\[3\dm', '', ret.stdout.decode()))
            if ret.returncode not in IGNORED_ERROR_CODES:
                msg = 'Failed to execute client. Exit(%d)' % ret.returncode
                raise AppException(ErrorCode.FAILED, msg)
            Utils.output(LogLevel.DEBUG, '%s exit(%d)' % (self.client, ret.returncode))
        except subprocess.TimeoutExpired:
            msg = 'Execute client timeout'
            raise AppException(ErrorCode.FAILED, msg)
        if ret.returncode in [EXIT_CODE_COMMIT_ID_SCANNED, EXIT_CODE_BUILD_SUCCESS_WITHOUT_I_FILE, EXIT_CODE_BUILD_FAIL]:
            Utils.output(LogLevel.WARN,  ret.stderr.decode())
            sys.exit(0)

        Utils.output(LogLevel.INFO, 'waiting...')
        Utils.output(LogLevel.INFO, '')

        # search each output line to get scan task id
        lines = ret.stdout.decode().split('\n')
        for row in lines:
            if row.startswith('[FLOW]'):
                matches = re.search(r'"scanTaskId"\s*:\s*"(.+?)"', row)
                if matches is not None:
                    self.scan_task_id = matches.group(1)
                matches = re.search(r'"pipelineType"\s*:\s*"(.+?)"', row)
                if matches is not None:
                    self.repo_action = matches.group(1)
                if self.scan_task_id is not None and self.repo_action is not None:
                    break
        Utils.output(LogLevel.DEBUG, 'scan task id: %s, repo action: %s' % (self.scan_task_id, self.repo_action))

        if len(self.scan_task_id) > 0 and ret.returncode == 0:
            self.scan_task_status = sse.set_scan_task_id(self.scan_task_id)
            if self.scan_task_status == ScanTaskStatus.PROCESSING.name:
                t.join(timeout=self.listener_timeout)
                self.scan_task_status = sse.scan_task_status

        if self.scan_task_status == ScanTaskStatus.COMPLETED.name:
            self.scan_task_status, _, err = self.api.get_scan_task_status(self.scan_task_id, self.token)
            Utils.output(LogLevel.DEBUG, 'scan task status: %s' % self.scan_task_status)

    def get_canonical_defect_detail(self, defect_infos: list, detail_template: str, rule_map: dict, simple_scan_mode: str):
        assert simple_scan_mode != ScanMode.SINGLE_XSCA.value
        defect_details = []
        for item in defect_infos:
            file_path = item['sinkRelativePath'] or item['srcRelativePath']
            line_no = item['sinkLineNo'] or item['srcLineNo']
            critical_level = item['criticality'] if simple_scan_mode != ScanMode.XSCA.value else CRITICALITY.get(item['criticality'])
            defect_details.append(
                detail_template % (
                    critical_level, item['id'], rule_map.get(item['ruleCode'], item['ruleCode']),
                    file_path, line_no, item['functionName'], item['variableName'], item['issueCount']
                )
            )
        return defect_details

    def process_summary_header(self, scan_finished_time: str, baseline_commit_id: str, commit_id: str):
        lines = [
            'Project name               : %s' % self.project_name,
         #   'Triggered by               : %s' % self.author_name,
            'Trigger action             : %s' % REPO_ACTION.get(self.repo_action, ''),
            'Scan finished at           : %s' % scan_finished_time,
            'Baseline commit ID         : %s' % baseline_commit_id,
            'Commit ID                  : %s' % commit_id,
            '']
        return lines

    def process_summary_body(self, project_id: str, has_dsr: bool, issue_summary: dict, baseline_commit_id: str, commit_id: str, simple_scan_mode: str, rule_set: list):
        assert simple_scan_mode != ScanMode.SINGLE_XSCA.value
        lines = []

        num_new, top10_new, err1 = self.api.search_issue_group(self.scan_task_id, 'N', self.token, rule_set)
        num_fix, top10_fix, err2 = self.api.search_issue_group(self.scan_task_id, 'F', self.token, rule_set)
        rule_map, err = self.api.get_rule_info_map()

        delta = "true" if has_dsr else "false"
        token_without_bearer = self.token.replace('Bearer ', '')
        if simple_scan_mode == ScanMode.XSCA.value:
            general_result_url = API_GET_GENERAL_MISRA_RESULT_URL % (self.api.host, project_id, token_without_bearer)
            details_result_url = API_GET_MISRA_DETAILS_RESULT_URL % (
            self.api.host, project_id, commit_id, token_without_bearer)
            csv_report_url = API_GET_CSV_REPORT_URL % (
            self.api.host, self.scan_task_id, ReportType.MISRA.name, delta, token_without_bearer)
            scan_mode_directive = "MISRA SCAN:"
            high_risk_defects = 'Mandatory to fix defects  : %s'
            medium_risk_defects = 'Required to fix defects    : %s'
            low_risk_defects = 'Advisory to fix defects    : %s'
            defect_detail_info = 'Obligation level: %s, ID: %s, Type: %s, File: %s, Line: %d, Function: %s, Variable: %s, Paths: %d'
        elif simple_scan_mode in (ScanMode.SINGLE.value, ScanMode.CROSS.value):
            general_result_url = API_GET_GENERAL_RESULT_URL % (self.api.host, project_id, token_without_bearer)
            details_result_url = API_GET_DETAILS_RESULT_URL % (
            self.api.host, project_id, commit_id, token_without_bearer)
            report_type = ReportType.SINGLE.name if simple_scan_mode == ScanMode.SINGLE.value else ReportType.CROSS.name
            csv_report_url = API_GET_CSV_REPORT_URL % (
            self.api.host, self.scan_task_id, report_type, delta, token_without_bearer)
            scan_mode_directive = "SINGLE SCAN:" if simple_scan_mode == ScanMode.SINGLE.value else "CROSS SCAN:"
            project_risk_level = 'Project risk level         : %s' % issue_summary.get('criticality', None)
            definite_defects = 'Definite defects           : %s' % issue_summary.get('certaintyCountMap', {}).get('D', '0')
            possible_defects = 'Possible defects           : %s' % issue_summary.get('certaintyCountMap', {}).get('M', '0')
            high_risk_defects = 'High risk defects          : %s'
            medium_risk_defects = 'Medium risk defects        : %s'
            low_risk_defects = 'Low risk defects           : %s'
            defect_detail_info = 'Risk: %s, ID: %s, Type: %s, File: %s, Line: %d, Function: %s, Variable: %s, Paths: %d'

        lines.extend([
            scan_mode_directive,
            '',
            'Total defects              : %s' % issue_summary.get('issuesCount', '0'),
            'New defects                : %d' % num_new,
            'Fixed defects              : %d' % num_fix
        ])

        if simple_scan_mode == ScanMode.SINGLE.value or simple_scan_mode == ScanMode.CROSS.value:
            lines.extend([definite_defects, possible_defects, project_risk_level])

        lines.extend([
            high_risk_defects % issue_summary.get('criticalityCountMap', {}).get('HIGH', '0'),
            medium_risk_defects % issue_summary.get('criticalityCountMap', {}).get('MEDIUM', '0'),
            low_risk_defects % issue_summary.get('criticalityCountMap', {}).get('LOW', '0')
        ])

        new_list = []
        if top10_new is not None:
            new_list = self.get_canonical_defect_detail(top10_new, defect_detail_info, rule_map, simple_scan_mode)

        if num_new and num_new > 0:
            lines.extend(['', 'Top 10 new defects:'])
            lines.extend(new_list)

        fix_list = []
        if top10_fix is not None:
            fix_list = self.get_canonical_defect_detail(top10_fix, defect_detail_info, rule_map, simple_scan_mode)

        if num_fix and num_fix > 0:
            lines.extend(['', 'Top 10 fixed defects:'])
            lines.extend(fix_list)

        lines.extend([''])

        if has_dsr:
            lines.extend([DELTA_REPORT_INFO % csv_report_url])
        else:
            lines.extend([REPORT_INFO % csv_report_url])

        lines.extend([''])

        if baseline_commit_id is not None:
            lines.extend([DELTA_BROWSER_INFO % details_result_url])
        else:
            lines.extend([BROWSER_INFO % general_result_url])

        return lines

    def fini(self):
        if self.scan_task_status == ScanTaskStatus.COMPLETED.name:
            Utils.output(LogLevel.INFO, 'SCAN SUCCESS')
            try:
                if self.scan_mode == ScanMode.XSCA.value:
                    rule_set = [RuleSet.MISRA.value, RuleSet.AUTOSAR.value]
                elif self.scan_mode in (ScanMode.SINGLE.value, ScanMode.CROSS.value, ScanMode.SINGLE_XSCA.value):
                    rule_set = [RuleSet.BUILTIN.value, RuleSet.CERT.value]
                Utils.output(LogLevel.DEBUG, 'rule_set: %s' % str(rule_set))
                scan_task_status, scan_summary, err = self.api.get_scan_task_summary(self.scan_task_id, self.token, rule_set)
                if err is not None:
                    Utils.output(LogLevel.WARN, 'get scan task summary failed, error: %s' % str(err))
                    scan_summary = {}

                scan_finished_ts = scan_summary.get('scanEndAt', int(time.time() * 1000)) / 1000
                scan_finished_time = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(scan_finished_ts))
                project_id = scan_summary.get('projectId', '')
                has_dsr = scan_summary.get("hasDsr", False)
                issue_summary = scan_summary.get('issueSummary', {})
                if issue_summary is None:
                    Utils.output(LogLevel.WARN, "issue summary does not exist")

                baseline_commit_id = issue_summary.get('baselineCommitId', '')
                commit_id = issue_summary.get('commitId', '')

                simple_scan_mode = self.scan_mode
                if self.scan_mode == ScanMode.SINGLE_XSCA.value:
                    # 1.construct single mode scan summary output
                    simple_scan_mode = ScanMode.SINGLE.value

                lines = []
                header_lines = self.process_summary_header(scan_finished_time, baseline_commit_id, commit_id)
                body_lines = self.process_summary_body(project_id, has_dsr, issue_summary, baseline_commit_id, commit_id, simple_scan_mode, rule_set)
                lines.extend(header_lines)
                lines.extend(body_lines)

                # Since scan task summary api return incomplete info in ruleSetSummaryMap,
                # call get scan task summary api twice to get misra info when scan mode is -single-xsca
                if self.scan_mode == ScanMode.SINGLE_XSCA.value:
                    # 2.construct xsca mode scan summary output
                    simple_scan_mode = ScanMode.XSCA.value
                    rule_set = [RuleSet.MISRA.value, RuleSet.AUTOSAR.value]
                    scan_task_status, scan_summary, err = self.api.get_scan_task_summary(self.scan_task_id, self.token, rule_set)
                    if err is not None:
                        Utils.output(LogLevel.WARN, 'get scan task summary failed, error: %s' % str(err))
                        scan_summary = {}

                    issue_summary = scan_summary.get('issueSummary', {})
                    if issue_summary is None:
                        Utils.output(LogLevel.WARN, "issue summary does not exist")

                    lines.extend([''])
                    body_lines = self.process_summary_body(project_id, has_dsr, issue_summary, baseline_commit_id, commit_id, simple_scan_mode, rule_set)
                    lines.extend(body_lines)

                for line in lines:
                    Utils.output(LogLevel.INFO, line)

                Utils.output(LogLevel.INFO, '')
                Utils.output(LogLevel.INFO, CONTACT)

                text = SCAN_SUCCESS_EMAIL_TEMPLATE % (
                    self.project_name, self.author_name, scan_finished_time, '\n'.join(lines), CONTACT
                )
                Utils.write_email(self.email_content_file, text)
            except Exception as e:
                Utils.output(LogLevel.WARN, 'unexpected error: %s' % str(e))
        elif self.scan_task_status == ScanTaskStatus.FAILED.name:
            Utils.output(LogLevel.INFO, 'SCAN FAILED')
            Utils.output(LogLevel.ERROR, 'Scan error. No scan result. Please contact Xcalibyte technical support.')
            Utils.output(LogLevel.INFO, CONTACT)
            try:
                text = SCAN_FAILED_EMAIL_TEMPLATE % (
                    self.project_name, self.author_name, time.strftime('%Y-%m-%d %H:%M:%S'), CONTACT
                )
                Utils.write_email(self.email_content_file, text)
            except Exception as e:
                Utils.output(LogLevel.WARN, 'unexpected error: %s' % str(e))
            sys.exit(EXIT_CODE_SCAN_TASK_FAILED)
        elif self.scan_task_status == ScanTaskStatus.TERMINATED.name:
            Utils.output(LogLevel.INFO, 'SCAN ABORTED')
            Utils.output(LogLevel.INFO, CONTACT)
            try:
                text = SCAN_TERMINATED_EMAIL_TEMPLATE % (
                    self.project_name, self.author_name, time.strftime('%Y-%m-%d %H:%M:%S'), CONTACT
                )
                Utils.write_email(self.email_content_file, text)
            except Exception as e:
                Utils.output(LogLevel.WARN, 'unexpected error: %s' % str(e))
            sys.exit(EXIT_CODE_SCAN_TASK_ABORTED)
        elif self.scan_task_status in [ScanTaskStatus.PENDING.name, ScanTaskStatus.PROCESSING.name]:
            Utils.output(LogLevel.INFO, 'WAITING SCAN TIMEOUT')
            Utils.output(LogLevel.INFO, CONTACT)
            try:
                text = WAITING_SCAN_TIMEOUT_EMAIL_TEMPLATE % (
                    self.project_name, self.author_name, time.strftime('%Y-%m-%d %H:%M:%S'), CONTACT
                )
                Utils.write_email(self.email_content_file, text)
            except Exception as e:
                Utils.output(LogLevel.WARN, 'unexpected error: %s' % str(e))
            sys.exit(EXIT_CODE_SCAN_TASK_PENDING)
        else:
            Utils.output(LogLevel.INFO, 'WAITING SCAN FAILED')
            Utils.output(LogLevel.INFO, CONTACT)
            try:
                text = WAITING_SCAN_FAILED_EMAIL_TEMPLATE % (
                    self.project_name, self.author_name, time.strftime('%Y-%m-%d %H:%M:%S'), CONTACT
                )
                Utils.write_email(self.email_content_file, text)
            except Exception as e:
                Utils.output(LogLevel.WARN, 'unexpected error: %s' % str(e))
            sys.exit(EXIT_CODE_SCAN_TASK_WAITING_SCAN_FAILED)


if __name__ == '__main__':
    App().run()

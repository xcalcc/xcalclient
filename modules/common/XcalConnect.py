#
#  Copyright (C) 2021 Xcalibyte (Shenzhen) Limited.
#
import logging
import json
import os
import threading
import re
import random
import requests
from xcal_common.py.error import EApiInvokeFail
from requests.adapters import HTTPAdapter
from requests.packages.urllib3.util import Retry
from requests import Session
from common.XcalGlobals import FileType

from common import DownloadUtil
from common.ConfigObject import ConfigObject
from common.HashUtility import HashUtility
from common.XcalException import XcalException
from common.XcalLogger import XcalLogger, XcalLoggerExternalLinker
from common.CommonGlobals import TaskErrorNo, Stage, Status, Percentage, OFFLINE_AGENT_TYPE, AGENT_SOURCE_STORAGE


class Connector(object):
    def __init__(self, logger: XcalLogger, api_server: dict):
        self.logger = logger
        self.api_server = api_server
        self.host_url = api_server.get("URL")

    def login(self, global_ctx):
        url = "%s%s" % (self.host_url, self.api_server.get("loginApi"))

        data = {"username": global_ctx.get("USER_NAME"),
                "password": global_ctx.get("USER_PASSWORD")}

        try:
            result = self.send_http_request(url, header = {}, data = data, method = "POST")
        except requests.exceptions.RequestException as e:
            self.logger.debug("login", "failed: %s" % str(e))
            return e.response
        return result

    def poll_task(self, global_ctx):
        """
        Get a task info from ScanService
        :param global_ctx:
        :return: Task_Info Dict / or None in case no task available
        """
        try:
            result = self.send_http_request(self.host_url + self.api_server.get("pollApi"),
                                            timeout = 12000,
                                            data = {"agentName": global_ctx.get("AGENT_NAME"),
                                                    "supportedJobQueueName": global_ctx.get("SUPPORTED_JOB_QUEUE_NAME"),
                                                    "agentToken": global_ctx.get("agentToken"),
                                                    "agentId": global_ctx.get("agentId"),
                                                    "workerNum": 1,
                                                    "username": global_ctx.get("USER_NAME"),
                                                    "threadId": threading.get_ident(),
                                                    "threadName": threading.current_thread().getName(),
                                                    "pid": os.getpid()
                                                    }, header = {},
                                            method = "POST_TIMEOUT")
            # result could be 502 bad gateway but not raise RequestException, so raise_for_status still needed
            result.raise_for_status()
        except requests.exceptions.RequestException as err:
            raise XcalException("XcalConnect", "poll_task", "poll_task failed: %s" % err,
                                TaskErrorNo.E_POLL_TASK_FAILED)
        else:
            return result

    def upload_file(self, global_ctx, job_config, file_to_upload, file_type: FileType = FileType.SOURCE):
        """
        Upload a file and get its file-id
        :param job_config:
        :param global_ctx:
        :param file_to_upload:
        :param file_type:
        :return: a dict which contains fileId key/value
        """
        with open(file_to_upload, "rb") as file_one:
            try:
                result = self.send_http_request(self.host_url + self.api_server.get("fileInfoUploadApi"),
                                                data = {"token": job_config.get("taskConfig").get("token"), "file_checksum": str(HashUtility.get_crc32_checksum(file_to_upload)), "type": file_type.name},
                                                header = {}, files = {"upload_file": file_one},
                                                method = "POST_FILE")
                result.raise_for_status()
                file_id = result.json().get("id")
            except requests.exceptions.RequestException as err:
                raise XcalException("XcalConnect", "upload_file", "upload_file failed: %s" % err,
                                    TaskErrorNo.E_UPLOAD_FILE_FAILED)
            except ValueError as err:
                raise XcalException("XcalConnect", "upload_file", "response info is not valid json format: %s" % err,
                                    TaskErrorNo.E_INVALID_JSON_FORMAT)
        return {"fileId": file_id}

    def upload_diagnostic_log(self, global_ctx, job_config, file_to_upload):

        """
        Upload diagnostic log
        :param job_config:
        :param global_ctx:
        :param file_to_upload:
        :return:
        """
        if os.path.exists(file_to_upload):
            with open(file_to_upload, "rb") as file_one:
                file_upload_path = self.api_server.get('scanTaskDiagnosticUploadApi').replace("{id}", job_config.get("taskConfig").get("scanTaskId"))

                result = self.send_http_request(self.host_url + file_upload_path,
                                                data = {"token": job_config.get("taskConfig").get("token"), "checksum": ""},
                                                header = {}, files = {"upload_file": file_one},
                                                method = "POST_FILE")
                self.logger.info("XcalConnect.upload_diagnostic_log", "result: %s" % result)

    def report_status(self, global_ctx, job_config: dict, stage: Stage,
                      status: Status, errno: TaskErrorNo = TaskErrorNo.SUCCESS,
                      percentage: Percentage = Percentage.START, target: str = "progress",
                      message: str = "agent report status"):
        self.logger.trace("XcalConnect-report_status", "scan task id: %s" % job_config.get("taskConfig").get("scanTaskId"))
        job_config["errorInfo"] = errno.value
        job_config["target"] = target
        job_config["progress"] = percentage.value
        job_config["stage"] = stage.value
        job_config["status"] = status.value
        job_config["message"] = message
        agent_info = {"agentName": global_ctx.get("AGENT_NAME"),
                      "agentId": global_ctx.get("agentId"),
                      "supportedJobQueueName": global_ctx.get("SUPPORTED_JOB_QUEUE_NAME"),
                      "workerNum": 1,
                      "username": global_ctx.get("USER_NAME"),
                      "threadId": threading.get_ident(),
                      "threadName": threading.current_thread().getName(),
                      "scanTaskId": job_config.get("taskConfig").get("scanTaskId"),
                      "pid": os.getpid()}
        job_config["agentInfo"] = agent_info

        try:
            result = self.send_http_request(self.host_url + self.api_server.get("progressReportApi"),
                                            data = job_config,
                                            header = {},
                                            method = "POST")
            return result.json()
        except ValueError as err:
            self.logger.error("XcalConnect", "report_status", "response info is not valid json format: %s" % err)
        except Exception as err:
            self.logger.error("XcalConnect", "report_status", "report status failed: %s" % err)

    def report_result(self, global_ctx, job_config: dict):
        return self.report_status(global_ctx, job_config, Stage.AGENT_END, Status.PROCESSING,
                                  TaskErrorNo.SUCCESS, Percentage.END, "result", message = "agent job is done")

    def report_agent_status(self, global_ctx, status: str):
        agent_info = {"agentName": global_ctx.get("AGENT_NAME"),
                      "agentId": global_ctx.get("agentId"),
                      "supportedJobQueueName": global_ctx.get("SUPPORTED_JOB_QUEUE_NAME"),
                      "workerNum": 1,   # TODO: all workerNum should remove later if only one worker used in agent
                      "username": global_ctx.get("USER_NAME"),
                      "threadId": threading.get_ident(),
                      "threadName": threading.current_thread().getName(),
                      "status": status,
                      "pid": os.getpid()}

        try:
            result = self.send_http_request(self.host_url + self.api_server.get("agentStatusReportApi"), data = agent_info, header = {}, method = "POST")
            self.logger.debug("report_agent_status", "result: %s" % result.json())
            return result.json()
        except ValueError as err:
            self.logger.debug("report_agent_status", "response info is not valid json format: %s" % err)
        except Exception as err:
            self.logger.debug("report_agent_status", "report status failed: %s" % err)
        pass

    def check_java_rt_file(self, global_ctx, job_config, step_config, hash_result):
        try:
            check_url = "%s%s" % (self.host_url,
                                  self.api_server.get("checkFileCacheApi")
                                  .replace("{fileHash}", hash_result)
                                  .replace("{token}", job_config.get("taskConfig").get("token")))
            result = self.send_http_request(check_url,
                                            data={
                                                "scanTaskId": job_config.get("taskConfig").get("scanTaskId"),
                                                "taskConfig": job_config.get("taskConfig").copy(),
                                            },
                                            header={},
                                            method="POST")
            self.logger.trace("debug", result.status_code)
        except Exception as err:
            raise XcalException("XcalConnect", "check_java_rt_file", "cannot connect to server to check the cached fileId, api = %s" %
                                check_url, TaskErrorNo.E_CHECK_FILE_CACHED_NET_FAIL)
            #self.logger.error("XcalConnect", "check_java_rt_file", "error message : %s" % err)
            #sys.exit(1)

        if result.status_code >= 300:
            raise XcalException("XcalConnect", "check_java_rt_file", "cannot connect to server to check the cached fileId, api = %s" %
                                check_url, TaskErrorNo.E_CHECK_FILE_CACHED_NET_FAIL)
        try:
            result.json()
        except Exception as err:
            raise XcalException("XcalConnect", "check_java_rt_file", "cannot parse response from server, api = %s" %
                                check_url, TaskErrorNo.E_CHECK_FILE_CACHED_NON_JSON)

        return result.json()

    def save_file_cache(self, global_ctx, job_config, step_config, hash_result, file_id):
        save_url = "%s%s" % (self.host_url,
                             self.api_server.get("saveFileCacheApi")
                             .replace("{fileHash}", hash_result)
                             .replace("{fileId}", file_id)
                             .replace("{token}", job_config.get("taskConfig").get("token")))
        result = self.send_http_request(save_url,
                                        data={
                                            "scanTaskId": job_config.get("taskConfig").get("scanTaskId"),
                                            "taskConfig": job_config.get("taskConfig").copy(),
                                        },
                                        header={},
                                        method="POST")
        if result.status_code >= 300:
            raise XcalException("XcalConnect", "save_file_cache", "cannot connect to server to save the cached fileId, api = %s" %
                                save_url, TaskErrorNo.E_SAVE_FILE_CACHED_NET_FAIL)
        try:
            result.json()
        except Exception as err:
            raise XcalException("XcalConnect", "save_file_cache", "cannot parse response from server, api = %s" %
                                save_url, TaskErrorNo.E_SAVE_FILE_CACHED_NON_JSON)

        return result.json()

    def get_scan_service_version(self, global_ctx):
        check_url = "%s%s" % (self.host_url, self.api_server.get("scanServiceVersionApi"))

        try:
            result = self.send_http_request(check_url,
                                            header = {},
                                            data = {},
                                            method = "GET")
            # result could be 502 bad gateway but not raise RequestException, so this still needs
            result.raise_for_status()
            return result.json().get("version")
        except requests.exceptions.RequestException as e:
            self.logger.warn("get_scan_service_version", "failed, %s" % str(e))
            raise XcalException("XcalConnect", "get_scan_service_version", "get_scan_service_version failed: %s" % e,
                                TaskErrorNo.E_SCAN_SERVICE_VERSION_MISMATCH)
        except ValueError as e:
            self.logger.error("XcalConnect", "get_scan_service_version", "failed, %s" % str(e))
            raise XcalException("XcalConnect", "get_scan_service_version", "response info is not valid json format: %s" % e,
                                TaskErrorNo.E_INVALID_JSON_FORMAT)

    def send_http_request(self, url: str, data: dict, header: dict, files: dict = None, timeout: int = 5000, method: str = "PUT"):
        self.logger.debug("send_http_request", ("url:", url, "data:", data, "header:", header))

        headers = XcalLoggerExternalLinker.prepare_client_request_headers(url, method, headers = header)
        #ori
        #if method == "GET":
        #    result = requests.get(url, headers=headers)
        #elif method == "POST_TIMEOUT":
        #    result = requests.post(url, json=data, headers=headers, timeout=timeout / 1000)
        #elif method == "POST":
        #    result = requests.post(url, json=data, headers=headers)
        #elif method == "POST_FILE":
        #    result = requests.post(url, data=data, headers=headers, files=files)
        #elif method == "PUT":
        #    result = requests.put(url, data=json.dumps(data), headers=headers)
        #else:
        #    raise XcalException("XcalConnect", "send_http_request", "unknown http method %s" % method, TaskErrorNo.E_API_INVOKE_FAIL)
        #return result
        #end - ori code

        requests = Session()
        Retry.BACKOFF_MAX =60
        retry = Retry(
            total=30,
            backoff_factor=60,
            method_whitelist=['GET', 'POST', 'PUT'],
            status_forcelist=[401, 402, 403, 500, 502, 504, 494]
        )
        requests.mount(url, HTTPAdapter(max_retries=retry))
        #requests.keep_alive = True

        if method == "POST":
            response = requests.post(url, json=data, headers=headers, stream=False)
        elif method == "GET":
            response = requests.get(url, headers=headers, stream=False)
        elif method == "POST_TIMEOUT":
            response = requests.post(url, json=data, headers=headers, stream=False, timeout=timeout / 1000)
        elif method == "POST_FILE":
            response = requests.post(url, data=data, headers=headers, files=files, stream=False)
        elif method == "PUT":
            response = requests.put(url, data=json.dumps(data), headers=headers, stream=False)
        else:
            logging.error("unknown http method: %s" % method)
            raise EApiInvokeFail
        result = response
        response.close()
        del(response)
        return result

    @staticmethod
    def append_to_job_config(global_ctx, job_config, step_config, file_id=None, upload_result=None):
        if upload_result is None:
            upload_result = dict()
            if file_id is not None:
                upload_result["fileId"] = file_id
            else:
                raise XcalException("XcalConnect", "append_to_job_config", "cannot find valid file_id or upload_result",
                                    TaskErrorNo.E_JOB_CONFIG_APPEND_FAIL)

        if "uploadResults" not in job_config:
            job_config["uploadResults"] = []

        upload_result["filename"] = step_config.get("filename")

        # Add Upload Results to Job_Config
        job_config["uploadResults"].append(upload_result)
        # step_config["uploadResult"] = upload_result         # Can be used for debug

    @staticmethod
    def extract_upload_result(global_ctx, job_config, step_config):
        if job_config.get("uploadResults") is not None:
            upload_list = job_config.get("uploadResults")
            for one_item in upload_list:
                if one_item.get("filename") == step_config.get("filename"):
                    return one_item
        return None

    ##############################################
    # below functions are used for xcal-scanner.py
    ##############################################
    # added for offline agent

    def re_gen_project_id(self, projec_name):
        project_id = re.sub("[\`\^\_\[\]\\\]", "", re.sub("[^A-za-z0-9]", "", projec_name)) +str(random.randint(10000000, 99999999))
        return project_id

    def create_project(self, global_ctx, project_info):
        url = "%s%s" % (self.host_url, self.api_server.get("createProjectApi").replace("{token}", global_ctx.get("agentToken")))

        if project_info.get("projectId") is None:
            projectId = self.re_gen_project_id(project_info.get("projectName"))
        else:
            projectId = project_info.get("projectId")

        new_project_request = {"projectId": projectId,
                               "projectName": project_info.get("projectName"),
                               "projectConfig": {
                                   "sourceStorageName": AGENT_SOURCE_STORAGE,
                                   "relativeSourcePath": project_info.get("projectPath"),
                                   "relativeBuildPath": project_info.get("buildPath"),
                                   "scanType": OFFLINE_AGENT_TYPE,
                                   "uploadSource": project_info.get("uploadSource")
                               },
                               "scanConfig": project_info.get("scanConfig", {})
                               }
        try:
            result = self.send_http_request(url, header = {}, data = new_project_request, method = "POST")
            result.raise_for_status()
        except requests.exceptions.RequestException as err:
            self.logger.error("XcalConnect", "create_project", "create project request body: %s" % new_project_request)
            raise XcalException("XcalConnect", "create_project", "create project failed: %s, response: %s" % (err, err.response.content),
                                TaskErrorNo.E_CREATE_PROJECT_FAILED)
        return result.json()

    def update_project(self, global_ctx, project_info):
        url = "%s%s" % (self.host_url,
                        self.api_server.get("updateProject").replace("{token}", global_ctx.get("agentToken"))
                        )
        new_project_request = {
            "projectId": project_info.get("projectId"),
            "projectName": project_info.get("projectName"),
            "projectConfig": {
                "sourceStorageName": AGENT_SOURCE_STORAGE,
                "relativeSourcePath": project_info.get("projectPath"),
                "relativeBuildPath": project_info.get("buildPath"),
                "scanType": OFFLINE_AGENT_TYPE
            },
            "scanConfig": project_info.get("scanConfig")
        }
        try:
            result = self.send_http_request(url, header = {"Content-Type":"application/json"}, data = new_project_request, method = "PUT")
            #Catch update project error and change to error level
            if result.json().get("level") == "WARN":
                raise XcalException("XcalConnect", "update_project11", message= result.json().get("message"), err_code=TaskErrorNo.E_ADD_SCAN_TASK_FAILED)
                #self.logger.error("XcalConnect", "update_project", result.json().get("message"))
                #sys.exit(1)
            result.raise_for_status()
        except requests.exceptions.RequestException as err:
            self.logger.error("XcalConnect", "create_project", "update project request body: %s" % new_project_request)
            raise XcalException("XcalConnect", "create_project", "update project failed: %s, response: %s" % (err, err.response.content),
                                TaskErrorNo.E_CREATE_PROJECT_FAILED)
        return result.json()

    # added for offline agent
    def get_project_config(self, global_ctx, project_id):
        url = "%s%s" % (self.host_url, self.api_server.get("getProjectApi").replace("{projectId}", project_id)
                        .replace("{token}", global_ctx.get("agentToken")))
        try:
            result = self.send_http_request(url, header = {}, data = {}, method = "GET")
        except requests.exceptions.RequestException as err:
            raise XcalException("XcalConnect", "get_project_config", "get project config failed: %s, response: %s" % (err, err.response.content),
                                TaskErrorNo.E_GET_PROJECT_CONFIG_FAILED)
        return result

    # added for offline agent
    def add_scan_task(self, global_ctx, project_uuid):
        url = "%s%s" % (self.host_url,
                        self.api_server.get("addScanTaskApi").replace("{id}", project_uuid)
                        .replace("{token}", global_ctx.get("agentToken")).replace("{status}", "pending"))

        try:
            result = self.send_http_request(url, header = {}, data = {}, method = "POST")
            result.raise_for_status()
        except requests.exceptions.RequestException as err:
            raise XcalException("XcalConnect", "add_scan_task", "add scan task failed: %s, response: %s" % (err, err.response.content),
                                TaskErrorNo.E_ADD_SCAN_TASK_FAILED)
        return result.json()

    # added for offline agent
    def add_scan_task_with_attributes(self, global_ctx, argument_dict, project_uuid):
        url = "%s%s" % (self.host_url, self.api_server.get("addScanTaskWithAttributesApi").replace("{token}", global_ctx.get("agentToken")))

        scan_task_attributes = []
        if argument_dict.get("baselineCommitId"):
            scan_task_attributes.append({"type": "SCAN", "name": "baselineCommitId", "value": argument_dict.get("baselineCommitId")})

        if argument_dict.get("commitId"):
            scan_task_attributes.append({"type": "SCAN", "name": "commitId", "value": argument_dict.get("commitId")})

        self.logger.debug("add_scan_task_with_attributes", "attributes: %s" % scan_task_attributes)
        add_scan_task_request = {"projectId": project_uuid, "startNow": 0,
                                 "attributes": scan_task_attributes}

        try:
            result = self.send_http_request(url, header = {}, data = add_scan_task_request, method = "POST")
            if result.json().get("level") == "ERROR":
                raise XcalException("XcalConnect", "add_scan_task_with_attributes", message=result.json().get("localizedMessage"), err_code=result.json().get("errorCode"))
            result.raise_for_status()
        except requests.exceptions.RequestException as err:
            self.logger.error("XcalConnect", "add_scan_task_with_attributes", "add scan task with attributes request body: %s" % scan_task_attributes)
            raise XcalException("XcalConnect", "add_scan_task_with_attributes", "add scan task with attributes failed: %s, response: %s" % (err, err.response.content),
                                TaskErrorNo.E_ADD_SCAN_TASK_FAILED)
        return result.json()

    # added for offline agent
    def call_scan_service(self, global_ctx, job_config):
        config_obj = ConfigObject.merge_two_dicts(job_config, job_config.get("taskConfig"))
        del config_obj["taskConfig"]
        del config_obj["steps"]

        self.logger.debug("call_scan_service", "config info: %s" % config_obj)
        url = "%s%s" % (self.host_url, self.api_server.get("scanServiceApi"))

        try:
            result = self.send_http_request(url, header = {}, data = config_obj, method = "POST_TIMEOUT", timeout = int(global_ctx.get("CALL_SCAN_SERVICE_TIMEOUT"))*1000)
            result.raise_for_status()
        except requests.exceptions.Timeout as err:
            raise XcalException("XcalConnect", "call_scan_service", message="Scan server failed to respond to scan request. Please try again, or contact the Xcalibyte support team if the problem persists.",
                                err_code=TaskErrorNo.E_CALL_SCAN_SERVICE_FAILED)
        except requests.exceptions.RequestException as err:
            raise XcalException("XcalConnect", "call_scan_service", "call scan service failed: %s" % (err),
                                TaskErrorNo.E_CALL_SCAN_SERVICE_FAILED)
        except Exception as err:
            raise XcalException("XcalConnect", "call_scan_service", "call scan service failed: %s" % (err),
                                TaskErrorNo.E_CALL_SCAN_SERVICE_FAILED)
        return result

    # for plugin
    def get_rule_description(self, global_ctx, rule_id, lang):
        url = "%s%s" % (self.host_url, self.api_server.get("getRuleInformation").replace("{id}", rule_id)
                        .replace("{lang}", lang)
                        .replace("{token}", global_ctx.get("agentToken")))
        try:
            result = self.send_http_request(url, header = {}, data = {}, method = "GET")
        except requests.exceptions.RequestException as err:
            raise XcalException("XcalConnect", "get_rule_description", "get rule description failed: %s, response: %s" % (err, err.response.content),
                                TaskErrorNo.E_GET_PROJECT_CONFIG_FAILED)
        return result

    def get_scan_task(self, global_ctx, project_id):
        url = "%s%s" % (self.host_url, self.api_server.get("getScanTask").replace("{id}", project_id)
                        .replace("{token}", global_ctx.get("agentToken")))
        try:
            result = self.send_http_request(url, header = {}, data = {}, method = "GET")
        except requests.exceptions.RequestException as err:
            raise XcalException("XcalConnect", "get_scan_task", "get scan task failed: %s, response: %s" % (err, err.response.content),
                                TaskErrorNo.E_GET_PROJECT_CONFIG_FAILED)
        return result


    def get_projects(self, global_ctx):
        url = "%s%s" % (self.host_url, self.api_server.get("getProjects").replace("{token}", global_ctx.get("agentToken")))
        try:
            result = self.send_http_request(url, header = {}, data = {}, method = "GET")
        except requests.exceptions.RequestException as err:
            raise XcalException("XcalConnect", "get_projects", "get projects failed: %s, response: %s" % (err, err.response.content),
                                TaskErrorNo.E_GET_PROJECT_CONFIG_FAILED)
        return result

    def get_scan_results(self, global_ctx, scan_id, lang):
        url = "%s%s" % (self.host_url, self.api_server.get("getScanResult").replace("{id}", scan_id)
                        .replace("{lang}", lang)
                        .replace("{token}", global_ctx.get("agentToken")))
        try:
            result = self.send_http_request(url, header = {}, data = {}, method = "GET")
        except requests.exceptions.RequestException as err:
            raise XcalException("XcalConnect", "get_scan_results", "get scan results failed: %s, response: %s" % (err, err.response.content),
                                TaskErrorNo.E_GET_PROJECT_CONFIG_FAILED)
        return result
    # end for plugin

    def get_project(self, project_config_obj, global_ctx):
        url = "%s%s" % (self.host_url, self.api_server.get("getProjectByIdApi").replace("{projectId}", project_config_obj.get("project").get("id"))
                        .replace("{token}", global_ctx.get("agentToken")))
        try:
            result = self.send_http_request(url, header = {}, data = {}, method = "GET")
        except requests.exceptions.RequestException as err:
            raise XcalException("XcalConnect", "get_project", "get project failed: %s, response: %s" % (err, err.response.content),
                                TaskErrorNo.E_GET_PROJECT_FAILED)
        return result

    ##############################################
    # below functions are not used
    ##############################################
    def download_file(self, download_file_id, local_path, global_ctx, job_config, step_config):
        # hasher = HashTracker(hashlib.sha256())
        # progress = FileFetchTracker(self.logger, global_ctx, job_config, step_config) # progress bar later
        download_url = "%s%s" % (self.host_url,
                                 self.api_server.get("fileDownloadApi")
                                 .replace("{fileInfoId}", download_file_id)
                                 .replace("{token}", job_config.get("taskConfig").get("token")))
        try:
            DownloadUtil.download(download_url, local_path)
        except requests.RequestException as e:
            self.logger.info("Downloading source tarball failed, please retry", (download_url, e))
            raise XcalException("XcalConnect", "download_file", "Downloading source tarball failed",
                                TaskErrorNo.E_COLLECT_TAR_FAILED)
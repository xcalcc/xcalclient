#!/usr/bin/env python3
# -*- coding:utf-8 -*-

#
# Copyright (C) 2021 Xcalibyte (Shenzhen) Limited.
#

import argparse
import json
import os
from datetime import datetime
import requests
from sys import exit

# Api
REQUESTS_TIMEOUT = 10
API_USER_LOGIN_URL = '%s/api/auth_service/v2/login'
API_GET_PROJECT_UUID_URL = '%s/api/project_service/v2/project/project_id/%s/config'
API_GET_SCAN_TASK_SUMMARY_URL = '%s/api/scan_service/v2/scan_task/%s/scan_summary'
API_GET_SCAN_TASK_STATUS_BY_PROJECT_UUID_URL = '%s/api/scan_service/v2/project/%s/scan_task'
API_GET_SCAN_TASK_STATUS_URL = '%s/api/scan_service/v2/scan_task/%s/status'
API_SEARCH_ISSUE_GROUP_URL = '%s/api/issue_service/v3/search_issue_group?page=%d&size=%d'
API_GET_RULE_INFO_MAP_URL = '%s/api/rule_service/v3/rule/rule_list'
API_GET_SERVER_LOG_URL = '%s/api/file_service/v2/log/scan_task/%s'

#JSON keys
TASK_RECORD_KEY_ID = "id"
TASK_RECORD_KEY_STATUS = "status"
TASK_RECORD_STATUS_KEY_ACTIVITY_LOG = "activityLog"
TASK_RECORD_KEY_PROJECT_CONFIG = "projectConfig"
TASK_RECORD_KEY_PROJECT_NAME = "projectName"
TASK_RECORD_KEY_ONLINE_SCAN_ID = "onlineScanId"

TASK_RECORD_KEY_CICD = "cicd"
TASK_RECORD_KEY_REMOTE_URL = "remoteUrl"
TASK_RECORD_KEY_PIPELINE_TYPE = "pipelineType"
TASK_RECORD_KEY_BASELINE_COMMIT_ID = "baselineCommitId"
TASK_RECORD_KEY_COMMIT_ID = "commitId"
TASK_RECORD_KEY_CURRENT_STATE = "currentState"
TASK_RECORD_KEY_NEXT_STATE = "nextState"

ACTIVITY_LOG_KEY_FLOW_LOGS = "flowLogs"
ACTIVITY_LOG_KEY_OTHERS = "others"
ACTIVITY_LOG_KEY_STEP_NAME = "stepName"
ACTIVITY_LOG_KEY_START_AT = "startedAt"
ACTIVITY_LOG_KEY_EXECUTE_COMMAND = "executeCommand"

DEFAULT_EMPTY_STRING = ""

class Api:

    def __init__(self, host: str):
        self.host = host

    def user_login(self, username: str, password: str):
        try:
            url = API_USER_LOGIN_URL % self.host
            payload = {'username': username, 'password': password}
            res = requests.post(url, json=payload, timeout=REQUESTS_TIMEOUT)
            contentJson=res.json()
            if res.status_code != requests.codes.ok:
                raise Exception("http status code:"+str(res.status_code))
            return '%s %s' % (contentJson['tokenType'], contentJson['accessToken']), None
        except Exception as ex:
            return None, ex

    def get_project_uuid(self, project_id: str, token: str):
        try:
            url = API_GET_PROJECT_UUID_URL % (self.host, project_id)
            headers = {'Authorization': token}
            res = requests.get(url, headers=headers, timeout=REQUESTS_TIMEOUT).json()
            return res['project']['id'], None
        except Exception as ex:
            return None, ex

    def get_scan_task_summary(self, scan_task_id: str, token: str):
        try:
            url = API_GET_SCAN_TASK_SUMMARY_URL % (self.host, scan_task_id)
            headers = {'Authorization': token}
            res = requests.get(url, headers=headers, timeout=REQUESTS_TIMEOUT).json()
            return res['status'], res, None
        except Exception as ex:
            return None, None, ex

    def get_scan_task_status_by_project_uuid(self, project_uuid: str, token: str):
        try:
            url = API_GET_SCAN_TASK_STATUS_BY_PROJECT_UUID_URL % (self.host, project_uuid)
            headers = {'Authorization': token}
            res = requests.get(url, headers=headers, timeout=REQUESTS_TIMEOUT).json()
            return res['status'], res, None
        except Exception as ex:
            return None, None, ex

    def get_scan_task_status(self, scan_task_id: str, token: str):
        try:
            url = API_GET_SCAN_TASK_STATUS_URL % (self.host, scan_task_id)
            headers = {'Authorization': token}
            res = requests.get(url, headers=headers, timeout=REQUESTS_TIMEOUT).json()
            return res['status'], res, None
        except Exception as ex:
            return None, None, ex

    def search_issue_group(self, scan_task_id: str, dsr_type: str, token: str, page: int = 0, size: int = 10):
        try:
            url = API_SEARCH_ISSUE_GROUP_URL % (self.host, page, size)
            headers = {'Authorization': token}
            payload = {'scanTaskId': scan_task_id, 'dsrType': [dsr_type]}
            res = requests.post(url, json=payload, headers=headers, timeout=REQUESTS_TIMEOUT).json()
            return res['totalElements'], res['content'], None
        except Exception as ex:
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

    def get_server_log(self, scan_task_id: str, token: str):
        try:
            url = API_GET_SERVER_LOG_URL % (self.host, scan_task_id)
            headers = {'Authorization': token}
            res = requests.get(url, headers=headers, timeout=REQUESTS_TIMEOUT)
            if res.status_code != requests.codes.ok:
                raise Exception("http status code:"+str(res.status_code))
            return res, None
        except Exception as ex:
            return None, ex


def parse_arguments(server_scan_task_file_name):
    parser = argparse.ArgumentParser()
    parser.add_argument('--project-path',type=str, help="", required=True)
    parser.add_argument('--scan-task-id',type=str, help="", required=False)
    parser.add_argument('--server-url',type=str, help="", required=False)
    parser.add_argument('--username',type=str, help="", required=True)
    parser.add_argument('--password',type=str, help="", required=True)
    parser.add_argument('--output-file',type=str, help="", required=False,default=server_scan_task_file_name)
    args = parser.parse_args()
    return args

def get_server_log(Api, target_scan_task_id, server_url, username, password):
    api=Api(server_url)
    token, err = api.user_login(username, password)
    if err is not None:
        msg = 'Login failed. Please make sure the username and password are correct and retry. '+str(err)
        raise Exception(msg)
    response, err = api.get_server_log(target_scan_task_id, token)
    if err is not None:
        msg = 'Server log not exist or failed to get server log. '+str(err)
        raise Exception(msg)

    response=response.json()
    if response is not None:
        username = response["username"]
        log_content = response["logContent"]
    else:
        raise Exception("No server response")

    return username,log_content

if __name__ == '__main__':
    
    # Const
    client_project_xcalscan_folder_name=".xcalscan"
    client_task_records_file_name = "task_records.json"
    client_state_json_file_name = "state.json"
    server_scan_task_file_name = "scan_task.log"

    # Const mode
    server_scan_task_id_mode="server_scan_task_id"
    client_scan_task_id_mode="client_scan_task_id"
    
    # Parse arguments
    args = parse_arguments(server_scan_task_file_name)

    # Fill in default values
    project_path=args.project_path
    search_mode=""
    if args.scan_task_id is not None:
        target_scan_task_id=args.scan_task_id
        search_mode=server_scan_task_id_mode
    else:
        search_mode=client_scan_task_id_mode
    server_url=args.server_url
    username=args.username
    password=args.password
    output_file_path=args.output_file

    # Validate arguments

    # Gather and convert client logs
    task_records_file_path = os.path.join(project_path,client_project_xcalscan_folder_name,client_task_records_file_name)
    if not os.path.exists(task_records_file_path):
        print("Task records file not found: %s" % (task_records_file_path))
        exit()

    with open (task_records_file_path, "r", encoding="utf-8") as json_file:
        task_records = json.load(json_file)

    if search_mode==server_scan_task_id_mode: # if server id mode
        task_record_obj=None
        for task_record in task_records:
            if task_record[TASK_RECORD_KEY_ONLINE_SCAN_ID] == target_scan_task_id:
                task_record_obj = task_record
                break
        if task_record_obj == None:
            print("Scan task id not found from client: "+target_scan_task_id)
            exit()
    else:  # if client id mode, get last obj
        if len(task_records) > 0:
            task_record_obj=task_records[len(task_records)-1]   #last obj
            target_scan_task_id=task_record_obj[TASK_RECORD_KEY_ONLINE_SCAN_ID]
        else:
            print("Scan not found from client")
            exit()
            
    if not target_scan_task_id:
        target_scan_task_id=""

    activity_logs=[]
    remote_url = DEFAULT_EMPTY_STRING
    pipeline_type = DEFAULT_EMPTY_STRING
    baseline_commit_id = DEFAULT_EMPTY_STRING
    commit_id = DEFAULT_EMPTY_STRING
    current_state = DEFAULT_EMPTY_STRING
    next_state = DEFAULT_EMPTY_STRING

    if TASK_RECORD_KEY_ID in task_record_obj and TASK_RECORD_KEY_STATUS in task_record_obj and TASK_RECORD_STATUS_KEY_ACTIVITY_LOG in task_record_obj[TASK_RECORD_KEY_STATUS]:
        client_scan_id = task_record_obj[TASK_RECORD_KEY_ID]
        activity_logs = task_record_obj[TASK_RECORD_KEY_STATUS][TASK_RECORD_STATUS_KEY_ACTIVITY_LOG]
    else:
        print("Key %s or %s or %s not found from task_record_obj" % (TASK_RECORD_KEY_ID, TASK_RECORD_KEY_STATUS, TASK_RECORD_KEY_STATUS+"."+TASK_RECORD_STATUS_KEY_ACTIVITY_LOG))
        exit()

    # get ci cd information
    if TASK_RECORD_KEY_CICD in task_record_obj:
        cicd_obj = task_record_obj[TASK_RECORD_KEY_CICD]
        remote_url = cicd_obj.get(TASK_RECORD_KEY_REMOTE_URL) or DEFAULT_EMPTY_STRING
        pipeline_type = cicd_obj.get(TASK_RECORD_KEY_PIPELINE_TYPE) or DEFAULT_EMPTY_STRING
        commit_id = cicd_obj.get(TASK_RECORD_KEY_COMMIT_ID) or DEFAULT_EMPTY_STRING
        baseline_commit_id = cicd_obj.get(TASK_RECORD_KEY_BASELINE_COMMIT_ID) or DEFAULT_EMPTY_STRING
        current_state = cicd_obj.get(TASK_RECORD_KEY_CURRENT_STATE) or DEFAULT_EMPTY_STRING
        next_state = cicd_obj.get(TASK_RECORD_KEY_NEXT_STATE) or DEFAULT_EMPTY_STRING

    print("Generating %s for %s" % (output_file_path, target_scan_task_id))


    # Gather server logs
    user = ""
    log_content = ""
    try:
        username, log_content = get_server_log(Api, target_scan_task_id, server_url, username, password)
    except Exception as e :
        print("Failed to get server log: %s " % str(e) )


    #write log content
    with open(output_file_path, "w") as output_file:
        project_name = task_record_obj[TASK_RECORD_KEY_PROJECT_CONFIG][TASK_RECORD_KEY_PROJECT_NAME]
        # write header
        output_file.write("Project name, %s\n" % project_name)
        output_file.write("Account name, %s\n" % username)
        output_file.write("Scan task ID, %s\n" % target_scan_task_id)
        output_file.write("Repo URL, %s\n" % remote_url)
        output_file.write("Action, %s\n" % pipeline_type)
        output_file.write("Commit ID, %s\n" % commit_id)
        output_file.write("Baseline commit ID, %s\n" % baseline_commit_id)
        output_file.write("Current state, %s\n" % current_state)
        output_file.write("Next state, %s\n" % next_state)
        output_file.write("\n")
        output_file.write("TIME, SUBPHASE NAME\n")

        # write write client log
        for activity_log in activity_logs:
            started_at = datetime.utcfromtimestamp(activity_log[ACTIVITY_LOG_KEY_START_AT]/1000.0)
            started_at_str = started_at.strftime("%Y-%m-%d %H:%M:%S")
            
            
            step_name = activity_log[ACTIVITY_LOG_KEY_STEP_NAME]
            line=started_at_str+" - "+target_scan_task_id+" "+step_name+":Start"
            
            if ACTIVITY_LOG_KEY_OTHERS in activity_log:
                if ACTIVITY_LOG_KEY_EXECUTE_COMMAND in activity_log[ACTIVITY_LOG_KEY_OTHERS]:
                    execute_command = activity_log[ACTIVITY_LOG_KEY_OTHERS][ACTIVITY_LOG_KEY_EXECUTE_COMMAND]
                    output_file.write("%s, %s, %s\n" % (started_at_str,step_name,execute_command))
                if ACTIVITY_LOG_KEY_FLOW_LOGS in activity_log[ACTIVITY_LOG_KEY_OTHERS]:
                    flow_logs = activity_log[ACTIVITY_LOG_KEY_OTHERS][ACTIVITY_LOG_KEY_FLOW_LOGS]
                    for flow_log in flow_logs:
                        output_file.write(flow_log+"\n")

        # write server log
        output_file.write("%s\n" % log_content)
        
        
    print("Finish generating %s" % (output_file_path))
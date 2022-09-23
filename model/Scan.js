const fs = require('fs-extra'); //fs extra does not support file copying
const fsOriginal = require('fs');
const path = require('path');
const moment = require('moment');
const glob = require('glob');
const tools = require('../utils/tools');
const logger = require('../utils/logger');
const system = require('../utils/system');
const FlowPolicy = require('./FlowPolicy');
//load phases
const setupPhase = require('../controller/setup');
const preprocPhase = require('../controller/preproc');
// const State = require('./State');
const scanService = require('../service/scanService');
const projectService = require("../service/projectService");

const postActions = require('../postActions');

const logMeta = {
    file: 'model/Scan'
};

class Scan {
    _taskId = null;
    _onlineScanId = null;
    _state = {
        status: Policy.enums.STATUS.PENDING,
        activityLog: []
    };
    _workFolder = '';
    _project = null;
    _phases = [];
    _startTime = Date.now();
    _endTime = null;
    _policy = new FlowPolicy();
    _hasCustomRule = false;
    _commitInfo = {
        baselineCommitId: null,
        commitId: null,
    };
    _client = null;
    _conf = {};
    _partialScan = false;
    _deltaResult = false;
    _extraInfo = {};

    constructor(projectInstance, client, configs, extraInfo) {
        const {deltaResult} = configs;
        this._conf = configs;
        this._client = client;
        if (extraInfo) {
            this._extraInfo = extraInfo;
        }
        this._init(projectInstance, deltaResult);
        this._loadPhases({
            sourceCodePath: projectInstance.sourceCodePath,
            scanInstance: this,
            projectInstance,
            client,
        });
    }

    /**
     * Copy all custom rules to scan task folder
     * @param ruleCustomFolder
     * @private
     */
    _copyCustomRuleToScanTaskFolder(ruleCustomFolder) {
        const meta = {
            ...logMeta,
            method: '_copyCustomRuleToScanTaskFolder'
        }
        logger.info(`Custom rule folder found, copying rules into scan work folder...`, logMeta);
        //copy json
        fsOriginal.copyFile(`${ruleCustomFolder}/${Policy.configs.CLIENT.FILES_FOLDERS.CUSTOM_RULE_FILE}`, `${this._workFolder}/${Policy.configs.CLIENT.FILES_FOLDERS.CUSTOM_RULE_FILE}`, (err) => err && logger.error(err, meta));
        fsOriginal.copyFile(`${ruleCustomFolder}/${Policy.configs.CLIENT.FILES_FOLDERS.CUSTOM_PATH_MSG_FILE}`, `${this._workFolder}/${Policy.configs.CLIENT.FILES_FOLDERS.CUSTOM_PATH_MSG_FILE}`, (err) => err && logger.error(err, meta));
        //copy mi files
        glob(`${ruleCustomFolder}/*.mi`, {}, (err, paths) => {
            if (err) {
                logger.error(`Copy custom mi files error: ${err}`, meta);
                return;
            }
            paths.forEach(filePath => {
                const dest = `${this._workFolder}/${path.basename(filePath)}`;
                logger.info(`Copy ${filePath} to ${dest}`, meta);
                fsOriginal.copyFile(filePath, dest, (err) => err && logger.error(err, meta));
            });
        });
        this._hasCustomRule = true;
    }

    _changeLogFolder(newPath) {
        logger.changeLogFileLocation(Policy.configs.CLIENT.FILES_FOLDERS.LOGFILE_TRANSPORT_KEY, newPath);
    }

    /**
     * Create task folder
     * @param statePath
     * @private
     */
    _createTaskFolder(statePath) {
        if (!fs.pathExistsSync(statePath)) {
            system.exit(Policy.enums.EXIT_CODES.GENERAL_ERROR, ErrorCodes.lookup('E_CLIENT_CANNOT_ACCESS_WORK_FOLDER', {path: statePath}));
        }
        const scanTempPath = path.resolve(statePath, this._taskId);
        fs.ensureDirSync(scanTempPath);
        const newLogFolder = path.resolve(scanTempPath, Policy.configs.CLIENT.FILES_FOLDERS.LOG_FILE_NAME);
        fs.ensureDirSync(newLogFolder);
        this._workFolder = scanTempPath;
        this._changeLogFolder(newLogFolder);
    }

    /**
     * Construct phases into memory
     * @param context
     * @private
     */
    _loadPhases(context) {
        try {
            this._phases = [
                setupPhase(this._policy.json.PHASE.SETUP, context),
                preprocPhase(this._policy.json.PHASE.PREPROC, context),
            ];
        } catch (e) {
            system.exit(Policy.enums.EXIT_CODES.GENERAL_ERROR, {
                err_message: `Load phases failed, ${e}`
            });
        }
    }

    _init(projectInstance, deltaResult) {
        this._deltaResult = deltaResult;
        this._project = projectInstance;

        logger.info(`Init scan for project [${projectInstance.name}]`, logMeta);

        this._taskId = tools.generateId();

        logger.info(`Created local scan temp folder [${this._taskId}]`, logMeta);
        try {
            this._createTaskFolder(projectInstance.stateFolderPath);
            projectInstance.updateScanTaskToProjectScanRecords(this.getInfo());

            if (fs.pathExistsSync(projectInstance.customRuleFolder) && Policy.configs.CLIENT.ENABLE_CUSTOM_RULE_UPLOAD) {
                this._copyCustomRuleToScanTaskFolder(projectInstance.customRuleFolder);
            }

        } catch (e) {
            logger.error(`Failed to init scan, ${e}`, logMeta);
            system.exit(Policy.enums.EXIT_CODES.GENERAL_ERROR, {
                err_message: e
            });
        }
    }

    /**
     * push status to scan state object and write to file
     * @param state
     */
    pushState(state) {
        this._state.activityLog.push(state);
        this._project.updateScanTaskToProjectScanRecords(this.getInfo());
    }

    /**
     * Load scan by task id
     * @param id
     * @return {Scan}
     */
    load(id) {
        if (!fs.pathExistsSync(path.resolve(this._workFolder, id))) {
            throw new Error(`State folder is missing, cannot resume state for ID: ${this._workFolder}`);
        }
        this._taskId = id;
        this._state = fs.readJsonSync(`${this._workFolder}/${Policy.configs.CLIENT.FILES_FOLDERS.STATE_FILE}`, {encoding: 'utf8'});

        return this;
    }

    /**
     * Restore scan
     * @todo implementation
     */
    restore() {
        if (this._state.status === Policy.enums.STATUS.FAILED) {
            console.log('restore failed task: Todo, pop last state and redo');
            console.log(this._taskId);
            console.log(this._state);
        }
    }

    /**
     * Set commit info
     * @param commitInfo
     */
    setCommitInfo(commitInfo) {
        this._commitInfo = commitInfo;
    }

    /**
     * Getter for commit info
     * @return {{baselineCommitId: null, commitId: null}}
     */
    get commitInfo() {
        return this._commitInfo;
    }

    /**
     * Implement delta checking for pre-checkin scanning
     * @return {boolean}
     */
    get deltaResult() {
        return this._deltaResult;
    }

    /**
     * Replay to start a task from very beginning
     * @todo implementation
     */
    replay() {
        console.log('replay: Todo, read state stack and start from beginning');
        console.log(this._taskId);
        console.log(this._state);
    }

    /**
     * Store state to file
     * @private
     */
    _writeStateToFile() {
        try {
            fs.writeFileSync(`${this._workFolder}/${Policy.configs.CLIENT.FILES_FOLDERS.STATE_FILE}`, JSON.stringify(this._state, null, 4), {encoding: 'utf8'});
        } catch (e) {
            logger.error(e, logMeta);
        }
    }

    /**
     * Call api to find out if project has been scanned before and if commit id/baseline id exist
     */
    async checkIfPerformPartialScan() {
        const jwt = await this._client.user.getToken();
        const isFirstScan = await projectService.checkIfFirstScan(this._client.config.apiServerUrl, jwt, this._project.uuid);
        logger.debug(`[model/scan] isFirstScan: [${isFirstScan}]`, {
            ...logMeta,
            method: 'checkIfPerformPartialScan()'
        });
        logger.debug(`[model/scan] baselineCommitId: [${this._commitInfo.baselineCommitId}]`, {
            ...logMeta,
            method: 'checkIfPerformPartialScan()'
        });
        logger.debug(`[model/scan] commitId: [${this._commitInfo.commitId}]`, {
            ...logMeta,
            method: 'checkIfPerformPartialScan()'
        });
        logger.debug(`[model/scan] can perform partial scan: [${!!(this._commitInfo.baselineCommitId && this._commitInfo.commitId) && !isFirstScan}]`, {
            ...logMeta,
            method: 'checkIfPerformPartialScan()'
        });
        this._partialScan = !!((this._commitInfo.baselineCommitId && this._commitInfo.commitId) && !isFirstScan);
        logger.debug(`[model/scan] ScanInstance.partialScan: [${this._partialScan}]`, {
            ...logMeta,
            method: 'checkIfPerformPartialScan()'
        });

    }

    /**
     * Print the activity log for this scan
     * @return {array}
     */
    printStateLog() {
        logger.info(this._state.activityLog.join('->'), logMeta);
        return this._state.activityLog;
    }

    /**
     * Getter for state
     * @return {object}
     */
    get state() {
        return this._state;
    }

    /**
     * Getter for extraInfo
     * @return {object}
     */
    get extraInfo() {
        return this._extraInfo;
    }

    get partialScan() {
        return this._partialScan;
    }

    /**
     * Getter for the if the scan has custom rule
     * @return {boolean}
     */
    get hasCustomRule() {
        return this._hasCustomRule;
    }

    /**
     * Getter for scan task id
     * @return {null}
     */
    get id() {
        return this._taskId;
    }

    /**
     * Getter for the scan config
     * @return {*}
     */
    get config() {
        return this._conf;
    }

    /**
     * Getter for work folder path
     * @return {string}
     */
    get workFolder() {
        return this._workFolder;
    }

    /**
     * Setter for the config data
     * @param confData
     */
    set config(confData) {
        this._conf = confData;
    }

    /**
     * Set online scan ID
     * @param id
     */
    set onlineScanId(id) {
        this._onlineScanId = id;
    }

    /**
     * Getter for online scan ID
     * @return {String}
     */
    get onlineScanId() {
        return this._onlineScanId;
    }

    /**
     * Entry point of a scan
     * @return {Promise<void>}
     */
    async start(nextCicdState = null) {
        this._project.setCicdState(nextCicdState);
        this._startTime = Date.now();
        this._project.updateScanTaskToProjectScanRecords(this.getInfo());
        let finishingData = {};

        try {
            for await(let phase of this._phases) {
                const result = await phase.run(this);
                logger.debug(`[model/scan] Phase [${phase.name}] running result: ${JSON.stringify(result)}`);

                if (!result) {
                    this._state.status = Policy.enums.STATUS.FAILED;
                    finishingData = {
                        taskId: this._taskId,
                        phaseName: phase.name,
                        state: JSON.stringify(phase.state)
                    };
                } else {
                    this._state.status = Policy.enums.STATUS.SUCCESS;
                }
            }
        } catch (e) {
            const error = (e.logs && e.logs.error) || (Array.isArray(e.logs.stderr) ? e.logs.stderr[e.logs.stderr.length - 1] : e.logs.stderr);
            logger.error(`[${logMeta.file}] Scan start failed, reason: ${error}`, logMeta);
            this._state.status = Policy.enums.STATUS.FAILED;
            const reason = ErrorCodes.print(error);
            this._state.reason = reason;
            finishingData = {
                taskId: this._taskId,
                reason: reason || error,
            }
        } finally {
            await this._finish(finishingData);
        }
    }

    /**
     * Get info of the scan
     * @return {Object}
     */
    getInfo() {
        this._endTime = Date.now();

        return {
            id: this._taskId,
            onlineScanId: this._onlineScanId,
            startTime: this._startTime,
            endTime: this._endTime,
            cicd: {
                pipelineType: this._project.cicd.repoAction || Policy.enums.REPO_ACTION.TRIAL,
                remoteUrl:  this._project.cicd.remoteUrl || '',
                baselineCommitId: this._project.cicd.baselineCommitId || null,
                commitId: this._project.cicd.commitId || null,
                currentState: this._project.cicd.cicdFsmState,
                nextState: this._project.cicd.nextState
            },

            duration: `${moment(this._endTime).diff(moment(this._startTime), 'millisecond')} ms`,
            project: this._project.name,
            status: this._state,
            extraInfo: this._extraInfo,
            projectConfig: this._project.config
        };
    }

    /**
     * Construct result url
     * @return {string}
     * @private
     */
    _constructResultUrl() {
        const clientConf = this._client.config;
        const isMisra = this._project.config.scanConfig.scanMode === '-xsca';
        return `${clientConf.apiServerUrl}/${isMisra ? 'misra/' : ''}project/${this._project.id}`;
    }

    /**
     * Update scan status when online scan task id is available
     * @param status
     * @return {Promise<void>}
     */
    async updateScanStatus(status) {
        const jwt = this._client.user.token;
        if (this._onlineScanId && jwt) {
            await scanService.updateScanTaskStatus(this._client.config.apiServerUrl, jwt, {
                scanTaskId: this._onlineScanId,
                stage: Policy.enums.STATE.CLIENT_FINI,
                status: status
            });
            logger.info(`Finish updating status [${status}] for scan task [${this._onlineScanId}]`, logMeta);
        }
        // else {
        //     logger.error(`Online id was not found or authentication failure, cannot update scan status`, logMeta);
        // }
    }

    /**
     * zip work directory
     * @return {Promise<void>}
     * @private
     */
    async _zipStateFolder() {
        //zip task folder
        const zipFile = path.resolve(this._workFolder, '../', `${this._taskId}.zip`);
        logger.info(`Zipping file ${zipFile}`, logMeta);
        await tools.zipDirectory(this._workFolder, zipFile);
    }

    /**
     * Remove work directory
     * @private
     */
    _removeWorkFolder() {
        //delete task folder
        const folderToDelete = path.resolve(this._workFolder, '../', `${this._taskId}`);
        if (fs.pathExistsSync(folderToDelete)) {
            logger.info(`Deleting success task folder ${folderToDelete}`, logMeta);
            fs.rmdirSync(folderToDelete, {
                recursive: true
            });
        }
    }

    /**
     * A closing action for a scan
     * @private
     */
    async _finish(data) {
        this._writeStateToFile();
        let flowStdoutData = {
            ...data,
            projectId: this._project.id,
            buildInfo: this._extraInfo.buildInfo || '',
            scanTaskId: this._onlineScanId || null,
        };

        if (Policy.configs.CLIENT.ENABLE_CICD_CONTROL) {
            flowStdoutData.cicd = {
                pipelineType: this._project.cicd.repoAction,
                current: this._project.cicd.cicdFsmState,
                next: this._project.cicd.nextState
            };
        }
        this._project.updateScanTaskToProjectScanRecords(this.getInfo());
        if (this._state.status === Policy.enums.STATUS.SUCCESS) {
            logger.info(`Preprocess for project [${this._project.id}] is successful! please go to ${this._constructResultUrl()} to check the scan result`, logMeta);
            await this.updateScanStatus(Policy.enums.STATUS.PROCESSING);
            await this._zipStateFolder();
            //clean up folders
            this._project.cleanupTaskFolders();
            await this._postAction({
                success: true,
                errorMsg: '',
                taskId: this._onlineScanId,
                repoPath: this._project.config.projectName || "",
            });

            if (this._project.config.houseKeeping[Policy.enums.CONFIGURATION.PROJECT.KEEP_LOCAL_TEMP_FILES]) {
                tools.stdout(`Preprocessed file can be found at ${this.workFolder}/${Policy.configs.CLIENT.FILES_FOLDERS.PREPROCESS_PACKAGE}`);
            }
            system.exit(Policy.enums.EXIT_CODES.OK, flowStdoutData);
        } else {
            await this.updateScanStatus(Policy.enums.STATUS.FAILED);
            await this._postAction({
                success: false,
                errorMsg: Policy.enums.EXIT_CODES.GENERAL_ERROR,
                taskId: this._onlineScanId,
                repoPath: this._project.config.projectName || "",
            });
            system.exit(Policy.enums.EXIT_CODES.GENERAL_ERROR, flowStdoutData);
        }
    }

    async _postAction(data) {
        logger.debug(`[POST_ACTION] UPDATE_STATUS_TO_3RD_PARTY: ${process.env.UPDATE_STATUS_TO_3RD_PARTY}`);
        logger.debug(`[POST_ACTION] this._client.config._3rdPartyUpdateUrl: ${this._client.config._3rdPartyUpdateUrl}`);

        try {
            if (process.env.UPDATE_STATUS_TO_3RD_PARTY && this._client.config._3rdPartyUpdateUrl) {
                const result = await postActions.update3rdPartyStatus(this._client.config._3rdPartyUpdateUrl, {
                    verb: 'post',
                    data,
                });
                logger.info(`Update status success,  ${JSON.stringify(result)}`, logMeta);
            }
        } catch (e) {
            logger.error(`Update status failed,  ${JSON.stringify(e)}`, logMeta);

            system.exit(Policy.enums.EXIT_CODES.GENERAL_ERROR, e);
        }
    }
}

module.exports = Scan;

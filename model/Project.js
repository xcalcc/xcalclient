const fs = require('fs-extra');
const path = require('path');
const validator = require('../validator');
const logger = require('../utils/logger');
const system = require('../utils/system');
const tools = require('../utils/tools');
const ScanTask = require('./Scan');
const scanService = require('../service/scanService');
const projectService = require("../service/projectService");
const gitTool = require("../utils/git");

const logMeta = {
    file: 'model/Project.js'
};

/**
 * Project Model
 * 1. Create project
 * 2. Load scan configs
 * 3. Ensure project level folders to hold scan tasks
 * 4. Create projectID if no projectID is provided in the scan config
 */
class Project {
    _stateFolderName = Policy.configs.CLIENT.FILES_FOLDERS.STATE_FOLDER_NAME;
    _taskRecordsFileName = Policy.configs.CLIENT.FILES_FOLDERS.TASK_RECORD_FILE_NAME;
    _cancelRecordsFileName = Policy.configs.CLIENT.FILES_FOLDERS.CANCEL_RECORD_FILE_NAME;
    _confFilePath = '';
    _conf = {};
    _taskRecordsFilePath = '';
    _taskRecords = [];
    _cancelRecords = [];
    _projectName = '';
    _stateFolderPath = '';
    _customTaskFolderPath = '';
    _sourceCodePath = '';
    _scanConfigPath = '';
    _customRuleFolder = '';
    _client = null;

    _id = null;
    _uuid = null;

    _cicd = {};

    constructor(client, configs) {
        const {sourceCodePath, configPath} = configs;
        this._client = client;
        if (!fs.pathExistsSync(sourceCodePath)) {
            system.exit(Policy.enums.EXIT_CODES.GENERAL_ERROR, ErrorCodes.lookup('E_CLIENT_SOURCE_CODE_PATH_NOT_FOUND'));
        }

        this._sourceCodePath = sourceCodePath;
        //use config path first
        if (!fs.pathExistsSync(configPath)) {
            this._scanConfigPath = path.resolve(sourceCodePath, Policy.configs.CLIENT.FILES_FOLDERS.SCAN_CONFIG_FILE);
        } else {
            this._scanConfigPath = path.resolve(configPath);
        }

        if (!fs.pathExistsSync(this._scanConfigPath)) {
            // system.exit(Policy.enums.EXIT_CODES.GENERAL_ERROR, ErrorCodes.lookup('E_CLIENT_MISSING_SCAN_CONFIG'));
            logger.warn(`[model/Project] ${ErrorCodes.lookup('E_CLIENT_MISSING_SCAN_CONFIG').msg}`, logMeta);
        }

        this._customRuleFolder = path.resolve(sourceCodePath, Policy.configs.CLIENT.FILES_FOLDERS.CUSTOM_RULE_FOLDER);
    }

    /**
     * Prepare cicd config related logic
     * @param context
     * @return {Promise<void>}
     * @private
     */
    async _cicdPreparation(context) {
        const {repoPath, repoBranch} = context;
        logger.info(`[model/Project] Going to get commit id from ${repoPath}@${repoBranch}`, logMeta);
        try {
            const headCommit = gitTool.getLatestCommitId(repoPath, repoBranch);
            const remoteUrl = gitTool.getRemoteUrl(repoPath);
            logger.info(`[model/Project] Found commit id: ${headCommit}`, logMeta);
            this._cicd.commitId = headCommit;
            this._cicd.remoteUrl = remoteUrl;
        } catch (e) {
            logger.error(`[model/Project] fail to prepare cicd prerequisites on repo path ${repoPath}@${repoBranch}, error "${JSON.stringify(e)}"`, logMeta);
            this._cicd.commitId = null;
        } finally {

        }
    }

    init(customTaskFolder) {
        this._readConfigFromFile(this._scanConfigPath);
        this._ensureStateParentFolder(customTaskFolder);
    }

    _writeXcalScanConf(path, content) {
        try {
            logger.debug(`Writing project config file to ${path}`, logMeta);
            fs.writeFileSync(path, JSON.stringify(content, null, 4), 'utf8');
        } catch (e) {
            system.exit(Policy.enums.EXIT_CODES.GENERAL_ERROR, ErrorCodes.lookup('E_CLIENT_WRITE_SCAN_CONF_FAILED', {path}));
        }
    }

    /**
     * Project id must be between 3 and 63 characters long.
     * Project id can consist only of lowercase letters, numbers, dots (.), and hyphens (-).
     * Project id must begin and end with a letter or number.
     * Project id must not be formatted as an IP address (for example, 192.168.5.4).
     * Project id can't begin with xn-- (for buckets created after February 2020).
     * ?Project id must be unique within a partition.
     * ?Buckets used with Amazon S3 Transfer Acceleration can't have dots (.) in their names. For more information about transfer acceleration, see Amazon S3 Transfer Acceleration.
     * @param projectId
     * @return {boolean}
     * @private
     */
    _validateProjectId(projectId) {
        switch (true) {
            case projectId.length < 3 || projectId.length > 63:
                logger.debug(`[${logMeta.file}] Project id must be between 3 and 63 characters long.`, logMeta);
                return false;
            case /[^a-z0-9.-]/g.test(projectId):
                logger.debug(`[${logMeta.file}] Project id can consist only of lowercase letters, numbers, dots (.), and hyphens (-).`, logMeta);
                return false;
            case /^[^a-z0-9]/g.test(projectId):
                logger.debug(`[${logMeta.file}] Project id must begin and end with a letter or number.`, logMeta);
                return false;
            case /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/g.test(projectId):
                logger.debug(`[${logMeta.file}] Project id must not be formatted as an IP address (for example, 192.168.5.4).`, logMeta);
                return false;
            case /^(xn\-\-)/g.test(projectId):
                logger.debug(`[${logMeta.file}] Project id can't begin with xn--.`, logMeta);
                return false;
            default:
                return true;
        }
    }

    /**
     *
     * @param xcalscanConf
     * @param serverUrl
     * @param token
     * @return {Promise<void>}
     * @private
     */
    async _updateOnlineProjectConf(xcalscanConf, serverUrl, token) {
        try {
            //data structure same as POST
            const updatedProjectConf = {
                projectName: xcalscanConf.projectName,
                projectId: xcalscanConf.projectId,
                scanConfig: xcalscanConf.scanConfig,
                projectConfig: {
                    scanType: 'offline_agent',
                    sourceStorageName: 'agent',
                    sourceStorageType: 'AGENT',
                    relativeSourcePath: xcalscanConf.projectPath,
                    relativeBuildPath: xcalscanConf.buildPath || '/',
                    gitUrl: xcalscanConf.gitUrl,
                    uploadSource: xcalscanConf.uploadSource
                },
            };
            logger.debug(`[${logMeta.file}]Synchronizing local project config to ${serverUrl}, config: ${JSON.stringify(updatedProjectConf)}`, logMeta);

            const updateResult = await projectService.updateProjectConf(serverUrl, updatedProjectConf, token);

            if (updateResult.httpCode && updateResult.httpCode === 400) {
                logger.debug(`[${logMeta.file}] Update project config failed due to duplicated project name [${updatedProjectConf.projectName}]`, logMeta);
                system.exit(Policy.enums.EXIT_CODES.GENERAL_ERROR, ErrorCodes.lookup('E_DUPLICATE_PROJECT_NAME', {projectName: updatedProjectConf.projectName}));
            }
            logger.info(`[${logMeta.file}]Project config has been updated successfully`, logMeta);
            logger.debug(`[${logMeta.file}]updateResult: ${JSON.stringify(updateResult)}`, logMeta);
        } catch (e) {
            logger.error(`[${logMeta.file}]Failed to update project config, ${JSON.stringify(e)}`, logMeta);
        }
    }

    _validateWhitelist(localProjectConf, onlineProjectConf) {
        const whitelistArgs = [
            'fileBlacklistCmd',
            'fileWhitelistCmd',
            'fileBlacklist',
            'ruleWhitelist',
        ];
        let whitelistChanged = false;
        whitelistArgs.forEach(key => {
            const localWhitelistAttr = localProjectConf.scanConfig[key] || '';
            const attribute = onlineProjectConf.attributes.find(attr => attr.name === key);
            const onlineWhitelistAttr = attribute ? attribute.value : '';
            logger.info(`[model/Project][validateWhitelist] Validating "${key}", local: [${localWhitelistAttr}], server: [${onlineWhitelistAttr}]`, logMeta);
            if (localWhitelistAttr !== onlineWhitelistAttr) {
                logger.warn(`[model/Project][validateWhitelist] ${key} value changed, local: [${localWhitelistAttr}], server: [${onlineWhitelistAttr}]`);
                whitelistChanged = true;
                return;
            }
        });

        return whitelistChanged;
    }

    /**
     * Creating
     * @param localProjectConfig
     * @param serverUrl
     * @param token
     * @return {Promise<{projectId: string}>}
     * @private
     */
    async _createNewProject(localProjectConfig, serverUrl, token) {
        const {
            projectName,
            projectId,
            scanConfig,
            projectPath,
            buildPath,
            uploadSource,
        } = localProjectConfig;

        const newProjectId = projectId || tools.generateProjectId(projectName);

        logger.info(`[${logMeta.file}]Creating online project for project name [${projectName}] and projectId [${newProjectId}]...`, logMeta);
        const onlineProject = await projectService.createProject(serverUrl, {
            projectName,
            projectId: newProjectId,
            scanConfig,
            projectConfig: {
                scanType: 'offline_agent',
                sourceStorageName: 'agent',
                sourceStorageType: 'AGENT',
                relativeSourcePath: projectPath,
                relativeBuildPath: buildPath || '/',
                gitUrl: localProjectConfig.gitUrl,
                uploadSource,
            },
        }, token);
        if (onlineProject.httpCode && onlineProject.httpCode === 400) {
            logger.debug(`[${logMeta.file}] Create project failed due to duplicated project name [${projectName}]`, logMeta);
            system.exit(Policy.enums.EXIT_CODES.GENERAL_ERROR, ErrorCodes.lookup('E_DUPLICATE_PROJECT_NAME', {projectName}));
        }
        logger.debug(`[${logMeta.file}] Project created online, config generated in db ${JSON.stringify(onlineProject)}`, logMeta);

        if (!onlineProject || !onlineProject.id) {
            system.exit(Policy.enums.EXIT_CODES.GENERAL_ERROR, ErrorCodes.lookup('E_CLIENT_FAILED_TO_CREATE_PROJECT', {
                name: projectName,
                error: JSON.stringify(onlineProject.error)
            }));
        }

        logger.info(`[${logMeta.file}] Successfully created online project for [${projectName}], online id is ${onlineProject.id} ...`, logMeta);
        onlineProject.projectId = newProjectId;
        return onlineProject;
    }

    /**
     *
     * @param localProjectConf
     * @param updateData
     * @return {*}
     * @private
     */
    _updateLocalProjectConf(localProjectConf, updateData) {
        logger.debug(`[Project] Updating local config data with ${JSON.stringify(updateData)}`, logMeta);
        return {
            ...localProjectConf,
            ...updateData,
        };
    }

    _validateConfigByCICDState(cicdState, repoActionConfigOnline, repoActionLocal) {
        if (cicdState === Policy.enums.CICDFSM_STATE.CI_DSR_SCAN_DONE || cicdState === Policy.enums.CICDFSM_STATE.CD_DSR_SCAN_DONE) {
            if (!repoActionLocal) {
                logger.error(ErrorCodes.print('E_DSR_STATE_MISSING_REPO_ACTION'), logMeta);
                return false;
            }
        }

        switch (repoActionConfigOnline) {
            case Policy.enums.REPO_ACTION.CI:
                if (repoActionLocal && repoActionConfigOnline !== repoActionLocal) {
                    logger.error(ErrorCodes.print('E_REPO_ACTION_CI_NOT_ALLOW_TO_MODIFY'), logMeta);
                    return false;
                }
            case Policy.enums.REPO_ACTION.CD:
                if (repoActionLocal && repoActionConfigOnline !== repoActionLocal) {
                    logger.error(ErrorCodes.print('E_REPO_ACTION_CD_NOT_ALLOW_TO_MODIFY'), logMeta);
                    return false;
                }
            default:
                break;
        }
        return true;
    }

    /**
     * localConfigHandling
     * @param context
     * @private
     */
    _localConfigHandling(context) {
        const {
            sourceCodePath,
            projectConfig,
            createNew,
            configPath,
            buildPath,
            xcalscanConfFullPath,
            xcalScanFilePath,
        } = context;

        logger.debug(`Client action is "Preprocessing", setting up project...`, logMeta);
        logger.debug(`ConfigPath in arg -c: ${configPath}`, logMeta);
        logger.debug(`Config will use: ${xcalScanFilePath}`, logMeta);

        const xcalScanConfExists = fs.pathExistsSync(xcalScanFilePath);

        // config file not exists, create one then exit
        if (!xcalScanConfExists) {
            logger.debug(`-c assigned, but config file does not exist, creating a new one`, logMeta);
            // write template to file
            const updatedXcalScan = {
                ...Policy.projectConfTmpl.projectConfigTmpl,
                projectPath: path.resolve(sourceCodePath),
                buildPath: path.resolve(sourceCodePath),
                scanConfig: Policy.projectConfTmpl.scanConfCTmpl,
            }
            this._writeXcalScanConf(xcalScanFilePath, updatedXcalScan);
            system.exit(Policy.enums.EXIT_CODES.GENERAL_ERROR, ErrorCodes.lookup('E_CLIENT_NO_SCAN_CONF_FOUND', {path: xcalScanFilePath}));
        }

        let localProjectConfig = fs.readJsonSync(xcalScanFilePath);

        localProjectConfig.projectName = localProjectConfig.projectName.trim();

        // when create new, reset some configs
        if (createNew) {
            logger.debug(`[${logMeta.file}] --new assigned, reset project and going to create a new one`, logMeta);
            localProjectConfig.projectUUID = "";
            localProjectConfig.projectId = "";
            localProjectConfig.scanConfig.scanMode = Policy.configs.CLIENT.SCAN_MODE.SINGLE;
        }

        // override source code path in config if provided in args
        if (sourceCodePath) {
            logger.info(`[${logMeta.file}] source code path passed in, override "projectPath" path in ${xcalscanConfFullPath} to ${sourceCodePath}`, logMeta);
            localProjectConfig.projectPath = sourceCodePath;
        }

        // override build path in config if provided in args
        if (buildPath) {
            logger.info(`[${logMeta.file}] --build-path assigned, override "buildPath" in ${xcalscanConfFullPath} to ${buildPath}`, logMeta);
            localProjectConfig.buildPath = buildPath;
        }

        // override project name
        if (projectConfig && projectConfig.projectName) {
            logger.info(`[${logMeta.file}] --project-name assigned, value is [${projectConfig.projectName}], write to config`, logMeta);
            localProjectConfig.projectName = projectConfig.projectName;
        }
        // override project id
        if (projectConfig && projectConfig.projectId) {
            logger.info(`[${logMeta.file}] --project-id assigned, value is [${projectConfig.projectId}], write to config`, logMeta);
            localProjectConfig.projectId = projectConfig.projectId;
        }

        // when there is project id, validate it first, if not, will create a valid project id systematically
        if (localProjectConfig.projectId && !this._validateProjectId(localProjectConfig.projectId)) {
            system.exit(Policy.enums.EXIT_CODES.GENERAL_ERROR, ErrorCodes.lookup('E_CLIENT_PROJECT_ID_VALIDATION_FAILED', {projectId: localProjectConfig.projectId}));
        }

        // scan mode handling
        let scanModeLocal;
        if (projectConfig && projectConfig.scanMode) {
            logger.debug(`-m assigned with value ${projectConfig.scanMode}, write to config`, logMeta);
            scanModeLocal = `-${projectConfig.scanMode}`;
        } else {
            logger.debug(`[${logMeta.file}] no scanMode assigned in argument, current scanMode in config is [${localProjectConfig.scanConfig.scanMode}]`, logMeta);
            scanModeLocal = localProjectConfig.scanConfig.scanMode;
        }
        // update local scanMode if missing
        if (!scanModeLocal) {
            logger.debug(`[${logMeta.file}] no scanMode found, using default: ${Policy.configs.CLIENT.SCAN_MODE.SINGLE}`, logMeta);
            scanModeLocal = Policy.configs.CLIENT.SCAN_MODE.SINGLE;
        }
        // write scanMode back to config
        logger.debug(`[${logMeta.file}] Write scanMode back to config: ${scanModeLocal}`, logMeta);
        localProjectConfig.scanConfig.scanMode = scanModeLocal;

        if (!localProjectConfig.houseKeeping || !localProjectConfig.houseKeeping.maxTaskFolders) {
            logger.debug(`[${logMeta.file}] House keeping is not defined in config, creating houseKeeping.maxTaskFolders, default is [${Policy.configs.CLIENT.DEFAULT_MAX_TASK_FOLDERS}]`, logMeta);
            localProjectConfig.houseKeeping = {
                maxTaskFolders: Policy.configs.CLIENT.DEFAULT_MAX_TASK_FOLDERS
            };
        }

        if (!localProjectConfig.dsr) {
            localProjectConfig.dsr = Policy.projectConfTmpl.projectConfigTmpl[Policy.enums.CONFIGURATION.PROJECT.DSR];
        }

        // scm configs
        if (projectConfig && projectConfig.repoPath && Policy.configs.CLIENT.ENABLE_DSR) {
            logger.debug(`[${logMeta.file}] --repo-path assigned, value is [${projectConfig.repoPath}], write to config`, logMeta);
            localProjectConfig.dsr.repoPath = projectConfig.repoPath;
        }
        if (projectConfig && projectConfig.repoBranch) {
            logger.debug(`[${logMeta.file}] --repo-branch assigned, value is [${projectConfig.repoBranch}], write to config`, logMeta);
            localProjectConfig.dsr.repoBranch = projectConfig.repoBranch;
        }
        // experimental, we try to avoid user assign repoAction in command line directly
        if (projectConfig && projectConfig.repoAction && Object.values(Policy.enums.REPO_ACTION).includes(projectConfig.repoAction)) {
            logger.debug(`[${logMeta.file}] --repo-action assigned, value is [${projectConfig.repoAction}], write to config`, logMeta);
            localProjectConfig.repoAction = projectConfig.repoAction;
            this._cicd.repoAction = projectConfig.repoAction;
        }

        // validate project name and project id
        if (!tools.validateProjectName(localProjectConfig.projectName)) {
            system.exit(Policy.enums.EXIT_CODES.GENERAL_ERROR, ErrorCodes.lookup('E_CLIENT_PROJECT_NAME_VALIDATION_FAILED', {name: localProjectConfig.projectName}));
        }

        // check if repoAction in config is in enum
        if (localProjectConfig.repoAction && !Object.values(Policy.enums.REPO_ACTION).includes(localProjectConfig.repoAction)) {
            system.exit(Policy.enums.EXIT_CODES.GENERAL_ERROR, ErrorCodes.lookup('E_NOT_SUPPORTED_REPO_ACTION'));
        }

        if (!localProjectConfig.projectId) {
            localProjectConfig.projectId = tools.generateProjectId(localProjectConfig.projectName);
            logger.debug(`No projectId found in config, generate a new one, [${localProjectConfig.projectId}]`, logMeta);
        }

        // ensure build path
        if (!localProjectConfig.buildPath) {
            logger.debug(`No buildPath found in config, making it same as source code path, [${localProjectConfig.projectPath}]`, logMeta);
            localProjectConfig.buildPath = localProjectConfig.projectPath;
        }
        return localProjectConfig;
    }

    /**
     * Setup project
     * @param context
     * @return {Promise<void>}
     */
    async setup(context) {
        const {
            serverUrl,
            token,
            configPath,
            sourceCodePath,
        } = context;

        const xcalscanConfFullPath = path.resolve(sourceCodePath, Policy.configs.CLIENT.FILES_FOLDERS.SCAN_CONFIG_FILE);
        const xcalScanFilePath = configPath ? path.resolve(configPath) : xcalscanConfFullPath;

        let localProjectConfig = this._localConfigHandling({
            ...context,
            xcalscanConfFullPath,
            xcalScanFilePath,
        });

        let onlineProjectConf = {};
        // fetch prerequisites for cicd
        // get project entity
        const project = await projectService.fetchProjectByProjectId(serverUrl, token, localProjectConfig.projectId);
        // project UUID
        if (!project.id) {
            logger.warn(`[Project] No project found by projectId [${localProjectConfig.projectId}] in db, going to create new project`, logMeta);

            const onlineProject = await this._createNewProject(localProjectConfig, serverUrl, token);
            let overrideData = {
                projectId: onlineProject.projectId,
                projectUUID: onlineProject.id,
                configId: onlineProject.projectConfig.configId,
            };
            // when there is no local repo, override online to local or assign default TRIAL value
            if (!localProjectConfig.repoAction) {
                overrideData.repoAction = onlineProject.projectConfig.repoAction || Policy.enums.REPO_ACTION.TRIAL;
            }
            localProjectConfig = this._updateLocalProjectConf(localProjectConfig, overrideData);
        } else {
            logger.debug(`[Project] Found project entity in db, the id is [${project.id}], projectId is [${project.projectId}], project name is [${project.name}]`, logMeta);
            if (Policy.configs.CLIENT.ENABLE_DSR) {
                logger.info(`[CICD][${logMeta.file}] Project instance found, current CICD fsm state is: [${project.cicdFsmState}]`, logMeta);
                logger.info(`[CICD][${logMeta.file}] Project instance found, current baselineCommitId is: [${project.baselineCommitId}]`, logMeta);
                this._cicd.baselineCommitId = project.baselineCommitId;
                this._cicd.cicdFsmState = project.cicdFsmState;
            }
            localProjectConfig.projectUUID = project.id;

            logger.debug(`[${logMeta.file}] Fetching online project config, result: ${JSON.stringify(onlineProjectConf)}`, logMeta);
            onlineProjectConf = await projectService.fetchProjectConfByProjectId(serverUrl, token, {
                projectId: localProjectConfig.projectId,
                configId: localProjectConfig.configId,
                repoAction: localProjectConfig.repoAction,
            });
        }
        if (Policy.configs.CLIENT.ENABLE_DSR) {
            await this._cicdPreparation({
                repoPath: localProjectConfig.dsr.repoPath,
                repoBranch: localProjectConfig.dsr.repoBranch,
            });
        }

        if (onlineProjectConf.project && onlineProjectConf.project.id) {
            // write back for subphase usage
            localProjectConfig.projectUUID = onlineProjectConf.project.id; //it actually is uuid
            const scanModeOnlineAttribute = onlineProjectConf.attributes && onlineProjectConf.attributes.find(attribute => attribute.name === 'scanMode');
            const configIdAttribute = onlineProjectConf.attributes && onlineProjectConf.attributes.find(attribute => attribute.name === 'configId');
            const repoActionAttribute = onlineProjectConf.attributes && onlineProjectConf.attributes.find(attribute => attribute.name === 'repoAction');
            const scanModeOnline = scanModeOnlineAttribute && scanModeOnlineAttribute.value;
            logger.debug(`[${logMeta.file}] Online scanMode is: ${scanModeOnline}`, logMeta);

            const repoActionOnline = repoActionAttribute && repoActionAttribute.value;
            logger.debug(`[${logMeta.file}] Online repoAction is: ${repoActionOnline}`, logMeta);
            if (!localProjectConfig.repoAction && repoActionOnline) {
                logger.debug(`[${logMeta.file}] Set online repoAction id to local`, logMeta);
                localProjectConfig.repoAction = repoActionOnline;
            }

            const configIdOnline = configIdAttribute && configIdAttribute.value;
            localProjectConfig.configId = configIdOnline;
            logger.debug(`[${logMeta.file}] Online config id is: ${configIdOnline}`, logMeta);
            if (configIdOnline) {
                logger.debug(`[${logMeta.file}] Set online configId to local`, logMeta);
                localProjectConfig.configId = configIdOnline;
            }

            const needDsr = onlineProjectConf.needDsr;
            logger.debug(`[${logMeta.file}] Online needDsr value is: ${needDsr}`, logMeta);

            logger.debug(`[${logMeta.file}] Overwrite local dsr.needDsr config: ${needDsr}`, logMeta);
            localProjectConfig.dsr.needDsr = needDsr || false;

            // validate scan mode, which cannot be changed once set
            let scanModeValidateResult = {
                valid: true,
                errorMsg: 'scanMode has not been validated yet'
            };
            if (scanModeOnline) {
                scanModeValidateResult = tools.validateScanMode(localProjectConfig.scanConfig.scanMode, scanModeOnline);
            }
            if (!scanModeValidateResult.valid) {
                system.exit(Policy.enums.EXIT_CODES.GENERAL_ERROR, scanModeValidateResult);
            }

            const validateResult = this._validateConfigByCICDState(this._cicd.cicdFsmState, repoActionOnline, localProjectConfig.repoAction);
            if (!validateResult) {
                system.exit(Policy.enums.EXIT_CODES.GENERAL_ERROR, ErrorCodes.lookup('E_REPO_ACTION_VALIDATION_FAILED'));
            }

            // if whitelist changed, create new project - 2022/1/4 disabled, always use original project set in config or in arg
            // const whitelistChanged = this._validateWhitelist(localProjectConfig, onlineProjectConf);
            /*if (whitelistChanged) {
                logger.warn(`[${logMeta.file}] Whitelist changed, will create a new project`, logMeta);
                localProjectConfig.projectId = null;
                needCreateNewProject = true;
            }*/
        } else {
            const errorOrWarn = onlineProjectConf.error ? 'error' : 'warn';
            logger[errorOrWarn](`[${logMeta.file}] Retrieving project config by project id [${localProjectConfig.projectId}] failed. ${onlineProjectConf && JSON.stringify(onlineProjectConf.error || onlineProjectConf.warn) || ''}`, logMeta);
        }

        if (!localProjectConfig.hasOwnProperty('uploadSource')) {
            logger.debug(`[${logMeta.file}]uploadSource is not found in config, set default to true`, logMeta);
            localProjectConfig.uploadSource = true;
        }

        // make sure it always has value for repoAction
        if (!localProjectConfig.repoAction) {
            localProjectConfig.repoAction = Policy.enums.REPO_ACTION.TRIAL;
        }

        this._writeXcalScanConf(xcalScanFilePath, localProjectConfig);

        if (!localProjectConfig.projectUUID) {
            logger.debug(`[Fatal] - [Project] No project UUID found in config`, logMeta);
            system.exit(Policy.enums.EXIT_CODES.GENERAL_ERROR, ErrorCodes.lookup('E_GET_PROJECT_FROM_SERVER_FAILED'));
        }

        // update online project config
        if (onlineProjectConf.project && onlineProjectConf.project.id) {
            await this._updateOnlineProjectConf(localProjectConfig, serverUrl, token);
        }

        logger.info(`[${logMeta.file}] Finish setting up scan environment for project [${localProjectConfig.projectName}]`, logMeta);
    }

    /**
     * clean up task folder based on user settings how many tasks to keep
     * @private
     */
    cleanupTaskFolders() {
        logger.info(`[Housekeeping] Keep only ${this._conf.houseKeeping.maxTaskFolders} task folders`, logMeta);
        const paths = fs.readdirSync(this._stateFolderPath);
        if (!Array.isArray(this._taskRecords) || !this._taskRecords.length) {
            this._taskRecords = [];
        }
        const foldersToKeep = this._taskRecords.slice(-this._conf.houseKeeping.maxTaskFolders).map(record => record.id);
        const deleteList = paths
            .filter(taskId => fs.lstatSync(path.join(this._stateFolderPath, taskId)).isDirectory())
            .filter(taskId => !foldersToKeep.includes(taskId));
        deleteList.forEach(taskId => {
            logger.info(`[Cleanup] Deleting ${path.join(this._stateFolderPath, taskId)} `, logMeta);
            fs.rmdirSync(path.join(this._stateFolderPath, taskId), {
                recursive: true,
                force: true,
            });
        });
    }

    /**
     * Read the project scan config from file
     * @param confFilePath
     * @private
     */
    _readConfigFromFile(confFilePath) {
        this._confFilePath = confFilePath;
        if (!fs.pathExistsSync(confFilePath)) {
            system.exit(Policy.enums.EXIT_CODES.GENERAL_ERROR, ErrorCodes.lookup('E_CLIENT_WRONG_SCAN_CONFIG_PATH', {path: confFilePath}));
        }
        const projectConf = fs.readJsonSync(confFilePath);
        //todo refine validation for project config
        const validateArgResult = validator.validateProjectConfig(projectConf);
        if (!validateArgResult.valid) {
            logger.error('Invalid project configuration', logMeta);
            system.exit(Policy.enums.EXIT_CODES.GENERAL_ERROR, ErrorCodes.lookup('E_CLIENT_ARG_VALIDATE_FAILED', {error: validateArgResult.errors.map(error => error.stack).join('; ')}));
        }
        this._conf = projectConf;
        this._projectName = projectConf.projectName;
        this._id = projectConf.projectId;
        this._uuid = projectConf.projectUUID;
        this._cicd.repoAction = projectConf.repoAction;
    }

    /**
     * Update project scan config and write to file
     * @param projectConf
     * @private
     */
    _updateProjectConf(projectConf) {
        this._conf = projectConf;
        fs.writeFileSync(this._confFilePath, JSON.stringify(this._conf, null, 4), {encoding: 'utf8'});
    }

    /**
     * Ensure the folders which will be used in preprocess phase
     * custom task folder path, priority: command line - arg > project config - task folder setting > client settings - .xcalsetting (global)
     * @private
     */
    _ensureStateParentFolder(customTaskFolder) {
        try {
            logger.debug(`[${logMeta.file}][_ensureStateParentFolder] Args for --task-folder: ${customTaskFolder}`, logMeta);
            logger.debug(`[${logMeta.file}][_ensureStateParentFolder] project config taskFolder : ${this._conf.taskFolder}`, logMeta);
            logger.debug(`[${logMeta.file}][_ensureStateParentFolder] client setting taskFolder : ${this._conf.globalTaskFolder}`, logMeta);
            const folderForHoldingTaskFolder = customTaskFolder || this._conf.taskFolder || this._client.globalTaskFolder;

            this._customTaskFolderPath = folderForHoldingTaskFolder ? path.resolve(folderForHoldingTaskFolder, this._id) : this._sourceCodePath;

            const folderPathForState = path.resolve(this._customTaskFolderPath, this._stateFolderName);

            fs.ensureDirSync(folderPathForState);

            logger.info(`[${logMeta.file}] All scan preparation temp files will be stored in ${folderPathForState}`, logMeta);

            this._stateFolderPath = folderPathForState;
            //ensure tasks record file
            this._taskRecordsFilePath = path.resolve(`${folderPathForState}/${this._taskRecordsFileName}`);
            this._taskRecords = this._readStateRecordsList(this._taskRecordsFilePath);

            //ensure cancel record file
            this._cancelRecordsFilePath = path.resolve(`${folderPathForState}/${this._cancelRecordsFileName}`);
            this._cancelRecords = this._readStateRecordsList(this._cancelRecordsFilePath);
        } catch (e) {
            logger.error(e, logMeta);
        }
    }

    /**
     * Update scan task to project state array
     * @param task
     */
    updateScanTaskToProjectScanRecords(task) {
        const index = this._taskRecords.findIndex(record => record.id === task.id);

        if (!this._taskRecords.length || index < 0) {
            this._taskRecords.push(task);
            logger.info(`Local scan task [${JSON.stringify(task.id)}] created`, logMeta);
        } else {
            (index > -1) && (this._taskRecords[index] = {
                ...this._taskRecords[index],
                ...task
            });
        }
        // logger.info(`Update task list json in file ${this._taskRecordsFilePath}`, logMeta);
        //write to file
        fs.writeFileSync(this._taskRecordsFilePath, JSON.stringify(this._taskRecords || [], null, 4), {encoding: 'utf8'});
    }

    /**
     * Read task records from record file
     * @private
     */
    _readStateRecordsList(recordsFilePath) {
        let taskRecords = [];
        try {
            if (fs.pathExistsSync(recordsFilePath)) {
                taskRecords = fs.readJsonSync(recordsFilePath, {encoding: 'utf8'});
            }
            if (!Array.isArray(taskRecords)) {
                taskRecords = [];
            }
        } catch (e) {
            logger.error(e, logMeta);
        }
        fs.writeJsonSync(recordsFilePath, taskRecords);
        return taskRecords;
    }

    /**
     * Write cancel records into file
     * @param cancelRecord
     * @private
     */
    _writeCancelRecord(cancelRecord) {
        const defaultRecord = {
            time: Date.now(),
            scanTaskId: null,
            submitted: false,
            projectId: this._id,
            projectUUID: this._uuid,
            cancelResult: Policy.enums.STATUS.SUCCESS,
            reason: '',
            exitCode: 0
        }
        this._cancelRecords.push({
            ...defaultRecord,
            ...cancelRecord
        });
        fs.writeFileSync(this._cancelRecordsFilePath, JSON.stringify(this._cancelRecords, null, 4), {encoding: 'utf8'});
    }

    /**
     * Cancel scan using project uuid
     * @param apiServer
     * @param token
     * @return {Promise<void>}
     */
    async cancelScanByProjectId({apiServer, token}) {
        if (!this._taskRecords.length) {
            const msg = ErrorCodes.print('E_CLIENT_NO_SCAN_RECORD_FOUND', null, 'en');
            this._writeCancelRecord({
                cancelResult: Policy.enums.STATUS.FAILED,
                reason: msg,
                exitCode: 1
            });
            system.exit(Policy.enums.EXIT_CODES.GENERAL_ERROR, {
                ...ErrorCodes.lookup('E_CLIENT_NO_SCAN_RECORD_FOUND'),
                action: 'CANCEL'
            });
        }
        const lastScanRecord = this._taskRecords[this._taskRecords.length - 1];
        //scenario #1 online scan task id not created yet - exit code = 10, no sse listening
        //https://grpc.github.io/grpc/core/md_doc_statuscodes.html,
        //https://www.thegeekdiary.com/what-are-bash-exit-codes-in-linux/ exit = 1 reserved by linux
        if (!lastScanRecord.onlineScanId) {
            const msg = ErrorCodes.print('E_CLIENT_NO_SCAN_RECORD_FOUND');
            this._writeCancelRecord({
                cancelResult: Policy.enums.STATUS.FAILED,
                reason: msg,
                exitCode: Policy.enums.EXIT_CODES.CUSTOM.NO_SCAN_RECORD
            });
            system.exit(Policy.enums.EXIT_CODES.CUSTOM.NO_SCAN_RECORD, {
                ...ErrorCodes.lookup('E_CLIENT_NO_SCAN_RECORD_FOUND'),
                action: 'CANCEL'
            });
        }
        //scenario #2 online scan task id created, but not submitted yet- client change status in db as "terminated"
        const lastActivityLog = lastScanRecord.status.activityLog;
        const submitTaskLog = lastActivityLog.find(activity => activity.stepName === 'SUBMIT_SCAN_TASK');
        if (submitTaskLog && submitTaskLog.status === Policy.enums.STATUS.SUCCESS) {
            const result = await scanService.cancelScan(apiServer, token, lastScanRecord.onlineScanId); //todo server should verify scanTaskId sent
            logger.debug(`[Cancel] Submit cancel request finished, result: ${JSON.stringify(result)}`, logMeta);
            const msg = `[Cancel] Scan task Id [${lastScanRecord.onlineScanId}] found which has been submitted, Cancel API sent for cancelling on server side`;
            this._writeCancelRecord({
                scanTaskId: lastScanRecord.onlineScanId,
                submitted: true,
                cancelResult: Policy.enums.STATUS.SUCCESS,
                reason: msg,
                exitCode: 0
            });
            system.exit(Policy.enums.EXIT_CODES.OK, {
                msg,
                action: 'CANCEL',
                scanTaskId: lastScanRecord.onlineScanId
            });
        }
        //scenario #3 online scan task id created, submitted - call cancel API and return exit code = 0
        else {
            const msg = `[Cancel] Scan task Id [${lastScanRecord.onlineScanId}] found, but it has not been submitted yet`;
            this._writeCancelRecord({
                scanTaskId: lastScanRecord.onlineScanId,
                cancelResult: Policy.enums.STATUS.SUCCESS,
                // reason: msg,
                exitCode: 0
            });
            system.exit(Policy.enums.EXIT_CODES.OK, {
                msg,
                action: 'CANCEL'
            });
        }
    }

    /**
     * Create scan task entry
     * @return {Scan}
     */
    createScanTask(deltaResult, extraInfo) {
        logger.info('Creating scan instance...', logMeta);

        if (extraInfo.xvsaOptions) {
            if (this._conf.scanConfig.hasOwnProperty('xvsaOptions') && !this._conf.scanConfig.xvsaOptions.includes(extraInfo.xvsaOptions)) {
                this._conf.scanConfig.xvsaOptions = this._conf.scanConfig.xvsaOptions.concat(` ${extraInfo.xvsaOptions}`);
            }
            if (!this._conf.scanConfig.hasOwnProperty('xvsaOptions')) {
                this._conf.scanConfig.xvsaOptions = extraInfo.xvsaOptions;
            }
            this._updateProjectConf(this._conf);
        }
        const scanConfig = {
            ...this._conf.scanConfig,
            deltaResult
        };

        return new ScanTask(this, this._client, scanConfig, extraInfo);
    }

    /**
     * Load failed tasks from state file
     * @param project
     * @return {*}
     */
    loadFailedTasks(project) {
        return this.getFailedTaskRecords().map(task => {
            logger.info(`---Failure scan task found, ID [${task.id}]---`);
            const scanTask = new ScanTask();
            scanTask.load(task.id);
        });
    }

    /**
     * Getter for client instance
     * @return {null}
     */
    get client() {
        return this._client;
    }

    /**
     * Getter for custom rule folder path
     * @return {string}
     */
    get customRuleFolder() {
        return this._customRuleFolder;
    }

    /**
     * Getter for scan config path
     * @return {string}
     */
    get scanConfigPath() {
        return this._scanConfigPath;
    }

    /**
     * Getter for project config object
     * @return {{}}
     */
    get config() {
        return this._conf;
    }

    /**
     * Setter for project config object
     * @param newConfig
     */
    set config(newConfig) {
        this._conf = newConfig;
    }

    /**
     * Get project uuid
     * @return projectUUID
     */
    get uuid() {
        return this._uuid;
    }

    /**
     * Get id of project
     * @return projectId
     */
    get id() {
        return this._id;
    }

    /**
     * Get name of project
     * @return {string}
     */
    get name() {
        return this._projectName;
    }

    /**
     * Get source code path
     * @return {string}
     */
    get sourceCodePath() {
        return this._sourceCodePath;
    }

    /**
     * Get state folder for scan project
     * @return {string}
     */
    get stateFolderPath() {
        return this._stateFolderPath;
    }

    /**
     * Get cicd prerequisites
     * @return {{}}
     */
    get cicd() {
        return this._cicd;
    }

    /**
     * Get last task record of project
     * @return {object}
     */
    getLastTaskRecord() {
        return this._taskRecords && this._taskRecords[this._taskRecords.length - 1];
    }

    /**
     * Extract all failed tasks
     * @return {object}
     */
    getFailedTaskRecords() {
        if (this._taskRecords && this._taskRecords.length) {
            return this._taskRecords.filter(task => task.status === Policy.enums.STATUS.FAILED);
        }
        return {};
    }

    /**
     * Accept args --report -l to list finished scans and instruction send to user on how to generate particular scan logs
     */
    generateReport() {

    }

    /**
     * Set next state to cicd
     * @param cicdState
     */
    setCicdState(cicdState) {
        this._cicd.nextState = cicdState;
    }
}

module.exports = Project;

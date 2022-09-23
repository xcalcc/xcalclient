/**
 * Client model
 * 1. Consume arguments
 * 2. Ensure or prepare folders
 * 3. Global level config in ~ folder - TBD
 * 4. Export logs or other utilities for support troubleshooting
 */

const path = require('path');
const fs = require('fs-extra');
const logger = require('../utils/logger');
const tools = require('../utils/tools');
const system = require('../utils/system');

const logMeta = {
    file: 'model/Client',
};

class Client {
    //~/.xcalclient in Home folder is a centralized place for user config and system info
    _clientConfigPath = path.resolve(__dirname, '../', Policy.configs.CLIENT.FILES_FOLDERS.CLIENT_CONFIG_FILE);
    _executableFilePath = path.resolve(__dirname, '../', Policy.configs.CLIENT.FILES_FOLDERS.EXECUTABLE_FOLDER);
    _secretKeyPath = path.resolve(__dirname, '../', Policy.configs.CLIENT.FILES_FOLDERS.SECRET_KEY_FILE);
    _ivPath = path.resolve(__dirname, '../', Policy.configs.CLIENT.FILES_FOLDERS.SECRET_IV_FILE);
    _iv = null;
    _secretKey = null;

    _config = null;

    _serverHost = '';
    _ruleServiceUrl = '';
    _serverPort = '';
    _fileServiceUrl = '';
    _apiServerUrl = '';

    _user = null;
    _globalTaskFolder = null;

    _username = '';
    _userpsw = '';

    constructor(args) {
        this._init(args);
    }

    _init(args) {
        const clientConfig = this.loadClientConf();
        const {
            user,
            psw,
            apiServer,
            fileServiceUrl,
            ruleServiceUrl,
            freshInstall,
            taskFolder,
        } = clientConfig;

        this._serverHost = args.serverUrl;
        this._serverPort = args.serverPort;
        this._username = user;
        this._userpsw = psw;
        this._apiServerUrl = apiServer;
        this._fileServiceUrl = fileServiceUrl;
        this._ruleServiceUrl = ruleServiceUrl;
        this._globalTaskFolder = taskFolder;

        if (args.user) {
            this._username = args.user;
        }
        if (args.psw) {
            this._userpsw = args.psw;
        }
        if (args.token) {
            this._token = args.token;
        }
        if (args.fileServiceUrl && args.fileServicePort) {
            this._fileServiceUrl = `${args.fileServiceUrl}:${args.fileServicePort}`;
        }

        if (this._serverHost && this._serverPort) {
            this._apiServerUrl = this._ruleServiceUrl = `${this._serverHost}:${this._serverPort}`;
        }

        if ((this._apiServerUrl && this._apiServerUrl !== apiServer) ||
            (this._fileServiceUrl && this._fileServiceUrl !== fileServiceUrl) ||
            (args.user && args.user !== user) ||
            (args.psw && args.psw !== psw) ||
            freshInstall
        ) {
            this._writeToConfig(clientConfig);
        }

        this._config = {
            user: this._username,
            psw: this._userpsw,
            token: this._token,
            fileServiceUrl: this._fileServiceUrl,
            apiServerUrl: this._apiServerUrl,
            ruleServiceUrl: this._ruleServiceUrl,
            executableFilePath: this._executableFilePath,
        };

        if (process.env.UPDATE_STATUS_TO_3RD_PARTY && clientConfig._3rdPartyUpdateUrl) {
            this._config._3rdPartyUpdateUrl = clientConfig._3rdPartyUpdateUrl;
        }
        this._debugMode = args.debug === true || false;

        global.debugMode = !!this._debugMode;

        if (!this._token && (!this._username || !this._userpsw)) {
            system.exit(Policy.enums.EXIT_CODES.GENERAL_ERROR, ErrorCodes.lookup('E_AUTH_NO_USERNAME_PSW'));
        }
        if (!this._apiServerUrl || !this._fileServiceUrl) {
            system.exit(Policy.enums.EXIT_CODES.GENERAL_ERROR, ErrorCodes.lookup('E_CLIENT_CONFIG_MALFORMED'));
        }

    }

    /**
     * Load client config at first place
     * @return {{psw: (string|string|*), user: (string|*)}}
     */
    loadClientConf() {
        this._readSecretKeyAndIv();
        this._ensureClientConf();

        return this._loadClientConf();
    }

    /**
     * read secret key and initial vector for encrypt/decrypt
     * @private
     */
    _readSecretKeyAndIv() {
        logger.info(`Loading encrypted key from [${this._secretKeyPath}]`, {
            ...logMeta,
            method: '_readSecretKeyAndIv()'
        });
        logger.info(`Loading initial vector from [${this._ivPath}]`, {
            ...logMeta,
            method: '_readSecretKeyAndIv()'
        });
        //key/iv come into pair
        if (!fs.pathExistsSync(this._secretKeyPath) || !fs.pathExistsSync(this._ivPath)) {
            this._secretKey = tools.generateSecretKey();
            this._iv = tools.generateInitVector();
            fs.writeFileSync(this._secretKeyPath, this._secretKey);
            fs.writeFileSync(this._ivPath, this._iv);
        } else {
            this._secretKey = fs.readFileSync(this._secretKeyPath);
            this._iv = fs.readFileSync(this._ivPath);
        }
    }

    /**
     * Load client conf from file
     * @return {{psw: (string|string|*), user: (string|*)}}
     * @private
     */
    _loadClientConf() {
        let config = {};
        try {
            config = fs.readJsonSync(this._clientConfigPath, {encoding: 'utf8'});
        } catch (e) {
            logger.error(e, logMeta);
            system.exit(Policy.enums.EXIT_CODES.GENERAL_ERROR, ErrorCodes.lookup('E_CLIENT_CONFIG_MALFORMED'));
        }

        logger.info(`Loading client config from [${this._clientConfigPath}]`, {
            ...logMeta,
            method: '_loadClientConf()'
        });
        const encryptedConfig = {
            ...config,
            user: !config.freshInstall && tools.decrypt(config.user, this._secretKey, this._iv) || config.user,
            psw: !config.freshInstall && tools.decrypt(config.psw, this._secretKey, this._iv) || config.psw,
        };
        return encryptedConfig;
    }

    /**
     * Write/update client conf info
     * @param config
     * @private
     */
    _writeToConfig(config = {}) {
        logger.info(`Writing args to client config`, {
            ...logMeta,
            method: '_writeToConfig()'
        });
        const objectToWrite = {
            user: '',
            psw: '',
            apiServer: '',
            fileServiceUrl: '',
            ruleServiceUrl: '',
        };

        this._username && (objectToWrite.user = tools.encrypt(this._username, this._secretKey, this._iv));
        this._userpsw && (objectToWrite.psw = tools.encrypt(this._userpsw, this._secretKey, this._iv));
        this._apiServerUrl && (objectToWrite.apiServer = this._apiServerUrl);
        this._fileServiceUrl && (objectToWrite.fileServiceUrl = this._fileServiceUrl);
        this._ruleServiceUrl && (objectToWrite.ruleServiceUrl = this._ruleServiceUrl);
        const mergedConfig = {
            ...config,
            ...objectToWrite,
        };
        if (mergedConfig.freshInstall) {
            delete mergedConfig.freshInstall;
        }
        fs.writeFileSync(this._clientConfigPath, JSON.stringify(mergedConfig, null, 4), {encoding: 'utf8'});
    }

    /**
     * Make sure client conf is in place
     * @private
     */
    _ensureClientConf() {
        if (!fs.pathExistsSync(this._clientConfigPath)) {
            this._writeToConfig();
        }
    };

    /**
     * Write flow log to file for supports
     * @todo implementation
     */
    exportFlowLogs() {

    }

    /**
     * Getter for executable file path
     * @return {string}
     */
    get executableFilePath() {
        return this._executableFilePath;
    }


    /**
     * Task folder path for all projects
     * @return {any}
     */
    get globalTaskFolder() {
        return this._globalTaskFolder;
    }

    /**
     * Getter for config
     * @return {null}
     */
    get config() {
        return this._config;
    }

    /**
     * Setter for user instance
     * @param userInstance
     */
    set user(userInstance) {
        this._user = userInstance;
    }

    /**
     * Getter for user instance
     * @return user object
     */
    get user() {
        return this._user;
    }

}

module.exports = Client;

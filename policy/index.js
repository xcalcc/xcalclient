const path = require('path');
const fs = require('fs-extra');
const ConfigParser = require('configparser');
const Message = require('../model/Message');
const errorMsgPath = '../xcal_common/errorMessage.json';
const scanConfCTmpl = require('./xcalscanTmpls/scanConfCDefault');
const scanConfJavaTmpl = require('./xcalscanTmpls/scanConfJavaDefault');
const projectConfigTmpl = require('./xcalscanTmpls/xcalscanTempl');

class Policy {
    _ver = 'v0.1';
    _outputPath = path.resolve(__dirname, `../xcal_common/policy/policy.json`);
    _outputPathForPM = path.resolve(__dirname, `../xcal_common/policy/policy_pm.json`);
    _userConfPath = path.resolve(__dirname, '../user.cfg');
    _nameSpace = 'CLIENT';
    _arguments = {};
    _configs = {};
    _projectConfTmpl = {};
    _enums = {};
    _codingConvention = {};
    _useModel = {};
    _errorCodes = {};

    _configParser = new ConfigParser();

    constructor() {
        this._buildArgs();
        this._buildConfigs();
        this._buildEnums();
        this._buildCodingConventions();
        this._buildUseModels();
        this._buildProjectConfTmpl();
        // this._readUserConf(); //suspended until strong requirements from user for editing json

        //load errorCode instance
        const errorCodes = fs.readJsonSync(path.resolve(__dirname, errorMsgPath), {encoding: 'utf8'});
        this._errorCodes = new Message(errorCodes.errors);
    }

    /**
     * Read policy json directly
     * @param policyFilePath
     * @private
     */
    _load(policyFilePath) {
        const policyJson = fs.readJsonSync(policyFilePath, {encoding: 'utf8'});
        this._ver = policyJson.ver;
    }

    /**
     * Read user config
     * @private
     */
    _readUserConf() {
        try {
            if (fs.pathExistsSync(this._userConfPath)) {
                this._configParser.read(this._userConfPath);
                this._configParser.sections();
                //todo define what value should be read
                const buildTimeout = this._configParser.get('Timeout', 'build_timeout');
                //todo save user config in policy and merge client system configs
                console.log('buildTimeout:', buildTimeout);
            }
        } catch (e) {
            console.error(`[Policy] Read user config failed, ${JSON.stringify(e)}`);
        }
    }

    /**
     * Write data to user configs, which could be data in .xcalsetting
     * @param data {
     *     Section1: {
     *         key1: value1
     *     },
     *     Section2: {
     *         key2: value2
     *     }
     * }
     */
    writeUserConf(data) {
        try {
            this._configParser.sections();

            Object.keys(data).forEach(section => {
                if (!this._configParser.hasSection(section)) {
                    this._configParser.addSection(section);
                }
                Object.keys(data[section]).forEach(item => {
                    this._configParser.set(section, item, data[section][item]);
                });
            });
            this._configParser.write(this._userConfPath);
        } catch (e) {
            console.error(e)
        }
    }

    /**
     * Load policy and load argument policy into memory
     * @private
     */
    _buildArgs() {
        const ARGUMENTS = require("./data/arguments");
        this._arguments = ARGUMENTS;
    }

    /**
     * Build project scan file tmpl
     * @private
     */
    _buildProjectConfTmpl() {
        this._projectConfTmpl = {
            scanConfCTmpl,
            scanConfJavaTmpl,
            projectConfigTmpl,
        };
    }

    /**
     * Load policy and load config policy into memory
     * @private
     */
    _buildConfigs() {
        const CONFIGS = require('./data/configs');
        this._configs = CONFIGS;
        this._environmentVariableOverridden();
    }

    _environmentVariableOverridden() {
        [
            'ENABLE_CUSTOM_RULE_UPLOAD',
            'ENABLE_CICD_CONTROL',
            'ENABLE_DSR',
            'PRINT_VERSION_AT_START',
        ].forEach(envar => {
            if (process.env.hasOwnProperty(envar)) {
                if (
                    process.env[envar] === 'false' ||
                    process.env[envar] === 'true'
                ) {
                    this._configs.CLIENT[envar] = eval(process.env[envar]);
                } else {
                    this._configs.CLIENT[envar] = process.env[envar];
                }
            }
        });
    }

    /**
     * Load policy and load enum policy into memory
     * @private
     */
    _buildEnums() {
        const ENUMS = require('./data/enums');
        this._enums = ENUMS;
    }

    /**
     * Load policy and load data policy into memory
     * @private
     */
    _buildCodingConventions() {
        const CODING_CONVENTIONS = require('./data/codingConventions');
        this._codingConvention = CODING_CONVENTIONS;
    }

    /**
     * Load policy and load use model policy into memory
     * @private
     */
    _buildUseModels() {
        const USE_MODEL = require("./data/useModel");
        this._useModel = USE_MODEL;
    }

    /**
     * output for PM sharing
     * @private
     */
    _pmEditablePolicies() {
        try {
            const argsForPM = {...this._arguments};
            Object.keys(argsForPM).forEach(group => {
                Object.keys(argsForPM[group]).forEach(arg => {
                    if (!argsForPM[group][arg].owner || argsForPM[group][arg].owner.toLowerCase() !== 'pm') {
                        delete argsForPM[group][arg];
                    }
                });
            });

            const policyForPM = {
                ver: this._ver,
                policy: {
                    arguments: argsForPM,
                    configs: {},
                    enums: {}
                }
            };

            return policyForPM;
        } catch (e) {
            throw e;
        }
    }

    /**
     * Export the json for sharing
     */
    exportPolicy() {
        try {
            console.log(`Exporting arguments/configs/enums/errorCodes into ${this._outputPath}`);
            fs.ensureFileSync(this._outputPath);

            fs.writeFileSync(this._outputPath, JSON.stringify({
                ver: this._ver,
                policy: {
                    arguments: this._arguments,
                    configs: this._configs,
                    enums: this._enums,
                },
            }, null, 4), {encoding: 'utf8'});

            const pmPolicies = this._pmEditablePolicies();
            console.log(`Exporting arguments/configs/enums/errorCodes for PM into ${this._outputPathForPM}`);

            fs.writeFileSync(this._outputPathForPM, JSON.stringify(pmPolicies, null, 4), {encoding: 'utf8'});
        } catch (e) {
            console.error(e);
            console.error(`[Policy] Output policy failed, ${JSON.stringify(e)}`);
        }
    }

    /**
     * Internal client configs
     * @return {{}}
     */
    get configs() {
        return this._configs;
    }

    /**
     * Internal enums across components
     * @return {{}}
     */
    get enums() {
        return this._enums;
    }

    /**
     * Internal error code mappings
     * @return {{}}
     */
    get errorCodes() {
        return this._errorCodes;
    }

    /**
     * Project config template
     * @return {{}}
     */
    get projectConfTmpl() {
        return this._projectConfTmpl;
    }

    /**
     * Internal coding conventions
     * @return {{}}
     */
    get codingConventions() {
        return this._codingConvention;
    }

    /**
     * Arguments for clients and submodules
     * @return {{}}
     */
    get arguments() {
        return this._arguments;
    }
}

module.exports = new Policy();

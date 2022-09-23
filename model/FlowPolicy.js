const fs = require('fs-extra');
const path = require('path');
const flowPolicyDefault = require('../flowPolicy');
const logger = require('../utils/logger');
const logMeta = {
    file: 'model/FlowPolicy',
}

class FlowPolicy {
    _policy = flowPolicyDefault;

    constructor() {
        this._loadExternalPolicy();
    }

    /**
     * Merge default policy with external user defined policy
     * @private
     */
    _loadExternalPolicy() {
        const customPolicyPath = path.resolve(__dirname, '../flowPolicy.json');
        if(fs.pathExistsSync(customPolicyPath)) {
            const customPolicyData = fs.readJsonSync(customPolicyPath, {encoding: 'utf8'});
            logger.info('Custom flowPolicy found, merge with default...', logMeta);
            this._policy = {
                ...this._policy,
                ...customPolicyData
            };
        }
    }

    /**
     * output json of policy
     * @return policy object
     */
    get json() {
        return this._policy;
    }
}

module.exports = FlowPolicy;

const axios = require('axios');
const logger = require('../utils/logger');

const logMeta = {
    file: 'service/ruleService'
}

module.exports = {
    /**
     * Post custom rule info
     * @param apiServer
     * @param data
     * @param projectId
     * @return {Promise<{error: (any|T)}|null|any>}
     */
    async postRuleInfoToRuleService(apiServer, data, projectId) {
        const endpoint = `${apiServer}/rule/custom/${projectId}`;
        logger.info(`Calling API to post rule info ${endpoint}`, logMeta);
        try {
            const result = await axios.post(endpoint, data);
            if(result.data && result.data.status === 'success') {
                logger.info(`POST rule info success ${JSON.stringify(result.data)}`, logMeta);
                return result.data;
            } else {
                logger.error(`POST rule info failed ${JSON.stringify(result.data)}`, logMeta);
                return null;
            }
        } catch (e) {
            const errorMsg = e.response && e.response.data || e.stack;
            return {
                error: errorMsg
            }
        }
    },

};

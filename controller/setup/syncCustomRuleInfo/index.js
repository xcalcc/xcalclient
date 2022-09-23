const fs = require('fs-extra');
const path = require('path');
const logger = require('../../../utils/logger');
const ruleService = require('../../../service/ruleService');

const SubPhase = require('../../../model/SubPhase');

const logMeta = {
    file: 'controller/setup/syncCustomRuleInfo',
};

const customRuleSync = (policy, context) => {
    const client = context.projectInstance.client;
    const projectId = context.projectInstance.id;
    const ruleInfoFilePath = path.resolve(context.sourceCodePath, Policy.configs.CLIENT.FILES_FOLDERS.CUSTOM_RULE_FOLDER, Policy.configs.CLIENT.FILES_FOLDERS.CUSTOM_RULE_FILE);

    return new SubPhase({
        isMandatory: false,
        name: 'SYNC_CUSTOM_RULE_INFO',
        type: Policy.enums.SUB_PHASE_TYPES.HTTP,
        policy,
        run: async () => {
            if (!projectId) {
                logger.error('Project Id is needed for custom rule info uploading', logMeta);

                return Promise.reject({
                    status: 1,
                    logs: {
                        error: 'Project Id is needed for custom rule info uploading'
                    }
                });
            }
            const ruleInfo = await fs.readJson(ruleInfoFilePath, {encoding: 'utf8'});
            if (!ruleInfo) {
                logger.error('No rule contents can be found, existing', logMeta);
            }
            const result = await ruleService.postRuleInfoToRuleService(client.config.ruleServiceUrl, ruleInfo, projectId);
            if (!result) {
                logger.error('Failed to post rule info to rule service', logMeta);

                return Promise.reject({
                    status: 1,
                    logs: {
                        error: 'Failed to post rule info to rule service'
                    }
                });
            } else {
                logger.info('Success to post rule info to rule service', logMeta);

                return Promise.resolve({
                    status: 0,
                });
            }
        },
        context
    });
}

module.exports = customRuleSync;

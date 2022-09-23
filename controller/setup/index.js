const syncCustomRuleInfo = require('./syncCustomRuleInfo');
const syncCustomRuleMi = require('./syncCustomRuleMI');
const scm = require('./scm');
const logger = require('../../utils/logger');

const Phase = require('../../model/Phase');

const logMeta = {
    file: 'controller/setup/index'
};

const setupPhase = (policy, context) => {
    logger.debug(`[Setup Phase] Creating setup phase`, logMeta);
    const phase = new Phase({
        name: 'SETUP',
    });
    try {
        logger.debug(`[Setup Phase] Passing policy [${JSON.stringify(policy)}]`, logMeta);
        phase.setPolicy(policy);

        if (Policy.configs.CLIENT.ENABLE_DSR) {
            logger.debug(`[Setup Phase] Adding subphase SCM diff`, logMeta);
            phase.addSubPhase(scm(policy.SUB_PHASE.SCM_CODE_DIFF, context));
        }

        if (Policy.configs.CLIENT.ENABLE_CUSTOM_RULE_UPLOAD && context.scanInstance.hasCustomRule) {
            logger.debug(`[Setup Phase] Adding subphases for custom rules rules`, logMeta);
            phase.addSubPhase(syncCustomRuleInfo(policy.SUB_PHASE.SYNC_CUSTOM_RULE_INFO, context))
                .addSubPhase(syncCustomRuleMi(policy.SUB_PHASE.SYNC_CUSTOM_RULE_MI, context));
        }
    } catch (e) {
        logger.error(`[Setup Phase] error: ${JSON.stringify(e)}`, logMeta);
        return Promise.reject(e);
    }

    return Promise.resolve(phase);
}

module.exports = setupPhase;

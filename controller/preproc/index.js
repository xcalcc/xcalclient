const prebuild = require('./prebuild');
const submitScan = require('./submitScan');
const packaging = require('./packaging');
const createScanTask = require('./createScanTask');
const upload = require('./upload');
const cleanup = require('./cleanup');
const logger = require('../../utils/logger');

const logMeta = {
    file: 'controller/preproc'
}

const Phase = require('../../model/Phase');

const preprocPhase = async (policy, context) => {
    const phase = new Phase({
        name: 'PREPROC',
    });
    try {
        phase.setPolicy(policy)
            .addSubPhase(await prebuild(policy.SUB_PHASE.PREBUILD, context))
            .addSubPhase(await packaging(policy.SUB_PHASE.PACKAGING, context))
            .addSubPhase(await upload(policy.SUB_PHASE.UPLOAD, context))
            .addSubPhase(await createScanTask(policy.SUB_PHASE.CREATE_SCAN_TASK, context))
            .addSubPhase(await submitScan(policy.SUB_PHASE.SUBMIT_SCAN_TASK, context))
            .addSubPhase(await cleanup(policy.SUB_PHASE.CLEAN_UP, context));
    } catch (e) {
        logger.debug(`[Phase] Creating phase error, ${JSON.stringify(e)}`, logMeta);
        return Promise.reject(e);
    }

    return Promise.resolve(phase);
}

module.exports = preprocPhase;

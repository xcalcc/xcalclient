/**
 * Phase class
 */
const logger = require('../utils/logger');
const State = require('./State');
const system = require("../utils/system");
const logMeta = {
    file: 'model/Phase'
};

class Phase {
    _phasePolicy = null;
    _currentState = '';
    _stateStack = [];
    _subPhases = [];
    _name = '';
    _timeoutObj = null;

    constructor(opts) {
        this._name = opts.name;
        logger.debug(`Phase [${this._name}] created...`, logMeta);
    }

    /**
     * Set policy to phase
     * @param policy
     * @return {Phase}
     */
    setPolicy(policy) {
        this._phasePolicy = policy;
        logger.info(`Policy set for ${this._name}`, logMeta);
        return this;
    }

    /**
     * Getter for phase policy
     * @return {null}
     */
    get policy() {
        return this._phasePolicy;
    }

    /**
     * Add subphase to phase
     * @param subPhase
     * @return {Phase}
     */
    addSubPhase(subPhase) {
        this._subPhases.push(subPhase);
        return this;
    }

    /**
     * Resume latest failed task
     * @todo implementation
     */
    resumeLatest() {

    }

    /**
     * Resume task from a particular state
     * @todo implementation
     */
    resumeFromState() {

    }

    /**
     * Getter state for current phase
     * @return {string}
     */
    get state() {
        return this._currentState;
    }

    /**
     * Getter name for current phase
     * @return {string}
     */
    get name() {
        return this._name;
    }

    /**
     * Setter for phase state
     * @param state
     */
    set state(state) {
        this._currentState = state;
        this._stateStack.push(state);
    }

    /**
     * Set timeout for the limited time for phase policy
     * @private
     */
    _setTimeout() {
        this._timeoutObj = setTimeout(() => {
            logger.error(`Phase [${this._name}] timeout met, the timeout is ${this._phasePolicy.TIMEOUT} ms`, logMeta);
            system.exit(Policy.enums.EXIT_CODES.GENERAL_ERROR, ErrorCodes.lookup('E_CLIENT_TIMEOUT_MET', {timeout: this._phasePolicy.TIMEOUT}));
        }, this._phasePolicy.TIMEOUT);
    }

    /**
     * Clear the timeout for the phase instance
     * @private
     */
    _clearTimeout() {
        clearTimeout(this._timeoutObj);
    }

    /**
     * Running entry point for phase instance
     * @param scanInstance
     * @return {Promise<boolean>}
     */
    async run(scanInstance) {
        let result, state;
        this._setTimeout();
        for await (let subPhase of this._subPhases) {
            logger.info(`Start subPhase [${subPhase.name}] execution...`, logMeta);
            state = new State({
                stepName: subPhase.name,
                type: subPhase.type,
                resourceMonitor: subPhase.resourceMonitor,
                // nextStep: subPhase.nextStep, //no need to put nextStep in state log to avoid confusion
            });
            try {
                result = await subPhase.execute();
                logger.debug(`[Phase][${this._name}][${subPhase.name}] Execution result: ${JSON.stringify(result)}`);
                subPhase.clearTimeout();
                this.state = {[subPhase.name]: result};

                if (result.status === 0) {
                    logger.info(`SubPhase [${subPhase.name}] success`, logMeta);
                    state.updateStatus(Policy.enums.STATUS.SUCCESS);
                } else {
                    state.updateStatus(Policy.enums.STATUS.FAILED);
                    logger.error(`SubPhase [${subPhase.name}] with mandatory policy [${subPhase.isMandatory}] failed`, logMeta);

                    return Promise.reject(result);
                }
            } catch (e) {
                const error = e.logs.error || (Array.isArray(e.logs.stderr) ? e.logs.stderr[e.logs.stderr.length - 1] : e.logs.stderr);
                state.updateStatus(Policy.enums.STATUS.FAILED, error);
                logger.error(`SubPhase [${subPhase.name}] failed, error: ${error.code || JSON.stringify(error)}`, logMeta);

                return Promise.reject(e);
            } finally {
                this._clearTimeout();
                subPhase.state && Object.keys(subPhase.state).forEach(key => {
                    state.setOtherInfo(key, subPhase.state[key]);
                });
                scanInstance.pushState(state.json);
            }
        }
        return Promise.resolve(true);
    }

    _finish() {

    }
}

module.exports = Phase;

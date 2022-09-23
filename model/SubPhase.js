const logger = require('../utils/logger');
const system = require("../utils/system");
const logMeta = {
    file: 'class/SubPhase',
}

class SubPhase {
    _policy = null;
    _type = '';
    _state = null;
    _name = '';
    _previousStep = null;
    _nextStep = null;
    _configs = null;
    _timeoutObj = null;
    _executeCommand = null;
    _flowLogs = [];
    _summary = {};
    _resourceMonitor = '';
    _fini = () => {
    };

    constructor(opts) {
        this._name = opts.name;
        this._type = opts.type;
        this.setPolicy(opts.policy);
        this._previousStep = opts.previousStep;
        this._nextStep = this._policy.NEXT;
        this._configs = opts.configs;
        this._context = opts.context;
        if (opts.executeCommand) {
            this._executeCommand = opts.executeCommand;
        }
        if (opts.run) {
            this.run = opts.run;
        }
        if (typeof opts.finish === 'function') {
            this._fini = opts.finish;
        }
        logger.debug(`[model/Subphase] SubPhase [${this._name}] created`, logMeta);
    }

    /**
     * Set modified policy to subphase
     * @param policy
     */
    setPolicy(policy) {
        logger.debug(`[model/Subphase] Setting new policy for subPhase [${this._name}], policy ${JSON.stringify(policy)}`, logMeta);
        if (policy.TIMEOUT > Policy.enums.JS_MAX_TIMING_POLICY) {
            logger.fatal(`[model/subphase][${this._name}] Max allow timeout is signed 32 bit integer, input timeout is ${policy.TIMEOUT} ms set to ${Policy.enums.JS_MAX_TIMING_POLICY} ms`, logMeta);
            policy.TIMEOUT = Policy.enums.JS_MAX_TIMING_POLICY;
        }
        this._policy = policy;
    }

    /**
     * Extract flow log from the executable output
     * @param logs
     * @private
     */
    _extractFlowLogs(logs) {
        logger.debug(`[model/Subphase] Extracting flow logs`, logMeta);
        if (logs && logs.stdout) {
            this._flowLogs = logs.stdout
                .filter(log => log.indexOf('[FLOW]') !== -1)
                .map(log => log.replace('[FLOW]', ''));
        }
    }

    /**
     * Set timeout for the limited time for subphase policy
     * @private
     */
    setTimeout() {
        logger.debug(`[model/Subphase] Timeout starts for subPhase [${this._name}], allow time to finish: ${this._policy.TIMEOUT} ms`, logMeta);
        return setTimeout(() => {
            logger.error(`Subphase [${this._name}] timeout met, the timeout is ${this._policy.TIMEOUT} ms`, logMeta);
            system.exit(Policy.enums.EXIT_CODES.GENERAL_ERROR, ErrorCodes.lookup('E_CLIENT_TIMEOUT_MET', {timeout: this._policy.TIMEOUT}));
        }, this._policy.TIMEOUT);
    }

    /**
     * Clear the timeout for the limited time for subphase policy
     * @private
     */
    clearTimeout() {
        logger.debug(`[model/Subphase] Clear time out for subPhase [${this._name}]`, logMeta);
        clearTimeout(this._timeoutObj);
    }

    /**
     * Getter for flow logs
     * @return {array}
     */
    get flowLogs() {
        return this._flowLogs;
    }

    /**
     * Getter for type
     * @return {string}
     */
    get type() {
        return this._type;
    }

    /**
     * Getter for next step based on policy set
     * @return {String}
     */
    get nextStep() {
        return this._nextStep;
    }

    /**
     * Getter for previous step based on policy set
     * @return {String}
     */
    get previousStep() {
        return this._previousStep;
    }

    /**
     * Getter for configs of subphase
     * @return {null}
     */
    get configs() {
        return this._configs;
    }

    /**
     * Getter for subphase name
     * @return {string}
     */
    get name() {
        return this._name;
    }

    /**
     * Setter for executable command if set
     * @param command
     */
    set executeCommand(command) {
        this._executeCommand = command;
    }

    /**
     * Getter for executable command if set
     * @return {null}
     */
    get executeCommand() {
        return this._executeCommand;
    }

    /**
     * Getter for resource monitor
     * @return {string}
     */
    get resourceMonitor() {
        return this._resourceMonitor;
    }

    /**
     * Defined during the subphase created
     * @return {Promise<void>}
     */
    async run() {
        logger.error(`[model/Subphase] Execute subPhase ${this._name} but no execution method defined...`, logMeta);
    }

    /**
     * A wrapper for subphase run and result handling
     * @return {Promise<{status: number}>}
     */
    async execute() {
        logger.debug(`[model/Subphase][${this._name}] Subphase starts execution`, logMeta);
        this._timeoutObj = this.setTimeout();
        try {
            const resourceMonitor = await system.osResource();
            this._resourceMonitor = `CPU Usage: ${resourceMonitor.cpuUsage}, CPU Free: ${resourceMonitor.cpuFree}, DISK Total GB: ${resourceMonitor.drive.totalGb}, DISK Free GB: ${resourceMonitor.drive.freeGb}, Memory total: ${resourceMonitor.mem.totalMemMb}, Memory free: ${resourceMonitor.mem.freeMemMb}`;
            logger.debug(`[${this._name}] subPhase starts, resource: ${JSON.stringify(resourceMonitor)}`, logMeta);
            const result = await this.run();
            result.logs && this._extractFlowLogs(result.logs);

            if (!this._policy.MANDATORY || (result && result.status === 0)) {
                return Promise.resolve({
                    status: 0,
                });
            }

            return Promise.reject(result);
        } catch (e) {
            logger.debug(`[model/Subphase] Exception: ${typeof e === 'string' ? e : JSON.stringify(e)}`);
            if (e.logs) {
                this._extractFlowLogs(e.logs);
            }
            if (!this._policy.MANDATORY) {
                logger.debug(`[model/Subphase] Exception, but resolve as success in non-mandatory condition`);
                return Promise.resolve({
                    status: 0,
                });
            }
            logger.debug(`[model/Subphase] Exception, reject call to Phase`);
            return Promise.reject(e);
        } finally {
            this._finish();
        }
    }

    /**
     * Getter for subphase summary
     * @return {{}}
     */
    get summary() {
        return this._summary;
    }

    /**
     * Setter for subphase summary
     * @param summary
     */
    set summary(summary) {
        this._summary = summary;
    }

    /**
     * Finish call after execution
     * @private
     */
    _finish() {
        logger.debug(`Finishing subphase [${this._name}]`, logMeta);
        this._fini && this._fini();

        if (this._executeCommand) {
            this._state = {
                ...this._state,
                executeCommand: this._executeCommand
            };
        }
        if (this._flowLogs && this._flowLogs.length) {
            this._state = {
                ...this._state,
                flowLogs: this._flowLogs
            };
        }
        if (this._summary) {
            this._state = {
                ...this._state,
                summary: this._summary
            };
        }
    }

    /**
     * Resume from subphase
     * @todo implementation
     */
    resume() {

    }

    /**
     * Getter for state
     * @return {null}
     */
    get state() {
        return this._state;
    }

    /**
     * Setter for state
     * @param state
     */
    set state(state) {
        this._state = state;
    }

    /**
     * Getter for if this subphase is mandatory
     * @return {boolean}
     */
    get isMandatory() {
        return this._policy.MANDATORY;
    }
}

module.exports = SubPhase;

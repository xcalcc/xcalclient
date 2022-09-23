/**
 * The CICD FSM logic will be persisted in every client instance, but the state will be stored centralized in db
 * Each time when client is running, it will resume the last FSM state and keep the FSM infinite in logical (physically the FSM running is end when client process ends)
 */
const logger = require('../../utils/logger');

const logMeta = {
    file: 'controller/fsm/fsmController'
};

class FsmTransition {
    // member variables
    _nextState = null;
    _input = {};
    _validate = () => true;

    constructor({
                    nextState,
                    validate,
                    input,
                }) {
        this._nextState = nextState;
        this._validate = validate;
        this._input = input;
    }

    validate() {
        return this._validate();
    }

    get input() {
        return this._input;
    }

    get nextState() {
        return this._nextState;
    }
}

class FsmState {
    // member variables
    _name = null;
    _projectId = null;

    // member functions
    _handleError = null;
    _transit = () => {
    };

    constructor({
                    name,
                    handleError,
                    transit,
                }) {
        this._name = name;
        this._handleError = handleError;

        this._transit = transit;
        return this;
    }

    /**
     * transit to next state
     * @return FsmTransition
     */
    transit() {
        const transition = this._transit();
        const result = transition.validate();
        if (result.isValid) {
            return transition;
        }
        result.action && result.action();
        throw result.error;
    }
}

class CICDFsm {
    static CONDITION_TABLE = [];

    _fsmStateMap = new Map();
    _projectId = {};
    _token = '';
    _serverUrl = '';
    _currentState = Policy.enums.CICDFSM_STATE.START;

    constructor(project, states = []) {
        this._projectId = project.id;
        this._token = project.client.user.token;
        this._serverUrl = project.client.config.apiServerUrl;
        if (project.cicd.cicdFsmState) {
            this._currentState = project.cicd.cicdFsmState;
        }

        states.forEach(state => {
            this.addState(state);
        });
    }

    addState(fsmState) {
        logger.debug(`[fsm.addState] fsmState._name:${fsmState._name}`, logMeta);
        this._fsmStateMap.set(fsmState._name, fsmState);
    }

    _getCurrentState = () => {
        return this._currentState;
    }

    _transit = currState => {
        logger.debug(`[fsm._transit] Current CICD fsm state is: ${currState}`, logMeta);
        let currentFsmState = this._fsmStateMap.get(currState);

        if (!currentFsmState) {
            logger.debug(`[fsm._transit] state:${currState} not found, set FSM state to end`, logMeta);
            // todo when the fsm state in db is wrong do we need to reset the whole fsm?
            // logger.warn(`[CICD] Reset CICD state to START`, logMeta);
            // return Policy.enums.CICDFSM_STATE.START;
            throw `[fsm._transit] state:${currState} not found, set FSM state to end`;
        }

        try {
            return currentFsmState.transit();
        } catch (e) {
            throw e;
        }
    }

    // cicd state update to Db will be done on server which next state will pass to create scan request
    start = () => {
        let currentState = this._getCurrentState();
        logger.debug(`[fsm._start] currentState:${currentState}`, logMeta);
        let transition = {};
        try {
            transition = this._transit(currentState);
        } catch (e) {
            logger.error(e, logMeta);
        } finally {
            logger.debug(`[fsm._start] nextState:${transition.nextState}`, logMeta);
            return transition.nextState;
        }
    }
}

module.exports.CICDFsm = CICDFsm;
module.exports.FsmState = FsmState;
module.exports.FsmTransition = FsmTransition;
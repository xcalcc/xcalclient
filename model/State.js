const moment = require('moment');

class State {
    _status = Policy.enums.STATUS.PENDING;
    _stepName = '';
    _nextStep = '';
    _startedAt = null;
    _endedAt = null;
    _elapsed = null;
    _reason = '';
    _resourceMonitor = '';
    _otherInfo = {};

    constructor(args) {
        this._init(args);
    }

    _init(state) {
        this._startedAt = Date.now();
        this._stepName = state.stepName;
        this._nextStep = state.nextStep;
        this._type = state.type;
        this._resourceMonitor = state.resourceMonitor;
    }

    /**
     * Load info into state
     * @param state
     */
    load(state) {
        this._startedAt = state.startedAt;
        this._stepName = state.stepName;
        this._nextStep = state.nextStep;
        this._status = state.status;
        this._type = state.type;
    }

    /**
     * Update status with reason
     * @param status
     * @param reason
     */
    updateStatus(status, reason) {
        this._status = status;
        this._reason = reason;
        this.setEnd();
    }

    /**
     * Closing action of a state
     */
    setEnd() {
        this._endedAt = Date.now();
        this._elapsed = `${moment(this._endedAt).diff(this._startedAt, 'milliseconds')} ms`;
    }

    /**
     * Set other info
     * @param key
     * @param data
     */
    setOtherInfo(key, data) {
        this._otherInfo[key] = data;
    }

    /**
     * Get JSON object of state class
     * @return {{elapsed: null, reason: string, stepName: string, endedAt: null, startedAt: null, others, status: string}}
     */
    get json() {
        return {
            startedAt: this._startedAt,
            stepName: this._stepName,
            type: this._type,
            resourceMonitor: this._resourceMonitor,
            // nextStep: this._nextStep, //we dont use nextStep yet, comment out to reduce confusion
            status: this._status,
            endedAt: this._endedAt,
            elapsed: this._elapsed,
            others: this._otherInfo,
            reason: this._reason
        };
    }

}

module.exports = State;

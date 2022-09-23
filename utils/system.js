/**
 * System Util
 * Detect OS level resources or environment info etc.
 */
const osu = require('node-os-utils');
const logger = require('./logger');
const tools = require('./tools');
const logMeta = {
    file: 'utils/system'
}

const system = {
    /**
     * Wait for time
     * @param milliseconds
     * @return {Promise<unknown>}
     */
    wait(milliseconds) {
        logger.debug(`[utils/system] Waiting for ${milliseconds}`, {
            ...logMeta,
            method: 'wait()'
        });
        return new Promise(resolve => setTimeout(resolve, milliseconds));
    },

    /**
     * Sleep for time (same as wait())
     * @param ms
     * @return {Promise<unknown>}
     */
    sleep: ms => new Promise((resolve) => {
        logger.debug(`[utils/system] Sleep for ${ms}`, {
            ...logMeta,
            method: 'wait()'
        });
        setTimeout(resolve, ms);
    }),

    /**
     * print OS resources
     * @return {Promise<{cpuUsage, freememPercentage: *, processUptime: *, cpuFree}>}
     */
    osResource: async () => {
        const cpu = osu.cpu;
        const drive = osu.drive;
        const mem = osu.mem;
        const os = osu.os;

        return {
            os: await os.oos(),
            cpuUsage: await cpu.usage(),
            cpuFree: await cpu.free(),
            drive: await drive.free(),
            mem: await mem.free(),
        };
    },

    /**
     * Exit application with code and info
     * @param code
     * @param data
     */
    exit(code, data, status) {
        const meta = {
            ...logMeta,
            method: 'exit()'
        };
        logger.debug(`[utils/system] Exit with code ${code}, ${JSON.stringify(data)}`, meta);
        switch (code) {
            case 1:
                logger.fatal(`[utils/system] Exit with code ${code}, ${JSON.stringify(data)}`, meta);
                tools.stderrFlowState(Policy.enums.STATE.CLIENT_FINI, Policy.enums.STATUS.FAILED, data);
                process.exit(Policy.enums.EXIT_CODES.GENERAL_ERROR);
                break;
            case 0:
                logger.info(`[utils/system] Successfully performed client tasks, existing...`, meta);
                tools.stdoutFlowState(Policy.enums.STATE.CLIENT_FINI, Policy.enums.STATUS.SUCCESS, data);
                process.exit(Policy.enums.EXIT_CODES.OK);
                break;
            default:
                // logger.error(`Exit with code ${code}, ${JSON.stringify(data)}`, meta);
                tools.stderrFlowState(Policy.enums.STATE.CLIENT_FINI, status || Policy.enums.STATUS.FAILED, data);
                process.exit(code);
                break;
        }
    }
}

module.exports = system;

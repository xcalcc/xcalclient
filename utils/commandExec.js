const logger = require('./logger');
const {spawn, spawnSync, execSync} = require('child_process');
const event = require('../events');
const Policy = require('../policy');

const logMeta = {
    file: 'utils/commandExec'
};

module.exports = {
    /**
     * Spawn command in sync mode
     * @param scriptName
     * @param command
     * @param args
     * @param correlationId
     * @param timeout
     * @return {{logs: {stdout: string[], stderr: string[], error: string}, status: number}}
     */
    runScriptSync: (scriptName, command, args = [], timeout = 3600, correlationId = '', useExec = true) => {
        const meta = {
            ...logMeta,
            correlationId,
            method: 'runScript()'
        };
        logger.debug(`[utils/commandExec] DEBUG SciptName: ${scriptName}`, meta);
        logger.debug(`[utils/commandExec] DEBUG command: ${command}`, meta);
        logger.debug(`[utils/commandExec] DEBUG args: ${JSON.stringify(args)}`, meta);
        logger.debug(`[utils/commandExec] DEBUG timeout: ${timeout} ms`, meta);
        // global.debugMode && args.push('-d');
        logger.info(`[utils/commandExec]Going to execute [${scriptName}] in sync mode`, meta);
        const argStr = args && Object.keys(args).map(arg => args[arg]).join(' ');
        logger.debug(`[utils/commandExec][execSync] ${command} ${argStr}`, meta);
        let result;
        if (useExec) {
            try {
                execSync(`${command} ${argStr}`, {
                    timeout,
                    stdio: 'ignore',
                    shell: "/bin/bash",
                    maxBuffer: Policy.configs.CLIENT.MAX_BUFFER_FOR_SPAWN_SYNC
                });
                return {
                    status: 0,
                    logs: {
                        stderr: [''],
                        // stdout: Buffer.from(result).toString().trim().split('\n'),
                        stdout: [''], // mute it
                        error: '',
                    }
                };
            } catch (e) {
                logger.debug(`[utils/commandExec] exec error: ${e.stack}`, meta);
                return {
                    status: e.status,
                    logs: {
                        stderr: [],
                        stdout: [],
                        error: e.stdout,
                    }
                };
            }

        } else {
            result = spawnSync(command, args, {
                shell: true,
                timeout,
                maxBuffer: Policy.configs.CLIENT.MAX_BUFFER_FOR_SPAWN_SYNC
            });
            const {
                // pid,
                output, //Array of results from stdio output.
                stdout,
                stderr,
                status, //The exit code of the subprocess, or null if the subprocess terminated due to a signal.
                signal, //The signal used to kill the subprocess, or null if the subprocess did not terminate due to a signal.
                error, //The error object if the child process failed or timed out.
            } = result;

            if (stderr) {
                logger.debug(`[utils/commandExec] ERROR ${stderr}`, meta);
            }
            if (stdout) {
                logger.debug(`[utils/commandExec] INFO ${stdout}`, meta);
            }
            if (error) {
                logger.debug(`[utils/commandExec] ERROR ${error}`, meta);
            }
            if (output) {
                logger.debug(`[utils/commandExec] INFO ${output}`, meta);
            }
            if (status === 0) {
                logger.debug(`[utils/commandExec] INFO ${scriptName} Exit on success: Exit code = ${status}`, meta);
            } else {
                logger.debug(`[utils/commandExec] ERROR ${scriptName} Exit: ${status} on signal "${signal}"`, meta);
            }

            const stdoutArr = Buffer.isBuffer(stdout) ? Buffer.from(stdout, 'utf8').toString().trim().split('\n') : stdout;
            const stderrArr = Buffer.isBuffer(stderr) ? Buffer.from(stderr, 'utf8').toString().trim().split('\n') : stderr;
            const errorString = Buffer.isBuffer(error) ? Buffer.from(error, 'utf8').toString().trim() : error;

            return {
                status,
                logs: {
                    stderr: stderrArr,
                    stdout: stdoutArr,
                    error: errorString,
                }
            };
        }
    },

    /**
     * Spawn script in async mode
     * @param scriptName
     * @param command
     * @param args
     * @param correlationId
     * @param successCallback
     * @param failureCallback
     * @return {Promise<void>}
     */
    runScript: async (scriptName, command, args, successCallback, failureCallback, correlationId) => {
        const meta = {
            ...logMeta,
            correlationId,
            method: 'runScript()'
        };
        logger.info(`[utils/commandExec] Going to execute [${scriptName}]`, meta);
        const child = spawn(command, args, {shell: true});
        //ps -p {pid} -0 comm= #get name from pid
        let lastMsg = '';
        child.stdout.on('data', (data) => {
            event.emit(Policy.enums.EVENTS.COMMAND_ON_STDOUT, `stdout: ${data}`, meta);
            lastMsg = data;
        });
        child.stderr.on('data', err => {
            event.emit(Policy.enums.EVENTS.COMMAND_ON_STDERR, `stderr: ${err}`, meta);
            lastMsg = err;
        });

        child.on('close', (code) => {
            event.emit(Policy.enums.EVENTS.COMMAND_ON_CLOSED, `child process close all stdio with code ${code}`, meta);
        });

        child.on('error', error => {
            event.emit(Policy.enums.EVENTS.COMMAND_ON_ERROR, `child process error ${error}`, meta);
        });

        child.on('exit', (code) => {
            if (code !== 0) {
                event.emit(Policy.enums.EVENTS.COMMAND_ON_EXIT, failureCallback, lastMsg, meta);
            } else {
                event.emit(Policy.enums.EVENTS.COMMAND_ON_EXIT, successCallback, lastMsg, meta);
            }
        });
    }
}
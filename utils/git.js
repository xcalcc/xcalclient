/**
 * We presume user has git in system, if not, we need to include a static git binary into our build
 */
const logger = require('./logger');
const {spawnSync} = require('child_process');

const logMeta = {
    file: 'utils/git'
};
module.exports = {
    getLatestCommitId(repoPath, branch) {
        // git rev-parse --abbrev-ref HEAD
        const branchResult = spawnSync(`cd ${repoPath} && git rev-parse --abbrev-ref HEAD`, null, {
            shell: true,
            maxBuffer: Policy.configs.CLIENT.MAX_BUFFER_FOR_SPAWN_SYNC
        });
        const currentBranchName = Buffer.isBuffer(branchResult.stdout) ? Buffer.from(branchResult.stdout, 'utf8').toString().trim(): branchResult.stdout;
        if (currentBranchName !== branch) {
            logger.warn(`Current branch "${currentBranchName}" is not the same as assigned branch in project config "${branch}"`, logMeta);
        }
        const commitResult = spawnSync(`cd ${repoPath} && git log -1 --pretty=format:"%H" --no-patch`, null, {
            shell: true,
            maxBuffer: Policy.configs.CLIENT.MAX_BUFFER_FOR_SPAWN_SYNC
        });
        const {
            output, // Array of results from stdio output.
            stdout,
            status, // The exit code of the subprocess, or null if the subprocess terminated due to a signal.
            error, // The error object if the child process failed or timed out.
        } = commitResult;

        if (status === 0) {
            const stdoutStr = Buffer.isBuffer(stdout) ? Buffer.from(stdout, 'utf8').toString().trim(): stdout;
            logger.info(`[${logMeta.file}] Get commit from current branch ${branch}, commit id is: ${stdoutStr}`, logMeta);
            return stdoutStr;
        }

        const errorString = Buffer.isBuffer(error) ? Buffer.from(error, 'utf8').toString().trim() : error;
        logger.warn(`[${logMeta.file}] Get commit id from current branch failed, ${errorString}`, logMeta);
        return null;
    },
    getRemoteUrl(repoPath) {
        const gitCommand = `cd ${repoPath} && git config --get remote.origin.url`;
        const commandResult = spawnSync(gitCommand, null, {
            shell: true,
            maxBuffer: Policy.configs.CLIENT.MAX_BUFFER_FOR_SPAWN_SYNC
        });

        const {
            output, // Array of results from stdio output.
            stdout,
            status, // The exit code of the subprocess, or null if the subprocess terminated due to a signal.
            error, // The error object if the child process failed or timed out.
        } = commandResult;

        if (status === 0) {
            const stdoutStr = Buffer.isBuffer(stdout) ? Buffer.from(stdout, 'utf8').toString().trim(): stdout;
            logger.info(`[${logMeta.file}] Git remote url: ${stdoutStr}`, logMeta);
            return stdoutStr;
        }
        return null;
    }
}
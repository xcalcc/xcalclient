const {customAlphabet} = require('nanoid');
const {stdout, stderr} = require('process');
const nanoid = customAlphabet('1234567890abcdef', 8);
const logger = require('./logger');
const crypto = require('crypto');
const algorithm = "aes-256-cbc";
const fs = require("fs-extra");
const archiver = require("archiver");
const path = require("path");
const Policy = require('../policy');

const logMeta = {
    file: 'utils/tool'
};

module.exports = {
    /**
     * Generate short form id for task
     * @return {string}
     */
    generateId() {
        logger.debug(`[utils/tools] generating id using "nanoid"`, {
            ...logMeta,
            method: `generateId()`
        });
        return nanoid();
    },
    /**
     * Output formatted stdout
     * @param state
     * @param status
     * @param supplements
     */
    stdoutFlowState(state, status, supplements) {

        const format = JSON.stringify({
            state,
            status,
            action: 'SCAN', //default
            ...supplements
        });
        const outputStr = `[FLOW]${format}\n`;
        logger.info(outputStr, logMeta, false);
        stdout.write(outputStr);
    },
    /**
     * Output formatted stdout
     * @param state
     * @param status
     * @param supplements
     */
    stderrFlowState(state, status, supplements) {

        const format = JSON.stringify({
            state,
            status,
            action: 'SCAN', //default
            ...supplements
        });
        const outputStr = `[FLOW]${format}\n`;
        logger.error(outputStr, logMeta, false);
        stderr.write(outputStr);
    },
    /**
     * stdout
     * @param txt
     */
    stdout(txt) {
        stdout.write(`${txt}\n`);
    },
    /**
     * stderr
     * @param txt
     */
    stderr(txt) {
        stderr.write(`${txt}\n`);
    },
    /**
     * Output formatted stderr
     * @param state
     * @param status
     * @param supplements
     */
    stderrFlowState(state, status, supplements) {
        const format = JSON.stringify({
            state,
            status,
            action: 'SCAN', //default
            ...supplements
        });
        const outputStr = `[FLOW]${format}\n`;
        logger.error(`[Tool] Error: ${format}`, logMeta, false);
        stderr.write(outputStr);
    },
    /**
     * Encrypt data
     * @param data
     * @param secretKey
     * @param iv
     * @return {string}
     */
    encrypt(data, secretKey, iv) {
        logger.debug(`[utils/tools] encrypting data with secretKey and iv`, {
            ...logMeta,
            method: `encrypt()`
        });
        const cipher = crypto.createCipheriv(algorithm, secretKey, iv);
        let encryptedData = cipher.update(data.toString(), "utf-8", "hex");

        encryptedData += cipher.final("hex");
        return encryptedData;
    },
    /**
     * Decrypt data
     * @param encryptedData
     * @param secretKey
     * @param iv
     * @return {string|null}
     */
    decrypt(encryptedData, secretKey, iv) {
        try {
            const decipher = crypto.createDecipheriv(algorithm, secretKey, iv);
            let decryptedData = decipher.update(encryptedData, "hex", "utf-8");
            decryptedData += decipher.final("utf8");
            logger.debug(`[utils/tools] Decryption successful`, {
                ...logMeta,
                method: 'decrypt()'
            });
            return decryptedData;
        } catch (e) {
            logger.error(`[utils/tools] Decryption failed, [${e.code}] - ${e.reason}`, {
                ...logMeta,
                method: 'decrypt()'
            });
            return null;
        }
    },
    /**
     * Generate secret key file
     * @return {Buffer}
     */
    generateSecretKey() {
        logger.debug(`[utils/tools] generating secret key with crypto and randomBytes = 32`, {
            ...logMeta,
            method: `generateSecretKey()`
        });
        // secret key generate 32 bytes of random data
        return crypto.randomBytes(32);
    },
    /**
     * Generate initial vector
     * @return {Buffer}
     */
    generateInitVector() {
        logger.debug(`[utils/tools] generating init vector with randomBytes = 16`, {
            ...logMeta,
            method: `generateInitVector()`
        });
        // generate 16 bytes of random data
        return crypto.randomBytes(16);
    },


    /**
     * Validate scan mode with local and online
     * @param scanModeLocal
     * @param scanModeOnline
     * @return {{valid: boolean, errorMsg: string|null}}
     */
    validateScanMode(scanModeLocal, scanModeOnline = null) {
        const meta = {
            ...logMeta,
            method: 'validateScanMode()'
        };
        logger.debug(`[utils/tools] Validating scan mode`, logMeta);
        if (!scanModeLocal) {
            logger.warn(`[utils/tools] Passed in scan mode is ${scanModeLocal}, validation failed`, meta);
            return {
                valid: false,
                errorMsg: `[utils/tools] Scan mode invalid, validation failed`
            }
        }
        logger.debug(`Comparing scanMode local [${scanModeLocal}] vs scanMode online [${scanModeOnline}]`);
        if (scanModeOnline && scanModeLocal !== scanModeOnline) {
            const diffFromOnlineMsg = ErrorCodes.lookup('E_CLIENT_SCAN_MODE_NOT_ALLOWED_TO_MODIFY', {scanModeLocal: scanModeOnline});
            logger.error(diffFromOnlineMsg.err_message, meta);
            return diffFromOnlineMsg;
        }

        if (Object.values(Policy.configs.CLIENT.SCAN_MODE).includes(scanModeLocal)) {
            logger.debug(`[utils/tools] Passed in scan mode "${scanModeLocal}" is supported `, meta);
            return {
                valid: true,
                errorMsg: null
            };
        }
        const scanModeNotFoundMsg = `[utils/tools] Passed in scan mode "${scanModeLocal}" cannot be found in [${JSON.stringify(Policy.configs.CLIENT.SCAN_MODE)}], validation failed`;
        logger.debug(scanModeNotFoundMsg, meta);
        return {
            valid: false,
            errorMsg: scanModeNotFoundMsg
        }
    },

    /**
     * zip directory
     * @param targetDir
     * @param zipFilePath
     * @param dirName
     * @return {Promise<unknown>}
     */
    zipDirectory(targetDir, zipFilePath, dirName) {
        const meta = {
            ...logMeta,
            method: 'zipDirectory()'
        }
        return new Promise((resolve, reject) => {
            if (fs.existsSync(zipFilePath)) {
                fs.unlinkSync(zipFilePath);
            }

            const outputZip = fs.createWriteStream(zipFilePath);
            const level = 9;
            const archive = archiver('zip', {
                zlib: {
                    level,
                }
            });
            logger.debug(`[utils/tools] Zip directory with zlib level "${level}"`, meta);

            outputZip.on('close', function () {
                logger.info(`[utils/tools] zipDirectory to ${zipFilePath} finished: ${archive.pointer()} total bytes`, meta);
                resolve();
            });

            outputZip.on('error', function (err) {
                logger.info(`[utils/tools] zip directory ${targetDir} failed, error ${err}  `, meta);
                reject(err);
            });

            archive.pipe(outputZip);
            archive.directory(targetDir, dirName || path.basename(targetDir));
            archive.finalize();
        });
    },

    /**
     * Project name – limited to number, english characters, space and <51 characters. No symbol is allowed.
     * @return {boolean}
     */
    validateProjectName(projectName) {
        logger.debug(`Validating project name, pattern is [/^[A-Za-z0-9 _]*[A-Za-z0-9][A-Za-z0-9 _]*$/gi], character limits is 50`, logMeta);
        const reg = /^[A-Za-z0-9_][A-Za-z0-9 _\-.\/]*[A-Za-z0-9_\-.\/]$/gi;
        if (projectName.length > 50 || !reg.test(projectName)) return false;
        return true;
    },

    /**
     * Generate project id from project name
     * @param projectName
     * @return {string}
     */
    generateProjectId(projectName) {
        const random8Suffix = Date.now().toString().slice(5, 13);
        const value = (projectName || '').replace(/[^A-Z0-9]+/gi, '').toLowerCase();
        logger.debug(`Generating project id, the project name is [${projectName}], going to return [${value}${random8Suffix}]`, logMeta);
        return `${value}${random8Suffix}`;
    },

}
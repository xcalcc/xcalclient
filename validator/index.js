const position = '/validator';
const Validator = require('jsonschema').Validator;
const logger = require('../utils/logger');
const scanConfigSchema = require('./schemas/ProjectConfig');
const scanConfigOldSchema = require('./schemas/ProjectConfig_old');
const argumentsSchema = require('./schemas/Arguments');
const commitInfoSchema = require('./schemas/CommitInfo');
const v = new Validator();

const logMeta = {
    file: 'validator/index.js'
}
scanConfigSchema.subSchema && scanConfigSchema.subSchema.forEach(schema => {
    logger.debug(`[Validator] ${schema.id} schema added`, logMeta);
    v.addSchema(schema, schema.id);
});
/**
 * Validation for project config
 * @param projectConfig - configs for validation
 * @return {ValidatorResult}
 */
const validateProjectConfig = projectConfig => {
    logger.debug(`[Validator] Validating project config`, logMeta);
    const result = v.validate(projectConfig, scanConfigSchema.schema);
    if(result.errors.length) {
        logger.error(`[Validator] Validate project schema error: ${result.errors}`, {
            file: position,
            method: 'validateProjectConfig()'
        });
    }
    return result;
}
/**
 * validation for arguments
 * @param argsObj - arg object for validation
 * @return {ValidatorResult}
 */
const validateArgs = argsObj => {
    logger.debug(`[Validator] Validating command line arguments`, logMeta);
    const result = v.validate(argsObj, argumentsSchema.schema);
    if(result.errors && result.errors.length) {
        logger.error(`[Validator] Validate arguments error: ${result.errors}`, {
            file: position,
            method: 'validateArgs()'
        });
    }
    return result;
}
/**
 * Validation for commit info
 * @param commitInfo - commit information for validation
 * @return {ValidatorResult}
 */
const validateCommitInfo = commitInfo => {
    logger.debug(`[Validator] Validating commit info`, logMeta);
    const result = v.validate(commitInfo, commitInfoSchema.schema);
    if(result.errors && result.errors.length) {
        logger.error(`[Validator] CommitInfo validation error: ${result.errors}`, {
            file: position,
            method: 'validateCommitInfo()'
        });
    }
    return result;
}
/**
 * Validation for legacy scan config
 * @param legacyProjectConfig - legacy project configuration for validation
 * @return {ValidatorResult}
 */
const validateLegacyScanConfig = legacyProjectConfig => v.validate(legacyProjectConfig, scanConfigOldSchema.schema);

module.exports = {
    validateProjectConfig,
    validateArgs,
    validateCommitInfo,
    validateLegacyScanConfig,
}
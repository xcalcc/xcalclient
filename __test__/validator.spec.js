const rewire = require('rewire');
const logger = require('../utils/logger');
const validator = rewire('../validator');

beforeAll(() => {
    //todo cannot mute
    logger.muteAll();
});

describe('validator', () => {
    describe('validateProjectConfig', () => {
        const projectConfig = require('./__mocks__/mockProjectConfig');
        it('should pass the validation when project config is valid', () => {
            const result = validator.validateProjectConfig(projectConfig.valid);
            expect(result.valid).toBe(true);
        });
        it('should fail the validation when project config is invalid', () => {
            const result = validator.validateProjectConfig(projectConfig.invalid);
            expect(result.valid).toBe(false);
        });
        it('should fail the validation when project config is null', () => {
            const result = validator.validateProjectConfig(null);
            expect(result.valid).toBe(false);
        });
    });
    describe('validateArgs', () => {
        const mockArgs = require('./__mocks__/mockArgs');
        it('should pass the validation when args are valid', () => {
            const result = validator.validateArgs(mockArgs.valid);
            expect(result.valid).toBe(true);
        });
        it('should fail the validation when args are invalid', () => {
            const result = validator.validateArgs(mockArgs.invalid);
            expect(result.valid).toBe(false);
        });
        it('should fail the validation when args is null', () => {
            const result = validator.validateArgs(null);
            expect(result.valid).toBe(false);
        });
    });
    describe('validateCommitInfo', () => {
        const mockCommitInfo = require('./__mocks__/mockCommitInfo');
        it('should pass the validation when commit info is valid', () => {
            const result = validator.validateCommitInfo(mockCommitInfo.valid);
            expect(result.valid).toBe(true);
        });
        it('should fail the validation when commit info is invalid', () => {
            const result = validator.validateCommitInfo(mockCommitInfo.invalid);
            expect(result.valid).toBe(false);
        });
        it('should fail the validation when commit info is null', () => {
            const result = validator.validateCommitInfo(null);
            expect(result.valid).toBe(false);
        });
    });
    describe('validateLegacyScanConfig', () => {
        const mockLatencyProjectConf = require('./__mocks__/mockLatencyProjectConf');
        it('should pass the validation when project latency config is valid', () => {
            const result = validator.validateLegacyScanConfig(mockLatencyProjectConf.valid);
            expect(result.valid).toBe(true);
        });
        it('should fail the validation when project latency config is invalid', () => {
            const result = validator.validateLegacyScanConfig(mockLatencyProjectConf.invalid);
            expect(result.valid).toBe(false);
        });
        it('should fail the validation when project latency config is null', () => {
            const result = validator.validateLegacyScanConfig(null);
            expect(result.valid).toBe(false);
        });
    });
});

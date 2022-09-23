const fs = require('fs-extra');
const path = require('path');
const rewire = require('rewire');
const logger = require('../../utils/logger');
const tools = rewire('../../utils/tools');

beforeAll(() => {
    logger.muteAll();
});

describe('Utils/tools', () => {
    describe('generateId', () => {
        it('should return string', () => {
            const result = tools.generateId();
            expect(typeof result).toBe('string');
        });
    });
    describe('stdoutFlowState', () => {
        const spy = jest.spyOn(tools.__get__('stdout'), 'write');
        it('should called stdout.write', () => {
            tools.stdoutFlowState();
            expect(spy).toHaveBeenCalled();
        });
    });
    describe('stderrFlowState', () => {
        const spy = jest.spyOn(tools.__get__('stderr'), 'write');
        it('should called stderr.write', () => {
            tools.stderrFlowState();
            expect(spy).toHaveBeenCalled();
        });
    });
    describe('generateSecretKey', () => {
        it('should be 32 bytes output', () => {
            const key = tools.generateSecretKey();
            expect(Buffer.byteLength(key, 'utf8')).toBe(32);
        });
    });
    describe('generateInitVector', () => {
        it('should be 16 bytes output', () => {
            const vector = tools.generateInitVector();
            expect(Buffer.byteLength(vector, 'utf8')).toBe(16);
        });
    });
    describe('encrypt/decrypt', () => {
        const mockDataToEncrypt = 'test';
        const key = tools.generateSecretKey();
        const iv = tools.generateInitVector();
        const spy = jest.spyOn(tools.__get__('crypto'), 'createCipheriv');
        it('should call crypto.createCipheriv', () => {
            tools.encrypt(mockDataToEncrypt, key, iv);
            expect(spy).toHaveBeenCalled();
        });
        it('should be decoded correctly', () => {
            const encryptString = tools.encrypt(mockDataToEncrypt, key, iv);
            expect(tools.decrypt(encryptString, key, iv)).toBe(mockDataToEncrypt);
        });
    });
    describe('verifyScanMode', () => {
       const supportedMode = '-single';
       const unsupportedMode = 'fake';
       it('should return true if scan mode is supported', () => {
          expect(tools.validateScanMode(supportedMode).valid).toBeTruthy();
       });
       it('should return false if scan mode is not supported', () => {
          expect(tools.validateScanMode(unsupportedMode).valid).toBeFalsy();
       });
    });
    describe('zipDirectory', () => {
        const testFolderPath = path.resolve(__dirname, './tmp');
        const testFilePath = path.resolve(testFolderPath, './test.txt');
        fs.ensureFileSync(testFilePath);
        fs.writeFileSync(testFilePath, 'this is test');
        it('should successfully zip a folder', async () => {
            const zipFilePath = path.resolve(testFolderPath, './test.zip');
            await tools.zipDirectory(testFolderPath, zipFilePath);
            const fileExists = fs.pathExistsSync(zipFilePath);
            expect(fileExists).toBeTruthy();
            fs.rmdirSync(testFolderPath, { recursive: true });
        });
    });
    describe('validateProjectName', () => {
        const validMock = 'T--B__a//S..EE  S1';
        const invalidMock1 = 'T--B__a/&/S..EE  S1';
        const invalidMock2 = '-T-B__a//S..EE  S1';
        it('should pass validation with project name "T--B__a//S..EE  S1" ', () => {
            expect(tools.validateProjectName(validMock)).toBeTruthy();
        });
        it('should fail validation with project name "T--B__a/&/S..EE  S1" ', () => {
            expect(tools.validateProjectName(invalidMock1)).toBeFalsy();
        });
        it('should fail validation with project name "-T-B__a//S..EE  S1" ', () => {
            expect(tools.validateProjectName(invalidMock2)).toBeFalsy();
        });
    });

    describe('generateProjectId', () => {
       const mockProjectName = 'Test';
       it('should have an extra length of 8 for random suffix', () => {
           expect(tools.generateProjectId(mockProjectName)).toHaveLength(mockProjectName.length + 8);
       });
    });

});
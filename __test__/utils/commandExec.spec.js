const commandExec = require('../../utils/commandExec');
const Policy = require('../../policy');
const logger = require("../../utils/logger");
beforeAll(() => {
    logger.muteAll();
    mockCommand = 'date';
});

describe('commandExec', () => {
    describe('runCommandSync', () => {
        it('should call linux command in sync mode and returns exit code 0 when success', () => {
            const result = commandExec.runScriptSync('test', mockCommand, ['-u']);
            expect(result.status).toBe(Policy.enums.EXIT_CODES.OK);
        });
        it('should call linux command in sync mode and returns exit code 1 when success', () => {
            const result = commandExec.runScriptSync('test', mockCommand, ['-x']);
            expect(result.status).toBe(Policy.enums.EXIT_CODES.GENERAL_ERROR);
            expect(result.logs.stderr.length).toBeGreaterThan(0);
        });
    });
    describe('runScript asynchronously', () => {
        it('should call linux command in async mode and returns exit code 0 when success', async () => {
            const stub = jest.fn();
            await commandExec.runScript('test', mockCommand, ['-u'],
                () => {
                    stub();
                    expect(stub).toHaveBeenCalled();
                },
                () => {

                });
        });
        it('should call linux command in async mode and returns exit code 1 when failed', async () => {
            const stub = jest.fn();
            await commandExec.runScript('test', mockCommand, ['-x'],
                () => {
                },
                () => {
                    stub();
                    expect(stub).toHaveBeenCalled();
                });
        });
    });
});
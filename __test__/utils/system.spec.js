const system = require('../../utils/system');

describe('System', () => {
    describe('wait fn', () => {
        it('should wait for a particular time', async () => {
            const startTime = Date.now();
            const waitTime = 1000; //ms
            await system.wait(waitTime);
            const endTime = Date.now();
            expect(Math.round((endTime - startTime)/1000)).toBe(1); //round to integer
        });
    });
    describe('sleep fn', () => {
        it('should sleep for a particular time', async () => {
            const startTime = Date.now();
            const waitTime = 1000; //ms
            await system.sleep(waitTime);
            const endTime = Date.now();
            expect(Math.round((endTime - startTime)/1000)).toBe(1); //round to integer
        });
    });
    describe('osResource', () => {
        it('should sleep for a particular time', async () => {
            const resourceInfo = await system.osResource();
            expect(resourceInfo).toHaveProperty('os');
            expect(resourceInfo).toHaveProperty('cpuUsage');
            expect(resourceInfo).toHaveProperty('cpuFree');
            expect(resourceInfo).toHaveProperty('drive');
            expect(resourceInfo).toHaveProperty('mem');
        });
    });
});
const serviceMeta = require('../../package.json');
const Logger = require('xcallogger-node');
const path = require("path");

const Policy = require('../../policy');

const logger = new Logger({
    serviceName: serviceMeta.name,
    serviceVersion: serviceMeta.version,
    consoleConfig: {
        format: 'timelyPlain',
        key: 'console',
    },
    fileConfig: {
        format: 'xc5',
        key: Policy.configs.CLIENT.FILES_FOLDERS.LOGFILE_TRANSPORT_KEY,
        rotation: true,
        dirname: path.resolve(process.env.XCALCLIENT_PATH ? `${process.env.XCALCLIENT_PATH}/logs`: `${process.env.LOG_FILE_PATH || './logs'}`),
        level: 'debug'
    },
});

module.exports = logger;
const position = 'events.js';
const EventEmitter = require('events');
const Policy = require('./policy');
const logger = require('./utils/logger');

class ServerEvents extends EventEmitter {}

const serverEvents = new ServerEvents();

serverEvents.on(Policy.enums.EVENTS.COMMAND_ON_STDERR, (error, meta) => {
    logger.error(error, {
        ...{
            file: position,
            method: `Event-${Policy.enums.EVENTS.COMMAND_ON_STDERR}`
        },
        ...meta
    });
});
serverEvents.on(Policy.enums.EVENTS.COMMAND_ON_ERROR, (error, meta) => {
    logger.error(error, {
        ...{
            file: position,
            method: `Event-${Policy.enums.EVENTS.COMMAND_ON_STDERR}`
        },
        ...meta
    });
});
serverEvents.on(Policy.enums.EVENTS.COMMAND_ON_STDOUT, (msg, meta) => {
    logger.info(msg, {
        ...{
            file: position,
            method: `Event-${Policy.enums.EVENTS.COMMAND_ON_STDOUT}`
        },
        ...meta
    });
});
serverEvents.on(Policy.enums.EVENTS.COMMAND_ON_CLOSED, (msg, meta) => {
    logger.info(msg, {
        ...{
            file: position,
            method: `Event-${Policy.enums.EVENTS.COMMAND_ON_CLOSED}`
        },
        ...meta
    });
});
serverEvents.on(Policy.enums.EVENTS.COMMAND_ON_EXIT, (callback, msg, meta) => {
    logger.info(msg, {
        ...{
            file: position,
            method: `Event-${Policy.enums.EVENTS.COMMAND_ON_EXIT}`
        },
        ...meta
    });
    callback && callback(msg);
});

module.exports = serverEvents;

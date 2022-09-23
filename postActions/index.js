const axios = require('axios');
const logger = require('../utils/logger');

const logMeta = {
    file: 'postAction'
};

const update3rdPartyStatus = async (url, {verb, data}) => {
    const meta = {
        ...logMeta,
        method: 'update3PartyStatus',
    };
    logger.info(`Updating status to ${url} using [${verb}], payload ${JSON.stringify(data)}`, meta);
    let action;
    switch (verb) {
        case 'post':
        case 'delete':
        case 'put':
        case 'get':
            action = verb;
            break;
        default:
            action = 'get';
            break;
    }
    try {
        const res = await axios[action](url, data, {
            headers: {
                // Overwrite Axios's automatically set Content-Type
                'Content-Type': 'application/json'
            }
        });
        logger.info(`Got response from ${url} - ${JSON.stringify(res.data)}`, meta);
        return res.data;
    } catch (e) {
        logger.error(`Cannot update status to ${url}, ${JSON.stringify(e)}`, meta);
        if (e.data) {
            throw e.data
        }
        throw e;
    }
}

module.exports = {
    update3rdPartyStatus,
}

const Schema = require('./Schema');
const ArgumentSchema = {
    id: '/Arguments',
    type: 'object',
    properties: {
        "h": {"type": "string"},
        "p": {"type": "number"},
        "fsp": {"type": "number"},
        "debug": {"type": "boolean"},
        "s": {"type": "string"},
        "u": {"type": "string"},
        "psw": {"type": "string"},
        "call-from": {"type": "string"},
    },
    required: [
        's',
    ]
};
const schema = new Schema('arguments');
schema.schema = ArgumentSchema;

module.exports = schema;

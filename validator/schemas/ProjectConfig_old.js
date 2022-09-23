const Schema = require('./Schema');

const projectConfigSchema = {
    id: '/ScanPayloadConfig',
    type: 'object',
    properties: {
        "projectId": {"type": "string"},
        "projectName": {"type": "string"},
        "projectPath": {"type": "string"},
        "buildPath": {"type": "string"},
        "uploadSourceCode": {"type": "string"},
        "scanConfig": {
            "type": "object",
            "properties": {
                scanMemLimit: {"type": "string"},
                lang: {"type": "string"},
                build: {"type": "string"},
            }
        },
    },
    required: ['projectName', 'scanConfig']
};
const schema = new Schema('projectConfig');
schema.schema = projectConfigSchema;

module.exports = schema;

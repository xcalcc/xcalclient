const Schema = require('./Schema');
const CommitInfoSchema = {
    id: '/CommitInfo',
    type: 'object',
    properties: {
        "commit_id": {"type": "string"},
        "baseline_commit_id": {"type": "string"},
    },
    required: [
        'commit_id',
    ]
};
const schema = new Schema('arguments');
schema.schema = CommitInfoSchema;

module.exports = schema;

module.exports = class Schema {
    constructor(name) {
        this._name = name;
    }
    get name() {
        return this._name;
    }
    set subSchema(subSchema) {
        this._subSchema = subSchema;
    }
    get subSchema() {
        return this._subSchema;
    }
    set schema(schema) {
        this._schema = schema;
    }
    get schema() {
        return this._schema;
    }
}
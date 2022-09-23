class Message {
    _data = {};

    constructor(messageJson) {
        this._data = messageJson;
    }

    /**
     * Get message object from error enums
     * @param key
     * @param interpolation
     * @param locale
     * @return {{err_message, code, key}|{err_message: (*|string), code, key}}
     * @private
     */
    _getMsgObj(key, interpolation, locale = global.locale || 'en') {
        let msg = '';
        if (this._data.hasOwnProperty(key)) {
            let msgObj = {
                ...this._data[key]
            };
            msg = msgObj.err_message[locale];
            interpolation && Object.keys(interpolation).forEach(replacer => {
                msg = msg.replace(`{{${replacer}}}`, interpolation[replacer]);
            });
            return {
                code: msgObj.err_code,
                key,
                err_message: msg,
            };
        }
        console.log(`[message] Cannot find message object, return key [${key}] directly`);
        return key;
    }

    /**
     * Print out plain text error msg
     * @param key
     * @param interpolation
     * @param locale
     * @return {*}
     */
    print(key, interpolation, locale = global.locale || 'en') {
        console.log(`[message] Printing message string by [${key}]`);
        const error = this._getMsgObj(key, interpolation);
        if(typeof error === 'string') {
            return error;
        }
        return `[${key}] ${error.err_message}`;
    }

    /**
     * Find error message object by key
     * @param key
     * @param interpolation
     * @param locale
     * @return {{msg, code, key}|{msg: (*|string), code, key}}
     */
    lookup(key, interpolation, locale = global.locale || 'en') {
        // console.log(`[message] Looking up message object [${key}]`);
        let msgObj = this._getMsgObj(key, interpolation, locale);
        //todo enable msg after Sun's approval
        delete msgObj.msg;
        delete msgObj.key;
        return msgObj;
    }

    getKeys() {
        return Object.keys(this._data);
    }

    get data() {
        return this._data;
    }
}

module.exports = Message;

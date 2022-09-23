const axios = require('axios');

module.exports = {
    /**
     * Upload file in HTTP mode
     * @deprecated
     * @param apiServer
     * @param jwt
     * @param data
     * @param httpHeaders
     * @param correlationId
     * @return {Promise<{error: (any|T)}|any>}
     */
    async uploadFile(apiServer, jwt, data, httpHeaders, correlationId='') {

        let response;
        try {
            response = await axios.post(`${apiServer}/api/file_service/v2/file/file_system`, data, {
                headers: {
                    'X-B3-TraceId': correlationId,
                    'X-B3-SpanId': correlationId,
                    Authorization: `Bearer ${jwt}`, //pass directly from web UI, format as "Bearer ${jwt}"
                    ...httpHeaders
                }
            });
            return response.data;
        } catch (e) {
            const errorMsg = e.response && e.response.data || e.stack;
            return {
                error: errorMsg,
            };
        }
    },

};

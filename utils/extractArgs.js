const argv = require('minimist');
module.exports = () => {
    return argv(process.argv.slice(2));
};
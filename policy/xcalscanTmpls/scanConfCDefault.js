const enums = require('../data/enums');
module.exports = {
    [enums.CONFIGURATION.SCAN.SCAN_MEM_LIMIT]: "2g",
    [enums.CONFIGURATION.SCAN.LANG]: "c++",
    [enums.CONFIGURATION.SCAN.BUILD]: "make",
    [enums.CONFIGURATION.SCAN.FILE_BLACKLIST_CMD]: "",
    [enums.CONFIGURATION.SCAN.FILE_WHITELIST_CMD]: "",
    [enums.CONFIGURATION.SCAN.FILE_BLACKLIST]: ".h;.hpp", //".h;.hpp"
    [enums.CONFIGURATION.SCAN.RULE_WHITELIST]: "", //"ERR33-C;UIV;NPD"
    [enums.CONFIGURATION.SCAN.SUPPRESS_RULES_LIST_FILE]: "", //"/a/b/c.txt" used by cppcheck
    // [enums.CONFIGURATION.SCAN.PARALLEL_JOBS]: 2, //how many threads in server for scanning, optional
};
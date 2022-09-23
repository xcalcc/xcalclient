// node versioning.js --update "minor" --value "2" --src "."
// node versioning.js --update "minor" --auto --src "."
const extractArgs = require('../utils/extractArgs');
const path = require('path');
const fs = require('fs-extra');
const packageConfigPath = path.resolve(__dirname, '../package.json');
const packageConf = fs.readJsonSync(packageConfigPath);

const validateVersion = ver => {
    const reg = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
    const valid = reg.test(ver);
    if (!valid) {
        console.error(`Invalid version format [${ver}], it should be like 1.0.0-alpha.1`);
        return false;
    }
    return true;
}

const injectPreReleaseVersion = (type, ver = 1) => {
    const PRERELEASE_TYPE = {
        ALPHA: 'alpha',
        BETA: 'beta',
        RELEASE_CANDIDATE: 'rc',
    };
    // 1.0.0-alpha < 1.0.0-alpha.1 < 1.0.0-alpha.beta < 1.0.0-beta < 1.0.0-beta.2 < 1.0.0-beta.11 < 1.0.0-rc.1 < 1.0.0.
    if (!PRERELEASE_TYPE.hasOwnProperty(type)) {
        return '';
    }
    return `${PRERELEASE_TYPE[type]}.${ver}`;
}

/**
 * @param src
 * @param options = {
 *  update: find original version file and update original ones based on semantic version constrains (https://semver.org/), value can be "major/minor/patch/meta"
 *  auto: with this option it will be able to update corresponding version block by adding 1
 *  direct: follow by string to give a direct version
 *  src: path of the version file
 *  des: path of the output version file, if which is not specified, it will use src as destination path
 * }
 *
 */
const setVersion = (src = path.resolve(__dirname), options = {
    update: 'minor',
    directValue: packageConf.version, // write version directly to ver file
    auto: false,
}) => {
    if (options.directValue && !validateVersion(options.directValue)) {
        return;
    }
    if (!fs.pathExistsSync(`${path.resolve(__dirname, src, 'ver')}`) || options.directValue) {
        fs.ensureFileSync(path.resolve(__dirname, src, 'ver'));
        fs.writeFileSync(`${path.resolve(__dirname, src, 'ver')}`, `${options.directValue}`);
        return;
    }

    if (update && !verBlocks.includes(update)) {
        console.error(`Unsupported update type ${options.update}, it needs to be one of "major"/"minor"/"patch"`);
        return;
    }
    const verStr = fs.readFileSync(`${path.resolve(__dirname, src, 'ver')}`, {encoding: 'utf8'});
    const validated = validateVersion(verStr);
    if (!validated) {
        return;
    }

    // destruct version blocks
    let verArr = verStr.split('-'), outputVer = '';
    const mainVerArr = verArr[0].split('.');
    let metaVer;
    if (verArr[1]) {
        metaVer = verArr[1].replace('-', '');
        metaVer = metaVer.split('.');
    }
    if (options.update) {
        // when update major, reset minor and patch to 0
        // when update minor, reset patch to 0
        switch (options.update) {
            case 'major':
                mainVerArr[0]++;
                mainVerArr[1] = 0;
                mainVerArr[2] = 0;
                break;
            case 'minor':
                mainVerArr[1]++;
                mainVerArr[2] = 0;
                break;
            case 'patch':
                mainVerArr[2]++;
                break;
            case 'meta':
                metaVer[1]++;
                break;
            default:
                break;
        }
        outputVer = `${mainVerArr.join('.')}${metaVer && "-" + metaVer.join('.') || ''}`;
    }
    console.log(`Update version ${outputVer}`);

    fs.writeFileSync(`${path.resolve(__dirname, src, 'ver')}`, outputVer, {encoding: 'utf-8'});
    return outputVer;
}

// ---
const args = extractArgs();
const {
    update,
    'direct-value': directValue,
    auto,
    'module-name': moduleName,
    'write-back-to-package-json': writeBackToPackageJson,
    'all': updateAll
} = args;

const MODULE_PATH = {
    SCM: path.resolve(__dirname, '../modules/scm'),
    UPLOADER: path.resolve(__dirname, '../modules/uploadFile'),
    PACKAGER: path.resolve(__dirname, '../modules/packager'),
    BUILDTASK: path.resolve(__dirname, '../modules/buildtask'),
    XCALBUILD: path.resolve(__dirname, '../modules/xcalbuild-v2'),
    XCALTRIGGER: path.resolve(__dirname, '../modules/trigger'),
    GATHERLOGTOOL: path.resolve(__dirname, '../modules/gatherLogs'),
    MAIN: path.resolve(__dirname, '../'),
}

const verBlocks = ['major', 'minor', 'patch', 'meta'];
const modules = ['scm', 'uploadfile', 'packager', 'buildtask', 'xcalbuild', 'main'];

if (moduleName && !modules.includes(moduleName)) {
    console.error(`Not supported module value [${moduleName}]`);
    process.exit(1);
}

if (updateAll) {
    Object.keys(MODULE_PATH).forEach(moduleName => {
        const newVer = setVersion(MODULE_PATH[moduleName], {
            update,
            directValue,
            auto,
        });
        if (moduleName === 'MAIN') {
            packageConf.version = newVer;
        }
    });

    if (directValue && validateVersion(directValue)) {
        packageConf.version = directValue;
    }

    writeBackToPackageJson && fs.writeFileSync(packageConfigPath, JSON.stringify(packageConf, null, 4), {encoding: 'utf8'});
    process.exit(0);
}

if (moduleName) {
    const src = MODULE_PATH[moduleName.toUpperCase()];
    const newVer = setVersion(src, {
        update,
        directValue,
        auto,
    });
    packageConf.version = newVer;
    writeBackToPackageJson && fs.writeFileSync(packageConfigPath, JSON.stringify(packageConf, null, 4), {encoding: 'utf8'});
}





/**
 * @deprecated Will be replaced by nexe-static.sh for static build
 * Notice: fs-extra@10.0.0 is incompatible with nexe, need to use fs-extra@9.1.0
 *
 */
const {compile} = require('nexe');
const path = require('path');
const moment = require('moment');
const {execSync} = require('child_process');
const fs = require('fs-extra');
// const archiver = require('archiver');
const flowPolicy = require('../flowPolicy');
const tools = require('../utils/tools');
const osu = require('node-os-utils');
const cpu = osu.cpu;
const cpuCount = cpu.count();

const outputPath = path.resolve(__dirname, './dist');

const flowPolicyPath = path.resolve(outputPath, './flowPolicy.json');
const buildInfoPath = path.resolve(__dirname, './build-info');
const withZip = false;

const zipFileName = `Xcalclient-${moment().format('YYYY-MM-DD')}.zip`;
fs.ensureDirSync(outputPath, {recursive: true});

const buildUserPolicies = () => {
    fs.writeFileSync(flowPolicyPath, JSON.stringify(flowPolicy, null, 4), {encoding: 'utf8'});
    fs.writeFileSync(buildInfoPath, `build-${moment().format('YYYYMMDDhhmm')}`);
}

const hackToStaticNodeBuild = async (compiler, next) => {
    //hack node source
    compiler.nodeSrcBinPath = path.resolve(__dirname, './static-node/node-14.17.6-stripped');
    // await compiler.setFileContentsAsync(
    //     'lib/new-native-module.js',
    //     'module.exports = 42'
    // )
    return next()
}

const preBuiltNodeForMac = async (compiler, next) => {
    //hack node source
    compiler.nodeSrcBinPath = path.resolve(__dirname, './mac/node-mac-14.15.3');
    // await compiler.setFileContentsAsync(
    //     'lib/new-native-module.js',
    //     'module.exports = 42'
    // )
    return next()
}

const nexeConfig = {
    input: './index.js',
    build: true, //required to use patches
    // targets: ['alpine-x64-12.9.1'], //prebuilt static
    name: 'client',
    // clean: true,
    output: path.resolve(outputPath, './client'),
    // icon: './build/icon.ico',
    configure: ['--dest-cpu=x64'],
    make: ['-j', cpuCount - 1],
    resources: [
        // '!node_modules/node-musl', //there are some c++ codes if packed in will cause deserialization issue.
        'build-info',
        'xcal_common/errorMessage.json',
        'ver',
        '.env',
    ],
    verbose: true,
    // fakeArgv: true,
    enableNodeCli: false,
    loglevel: 'error',
    patches: [
        hackToStaticNodeBuild
    ]
};

const packaging = startTime => {
    const timeElapsed = moment().diff(startTime, 'seconds');
    console.log(`nexe bundled linux success, elapsed time: ${timeElapsed} seconds`);
    if (withZip) {
        console.log(`zipping folder to ${zipFileName}...`);
        tools.zipDirectory(outputPath, path.resolve(outputPath, '../', zipFileName), 'Xcalclient').then(() => {

            console.log('zipping finished, output file is ', zipFileName);
            process.exit(Policy.enums.EXIT_CODES.OK);
        });
    }
    fs.removeSync(buildInfoPath);
}

const compileClient = () => {
    const startTime = moment();
    //compile client
    compile(nexeConfig).then(()=> {
        packaging(startTime);
    }).catch(e => console.error(e));
}

const compileClientMac = async () => {
    const startTime = moment();
    const config = {
        ...nexeConfig,
        targets:['mac-x64-14.15.3'],
        patches:[preBuiltNodeForMac],
        build: false,
        // patches:[],
    };
    //compile client
    compile(config).then(()=> {
        packaging(startTime);
    }).catch(e => console.error(e));
}

const compileStaticClient = async () => {
    // buildUserPolicies();
    const command = `npx --package=node-musl musl-env npx nexe --build --configure=--fully-static --make=-j$(node -p 'os.cpus().length') --verbose index.js -o ${outputPath}/client -r "build-info" -r "./xcal_common/*.json"`;

    /**
     *  https://github.com/nexe/nexe/issues/938
     *  https://www.npmjs.com/package/node-musl
     *  https://github.com/mysticatea/cpx/issues/24
     *  build static linked version can be run across linux
     *  if you want all executables packed in, add -r "executable/**"
     */
    execSync(command);
}

// (async () => {
//     try {
//         await compileStaticClient();
//         console.error(`Compile client success`);
//     } catch (e) {
//         console.error(`Compile client got issue: ${JSON.stringify(e)}`);
//         process.exit(1);
//     } finally {
//         console.log('Finishing compile static client...');
//         process.exit(0);
//     }
// })();

module.exports = {
    buildUserPolicies,
    compileStaticClient,
    compileClient,
    compileClientMac,
}
/**
 * This used to resolve old client users to migrate their config files to new place
 * But as now we support extra option -c, this will be deprecated.
 * @deprecated
 */
const fs = require('fs-extra');
const path = require('path');
const extractArgs = require('../../utils/extractArgs');
const authService = require("../../service/authService");
const projectService = require('../../service/projectService');
const Policy = require('../../policy');
const validator = require('../../validator');

const extractArgsFromCommand = () => {
    const args = extractArgs();
    return {
        configPath: args['config-path'],
        user: args.u,
        psw: args.psw,
        apiServer: `${args.h}:${args.p}`,
    }
}

const authenticate = async (serverUrl, username, psw) => {
    let result;
    try {
        result = await authService.login(serverUrl, username, psw);
        if (result.data) {
            const jwt = result.data.accessToken;
            console.log(`Login success and jwt saved`);
            console.log(`JWT: ${jwt}`);
            return jwt;
        } else {
            return false;
        }
    } catch (e) {
        console.error(`Login error: ${JSON.stringify(e)}`);
        return false;
    }
}

const migrateConfig = async () => {
    const args = extractArgsFromCommand();
    const configPath = args.configPath;
    const migrateQueue = [];
    const jwt = await authenticate(args.apiServer, args.user, args.psw);

    if(!jwt) {
        console.error('Authentication failure');
        process.exit(Policy.enums.EXIT_CODES.GENERAL_ERROR);
    }

    fs.readdirSync(configPath).forEach(file => {
        if (path.extname(file) === ".conf") {
            migrateQueue.push(`${configPath}/${file}`);
        }
    });

    let migrated = [];
    let ignored = [];
    const logFile = './migration.log';
    fs.ensureFileSync(logFile);
    fs.writeFileSync(logFile, '');

    for await (let configFilePath of migrateQueue) {
        console.log(`Start migrating ${configFilePath}`);
        try {
            const config = fs.readJsonSync(configFilePath, {encoding: 'utf8'});
            const validateResult = validator.validateLegacyScanConfig(config);
            if(!validateResult.valid) {
                console.error(`Validation error for ${configFilePath}, errors: ${JSON.stringify(validateResult.errors)}`);
                ignored.push(configFilePath);
                continue;
            }
            const projectId = config.projectId;
            const projectSourcePath = config.projectPath;
            let scanConfig = config.scanConfig || Policy.projectConfTmpl.scanConfCTmpl;
            const onlineProjectConfResponse = await projectService.fetchProjectConfByProjectId(args.apiServer, jwt, projectId);
            const onlineProjectConfig = JSON.parse(onlineProjectConfResponse.projectConfig);

            const projectUUID = onlineProjectConfResponse.project && onlineProjectConfResponse.project.id;
            const scanMode = onlineProjectConfResponse.attributes.find(attribute => attribute.name === 'scanMode');

            scanConfig.scanMode = scanMode.value;

            console.log(`Migrating [${configFilePath}] to [${projectSourcePath}/${Policy.configs.CLIENT.FILES_FOLDERS.SCAN_CONFIG_FILE}]`);
            let uploadSource = config.uploadSourceCode || onlineProjectConfig.uploadSource;
            if (typeof uploadSource === 'string') {
                uploadSource = (uploadSource === 'Y');
            }
            if (config.scanConfig.hasOwnProperty('crossScan')) {
                delete config.scanConfig.crossScan;
            }

            const newConfig = {
                ...config,
                scanConfig,
                uploadSource,
                dsr: {
                    repoPath: '',
                    repoBranch: '',
                },
                projectUUID,
            };


            migrated.push(`${configFilePath} => ${path.resolve(projectSourcePath, Policy.configs.CLIENT.FILES_FOLDERS.SCAN_CONFIG_FILE)}`);
            fs.writeFileSync(path.resolve(projectSourcePath, Policy.configs.CLIENT.FILES_FOLDERS.SCAN_CONFIG_FILE), JSON.stringify(newConfig, null, 4), {encoding: 'utf8'});
        } catch (e) {
            console.error(e);
            ignored.push(`${configFilePath}, error: ${e}`);
        }
    }
    fs.appendFileSync(logFile, '---Migrated---\n');
    migrated.forEach(filePath => {
       fs.appendFileSync(logFile, `${filePath}\n`);
    });
    fs.appendFileSync(logFile, '---Ignored---\n');
    ignored.forEach(filePath => {
        fs.appendFileSync(logFile, `${filePath}\n`);
    });

    return Promise.resolve(migrated);
}

migrateConfig().then(migrateQueue => console.log(`
Successfully migrated config files: 
${migrateQueue.join("\n")}
`)).catch(e => console.error(e));

module.exports = migrateConfig;

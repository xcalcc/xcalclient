# The New Xcal Client #

A rewritten client to accept argument and run in daemon for local preprocessing

## Packaging ##

Please refer to ```./build/README.MD```.

## Dev run ##

No need to package, you can add args in ```run-test``` in ```scripts``` section of package.json.

```shell
$>yarn run-test
```

## Calling example ##

| N.B.: User can assign task folder in .xcalsetting giving value to ```taskFolder``` or same key in project configs or giving ```--task-folder``` in command line. The priority is ```command line > project config > .xcalsetting``` |
|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

```shell
$>./client -h "http://xxx.xx.xx" -p 80 --fsp 9000 -u "xx" --psw "xx" -s "/home/jack/projects/scan-source/basic" --call-from 'V' --new --project-name "basic_new" -m "single" --debug
```

Argv:

| Argument         | Description                                              | Type    | Consumer   | Conflict | Owner | Internal | Default              | Required          |
|------------------|----------------------------------------------------------|---------|------------|----------|-------|----------|----------------------|-------------------|
| -h               | scan Server Host                                         | String  | Controller | N/A      | PM    |          | From client setting  | R                 |
| -p               | scan Server Port                                         | Decimal | Controller | N/A      | PM    |          | From client setting  | R                 |
| -m               | scan mode                                                | String  | Controller | N/A      | PM    |          | From project setting | O                 |
| -c               | config file path, bypass default xcalscan.conf           | String  | Controller | -s       | PM    |          | N/A                  | O                 |
| -s               | source code path (absolute)                              | String  | Controller | -c       | PM    |          | N/A                  | R                 |
| -u               | user name                                                | String  | Controller | N/A      | PM    |          | From client setting  | O (if set before) |
| --psw            | user password                                            | String  | Controller | N/A      | PM    |          | From client setting  | O (if set before) |
| --fsp            | file service port                                        | Decimal | Uploader   | N/A      | R&D   |          | From project setting | R                 |
| --new            | if to create a new project regardless it has uuid before | String  | Controller | N/A      | PM    |          | false                | O                 |
| --project-name   | specified projectName (this will write back to config)   | String  | Controller | N/A      | PM    |          | N/A                  | O                 |
| --project-id     | specified projectId (this will write back to config)     | String  | Controller | N/A      | PM    |          | N/A                  | O                 |
| --repo-path      | repository path                                          | String  | SCM        | N/A      | R&D   |          | N/A                  | O                 |
| --repo-branch    | repository branch                                        | String  | SCM        | N/A      | R&D   |          | N/A                  | O                 |
| --delta-result   | temporary delta in scan                                  | Boolean | SCM        | N/A      | R&D   |          | N/A                  | O                 |
| --max-get-commit | max search commit for git, default                       | Decimal | SCM        | N/A      | R&D   |          | N/A                  | O                 |
| --locale         | locale en/cn                                             | String  | Controller | N/A      | PM    |          | en                   | R                 |
| --report (TBD)   | visualize scan log and states                            | Boolean | Controller | N/A      | PM    |          | N/A                  | O                 |
| --call-from      | client entry point                                       | String  | Controller | N/A      | R&D   |          | N/A                  | R                 |
| --debug          | debug mode                                               | Boolean | Controller | N/A      | R&D   |          | false                | O                 |
| --help           | show options                                             | Boolean | Controller | N/A      | R&D   |          | false                | O                 |
| --dev            | dev mode, now support --help --dev for hidden options    | Boolean | Controller | N/A      | R&D   |          | false                | O                 |
| --cancel         | cancel mode                                              | Boolean | Controller | N/A      | R&D   |          | false                | O                 |
| --build-path     | where project should build to                            | String  | Controller | N/A      | R&D   |          | N/A                  | O                 |
| --task-folder    | task folder path to store temp work files                | String  | Controller | N/A      | R&D   |          | N/A                  | O                 |

## Structure ##

**Client always presumes there will be a .xcalscan folder in the source code folder**

As for client, the overall controller is the phase (stage) controller, each stage contains sub phases, each sub phase
folder will have the controller itself to trigger executable binaries.

- Setup stage
    - Project config
    - Create project
    - Rule (custom rule uploading to rule service)
    - SCM
- Preproc stage
    - Preprocess
    - Upload
    - Submit scan task to scan service

## Trouble shooting ##

## Subphase Executables ##

### Scm ###

```scmSubPhase``` can be treated as a combination of spGetCommitId and spGetScmDiff

```
./executable/scm/scmSubPhase
```

| Argument | Description                                                     | Type   | Consumer | Default | Required |
|----------|-----------------------------------------------------------------|--------|----------|---------|----------|
| -op      | output path                                                     | string | scm      | N/A     | R        |
| -api     | server url with server port                                     | string | scm      | N/A     | R        |
| -pid     | project id (uuid) to lookup for baseline                        | string | scm      | N/A     | R        |
| -token   | jwt token, expired in 24 hrs                                    | string | scm      | N/A     | R        |
| -bt      | back track, look back steps until commit id matches baseline id | string | scm      | 10      | O        |
| -rp      | repo path, project folder with .git folder                      | string | scm      | N/A     | R        |
| -rb      | repo branch read from xcalscan.conf                             | string | scm      | N/A     | R        |
| --commit-id     | commit id                                                       | string | scm      | N/A     | O        |
| --baseline-commit-id    | baseline commit id                                              | string | scm      | N/A     | O        |
| -dr      | Delta result for partial scan                                   | string | scm      | false   | O        |
| --git-folder-tolerance      | Allowing .git folder in parent folder or not                                   | boolean | scm      | false   | O        |

```
./executable/scm/spGetCommitId
```

| Argument | Description   | Required |
|----------|---------------|----------|
| -api     | server url    | required |
| -token   | token         | required |
| -rp      | repo branch   | required |
| -rb      | repo branch   | required |
| -pc      | xcalscan.conf | required |
| -op      | output path   | required |

```
./executable/scm/spGetCommitId
```

| Argument | Description        | Required |
|----------|--------------------|----------|
| -op      | output path        | required |
| -cid     | commit id          | required |
| -bcid    | baseline commit id | required |
| -rp      | repo path          | required |
| -rb      | repo branch        | required |

### Packager ###

```
./executable/packager
```

| Argument | Description   | Required |
|----------|---------------|----------|
| -op      | output path   | required |
| -pc      | xcalscan.conf | required |

### Prebuild ###

```
./executable/buildtask
```

| Argument   | Description            | Required                  |
|------------|------------------------|---------------------------|
| -op        | output path            | required                  |
| -pc        | xcalscan.conf          | required                  |
| -xp        | xcalbuild folder       | required                  |
| --scan-all | scan all with clean    | optional - user invisible |
| --fwl      | file whitelist command | optional                  |
| --fbl      | file blacklist command | optional                  |

### Uploader ###

```
./executable/uploadfile
```

| Argument | Description                       | Required |
|----------|-----------------------------------|----------|
| -url     | minio server url                  | required |
| -pc      | xcalscan.conf                     | required |
| -fd      | temp scan ID folder (work folder) | required |

## Creating project ##

```./script/projectSetup``` will run separately to setup a project, first time it will always fail as project name
should be assigned by user.

## Scan cancellation ##

```shell
$>./client -h "http://xxx.xx.xx" -p 80 -u "xx" --psw "xx" -s "/mnt/d/vm-shared/basic" --cancel
```

Argv for cancel:

| Argument | Description      | Required                 |
|----------|------------------|--------------------------|
| --cancel | Scan Server Host | required                 |
| -h       | Scan Server Host | required                 |
| -p       | Scan Server Port | required                 |
| -u       | User name        | optional (if set before) |
| --psw    | User password    | optional (if set before) |

## Migrating 2.0.1 or older configs ##

You need to assign the config folder which contains old config files the script will help you create a new 2.1.0 config
for project scanning

```shell
$> ./migrate-config -u "xx" --psw "xx" --config-path "/home/jack/configs" -h "http://xxx.xx.xx" -p "80"
```

Argv for config migration:

| Argument      | Description         | Required                 |
|---------------|---------------------|--------------------------|
| -h            | Scan Server Host    | required                 |
| -p            | Scan Server Port    | required                 |
| -u            | User name           | optional (if set before) |
| --psw         | User password       | optional (if set before) |
| --config-path | Config files folder | required                 |

## Collecting logs ##

```shell
$>./tools/gather-logs  --project-path "/home/jack/projects/scan-source/basic" --scan-task-id "74b775d3-9f77-45f7-a201-54a8cdf0b60e" --server-url "http://xxx.xx.xx" --username "xx" --password "xx" --output-file "./74b775d3-9f77-45f7-a201-54a8cdf0b60e.log"
```

Argv for config collecting logs:

| Argument       | Description              | Required |
|----------------|--------------------------|----------|
| --project-path | Project source code path | required |
| --scan-task-id | Scan task UUID           | required |
| --server-url   | API server url           | required |
| --username     | User name                | required |
| --password     | User password            | required |
| --output-file  | The output log file      | required |

## Developer end to end test ##

Before commit, you'd better do basic end to end test to make sure your modification work. Below is the steps for how to
do this. This is verified in Ubuntu 20.04, other systems should also be ok, but you probably need to make some changes.
Because of the different system environment, various problems may occur. You may do some other tings to make it work.

### prerequisite:

There should be a xcalscan server deployed already.

### steps:

1. install yarn:

```shell
curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add
echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list
sudo apt update
sudo apt install yarn
```

2. node version should be > 12.2.0, please google for how to install latest version node.
3. install some dependency such as xcallogger:

```shell
yarn install
```

4. install python dependency:

```shell
pip3 install minio
```

5. set python path:

```shell
export PYTHONPATH=~/xxx/xcalclient:~/xxx/xcalclient/modules

```

6. copy xcalbuild executable directory to ~/xxx/xcalclient/modules
7. copy or create .xcalsetting file to ~/xxx/xcalclient, fill in appropriate value.
8. copy xcalscan.conf to your test project path, such as ~/xxx/projects/basic, fill in appropriate value.
8. open package.json file, modify 'run-test' line, use your test case project path to replace the example value.
9. open policy/data/configs.js file, modify executable value to the corresponding python script.
10. finally, run test, and waiting for the result.

```shell
yarn run-test
```

## Updating version
Update versions for each module
```shell
yarn update-ver  --all --direct-value "xx.xx.xx"
```

Argsv:
- --update: major/minor/patch/meta/main
- --auto: auto patching version file
- --all: patch all subphases and controller
- --direct-value: assign direct version number
- --write-back-to-package-json: also update version in package.json
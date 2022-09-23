module.exports = {
    valid: {
        "projectId": "basictest515873049",
        "projectName": "basicTest5",
        "projectPath": "/home/jack/projects/scan-source/basic",
        "buildPath": "/home/jack/projects/scan-source/basic",
        "scanConfig": {
            "scanMemLimit": "2g",
            "lang": "c++",
            "build": "make",
            "scanMode": "-single"
        },
        "dsr": {
            "maxGetCommit": 10,
            "needDsr": false
        },
        "uploadSource": true,
        "houseKeeping": {
            "maxTaskFolders": 10
        },
        "projectUUID": "e5c5ebd8-8317-440f-968c-e414d114ad25"
    },

    invalid: {
        "projectId": "",
        "projectName": "basicTest5",
        "uploadSource": true,
        "houseKeeping": {
            "maxTaskFolders": 10
        },
    }

}
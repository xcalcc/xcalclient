pipeline {
    agent {
          node {
            label "${AGENT}"
          }
        }

    environment {
        PATH="/sbin:/usr/sbin:/usr/bin:/usr/local/bin:/bin:/home/xc5/.local/bin"
        WORKDIR=pwd()

        XCALCLIENT_BUILD_DOCKER_IMG="hub.xcalibyte.co/sdlc/xcalclientbuilder:latest"
        XCALCLIENT_URL="https://github.com/xcalcc/xcalclient.git"
        XCALBUILD_NEXUS_REPO_ADDRESS="${XCALBUILD_NEXUS_REPO_ADDRESS ? XCALBUILD_NEXUS_REPO_ADDRESS : 'http://127.0.0.1:8081/service/rest/v1/search/assets/download?sort=version&repository=xcalbuild'}"
        XCALCLIENT_NEXUS_REPO_ADDRESS="${XCALCLIENT_NEXUS_REPO_ADDRESS ? XCALCLIENT_NEXUS_REPO_ADDRESS : 'http://127.0.0.1:8081/repository/xcalclient/'}"
        XCALCLIENT_NEXUS_REPO_ADDRESS2="${XCALCLIENT_NEXUS_REPO_ADDRESS2 ? XCALCLIENT_NEXUS_REPO_ADDRESS2 : 'http://127.0.0.1:8081/repository/xcalclient/'}"

        DATETIME = sh(returnStdout: true, script: 'date +%Y-%m-%d').trim()

        LOG_FILE="$WORKDIR/cli_agent_build.log"
        VER_FILE="$WORKDIR/VER.txt"
        LOCAL_ARTIFACTS_PATH="/xcal-artifacts/inhouse/xcalclient/xcalclient-cli/${VERSION}/$DATETIME"

        PLATFORM="${PLATFORM ? PLATFORM : 'linux'}"

        AUTO_TEST_SERVER="$AUTO_TEST_SERVER"
        NO_INSTALL="$NO_INSTALL"
        ID="$XCALCLIENT_BRANCH-$DATETIME${NO_INSTALL=='true' ? '-NOINSTALL' : ''}"
    }

    stages {
        stage('start banner') {
            steps {
                echo "*********************************"
                echo "Starting Packaging xcalclient for ${PLATFORM}..."
                echo "*********************************"
                sh '''
                    if [ -f $VER_FILE ]; then
                       rm $VER_FILE
                    fi
                '''
            }
        }
        stage('build xcalclient') {
            steps {
                sh 'cd $WORKDIR'
                sh '''
                    # update the submodule named xcal_common
                    cd $WORKDIR/xcal_common
                    git checkout ${XCALCOMMON_BRANCH}
                    git pull origin ${XCALCOMMON_BRANCH}
                    echo "update the submodule named xcal_common to ${XCALCOMMON_BRANCH}"
                    git log -n 1
                    cd $WORKDIR

                    echo ${INFO} "Start to build XcalClient for ${PLATFORM}..."
                    # use docker to build based on ubuntu 18.04, new docker image xcalclientbuilder:1.1 will do the build task
                    # no branch should be specified in building, which is prerequisite before build during source code preparation
                    chmod +x -R $(pwd)/modules/
                    mkdir -p build/dist/executable
                    mkdir -p build/dist/tools

                    sudo chown -R $USER: $(pwd)
                    docker image pull $XCALCLIENT_BUILD_DOCKER_IMG
                    #docker context use $USER
                    docker run --rm -e TARGET=${PLATFORM} -v $(pwd):/home:Z -w /home $XCALCLIENT_BUILD_DOCKER_IMG yarn && yarn build ${PLATFORM} ${NO_INSTALL}

                    #yarn
                    #yarn build

                    if [ -d "$WORKDIR/build/dist/executable" ]; then
                        if [ "$(ls -A "$WORKDIR/build/dist/executable")" ]; then
                          echo "Take action $WORKDIR/build/dist/executable is not Empty, going to copy subphase executables"
                        else
                          echo "$WORKDIR/build/dist/executable is Empty"
                          exit 1
                        fi
                    else
                        echo "Directory $WORKDIR/build/dist/executable not found."
                        exit 1
                    fi

                    if [ -d "$WORKDIR/build/dist/tools" ]; then
                        if [ "$(ls -A "$WORKDIR/build/dist/tools")" ]; then
                          echo "Take action $WORKDIR/build/dist/tools is not Empty, going to copy python tools"
                        else
                          echo "$WORKDIR/build/dist/tools is Empty"
                          exit 1
                        fi
                    else
                        echo "Directory $WORKDIR/build/dist/tools not found."
                        exit 1
                    fi

                    #ver_grabber "XcalClient" "${WORKDIR}" $XCALCLIENT_BRANCH
                '''
            }
        }
        stage('prepare target ') {
            steps {
                sh '''#!/bin/bash
                    cd $WORKDIR || return

                    if [ -d target ]; then
                        rm -rf target
                    fi
                    mkdir target
                    mkdir -p target/xcalclient/tools

                    cp -R ./build/dist/. target/xcalclient
                '''
            }
        }
        stage('fetch xcalbuild') {
            steps {
                echo "Fetching xcalbuild from $XCALBUILD_NEXUS_REPO_ADDRESS"
                sh '''#!/bin/bash
                    cd ${WORKDIR}/target || return

                    # Copy xcalbuild
                    mkdir -p xcalclient/executable/xcalbuild
                    curl -u $NEXUS_REPO_USER:$NEXUS_REPO_PSW -L -X GET $XCALBUILD_NEXUS_REPO_ADDRESS -H "accept: application/json" --output xcalbuild.zip
                    unzip xcalbuild.zip -d xcalbuild
                    cp -R xcalbuild/. xcalclient/executable/xcalbuild
                    rm xcalbuild.zip
                '''
            }
        }
        stage('zip client') {
            steps {
                sh '''#!/bin/bash
                    cd $WORKDIR || return

                    chmod -R +x target/xcalclient
                    cd target
                    zip -r xcalclient-${PLATFORM}-${ID}.zip xcalclient
                    mkdir -p $LOCAL_ARTIFACTS_PATH && cp -Rfv ./xcalclient-${PLATFORM}-${ID}.zip $VER_FILE $LOCAL_ARTIFACTS_PATH 2>&1 || true
                '''
            }
        }
    }

    post ('push info to auto test server') {
        success {
            sh'''#!/bin/bash
                set +e
                if [ -n "$XCALCLIENT_NEXUS_REPO_ADDRESS" ]
                then
                    echo "sending package to $XCALCLIENT_NEXUS_REPO_ADDRESS"
                    curl -v -u $NEXUS_REPO_USER:$NEXUS_REPO_PSW --upload-file "${WORKDIR}/target/xcalclient-${PLATFORM}-${ID}.zip" $XCALCLIENT_NEXUS_REPO_ADDRESS
                fi

                if [ -n "$XCALCLIENT_NEXUS_REPO_ADDRESS2" ]
                then
                    echo "sending package to $XCALCLIENT_NEXUS_REPO_ADDRESS"
                    curl -v -u $NEXUS_REPO_USER:$NEXUS_REPO_PSW --upload-file "${WORKDIR}/target/xcalclient-${PLATFORM}-${ID}.zip" $XCALCLIENT_NEXUS_REPO_ADDRESS2
                fi
            '''
            sh'''#!/bin/bash
                artifact_local="${WORKDIR}/target/xcalclient-${PLATFORM}-${ID}.zip"
                artifact_remote="$XCALCLIENT_NEXUS_REPO_ADDRESS2/xcalclient-${PLATFORM}-${ID}.zip"
                set +e
                md5value="$(md5sum) $artifact_local"
                echo '{"artifact":${artifact_remote}, "md5": ${md5value}, "date": date}'
            '''
        }

        always {
             dir('target') {
                script {
                    echo "Running python script to update package info for client"
                    sh'''
                        if [ "$PLATFORM" == "linux" && -n "$AUTO_TEST_SERVER" ]; then
                            FILE_NAME="xcalclient-${PLATFORM}-${ID}.zip"
                            MD5="$(md5sum) $FILE_NAME"
                            echo "md5 is $MD5"
                            ssh parallels@$AUTO_TEST_SERVER "cd /home/gitlab-runner/sh && pwd && python3 ./setconf.py client $FILE_NAME $MD5"
                        fi
                    '''
                }
             }
        }
    }
}

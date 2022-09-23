#!/usr/bin/env bash

PROJECT_ROOT=$(pwd)
PYTHON_MODULE_PATH=$(pwd)/modules
OS=$(uname)
target="${1:='linux'}"
NO_INSTALL="$2"

PREBUILT_PACKAGE_PATH="${PROJECT_ROOT}/build/mac/prebuilt"

echo "project root $PROJECT_ROOT"
start=$(date +%s)

dist="$PROJECT_ROOT/build/dist/"

# clean up dist
rm -rf $dist

mkdir -p dist

build_controller() {
    # generate env file first and bundle to controller
    generate_and_copy_env_file
    # build client
    if [[ $target == "mac" ]]; then
        echo "Building controller for MacOS"
        yarn nexe-mac
    else
        echo "Building controller for Linux"
        yarn nexe
    fi
    # already bundled in controller
    rm .env
}

build_py_subphases() {
    #build subphases
    echo "[Build subphases] building scm..."
    cd $PYTHON_MODULE_PATH/scm && sh -c "./build.sh --$1"
    echo "[Build subphases] building packager..."
    cd $PYTHON_MODULE_PATH/packager && sh -c "./build.sh --$1"
    echo "[Build subphases] building buildtask..."
    cd $PYTHON_MODULE_PATH/buildtask && sh -c "./build.sh --$1"
    echo "[Build subphases] building uploadFile..."
    cd $PYTHON_MODULE_PATH/uploadFile && sh -c "./build.sh --$1"

    #build gather log tool
    echo "[Build gather log tool] building gather log tool..."
    cd $PYTHON_MODULE_PATH/gatherLogs && sh -c "./build.sh --$1"

    #build trigger
    echo "[Build jenkins trigger] building jenkins trigger..."
    cd $PYTHON_MODULE_PATH/trigger && sh -c "./build.sh --$1"
}

copy_configs() {
    echo "Copying $PROJECT_ROOT/build/xcalscan.conf to $dist/xcalscan.conf"
    cp -f "$PROJECT_ROOT/build/xcalscan.conf" "$dist/xcalscan.conf"
    echo "Copying $PROJECT_ROOT/build/setup.sh to $dist/setup.sh"
    cp -f "$PROJECT_ROOT/build/setup.sh" "$dist/setup.sh"
    echo "Copying $PROJECT_ROOT/build/.template_xcalsetting to $dist/.template_xcalsetting"
    cp -f "$PROJECT_ROOT/build/.template_xcalsetting" "$dist/.template_xcalsetting"
}

copy_cppcheck_suppression_file() {
  echo "Copying cpp check suppression file..."
  cp -f $PROJECT_ROOT/build/cppcheck_suppressions.txt $dist/suppressions.txt
}

generate_and_copy_env_file() {
  : > .env
  if [[ -n $ENABLE_CUSTOM_RULE_UPLOAD ]]; then
    printf "ENABLE_CUSTOM_RULE_UPLOAD=%s\n" "$ENABLE_CUSTOM_RULE_UPLOAD" >> .env
  fi
  if [[ -n $ENABLE_CICD_CONTROL ]]; then
    printf "ENABLE_CICD_CONTROL=%s\n" "$ENABLE_CICD_CONTROL" >> .env
  fi
  if [[ -n $ENABLE_DSR ]]; then
    printf "ENABLE_DSR=%s\n" "$ENABLE_DSR" >> .env
  fi
  if [[ -n $PRINT_VERSION_AT_START ]]; then
    printf "PRINT_VERSION_AT_START=%s\n" "$PRINT_VERSION_AT_START" >> .env
  fi
  if [[ -n $UPDATE_STATUS_TO_3RD_PARTY ]]; then
    printf "UPDATE_STATUS_TO_3RD_PARTY=%s\n" "$UPDATE_STATUS_TO_3RD_PARTY" >> .env
  fi
}

copy_files_from_build_results() {
    chown -R $USER: $PYTHON_MODULE_PATH

    if [ ! -f  $PYTHON_MODULE_PATH/scm/dist/scm ] ||  \
       [ ! -f  $PYTHON_MODULE_PATH/packager/dist/packager ] || \
       [ ! -f  $PYTHON_MODULE_PATH/buildtask/dist/buildtask ] || \
       [ ! -f  $PYTHON_MODULE_PATH/uploadFile/dist/uploadfile ] || \
       [ ! -f  $PYTHON_MODULE_PATH/trigger/dist/xcal-trigger ] || \
       [ ! -f  $PYTHON_MODULE_PATH/gatherLogs/dist/gather-logs ]
    then
       echo "ERROR: missing subphase file(s)..."
       echo "-------------------Aborted-------------------"
       exit 1
    fi

    mkdir -p $dist/executable
    # copy executables
    echo "Copying subphases scm..."
    file $PYTHON_MODULE_PATH/scm/dist/scm
    cp -f $PYTHON_MODULE_PATH/scm/dist/scm $dist/executable/scmSubPhase

    echo "Copying subphases packager..."
    file $PYTHON_MODULE_PATH/packager/dist/packager
    cp -f $PYTHON_MODULE_PATH/packager/dist/packager $dist/executable/packager

    echo "Copying subphases buildtask..."
    file $PYTHON_MODULE_PATH/buildtask/dist/buildtask
    cp -f $PYTHON_MODULE_PATH/buildtask/dist/buildtask $dist/executable/buildtask

    echo "Copying subphases uploadFile..."
    file $PYTHON_MODULE_PATH/uploadFile/dist/uploadfile
    cp -f $PYTHON_MODULE_PATH/uploadFile/dist/uploadfile $dist/executable/uploadfile

    echo "Copying xcal-trigger to tools..."
    mkdir -p $dist/tools
    cp $PYTHON_MODULE_PATH/trigger/dist/xcal-trigger $dist/tools/xcal-trigger

    echo "Copying tools gather-logs..."
    cp -f $PYTHON_MODULE_PATH/gatherLogs/dist/gather-logs $dist/tools/gather-logs
}

copy_files_from_prebuilt_for_mac() {
    chown -R $USER: $PREBUILT_PACKAGE_PATH
    echo "Copying $PREBUILT_PACKAGE_PATH to $dist"
    cp -r "$PREBUILT_PACKAGE_PATH/executable" $dist/executable
    cp -r "$PREBUILT_PACKAGE_PATH/tools" $dist/tools
}

extract_xcalbuild() {
  if [[ -f "$PREBUILT_PACKAGE_PATH/xcalbuild-mac.tgz" ]]; then
      target_path="$dist/executable/xcalbuild"
      echo "Found xcalbuild-mac.tgz in $PREBUILT_PACKAGE_PATH, extracting..."
      mkdir -p $target_path
      tar zxvf "$PREBUILT_PACKAGE_PATH/xcalbuild-mac.tgz" --directory $target_path
  fi
}

# os detection
if [[ $target == "mac" ]]; then
    echo "Building in MacOS, prepare dependencies yourself"
    echo "Building controller in nexe..."
    build_controller mac

    if [[ "$OS" =~ "Darwin" ]]; then
      echo "Patching subphases for MacOS"
      build_py_subphases
      copy_files_from_build_results
    else
      echo "Not a OSX system, copy prebuilt files, make sure those prebuilt files are updated"
      copy_files_from_prebuilt_for_mac
    fi

    echo "Xcalbuild will be handled in Jenkins pipeline"
#   extract_xcalbuild
else
    # dependencies preparation
    sh $PROJECT_ROOT/build/install-deps.sh #already run while docker image is built
    build_controller
    build_py_subphases static
    copy_files_from_build_results
fi

copy_cppcheck_suppression_file

if [[ -n $NO_INSTALL ]]; then
  copy_configs
fi


echo "Changing execution permissions"
chmod -R +x *

# todo build xcalbuild
# temp - put prebuilt xcalbuild to package
copy_xcalbuild() {
    cp -f $PROJECT_ROOT/build/prebuilt/xcalbuild.zip $dist/executable/xcalbuild.zip
    unzip $dist/executable/xcalbuild.zip -d $dist/executable && rm $dist/executable/xcalbuild.zip

    echo "finish copying prebuilt xcalbuild package"
}

zip_client() {
    # packaging with zip
    ziptarget="xcalclient-$(date +"%Y-%m-%d").zip"
    cp -R $dist ./xcalclient
    zip -r $ziptarget ./xcalclient
    mv $ziptarget ./dist
    rm -rf ./xcalclient
}

#disable xcalbuild and zip package for now

#copy_xcalbuild
#zip_client

# clean up
#./cleanup.sh
end=$(date +%s)

runtime=$(echo "$end - $start" | bc -l)

echo "Finish building subphases and tools in $runtime seconds"

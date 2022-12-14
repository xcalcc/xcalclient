#!/usr/bin/env bash
USE_STATIC=0
while [[ "$#" -gt 0 ]]; do
    case $1 in
    -s | --static)
        USE_STATIC=1
        ;;
    esac
    shift
done
rm -rf ./dist
mkdir -p ./dist
echo "......Generating dependency file......"
#pipreqs . --force --use-local
echo "......Installing dependencies......"
pip3 install -r requirements.txt
echo "......Generate static xcal-trigger Package File(Linux)......"
pyinstaller --clean -F xcal-trigger.py --distpath ./tmp --collect-submodule "Crypto.Cipher" --collect-submodule "Crypto.Random" --add-data "./ver:." --add-data "../common:./common"

if [[ $USE_STATIC == 1 ]]; then
    echo "Starting static operation..."
    if ! command -v staticx &>/dev/null; then
        echo "staticx could not be found, copy directly to dist"
        mv ./tmp/xcal-trigger ./dist/xcal-trigger
    else
        staticx ./tmp/xcal-trigger ./dist/xcal-trigger
    fi
else
    mv ./tmp/xcal-trigger ./dist/xcal-trigger
fi

echo "Changing dist folder permissions"
chmod -R 755 ./dist

echo "......clean up......"
rm ./*.spec
rm -rf ./tmp
rm -rf ./build
rm -rf ./__pycache__
echo "......Generate static xcal-trigger Package Finished......"

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

rm -rf ./tmp
rm -rf ./dist
mkdir -p ./tmp
mkdir -p ./dist
echo "......Generating dependency file......"
#pipreqs . --force --use-local
echo "......Installing dependencies......"
pip3 install -r requirements.txt
echo "......Generate packager Package File(Linux)......"
pyinstaller -F packager.py -s --distpath ./tmp -p ../common/ -p "../" -p "../../" --add-data "../../xcal_common/errorMessage.json:./xcal_common" --add-data "./ver:."

if [[ $USE_STATIC == 1 ]]; then
    echo "Starting static operation..."
    if ! command -v staticx &>/dev/null; then
        echo "staticx could not be found, copy directly to dist"
        mv ./tmp/packager ./dist/packager
    else
        staticx ./tmp/packager ./dist/packager
    fi
else
    mv ./tmp/packager ./dist/packager
fi

echo "......Delete tmp folder......"
rm -rf ./tmp
rm -rf ./build
echo "......Generate static packager Package Finished......"

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
# minio is in a module which might be in conditioning import, which did not write into requirements.txt
pip3 install minio psutil
echo "......Generate buildTask Package File(Linux)......"
pyinstaller --clean -F buildtask.py --distpath ./tmp -p "../" -p "../../" --add-data "../../xcal_common/errorMessage.json:./xcal_common" --add-data "./ver:."

if [[ $USE_STATIC == 1 ]]; then
    echo "Starting static operation..."
    if ! command -v staticx &>/dev/null; then
        echo "staticx could not be found, copy directly to dist"
        mv ./tmp/buildtask ./dist/buildtask
    else
        staticx ./tmp/buildtask ./dist/buildtask
    fi
else
    mv ./tmp/buildtask ./dist/buildtask
fi

echo "Changing dist folder permissions"
chmod -R 755 ./dist

echo "......Delete buildTask tmp folder......"
rm -rf ./tmp
rm -rf ./build
rm -rf ./__pycache__
echo "......Generate static buildTask Package Finished......"
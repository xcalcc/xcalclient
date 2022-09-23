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

command rm -rf ./tmp
command rm -rf ./dist
command mkdir -p ./tmp
command mkdir -p ./dist
echo "......Generating dependency file......"
#command pipreqs . --force --use-local
echo "......Installing dependencies......"
command pip3 install -r requirements.txt
echo "......Generate gather-logs Package File(Linux)......"
command pyinstaller --clean -F gather-logs.py --distpath ./tmp

if [[ $USE_STATIC == 1 ]]; then
    echo "Starting static operation..."
    if ! command -v staticx &>/dev/null; then
        echo "staticx could not be found, copy directly to dist"
        mv ./tmp/gather-logs ./dist/gather-logs
    else
        staticx ./tmp/gather-logs ./dist/gather-logs
    fi
else
    mv ./tmp/gather-logs ./dist/gather-logs
fi

echo "......clean up......"
command rm -rf ./tmp
command rm -rf ./build
echo "......Generate static gather-logs Package Finished......"

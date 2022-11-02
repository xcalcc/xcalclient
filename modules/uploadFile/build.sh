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
cp -r ./*.py ./tmp
echo "......Generating dependency file......"
#pipreqs . --force --use-local
echo "......Installing dependencies......"
pip3 install -r requirements.txt
echo "......Generate static uploadFile Package File(Linux)......"
pyinstaller --clean -F uploadfile.py --distpath ./tmp -p "../" -p "../../" --add-data "../../xcal_common/errorMessage.json:./xcal_common" --add-data "./ver:."

if [[ $USE_STATIC == 1 ]]; then
    echo "Starting static operation..."
    if ! command -v staticx &>/dev/null; then
        echo "staticx could not be found, copy directly to dist"
        mv ./tmp/uploadfile ./dist/uploadfile
    else
        staticx ./tmp/uploadfile ./dist/uploadfile
    fi
else
    mv ./tmp/uploadfile ./dist/uploadfile
fi

echo "Changing dist folder permissions"
chmod -R 755 ./dist

echo "......Delete scm tmp folder......"
rm -rf ./tmp
rm -rf ./build
rm -rf ./__pycache__
echo "......Generate static scm Package Finished......"
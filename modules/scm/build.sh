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
echo "......Generate scm Package File(Linux)......"
pyinstaller -F scmSubPhase.py --distpath ./tmp -p ../common/ --hidden-import=psutil --hidden-import=cffi -p "../" -p "../../" --add-data "../../xcal_common/errorMessage.json:./xcal_common" --add-data "./ver:."

if [[ $USE_STATIC == 1 ]]; then
    echo "Starting static operation..."
    if ! command -v staticx &>/dev/null; then
        echo "staticx could not be found, copy directly to dist"
        mv ./tmp/scmSubPhase ./dist/scm
    else
        staticx ./tmp/scmSubPhase ./dist/scm
    fi
else
    mv ./tmp/scmSubPhase ./dist/scm
fi

echo "Changing dist folder permissions"
chmod -R 755 ./dist

#pyinstaller -F spGetCommitId.py --distpath ./tmp --hidden-import=psutil --hidden-import=cffi -s -p ../common && staticx ./tmp/spGetCommitId ./dist/spGetCommitId --strip
#pyinstaller -F spGetScmDiff.py --distpath ./tmp --hidden-import=psutil --hidden-import=cffi -s -p ../common && staticx ./tmp/spGetScmDiff ./dist/spGetScmDiff --strip
#pyinstaller -F spGetSourceCode.py --distpath ./tmp --hidden-import=psutil --hidden-import=cffi -s -p ../common && staticx ./tmp/spGetSourceCode ./dist/spGetSourceCode --strip
echo "......Delete scm Spec File......"
rm -rf ./tmp
rm -rf ./build
rm -rf ./__pycache__
echo "......Generate static scm Package Finished......"

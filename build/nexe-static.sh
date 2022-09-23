#!/usr/bin/env bash
# https://github.com/nexe/nexe/issues/938
# https://www.npmjs.com/package/node-musl
# https://github.com/mysticatea/cpx/issues/24
# build static linked version can be run across linux
# if you want all executables packed in, add -r "executable/**"
time npx --package=node-musl musl-env npx nexe --build --configure=--fully-static --make=-j$(node -p 'os.cpus().length') --verbose index.js -o ./dist/nexe/client -r "build-info" -t "linux-14.17.6"
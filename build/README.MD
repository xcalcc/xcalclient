# Xcalclient build #
Xcalclient includes 3 parts of different components
1. Controller - javascript/ES6 (node.js)
2. Subphases - python3 (^3.6)
3. Xcalbuild - c++

We build each component statically to avoid os diversity (for linux)

## Quick build by one command ##

---
Install the prerequisites then start building the whole client in one command
(You still need to install ```node v14```, ```python 3.6```, ```npm```, ```pip```, ```yarn``` beforehand).
```shell
$ yarn build
```
Build for mac
```shell
$ yarn build mac
```

## Separated builds ##
### Build controller (Nodejs/Nexe) ###

---
Controller is using nexe to compile nodejs and packaging all js files into
one executable file. When it runs ```nexe-static.sh```, it's actually using
**node-musl** to make bundled node.js is static linked.

```shell
$yarn nexe
```


### Build subphases (python) ###

---
If you want a single build for a particular subphase, go to ./modules/{module name} and run ```$>./build.sh``` it will create the executable under ```./modules/{module name}/dist```.


## Build xcalbuild package ##

---
Refer to the readme from xcalbuild.

## Build using docker ##

---
Make sure you have the docker image ```hub.xcalibyte.co/sdlc/xcalclientbuilder:latest```.
Run below command:
```shell
$docker run --rm -v $(pwd):/home:Z -w /home hub.xcalibyte.co/sdlc/xcalclientbuilder:latest yarn && yarn build
```
The pre-built docker image has already installed all build dependencies. 

## Jenkins integration ##

---
[Internal jenkins](http://127.0.0.1:8088/view/xcalclient/job/xcalclient_dev) has already used the CI.Jenkins file
for pipeline build.
Some environment parameters:
- NEXUS_REPO_USER: defined the username to upload artifacts to Nexus server
- NEXUS_REPO_PSW: defined the password to upload artifacts to Nexus server

Other environment parameters:
- AGENT: jenkins agent name
- XCALBUILD_NEXUS_REPO_ADDRESS: where to pull the xcalbuild artifacts
- XCALCLIENT_NEXUS_REPO_ADDRESS: Nexus server 1
- XCALCLIENT_NEXUS_REPO_ADDRESS2: Nexus server 2

Pre-run script:
```shell
$chmod +x -R ${env.WORKSPACE}
```

## FAQ ##

---

> Q: What if xcalclient building failed? \
  A: Check the pipeline chart, it will show you it fails in which step, check the corresponding logs.

> Q: What if xcalbuild building failed?\
  A: You won't get the latest xcalbuild artifact updated, xcalclient will use latest xcalbuild artifact.

> Q: How can you guarantee xcalclient is using the latest xcalbuild? \
  A: Nexus has a searching API to search for the latest artifact of a particular repo.

> Q: How can I manually start a client build?\
  A: Click ```Build with Parameters``` on left manu on job page

> Q: How to find the artifacts?\
  A: Nexus repo SZ: [http://127.0.0.1:8081/#browse/browse:xcalclient](http://127.0.0.1:8081/#browse/browse:xcalclient),\
     Nexus repo SH: [http://127.0.0.1:8081/#browse/browse:xcalclient](http://127.0.0.1:8081/#browse/browse:xcalclient)
## What's in the recipe ##
### Pre-downloaded libraries and softwares ###

---
- musl-libc: ( an implementation of the standard library functionality described in the ISO C and POSIX standards, plus common extensions, built on top of the Linux system calls API.)
- Node v14: (static nodejs)
- staticx: (Bundle dynamic executables with their library dependencies so they can be run anywhere, just like a static executable.)


---
Python
- python ^3.6
- pip3
- pyinstaller: (PyInstaller bundles a Python application and all its dependencies into a single package.)
- patchelf: (patchelf is a small utility to modify the dynamic linker and RPATH of ELF executables.)
- pipreqs: (Pip requirements.txt generator based on imports in project)
- scons: (SCons is a computer software build tool that automatically analyzes source code file dependencies and operating system adaptation requirements from a software project description and generates final binary executables for installation on the target operating system platform. )

Javascript
- npm/yarn: (package management)
- nexe: (one executable bundle for nodejs)

## Reference ##
[https://staticx.readthedocs.io/en/latest/installation.html](https://staticx.readthedocs.io/en/latest/installation.html)

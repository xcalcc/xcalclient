#!/usr/bin/env bash
STATIC_PACKAGE_PATH="$(pwd)/source"

if [ -f "$STATIC_PACKAGE_PATH" ]; then
  echo "$STATIC_PACKAGE_PATH found"
else
  STATIC_PACKAGE_PATH="$(pwd)/build/source"
  echo "change static package path to: $STATIC_PACKAGE_PATH"
fi

STATICX_PATH="$STATIC_PACKAGE_PATH/staticx-master.zip"
MUSL_PATH="$STATIC_PACKAGE_PATH/musl-1.2.2.tar.gz"

echo ">>> Please ensure you have installed nodejs>14/npm and python3/pip in your system <<<"
echo "\r"
# Install patchelf
echo "Start build dependencies preparation"
echo "installing patchelf"
echo "* PatchELF is a simple utility for modifying existing ELF executables and libraries. In particular, it can do the following, Change the dynamic loader ("ELF interpreter") of executables. Change the RPATH of executables and libraries. Shrink the RPATH of executables and libraries."
pip3 install patchelf-wrapper

# Install SCons
echo "installing SCons"
echo "* SCons is a computer software build tool that automatically analyzes source code file dependencies and operating system adaptation requirements from a software project description and generates final binary executables for installation on the target operating system platform."
pip3 install scons

# Install musl-libc
[ -d "$(pwd)/musl-1.2.2" ] && rm -rf "./musl-1.2.2"
if [ ! -f "/usr/local/musl/bin/musl-gcc" ]; then
  echo "installing musl-libc"
  echo "* musl is a C standard library implementation for Linux. Some of musl’s major advantages over glibc and uClibc/uClibc-ng are its size, correctness, static linking support, and clean code."
  echo "* musl is an implementation of the C standard library built on top of the Linux system call API, including interfaces defined in the base language standard, POSIX, and widely agreed-upon extensions. musl is lightweight, fast, simple, free, and strives to be correct in the sense of standards-conformance and safety."
  echo "unzip musl"
  tar -xzvf $MUSL_PATH
  cd "./musl-1.2.2" && ./configure && make && sudo make install && cd -
else
  echo "\n...musl-libc has been installed, skip musl-1.2.2 installation\n"
fi

# Install Pyinstaller
pip3 install pyinstaller

# build the staticx bootloader, resulting in smaller, better binaries
BOOTLOADER_CC=/usr/local/musl/bin/musl-gcc pip3 install $STATICX_PATH

echo "Preparation for building dependencies finished!"
echo "- patchelf"
echo "- scons"
echo "- musl-libc"

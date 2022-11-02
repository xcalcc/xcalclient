FROM ubuntu:20.04

ENV WORK_DIR="/home"

RUN apt-get update
    # zlib1g-dev is required for pyinstaller
RUN apt-get install -y apt-utils git curl gcc zlib1g-dev python3 python3-pip bc  && \
    curl -sL https://deb.nodesource.com/setup_14.x |  bash -  && \
    apt-get install nodejs
RUN npm install --global yarn nexe

RUN pip3 install patchelf-wrapper
RUN pip3 install scons
RUN pip3 install staticx
RUN pip3 install pipreqs
RUN pip3 install cffi
RUN pip3 install pycryptodome
RUN pip3 install crypto
RUN pip3 install pycrypto
RUN pip3 install pyinstaller==4.7

# https://segmentfault.com/a/1190000039335378
RUN mv /usr/local/lib/python3.8/dist-packages/crypto /usr/local/lib/python3.8/dist-packages/Crypto

WORKDIR $WORK_DIR
RUN mkdir -p build/source
COPY ./package*.json ./build/install-deps.sh $WORK_DIR/
COPY ./build/source/*  $WORK_DIR/build/source/

# RUN yarn
RUN sh -c "./install-deps.sh"
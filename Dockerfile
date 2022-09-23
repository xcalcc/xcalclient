FROM ubuntu:18.04

ENV WORK_DIR="/home"

RUN apt update
    # zlib1g-dev is required for pyinstaller
RUN apt install -y git curl gcc zlib1g-dev python python-pip python3.6 python3-pip bc  && \
    curl -sL https://deb.nodesource.com/setup_14.x |  bash -  && \
    apt install nodejs
RUN npm install --global yarn nexe

RUN pip3 install patchelf-wrapper
RUN pip3 install scons
RUN pip3 install staticx
RUN pip3 install pipreqs
RUN pip3 install cffi
RUN pip3 install pyinstaller==4.7

WORKDIR $WORK_DIR
COPY ./package*.json ./build/source ./build/install-deps.sh $WORK_DIR

RUN yarn
RUN bash ./install-deps.sh



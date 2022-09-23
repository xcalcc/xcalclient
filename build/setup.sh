#!/bin/bash

# ---------------------------------------------------------------------
#          Xcalscan Client Installation Script
# ---------------------------------------------------------------------

COMPANY="xcalibyte"
PRODUCT=xcalclient
PRODUCT_NAME="xcalclient"
PRODUCT_VERSION=""
NETWORK_SUFFIX="$(echo $PRODUCT_VERSION | tr "." "_")"
PRODUCT_FILE_NAME=${COMPANY}-${PRODUCT}-${PRODUCT_VERSION}
PRODUCT_INSTALLER_TARBALL=${PRODUCT_FILE_NAME}-installer.tar
PRODUCT_TARBALL=${PRODUCT_FILE_NAME}.tar
PRODUCT_INSTALL_ROOT=${COMPANY}-${PRODUCT}/${PRODUCT_VERSION}
DEFAULT_INSTALL_PREFIX=$(pwd)
INSTALL_PREFIX=""
CMD_PREFIX=""
KERNEL_NAME=""
OS_ID=""
LOG_FILE="${DEFAULT_INSTALL_PREFIX}/xcal_install.log"

CONFIG_FILE=".xcalsetting"
TEMPLATE_FILE=".template_xcalsetting"
WARN="[Warning]:"
ERR="[Error]:"
INFO="[Info]:"

IS_CONFIGURATION_CONFIRMED=""
DB_PW="Default_Password"

EXISTINGVERS="no"
VOLUME_NAME="_redisdata"
if_use="no"
if_match=""
converted_product_version=""
REUSE_DATA=""
user_home=""
re='^(0*(1?[0-9]{1,2}|2([0-4][0-9]|5[0-5]))\.){3}'

API_URL="apiServer"
RULE_URL="ruleServiceUrl"
USER="user"
PWD="psw"
MINIO_URL="fileServiceUrl"
SSE_URL="sseServer"
QUEUE_TIMEOUT="queueTimeout"
server_url=""
DF_SERVER_PORT="80"
DF_MINIO_PORT="9000"
DF_QUEUE_TIMEOUT="7200"
DF_SSE_PORT="4004"
EMPTY_MESSAGE="Cannot input empty, please enter again."


# --------------------------------------------------------------------- #
# Logger
# --------------------------------------------------------------------- #
logger() {
  lv=$1
  msg=$2

  echo "${lv} ${msg}"
  echo "${lv} ${msg}" >>${LOG_FILE}
}

logger_without_prompt() {
  lv=$1
  msg=$2

  echo "${lv} ${msg}" >>${LOG_FILE}
}

start_banner() {
  logger ${INFO} "Installing ${PRODUCT_NAME} into your system..."
}

# --------------------------------------------------------------------- #
#  User define configuration
# --------------------------------------------------------------------- #
configure() {
  # get installation prefix
  INSTALL_PREFIX=${DEFAULT_INSTALL_PREFIX}


  while "true"; do
    read -rp "${INFO} Please input Xcalscan ip address: " server_ip
    if [ "${server_ip}"x = ""x ]; then
      logger ${ERR} "${EMPTY_MESSAGE}"
      server_ip=""
    elif [[ (${server_ip} =~ ^[a-zA-Z]) ]]; then
      break
    elif [[ !(${server_ip} =~ $re) ]]; then
      logger ${ERR} "The value entered is invalid, please re-enter."
      server_ip=""
    else
      break
    fi
  done

  while "true"; do
    read -rp "${INFO} Please enter the Port of Xcalscan server.(e.g.: ${DF_SERVER_PORT}) : " server_port
    if [ -z "${server_port}" ]; then
      env_substitute ${API_URL} "http:\/\/"${server_ip}":"${DF_SERVER_PORT}
      env_substitute ${RULE_URL} "http:\/\/"${server_ip}":"${DF_SERVER_PORT}
      break
    elif [ -z "$(echo ${server_port}| sed -n "/^[0-9]\+$/p")" ]; then
      logger ${ERR} "The value entered is invalid, please re-enter."
      server_port=""
    else
      env_substitute ${API_URL} "http:\/\/"${server_ip}":"${server_port}
      env_substitute ${RULE_URL} "http:\/\/"${server_ip}":"${server_port}
      break
    fi
  done

  while "true"; do
    read -rp "${INFO} Please enter the username of Xcalscan. : " user_name
    if [ "${user_name}"x = ""x ]; then
      logger ${ERR} "${EMPTY_MESSAGE}"
      user_name=""
    else
      env_substitute ${USER} ${user_name}
      break
    fi
  done

  while "true"; do
    while "true"; do
      unset user_pwd
      prompt="${INFO} Please enter the password of ${user_name}. : "
      while IFS= read -p "$prompt" -r -s -n 1 char
      do
          if [[ $char == $'\0' ]]; then
              break
          elif [ $char == $'\x08' ] && [ $counter -gt 0 ]; then
              prompt=$'\b \b'
              user_pwd="${user_pwd%?}"
              counter=$((counter-1))
          elif [ $char == $'\x08' ] && [ $counter -lt 1 ]; then
              prompt="${INFO} Please enter the password of ${user_name}. : "
              continue
          else
              counter=$((counter+1))
              prompt='*'
              user_pwd+="$char"
          fi
      done
      echo

      if [ "${user_pwd}"x = ""x ]; then
        logger ${ERR} "${EMPTY_MESSAGE}"
        user_pwd=""
      else
        break
      fi
    done

    while "true"; do
      unset user_pwd2
        prompt="${INFO} Please re enter the password of ${user_name}. : "
        while IFS= read -p "$prompt" -r -s -n 1 char
        do
            if [[ $char == $'\0' ]]; then
                break
            elif [ $char == $'\x08' ] && [ $counter -gt 0 ]; then
                prompt=$'\b \b'
                user_pwd2="${user_pwd2%?}"
                counter=$((counter-1))
            elif [ $char == $'\x08' ] && [ $counter -lt 1 ]; then
                prompt="${INFO} Please re enter the password of ${user_name}. : "
                continue
            else
                counter=$((counter+1))
                prompt='*'
                user_pwd2+="$char"
            fi
        done
        echo
        if [ "${user_pwd2}"x = ""x ]; then
          logger ${ERR} "${EMPTY_MESSAGE}"
          user_pwd2=""
        else
          break
        fi
    done

    if [ "${user_pwd}"x = "${user_pwd2}"x ]; then
      env_substitute ${PWD} "${user_pwd}"
      break
    else
      logger ${ERR} "Password is different, please re-enter."
    fi
  done

  while "true"; do
    read -rp "${INFO} Please enter the Port of File service.(e.g.: ${DF_MINIO_PORT}) : " minio_port
    if [ "${minio_port}"x = ""x ]; then
      env_substitute ${MINIO_URL} "http:\/\/"${server_ip}":"${DF_MINIO_PORT}
      break
    elif [ -z "$(echo ${minio_port}| sed -n "/^[0-9]\+$/p")" ];then
      logger ${ERR} "The value entered is invalid, please re-enter."
      minio_port=""
    else
      env_substitute ${MINIO_URL} "http:\/\/"${server_ip}":"${minio_port}
      break
    fi
  done

  while "true"; do
    read -rp "${INFO} Please enter the Port of sse service.(e.g.: ${DF_SSE_PORT}) : " sse_port
    if [ "${sse_port}"x = ""x ]; then
      env_substitute ${SSE_URL} "http:\/\/"${server_ip}":"${DF_SSE_PORT}
      break
    elif [ -z "$(echo ${sse_port}| sed -n "/^[0-9]\+$/p")" ];then
      logger ${ERR} "The value entered is invalid, please re-enter."
      sse_port=""
    else
      env_substitute ${SSE_URL} "http:\/\/"${server_ip}":"${sse_port}
      break
    fi
  done

  while "true"; do
    read -rp "${INFO} Please enter the maximam waiting time (in seconds) for previous scan task. (e.g. ${DF_QUEUE_TIMEOUT}): " queue_time
    if [ "${queue_time}"x = ""x ]; then
      env_substitute ${QUEUE_TIMEOUT} ${DF_QUEUE_TIMEOUT}
      break
    elif [ -z "$(echo ${queue_time}| sed -n "/^[0-9]\+$/p")" ];then
      logger ${ERR} "The value entered is invalid, please re-enter."
      queue_time=""
    else
      env_substitute ${QUEUE_TIMEOUT} ${queue_time}
      break
    fi
  done
}

end_banner() {
  logger ${INFO} "Installing ${PRODUCT_NAME}:${PRODUCT_VERSION} into your system...ok"
  exit 0
}

prepare_config() {
  user_home=$(echo $HOME)
  cp -rf "${INSTALL_PREFIX}${TEMPLATE_FILE}" "${INSTALL_PREFIX}${CONFIG_FILE}"

}

# --------------------------------------------------------------------- #
#  Environment variable substitution
# --------------------------------------------------------------------- #
env_substitute() {
  var_name=$1
  var_value=$2
  if [ ! -z "$(cat ${INSTALL_PREFIX}/${TEMPLATE_FILE} | grep ${var_name})" ]; then
    logger ${INFO} "Updating env variable ${var_name}."
    sed -i "s/\"${var_name}\":\".*$/\"${var_name}\":\"${var_value}\"/"  "${INSTALL_PREFIX}/${CONFIG_FILE}"
  fi
}


install() {
  start_banner
  prepare_config
  configure
  end_banner
}

install
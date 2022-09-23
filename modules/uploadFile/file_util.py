#
#  Copyright (C) 2021 Xcalibyte (Shenzhen) Limited.
#
import logging
import os
import time
from datetime import datetime

import certifi
import urllib3
from minio import Minio
from minio.commonconfig import ENABLED, Filter, Tags
from minio.error import MinioException
from minio.lifecycleconfig import LifecycleConfig, Rule, Expiration
from xcal_common.py.error import EAccessFileServiceFailed, EUploadFileFailed, EPrepareBucketFailed

logger = logging.getLogger(__name__)

# Below info will be used in policy later
FILE_SERVICE_ACCESS_KEY = os.getenv("FILE_SERVICE_ACCESS_KEY", "AdminFileService")
FILE_SERVICE_SECRET_KEY = os.getenv("FILE_SERVICE_SECRET_KEY", "AdminFileService")
EXPIRED_DAY = os.getenv("EXPIRED_DAY", 7)
PREPROCESS_DATA_BUCKET_NAME = os.getenv("PREPROCESS_DATA_BUCKET_NAME", "preprocess-data")
OBJECT_TAGS_KEY = os.getenv("OBJECT_TAGS_KEY", "source")
OBJECT_TAGS_VALUE = os.getenv("OBJECT_TAGS_VALUE", "client")


def get_client(url: str, access_key: str = FILE_SERVICE_ACCESS_KEY, secret_key: str = FILE_SERVICE_SECRET_KEY):
    logger.info("get file service client")

    urllib3.PoolManager.BACKOFF_MAX = 10
    http_client = urllib3.PoolManager(
        timeout = 30,
        cert_reqs = 'CERT_REQUIRED',
        ca_certs = certifi.where(),
        retries = urllib3.Retry(
            total = 3,
            backoff_factor = 10,
            status_forcelist = [500, 502, 503, 504]
        )
    )

    url = url.replace("http://", "")
    logger.debug("file server url: %s, access_key: %s, secret_key: %s" % (url, access_key, secret_key))

    try:
        client = Minio(url, access_key = access_key, secret_key = secret_key, secure = False, http_client = http_client)
    except MinioException as err:
        logger.exception(err)
        raise EAccessFileServiceFailed
    return client


class FileUtil(object):
    def __init__(self, client):
        self.client = client

    @staticmethod
    def get_tags():
        tags = Tags.new_object_tags()
        tags[OBJECT_TAGS_KEY] = OBJECT_TAGS_VALUE
        return tags

    def create_bucket(self, bucket_name):
        logger.debug("create %s bucket in file service" % bucket_name)
        config = LifecycleConfig(
            [
                Rule(
                    ENABLED,
                    rule_filter = Filter(tag = FileUtil.get_tags()),
                    rule_id = "rule1",
                    expiration = Expiration(days = int(EXPIRED_DAY)),
                ),
            ],
        )
        if not self.client.bucket_exists(bucket_name):
            try:
                self.client.make_bucket(bucket_name)
                self.client.set_bucket_lifecycle(bucket_name, config)
            except MinioException as err:
                logger.exception(err)
                raise EPrepareBucketFailed

    def upload_file(self, bucket_name, object_name, file_path):
        try:
            logger.info("File Upload - File : %s, Start Time : %s ." % (file_path, datetime.fromtimestamp(time.time()).strftime("%Y-%m-%d %H:%M:%S")))
            self.client.fput_object(bucket_name, object_name, file_path, tags = FileUtil.get_tags())
            logger.info("File Upload - File : %s, End Time : %s ." % (file_path, datetime.fromtimestamp(time.time()).strftime("%Y-%m-%d %H:%M:%S")))
        except MinioException as err:
            logger.exception(err)
            raise EUploadFileFailed



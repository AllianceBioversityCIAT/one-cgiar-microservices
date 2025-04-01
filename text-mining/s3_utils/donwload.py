import os
import boto3
import logging
from common.config import S3

logger = logging.getLogger(__name__)

s3_client = boto3.client(
    's3',
    aws_access_key_id=S3["aws_access_key"],
    aws_secret_access_key=S3["aws_secret_key"],
    region_name=S3["aws_region"]
)


def download_document(bucket, key):
    """
    Downloads the file from S3 and saves it to /tmp.
    Returns the local path of the downloaded file.
    """
    logger.info(f"Downloading file from S3: bucket={bucket}, key={key}")
    local_filename = str(BASE_DIR / "text-mining" / "data" / "file")

    try:
        s3_client.download_file(bucket, key, local_filename)
        logger.info(f"Successfully downloaded file to {local_filename}")
    except Exception as e:
        logger.error(f"Failed to download file from S3: {str(e)}")
        raise

    return local_filename

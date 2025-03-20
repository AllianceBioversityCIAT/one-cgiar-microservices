import boto3
from pathlib import Path
from src.utils.config.config_util import S3
from src.utils.logger.logger_util import get_logger

logger = get_logger()

s3_client = boto3.client(
    's3',
    aws_access_key_id=S3['aws_access_key'],
    aws_secret_access_key=S3['aws_secret_key'],
    region_name=S3['aws_region']
)

BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent

def download_document_s3(bucket, key):
    logger.info(f"Downloading document from S3: {bucket}/{key}")
    local_filename = str(BASE_DIR / "data" / "files" / key)
    print(local_filename)
    
    try:
        s3_client.download_file(bucket, key, local_filename)
        logger.info(f"Downloaded document from S3: {bucket}/{key}")
    except Exception as e:
        logger.error(f"Error downloading document from S3: {bucket}/{key}. \n {e}")
        raise

    return local_filename
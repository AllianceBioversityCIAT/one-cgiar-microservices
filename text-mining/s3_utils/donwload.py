import os
import boto3
from common.config import S3

s3_client = boto3.client(
    's3',
    aws_access_key_id=S3["aws_access_key"],
    aws_secret_access_key=S3["aws_secret_key"],
    region_name=S3["aws_region"]
)


def download_document(bucket, key):
    """
    Descarga el archivo desde S3 y lo guarda en /tmp.
    Retorna la ruta local del archivo descargado.
    """
    local_filename = f"/tmp/{os.path.basename(key)}"
    s3_client.download_file(bucket, key, local_filename)
    return local_filename

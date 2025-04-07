import docx
import boto3
import pandas as pd
from io import BytesIO
from PyPDF2 import PdfReader
from app.utils.config.config_util import S3
from app.utils.logger.logger_util import get_logger

logger = get_logger()

s3_client = boto3.client(
    's3',
    aws_access_key_id=S3['aws_access_key'],
    aws_secret_access_key=S3['aws_secret_key'],
    region_name=S3['aws_region']
)

def read_document_from_s3(bucket_name, file_key):
    print(
        f"📂 Descargando el archivo {file_key} desde el bucket {bucket_name}...")
    response = s3_client.get_object(Bucket=bucket_name, Key=file_key)
    file_content = response['Body'].read()
    file_extension = file_key.lower().split('.')[-1]

    if file_extension == 'pdf':
        print("📄 Procesando archivo PDF...")
        pdf_reader = PdfReader(BytesIO(file_content))
        text = "".join(page.extract_text() + "\n" for page in pdf_reader.pages)
        return text
    elif file_extension == 'docx':
        print("📄 Procesando archivo DOCX...")
        doc = docx.Document(BytesIO(file_content))
        text = "".join(para.text + "\n" for para in doc.paragraphs)
        return text
    elif file_extension == 'txt':
        print("📄 Procesando archivo TXT...")
        return file_content.decode('utf-8')
    elif file_extension in ('xls', 'xlsx'):
        print("📄 Procesando archivo Excel...")
        df = pd.read_excel(BytesIO(file_content))
        return df.to_string()
    else:
        raise ValueError(f"Formato de archivo no soportado: {file_extension}")
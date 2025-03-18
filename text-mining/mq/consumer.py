import os
import json
import pika
import fitz
import mimetypes
import logging
import PyMuPDF as fitz 
from common.config import RABBITMQ
from urllib.parse import quote
from s3_utils.donwload import download_document
from prompt.default_prompt import DEFAULT_PROMPT
from clarisa.clarisa_service import ClarisaService
from llm.vectorize import process_document_in_directory
from llm.mining import generate_response

logger = logging.getLogger(__name__)


def get_rabbitmq_connection():
    try:
        encoded_password = RABBITMQ["password"]
        url = f"{RABBITMQ['protocol']}://{RABBITMQ['username']}:{encoded_password}@{RABBITMQ['host']}:{RABBITMQ['port']}"
        logger.debug(
            f"Connecting to RabbitMQ at {RABBITMQ['host']}:{RABBITMQ['port']}")
        params = pika.URLParameters(url)
        connection = pika.BlockingConnection(params)
        logger.info("Successfully connected to RabbitMQ")
        return connection
    except Exception as e:
        logger.error(f"Failed to connect to RabbitMQ: {str(e)}")
        raise


def read_text(file_path, fallback=False):
    """Read text file with different encodings if needed"""
    encodings = ['utf-8', 'latin-1', 'iso-8859-1', 'cp1252']

    if not fallback:
        encodings = [encodings[0]]

    for encoding in encodings:
        try:
            logger.debug(f"Attempting to read with {encoding} encoding")
            with open(file_path, 'r', encoding=encoding) as f:
                content = f.read()
            logger.info(f"Successfully read file with {encoding} encoding")
            return content
        except UnicodeDecodeError:
            if encoding == encodings[-1]:
                logger.error(f"Failed to read file with any encoding")
                raise
            logger.warning(
                f"Failed to read with {encoding} encoding, trying next")


def callback(ch, method, properties, body):
    local_file = None
    key_value = None

    try:
        message = json.loads(body.decode())
        key_value = message.get("key")
        bucket_name = message.get("bucketName")
        credentials_json = message.get("credentials")
        credentials = json.loads(credentials_json) if credentials_json else {}
        client_mis = credentials.get("username")
        client_secret = credentials.get("password")
        prompt = message.get("prompt", DEFAULT_PROMPT)

        logger.info(f"Processing message for document: {key_value}")

        # clarisa_service = ClarisaService()
        # authorized, auth_data = clarisa_service.authorize_client(
        #     client_mis, client_secret)
        # if not authorized:
        #     logger.error(f"Unauthorized client: {client_mis}")
        #     raise Exception("Client is not authorized via Clarisa")

        # logger.info(f"Authorized client: {client_mis}")


        # document_text = read_document(local_file)
        # embedding = vectorize_document(document_text)

        local_file = download_document(bucket_name, key_value)
        local_file_dir = str(Path(local_file).parent)
        vectorize_doc = process_document_in_directory(local_file_dir)
        logger.debug(f"Document vectorized successfully")

        mining = generate_response()

        if properties.reply_to:
            response = {
                "status": "success",
                "key": key_value,
                "extracted_info": mining
            }
            ch.basic_publish(
                exchange='',
                routing_key=properties.reply_to,
                properties=pika.BasicProperties(
                    correlation_id=properties.correlation_id),
                body=json.dumps(response)
            )
            logger.info(f"Response sent to {properties.reply_to}")

    except Exception as e:
        logger.error(f"Error processing message: {str(e)}", exc_info=True)
        if properties.reply_to:
            error_response = {
                "status": "error",
                "key": key_value,
                "error": str(e)
            }
            ch.basic_publish(
                exchange='',
                routing_key=properties.reply_to,
                properties=pika.BasicProperties(
                    correlation_id=properties.correlation_id),
                body=json.dumps(error_response)
            )
            logger.info(f"Error response sent to {properties.reply_to}")
    finally:
        if local_file and os.path.exists(local_file):
            os.remove(local_file)
            logger.info(f"Temporary file removed: {local_file}")


def start_consumer():
    logger.info("Starting RabbitMQ consumer")
    connection = get_rabbitmq_connection()
    channel = connection.channel()
    channel.queue_declare(queue=RABBITMQ["queue"])
    channel.basic_consume(
        queue=RABBITMQ["queue"], on_message_callback=callback, auto_ack=True)
    logger.info(
        f'Waiting for messages on queue {RABBITMQ["queue"]}. Press CTRL+C to exit.')
    channel.start_consuming()

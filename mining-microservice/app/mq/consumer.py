from app.utils.logger.logger_util import logger
from app.utils.config.config_util import RABBITMQ
from app.utils.prompt.default_prompt import DEFAULT_PROMPT
from app.llm.mining import process_document
import json
import pika
import os


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


def callback(ch, method, properties, body):
    local_file = None
    key_value = None

    try:
        message = json.loads(body.decode())
        key_value = message.get("key")
        bucket_name = message.get("bucketName")
        prompt = message.get("prompt", DEFAULT_PROMPT)

        logger.info(f"Processing message for document: {key_value}")

        response = process_document(bucket_name, key_value, prompt)

        if properties.reply_to:
            response = {
                "status": "success",
                "key": key_value,
                "extracted_info": response
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

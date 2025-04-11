from app.utils.logger.logger_util import logger
from app.utils.config.config_util import RABBITMQ, MS_NAME
from app.utils.prompt.default_prompt import DEFAULT_PROMPT
from app.llm.mining import process_document
from app.middleware.auth_middleware import AuthMiddleware
from app.utils.notification.notification_service import NotificationService
import json
import pika
import os
import asyncio

auth_middleware = AuthMiddleware()
notification_service = NotificationService()


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
        logger.debug(f"Received message: {message}")

        authenticated_message = asyncio.run(
            auth_middleware.authenticate(message))

        if not authenticated_message:
            logger.error("Authentication failed, skipping message processing")
            if properties.reply_to:
                error_response = {
                    "status": "error",
                    "key": message.get("key"),
                    "error": "Authentication failed"
                }
                ch.basic_publish(
                    exchange='',
                    routing_key=properties.reply_to,
                    properties=pika.BasicProperties(
                        correlation_id=properties.correlation_id),
                    body=json.dumps(error_response)
                )
            return

        key_value = authenticated_message.get("key")
        bucket_name = authenticated_message.get("bucketName")
        prompt = authenticated_message.get("prompt", DEFAULT_PROMPT)

        user = authenticated_message.get('user', {})
        sender = user.get('sender', {})
        sender_mis = sender.get('sender_mis', {})
        sender_name = sender_mis.get('name', 'unknown')
        sender_env = sender_mis.get('environment', 'unknown')

        logger.info(
            f"Processing authenticated message for document: {key_value} from {sender_name}")

        response = process_document(bucket_name, key_value, prompt)

        if properties.reply_to:
            success_response = {
                "status": "success",
                "key": key_value,
                "extracted_info": response["content"]
            }
            ch.basic_publish(
                exchange='',
                routing_key=properties.reply_to,
                properties=pika.BasicProperties(
                    correlation_id=properties.correlation_id),
                body=json.dumps(success_response)
            )
            logger.info(f"Response sent to {properties.reply_to}")

            try:
                ms_name = MS_NAME
                asyncio.run(notification_service.send_slack_notification(
                    emoji=':ai: :pick:',
                    app_name=ms_name,
                    color='#36a64f',
                    title='Document Processed',
                    message=f"Successfully processed document: *{key_value}*\n" +
                            f"Requested by: *{sender_name}* ({sender_env})\n" +
                            f"Bucket: *{bucket_name}*\n",
                            time_taken=f"Time taken: *{response['time_taken']}* seconds\n",
                            priority='Low'
                            ))
                logger.info(
                    f"Success notification sent for {key_value} processed for {sender_name}")
            except Exception as notify_error:
                logger.error(
                    f"Error sending notification: {str(notify_error)}")

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
            asyncio.run(notification_service.send_slack_notification(
                emoji=':ai: :pick: :alert:',
                app_name=MS_NAME,
                color='#FF0000',
                title='Document Processing Failed',
                message=f"Error processing document: *{key_value}*\n" +
                        f"Requested by: *{sender_name}* ({sender_env})\n" +
                        f"Error: *{str(e)}*\n",
                        time_taken="Time taken: *N/A*\n",
                        priority='High'
                        ))
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

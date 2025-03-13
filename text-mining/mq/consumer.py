import os
import json
import pika
from common.config import RABBITMQ
from urllib.parse import quote
from s3_utils.downloader import download_document
from llm.vectorizer import vectorize_document
from llm.mining import extract_relevant_information
from prompts.default_prompt import DEFAULT_PROMPT


def get_rabbitmq_connection():
    encoded_password = RABBITMQ["password"]
    url = f"{RABBITMQ['protocol']}://{RABBITMQ['username']}:{encoded_password}@{RABBITMQ['host']}:{RABBITMQ['port']}"
    params = pika.URLParameters(url)
    connection = pika.BlockingConnection(params)
    return connection


def callback(ch, method, properties, body):
    local_file = None
    try:
        message = json.loads(body.decode())
        key_value = message.get("key")
        bucket_name = message.get("bucket")
        prompt = message.get("prompt", DEFAULT_PROMPT)

        print(f"Received message: key={key_value}, bucket={bucket_name}")

        local_file = download_document(bucket_name, key_value)
        with open(local_file, "r", encoding="utf-8") as f:
            document_text = f.read()

        embedding = vectorize_document(document_text)
        print("Document vectorized. Embedding:", embedding)

        extracted_info = extract_relevant_information(document_text, prompt)
        print("Extracted information:", extracted_info)

        if properties.reply_to:
            response = {
                "status": "success",
                "key": key_value,
                "extracted_info": extracted_info
            }
            ch.basic_publish(
                exchange='',
                routing_key=properties.reply_to,
                properties=pika.BasicProperties(
                    correlation_id=properties.correlation_id),
                body=json.dumps(response)
            )
            print(f"Response sent to {properties.reply_to}")

    except Exception as e:
        print("Error processing message:", e)
        if properties.reply_to:
            error_response = {
                "status": "error",
                "key": key_value if 'key_value' in locals() else None,
                "error": str(e)
            }
            ch.basic_publish(
                exchange='',
                routing_key=properties.reply_to,
                properties=pika.BasicProperties(
                    correlation_id=properties.correlation_id),
                body=json.dumps(error_response)
            )
    finally:
        if local_file and os.path.exists(local_file):
            os.remove(local_file)
            print(f"Temporary file removed: {local_file}")


def start_consumer():
    connection = get_rabbitmq_connection()
    channel = connection.channel()
    channel.queue_declare(queue=RABBITMQ["queue"])
    channel.basic_consume(
        queue=RABBITMQ["queue"], on_message_callback=callback, auto_ack=True)
    print('Waiting for messages. Press CTRL+C to exit.')
    channel.start_consuming()

import os
import json
import pika
from common.config import RABBITMQ
from urllib.parse import quote
from s3_utils.downloader import download_document
from models.vectorizer import vectorize_document
from models.info_extractor import extract_relevant_information


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
        prompt = message.get("prompt", "Default prompt text")

        print(f"Recibido: key={key_value}, bucket={bucket_name}")

        local_file = download_document(bucket_name, key_value)
        with open(local_file, "r", encoding="utf-8") as f:
            document_text = f.read()

        embedding = vectorize_document(document_text)
        print("Documento vectorizado. Embedding:", embedding)

        extracted_info = extract_relevant_information(document_text, prompt)
        print("Información extraída:", extracted_info)

    except Exception as e:
        print("Error procesando el mensaje:", e)
    finally:
        if local_file and os.path.exists(local_file):
            os.remove(local_file)
            print(f"Archivo temporal eliminado: {local_file}")


def start_consumer():
    connection = get_rabbitmq_connection()
    channel = connection.channel()
    channel.queue_declare(queue=RABBITMQ["queue"])
    channel.basic_consume(
        queue=RABBITMQ["queue"], on_message_callback=callback, auto_ack=True)
    print('Esperando mensajes. Presiona CTRL+C para salir.')
    channel.start_consuming()

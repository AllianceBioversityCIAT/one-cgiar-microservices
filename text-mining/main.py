import os
import pika
from urllib.parse import quote
from dotenv import load_dotenv

load_dotenv()

username = os.getenv("RABBITMQ_USERNAME")
password = os.getenv("RABBITMQ_PASSWORD")
host = os.getenv("RABBITMQ_HOST")
port = os.getenv("RABBITMQ_PORT")
protocol = os.getenv("RABBITMQ_PROTOCOL", "amqps")
queue = os.getenv("RABBITMQ_QUEUE", "cola_test_python")

encoded_password = quote(password, safe='')

url = f"{protocol}://{username}:{encoded_password}@{host}:{port}"
params = pika.URLParameters(url)

connection = pika.BlockingConnection(params)
channel = connection.channel()

channel.queue_declare(queue=queue)

def callback(ch, method, properties, body):
    print("Mensaje recibido:", body.decode())

channel.basic_consume(queue=queue, on_message_callback=callback, auto_ack=True)

print('Esperando mensajes. Presiona CTRL+C para salir.')
channel.start_consuming()
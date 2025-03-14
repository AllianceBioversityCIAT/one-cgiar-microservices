import os
import json
import pika
import uuid
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

callback_queue = channel.queue_declare(queue='', exclusive=True)
callback_queue_name = callback_queue.method.queue

responses = {}
correlation_id = str(uuid.uuid4())


def on_response(ch, method, props, body):
    if props.correlation_id in responses:
        responses[props.correlation_id] = json.loads(body.decode())
        print(f"Response received: {json.loads(body.decode())}")


channel.basic_consume(
    queue=callback_queue_name,
    on_message_callback=on_response,
    auto_ack=True)


message = {
    "key": "FiBL Tech Report Jan to Jun 2024.pdf",
    "bucketName": "microservice-mining",
    "prompt": "Extract the relevant information",
    "credentials": json.dumps({
        "username": os.getenv("API_USERNAME"),
        "password": os.getenv("API_PASSWORD")
    })
}

message_json = json.dumps(message)

channel.basic_publish(
    exchange="",
    routing_key=queue,
    properties=pika.BasicProperties(
        reply_to=callback_queue_name,
        correlation_id=correlation_id
    ),
    body=message_json
)

print("Message sent:", message_json)
print("Waiting for response...")


while correlation_id not in responses:
    connection.process_data_events(time_limit=0.1)
    if connection.is_closed:
        break

if correlation_id in responses:
    print("Final response:", json.dumps(responses[correlation_id], indent=2))
else:
    print("No response received")

connection.close()

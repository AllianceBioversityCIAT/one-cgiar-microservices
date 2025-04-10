import os
import json
import pika
import uuid
import time
from urllib.parse import quote
from dotenv import load_dotenv

load_dotenv()

username = os.getenv("RABBITMQ_USERNAME")
password = os.getenv("RABBITMQ_PASSWORD")
host = os.getenv("RABBITMQ_HOST")
port = os.getenv("RABBITMQ_PORT")
protocol = os.getenv("RABBITMQ_PROTOCOL", "amqps")
queue = os.getenv("RABBITMQ_QUEUE", "cola_test_python")

print(f"Using RabbitMQ queue: {queue}")
print(f"Connecting to RabbitMQ at {host}:{port}")

encoded_password = quote(password, safe='')

url = f"{protocol}://{username}:{encoded_password}@{host}:{port}"
params = pika.URLParameters(url)

try:
    connection = pika.BlockingConnection(params)
    channel = connection.channel()

    channel.queue_declare(queue=queue)

    callback_queue = channel.queue_declare(queue='', exclusive=True)
    callback_queue_name = callback_queue.method.queue
    print(f"Created callback queue: {callback_queue_name}")

    responses = {}
    correlation_id = str(uuid.uuid4())
    print(f"Using correlation ID: {correlation_id}")

    def on_response(ch, method, props, body):
        responses[props.correlation_id] = json.loads(body.decode())
        print(f"Response received: {json.loads(body.decode())}")

    channel.basic_consume(
        queue=callback_queue_name,
        on_message_callback=on_response,
        auto_ack=True)

    message = {
        "key": "ITR D314 Apr 20 2023.docx",
        "bucketName": "microservice-mining",
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

    timeout = 180
    start_time = time.time()

    while correlation_id not in responses:

        connection.process_data_events(time_limit=0.5)

        if connection.is_closed:
            print("Connection closed unexpectedly")
            break

        if time.time() - start_time > timeout:
            print(f"No response received after {timeout} seconds - timing out")
            break

    if correlation_id in responses:
        print("Final response:", json.dumps(
            responses[correlation_id], indent=2))
    else:
        print("No response received")

except Exception as e:
    print(f"Error: {str(e)}")
finally:
    try:
        if 'connection' in locals() and connection.is_open:
            connection.close()
            print("Connection closed")
    except Exception as e:
        print(f"Error closing connection: {str(e)}")

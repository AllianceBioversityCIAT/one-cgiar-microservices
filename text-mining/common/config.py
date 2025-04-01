import os
from dotenv import load_dotenv
from urllib.parse import quote

load_dotenv()

RABBITMQ = {
    "username": os.getenv("RABBITMQ_USERNAME"),
    "password": quote(os.getenv("RABBITMQ_PASSWORD"), safe=''),
    "host": os.getenv("RABBITMQ_HOST"),
    "port": os.getenv("RABBITMQ_PORT"),
    "protocol": os.getenv("RABBITMQ_PROTOCOL", "amqps"),
    "queue": os.getenv("RABBITMQ_QUEUE", "cola_test_python"),
}

S3 = {
    "aws_access_key": os.getenv("AWS_ACCESS_KEY_ID"),
    "aws_secret_key": os.getenv("AWS_SECRET_ACCESS_KEY"),
    "aws_region": os.getenv("AWS_REGION", "us-east-1")
}

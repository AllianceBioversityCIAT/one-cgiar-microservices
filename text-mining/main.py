import logging
import os
from mq.consumer import start_consumer

def setup_logging():
    """Configure logging for the application"""
    log_level = os.getenv("LOG_LEVEL", "INFO")
    log_format = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'

    level_dict = {
        "DEBUG": logging.DEBUG,
        "INFO": logging.INFO,
        "WARNING": logging.WARNING,
        "ERROR": logging.ERROR,
        "CRITICAL": logging.CRITICAL
    }

    numeric_level = level_dict.get(log_level.upper(), logging.INFO)

    logging.basicConfig(
        level=numeric_level,
        format=log_format
    )

    logging.info(f"Logging initialized at {log_level} level")


if __name__ == "__main__":
    setup_logging()
    logging.info("Starting text-mining microservice")
    start_consumer()
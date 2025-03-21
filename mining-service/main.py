from src.utils.logger.logger_util import get_logger
from src.mq.consumer import start_consumer

logger = get_logger()
    
if __name__ == "__main__":
    logger.info("Starting text-mining microservice")
    start_consumer()
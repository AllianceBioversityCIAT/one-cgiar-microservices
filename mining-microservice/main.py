from app.mq.consumer import start_consumer
from app.llm.mining import process_document
from app.utils.logger.logger_util import get_logger


if __name__ == "__main__":
    logger = get_logger()
    logger.info("✨ Starting text-mining microservice")    
    start_consumer()
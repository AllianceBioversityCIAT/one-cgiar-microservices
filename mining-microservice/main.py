from app.llm.mining import process_document
from app.utils.logger.logger_util import get_logger
from app.mq.consumer import start_consumer

logger = get_logger()

if __name__ == "__main__":
    logger.info("Starting text-mining microservice")    
    start_consumer()
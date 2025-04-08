from app.llm.mining import process_document
from app.utils.logger.logger_util import get_logger

logger = get_logger()

if __name__ == "__main__":
    logger.info("Starting text-mining microservice")    
    bucket_name = "microservice-mining"
    file_key = "ITR D314 Apr 20 2023.docx"
    response = process_document(bucket_name, file_key)
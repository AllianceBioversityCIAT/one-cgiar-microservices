import time
from src.llm.vectorize import process_file
from src.llm.mining import generate_response
#from src.llm.test import generate
from src.utils.logger.logger_util import get_logger
from src.utils.s3.s3_util import download_document_s3, delete_local_file

logger = get_logger()

def start_consumer():
    key = "FiBL Tech Report Jan to Jun 2024.pdf"
    logger.debug("Starting the mining service...")
    download_document_s3("microservice-mining", key)
    was_processed = process_file()
    if was_processed:
        logger.info("File processed successfully.")
        time.sleep(1)
        generate_response(document_name=key)
        #generate()
        delete_local_file(key)
        logger.info("Cleanup complete - document removed from database and local storage")
    else:
        logger.warning("File was not processed.")
    
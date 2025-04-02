import time
from src.llm.mining import generate_response
from src.llm.vectorize import process_file, table
from src.utils.logger.logger_util import get_logger
from src.utils.s3.s3_util import download_document_s3, delete_local_file

logger = get_logger()

def wait_for_index(document_name, max_wait=10):
    import time
    start = time.time()
    while time.time() - start < max_wait:
        matches = table.search("dummy", vector_column_name="vector", where=f"Namedocument = '{document_name}'").to_list()
        if matches:
            return True
        time.sleep(0.5)
    return False

def start_consumer():
    key = "ITR D314 Apr 20 2023.pdf"
    logger.debug("Starting the mining service...")
    download_document_s3("microservice-mining", key)
    was_processed = process_file()
    if was_processed:
        logger.info("File processed successfully.")
        if wait_for_index(key):
            generate_response(document_name=key)
        else:
            logger.warning("Timeout: vectors not ready yet for search.")
        #generate_response(document_name=key)
        #generate()
        delete_local_file(key)
        logger.info("Cleanup complete - document removed from database and local storage")
    else:
        logger.warning("File was not processed.")
    
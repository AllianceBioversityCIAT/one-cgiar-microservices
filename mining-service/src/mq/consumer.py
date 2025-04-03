from src.llm.vectorize import process_file
from src.llm.mining import generate_response, generate_stepwise_response
#from src.llm.test import generate
from src.utils.logger.logger_util import get_logger
from src.utils.s3.s3_util import download_document_s3, delete_local_file

logger = get_logger()

def start_consumer():
    key = "FiBL Tech Report Jan to Jun 2024.pdf"
    logger.debug("Starting the mining service...")
    download_document_s3("microservice-mining", key)
    process_file()
    if process_file():
        logger.info("File processed successfully.")
        #generate_response()
        respuesta_final = generate_stepwise_response(prompt_parts)
        print(respuesta_final)
        #generate()
        delete_local_file(key)
        logger.info("Cleanup complete - document removed from database and local storage")
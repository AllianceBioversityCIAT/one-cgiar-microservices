from src.utils.logger.logger_util import get_logger
from src.llm.vectorize import process_file
from src.utils.s3.s3_util import download_document_s3
from src.llm.mining import generate_response

# Get the main application logger
logger = get_logger()

def main():
    logger.debug("Starting the mining service...")
    download_document_s3("microservice-mining", "FiBL Tech Report Jan to Jun 2024.pdf")
    process_file()
    if process_file:
        logger.info("File processed successfully.")
        generate_response()
    
if __name__ == "__main__":
    main()
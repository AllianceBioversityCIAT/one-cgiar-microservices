from src.utils.logger.logger_util import get_logger
from src.llm.vectorize import process_file

# Get the main application logger
logger = get_logger()

def main():
    logger.debug("Starting the mining service...")
    process_file()
    
if __name__ == "__main__":
    main()
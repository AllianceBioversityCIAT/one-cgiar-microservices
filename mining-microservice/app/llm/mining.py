import time
import json
import boto3
from app.utils.config.config_util import BR
from app.utils.logger.logger_util import get_logger
from app.utils.s3.s3_util import read_document_from_s3
from app.utils.prompt.default_prompt import DEFAULT_PROMPT
from langchain.text_splitter import RecursiveCharacterTextSplitter
from app.llm.vectorize import (get_embedding, 
    check_reference_exists,
    store_reference_embeddings,
    store_temp_embeddings, 
    get_all_reference_data,
    get_relevant_chunk, 
    clear_lancedb
)


logger = get_logger()

bedrock_runtime = boto3.client(
    service_name='bedrock-runtime',
    aws_access_key_id=BR['aws_access_key'],
    aws_secret_access_key=BR['aws_secret_key'],
    region_name='us-east-1' 
)


def split_text(text):
    logger.info("✂️  Dividing the text into fragments...")
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=8000, chunk_overlap=1500)
    return text_splitter.split_text(text)


def invoke_model(prompt):
    try:
        logger.info("🚀 Invoking the model...")
        request_body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 3000,
            "temperature": 0.1,
            "top_k": 250,
            "top_p": 0.999,
            "stop_sequences": [],
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": f"{prompt}"}
                    ]
                }
            ]
        }
        response = bedrock_runtime.invoke_model(
            modelId="us.anthropic.claude-3-7-sonnet-20250219-v1:0",
            body=json.dumps(request_body),
            contentType="application/json",
            accept="application/json"
        )
        return json.loads(response['body'].read())['content'][0]['text']
    
    except Exception as e:
        logger.error(f"❌ Error invoking the model: {str(e)}")
        raise


def initialize_reference_data(bucket_name, file_key_regions, file_key_countries):
    """Initialize reference data if it doesn't exist"""
    try:
        if check_reference_exists():
            logger.info("✅ Reference data already exists in the database")
            return True
            
        logger.info("🔄 Initializing reference data...")
        
        document_content_regions = read_document_from_s3(bucket_name, file_key_regions)
        regions_embeddings = get_embedding(document_content_regions)
        
        document_content_countries = read_document_from_s3(bucket_name, file_key_countries)
        countries_embeddings = get_embedding(document_content_countries)
        
        all_content = document_content_regions + document_content_countries
        all_embeddings = regions_embeddings + countries_embeddings
        
        store_reference_embeddings(all_content, all_embeddings)
        
        logger.info("✅ Reference data initialized successfully")
        return True
        
    except Exception as e:
        logger.error(f"❌ Error initializing reference data: {str(e)}")
        raise


def process_document(bucket_name, file_key, prompt=DEFAULT_PROMPT):
    start_time = time.time()

    try:
        reference_file_regions = "clarisa_regions.xlsx"
        reference_file_countries = "clarisa_countries.xlsx"
        initialize_reference_data(bucket_name, reference_file_regions, reference_file_countries)
        
        document_content = read_document_from_s3(bucket_name, file_key)
        chunks = split_text(document_content)
        embeddings = [get_embedding(chunk) for chunk in chunks]

        db, temp_table_name = store_temp_embeddings(chunks, embeddings)

        all_reference_data = get_all_reference_data()
        
        relevant_chunks = get_relevant_chunk(prompt, db, temp_table_name)

        context = all_reference_data + relevant_chunks

        query = f"""
        Based on this context:\n{context}\n\n
        Answer the question:\n{prompt}
        """

        response_text = invoke_model(query)

        end_time = time.time()
        elapsed_time = end_time - start_time
        logger.info(f"✅ Successfully generated response:\n{response_text}")
        logger.info(f"⏱️ Response time: {elapsed_time:.2f} seconds")
        return response_text

    except Exception as e:
        logger.error(f"❌ Error: {str(e)}")
        raise

    finally:
        if 'db' in locals() and 'temp_table_name' in locals():
            clear_lancedb(db, temp_table_name)
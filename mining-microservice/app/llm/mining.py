import time
import json
import boto3
from app.utils.config.config_util import BR
from app.utils.logger.logger_util import get_logger
from app.utils.s3.s3_util import read_document_from_s3
from app.utils.prompt.default_prompt import DEFAULT_PROMPT
from langchain.text_splitter import RecursiveCharacterTextSplitter
from app.llm.vectorize import get_embedding, store_embeddings_in_lancedb, get_relevant_chunk, clear_lancedb


logger = get_logger()

bedrock_runtime = boto3.client(
    service_name='bedrock-runtime',
    aws_access_key_id=BR['aws_access_key'],
    aws_secret_access_key=BR['aws_secret_key'],
    region_name='us-east-1' 
)


def split_text(text):
    logger.info("✂️ Dividing the text into fragments...")
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
    

def process_document(bucket_name, file_key, prompt=DEFAULT_PROMPT):
    start_time = time.time()

    try:
        document_content = read_document_from_s3(bucket_name, file_key)
        # chunks = split_text(document_content)
        # embeddings = [get_embedding(chunk) for chunk in chunks]

        # db, table_name = store_embeddings_in_lancedb(chunks, embeddings)

        # relevant_chunks = get_relevant_chunk(prompt, db, table_name)

        query = f"""
        Based on this context:\n{document_content}\n\n
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

    # finally:
    #     clear_lancedb(db, table_name)
import json
import boto3
import lancedb
from pathlib import Path
from app.utils.config.config_util import BR
from app.utils.logger.logger_util import get_logger
from sentence_transformers import SentenceTransformer


logger = get_logger()

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DB_PATH = str(BASE_DIR / "app" / "db" / "miningdb")

model = SentenceTransformer("intfloat/e5-large-v2")


bedrock_runtime = boto3.client(
    service_name='bedrock-runtime',
    aws_access_key_id=BR['aws_access_key'],
    aws_secret_access_key=BR['aws_secret_key'],
    region_name='us-east-1' 
)


def get_embedding(text):
    # body = json.dumps({"inputText": text})
    # response = bedrock_runtime.invoke_model(
    #     modelId="amazon.titan-embed-text-v2:0",
    #     body=body,
    #     contentType="application/json",
    #     accept="application/json"
    # )
    # return json.loads(response['body'].read())['embedding']
    try:
        return model.encode(text).tolist()
    except Exception as e:
        logger.error(f"❌ Error generating embedding: {str(e)}")
        raise


def store_embeddings_in_lancedb(chunks, embeddings, db_path=DB_PATH, table_name="files"):
    try:
        logger.info("💾 Storing embeddings in LanceDB...")
        db = lancedb.connect(db_path)
        data = [{"text": chunk, "vector": embedding}
                for chunk, embedding in zip(chunks, embeddings)]
        if table_name in db.table_names():
            db.drop_table(table_name)
        db.create_table(table_name, data=data)
        return db, table_name
    except Exception as e:
        logger.error(f"❌ Error storing embeddings in LanceDB: {str(e)}")
        raise


def get_relevant_chunk(query, db, table_name):
    try:
        logger.info("🔍 Searching for relevant fragment...")
        query_embedding = get_embedding(query)
        table = db.open_table(table_name)
        result = table.search(query_embedding).to_pandas()
        return result["text"].tolist()
    except Exception as e:
        logger.error(f"❌ Error retrieving relevant chunk: {str(e)}")
        raise


def clear_lancedb(db, table_name):
    try:
        logger.info(f"🧹 Clearing the database {table_name}...")
        if table_name in db.table_names():
            db.drop_table(table_name)
    except Exception as e:
        logger.error(f"❌ Error clearing LanceDB table {table_name}: {str(e)}")
        raise
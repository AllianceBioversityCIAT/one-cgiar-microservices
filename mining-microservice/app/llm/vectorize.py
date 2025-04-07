import json
import boto3
import lancedb
from pathlib import Path
from app.utils.config.config_util import BR

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DB_PATH = str(BASE_DIR / "app" / "db" / "miningdb")


bedrock_runtime = boto3.client(
    service_name='bedrock-runtime',
    aws_access_key_id=BR['aws_access_key'],
    aws_secret_access_key=BR['aws_secret_key'],
    region_name='us-east-1' 
)


def get_embedding(text):
    body = json.dumps({"inputText": text})
    response = bedrock_runtime.invoke_model(
        modelId="amazon.titan-embed-text-v2:0",
        body=body,
        contentType="application/json",
        accept="application/json"
    )
    return json.loads(response['body'].read())['embedding']


def store_embeddings_in_lancedb(chunks, embeddings, db_path=DB_PATH, table_name="files"):
    print("💾 Almacenando embeddings en LanceDB...")
    db = lancedb.connect(db_path)
    data = [{"text": chunk, "vector": embedding}
            for chunk, embedding in zip(chunks, embeddings)]
    if table_name in db.table_names():
        db.drop_table(table_name)
    db.create_table(table_name, data=data)
    return db, table_name


def get_relevant_chunk(query, db, table_name):
    print("🔍 Buscando fragmento relevante...")
    query_embedding = get_embedding(query)
    table = db.open_table(table_name)
    result = table.search(query_embedding).to_pandas()
    return result["text"].tolist()


def clear_lancedb(db, table_name):
    print(f"🧹 Limpiando la base de datos {table_name}...")
    if table_name in db.table_names():
        db.drop_table(table_name)
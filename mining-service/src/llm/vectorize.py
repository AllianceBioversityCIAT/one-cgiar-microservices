import re
import docx
import fitz
import lancedb
import docx2txt
import datetime
import pandas as pd
import pyarrow as pa
import logging as log
from pathlib import Path
from lancedb.pydantic import Vector, LanceModel
from src.utils.logger.logger_util import get_logger
from sentence_transformers import SentenceTransformer
from langchain_community.document_loaders import Docx2txtLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter

logger = get_logger()


class Content(LanceModel):
    pageId: str
    vector: Vector(768)
    title: str
    Namedocument: str
    modificationD: str
    is_reference: bool


BASE_DIR = Path(__file__).resolve().parent.parent.parent
DB_PATH = str(BASE_DIR / "src" / "db" / "miningdb")
FILE_SOURCE_DIRECTORY_PATH = str(BASE_DIR / "data" / "files")
FILE_PROCESSED_LOG = str(BASE_DIR / "data" / "train" / "processed_files.txt")


def save_processed_file(file_path):
    with open(FILE_PROCESSED_LOG, 'a') as f:
        f.write(f"{file_path}\n")


db = lancedb.connect(DB_PATH)
table_name = "files"
# vector_dim = 384
vector_dim = 768

if table_name not in db.table_names():
    schema = pa.schema([
        pa.field("pageId", pa.string()),
        pa.field("vector", pa.list_(pa.float32(), vector_dim)),
        pa.field("title", pa.string()),
        pa.field("Namedocument", pa.string()),
        pa.field("modificationD", pa.string()),
        pa.field("is_reference", pa.bool_())
    ])
    db.create_table(table_name, schema=schema)
    print(f"Table '{table_name}' created.")

table = db.open_table(table_name)

# embedding_model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
# embedding_model = SentenceTransformer("sentence-transformers/all-mpnet-base-v2")
embedding_model = SentenceTransformer("intfloat/e5-base-v2")


def load_processed_files():
    try:
        with open(FILE_PROCESSED_LOG, 'r') as f:
            return set(line.strip() for line in f)
    except FileNotFoundError:
        return set()


def extract_text_from_excel(file_path):
    text = ""
    try:
        logger.info("Extracting an excel file")
        excel_data = pd.read_excel(file_path, sheet_name=None)  # Carga todas las hojas
        structured_text = []

        for sheet_name, df in excel_data.items():
            structured_text.append(f"SHEET: {sheet_name}")

            if not df.empty:
                headers = [str(col) for col in df.columns]
                structured_text.append("HEADERS:\t" + "\t".join(headers))

                for idx, row in df.iterrows():
                    row_values = [str(val) for val in row.values]
                    structured_text.append(f"ROW {idx}:\t" + "\t".join(row_values))
            else:
                structured_text.append("Empty sheet.")

            structured_text.append("--END OF SHEET--")

        text = "\n".join(structured_text)
    except Exception as e:
        print(f"Error extracting text from {file_path}: {e}")
    return text


def extract_text_from_docx(file_path):
    text = ""
    try:
        logger.info("Extracting a docx file")
        loader = Docx2txtLoader(file_path)
        documents = loader.load()
        full_text = "\n".join([doc.page_content for doc in documents])

        doc = docx.Document(file_path)
        table_text = []

        for i, table in enumerate(doc.tables):
            table_text.append(f"\n--- TABLE {i+1} ---")

            if len(table.rows) > 0:
                headers = [cell.text.strip() for cell in table.rows[0].cells]
                table_text.append("HEADERS:\t" + "\t".join(headers))

            for j, row in enumerate(table.rows[1:], 1):
                row_data = [cell.text.strip() for cell in row.cells]
                table_text.append(f"ROW {j}:\t" + "\t".join(row_data))

            table_text.append("--- END TABLE ---\n")

        combined_text = full_text + "\n" + "\n".join(table_text)
        lines = [line.strip() for line in combined_text.splitlines() if line.strip()]
        text = "\n\n".join(lines)

    except Exception as e:
        print(f"Error extracting text from {file_path}: {e}")
    return text


def extract_text_from_txt(file_path):
    text = ""
    try:
        logger.info("Extracting a text file")
        with open(file_path, "r", encoding="utf-8") as f:
            text = f.read()
    except Exception as e:
        print(f"Error extracting text from {file_path}: {e}")
    return text


def embed_text(text):
    return embedding_model.encode(text, normalize_embeddings=True, device=0).tolist()


def extract_pdf_content(file_path, chunk_size=2000, chunk_overlap=100, is_reference=False):
    try:
        doc = fitz.open(file_path)
        pdf_name = Path(file_path).name
        modification_date = str(datetime.datetime.fromtimestamp(
            Path(file_path).stat().st_mtime))
        
        full_text = ""
        for page in doc:
            full_text += page.get_text() + "\n"
        doc.close()

        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            length_function=len
        )
        data_list = []
        batch_size = 100

        chunks = text_splitter.split_text(full_text)        
        
        for idx, chunk in enumerate(chunks):
            cleaned_text = re.sub(
                r"[&\[\]\-\)\(\-]", "", chunk).lower().strip()
            if cleaned_text:
                embedding_vector = embed_text(cleaned_text)
                data = {
                    "pageId": str(idx + 1),
                    "vector": embedding_vector,
                    "title": cleaned_text,
                    "Namedocument": pdf_name,
                    "modificationD": modification_date,
                    "is_reference": is_reference
                }
                data_list.append(data)
                if len(data_list) >= batch_size:
                    table.add([Content(**item).model_dump()
                                for item in data_list])
                    data_list = []
        if data_list:
            table.add([Content(**item).model_dump() for item in data_list])       #doc.close()

        logger.info(f"Finished processing {pdf_name}")

    except Exception as e:
        logger.error(f"Error processing file: {file_path}. \n {e}")
        if 'doc' in locals():
            doc.close()


def extract_content(file_path, chunk_size=1000, chunk_overlap=50, is_reference=False):
    try:
        logger.debug(f"Processing document: {file_path}")
        ext = Path(file_path).suffix.lower()
        if ext in [".xlsx", ".xls"]:
            text = extract_text_from_excel(file_path)
        elif ext == ".docx":
            text = extract_text_from_docx(file_path)
        elif ext == ".txt":
            text = extract_text_from_txt(file_path)
        else:
            print(f"Unsupported format: {ext}")
        
        if not text.strip():
            logger.info(f"No text extracted from {file_path}. Skipping.")
            return
        
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size, chunk_overlap=chunk_overlap, length_function=len)
        
        chunks = text_splitter.split_text(text)
        doc_name = Path(file_path).name
        modification_date = str(datetime.datetime.fromtimestamp(
            Path(file_path).stat().st_mtime))
        page_id = "1"
        data_list = []
        batch_size = 100
        for idx, chunk in enumerate(chunks):
            cleaned_text = re.sub(r"[&\[\]\-\)\(\-]",
                                  "", chunk).lower().strip()
            if cleaned_text:
                embedding_vector = embed_text(cleaned_text)
                data = {
                    "pageId": page_id,
                    "vector": embedding_vector,
                    "title": cleaned_text,
                    "Namedocument": doc_name,
                    "modificationD": modification_date,
                    "is_reference": is_reference
                }
                data_list.append(data)
                if len(data_list) >= batch_size:
                    table.add([Content(**item).model_dump()
                              for item in data_list])
                    data_list = []
        if data_list:
            table.add([Content(**item).model_dump() for item in data_list])
        logger.info(f"{doc_name} processed successfully.")
    except Exception as e:
        logger.info(f"Error processing document {file_path}: {e}")


def process_file():
    supported_file_types = [".pdf", ".docx", ".txt", ".xlsx", ".xls"]
    processed_files = load_processed_files()
    files = [f for f in Path(FILE_SOURCE_DIRECTORY_PATH).rglob(
        "*") if f.is_file() and f.suffix.lower() in supported_file_types]

    if not files:
        logger.info("No new files to process.")
        return

    logger.info(f"Founds {len(files)} new files to process.")

    for file in files:
        logger.info(f"Processing file: {file}")
        try:
            is_reference = "clarisa" in file.name.lower()
            if file.suffix.lower() == ".pdf":
                extract_pdf_content(str(file), is_reference=is_reference)
            else:
                extract_content(str(file), is_reference=is_reference)

            save_processed_file(str(file))
            return True

        except Exception as e:
            logger.error(f"Error processing file: {file}. \n {e}")

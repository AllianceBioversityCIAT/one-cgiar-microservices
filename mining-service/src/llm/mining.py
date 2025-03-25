import json
import lancedb
import torch
import time
import requests
from pathlib import Path
from sentence_transformers import SentenceTransformer
from transformers import AutoTokenizer, AutoModelForCausalLM, TextIteratorStreamer, pipeline
from threading import Thread
from src.utils.prompt.default_prompt import DEFAULT_PROMPT
from src.utils.logger.logger_util import get_logger

logger = get_logger()

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DB_PATH = str(BASE_DIR / "src" / "db" / "miningdb")
TABLE_NAME = "files"

db = lancedb.connect(DB_PATH)
try:
    table = db.open_table(TABLE_NAME)
except Exception:
    table = db.create_table(TABLE_NAME, schema=schema)

embedding_model_name = "sentence-transformers/all-MiniLM-L6-v2"
embedding_model = SentenceTransformer(embedding_model_name)


def get_embedding(text):
    return embedding_model.encode(text)


def search_context(query):
    query_embedding = get_embedding(query)
    results = table.search(
        query_embedding.tolist(),
        vector_column_name="vector"
    ).to_list()

    context_list = [res["title"] for res in results if "title" in res]
    logger.debug(f"Context list: {context_list}")
    context = " ".join(context_list)
    return context

def clear_table_data():
    if table:
        table.delete(where="is_reference != true")
        logger.info("All vectors deleted from the table.")

# gen_model_name = "deepseek-ai/DeepSeek-R1-Distill-Llama-8B"
# tokenizer = AutoTokenizer.from_pretrained(gen_model_name)
# model = AutoModelForCausalLM.from_pretrained(gen_model_name)
# generator = pipeline("text-generation", model=model,
#                      tokenizer=tokenizer, device=0)


# def generate_response(user_input=DEFAULT_PROMPT):
#     query_for_embedding = "Extract relevant results and indicators from the document"
#     context = search_context(user_input) 
#     prompt = f"Context: {context}\nQuestion: {user_input}\nFinal Answer:"

#     streamer = TextIteratorStreamer(tokenizer)
#     generation_kwargs = dict(
#         max_new_tokens=2000,
#         do_sample=True,
#         temperature=0.1,
#         repetition_penalty=1.2,
#         streamer=streamer,
#     )

#     thread = Thread(
#         target=generator,
#         kwargs={
#             "text_inputs": prompt,
#             **generation_kwargs
#         }
#     )

#     thread.start()

#     generated_text = ""
#     print("Chatbot: ", end="", flush=True)
#     for new_text in streamer:
#         if "<|endoftext|>" in new_text:
#             break
#         print(new_text, end="", flush=True)
#         generated_text += new_text
#         time.sleep(0.01)
#     print()

#     generated_text = generated_text.replace(
#         "<|begin▁of▁sentence|>", "").strip()
#     answer_parts = generated_text.split("Final Answer:")
#     if len(answer_parts) > 1:
#         return answer_parts[-1].strip()

#     clear_table_data()
#     return generated_text.strip()


def generate_response(user_input=DEFAULT_PROMPT):
    context = search_context(user_input)
    prompt = f"Context: {context}\nQuestion: {user_input}\nFinal Answer:"

    payload = {
        "model": "llama3.1:8b-instruct-q4_0",
        #"model": "deepseek-r1:14b",
        "prompt": prompt,
        "stream": False,
        "num_predict": 2000,
        "temperature": 0.0,
        "repeat_penalty": 1.2
    }

    try:
        response = requests.post("http://localhost:11434/api/generate", json=payload)
        response.raise_for_status()
        raw_json_string = response.json()["response"]
        cleaned_json = json.loads(raw_json_string)
        print("📦 Full Ollama response JSON:\n" + json.dumps(cleaned_json, indent=4))
        clear_table_data()
        return json.dumps(cleaned_json, indent=4)
    except Exception as e:
        logger.error(f"Error generating response: {e}")
        return "Error generating report."

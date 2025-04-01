import json
import lancedb
import pyarrow as pa
from pathlib import Path
from langgraph.graph import StateGraph, END
from src.utils.logger.logger_util import get_logger
from sentence_transformers import SentenceTransformer
from transformers import AutoTokenizer, AutoModelForCausalLM, pipeline, TextIteratorStreamer

logger = get_logger()

# Modelo ya cargado en tu setup
embedding_model = SentenceTransformer("sentence-transformers/all-mpnet-base-v2")  # mismo que en tu código actual

# LanceDB ya conectado en tu archivo mining.py
DB_PATH = str(Path(__file__).resolve().parent.parent.parent / "src" / "db" / "miningdb")
TABLE_NAME = "files"
vector_dim = 768


db = lancedb.connect(DB_PATH)
table = db.open_table(TABLE_NAME)


def search_context_from_db(prompt):
    vector = embedding_model.encode(prompt, normalize_embeddings=True).tolist()
    search = table.search(vector, vector_column_name="vector")
    
    results = search.to_list()
    context = " ".join([r["title"] for r in results if "title" in r])
    logger.debug(f"Context list: {context}")
    context = " ".join(context)
    return context


def clear_table_data():
    if table:
        table.delete(where="is_reference != true")
        logger.info("All vectors deleted from the table.")


def classify_node(state, generator):
    #file_name = Path(state["file_path"]).name

    prompt_query = f"""
    You are an assistant analyzing the following context and classifying it according to the following indicators:

    - “Capacity Sharing for Development”
    - “Policy Change”

    If the context does not relate to either indicator, respond with:
    {{
        "indicator": "None",
        "description": "",
        "keywords": []
    }}

    If it does match, return the following JSON:
    {{
        "indicator": "<Capacity Sharing for Development or Policy Change>",
        "description": "<brief description of the result>",
        "keywords": ["list", "of", "relevant", "keywords"]
    }}
    ---
    """
    context = search_context_from_db(prompt_query)
    prompt = f"Context: {context}\nQuestion: {prompt_query}"

    #streamer = TextIteratorStreamer(tokenizer)
    response = generator(prompt, max_new_tokens=100, do_sample=True, temperature=0.1, repetition_penalty=1.2)[0]["generated_text"]
    
    try:
        json_start = response.find("{")
        result = json.loads(response[json_start:])
    except Exception:
        result = {
            "indicator": "None",
            "description": "",
            "keywords": []
        }

    return {
        "classified_data": result,
        "file_path": state["file_path"]
    }


def participants_node(state, generator):
    #file_name = Path(state["file_path"]).name
    if state["classified_data"]["indicator"] != "Capacity Sharing for Development":
        return state  # no hace nada

    prompt_query = f"""
    Based on the following context, extract participant-related training info (people trained).

    Return:
    {{
        "training_type": "...",
        "total_participants": ...,
        "male_participants": ...,
        "female_participants": ...,
        "non_binary_participants": ...,
        "training_modality": "...",
        "start_date": "...",
        "end_date": "...",
        "length_of_training": "..."
    }}
    """
    context = search_context_from_db(prompt_query)
    prompt = f"Context: {context}\nQuestion: {prompt_query}"
    response = generator(prompt, max_new_tokens=1000, do_sample=True, temperature=0.1, repetition_penalty=1.2)[0]["generated_text"]

    try:
        json_start = response.find("{")
        result = json.loads(response[json_start:])
    except Exception:
        result = {
            "training_type": "Not collected",
            "total_participants": "Not collected",
            "male_participants": "Not collected",
            "female_participants": "Not collected",
            "non_binary_participants": "Not collected",
            "training_modality": "Not collected",
            "start_date": "Not collected",
            "end_date": "Not collected",
            "length_of_training": "Not collected"
        }

    state.update(result)
    return state


def geoscope_node(state, generator):
    #file_name = Path(state["file_path"]).name

    prompt_query = f"""
    Based on the context, determine the geographical scope of the project (locations, countries, regions where the training or policy was applied).

    Return:
    {{
    "level": "<Global | Regional | National | Sub-national | This is yet to be determined>",
    "sub_list": <[codes or region names] or null>
    }}

    Context:
    ---
    {context}
    ---
    """
    context = search_context_from_db(prompt_query)
    prompt = f"Context: {context}\nQuestion: {prompt_query}"
    response = generator(prompt, max_new_tokens=1000,  do_sample=True, temperature=0.1, repetition_penalty=1.2)[0]["generated_text"]

    try:
        json_start = response.find("{")
        result = json.loads(response[json_start:])
    except Exception:
        result = {
            "level": "This is yet to be determined",
            "sub_list": None
        }

    state["geoscope"] = result
    return state


def assemble_node(state):
    if state["classified_data"]["indicator"] == "None":
        return {"final_output": {"results": []}}

    result = {
        "indicator": state["classified_data"]["indicator"],
        "title": "Not collected",
        "description": state["classified_data"]["description"],
        "keywords": state["classified_data"]["keywords"],
        "geoscope": state.get("geoscope", {
            "level": "This is yet to be determined",
            "sub_list": None
        }),
        "training_type": state.get("training_type", "Not collected"),
        "total_participants": state.get("total_participants", "Not collected"),
        "male_participants": state.get("male_participants", "Not collected"),
        "female_participants": state.get("female_participants", "Not collected"),
        "non_binary_participants": state.get("non_binary_participants", "Not collected"),
        "training_modality": state.get("training_modality", "Not collected"),
        "start_date": state.get("start_date", "Not collected"),
        "end_date": state.get("end_date", "Not collected"),
        "length_of_training": state.get("length_of_training", "Not collected"),
        "alliance_main_contact_person": "Not collected"
    }


    clear_table_data()
    return {"final_output": {"results": [result]}}


def generate():
    gen_model_name = "deepseek-ai/DeepSeek-R1-Distill-Llama-8B"
    tokenizer = AutoTokenizer.from_pretrained(gen_model_name)
    model = AutoModelForCausalLM.from_pretrained(gen_model_name)
    generator = pipeline("text-generation", model=model, tokenizer=tokenizer, device=0)

    workflow = StateGraph()

    workflow.add_node("classify", lambda state: classify_node(state, generator))
    workflow.add_node("participants", lambda state: participants_node(state, generator))
    workflow.add_node("geoscope", lambda state: geoscope_node(state, generator))
    workflow.add_node("assemble", assemble_node)

    workflow.set_entry_point("classify")
    workflow.add_edge("classify", "participants")
    workflow.add_edge("participants", "geoscope")
    workflow.add_edge("geoscope", "assemble")
    workflow.set_finish_point("assemble")

    app = workflow.compile()

#result = app.invoke({"file_path": "/ruta/a/documento.docx"})
#print(json.dumps(result["final_output"], indent=2))
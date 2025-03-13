import torch
from transformers import AutoTokenizer, AutoModelForCausalLM

tokenizer = AutoTokenizer.from_pretrained(
    "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B")
model = AutoModelForCausalLM.from_pretrained(
    "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B")


def vectorize_document(document_text):
    """
    Generates a vector representation of the document.
    """
    inputs = tokenizer(document_text, return_tensors="pt",
                       truncation=True, max_length=512)
    with torch.no_grad():
        outputs = model(**inputs, output_hidden_states=True)
    embeddings = outputs.hidden_states[-1].mean(dim=1).squeeze().tolist()
    return embeddings

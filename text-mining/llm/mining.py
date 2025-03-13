import torch
from transformers import AutoTokenizer, AutoModelForCausalLM

tokenizer = AutoTokenizer.from_pretrained(
    "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B")
model = AutoModelForCausalLM.from_pretrained(
    "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B")


def extract_relevant_information(document_text, prompt):
    """
    Extrae información relevante del documento usando un prompt.
    """
    input_text = f"{prompt}:\n{document_text}"
    inputs = tokenizer(input_text, return_tensors="pt",
                       truncation=True, max_length=1024)
    with torch.no_grad():
        outputs = model.generate(
            inputs.input_ids,
            max_length=150,
            min_length=30,
            do_sample=False,
            num_beams=4
        )
    response = tokenizer.decode(outputs[0], skip_special_tokens=True)
    return response

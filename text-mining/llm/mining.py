import torch
from transformers import AutoTokenizer, AutoModelForCausalLM, pipeline

model_name = "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B"

tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForCausalLM.from_pretrained(model_name)
generator = pipeline(
    "text-generation",
    model=model,
    tokenizer=tokenizer,
    device=0
)


def extract_relevant_information(document_text, prompt):
    input_text = f"{prompt}:\n\n{document_text}"

    response = generator(
        input_text,
        max_length=1024,
        min_length=30,
        num_beams=4,
        temperature=0.7,
        repetition_penalty=1.2,
        do_sample=True
    )

    generated_text = response[0]["generated_text"]
    if generated_text.startswith(input_text):
        generated_text = generated_text[len(input_text):].strip()
    return generated_text

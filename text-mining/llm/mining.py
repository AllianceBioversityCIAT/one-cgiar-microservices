import torch
import logging
import time
from transformers import AutoTokenizer, AutoModelForCausalLM, pipeline

logger = logging.getLogger(__name__)

model_name = "deepseek-ai/DeepSeek-R1-Distill-Llama-8B"

logger.info(f"Loading LLM model: {model_name}")
start_time = time.time()

try:
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForCausalLM.from_pretrained(model_name)

    device = 0 if torch.cuda.is_available() else -1
    device_name = f"CUDA:{device}" if device >= 0 else "CPU"
    logger.info(f"Using device: {device_name}")

    generator = pipeline(
        "text-generation",
        model=model,
        tokenizer=tokenizer,
        device=device
    )

    logger.info(
        f"Model loaded successfully in {time.time() - start_time:.2f} seconds")
except Exception as e:
    logger.error(f"Error loading LLM model: {str(e)}")
    raise


def extract_relevant_information(document_text, prompt):
    """
    Extract relevant information from document text using the LLM.

    Args:
        document_text (str): The text of the document to analyze
        prompt (str): The prompt to guide the extraction process

    Returns:
        str: The extracted information
    """
    input_text = f"{prompt}:\n\n{document_text}"
    doc_preview = document_text[:100] + \
        "..." if len(document_text) > 100 else document_text

    logger.info(
        f"Extracting information with prompt: '{prompt}', document preview: '{doc_preview}'")
    start_time = time.time()

    try:
        response = generator(
            input_text,
            max_new_tokens=1024,
            min_length=30,
            num_beams=4,
            temperature=0.7,
            repetition_penalty=1.2,
            do_sample=True
        )

        generated_text = response[0]["generated_text"]
        if generated_text.startswith(input_text):
            generated_text = generated_text[len(input_text):].strip()

        processing_time = time.time() - start_time
        logger.info(
            f"Information extracted successfully in {processing_time:.2f} seconds")
        print(generated_text)
        logger.debug(f"Generated response: {generated_text[:100]}...")

        return generated_text

    except Exception as e:
        logger.error(f"Error during information extraction: {str(e)}")
        raise

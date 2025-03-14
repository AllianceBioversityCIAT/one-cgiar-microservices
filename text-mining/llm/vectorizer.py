import logging
import time
from sentence_transformers import SentenceTransformer
import torch

logger = logging.getLogger(__name__)

# Clear CUDA cache before loading model
try:
    torch.cuda.empty_cache()
    logger.info("CUDA cache cleared")
except Exception as e:
    logger.warning(f"Failed to clear CUDA cache: {str(e)}")

embedding_model_name = "sentence-transformers/all-MiniLM-L6-v2"

logger.info(f"Loading embedding model: {embedding_model_name}")
start_time = time.time()

try:
    device = "cuda" if torch.cuda.is_available() else "cpu"
    logger.info(f"Using device: {device}")

    embedding_model = SentenceTransformer(
        embedding_model_name).half().to(device)

    logger.info(
        f"Embedding model loaded successfully in {time.time() - start_time:.2f} seconds")
except Exception as e:
    logger.error(f"Error loading embedding model: {str(e)}")
    raise


def vectorize_document(document_text):
    """
    Convert document text to a vector representation.

    Args:
        document_text (str): The text to vectorize

    Returns:
        torch.Tensor: The vector representation of the document
    """
    doc_preview = document_text[:50] + \
        "..." if len(document_text) > 50 else document_text
    logger.info(f"Vectorizing document: '{doc_preview}'")
    start_time = time.time()

    try:
        vector = torch.mean(embedding_model.encode(
            document_text, convert_to_tensor=True), dim=0)

        processing_time = time.time() - start_time
        logger.info(
            f"Document vectorized successfully in {processing_time:.2f} seconds")
        logger.debug(
            f"Vector shape: {vector.shape}, norm: {torch.norm(vector).item():.4f}")

        return vector

    except Exception as e:
        logger.error(f"Error during document vectorization: {str(e)}")
        raise

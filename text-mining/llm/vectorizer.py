from sentence_transformers import SentenceTransformer
import torch
torch.cuda.empty_cache()

embedding_model_name = "sentence-transformers/all-MiniLM-L6-v2"
embedding_model = SentenceTransformer(model_name).half().to("cuda")


def vectorize_document(document_text):
    return torch.mean(embedding_model.encode(document_text, convert_to_tensor=True), dim=0)

import torch
from transformers import SentenceTransformer

embedding_model_name = "sentence-transformers/all-MiniLM-L6-v2"
embedding_model = SentenceTransformer(embedding_model_name)


def vectorize_document(document_text):
    return torch.mean(embedding_model.encode(document_text, convert_to_tensor=True), dim=0)

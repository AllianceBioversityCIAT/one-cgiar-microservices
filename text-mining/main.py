import os
import json
import boto3
import pika
from urllib.parse import quote
from dotenv import load_dotenv
from transformers import AutoTokenizer, AutoModelForCausalLM
import torch

load_dotenv()

username = os.getenv("RABBITMQ_USERNAME")
password = os.getenv("RABBITMQ_PASSWORD")
host = os.getenv("RABBITMQ_HOST")
port = os.getenv("RABBITMQ_PORT")
protocol = os.getenv("RABBITMQ_PROTOCOL", "amqps")
queue = os.getenv("RABBITMQ_QUEUE", "cola_test_python")

encoded_password = quote(password, safe='')
url = f"{protocol}://{username}:{encoded_password}@{host}:{port}"
params = pika.URLParameters(url)

connection = pika.BlockingConnection(params)
channel = connection.channel()
channel.queue_declare(queue=queue)

aws_access_key = os.getenv("AWS_ACCESS_KEY_ID")
aws_secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")
aws_region = os.getenv("AWS_REGION", "us-east-1")

s3_client = boto3.client(
    's3',
    aws_access_key_id=aws_access_key,
    aws_secret_access_key=aws_secret_key,
    region_name=aws_region
)

tokenizer = AutoTokenizer.from_pretrained("deepseek-ai/DeepSeek-R1-Distill-Qwen-7B")
model = AutoModelForCausalLM.from_pretrained("deepseek-ai/DeepSeek-R1-Distill-Qwen-7B")


def download_document(bucket, key):
    """
    Descarga el archivo desde S3 y lo guarda en /tmp.
    Retorna la ruta local del archivo descargado.
    """
    local_filename = f"/tmp/{os.path.basename(key)}"
    s3_client.download_file(bucket, key, local_filename)
    return local_filename


def vectorize_document(document_text):
    """
    Genera una representación vectorial del documento usando Qwen2.5-Math-7B.
    """
    inputs = tokenizer(document_text, return_tensors="pt",
                       truncation=True, max_length=512)
    with torch.no_grad():
        outputs = model(**inputs, output_hidden_states=True)
    
    embeddings = outputs.hidden_states[-1].mean(dim=1).squeeze().tolist()
    return embeddings


def extract_relevant_information(document_text, prompt):
    """
    Extrae información relevante del documento usando Qwen2.5-Math-7B.
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


def callback(ch, method, properties, body):
    local_file = None
    try:
        message = json.loads(body.decode())
        key_value = message.get("key")
        bucket_name = message.get("bucket")
        prompt = """
            Analyze the provided document(s) and extract all results related only to these indicators:
            - “Capacity Sharing for Development”
            - “Policy Change”

            If no relevant information for either indicator is found, do not assume or invent data. Instead, return a JSON object with an empty array of results, like this:
            {
            "results": []
            }

            ---

            Instructions for Each Identified Result

            Indicator Type
            Determine whether the result is:
            1. Capacity Sharing for Development
            - Involves individual and group activities and engagement aimed at changing knowledge, attitudes, skills, or practices.
            - Capacity development refers to activities that develop the know-how and capacity to design, test, validate and use innovations. These activities are considered instrumental to lead to behavioral changes in knowledge, attitude, skills, and practice among CGIAR and non-CGIAR personnel.
            - The main goal is to capture gender composition, and the number of people trained long-term and short term (including Masters’ and PhD students) by Alliance staff.
            - Examples: training-of-trainers programs at the farmer level; providing guidance on RBM and MEL; training programs with public and private sector partners; educating PhD and MSc students; ongoing institutional support to national partners, particularly NARES; and decision support for policymakers.
            - Possible keywords: "capacity", "capacitated", "capacity sharing", "capacity building", "training", "trained", "trainee", "trainees", "trainer", "students", "workshop", "webinar", "in-person", "hybrid", "online", "attendance", "attended", "attendees", "sessions", "participation", "participants", "participated", "took part", "male", "female", "total", "male participants", "female participants", "men", "women", "learning", "facilitator", "mentor", "mentored", "instructor", "lecturer", "coach", "seminar", "conference", "e-learning", "program", "virtual", "engagement", "feedback", "skills", "skills development", "knowledge transfer", "learning", "supervisor", "capacity development", "programme", "degree", "masters", "university", "bachelor", "on-site"

            2. Policy Change
            - Refers to introductions or modifications of policies, strategies, or regulations addressing specific issues.
            - Must show measurable impacts or outcomes aligned with the project/organization’s goals.

            ---

            General Information Fields

            Result Title
            - Identify the exact title of the result as stated in the document.

            Result Description
            - Provide a brief description of the result.

            Keywords
            - List relevant keywords in lowercase, as an array of strings.

            Geoscope (Geographical Scope)
            For each result, specify:
            - level:
            - "Global"
            - "Regional"
            - "National"
            - "Sub-national"
            - "This is yet to be determined"
            - sub_list:  
            - If level = "Regional", return an array with the appropriate UN M49 code(s).
            - If level = "National", return an array with the ISO Alpha-2 country code(s) (e.g., ["KE"]).
            - If level = "Sub-national", return an array with the specific sub-national areas (e.g., ["Western Kenya"]).
            - If not applicable, set "sub_list": null.

            Additional Field for All Results:
            - alliance_main_contact_person

            ---

            Additional Requirements for "Capacity Sharing for Development"

            Training Type
            - "Individual training"
            - "Group training"

            If "Group training", **validate and reinforce participant counting by ensuring:**
            1. Extract the full list of participants if available (e.g., from an appendix or table of attendees).
            2. Use explicit participant counts if stated in the document.
            3. If total_participants is present but gender-specific counts are missing, assume:
            {
                "male_participants": 0,
                "female_participants": 0,
                "non_binary_participants": 0
            }
            4. If participant names are listed with gender annotations, count them directly from the list.
            5. Ensure that:
            total_participants == male_participants + female_participants + non_binary_participants
            - If this condition is **not met**, **adjust total_participants to reflect the correct sum**.
            6. All participant counts must be non-negative integers (≥ 0).

            **Training Duration Validation**
            - "Start date" and "End date" should capture the training period as stated in the document.
            - "Length of training" should be calculated as the time elapsed between the Start date and the End date.
            - If either date is missing, return "Not collected" for the start date, end date, and length of training.
            - Long-term training refers to any training that goes for 3 or more months.
            - Short-term training refers to any training that goes for less than 3 months.
            - Only training programs that have been completed (end date in the past) should be reported.

            For any fields (training_modality, start_date, end_date, length_of_training) not present in the document, return "Not collected".

            ---

            Output Format
            Your output must be valid JSON and must not include any additional text or explanations. Follow this structure exactly:

            {
            "results": [
                {
                "indicator": "<'Capacity Sharing for Development' or 'Policy Change'>",
                "title": "<result title>",
                "description": "<result description>",
                "keywords": [
                    "<keyword1>",
                    "<keyword2>",
                    "..."
                ],
                "geoscope": {
                    "level": "<Global | Regional | National | Sub-national | This is yet to be determined>",
                    "sub_list": <[array of codes or region names] or null>
                },
                "training_type": "<Individual training or Group training (only if applicable)>",
                "total_participants": <number (only if group training)>,
                "male_participants": <number (only if group training)>,
                "female_participants": <number (only if group training)>,
                "non_binary_participants": <number (only if group training)>,
                "training_modality": "<value or 'Not collected'>",
                "start_date": "<value or 'Not collected'>",
                "end_date": "<value or 'Not collected'>",
                "length_of_training": "<calculated value or 'Not collected'>",
                "alliance_main_contact_person": "<value or 'Not collected'>"
                }
            ]
            }

            If no results match the indicators, return exactly:

            {
            "results": []
            }
        """
        print(
            f"Recibido: key={key_value}, bucket={bucket_name}, prompt={prompt}")

        local_file = download_document(bucket_name, key_value)
        with open(local_file, "r", encoding="utf-8") as f:
            document_text = f.read()

        embedding = vectorize_document(document_text)
        print("Documento vectorizado. Embedding:", embedding)

        extracted_info = extract_relevant_information(document_text, prompt)
        print("Información extraída:", extracted_info)

    except Exception as e:
        print("Error procesando el mensaje:", e)
    finally:
        if local_file and os.path.exists(local_file):
            os.remove(local_file)
            print(f"Archivo temporal eliminado: {local_file}")


channel.basic_consume(queue=queue, on_message_callback=callback, auto_ack=True)
print('Esperando mensajes. Presiona CTRL+C para salir.')
channel.start_consuming()

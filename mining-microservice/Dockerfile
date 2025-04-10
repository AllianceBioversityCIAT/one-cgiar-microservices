# Use Python 3.11 as the base image
FROM python:3.11-slim

# Set the working directory
WORKDIR /app

# Copy all project contents
COPY . .

# Install project dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Run the test first, then the consumer only if it passes
CMD bash -c "python app/app/test/test_producer.py && python main.py"
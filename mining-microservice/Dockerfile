# Use Python 3.11 slim as base image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install required system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gcc libffi-dev libssl-dev \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy all project contents
COPY . .

# Ensure logs directory exists
RUN mkdir -p /app/data/logs

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copy and prepare entrypoint script
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Start with the entrypoint
CMD ["/app/entrypoint.sh"]
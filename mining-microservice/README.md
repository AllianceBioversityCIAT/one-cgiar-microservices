# 🧭 Microservice Setup Guide

This guide provides step-by-step instructions to set up the environment for running or containerizing the microservice, which uses RabbitMQ queues via an AWS-hosted instance. Follow these steps carefully to ensure a smooth setup process.

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
- **Python** (version 3.8 or higher)
- **Git** (for cloning and pulling the repository)
- **pip** (Python package manager)

Verify your Python version by running:
```bash
python3 --version
```

## 🚀 Setup Instructions

### 1. Clone or Update the Repository
Ensure you have the latest code by pulling the `main-mining` branch from the repository.

```bash
git pull origin main-mining
```

> **Note**: If you haven't cloned the repository yet, clone it first:
> ```bash
> git clone <repository-url>
> cd <repository-directory>
> ```

### 2. Configure Environment Variables
The microservice requires environment variables to function correctly, including the AWS-hosted RabbitMQ connection. Create a `.env` file in the project root and populate it with the necessary variables.

1. Copy the example environment file (if provided):
   ```bash
   cp .env.example .env
   ```
2. Open the `.env` file in a text editor and update the values as needed. Example variables include:
   ```
   RABBITMQ_URL=amqp://<username>:<password>@<aws-rabbitmq-host>:<port>
   AWS_REGION=us-east-1
   API_USERNAME=my_user
   ```

> **Tip**: Refer to the project documentation or `.env.example` for a complete list of required variables. Ensure sensitive information (e.g., API keys) is kept secure and not committed to version control.

### 3. Set Up a Virtual Environment
To isolate dependencies, create and activate a Python virtual environment.

```bash
python3 -m venv venv
source venv/bin/activate  # On Windows, use: venv\Scripts\activate
```

Once activated, your terminal prompt should indicate the virtual environment (e.g., `(venv)`).

> **Troubleshooting**: If `venv` is not recognized, ensure Python is correctly installed and added to your system PATH.

### 4. Install Dependencies
Install the required Python packages listed in `requirements.txt`.

```bash
pip install -r requirements.txt
```

> **Tip**: To ensure compatibility, periodically update dependencies by running:
> ```bash
> pip install --upgrade -r requirements.txt
> ```

## 🛠️ Running the Microservice
After completing the setup, you can run the microservice locally. Use the following command (adjust based on your project’s entry point):

```bash
python main.py  # Replace with the actual command if different
```

The microservice will connect to the AWS RabbitMQ instance and start processing messages. Check the console output for confirmation.

## ✅ Testing the Microservice
The project includes a test script, `test/test_producer.py`, to verify the microservice’s queue functionality by sending test messages to the AWS RabbitMQ instance.

1. Ensure the microservice is running.
2. Run the test script:
   ```bash
   python test/test_producer.py
   ```
3. Verify the microservice processes the test messages by checking its output or logs.

## 🔍 Troubleshooting
- **Command not found**: Verify that Python, pip, and Git are installed and accessible in your terminal.
- **RabbitMQ connection issues**: Ensure the `RABBITMQ_URL` is correct and the AWS instance is reachable.
- **Missing environment variables**: Double-check the `.env` file for correct syntax and values.
- **Dependency errors**: Ensure the virtual environment is activated and try reinstalling dependencies.

For additional help, consult the project documentation or contact the development team.

## 📄 License
This project is licensed under the [MIT License](LICENSE) (or specify the appropriate license).
#!/bin/bash
set -e  # Fail on error

# Start the consumer in the background
echo "[INFO] Starting main.py (consumer)..."
python main.py &
CONSUMER_PID=$!

# Give it a moment to start (you can increase this if needed)
sleep 5

# Run the test once
echo "[INFO] Running test_producer.py once..."
python app/app/test/test_producer.py || {
    echo "[ERROR] Test failed. Stopping consumer and exiting."
    kill $CONSUMER_PID
    exit 1
}

echo "[INFO] Test passed. Keeping consumer running."
# Keep the container alive with the consumer
wait $CONSUMER_PID
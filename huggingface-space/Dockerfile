FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY backend/python/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY backend/python/ .
COPY traffic-system/public ./videos

# Create necessary directories
RUN mkdir -p /app/videos

# Expose port
EXPOSE 8000

# Set environment variables
ENV PYTHON_API_PORT=8000
ENV PYTHON_ENV=production
ENV YOLO_CONFIDENCE_THRESHOLD=0.40
ENV AMBULANCE_CONFIDENCE=0.65

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

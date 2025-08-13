# Base Python
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates tzdata curl \
  && rm -rf /var/lib/apt/lists/*

COPY ./requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["gunicorn","-w", "4","-k", "uvicorn.workers.UvicornWorker","main:app","--bind", "0.0.0.0:8000","--access-logfile", "-","--error-logfile", "-"]
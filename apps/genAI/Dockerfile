FROM python:3.11-slim

WORKDIR /app/apps/genAI

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HF_HOME=/models \
    FASTEMBED_CACHE_PATH=/models \
    PIP_DEFAULT_TIMEOUT=120 \
    PIP_RETRIES=10

COPY apps/genAI/requirements.txt ./requirements.txt

# every dependency ships a prebuilt wheel, so no compiler toolchain is
# needed; the cache mount keeps downloaded wheels across rebuilds
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --upgrade pip \
    && pip install --resume-retries 10 -r requirements.txt

COPY apps/genAI/app ./app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

FROM python:3.11-slim AS base
WORKDIR /app

RUN pip install poetry && poetry config virtualenvs.create false

COPY pyproject.toml poetry.lock* ./
RUN poetry install --no-root --only main

COPY . .

EXPOSE 8001
CMD sh -c "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8001} --workers 2"

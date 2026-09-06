FROM python:3.11.9-slim

# psycopg2-binary needs libpq at runtime; build tools aren't needed since we
# use the -binary wheel, but keep curl for the healthcheck.
RUN apt-get update && apt-get install -y --no-install-recommends \
      libpq5 \
      curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Uploaded files (certs, portfolio images, ID documents, etc.) live here —
# mount a volume at this path in compose/production so they survive
# container recreation.
RUN mkdir -p /app/uploads
ENV UPLOAD_DIR=/app/uploads

ENV PYTHONUNBUFFERED=1
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Migrations run automatically on startup (see app/main.py on_startup ->
# run_migrations()), so there's no separate release-phase step needed here.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

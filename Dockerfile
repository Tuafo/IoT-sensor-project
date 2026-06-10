FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PYTHONUNBUFFERED=1
ENV HBASE_HOST=hbase
ENV HBASE_PORT=9090

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

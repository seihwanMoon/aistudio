FROM python:3.11-slim

# WeasyPrint 의존성 (한국어 PDF)
RUN apt-get update && apt-get install -y \
    libpango-1.0-0 libpangocairo-1.0-0 \
    libcairo2 libgdk-pixbuf2.0-0 \
    fonts-nanum \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Windows에서 FLAML 멀티프로세싱 오류 방지
ENV MULTIPROCESSING_START_METHOD=spawn

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

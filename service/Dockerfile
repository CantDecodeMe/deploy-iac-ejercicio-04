# =====================================================================
# Ejercicio 04 -- Imagen de libros-ms
# =====================================================================
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

WORKDIR /app

# Capa de dependencias aparte: cambiar codigo no reinstala psycopg2, que en
# ARM es lo unico lento de esta construccion.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Usuario sin privilegios, mismo patron que ej03.
RUN useradd --system --uid 10001 --no-create-home libros \
 && mkdir -p /app/release /app/uploads \
 && chown -R libros:libros /app
USER libros

EXPOSE 8000

# 2 workers x 4 hilos, igual que ej03: alcanza de sobra en el Pi y deja
# holgado el pool de PostgreSQL (8 conexiones).
CMD ["gunicorn", \
     "--bind", "0.0.0.0:8000", \
     "--workers", "2", \
     "--threads", "4", \
     "--timeout", "30", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "app:app"]

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libimage-exiftool-perl \
    zip \
    imagemagick \
    ffmpeg \
    bash \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install flask --break-system-packages

WORKDIR /app

COPY web/server.py ./server.py
COPY web/static ./static
COPY tools /tools
RUN chmod +x /tools/*.sh

ENV ORIGINALS_ROOT=/photoprism/originals \
    BACKUP_DIR=/photoprism/originals/.photoprism-tools-backup

EXPOSE 8088

CMD ["python3", "server.py"]

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

RUN pip3 install flask requests --break-system-packages

WORKDIR /app

COPY app/server.py ./server.py
COPY static ./static
COPY scripts /tools
RUN chmod +x /tools/*.sh

ENV ORIGINALS_ROOT=/photoprism/originals \
    BACKUP_DIR=/photoprism/originals/.photoprism-tools-backup \
    PHOTOPRISM_URL=http://localhost:2342

EXPOSE 8088

CMD ["python3", "server.py"]
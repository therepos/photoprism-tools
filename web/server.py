#!/usr/bin/env python3
import os
import json
import subprocess
import threading
import shutil
from flask import Flask, request, jsonify, Response, send_from_directory

app = Flask(__name__, static_folder="static")

ORIGINALS_ROOT = os.environ.get("ORIGINALS_ROOT", "/photoprism/originals")
BACKUP_DIR = os.environ.get("BACKUP_DIR", "/photoprism/originals/.photoprism-tools-backup")

# ── Static UI ─────────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return send_from_directory("static", "index.html")

@app.route("/static/<path:path>")
def static_files(path):
    return send_from_directory("static", path)

# ── List folders ──────────────────────────────────────────────────────────────
@app.route("/api/folders")
def list_folders():
    root = request.args.get("path", ORIGINALS_ROOT)
    try:
        entries = []
        for name in sorted(os.listdir(root)):
            full = os.path.join(root, name)
            if os.path.isdir(full) and not name.startswith("."):
                entries.append({"name": name, "path": full})
        return jsonify({"path": root, "folders": entries})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ── Live Photo Convert — SSE stream ───────────────────────────────────────────
@app.route("/api/livephoto/run")
def livephoto_run():
    photos_dir = request.args.get("photos_dir", ORIGINALS_ROOT)
    backup_dir = request.args.get("backup_dir", BACKUP_DIR)

    def generate():
        proc = subprocess.Popen(
            ["bash", "/tools/livephoto-convert.sh", photos_dir, backup_dir],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )
        for line in proc.stdout:
            line = line.strip()
            if line:
                yield f"data: {line}\n\n"
        proc.wait()

    return Response(generate(), mimetype="text/event-stream",
                    headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

# ── Delete backup zip ─────────────────────────────────────────────────────────
@app.route("/api/livephoto/delete-backup", methods=["POST"])
def delete_backup():
    data = request.get_json()
    zip_path = data.get("backup_zip", "")
    if not zip_path or not zip_path.startswith("/photoprism"):
        return jsonify({"error": "Invalid path"}), 400
    try:
        os.remove(zip_path)
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ── Upload photos ─────────────────────────────────────────────────────────────
@app.route("/api/upload", methods=["POST"])
def upload():
    target_dir = request.form.get("target_dir", ORIGINALS_ROOT)
    if not target_dir.startswith("/photoprism"):
        return jsonify({"error": "Invalid target directory"}), 400

    os.makedirs(target_dir, exist_ok=True)
    uploaded = []
    errors = []

    for f in request.files.getlist("files"):
        if f.filename:
            dest = os.path.join(target_dir, os.path.basename(f.filename))
            try:
                f.save(dest)
                uploaded.append(f.filename)
            except Exception as e:
                errors.append({"file": f.filename, "error": str(e)})

    return jsonify({"uploaded": uploaded, "errors": errors})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8088, threaded=True)

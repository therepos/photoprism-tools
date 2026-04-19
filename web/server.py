#!/usr/bin/env python3
import os
import json
import subprocess
import threading
import shutil
import secrets
import time
import requests as http_requests
from flask import Flask, request, jsonify, Response, send_from_directory

app = Flask(__name__, static_folder="static")

ORIGINALS_ROOT = os.environ.get("ORIGINALS_ROOT", "/photoprism/originals")
BACKUP_DIR = os.environ.get("BACKUP_DIR", "/photoprism/originals/.photoprism-tools-backup")
PHOTOPRISM_URL = os.environ.get("PHOTOPRISM_URL", "http://localhost:2342")

# ── Session store ─────────────────────────────────────────────────────────────
# Maps tools session tokens to { photoprism_session_id, username, created }
sessions = {}
SESSION_MAX_AGE = 86400  # 24 hours

def cleanup_sessions():
    now = time.time()
    expired = [k for k, v in sessions.items() if now - v["created"] > SESSION_MAX_AGE]
    for k in expired:
        del sessions[k]

# ── Auth middleware ────────────────────────────────────────────────────────────
def check_auth():
    """Returns None if authenticated, or a (response, status) tuple if not."""
    token = request.cookies.get("tools_session")
    if not token or token not in sessions:
        return jsonify({"error": "Unauthorized"}), 401
    return None

# ── Login / Logout ────────────────────────────────────────────────────────────
@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json()
    username = data.get("username", "")
    password = data.get("password", "")

    try:
        resp = http_requests.post(
            f"{PHOTOPRISM_URL}/api/v1/session",
            json={"username": username, "password": password},
            timeout=10
        )
        if resp.status_code == 200:
            pp_data = resp.json()
            token = secrets.token_hex(32)
            sessions[token] = {
                "photoprism_session_id": pp_data.get("id", ""),
                "username": username,
                "created": time.time()
            }
            cleanup_sessions()
            response = jsonify({"ok": True, "username": username})
            response.set_cookie("tools_session", token, httponly=True, samesite="Strict", max_age=SESSION_MAX_AGE)
            return response
        else:
            return jsonify({"error": "Invalid credentials"}), 401
    except Exception as e:
        return jsonify({"error": f"Cannot reach PhotoPrism: {str(e)}"}), 502

@app.route("/api/logout", methods=["POST"])
def logout():
    token = request.cookies.get("tools_session")
    if token and token in sessions:
        del sessions[token]
    response = jsonify({"ok": True})
    response.delete_cookie("tools_session")
    return response

@app.route("/api/check")
def check_session():
    token = request.cookies.get("tools_session")
    if token and token in sessions:
        return jsonify({"ok": True, "username": sessions[token]["username"]})
    return jsonify({"ok": False}), 401

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
    auth = check_auth()
    if auth:
        return auth

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
    auth = check_auth()
    if auth:
        return auth

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
    auth = check_auth()
    if auth:
        return auth

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
    auth = check_auth()
    if auth:
        return auth

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
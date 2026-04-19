#!/usr/bin/env python3
import os
import json
import subprocess
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
def get_session():
    """Return the session dict for the current request, or None."""
    token = request.cookies.get("tools_session")
    if not token or token not in sessions:
        return None
    return sessions[token]

def check_auth():
    """Returns None if authenticated, or a (response, status) tuple if not."""
    if get_session() is None:
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

# ── PhotoPrism re-index helper ────────────────────────────────────────────────
def trigger_photoprism_reindex(session_id, photos_dir):
    """
    Trigger a PhotoPrism re-index with rescan=true so that file types are
    re-evaluated from disk. Returns a status dict for the SSE stream.

    PhotoPrism's IndexOptions.Path is relative to the originals root, so we
    strip the ORIGINALS_ROOT prefix before sending. An empty path means
    "re-index everything".
    """
    if not session_id:
        return {"ok": False, "error": "no PhotoPrism session id"}

    # Normalize to a path relative to originals root.
    try:
        abs_photos = os.path.realpath(photos_dir)
        abs_originals = os.path.realpath(ORIGINALS_ROOT)
    except Exception as e:
        return {"ok": False, "error": f"path normalize failed: {e}"}

    if abs_photos == abs_originals:
        rel_path = "/"
    elif abs_photos.startswith(abs_originals + "/"):
        rel_path = abs_photos[len(abs_originals):]  # leading slash preserved
    else:
        # Folder outside originals root — let PhotoPrism decide, send "/".
        rel_path = "/"

    try:
        resp = http_requests.post(
            f"{PHOTOPRISM_URL}/api/v1/index",
            json={"path": rel_path, "rescan": True},
            headers={"X-Session-ID": session_id},
            timeout=30
        )
        if resp.status_code in (200, 201, 204):
            return {"ok": True, "path": rel_path, "status": resp.status_code}
        return {"ok": False, "error": f"HTTP {resp.status_code}: {resp.text[:200]}"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

# ── Live Photo Convert — SSE stream ───────────────────────────────────────────
@app.route("/api/livephoto/run")
def livephoto_run():
    auth = check_auth()
    if auth:
        return auth

    photos_dir = request.args.get("photos_dir", ORIGINALS_ROOT)
    backup_dir = request.args.get("backup_dir", BACKUP_DIR)
    session = get_session()
    pp_session_id = session["photoprism_session_id"] if session else ""

    def generate():
        proc = subprocess.Popen(
            ["bash", "/tools/livephoto-convert.sh", photos_dir, backup_dir],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )
        saw_confirm = False
        converted_total = 0
        for line in proc.stdout:
            line = line.strip()
            if not line:
                continue
            # Try to notice the confirm_backup summary so we know the run
            # succeeded and we should trigger a re-index.
            try:
                parsed = json.loads(line)
                if parsed.get("type") == "confirm_backup":
                    saw_confirm = True
                    converted_total = int(parsed.get("converted", 0))
            except Exception:
                pass
            yield f"data: {line}\n\n"
        proc.wait()

        # Trigger PhotoPrism re-index if anything was converted.
        # Without this, PhotoPrism's DB still holds the old "Live" classification
        # and the UI shows the file as Live even though it's now a plain JPEG.
        if saw_confirm and converted_total > 0:
            yield f"data: {json.dumps({'type': 'log', 'msg': 'Triggering PhotoPrism re-index...'})}\n\n"
            result = trigger_photoprism_reindex(pp_session_id, photos_dir)
            if result.get("ok"):
                msg = f"PhotoPrism re-index started (path: {result.get('path', '/')})"
                yield f"data: {json.dumps({'type': 'log', 'msg': msg})}\n\n"
                yield f"data: {json.dumps({'type': 'reindex', 'ok': True, 'path': result.get('path', '/')})}\n\n"
            else:
                msg = f"Re-index failed: {result.get('error', 'unknown error')}. You may need to re-index manually in PhotoPrism → Library → Index."
                yield f"data: {json.dumps({'type': 'log', 'msg': msg})}\n\n"
                yield f"data: {json.dumps({'type': 'reindex', 'ok': False, 'error': result.get('error', '')})}\n\n"

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

# ── Manual re-index endpoint ──────────────────────────────────────────────────
@app.route("/api/reindex", methods=["POST"])
def manual_reindex():
    """Manually trigger a PhotoPrism re-index. Useful if the automatic one failed."""
    auth = check_auth()
    if auth:
        return auth

    data = request.get_json() or {}
    photos_dir = data.get("photos_dir", ORIGINALS_ROOT)
    session = get_session()
    pp_session_id = session["photoprism_session_id"] if session else ""

    result = trigger_photoprism_reindex(pp_session_id, photos_dir)
    status = 200 if result.get("ok") else 502
    return jsonify(result), status

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

#!/bin/bash
# =============================================================================
# LivePhoto Convert — streams JSON progress lines to stdout
# Called by server.py, output consumed via SSE
#
# Args: $1 = PHOTOS_DIR, $2 = BACKUP_DIR
# JSON line types: progress, activity, log, summary, confirm_backup, error
#
# Samsung strategy:
#   Samsung Motion Photos embed an MP4 inside the JPEG. PhotoPrism classifies
#   a file as "Live" whenever it finds an MP4 `ftyp` atom at a non-zero byte
#   offset (see pkg/media/video/probe.go in the PhotoPrism source). Stripping
#   XMP/EXIF tags alone does NOT remove the embedded MP4 bytes, so PhotoPrism
#   continues to classify the file as Live. To actually convert, we must
#   truncate the file at the `ftyp` offset, then verify no `ftyp` remains.
# =============================================================================

set -euo pipefail

PHOTOS_DIR="${1:-/photoprism/originals}"
BACKUP_DIR="${2:-/photoprism/originals/.photoprism-tools-backup}"

emit() {
  local type="$1"; shift
  local msg="$*"
  echo "{\"type\":\"${type}\",\"msg\":$(python3 -c "import json,sys; print(json.dumps(sys.argv[1]))" "$msg")}"
}

emit_progress() {
  local current="$1" total="$2" activity="$3"
  local pct=0
  [[ "$total" -gt 0 ]] && pct=$(( current * 100 / total ))
  echo "{\"type\":\"progress\",\"current\":${current},\"total\":${total},\"pct\":${pct},\"activity\":$(python3 -c "import json,sys; print(json.dumps(sys.argv[1]))" "$activity")}"
}

if [[ ! -d "$PHOTOS_DIR" ]]; then
  emit "error" "PHOTOS_DIR not found: $PHOTOS_DIR"
  exit 1
fi

PHOTOS_DIR="$(realpath "$PHOTOS_DIR")"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_ZIP="${BACKUP_DIR}/live_photos_backup_${TIMESTAMP}.zip"

emit "log" "Scanning ${PHOTOS_DIR}..."

# ── Count ─────────────────────────────────────────────────────────────────────
TOTAL_JPGS=$(find "$PHOTOS_DIR" -type f \( -iname "*.jpg" -o -iname "*.jpeg" \) | wc -l)
TOTAL_MOVS=$(find "$PHOTOS_DIR" -type f -iname "*.mov" | wc -l)
emit "log" "Found ${TOTAL_JPGS} JPEGs and ${TOTAL_MOVS} MOVs to scan"

# ── Scan Samsung ──────────────────────────────────────────────────────────────
# A Samsung Motion Photo is any JPEG that contains an MP4 `ftyp` atom inside it.
# We detect this by searching the raw file bytes, which mirrors what PhotoPrism
# does. This catches ALL variants (appended MP4, MicroVideoOffset embedded,
# etc.) regardless of whether the XMP tags are present or stripped.
declare -a SAMSUNG_PHOTOS=()
SCANNED=0

if [[ "$TOTAL_JPGS" -gt 0 ]]; then
  emit "log" "Scanning for Samsung Motion Photos (embedded MP4 detection)..."
  while IFS= read -r -d '' jpg; do
    # Ask Python to find an MP4 ftyp atom inside the JPEG.
    # Exit 0 = found (is Motion Photo), 1 = not found, 2 = read error.
    if python3 - "$jpg" <<'PYEOF' 2>/dev/null
import sys
try:
    with open(sys.argv[1], 'rb') as f:
        data = f.read()
except Exception:
    sys.exit(2)
# The ftyp chunk sits 4 bytes into an MP4 box: [size:4][b'ftyp'][brand:4]...
# A Samsung Motion Photo has ftyp at offset > 0 (past the JPEG body).
idx = data.find(b'ftyp')
if idx > 4 and idx + 8 <= len(data):
    sys.exit(0)
sys.exit(1)
PYEOF
    then
      SAMSUNG_PHOTOS+=("$jpg")
    fi
    ((SCANNED++)) || true
    emit_progress "$SCANNED" "$TOTAL_JPGS" "Checking $(basename "$jpg")"
  done < <(find "$PHOTOS_DIR" -type f \( -iname "*.jpg" -o -iname "*.jpeg" \) -print0)
fi

SAMSUNG_COUNT="${#SAMSUNG_PHOTOS[@]}"
emit "log" "Samsung Motion Photos found: ${SAMSUNG_COUNT}"

# ── Scan Apple ────────────────────────────────────────────────────────────────
declare -a APPLE_STILLS=()
declare -a APPLE_MOVS=()
SCANNED=0

if [[ "$TOTAL_MOVS" -gt 0 ]]; then
  emit "log" "Scanning for Apple Live Photos..."
  while IFS= read -r -d '' mov; do
    base="${mov%.*}"
    still=""
    for ext in jpg JPG jpeg JPEG heic HEIC; do
      if [[ -f "${base}.${ext}" ]]; then still="${base}.${ext}"; break; fi
    done
    if [[ -n "$still" ]]; then
      APPLE_STILLS+=("$still")
      APPLE_MOVS+=("$mov")
    fi
    ((SCANNED++)) || true
    emit_progress "$SCANNED" "$TOTAL_MOVS" "Checking $(basename "$mov")"
  done < <(find "$PHOTOS_DIR" -type f -iname "*.mov" -print0)
fi

APPLE_COUNT="${#APPLE_MOVS[@]}"
emit "log" "Apple Live Photos found: ${APPLE_COUNT}"

TOTAL=$((SAMSUNG_COUNT + APPLE_COUNT))

if [[ "$TOTAL" -eq 0 ]]; then
  echo "{\"type\":\"confirm_backup\",\"backup_zip\":\"\",\"backup_size\":\"\",\"samsung\":0,\"apple\":0,\"converted\":0,\"verified\":0,\"failed\":0,\"heic\":0}"
  exit 0
fi

# ── Backup ────────────────────────────────────────────────────────────────────
emit "log" "Creating backup of ${TOTAL} files..."
mkdir -p "$BACKUP_DIR"
declare -a ALL_BACKUP_FILES=()

if [[ "$SAMSUNG_COUNT" -gt 0 ]]; then
  for f in "${SAMSUNG_PHOTOS[@]}"; do
    ALL_BACKUP_FILES+=("${f#$PHOTOS_DIR/}")
  done
fi
if [[ "$APPLE_COUNT" -gt 0 ]]; then
  for i in "${!APPLE_MOVS[@]}"; do
    ALL_BACKUP_FILES+=("${APPLE_STILLS[$i]#$PHOTOS_DIR/}")
    ALL_BACKUP_FILES+=("${APPLE_MOVS[$i]#$PHOTOS_DIR/}")
  done
fi

(cd "$PHOTOS_DIR" && zip -r "$BACKUP_ZIP" "${ALL_BACKUP_FILES[@]}" -q)
BACKUP_SIZE="$(du -sh "$BACKUP_ZIP" | cut -f1)"
emit "log" "Backup created: $(basename "$BACKUP_ZIP") (${BACKUP_SIZE})"

# ── Convert Samsung ───────────────────────────────────────────────────────────
# Truncate the file at the MP4 ftyp offset (or at the JPEG EOI marker 0xFFD9,
# whichever comes first and is valid), then clean up orphan XMP tags, then
# verify no ftyp remains. On verification failure, restore from backup.
SAMSUNG_CONVERTED=0; SAMSUNG_VERIFIED=0; SAMSUNG_FAILED=0

if [[ "$SAMSUNG_COUNT" -gt 0 ]]; then
  emit "log" "Converting Samsung Motion Photos (truncate + verify)..."
  DONE=0
  for jpg in "${SAMSUNG_PHOTOS[@]}"; do
    fname="$(basename "$jpg")"

    # Phase 1: truncate the embedded MP4 from the file bytes.
    truncated=0
    if python3 - "$jpg" <<'PYEOF' 2>/dev/null
import sys, os
path = sys.argv[1]
try:
    with open(path, 'rb') as f:
        data = f.read()
except Exception:
    sys.exit(2)

# The most reliable cut point is the offset just before the MP4 ftyp box.
ftyp_idx = data.find(b'ftyp')
cut = ftyp_idx - 4 if ftyp_idx > 4 else -1

# The byte immediately before the kept region must close the JPEG with FFD9.
# If it does not, walk back to the nearest FFD9 and use that.
if cut > 0:
    kept = data[:cut]
    if kept[-2:] != b'\xff\xd9':
        alt = kept.rfind(b'\xff\xd9')
        if alt < 0:
            sys.exit(1)
        cut = alt + 2

# Fallback: no MP4 found. Use the last FFD9 in the file.
if cut <= 0:
    alt = data.rfind(b'\xff\xd9')
    if alt < 0:
        sys.exit(1)
    cut = alt + 2

if cut <= 0 or cut > len(data):
    sys.exit(1)

kept = data[:cut]
if len(kept) < 4 or kept[-2:] != b'\xff\xd9':
    sys.exit(1)

# Write atomically.
tmp = path + '.trunc.tmp'
try:
    with open(tmp, 'wb') as f:
        f.write(kept)
    os.replace(tmp, path)
except Exception:
    try: os.unlink(tmp)
    except Exception: pass
    sys.exit(2)
sys.exit(0)
PYEOF
    then
      truncated=1
    fi

    if [[ "$truncated" = "1" ]]; then
      # Phase 2: clean up orphan XMP/EXIF tags (non-fatal if it fails).
      exiftool -overwrite_original \
          -MicroVideo= -MicroVideoOffset= -MicroVideoLength= \
          -MicroVideoPresentationTimestampUs= \
          -MotionPhoto= -MotionPhotoVersion= \
          -MotionPhotoPresentationTimestampUs= \
          -EmbeddedVideoType= -EmbeddedVideoFile= \
          -q "$jpg" 2>/dev/null || true

      ((SAMSUNG_CONVERTED++)) || true

      # Phase 3: verify no MP4 ftyp remains in the file.
      if python3 - "$jpg" <<'PYEOF' 2>/dev/null
import sys
try:
    with open(sys.argv[1], 'rb') as f:
        data = f.read()
except Exception:
    sys.exit(2)
if len(data) < 4 or data[-2:] != b'\xff\xd9':
    sys.exit(1)
idx = data.find(b'ftyp')
if idx > 4:
    sys.exit(1)
sys.exit(0)
PYEOF
      then
        ((SAMSUNG_VERIFIED++)) || true
      else
        # Verification failed: restore from backup zip.
        rel="${jpg#$PHOTOS_DIR/}"
        (cd "$PHOTOS_DIR" && unzip -o -q "$BACKUP_ZIP" "$rel") 2>/dev/null || true
        ((SAMSUNG_FAILED++)) || true
        emit "log" "Verify failed, restored: ${fname}"
      fi
    else
      ((SAMSUNG_FAILED++)) || true
      emit "log" "Truncate failed: ${fname}"
    fi
    ((DONE++)) || true
    emit_progress "$DONE" "$SAMSUNG_COUNT" "Stripping ${fname}"
  done
fi

# ── Convert Apple ─────────────────────────────────────────────────────────────
APPLE_CONVERTED=0; APPLE_FAILED=0; HEIC_CONVERTED=0
HAS_CONVERT=0; HAS_FFMPEG=0
command -v convert &>/dev/null && HAS_CONVERT=1
command -v ffmpeg  &>/dev/null && HAS_FFMPEG=1

if [[ "$APPLE_COUNT" -gt 0 ]]; then
  emit "log" "Converting Apple Live Photos..."
  DONE=0
  for i in "${!APPLE_MOVS[@]}"; do
    still="${APPLE_STILLS[$i]}"
    mov="${APPLE_MOVS[$i]}"
    fname="$(basename "$mov")"
    ext="${still##*.}"

    if [[ "${ext,,}" == "heic" ]]; then
      new_still="${still%.*}.jpg"
      converted=0
      [[ "$HAS_CONVERT" = "1" ]] && convert "$still" "$new_still" 2>/dev/null && converted=1
      [[ "$converted" = "0" && "$HAS_FFMPEG" = "1" ]] && ffmpeg -i "$still" "$new_still" -loglevel quiet 2>/dev/null && converted=1
      if [[ "$converted" = "1" ]]; then rm "$still"; ((HEIC_CONVERTED++)) || true; fi
    fi

    if rm "$mov" 2>/dev/null; then
      ((APPLE_CONVERTED++)) || true
    else
      ((APPLE_FAILED++)) || true
    fi
    ((DONE++)) || true
    emit_progress "$DONE" "$APPLE_COUNT" "Removing ${fname}"
  done
fi

# ── Done ──────────────────────────────────────────────────────────────────────
TOTAL_CONVERTED=$((SAMSUNG_CONVERTED + APPLE_CONVERTED))
# Apple has no byte-level verify step — deleting the .mov is atomic.
TOTAL_VERIFIED=$((SAMSUNG_VERIFIED + APPLE_CONVERTED))
TOTAL_FAILED=$((SAMSUNG_FAILED + APPLE_FAILED))

echo "{\"type\":\"confirm_backup\",\"backup_zip\":\"${BACKUP_ZIP}\",\"backup_size\":\"${BACKUP_SIZE}\",\"samsung\":${SAMSUNG_COUNT},\"apple\":${APPLE_COUNT},\"converted\":${TOTAL_CONVERTED},\"verified\":${TOTAL_VERIFIED},\"failed\":${TOTAL_FAILED},\"heic\":${HEIC_CONVERTED}}"

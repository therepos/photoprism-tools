#!/bin/bash
# =============================================================================
# LivePhoto Convert — streams JSON progress lines to stdout
# Called by server.py, output consumed via SSE
#
# Args: $1 = PHOTOS_DIR, $2 = BACKUP_DIR
# JSON line types: progress, activity, log, summary, confirm_backup
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
declare -a SAMSUNG_PHOTOS=()
SCANNED=0

if [[ "$TOTAL_JPGS" -gt 0 ]]; then
  emit "log" "Scanning for Samsung Motion Photos..."
  while IFS= read -r -d '' jpg; do
    if exiftool -q -q -MicroVideo -MotionPhoto "$jpg" 2>/dev/null | grep -qiE "^(Micro Video|Motion Photo)\s*:\s*1"; then
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
  emit "summary" "{\"samsung\":0,\"apple\":0,\"converted\":0,\"failed\":0,\"backup_zip\":\"\"}"
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
SAMSUNG_CONVERTED=0; SAMSUNG_FAILED=0

if [[ "$SAMSUNG_COUNT" -gt 0 ]]; then
  emit "log" "Converting Samsung Motion Photos..."
  DONE=0
  for jpg in "${SAMSUNG_PHOTOS[@]}"; do
    fname="$(basename "$jpg")"
    if exiftool -overwrite_original \
        -MicroVideo= -MicroVideoOffset= -MicroVideoLength= \
        -MicroVideoPresentationTimestampUs= \
        -MotionPhoto= -MotionPhotoVersion= \
        -MotionPhotoPresentationTimestampUs= \
        -EmbeddedVideoType= -EmbeddedVideoFile= \
        -q "$jpg" 2>/dev/null; then
      ((SAMSUNG_CONVERTED++)) || true
    else
      ((SAMSUNG_FAILED++)) || true
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
TOTAL_FAILED=$((SAMSUNG_FAILED + APPLE_FAILED))

echo "{\"type\":\"confirm_backup\",\"backup_zip\":\"${BACKUP_ZIP}\",\"backup_size\":\"${BACKUP_SIZE}\",\"samsung\":${SAMSUNG_COUNT},\"apple\":${APPLE_COUNT},\"converted\":${TOTAL_CONVERTED},\"failed\":${TOTAL_FAILED},\"heic\":${HEIC_CONVERTED}}"

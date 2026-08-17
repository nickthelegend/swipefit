#!/usr/bin/env bash
# Fetches the Kokoro ONNX model and voice pack into .cache/kokoro (gitignored).
# ~337MB total, so it is downloaded on demand rather than committed.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p .cache/kokoro
base="https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0"
for f in kokoro-v1.0.onnx voices-v1.0.bin; do
  if [ -f ".cache/kokoro/$f" ]; then echo "  have $f"; else
    echo "  fetching $f"; curl -fL --progress-bar -o ".cache/kokoro/$f" "$base/$f"
  fi
done

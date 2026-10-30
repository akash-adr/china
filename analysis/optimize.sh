#!/bin/zsh
# Non-destructive: reads originals, writes only into models-optimized/
set -u
mkdir -p models-optimized analysis/data
: > analysis/data/optimize.log
: > analysis/data/optimize.csv
echo "file,before_mb,after_mb" >> analysis/data/optimize.csv
for f in /Users/akash/Documents/vs/china/*.glb; do
  base=$(basename "$f")
  out="/Users/akash/Documents/vs/china/models-optimized/$base"
  before=$(stat -f%z "$f")
  echo "=== $base" >> analysis/data/optimize.log
  npx --no-install gltf-transform optimize "$f" "$out" \
    --texture-compress webp --compress draco >> analysis/data/optimize.log 2>&1
  code=$?
  if [[ $code -ne 0 || ! -f "$out" ]]; then
    echo "  FAILED(optimize) exit=$code, retry without draco" >> analysis/data/optimize.log
    npx --no-install gltf-transform optimize "$f" "$out" --texture-compress webp \
      >> analysis/data/optimize.log 2>&1
  fi
  if [[ -f "$out" ]]; then
    after=$(stat -f%z "$out")
  else
    after=0
  fi
  printf "%s,%.2f,%.2f\n" "$base" $((before/1048576.0)) $((after/1048576.0)) >> analysis/data/optimize.csv
  printf "%-46s %8.2f MB -> %8.2f MB\n" "$base" $((before/1048576.0)) $((after/1048576.0))
done
echo DONE

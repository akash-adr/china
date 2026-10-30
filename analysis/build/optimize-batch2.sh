#!/bin/zsh
# Non-destructive: reads the new candidates, writes only into models-optimized/.
set -u
ROOT=/Users/akash/Documents/vs/china
OUT=$ROOT/models-optimized
mkdir -p $OUT
LOG=$ROOT/analysis/data/optimize-batch2.log
: > $LOG
CSV=$ROOT/analysis/data/optimize-batch2.csv
echo "file,before_mb,after_mb" > $CSV

run() {
  local src=$1; shift
  local base=$(basename "$src")
  local before=$(stat -f%z "$src")
  echo "=== $base" >> $LOG
  npx --no-install gltf-transform optimize "$src" "$OUT/$base" \
    --texture-compress webp --compress draco "$@" >> $LOG 2>&1
  if [[ -f "$OUT/$base" ]]; then
    local after=$(stat -f%z "$OUT/$base")
    printf "%s,%.2f,%.2f\n" "$base" $((before/1048576.0)) $((after/1048576.0)) >> $CSV
    printf "%-34s %8.2f MB -> %7.2f MB  (-%.0f%%)\n" "$base" \
      $((before/1048576.0)) $((after/1048576.0)) $(( (1 - after*1.0/before) * 100 ))
  else
    echo "FAILED: $base (see $LOG)"
    printf "%s,%.2f,0\n" "$base" $((before/1048576.0)) >> $CSV
  fi
}

run $ROOT/ancient_ruins.glb
run $ROOT/broken_medieval_column_set.glb
run $ROOT/cool_staff.glb
run $ROOT/stylized_rock.glb
run $ROOT/stylized_rock-2.glb
run $ROOT/stylized_rock-3.glb
run $ROOT/torri_gate.glb
run $ROOT/black-myth-wukong-kangjinlongfrom-the-vault/source/kjwl.glb --simplify false
run $ROOT/pagoda-and-cherry-blossom-game-scene-baked/source/japanese_cherrybake.glb
echo DONE

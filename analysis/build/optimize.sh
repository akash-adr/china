#!/bin/zsh
# Final pass. Sources are either the untouched originals at the project root
# or staged intermediates; outputs go only to ./public/models/.
set -u
ROOT=/Users/akash/Documents/vs/china
STAGE=$1
OUT=$ROOT/public/models
mkdir -p $OUT
LOG=$ROOT/analysis/data/final-optimize.log
: > $LOG

run() {
  local src=$1 dst=$2; shift 2
  echo "=== $dst" >> $LOG
  npx --no-install gltf-transform optimize "$src" "$OUT/$dst" \
    --texture-compress webp --compress draco "$@" >> $LOG 2>&1
  if [[ -f "$OUT/$dst" ]]; then
    printf "%-34s %8.2f MB\n" "$dst" $(( $(stat -f%z "$OUT/$dst") / 1048576.0 ))
  else
    echo "FAILED: $dst (see $LOG)"
  fi
}

# Chapter 6 budget: lantern + full-res pagoda alone was 501,720 tris, over the
# 500K target before the temple scan contributed anything. Pagoda simplified to
# ~232K; still dense for a 20 m building, and it benefits Chapter 3 too.
run $STAGE/chinese_pagoda.glb            chinese_pagoda.glb            --texture-size 2048 --simplify-ratio 0.45 --simplify-error 0.005
# Far-LOD only: this scan is never anything but a fogged silhouette, so it ships
# at ~208K / 1024 instead of 909K / 2048. The full-res file is not shipped.
run $ROOT/jinshan_temple_cishou_pagoda.glb jinshan_temple_cishou_pagoda_far.glb --texture-size 1024 --simplify-ratio 0.22 --simplify-error 0.01
run $STAGE/fantasy_style_tree.glb        fantasy_style_tree.glb        --texture-size 2048 --simplify false
run $ROOT/dragon_with_pearl.glb          dragon_with_pearl.glb         --simplify-ratio ${DRAGON_RATIO:-0.15} --simplify-error 0.002
# Two named clips from one skinned mesh: dragon_flyby (root motion intact) and
# dragon_hover (root translation pinned). Built by analysis/build/dragon-clips.mjs,
# which shares accessors so the second clip costs almost nothing.
run $STAGE/chinese_dragon_clips.glb      chinese_dragon.glb            --texture-size 2048 --simplify false --resample true
run $ROOT/stone_lion.glb                 stone_lion.glb                --texture-size 1024
run $STAGE/chinese_dragon_fan.glb        chinese_dragon_fan.glb        --texture-size 2048
run $ROOT/module_2_-_chinese_lantern.glb module_2_-_chinese_lantern.glb --texture-size 2048
# Batch 2 promotion. --palette false keeps the 10 named materials (roof, legs,
# base, bell, decor, name_board, ...) so each part can be retinted independently
# in code; palette merging would collapse them to PaletteMaterial001..003.
run $ROOT/torri_gate.glb                 torri_gate.glb                --texture-size 2048 --palette false

# Four separate weathered stone stumps for Chapter 3 rubble. 1024 textures:
# at 2048 these cost 255 MB VRAM for 4,664 triangles of background prop.
run $ROOT/broken_medieval_column_set.glb broken_medieval_column_set.glb --texture-size 1024
# Foreground parallax boulder, instanced. Already 1024.
run $ROOT/stylized_rock.glb              stylized_rock.glb             --texture-size 1024

# staff_of_homa / staff_placeholder removed 2026-10-26: Genshin Impact asset rip,
# not licensable. Source and outputs are in _rejected/. Chapter 4 needs a
# licensable Ruyi Jingu Bang before this line comes back.
# run $ROOT/staff_of_homa.glb            staff_placeholder.glb         --texture-size 2048
echo DONE

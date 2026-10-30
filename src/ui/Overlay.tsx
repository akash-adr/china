import { useEffect, useState } from 'react';
import { CHAPTERS, CHAPTER_RANGES } from '@/config/chapters';
import { progress, onProgress } from '@/scroll/progress';
import './Overlay.css';

const ALIGN = ['center', 'left', 'right', 'center', 'left', 'center'] as const;

/**
 * The scrolling DOM layer. The sections exist to generate scroll height and to
 * position the titles; the imagery is all in the canvas behind them.
 */
export function Overlay() {
  const active = useActiveChapter();

  return (
    <>
      <div className="scroll-root">
        {CHAPTERS.map((c, i) => (
          <section
            key={c.id}
            id={c.id}
            className="chapter-section"
            data-align={ALIGN[i % ALIGN.length]}
            style={{ height: `${c.scrollVh}vh` }}
          >
            {/* Sticky, so the title stays centred for the whole chapter rather
                than scrolling past while its chapter is still playing. */}
            <div className="chapter-sticky">
              <div className="chapter-title" data-active={active === i}>
                <span className="numeral gold-glow">{c.numeral}</span>
                <h2 className="hanzi gold-glow">{c.title}</h2>
                <span className="subtitle gold-glow">{c.subtitle}</span>
                <span className="index">
                  Chapter {c.index} of {CHAPTERS.length}
                </span>
              </div>
            </div>
          </section>
        ))}
      </div>

      <ChapterDots active={active} />
      <ScrollHint />
    </>
  );
}

/**
 * Re-renders only when the chapter index changes — not on every scroll frame.
 */
function useActiveChapter(): number {
  const [index, setIndex] = useState(progress.chapter);
  useEffect(() => onProgress(() => {
    setIndex((prev) => (prev === progress.chapter ? prev : progress.chapter));
  }), []);
  return index;
}

function ChapterDots({ active }: { active: number }) {
  return (
    <nav className="chapter-dots" aria-label="Chapters">
      {CHAPTERS.map((c, i) => (
        <button
          key={c.id}
          type="button"
          data-active={active === i}
          aria-label={`${c.index}. ${c.subtitle}`}
          aria-current={active === i ? 'true' : undefined}
          onClick={() => {
            const y = CHAPTER_RANGES[i].start * (document.body.scrollHeight - window.innerHeight);
            window.scrollTo({ top: y, behavior: 'smooth' });
          }}
        >
          <span className="dot-label">{c.subtitle}</span>
        </button>
      ))}
    </nav>
  );
}

function ScrollHint() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => onProgress((p) => setHidden(p > 0.02)), []);
  return (
    <div className="scroll-hint" style={{ opacity: hidden ? 0 : 1 }}>
      Scroll
    </div>
  );
}

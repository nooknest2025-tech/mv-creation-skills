import { describe, expect, it } from 'vitest';
import { resolveLines } from '../src/lib/resolve';
import { charTimes } from '../src/lib/song';
import { trait } from '../src/lib/traits';
import type { Song } from '../src/lib/types';

function sampleSong(): Song {
  const phrases = [
    { text: 'ゆっくりと', start: 1, end: 5 },
    { text: '窓の向こうの光を追いかけて夜の街を駆け抜ける', start: 5.3, end: 6.3 },
  ];
  return {
    title: '密度が違う二行', duration: 10, fps: 30, bpm: 120, phase: 0, beatsPerBar: 4,
    energy: [], energyHz: 0,
    sections: [{ label: 'A', type: 'verse', start: 0, end: 10 }],
    lines: phrases.map((p) => ({ ...p, ...charTimes(p.text, p.start, p.end) })),
  };
}

describe('fast lyric line within a slower section', () => {
  it('keeps the fast line out of styles marked hard to read', () => {
    for (const genre of ['hiphop', 'rock_edm', 'idol_pop', 'dark'] as const) {
      for (let seed = 1; seed <= 100; seed++) {
        const lines = resolveLines(sampleSong(), { genre, seed, variety: 1 });
        expect(trait(lines[1].style).readable, `${genre} seed ${seed}: ${lines[1].style}`).toBeGreaterThanOrEqual(0.75);
      }
    }
  });
  it('preserves an explicitly selected motion even for a fast line', () => {
    const lines = resolveLines(sampleSong(), { genre: 'hiphop', lines: { '1': 'glitch' } });
    expect(lines[1].style).toBe('glitch');
    expect(lines[1].locked).toBe(true);
  });
});

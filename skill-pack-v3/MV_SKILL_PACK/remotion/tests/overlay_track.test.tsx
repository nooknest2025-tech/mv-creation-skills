import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { makeOverlay, moveOverlay, resizeOverlay } from '../editor/overlay-track';
import { Scene } from '../editor/editor-scene';
import { prepareProject } from '../scripts/editor';

describe('independent upper visual track', () => {
  it('moves independently and trims the video in-point only when the left edge changes', () => {
    const c = makeOverlay('OVER-1', 1, 3, 20, 8)!;
    moveOverlay(c, 8, 20); expect([c.start, c.end, c.from]).toEqual([8, 12, 0]);
    const original = { ...c }; resizeOverlay(c, original, 'start', 9, 20, true, 8);
    expect([c.start, c.end, c.from]).toEqual([9, 12, 1]);
    resizeOverlay(c, { ...c }, 'start', 7, 20, true, 8);
    expect([c.start, c.from]).toEqual([8, 0]);
    resizeOverlay(c, { ...c }, 'end', 50, 20, true, 8); expect(c.end).toBe(20);
  });
  it('shows the upper image above both base scenes and below lyrics, only during its interval', () => {
    const data = { duration: 10, width: 1280, height: 720, fps: 30, bpm: 120,
      assets: ['base-a.png', 'base-b.png', 'overlay.png'],
      scenes: [{ id: 'S1', start: 0, asset: 0, transition: 0 }, { id: 'S2', start: 4, asset: 1, transition: 0 }], lyrics: [],
      overlays: [{ ...makeOverlay('OVER-1', 2, 2, 10)!, end: 7, x: .1, y: .2, w: .5, h: .4, opacity: .5 }] };
    const html = (t: number) => renderToStaticMarkup(<Scene data={data} t={t}/>);
    expect(html(1)).not.toContain('overlay.png'); expect(html(2)).toContain('overlay.png');
    const h = html(5); expect(h).toContain('base-b.png'); expect(h).toContain('overlay.png'); expect(h).toContain('opacity:0.5');
    expect(html(7)).not.toContain('overlay.png');
  });
  it('uses the same source time for preview and export, freezing the last frame when needed', () => {
    const times: number[] = [];
    const data = { duration: 10, width: 1280, height: 720, fps: 25, bpm: 120,
      assets: ['base.png', { src: 'overlay.mp4', kind: 'video', duration: 3 }], scenes: [{ id: 'S1', start: 0, asset: 0, transition: 0 }], lyrics: [],
      overlays: [{ ...makeOverlay('OVER-1', 1, 2, 10)!, end: 8, from: 1 }] };
    const draw = (t: number) => renderToStaticMarkup(<Scene data={data} t={t} video={(_src, at) => { times.push(at); return <span/>; }}/>);
    draw(3); expect(times.at(-1)).toBe(2); draw(7); expect(times.at(-1)).toBeCloseTo(2.96);
  });
});

const py = ['python3', 'python'].find(c => spawnSync(c, ['--version']).status === 0);
describe.skipIf(!py)('upper track save validation', () => {
  it('saves and reloads clips and rejects invalid assets, times and geometry', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mv-overlay-')); fs.writeFileSync(path.join(dir, 'mv.config.json'), '{}');
    const prepared = prepareProject({ demo: true, project: dir }); const port = 5700 + Math.floor(Math.random() * 200);
    const srv = spawn(py!, [path.resolve(__dirname, '../editor/server.py'), '--root', prepared.runtime, '--port', String(port)], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, MV_NO_PICKER: '1' } });
    const url: string = await new Promise((resolve, reject) => { srv.stdout.on('data', b => { const m = String(b).match(/http:\/\/127\.0\.0\.1:\d+/); if (m) resolve(m[0]); }); setTimeout(() => reject(Error('server timeout')), 8000); });
    try {
      let state = await (await fetch(url + '/api/state')).json();
      const clip = makeOverlay('OVER-1', 0, .5, state.data.duration)!;
      const save = async (o: any) => { const data = structuredClone(state.data); data.overlays = [o]; return fetch(url + '/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision: state.revision, data }) }); };
      expect((await save({ ...clip, asset: 999 })).status).toBe(400);
      expect((await save({ ...clip, end: state.data.duration + 1 })).status).toBe(400);
      expect((await save({ ...clip, x: 1.8, w: .5 })).status).toBe(400);
      expect((await save(clip)).status).toBe(200);
      state = await (await fetch(url + '/api/state')).json(); expect(state.data.overlays).toEqual([clip]);
    } finally { srv.kill(); }
  }, 20000);
});

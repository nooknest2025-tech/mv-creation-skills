import React from "react";
import { Composition, staticFile } from "remotion";
import { MV, Showcase } from "./render/Compositions";
import { Timeline } from "./render/Timeline";
import { FontSheet } from "./render/FontSheet";
import type { RenderProps } from "./lib/types";
import { buildProps } from "./lib/pipeline";

const empty: RenderProps = { width: 1920, height: 1080, fps: 30, durationInFrames: 150, startAt: 0, lines: [], shots: [], beat: { bpm: 120, phase: 0, beatsPerBar: 4 },
  grade: { name: "none", filter: "none", vignette: 0.3, grain: 0 }, shake: 0, leaks: 0, particles: 0, overlayOnly: false, textSize: 1, textY: 0.84 };

// Studio: reads public/project/{song.json, mv.config.json, media.json} written by `npm run mv`, so edits
// to mv.config.json / timing show after a Studio reload. CLI renders pass fully-built props instead.
const fromProject = async ({ props }: { props: RenderProps }) => {
  if (props.lines?.length || props.shots?.length) return { props, width: props.width, height: props.height, fps: props.fps, durationInFrames: props.durationInFrames };
  try {
    const [song, cfg, media] = await Promise.all(["song.json", "mv.config.json", "media.json"].map((f) => fetch(staticFile(`project/${f}`)).then((r) => (r.ok ? r.json() : null))));
    if (!song) return { props };
    const p = buildProps(song, cfg ?? {}, media ?? [], { audio: cfg?.audioFile });
    return { props: p, width: p.width, height: p.height, fps: p.fps, durationInFrames: p.durationInFrames };
  } catch { return { props }; }
};

export const Root: React.FC = () => <>
  <Composition id="MV" component={MV as any} defaultProps={empty} width={1920} height={1080} fps={30} durationInFrames={150} calculateMetadata={fromProject as any} />
  <Composition id="LyricOverlay" component={MV as any} defaultProps={{ ...empty, overlayOnly: true }} width={1920} height={1080} fps={30} durationInFrames={150} calculateMetadata={(async (a: any) => { const r = await fromProject(a); return { ...r, props: { ...r.props, overlayOnly: true } }; }) as any} />
  <Composition id="Showcase" component={Showcase as any} defaultProps={empty} width={1920} height={1080} fps={30} durationInFrames={150} calculateMetadata={fromProject as any} />
  <Composition id="Timeline" component={Timeline as any} defaultProps={{ data: null }} width={3000} height={820} fps={30} durationInFrames={1} />
  <Composition id="FontSheet" component={FontSheet as any} defaultProps={{}} width={1920} height={1500} fps={30} durationInFrames={1} />
</>;

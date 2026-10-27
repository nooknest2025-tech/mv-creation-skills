import { Config } from "@remotion/cli/config";
Config.setEntryPoint("src/index.ts");
Config.setVideoImageFormat("jpeg");
Config.setConcurrency(null);
// Windows: GPU-backed ANGLE is ~30% faster than the default software path (measured: 120 frames 1080p 49s -> 34s, i7-1165G7).
// Override with MVPACK_GL=swangle (or any Remotion gl value) if a GPU driver misbehaves.
if (process.platform === "win32" || process.env.MVPACK_GL) Config.setChromiumOpenGlRenderer((process.env.MVPACK_GL as any) || "angle");

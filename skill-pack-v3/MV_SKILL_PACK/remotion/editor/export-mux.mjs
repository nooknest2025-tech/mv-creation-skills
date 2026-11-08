/** Mux without changing either rendered video or the original audio stream. */
export function muxArgs(silent, audio, duration, output) {
  return ['-y','-v','error','-i',silent,'-i',audio,'-map','0:v','-map','1:a','-c','copy','-t',String(duration),'-movflags','+faststart',output];
}

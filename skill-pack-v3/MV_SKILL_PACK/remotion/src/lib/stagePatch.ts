/**
 * v6.6 generic stage edits (pack-wide): any custom stage (立ち絵 etc.) = built-in definition (asset.stage, kept unchanged in
 * original-source.json) + editor patches that always win:
 *   data.stage        project-wide patch (e.g. guests, interlude telop, name tags)  -> every custom stage
 *   scene.stage       per-cut patch (e.g. character position / size / hide)          -> that scene only
 * Patch rules: objects deep-merge; an array of {id} objects can be patched by an object keyed by id; any other array is replaced whole.
 * No patch -> the very same stage object (pixel-identical to the built-in look).
 */
const isObj = (x: any) => !!x && typeof x === "object" && !Array.isArray(x);
export function mergePatch(base: any, patch: any): any {
  if (patch === undefined) return base;
  if (Array.isArray(base) && isObj(patch) && base.every((b) => isObj(b) && "id" in b)) return base.map((b) => (b.id in patch ? mergePatch(b, patch[b.id]) : b));
  if (isObj(base) && isObj(patch)) { const out: any = { ...base }; for (const k of Object.keys(patch)) out[k] = mergePatch(base[k], patch[k]); return out; }
  return patch;
}
export const hasPatch = (p: any) => isObj(p) && Object.keys(p).length > 0;
/** the stage a scene actually renders. */
export function stageFor(data: any, sceneIdx: number, stage: any) {
  const a = data?.stage, b = data?.scenes?.[sceneIdx]?.stage;
  if (!hasPatch(a) && !hasPatch(b)) return stage;
  // project-wide keys only touch stages that already have them (a guests/pause edit must not add guests or an interlude to other cuts)
  const a2 = hasPatch(a) ? Object.fromEntries(Object.entries(a).filter(([k]) => stage && k in stage)) : undefined;
  return mergePatch(mergePatch(stage, a2), hasPatch(b) ? b : undefined);
}
type Path = (string | number)[];
const getAt = (o: any, p: Path) => p.reduce((x, k) => (x == null ? undefined : Array.isArray(x) && typeof k === "string" ? x.find((e: any) => e?.id === k) : x[k]), o);
/** write `value` at `path` into the patch `root` so that mergePatch(base, root) has it; arrays of plain items are copied whole. Values equal to the base are pruned. */
export function setPatch(root: any, base: any, path: Path, value: any, dflt?: any): any {
  root = isObj(root) ? root : {};
  let p = root, b = base;
  for (let i = 0; i < path.length; i++) {
    const k = path[i], last = i === path.length - 1;
    if (Array.isArray(b) && typeof k === "number") { // plain array: patch holds the full array
      const parentKey = path[i - 1]; void parentKey;
      return root; // handled by caller via setArrayPatch
    }
    if (last) { const bv = getAt(base, path); if (JSON.stringify(bv === undefined ? dflt : bv) === JSON.stringify(value)) delete p[k]; else p[k] = value; break; }
    const nb = Array.isArray(b) && typeof k === "string" ? b.find((e: any) => e?.id === k) : b?.[k];
    if (!isObj(p[k])) p[k] = {};
    p = p[k]; b = nb;
  }
  return prune(root);
}
export function prune(o: any): any { if (!isObj(o)) return o; for (const k of Object.keys(o)) { if (isObj(o[k])) { prune(o[k]); if (!Object.keys(o[k]).length) delete o[k]; } } return o; }
/** list editors: copy a plain array (e.g. guests.peeks) into the patch once, then edit the copy. */
export function arrayPatch(root: any, base: any, path: Path): any[] {
  let p = root; for (let i = 0; i < path.length - 1; i++) { if (!isObj(p[path[i]])) p[path[i]] = {}; p = p[path[i]]; }
  const k = path[path.length - 1]; if (!Array.isArray(p[k])) p[k] = structuredClone(getAt(base, path) ?? []); return p[k];
}
export { getAt };
/** project-wide guest/telop data a stage exposes (first stage that has it). */
export const firstWith = (data: any, key: string) => (data?.assets ?? []).find((a: any) => a?.stage?.[key])?.stage;

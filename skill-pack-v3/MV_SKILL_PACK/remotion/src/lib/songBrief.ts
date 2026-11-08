export type SongMood='calm'|'bright'|'intense'|'melancholy';
export const SONG_MOOD_JA:Record<SongMood,string>={calm:'静か・穏やか',bright:'明るい',intense:'力強い',melancholy:'切ない'};
// Keep the original description; only map explicit, unambiguous terms.
export function parseSongBrief(text:string):{text:string;genre?:string;mood?:SongMood;unresolved:string[]} {
 const t=text.trim();
 const matches:[string,RegExp][]=[['acoustic',/アコースティック|弾き語り|acoustic/i],['ballad',/バラード|ballad/i],['rock_edm',/ロック|rock|edm/i],['citypop_jazz',/シティポップ|city\s*pop|ジャズ|jazz/i],['idol_pop',/アイドル|ポップ|idol|pop/i],['hiphop',/ヒップホップ|hip\s*hop|ラップ|rap/i],['wa',/和風|演歌|民謡/],['dark',/ダーク|ボカロ|dark/],['ambient',/アンビエント|チル|ambient|chill/i]];
 const genres=matches.filter(([,re])=>re.test(t)).map(([g])=>g);
 // City pop is more specific than the word "ポップ".
 // Acoustic is an arrangement when a ballad genre is also explicitly given.
 const filtered=genres.filter(g=>!(g==='idol_pop'&&genres.includes('citypop_jazz'))&&!(g==='acoustic'&&genres.includes('ballad')));
 const moods: [SongMood,RegExp][]=[['calm',/静か|穏やか|繊細|落ち着|ゆったり|しっとり/],['bright',/明るい|楽しい|爽やか|軽快/],['intense',/力強い|激しい|熱い|迫力/],['melancholy',/切ない|哀しい|悲しい|もの悲しい/]];
 const found=moods.filter(([,re])=>re.test(t)).map(([m])=>m);
 const compatible=found.length===2 && found.includes('calm') && found.includes('melancholy');
 const unresolved:string[]=[];
 if(t&&!filtered.length)unresolved.push('ジャンルは未特定');
 if(filtered.length>1)unresolved.push('ジャンルが複数あり未特定');
 if(found.length>1&&!compatible)unresolved.push('複数の曲調があり自動演出には未反映');
 else if(t&&!found.length)unresolved.push('曲調は未特定');
 return {text:t,...(filtered.length===1?{genre:filtered[0]}:{}),...(found.length===1?{mood:found[0]}:compatible?{mood:'melancholy' as const}:{}),unresolved};
}

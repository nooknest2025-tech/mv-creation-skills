// Prerequisite checker (pure part: catalogue + report). Probing lives in doctor.ts; tests feed fake probe results.
export type Need = "必須" | "推奨" | "任意";
export type Cost = "無料" | "無料枠あり" | "有料";
export interface Tool {
  id: string; ja: string; need: Need; cost: Cost; costNote: string; // price/plan text + where/when verified
  why: string; without: string; // what it is for / what you lose without it
  install: { win?: string; mac?: string; linux?: string; pip?: string; npm?: string }; link: string;
}
const CHECKED = "2026-10-27確認";
export const TOOLS: Tool[] = [
  { id: "node", ja: "Node.js（18以上）", need: "必須", cost: "無料", costNote: "オープンソース", why: "このパックの本体（Remotion）を動かす土台", without: "何も動きません", install: { win: "winget install OpenJS.NodeJS.LTS", mac: "brew install node", linux: "sudo apt install -y nodejs npm" }, link: "https://nodejs.org/ja" },
  { id: "npm", ja: "npm", need: "必須", cost: "無料", costNote: "Node.js に同梱", why: "部品のインストール（npm install）", without: "セットアップできません", install: { win: "winget install OpenJS.NodeJS.LTS", mac: "brew install node", linux: "sudo apt install -y npm" }, link: "https://nodejs.org/ja" },
  { id: "deps", ja: "Remotion 部品（npm install 済み）", need: "必須", cost: "無料", costNote: `個人・3人以下の会社・非営利は無料（商用も可）。4人以上の営利企業は Company License が必要（https://www.remotion.dev/license ${CHECKED}）`, why: "動画を組み立てて書き出すエンジン", without: "書き出しできません", install: { npm: "npm install" }, link: "https://www.remotion.dev/docs/license" },
  { id: "browser", ja: "Chrome Headless Shell（Remotion 用ブラウザ）", need: "必須", cost: "無料", costNote: "初回レンダリング時に Remotion が自動ダウンロード", why: "画面を1コマずつ描く", without: "書き出しできません（自動取得に失敗したらネット接続を確認）", install: { npm: "npx remotion browser ensure" }, link: "https://www.remotion.dev/docs/miscellaneous/chrome-headless-shell" },
  { id: "ffmpeg", ja: "ffmpeg（システム版）", need: "推奨", cost: "無料", costNote: "オープンソース", why: "音声解析・動画の切り出しを速くする", without: "Remotion 同梱の ffmpeg で動きます（少し遅いだけ）", install: { win: "winget install Gyan.FFmpeg", mac: "brew install ffmpeg", linux: "sudo apt install -y ffmpeg" }, link: "https://ffmpeg.org/download.html" },
  { id: "git", ja: "git", need: "任意", cost: "無料", costNote: "オープンソース", why: "パックの更新・やり直し履歴", without: "zip で使う分には不要", install: { win: "winget install Git.Git", mac: "brew install git", linux: "sudo apt install -y git" }, link: "https://git-scm.com/downloads" },
  { id: "python", ja: "Python 3", need: "推奨", cost: "無料", costNote: "オープンソース", why: "歌詞の自動書き起こし・顔検出（目パチ口パク）・画像解析（文字の位置と色）", without: "歌詞ファイル(SRT/LRC/txt)があれば動きます。目パチ口パクは手動指定（npm run faces）、文字位置は既定位置になります", install: { win: "winget install Python.Python.3.12", mac: "brew install python", linux: "sudo apt install -y python3 python3-pip python3-venv" }, link: "https://www.python.org/downloads/" },
  { id: "pillow", ja: "Pillow + numpy（Python）", need: "推奨", cost: "無料", costNote: "オープンソース", why: "画像解析（顔・ごちゃごちゃした所を避けて文字を置く／背景に合う文字色）", without: "文字は既定位置・既定色", install: { pip: "pip install pillow numpy" }, link: "https://pypi.org/project/pillow/" },
  { id: "opencv", ja: "OpenCV 4（Python）", need: "任意", cost: "無料", costNote: "オープンソース（opencv-python-headless<5）", why: "アニメ顔の自動検出（目パチ・口パク）", without: "目と口の位置を npm run faces で手動指定すれば使えます", install: { pip: "pip install \"opencv-python-headless<5\"" }, link: "https://pypi.org/project/opencv-python-headless/" },
  { id: "psd_tools", ja: "psd-tools（Python・パーツアニメのPSD読み込み）", need: "任意", cost: "無料", costNote: "オープンソース（MIT License）", why: "PSD のレイヤーをそのままパーツとして読み込む（npm run parts -- import file.psd）", without: "レイヤーを PNG で書き出したフォルダなら読み込めます", install: { pip: "pip install psd-tools" }, link: "https://pypi.org/project/psd-tools/" },
  { id: "rembg", ja: "rembg（Python・1枚絵のパーツ分解で背景を切り抜く）", need: "任意", cost: "無料", costNote: "ローカル実行（rembg: MIT License。初回に U2-Net モデル約170MB を自動取得: Apache-2.0）。商用可だが各モデルのライセンスを確認", why: "1枚絵からキャラだけを切り抜く精度が上がる（npm run parts -- split）", without: "透過PNGか単色背景の画像なら切り抜けます（精度は下がる）", install: { pip: "pip install \"rembg[cpu]\"" }, link: "https://github.com/danielgatis/rembg" },
  { id: "whisper", ja: "faster-whisper（Python）", need: "任意", cost: "無料", costNote: "ローカル実行・オープンソース（モデルは初回に自動取得）", why: "歌詞ファイルが無い時の自動書き起こし", without: "歌詞ファイルを用意してください（タイミングは自動合わせ）", install: { pip: "pip install faster-whisper" }, link: "https://github.com/SYSTRAN/faster-whisper" },
  { id: "disk", ja: "空き容量（5GB以上）", need: "必須", cost: "無料", costNote: "-", why: "書き出し・一時ファイル・書体", without: "書き出しが途中で失敗します", install: {}, link: "" },
  { id: "gpu", ja: "GPU（NVIDIA）", need: "任意", cost: "無料", costNote: "あれば使う", why: "書き起こし（whisper）が速くなる", without: "CPU で動きます（遅いだけ）", install: {}, link: "" },
  { id: "codex", ja: "Codex（日本語で指示するAI）", need: "推奨", cost: "無料枠あり", costNote: `ChatGPT の Free/Go でも期間限定で利用可、Plus $20/月・Pro $100〜/月・Business $25/人/月（月払い）に含まれる（https://chatgpt.com/codex/pricing ${CHECKED}）`, why: "「サビはグリッチで」など日本語で頼むだけで編集", without: "npm run start（対話ウィザード）と npm run edit -- \"指示\" で同じ操作ができます", install: { npm: "npm install -g @openai/codex" }, link: "https://developers.openai.com/codex" },
  { id: "studio", ja: "Remotion Studio（プレビュー画面）", need: "任意", cost: "無料", costNote: "Remotion に同梱（ライセンス条件は上記と同じ）", why: "ブラウザで1コマずつ確認・微調整", without: "静止画プレビュー（自動）で確認できます", install: { npm: "npm run studio" }, link: "https://www.remotion.dev/docs/studio" },
  { id: "davinci", ja: "DaVinci Resolve", need: "任意", cost: "無料", costNote: `無料版で十分（4K/60p まで）。Studio は買い切り US$295（2026/11/20 まで US$236）（blackmagicdesign.com ${CHECKED}）`, why: "仕上げを自分で編集したい時（透過歌詞・FCPXML 書き出しに対応）", without: "このパックだけで完成 MP4 まで作れます", install: {}, link: "https://www.blackmagicdesign.com/jp/products/davinciresolve" },
  { id: "video_mcp", ja: "動画生成 MCP（Pollo / Grok Imagine / Runway など）", need: "任意", cost: "有料", costNote: `Grok Imagine API: video-1.5-lite $0.02/秒(480p)〜, video-1.5 $0.08〜0.25/秒（docs.x.ai/developers/pricing ${CHECKED}）／Runway: 無料125クレジット(1回)、Standard $15/月=625クレジット≒Gen-4.5で52秒（runway.com/pricing ${CHECKED}）／Pollo: プランは pollo.ai/pricing を確認（第三者情報: Lite $15/月 400クレジット。公式未確認）`, why: "静止画から動く映像クリップを作る", without: "無料ルート（静止画にカメラワーク・目パチ・口パク・音反応エフェクト）で完成します", install: {}, link: "../docs/SETUP_GUIDE_ja.md#動画生成mcpをcodexにつなぐ" },
];
export type Probe = Record<string, { ok: boolean; detail?: string }>;
export type OS = "win" | "mac" | "linux";
export interface Line { tool: Tool; ok: boolean; detail?: string; fix?: string }
export function report(p: Probe, os: OS): { lines: Line[]; text: string; blocking: Line[]; fixes: Line[] } {
  const lines: Line[] = TOOLS.map((t) => { const r = p[t.id] ?? { ok: false, detail: "未確認" }; const fix = r.ok ? undefined : t.install[os] ?? (t.install.pip ? `${p.python?.ok ? "" : "(先に Python) "}${t.install.pip}` : t.install.npm); return { tool: t, ok: r.ok, detail: r.detail, fix }; });
  const blocking = lines.filter((l) => !l.ok && l.tool.need === "必須");
  const fixes = lines.filter((l) => !l.ok && !!l.fix);
  const out: string[] = ["🔍 環境チェック（doctor）", ""];
  for (const l of lines) {
    const t = l.tool, mark = l.ok ? "✅" : t.need === "必須" ? "❌" : t.need === "推奨" ? "⚠️" : "➖";
    out.push(`${mark} ${t.ja}［${t.need}・${t.cost}］${l.detail ? ` ${l.detail}` : ""}`);
    if (!l.ok) {
      out.push(`   何に使う: ${t.why}`);
      out.push(`   無いと: ${t.without}`);
      if (l.fix) out.push(`   入れ方（1コマンド）: ${l.fix}`);
      if (t.link) out.push(`   公式: ${t.link}`);
    }
    if (t.cost !== "無料" || t.id === "deps") out.push(`   料金: ${t.costNote}`);
  }
  out.push("");
  out.push(blocking.length ? `❌ 必須が ${blocking.length} 件足りません: ${blocking.map((l) => l.tool.ja).join("、")}。上の「入れ方」を実行してから、もう一度 doctor を実行してください。` : "✅ 必須はそろっています。足りない任意ツールは、無くても代わりの方法で動きます。");
  out.push("💸 完全無料ルート: 静止画モード（カメラワーク＋目パチ口パク＋音反応）・ローカル書き起こし（faster-whisper）・無料書体（OFL）・Remotion（個人/小規模は無料）で、MP4 完成まで0円。");
  out.push("   有料オプション: 動画生成 MCP（Grok/Runway/Pollo 等、使った分だけ）、Codex の上位プラン、DaVinci Resolve Studio。");
  if (fixes.length) out.push(`\n👉 足りない物をまとめて入れるなら: npm run doctor -- --fix（1つずつ確認してから実行します）`);
  return { lines, text: out.join("\n"), blocking, fixes };
}

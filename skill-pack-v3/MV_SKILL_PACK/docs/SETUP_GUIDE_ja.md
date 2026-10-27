# セットアップガイド（Windows / Mac / Linux）

**まず `doctor.bat`（Windows）か `./doctor.sh`（Mac/Linux）を実行**してください。足りない物と入れ方を日本語で表示し、入れるかどうかを1つずつ聞きます（勝手には入れません）。Node.js が無くても動く最初のチェックです。

料金は 2026-10-27 時点で各公式ページを確認した値です（変わることがあります）。

## 必要なもの一覧
| 道具 | 必要度 | 料金 | 何に使う | 無い時 |
|---|---|---|---|---|
| Node.js 18+ / npm | 必須 | 無料 | 本体 | 動きません |
| Remotion（npm install） | 必須 | 無料※ | 動画の組み立て・書き出し | 動きません |
| Chrome Headless Shell | 必須 | 無料 | 1コマずつ描く（初回に自動取得） | 自動取得に失敗→ネット確認 |
| 空き容量 5GB | 必須 | – | 書き出し・書体 | 途中で失敗 |
| ffmpeg | 推奨 | 無料 | 解析・切り出しを速く | Remotion 同梱版で代用 |
| Python 3 + Pillow/numpy | 推奨 | 無料 | 画像解析（文字の位置・色）、書き起こし、顔検出 | 既定位置・既定色。歌詞ファイルがあれば OK |
| OpenCV 4 | 任意 | 無料 | アニメ顔の自動検出 | `npm run faces` で手動 |
| faster-whisper | 任意 | 無料（ローカル） | 歌詞の自動書き起こし | 歌詞ファイルを用意 |
| GPU | 任意 | – | 書き起こしが速く | CPU で動く |
| Codex | 推奨 | 無料枠あり | 日本語で頼むだけで編集 | `npm run start` / `npm run edit -- "指示"` |
| Remotion Studio | 任意 | 無料※ | ブラウザで細かく確認 | 静止画プレビューで確認 |
| DaVinci Resolve | 任意 | 無料（Studio は有料） | 自分で仕上げ編集 | パックだけで MP4 完成 |
| 動画生成 MCP | 任意 | 有料（使った分） | 静止画を動く映像に | 静止画モード（無料）で完成 |

※ Remotion: 個人・従業員3人以下の営利企業・非営利団体は**無料（商用も可）**。それ以上の営利企業は Company License が必要（https://www.remotion.dev/license ／ ライセンス本文 https://github.com/remotion-dev/remotion/blob/main/LICENSE.md 、2026-10-27確認）。

### 有料・無料枠ありの詳細（2026-10-27確認）
- **Codex**: ChatGPT のプランに含まれる。Plus $20/月、Pro $100/月〜、Business $25/人/月（月払い）。Free/Go でも期間限定で利用可（https://chatgpt.com/codex/pricing ・ https://help.openai.com/en/articles/11369540）。API キーで使う場合は従量課金。
- **DaVinci Resolve**: 無料版（4K/60p まで）。Studio は買い切り US$295（2026/11/20 まで US$236 のセール）（https://www.blackmagicdesign.com/products/davinciresolve/studio）。
- **Grok Imagine（xAI API）**: grok-imagine-video-1.5-lite $0.02/秒（480p）〜$0.14/秒（1080p）、video-1.5 $0.08〜$0.25/秒、画像入力 $0.01/枚（https://docs.x.ai/developers/pricing）。例: 720p lite で 5秒×10カット = 約 $1.5。
- **Runway**: 無料 125 クレジット（1回のみ）、Standard $15/月（年払い $12）で 625 クレジット ≒ Gen-4.5 約52秒（https://runway.com/pricing）。
- **Pollo AI**: 公式料金ページ https://pollo.ai/pricing を確認してください（**未確認**: 第三者記事では Lite $15/月・400 クレジット）。`gen/models.yaml` の価格も実行前に確認して表示します。

## 💸 完全無料ルート
曲＋（歌詞ファイル or faster-whisper）＋手持ちの画像 → **静止画モード**（カメラワーク・スピードランプ・目パチ口パク・呼吸/髪揺れ・音に反応する背景・仕上げ）＋**無料書体（OFL）111 種**＋Remotion（個人/小規模は無料）で、**MP4 完成まで 0 円**。Codex が無くてもウィザード（`start.bat`）で作れます。
**有料オプション**: 動画生成 MCP（使った秒数だけ）、Codex の上位プラン、DaVinci Resolve Studio。有料の操作は必ず金額を見せて確認してから実行します。

## OS ごとの手順
### Windows
1. `doctor.bat` をダブルクリック → Node.js が無ければ `winget install OpenJS.NodeJS.LTS` を提案（y で実行）。入れたらウィンドウを開き直して再実行。
2. 推奨: `winget install Gyan.FFmpeg`、`winget install Python.Python.3.12` → `pip install -r requirements_optional.txt`（または doctor の `--fix`）。
3. `setup.bat` → `start.bat`。
### Mac
1. Homebrew が無ければ https://brew.sh の1行を実行。
2. `./doctor.sh` → `brew install node ffmpeg python` を1つずつ確認して実行。
3. `./setup.sh` → `./start.sh`。
### Linux（Debian/Ubuntu）
1. `./doctor.sh` → `sudo apt install -y nodejs npm ffmpeg python3 python3-pip python3-venv` を確認して実行（Node が古い場合は https://nodejs.org/ja の手順で LTS を）。
2. `./setup.sh` → `./start.sh`。

## 動画生成MCPをCodexにつなぐ
Codex は `~/.codex/config.toml`（プロジェクト単位なら `.codex/config.toml`）の `[mcp_servers.<名前>]` に MCP サーバーを登録します。`codex mcp add` コマンドでも追加できます（公式: https://developers.openai.com/codex/mcp ・設定リファレンス https://developers.openai.com/codex/config-reference 、2026-10-27確認）。

```toml
# 例1: コマンドで起動する MCP（各サービスの公式説明にあるコマンドに置き換え）
[mcp_servers.my_video]
command = "npx"
args = ["-y", "<サービスの MCP パッケージ名>"]
env = { API_KEY = "ここにキー（ファイルを人に渡さない）" }

# 例2: URL で接続する MCP
[mcp_servers.my_video_http]
url = "https://<サービスの MCP エンドポイント>"
bearer_token_env_var = "MY_VIDEO_API_KEY"
```
- どの MCP でも使えるように、パックは `gen/gen_tasks.json`（作るカット・プロンプト・保存先）を作るだけで、Codex がそれを MCP に渡し、出来た動画を `npm run gen -- import` で取り込みます（`docs/VIDEO_MCP_ja.md`）。
- 登録後 `npm run doctor` を実行すると「Codex に登録済み: …」と表示されます。
- API キーは `.env` か環境変数に。`config.toml` を人に共有しないでください。

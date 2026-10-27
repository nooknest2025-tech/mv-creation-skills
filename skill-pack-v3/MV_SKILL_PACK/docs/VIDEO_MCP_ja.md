# 動画生成 MCP のつなぎ方（Pollo / Grok / Runway / Kling など何でも）

このパックは **特定のサービスに縛られません**。使う MCP は人それぞれなので、間に「受け渡しの形」だけを決めています。

```
npm run gen -- plan          →  gen_tasks.json（どのショットを・何秒・どのプロンプトで）
        ↓  Codex があなたの MCP ツールを呼ぶ（Pollo でも Grok でも Runway でも）
npm run gen -- import <動画 or URL> --shot S012 --from pollo
        ↓
npm run gallery              →  見比べて「採用」→ タイムラインに自動で入る
```

## 1. 使う前に（お金）
- `npm run models` で、公式ページで確認した価格と確認日を見られます。✅ は確認済み、❔ は未確認（推測の価格は書きません）。
- `npm run gen -- plan --provider pollo` のように指定すると、そのサービスのモデルだけで見積もります。
  - 見せ場（サビ・顔アップ）にはその中の上位モデル、つなぎには最安モデルを割り当てます。
- **有料です。Codex は見積もり合計をあなたに見せて OK をもらうまで MCP を呼びません**（AGENTS.md のルール）。
- MCP のクレジット制（Pollo アプリのクレジットなど）はドル換算が公表されていないことがあります。その場合は MCP の見積もりツールを使ってください（Pollo なら `pollo_estimate_generation_cost`）。

## 2. Codex に MCP を登録する
`~/.codex/config.toml` に追記します。例は Pollo の公式 CLI 版（`npm i -g @pollo-ai/cli` → `pollo auth login` を1回）。

```toml
[mcp_servers.pollo]
command = "pollo"
args = ["mcp"]
```

- Pollo の旧 MCP（`npx -y mcp-server-pollo`、API キーは環境変数 `POLLO_AI_API_KEY`）でも動きます。
  - ツール名は `text2video` / `img2video` / `getTaskStatus` です。
- 別のサービスも同じように `[mcp_servers.<名前>]` を足すだけです。
  - API キーは環境変数で渡し、**ファイルに直接書かない**でください。
- 出典: https://docs.pollo.ai/mcp-server 、https://www.npmjs.com/package/@pollo-ai/cli （2026-10-26 確認）

## 3. Codex への頼み方（日本語でOK）
> 「gen_tasks.json のサビのショットを Pollo で作って。合計いくらか先に教えて」

Codex は次の順で動きます。
1. `gen_tasks.json` を読む。
   - 中身は shot、seconds、aspect、prompt、reference_image（元の静止画）、suggested_model、estimated_usd、save_to。
2. 金額を見せて確認を取る。
3. MCP を呼ぶ。参照画像があれば img2video、なければ text2video。
4. 結果をダウンロードする。
   - URL → `npm run gen -- import "<URL>" --shot S012 --from pollo`
   - MCP が保存したファイル → `npm run gen -- import <ファイル> --shot S012 --from pollo`
   - フォルダごと取り込むときは、ファイル名に `S012` が入っていれば自動で振り分けます。
5. `npm run gallery` で確認するよう案内する。

## 4. MCP なし・手動でも同じ
- Web アプリやスマホで作った動画は、`npm run gen -- import ~/Downloads/xxx.mp4 --shot S012` で取り込めます。
- ショットを決めずに素材として使うなら、`input/clips/` に入れて `npm run mv` を実行します。普通の動画素材としてカットに使われます。

## 5. 新しいサービスを足すとき（開発者向け）
- 価格: `gen/models.yaml` に、**公式ページの URL と確認日を付けて**追記します。
  - 確認できないときは `verified: false` にします。その場合 `run` は止まり、見積もりは「不明」と表示されます。
- MCP で使う: コードの変更は不要です（`import` するだけ）。
- MCP なしで `npm run gen -- run` から直接呼びたいとき: `scripts/gen.ts` の `ADAPTERS` に1件追加します。
  - 現在の直接呼び出しは xAI（Grok Imagine）だけです。それ以外は MCP か手動で使ってください。

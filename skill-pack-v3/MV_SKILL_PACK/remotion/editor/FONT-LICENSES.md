# 編集UIの書体と利用条件

## Google Fonts（OFL-1.1 / Apache-2.0）
`npm install` 時（と編集UIの起動時）に、編集UI用の27書体を google/fonts から自動ダウンロードします（`remotion/public/fonts/dl/`、Git には入れません）。保存前に METADATA.pb でライセンスを再確認し、ライセンス文 `LICENSE_<id>.txt` も一緒に保存します。

## 暗黒工房（作者: maki）のホラー書体 — 同梱していません
- 怨霊 2.0: https://www.ankokukoubou.com/font/onryou.htm （ダウンロード: https://www.ankokukoubou.com/font/onryou.zip ）
- 吐き溜: https://www.ankokukoubou.com/font/hakidame.htm （ダウンロード: https://www.ankokukoubou.com/font/hakidame.zip ）
- 利用条件・再配布についての作者の告知: https://www.ankokukoubou.com/font/ankokuzonji.htm

2026-10-27 に各ページを確認。無料・商用利用可（画像・映像などへの加工利用と販売も可）。禁止事項は「作者が暗黒工房であることを偽ること」。各フォントのページには「フォントファイルの再配布禁止」と書かれていますが、作者は上の告知ページで再配布を OK とし、「配布ページの規約やreadmeはわざわざ書き換えません」と説明しています。

それでも念のため、このリポジトリにはファイルを入れません。使う人の PC が**作者の公式サイトから直接**ダウンロードし、zip の中の TTF を**一切変更せずに**取り出します（`remotion/public/fonts/extra/`。同梱の readme も一緒に保存）。編集UIでこの書体を選ぶと作者名と利用条件ページへのリンクが表示されます。商用で使う場合は、作者への報告やクレジット表記が歓迎されています（必須ではありません）。リンクが切れている場合は、その書体だけ飛ばします。

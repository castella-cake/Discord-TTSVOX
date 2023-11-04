# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1]

### Changed
- 辞書の登録時に変換元が既に存在する場合、登録しないようになりました
- URLとネタバレの置き換え文章は、辞書置き換えの対象外になりました

### Fixed
- カスタム絵文字の読み上げにIDが入る問題を修正しました
- テキストが空かどうかのチェックを行うようにしました

## 0.2.0 - 2023/10/25

### Added
- 読み上げ無視用のPrefixを設定できるようになりました
- 入退室メッセージを追加しました
- URL、スポイラーは置き換えられるようになりました
- 設定保存時に何をしたかをよりわかりやすく表示するようにしました
- 設定表示機能を追加しました
- ボイスオーバーライド機能を追加しました ( [#2](https://github.com/castella-cake/Discord-TTSVOX/issues/2) )

### Changed
- ボイスオプションの変更と話者変更でスタイルを直接指定した場合ではEphemeral responseを使用しないようになりました

## 0.1.1 - 2023/10/23

### Changed
- クレジットにTTSVOXに関する情報を表示するようにしました
- VOICEVOXへのリクエスト時にテキストはエンコードされるようになりました
- VCチャンネルは変数で記憶せず、常に自分自身がいるチャンネルを取得するようにしました

## 0.1.0 - 2023/10/19

### Added
- 基本的なDiscordBot機能を追加しました
- 読み上げ機能を追加しました
- 話者変更機能を追加しました
- ボイスオプション変更機能を追加しました
- 簡易辞書機能を追加しました
- 誰も居ないチャンネルの場合に自動的に退出するようになりました
- 速読機能を追加しました
- 辞書表示機能を追加しました
- オーナーがコマンドからBotを停止できるようになりました
- 言語ファイルによるカスタマイズを追加しました
- 優先ホスト機能を追加しました

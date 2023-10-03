# Discord-TTSVOX
Node.jsとDiscord.jsを用いて開発されたDiscord用Bot。

# Feature
現在実装済みの機能。   
実装予定の機能はIssueを参照してください。
- [x] 基本Bot設計
- [x] VC入退出管理
- [x] VOICEVOXへのリクエストと再生
- [x] ボイス変更機能
- [x] ボイス設定変更機能
- [x] 個人簡易辞書機能
- [x] サーバー毎簡易辞書機能

# Setup
`config_sample.json`を`config.json`の名称でコピー。コピーしたJSONの`bot_token`にBotのトークンを入力します。`temp`フォルダーがない場合は作成してください。   
VOICEVOXエンジンをホストにインストールして、ポートやアドレスなどに変更がある場合はコンフィグの`voicevox_host`に書き込んでください。   
そうしたら、Node.jsとNPMをインストールした状態で、   
```
npm install
```
で依存関係をインストールして、   
```
npm run start
```
でBotを実行。ffmpegやDiscord.jsは、依存関係のインストール時に自動でインストールされます。
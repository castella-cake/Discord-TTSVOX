# Discord-TTSVOX
TTSVOXは、Node.jsとDiscord.jsを用いて開発されたDiscord用のVOICEVOX読み上げBotです。   
1サーバーに1個のBotで動作させることを想定しています。   
プロジェクトはまだ開発段階にあり、予期しないバグに遭遇したりする可能性があります。

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
- [x] 読み上げキューが多い場合に速読する

# Quick start
このリポジトリにVOICEVOXエンジンは含まれていません。各自でダウンロードする必要があります。   
Botを実行する前に、VOICEVOXエンジンをバックグラウンドで起動させておいてください。
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

# Config
- `bot_token`: ボットのトークン
- `initial_userdata`: ユーザーデータがない場合に使用する初期ユーザーデータ
    - `speakerid`: 使用する話者
    - `personalDict`: 個人辞書の配列。オブジェクトを入れます
        - `from`: 置き換え元文字列
        - `to`: 置き換え先文字列
    - `speedScale`: 話速
    - `pitchScale`: 音高
    - `intonationScale`: 抑揚
- `initial_serverdata`: サーバーデータがない場合に使用する初期サーバーデータ
    - `serverDict`: サーバー辞書の配列。オブジェクトを入れます
        - `from`: 置き換え元文字列
        - `to`: 置き換え先文字列
- `voicevox_host`: 使用するVOICEVOXエンジンのアドレス
- `voicevox_preferhost`: 優先するVOICEVOXエンジンのアドレス    
ここに別のVOICEVOXエンジンへのアドレスを記述すると、利用可能な場合に`voicevox_host`の代わりに利用します。    
優先ホストと通常ホストのバージョンは一致している必要があります。
よくわからなければ、`""`のままにしておいてください
- `host_timeout`: VOICEVOXエンジンのタイムアウト(ms)    
現状は優先ホストへの接続確認に使用されます。
- `database_host`: 使用するSQLiteデータベースのアドレス
複数のTTSVOXをホストする場合は、SQLiteデータベースのサーバーを一つホストすることで設定を共有できます。
- `fastforwardqueue`: キューされたメッセージが設定された値以上の場合に速読を有効化します。0で無効化
- `fastforwardspeed`: 速読が有効化された場合の話速
- `owner_userid`: BotのオーナーのユーザーID

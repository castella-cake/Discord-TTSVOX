const { ApplicationCommandOptionType } = require('discord.js');

const cmdArray = [
    {
        name: "ttsvox",
        description: "TTSVOXのコマンド。",
        options: [
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: `ping`,
                description: "Replies with Pong!",
            },
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: `leave`,
                description: "退出します"
            },
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: `join`,
                description: "実行者がいるボイスチャンネルに参加します。"
            },
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: `chgvoice`,
                description: "話者を変更します。スタイルを入力せずに実行すると、スタイルの選択パネルが表示されます。設定はあなた以外には見えません。",
                options: [{
                    type: ApplicationCommandOptionType.String,
                    name: "speakername",
                    description: "話者名を入力",
                    required: true
                },
                {
                    type: ApplicationCommandOptionType.String,
                    name: "speakerstyle",
                    description: "スタイルを入力(オプション)",
                    required: false
                }],
            },
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: `chgvoiceoption`,
                description: "ボイスの話速などを変更します。",
                options: [
                    {
                        type: ApplicationCommandOptionType.String,
                        name: "voiceoption",
                        description: "オプションを選択",
                        required: true,
                        choices: [
                            { name: "話速", value: "speedScale" },
                            { name: "ピッチ", value: "pitchScale" },
                            { name: "抑揚", value: "intonationScale" }
                        ]
                    },
                    {
                        type: ApplicationCommandOptionType.Number,
                        name: "optionvalue",
                        description: "値を入力(話速: 0.5 ~ 2.0 / ピッチ: -0.15 ~ 0.15 / 抑揚: 0.0 ~ 2.0)",
                        required: true
                    }
                ],
            },
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: `dictadd`,
                description: "個人辞書/サーバー辞書にルールを追加します。",
                options: [
                    {
                        type: ApplicationCommandOptionType.String,
                        name: "controldict",
                        description: "操作する辞書を選択",
                        required: true,
                        choices: [
                            { name: "個人", value: "personal" },
                            { name: "サーバー", value: "server" }
                        ]
                    },
                    {
                        type: ApplicationCommandOptionType.String,
                        name: "dictreplacefrom",
                        description: "変換元ワード",
                        required: true
                    },
                    {
                        type: ApplicationCommandOptionType.String,
                        name: "dictreplaceto",
                        description: "変換先ワード(カタカナ読みなど)",
                        required: true
                    }
                ],
            },
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: `dictremove`,
                description: "個人辞書/サーバー辞書からルールを削除します。",
                options: [
                    {
                        type: ApplicationCommandOptionType.String,
                        name: "controldict",
                        description: "操作する辞書を選択",
                        required: true,
                        choices: [
                            { name: "個人", value: "personal" },
                            { name: "サーバー", value: "server" }
                        ]
                    },
                    {
                        type: ApplicationCommandOptionType.String,
                        name: "deleteword",
                        description: "削除するワード(変換元)",
                        required: true
                    }
                ],
            },
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: `dictshow`,
                description: "個人辞書/サーバー辞書の内容を表示します。",
                options: [
                    {
                        type: ApplicationCommandOptionType.String,
                        name: "controldict",
                        description: "表示する辞書を選択",
                        required: true,
                        choices: [
                            { name: "個人", value: "personal" },
                            { name: "サーバー", value: "server" }
                        ]
                    },
                    {
                        type: ApplicationCommandOptionType.Boolean,
                        name: "noephemeral",
                        description: "自分以外にも表示するかどうか(何も指定しない場合は「True」)",
                        required: false
                    }
                ],
            },
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: `owner_shutdown`,
                description: "Botのオーナーのみが使用可能: クライアントを破壊してBotを安全に停止します。(現在の非同期処理は全て強制終了されます)"
            },
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: `credit`,
                description: "クレジットを表示します。"
            }
        ]
    }
]
module.exports = { cmdArray }
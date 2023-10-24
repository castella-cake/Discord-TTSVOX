const { ApplicationCommandOptionType } = require('discord.js');
const { slashcommand_prefix } = require('../config.json');

const cmdArray = [
    {
        name: slashcommand_prefix,
        description: "TTSVOXのコマンド。",
        options: [
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: `ping`,
                description: "Pongで返答します",
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
                description: "話者を変更します。スタイルを入力せずに実行すると、スタイルの選択パネルが表示されます。",
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
                name: `voiceprefixassign`,
                description: "特定のPrefixにボイスを割り当てます。",
                options: [{
                    type: ApplicationCommandOptionType.String,
                    name: "assignprefix",
                    description: "割り当てるプレフィックスを入力",
                    required: true
                },
                {
                    type: ApplicationCommandOptionType.String,
                    name: "speakername",
                    description: "話者名を入力",
                    required: true
                },
                {
                    type: ApplicationCommandOptionType.String,
                    name: "speakerstyle",
                    description: "スタイルを入力(オプション)",
                    required: true
                }],
            },
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: `voiceprefixremove`,
                description: "指定した接頭辞からボイスの割り当てを削除します。",
                options: [{
                    type: ApplicationCommandOptionType.String,
                    name: "removeprefix",
                    description: "割り当てを解除するプレフィックスを入力",
                    required: true
                }],
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
                        name: "ephemeral",
                        description: "自分にのみ表示するかどうか(何も指定しない場合は「True」)",
                        required: false
                    }
                ],
            },
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: `showmysettings`,
                description: "現在のボイス設定,ボイスパラメータ,ボイスオーバーライド設定を表示します。辞書はshowdictから確認できます。",
                options: [{
                    type: ApplicationCommandOptionType.Boolean,
                    name: "ephemeral",
                    description: "自分にのみ表示するかどうか(何も指定しない場合は「True」)",
                    required: false
                }],
            },
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: `owner_shutdown`,
                description: "Botのオーナーのみが使用可能: クライアントを破壊してBotを安全に停止します。(現在の非同期処理は全て強制終了されます)"
            },
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: `credit`,
                description: "TTSVOXとVOICEVOXのクレジットを表示します。"
            },
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: `help`,
                description: "コマンドリストを表示します。"
            }
        ]
    }
]
module.exports = { cmdArray }
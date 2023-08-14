const { Client, GatewayIntentBits, Partials, ChannelType, ApplicationCommandOptionType, ActivityType, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, InteractionType } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection, createAudioPlayer, createAudioResource } = require('@discordjs/voice');
const { bot_token, initial_userdata } = require('./config.json');
const fs = require("fs");
const Keyv = require('keyv')
const userdata = new Keyv('sqlite://db.sqlite', { table: 'userobj' })

const client = new Client({ intents: [ GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent ], partials: [Partials.Channel] });

userdata.on('error', err => console.error('Keyv connection error:', err))

let isready = false
let speakersdata = []
const player = createAudioPlayer();
let speakersnamearray = []

client.once("ready", async () => {
    client.user.setPresence({
        activities: [{ name: `VOICEVOXエンジンに連絡中`, type: ActivityType.Watching }],
        status: 'dnd',
    });
    // スラッシュコマンドを作成する
    const cmddata = [{
        name: "ping",
        description: "Replies with Pong!",
    },
    {
        name: "leave",
        description: "退出します"
    },
    {
        name: "join",
        description: "実行者がいるボイスチャンネルに参加します。"
    },
    {
        name: "setvoice",
        description: "話者を変更します。実行すると、スタイルの選択パネルが表示されます。設定はあなた以外には見えません。",
        options: [{
            type: ApplicationCommandOptionType.String,
            name: "speakername",
            description: "話者名を入力",
            required: true
        }],
    },
    {
        name: "credit",
        description: "クレジットを表示します。"
    }];
    client.application.commands.set(cmddata).then(() => {
        console.log("Command Ready!");
    })
    // VOICEVOXエンジンに接続可能か確認する。
    try {
        fetch(`http://127.0.0.1:50021/version`, {
            method: "GET"
        }).then(response => {
            if ( response.status == 200 ) {
                response.text().then(text => {
                    console.log(`VOICEVOX ENGINE: ${text}`)
                })
                // OKだったら、話者情報も取得する
                client.user.setPresence({
                    activities: [{ name: `エンジンから情報取得中`, type: ActivityType.Watching }],
                    status: 'dnd',
                });
                fetch(`http://127.0.0.1:50021/speakers`, {
                    method: "GET"
                }).then(response => {
                    if ( response.status === 200 ) {
                        response.text().then(data => {
                            speakersdata = JSON.parse(data)
                            speakersnamearray = speakersdata.map( elem => elem.name )
                            // isreadyを立ててコマンドの受付を開始する
                            client.user.setPresence({
                                activities: [{ name: `READY`, type: ActivityType.Playing }],
                                status: 'online',
                            });
                            isready = true
                            console.log("VOICEVOX API Ready!");
                        })
                    }
                })
            } else {
                client.user.setPresence({
                    activities: [{ name: `エンジンからの情報取得に失敗`, type: ActivityType.Watching }],
                    status: 'dnd',
                });
                console.log(`重大なエラー: VOICEVOXエンジンの呼び出しに失敗しました。ステータスコードは ${response.status} でした。`)
            }
        })
    } catch (error) {
        client.user.setPresence({
            activities: [{ name: `エンジンからの情報取得に失敗`, type: ActivityType.Watching }],
            status: 'dnd',
        });
        console.log(`重大なエラー: VOICEVOXエンジンの呼び出しに失敗しました。:${error}`)
    }
    
});

// num
let currentchannelid

client.on("interactionCreate", async (interaction) => {
    try {
        if (!isready) {
            await interaction.reply('Botは準備中です。もしこれが続いている場合は、Botのオーナーに連絡してください。');
            return;
        }
        if (interaction.commandName === 'ping') {
            await interaction.reply('Pong!!!!!!!!!');
        } else if (interaction.commandName === 'join') {
            const guild = interaction.guild;
            const member = await guild.members.fetch(interaction.member.id);
            const memberVC = member.voice.channel;
            let message = "ありえないエラーです"
            if (!memberVC || !memberVC.joinable || !memberVC.speakable) {
                console.log("Voice connection check failed")
                message = "ボイスチャンネルに接続できませんでした。ボイスチャンネルに参加しているか、またBotがチャンネルへの接続/発言権限を持っているかを確認してください。"
            } else {
                console.log(interaction.channel)
                currentchannelid = interaction.channel.id
                const connection = joinVoiceChannel({
                    guildId: guild.id,
                    channelId: memberVC.id,
                    adapterCreator: guild.voiceAdapterCreator,
                    selfMute: false,
                    selfDeaf: true,
                });
                connection.subscribe(player);
                message = "参加したよ～。"
            }
            await interaction.reply(message);
        } else if (interaction.commandName === 'leave') {
            const guild = interaction.guild;
            const member = await guild.members.fetch(interaction.member.id);
            const memberVC = member.voice.channel;
            let message = "ありえないエラーです。Botのクラッシュ後に実行した場合は、強制的に切断してください。"
            if (!memberVC || !memberVC.joinable || !memberVC.speakable) {
                console.log("Voice connection check failed")
                message = "切断に失敗しました"
            } else {
                const connection = getVoiceConnection(memberVC.guild.id);
                //console.log(connection)
                if (connection !== undefined) {
                    currentchannelid = null
                    connection.destroy();
                    message = "退出しました"
                }
            }
            await interaction.reply(message);
        } else if (interaction.commandName === 'setvoice') {
            /*const row = new ActionRowBuilder()
                .addComponents(selectspeakersmenu);
            await interaction.reply({
                content: 'ボイスを選択',
                components: [row],
                ephemeral: true
            });*/
            if (speakersnamearray.includes(interaction.options.getString("speakername"))) {
                const speakerobj = speakersdata.find(elem => elem.name === interaction.options.getString("speakername"))
                const styleselectarray = []
                Promise.all(speakerobj.styles.map(elem => {
                    styleselectarray.push(new StringSelectMenuOptionBuilder()
                        .setLabel(elem.name)
                        .setValue(`${elem.id}`)
                    )
                })).then(async () => {
                    const select = new StringSelectMenuBuilder()
                        .setCustomId('setspeakerid')
                        .setPlaceholder('わしゃの スタイルは？')
                        .addOptions(styleselectarray);
                    const row = new ActionRowBuilder()
                        .addComponents(select);
                    await interaction.reply({
                        content: 'スタイルを選択',
                        components: [row],
                        ephemeral: true
                    })
                })
            } else {
                await interaction.reply({
                    content: `指定された話者名が見つかりませんでした。\n利用可能な話者は ${speakersnamearray.join(',')}です。 `,
                    ephemeral: true
                });
            }
        } else if (interaction.commandName === 'credit') {
            await interaction.reply({
                content: `VOICEVOX: ${speakersnamearray.join(',')}`,
                ephemeral: true
            });
        } else if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'setspeakerid') {
                console.log("SetSpeaker")
                const memberId = interaction.member.id
                userdata.get(memberId).then(async data => {
                    if( data === undefined ) {
                        let modded_userdata = JSON.parse(JSON.stringify(initial_userdata))
                        modded_userdata.speakerId = interaction.values[0]
                        userdata.set(memberId, modded_userdata)
                        console.log(`New user data registered: ${memberId}`)
                        await interaction.update({
                            content: `Great! 新しいユーザーデータを作成して、変更を保存しました。`,
                            ephemeral: true,
                            components: []
                        });
                    } else {
                        let modded_userdata = JSON.parse(JSON.stringify(data))
                        modded_userdata.speakerId = interaction.values[0]
                        userdata.set(memberId, modded_userdata)
                        console.log(`User data modified: ${memberId}`)
                        await interaction.update({
                            content: `Great! 変更を保存しました。`,
                            ephemeral: true,
                            components: []
                        });
                    }
                })
            }
        } else {
            await interaction.reply('Invalid Command.....');
        }
    } catch (err) {
        console.log(err)
        interaction.channel.send("エラー！！問題が発生しました。")
    }
});

function getUserData(memberId) {
    return new Promise((resolve, reject) => {
        userdata.get(memberId).then(data => {
            if( data === undefined ) {
                userdata.set(memberId, initial_userdata)
                console.log(`New user data registered: ${memberId}`)
                resolve(initial_userdata)
            } else {
                resolve(data)
            }
        })
    })
}

client.on('messageCreate', message => {
    if (message.author.bot) {
        return;
    }
    if (message.channel.id === currentchannelid) {
        getUserData(message.member.id).then(userdata => {
            console.log(`Message in channel!: ${message.content} ${userdata.speakerId}`)
            fetch(`http://127.0.0.1:50021/audio_query?text=${message.content}&speaker=${userdata.speakerId}`, {
                method: "POST"
            }).then(response => {
                if (response.status === 200) {
                    response.text().then(text => {
                        console.log(text)
                        fetch(`http://127.0.0.1:50021/synthesis?speaker=${userdata.speakerId}`, {
                            method: "POST",
                            headers: {"Content-Type": "application/json", "accept": "audio/wav"},
                            body: text
                        }).then(response => {
                            //console.log(response)
                            if (response.status === 200) {
                                response.arrayBuffer().then(res => {
                                    const buffer = Buffer.from(res)
                                    fs.writeFile("temp/audio.wav", buffer, (err) => {
                                        if (err) {
                                            console.log(`ファイルの書き込みに失敗: ${err}`)
                                        } else {
                                            console.log(`ファイルを書き込みました`)
                                            const resource = createAudioResource("temp/audio.wav");
                                            player.play(resource);
                                            console.log(`再生中`)
                                        }
                                    })
                                })
                            } else {
                                console.log(`VOICEVOXの呼び出しに失敗: ${response.status}`)
                                response.text().then(res => {
                                    console.log(res)
                                })
                            }
                        })
                    })
                }
            })
        })
    }
    //console.log(`Message coming: ${message.content}`)
});

client.login(bot_token);
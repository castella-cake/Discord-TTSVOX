const { Client, GatewayIntentBits, Partials, ChannelType, ApplicationCommandOptionType, ActivityType, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, InteractionType } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const { bot_token, initial_userdata, voicevox_host, database_host, initial_serverdata, fastforwardqueue, fastforwardspeed } = require('./config.json');
const { cmdArray } = require('./modules/cmdarray.js');
const fs = require("fs");
const Keyv = require('keyv')
const userdata = new Keyv(database_host, { table: 'userobj' })
const serverdata = new Keyv(database_host, { table: 'serverobj' })

const client = new Client({ intents: [ GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent ], partials: [Partials.Channel] });

userdata.on('error', err => console.error('Keyv connection error:', err))

let isready = false
let speakersdata = []
const player = createAudioPlayer();
let speakersnamearray = []
let speakqueuearray = []

client.once("ready", async () => {
    client.user.setPresence({
        activities: [{ name: `VOICEVOXエンジンに連絡中`, type: ActivityType.Watching }],
        status: 'dnd',
    });
    // スラッシュコマンドを作成する
    client.application.commands.set(cmdArray).then(() => {
        console.log("Command Ready!");
    })
    // VOICEVOXエンジンに接続可能か確認する。
    try {
        fetch(`http://${voicevox_host}/version`, {
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
                fetch(`http://${voicevox_host}/speakers`, {
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
let currenttextchannelid
let currentvoicechannelid

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
            } else if ( !interaction.guild.members.me.voice.channel ) {
                console.log(interaction.channel)
                currenttextchannelid = interaction.channel.id
                currentvoicechannelid = memberVC.id
                const connection = joinVoiceChannel({
                    guildId: guild.id,
                    channelId: memberVC.id,
                    adapterCreator: guild.voiceAdapterCreator,
                    selfMute: false,
                    selfDeaf: true,
                });
                connection.subscribe(player);
                message = "参加したよ～。"
                speakqueuearray = []
            } else {
                message = "すでにボイスチャンネルに参加しているようです。"
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
                    currenttextchannelid = null
                    currentvoicechannelid = null
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
        } else if (interaction.commandName === 'setvoiceoption') {
            const memberId = interaction.member.id
            if (interaction.options.getString("voiceoption") === "speedScale" && ( interaction.options.getNumber("optionvalue") > 2.0 || interaction.options.getNumber("optionvalue") < 0.5 )) {
                await interaction.reply({
                    content: `話速は0.5~2.0以内で指定する必要があります。`,
                    ephemeral: true,
                });
                return;
            } else if (interaction.options.getString("voiceoption") === "pitchScale" && ( interaction.options.getNumber("optionvalue") > 0.15 || interaction.options.getNumber("optionvalue") < -0.15 )) {
                await interaction.reply({
                    content: `ピッチは-0.15~0.15以内で指定する必要があります。`,
                    ephemeral: true,
                });
                return;
            } else if (interaction.options.getString("voiceoption") === "intonationScale" && ( interaction.options.getNumber("optionvalue") > 2.0 || interaction.options.getNumber("optionvalue") < 0.5 )) {
                await interaction.reply({
                    content: `抑揚は0.5~2.0以内で指定する必要があります。`,
                    ephemeral: true,
                });
                return;
            }
            userdata.get(memberId).then(async data => {
                if( data === undefined ) {
                    let modded_userdata = JSON.parse(JSON.stringify(initial_userdata))
                    modded_userdata[interaction.options.getString("voiceoption")] = interaction.options.getNumber("optionvalue")
                    userdata.set(memberId, modded_userdata)
                    console.log(`New user data registered: ${memberId}`)
                    await interaction.reply({
                        content: `Great! 新しいユーザーデータを作成して、変更を保存しました。`,
                        ephemeral: true
                    });
                } else {
                    let modded_userdata = JSON.parse(JSON.stringify(data))
                    modded_userdata[interaction.options.getString("voiceoption")] = interaction.options.getNumber("optionvalue")
                    userdata.set(memberId, modded_userdata)
                    console.log(`User data modified: ${memberId}`)
                    await interaction.reply({
                        content: `Great! 変更を保存しました。`,
                        ephemeral: true
                    });
                }
            })
        // TODO: この辺はfunctionにまとめて、できる限り複製されたコードをなくす
        } else if (interaction.commandName === 'addtodict') {
            if (interaction.options.getString("controldict") == "server" ) {
                // このインタラクションをしたギルドIDを取得
                const guildId = interaction.guild.id
                // ユーザーデータのテーブルからギルドID名の行を取得
                serverdata.get(guildId).then(async data => {
                    // undefinedなら初期サーバーデータ引っ張ってきてpushする,そうじゃないならサーバーデータ引っ張ってきてpushする
                    if( data === undefined ) {
                        let modded_guilddata = JSON.parse(JSON.stringify(initial_serverdata))
                        modded_guilddata.serverDict.push({ from: interaction.options.getString("dictreplacefrom"), to: interaction.options.getString("dictreplaceto") })
                        serverdata.set(guildId, modded_guilddata)
                        console.log(`New server data registered: ${guildId}`)
                        await interaction.reply({
                            content: `Great! 新しいサーバーデータを作成して、変更を保存しました。`,
                            ephemeral: true
                        });
                    } else {
                        let modded_guilddata = JSON.parse(JSON.stringify(initial_serverdata))
                        modded_guilddata.serverDict.push({ from: interaction.options.getString("dictreplacefrom"), to: interaction.options.getString("dictreplaceto") })
                        serverdata.set(guildId, modded_guilddata)
                        console.log(`Server data modified: ${guildId}`)
                        await interaction.reply({
                            content: `Great! サーバーに変更を保存しました。`,
                            ephemeral: true
                        });
                    }
                })
            } else {
                // このインタラクションをしたメンバーIDを取得
                const memberId = interaction.member.id
                // ユーザーデータのテーブルからメンバーID名の行を取得
                userdata.get(memberId).then(async data => {
                    if( data === undefined ) {
                        let modded_userdata = JSON.parse(JSON.stringify(initial_userdata))
                        modded_userdata.personalDict.push({ from: interaction.options.getString("dictreplacefrom"), to: interaction.options.getString("dictreplaceto") })
                        userdata.set(memberId, modded_userdata)
                        console.log(`New user data registered: ${memberId}`)
                        await interaction.reply({
                            content: `Great! 新しいユーザーデータを作成して、変更を保存しました。`,
                            ephemeral: true
                        });
                    } else {
                        let modded_userdata = JSON.parse(JSON.stringify(data))
                        modded_userdata.personalDict.push({ from: interaction.options.getString("dictreplacefrom"), to: interaction.options.getString("dictreplaceto") })
                        userdata.set(memberId, modded_userdata)
                        console.log(`User data modified: ${memberId}`)
                        await interaction.reply({
                            content: `Great! 変更を保存しました。`,
                            ephemeral: true
                        });
                    }
                })
            }
        } else if (interaction.commandName === 'removefromdict') {
            if (interaction.options.getString("controldict") == "server" ) {
                // このインタラクションをしたギルドIDを取得
                const guildId = interaction.guild.id
                // ユーザーデータのテーブルからギルドID名の行を取得
                serverdata.get(guildId).then(async data => {
                    // undefinedなら初期サーバーデータ引っ張ってきてpushする,そうじゃないならサーバーデータ引っ張ってきてpushする
                    if( data === undefined ) {
                        let modded_guilddata = JSON.parse(JSON.stringify(initial_serverdata))
                        // 「お前消す」なワードのobjを探す
                        const dictobj = modded_guilddata.serverDict.find(elem => elem.from === interaction.options.getString("deleteword"))
                        if ( dictobj != undefined ) {
                            // さっき探したやつでfilter
                            modded_guilddata.serverDict = modded_guilddata.serverDict.filter(elem => elem !== dictobj)
                            serverdata.set(guildId, modded_guilddata)
                            console.log(`New server data registered: ${guildId}`)
                            await interaction.reply({
                                content: `Great! 新しいサーバーデータを作成して、変更を保存しました。`,
                                ephemeral: true
                            });
                        } else {
                            await interaction.reply({
                                content: `指定されたワードが見つかりませんでした。`,
                                ephemeral: true
                            });
                        }
                    } else {
                        let modded_guilddata = JSON.parse(JSON.stringify(data))
                        // 「お前消す」なワードのobjを探す
                        const dictobj = modded_guilddata.serverDict.find(elem => elem.from === interaction.options.getString("deleteword"))
                        console.log(dictobj)
                        if ( dictobj != undefined ) {
                            // さっき探したやつでfilter
                            modded_guilddata.serverDict = modded_guilddata.serverDict.filter(elem => elem !== dictobj)
                            serverdata.set(guildId, modded_guilddata)
                            console.log(`Server data modified: ${guildId}`)
                            await interaction.reply({
                                content: `Great! サーバーに変更を保存しました。`,
                                ephemeral: true
                            });
                        } else {
                            await interaction.reply({
                                content: `指定されたワードが見つかりませんでした。`,
                                ephemeral: true
                            });
                        }
                    }
                })
            } else {
                // このインタラクションをしたメンバーIDを取得
                const memberId = interaction.member.id
                // ユーザーデータのテーブルからメンバーID名の行を取得
                userdata.get(memberId).then(async data => {
                    // undefinedなら初期サーバーデータ引っ張ってきてpushする,そうじゃないならサーバーデータ引っ張ってきてpushする
                    if( data === undefined ) {
                        // 値渡し
                        let modded_userdata = JSON.parse(JSON.stringify(initial_userdata))
                        // 「お前消す」なワードのobjを探す
                        const dictobj = modded_userdata.personalDict.find(elem => elem.from === interaction.options.getString("deleteword"))
                        if ( dictobj != undefined ) {
                            // さっき探したやつでfilter
                            modded_userdata.personalDict = modded_userdata.personalDict.filter(elem => elem !== dictobj)
                            userdata.set(memberId, modded_userdata)
                            console.log(`New user data registered: ${memberId}`)
                            await interaction.reply({
                                content: `Great! 新しいユーザーデータを作成して、変更を保存しました。`,
                                ephemeral: true
                            });
                        } else {
                            await interaction.reply({
                                content: `指定されたワードが見つかりませんでした。`,
                                ephemeral: true
                            });
                        }
                    } else {
                        // 値渡し
                        let modded_userdata = JSON.parse(JSON.stringify(data))
                        // 「お前消す」なワードのobjを探す
                        const dictobj = modded_userdata.personalDict.find(elem => elem.from === interaction.options.getString("deleteword"))
                        console.log(dictobj)
                        if ( dictobj != undefined ) {
                            // さっき探したやつでfilter
                            modded_userdata.personalDict = modded_userdata.personalDict.filter(elem => elem !== dictobj)
                            userdata.set(memberId, modded_userdata)
                            console.log(`User data modified: ${memberId}`)
                            await interaction.reply({
                                content: `Great! 変更を保存しました。`,
                                ephemeral: true
                            });
                        } else {
                            await interaction.reply({
                                content: `指定されたワードが見つかりませんでした。`,
                                ephemeral: true
                            });
                        }
                    }
                })
            }
        } else if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'setspeakerid') {
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

function getServerData(guildId) {
    return new Promise((resolve, reject) => {
        serverdata.get(guildId).then(data => {
            if( data === undefined ) {
                serverdata.set(guildId, initial_serverdata)
                console.log(`New server data registered: ${guildId}`)
                resolve(initial_serverdata)
            } else {
                resolve(data)
            }
        })
    })
}

function playMessage(obj) {
    Promise.all([ getUserData(obj.memberId), getServerData(obj.guildId) ]).then(dataarray => {
        const userdata = dataarray[0]
        const serverdata = dataarray[1]
        let speed = dataarray.speedScale ?? 1.0
        const pitch = userdata.pitchScale ?? 0.0
        const intonation = userdata.intonationScale ?? 1.0
        const dict = userdata.personalDict ?? []
        const serverdict = serverdata.serverDict ?? []
        if (speakqueuearray.length >= fastforwardqueue) {
            speed = fastforwardspeed
        }
        
        let content = obj.content.toLowerCase()
        console.log(`Message in channel!: ${obj.content} ${userdata.speakerId} ${speed} ${pitch} ${intonation}`)
        Promise.all([ dict.map(async elem => { content = content.replaceAll(elem.from.toLowerCase(), elem.to)}), serverdict.map(async elem => { content = content.replaceAll(elem.from.toLowerCase(), elem.to)}) ]).then(() => {
            fetch(`http://${voicevox_host}/audio_query?text=${content}&speaker=${userdata.speakerId}`, {
                method: "POST"
            }).then(response => {
                if (response.status === 200) {
                    response.text().then(text => {
                        const parsedquery = JSON.parse(text)
                        parsedquery.speedScale = speed
                        parsedquery.pitchScale = pitch
                        parsedquery.intonationScale = intonation
                        console.log(parsedquery)
                        fetch(`http://${voicevox_host}/synthesis?speaker=${userdata.speakerId}`, {
                            method: "POST",
                            headers: {"Content-Type": "application/json", "accept": "audio/wav"},
                            body: JSON.stringify(parsedquery)
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
    })
}

client.on('messageCreate', message => {
    if (message.author.bot) {
        return;
    }
    if (message.channel.id === currenttextchannelid) {
        if (player.state.status === AudioPlayerStatus.Idle) {
            playMessage({ content: message.content, memberId: message.member.id, guildId: message.guild.id })
        } else {
            speakqueuearray.push({ content: message.content, memberId: message.member.id, guildId: message.guild.id  })
        }
    }
    //console.log(`Message coming: ${message.content}`)
});

client.on('voiceStateUpdate', (oldstate, newstate) => {
    if (oldstate.channelId === newstate.channelId) {
        return;
    }
    if (oldstate.channelId === null && newstate.channelId !== null) {
        console.log("It's all connected!")
        console.log(newstate.channel.members.size)
    } else if (oldstate.channelId !== null && newstate.channelId === null) {
        console.log("It's all disconnected!")
        if (oldstate.channel.members.size < 2 && oldstate.channelId === currentvoicechannelid) {
            const connection = getVoiceConnection(oldstate.guild.id);
            //console.log(connection)
            if (connection !== undefined) {
                const textch = client.channels.cache.get(currenttextchannelid)
                if (textch) {
                    textch.send("誰もいなくなったため、退出しました")
                }
                connection.destroy();
                currenttextchannelid = null
                currentvoicechannelid = null
            }
        }
    }
});

player.on(AudioPlayerStatus.Idle, () => {
    if (speakqueuearray.length > 0) {
        playMessage(speakqueuearray[0])
        speakqueuearray.shift()
    }
});

client.login(bot_token);
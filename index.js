const { Client, GatewayIntentBits, Partials, ChannelType, ApplicationCommandOptionType, ActivityType, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, InteractionType, PermissionFlagsBits, PermissionsBitField } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const { bot_token, voicevox_host, database_host, fastforwardqueue, fastforwardspeed, owner_userid, language_file, voicevox_preferhost } = require('./config.json');
const lang = require('./langs/' + language_file);
const { cmdArray } = require('./modules/cmdarray.js');
const { synthesisRequest, IsActiveHost } = require('./modules/engineControl.js')
const { getUserData, setUserData, getServerData, setServerData, getDataBase } = require('./modules/dbcontrol.js')
const fs = require("fs");
const Keyv = require('keyv');
const { parse } = require('path');
const userdata = new Keyv(database_host, { table: 'userobj' })
const serverdata = new Keyv(database_host, { table: 'serverobj' })

const client = new Client({ intents: [ GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent ], partials: [Partials.Channel] });

userdata.on('error', err => console.error('Keyv connection error:', err))

let isready = false
let speakersdata = []
const player = createAudioPlayer();
let speakersnamearray = []
let speakqueuearray = []
let isBusy = false

client.once("ready", async () => {
    client.user.setPresence({
        activities: [{ name: lang.CONNECTING_TO_ENGINE, type: ActivityType.Watching }],
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
                    activities: [{ name: lang.GETTING_ENGINE_INFO, type: ActivityType.Watching }],
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
                                activities: [{ name: lang.READY, type: ActivityType.Playing }],
                                status: 'online',
                            });
                            isready = true
                            console.log("VOICEVOX API Ready!");
                        })
                    }
                })
            } else {
                client.user.setPresence({
                    activities: [{ name: lang.ENGINE_CONNECT_FAIL, type: ActivityType.Watching }],
                    status: 'dnd',
                });
                console.error(`VOICEVOXエンジンの呼び出しに失敗しました。ステータスコードは ${response.status} でした。`)
            }
        }).catch((err) => {
            throw err
        })
    } catch (error) {
        client.user.setPresence({
            activities: [{ name: lang.ENGINE_CONNECT_FAIL, type: ActivityType.Watching }],
            status: 'dnd',
        });
        console.error(`VOICEVOXエンジンの呼び出しに失敗しました。:${error}`)
    }
    
});

// num
let currenttextchannelid
let currentvoicechannelid

client.on("interactionCreate", async (interaction) => {
    try {
        if (!isready) {
            await interaction.reply(lang.ENGINE_IS_PREPARING);
            return;
        }
        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'setspeakerid') {
                const memberId = interaction.member.id
                getUserData(memberId).then(async data => {
                    let moddedUserData = JSON.parse(JSON.stringify(data))
                    moddedUserData.speakerId = interaction.values[0]
                    setUserData(memberId, moddedUserData)
                    await interaction.update({
                        content: lang.SAVE_SUCCESS,
                        ephemeral: true,
                        components: []
                    });
                })
            }
        } else if ( !interaction.options.getSubcommand() ) {
            await interaction.update({
                content: lang.ERROR,
                ephemeral: true,
                components: []
            });
        } else if (interaction.options.getSubcommand() === 'ping') {
            await interaction.reply(lang.PONG);
        } else if (interaction.options.getSubcommand() === 'join') {
            // ギルドと実行したメンバーとそのメンバーが居るチャンネル
            const guild = interaction.guild;
            const member = await guild.members.fetch(interaction.member.id);
            const memberVC = member.voice.channel;
            // これらが実行されなかったら「ありえないエラーです」
            let message = lang.ERROR
            // チャンネルが存在しない、参加できない、発言できない場合は突っぱねる
            if (!memberVC || !memberVC.joinable || !memberVC.speakable) {
                console.log("Voice connection check failed")
                message = lang.VC_JOIN_FAIL
            } else if ( !interaction.guild.members.me.voice.channel ) {
                // どこにも参加していないなら現在のチャンネルIDを記録して接続し、プレイヤーをサブスクライブ
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
                message = lang.JOIN
                speakqueuearray = []
            } else {
                // すでに参加しているなら突っぱねる
                message = lang.ALREADY_JOINED
            }
            await interaction.reply(message);
        } else if (interaction.options.getSubcommand() === 'leave') {
            const guild = interaction.guild;
            const member = await guild.members.fetch(interaction.member.id);
            const memberVC = member.voice.channel;
            let message = lang.VC_JOIN_ERROR
            if (!memberVC || !memberVC.joinable || !memberVC.speakable) {
                console.log("Voice connection check failed")
                message = lang.VC_DISCONNECT_FAIL
            } else {
                const connection = getVoiceConnection(memberVC.guild.id);
                //console.log(connection)
                if (connection !== undefined) {
                    currenttextchannelid = null
                    currentvoicechannelid = null
                    connection.destroy();
                    message = lang.VC_DISCONNECTED
                }
            }
            await interaction.reply(message);
        } else if (interaction.options.getSubcommand() === 'chgvoice') {
            // 話者がそもそも存在しない場合は突っぱねる
            if (speakersnamearray.includes(interaction.options.getString("speakername"))) {
                // speakerstyleが指定されたならそれを使う
                if ( interaction.options.getString("speakerstyle") ) {
                    // その話者を取得したspeakersから検索
                    const speakerobj = speakersdata.find(elem => elem.name === interaction.options.getString("speakername"))
                    // 検索結果からスタイルを検索
                    const styleobj = speakerobj.styles.find(elem => elem.name === interaction.options.getString("speakerstyle"))
                    // 検索結果があるならそのまま使用して、ないなら突っぱねる
                    if ( styleobj ) {
                        const memberId = interaction.member.id
                        getUserData(memberId).then(async data => {
                            let moddedUserData = JSON.parse(JSON.stringify(data))
                            moddedUserData.speakerId = styleobj.id
                            setUserData(memberId, moddedUserData)
                            await interaction.reply({
                                content: lang.SAVE_SUCCESS,
                                ephemeral: true
                            });
                        })
                    } else {
                        const stylelist = speakerobj.styles.map(elem => { return elem.name })
                        await interaction.reply({
                            content: `${lang.STYLE_NOT_FOUND}${stylelist.join(", ")}`,
                            ephemeral: true
                        });
                    }
                } else {
                    // その話者を取得したspeakersから検索
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
                            .setPlaceholder(lang.SPEAKER_STYLE)
                            .addOptions(styleselectarray);
                        const row = new ActionRowBuilder()
                            .addComponents(select);
                        await interaction.reply({
                            content: `スタイル${lang.Q_SELECT}`,
                            components: [row],
                            ephemeral: true
                        })
                    }) 
                }

            } else {
                await interaction.reply({
                    content: `${lang.SPEAKER_NOT_FOUND}${speakersnamearray.join(',')}`,
                    ephemeral: true
                });
            }
        } else if (interaction.options.getSubcommand() === 'credit') {
            await interaction.reply({
                content: `VOICEVOX: ${speakersnamearray.join(',')}`,
                ephemeral: true
            });
        } else if (interaction.options.getSubcommand() === 'chgvoiceoption') {
            const memberId = interaction.member.id
            if (interaction.options.getString("voiceoption") === "speedScale" && ( interaction.options.getNumber("optionvalue") > 2.0 || interaction.options.getNumber("optionvalue") < 0.5 )) {
                await interaction.reply({
                    content: `話速は0.5~2.0${lang.SHOULD_WITHIN}`,
                    ephemeral: true,
                });
                return;
            } else if (interaction.options.getString("voiceoption") === "pitchScale" && ( interaction.options.getNumber("optionvalue") > 0.15 || interaction.options.getNumber("optionvalue") < -0.15 )) {
                await interaction.reply({
                    content: `ピッチは-0.15~0.15${lang.SHOULD_WITHIN}`,
                    ephemeral: true,
                });
                return;
            } else if (interaction.options.getString("voiceoption") === "intonationScale" && ( interaction.options.getNumber("optionvalue") > 2.0 || interaction.options.getNumber("optionvalue") < 0.5 )) {
                await interaction.reply({
                    content: `抑揚は0.5~2.0${lang.SHOULD_WITHIN}`,
                    ephemeral: true,
                });
                return;
            }
            getDataBase("user", memberId).then(async data => {
                let moddedUserData = JSON.parse(JSON.stringify(data))
                moddedUserData[interaction.options.getString("voiceoption")] = interaction.options.getNumber("optionvalue")
                setUserData(memberId, moddedUserData)
                console.log(`User data modified: ${memberId}`)
                await interaction.reply({
                    content: lang.SAVE_SUCCESS,
                    ephemeral: true
                });
            })
        // TODO: この辺はfunctionにまとめて、できる限り複製されたコードをなくす
        } else if (interaction.options.getSubcommand() === 'dictadd') {
            if (interaction.options.getString("controldict") == "server" ) {
                // このインタラクションをしたギルドIDを取得
                const guildId = interaction.guild.id
                // ユーザーデータのテーブルからギルドID名の行を取得
                getServerData(guildId).then(async data => {
                    let moddedGuildData = JSON.parse(JSON.stringify(data))
                    moddedGuildData.dict.push({ from: interaction.options.getString("dictreplacefrom"), to: interaction.options.getString("dictreplaceto") })
                    setServerData(guildId, moddedGuildData)
                    console.log(`Server data modified: ${guildId}`)
                    await interaction.reply({
                        content: lang.SAVE_SUCCESS_SERVER,
                        ephemeral: false
                    });
                })
            } else {
                // このインタラクションをしたメンバーIDを取得
                const memberId = interaction.member.id
                // ユーザーデータのテーブルからメンバーID名の行を取得
                getUserData(memberId).then(async data => {
                    let moddedUserData = JSON.parse(JSON.stringify(data))
                    moddedUserData.dict.push({ from: interaction.options.getString("dictreplacefrom"), to: interaction.options.getString("dictreplaceto") })
                    setUserData(memberId, moddedUserData)
                    console.log(`User data modified: ${memberId}`)
                    await interaction.reply({
                        content: lang.SAVE_SUCCESS,
                        ephemeral: true
                    });
                })
            }
        } else if (interaction.options.getSubcommand() === 'dictremove') {
            if (interaction.options.getString("controldict") == "server" ) {
                // このインタラクションをしたギルドIDを取得
                const guildId = interaction.guild.id
                // ユーザーデータのテーブルからギルドID名の行を取得
                getServerData(guildId).then(async data => {
                    let moddedGuildData = JSON.parse(JSON.stringify(data))
                    // 「お前消す」なワードのobjを探す
                    const dictObj = moddedGuildData.dict.find(elem => elem.from === interaction.options.getString("deleteword"))
                    //console.log(dictObj)
                    if ( dictObj != undefined ) {
                        // さっき探したやつでfilter
                        moddedGuildData.dict = moddedGuildData.dict.filter(elem => elem !== dictObj)
                        setServerData(guildId, moddedGuildData)
                        console.log(`Server data modified: ${guildId}`)
                        await interaction.reply({
                            content: lang.SAVE_SUCCESS_SERVER,
                            ephemeral: false
                        });
                    } else {
                        await interaction.reply({
                            content: lang.WORD_NOT_FOUND,
                            ephemeral: true
                        });
                    }
                })
            } else {
                // このインタラクションをしたメンバーIDを取得
                const memberId = interaction.member.id
                // ユーザーデータのテーブルからメンバーID名の行を取得
                getUserData(memberId).then(async data => {
                    // 値渡し
                    let moddedUserData = JSON.parse(JSON.stringify(data))
                    // 「お前消す」なワードのobjを探す
                    const dictobj = moddedUserData.dict.find(elem => elem.from === interaction.options.getString("deleteword"))
                    //console.log(dictobj)
                    if ( dictobj != undefined ) {
                        // さっき探したやつでfilter
                        moddedUserData.dict = moddedUserData.dict.filter(elem => elem !== dictobj)
                        setUserData(memberId, moddedUserData)
                        console.log(`User data modified: ${memberId}`)
                        await interaction.reply({
                            content: lang.SAVE_SUCCESS,
                            ephemeral: true
                        });
                    } else {
                        await interaction.reply({
                            content: lang.WORD_NOT_FOUND,
                            ephemeral: true
                        });
                    }
                })
            }
        } else if (interaction.options.getSubcommand() === 'dictshow') {
            let listTextArray = []
            let ephemeralStat = !interaction.options.getBoolean("noephemeral") ?? true
            let id = interaction.member.id
            let typetext = "個人"
            //console.log(interaction.options.getBoolean("noephemeral"))
            if (interaction.options.getString("controldict") == "server" ) {
                id = interaction.guild.id
                typetext = "サーバー"
            }
            getDataBase(interaction.options.getString("controldict"), id).then(async data => {
                let dict = data.dict
                if ( dict == null || dict == undefined || dict.length == 0 ) {
                    await interaction.reply({
                        content: `${typetext}${lang.NO_DICT}`,
                        ephemeral: true
                    });
                } else {
                    dict.forEach(element => {
                        listTextArray.push(`${element.from}→${element.to}`)
                    });
                    const dictText = listTextArray.join("\n")
                    fs.writeFile("./temp/dict.txt", dictText, async (err) => {
                        await interaction.reply({
                            content: `${typetext}${lang.DICT_OUTPUT_TO_FILE}`,
                            ephemeral: ephemeralStat,
                            files: ["./temp/dict.txt"]
                        });
                    })
                }
            })
        } else if (interaction.options.getSubcommand() === 'owner_shutdown') {
            // このインタラクションをしたメンバーIDを取得
            const memberId = interaction.member.id
            if ( memberId === owner_userid ) {
                await interaction.reply({
                    content: "シャットダウンします… お待ちください",
                    ephemeral: false
                });
                client.user.setPresence({
                    activities: [{ name: `終了中`, type: ActivityType.Watching }],
                    status: 'dnd',
                });
                client.destroy()
                process.exit(0)
            } else {
                console.log(`owner_shutdownが使用されましたが、configで指定されたユーザーIDに一致しませんでした。これを行ったユーザー: ${memberId}`)
                await interaction.reply({
                    content: "BotのシャットダウンはこのBotのオーナー以外は使用できません。この事象は記録されます。",
                    ephemeral: false
                });
            }

        } else {
            await interaction.reply('Invalid Command.....');
        }
    } catch (err) {
        console.log(err)
        interaction.channel.send(lang.UNEXCEPTED_ERROR)
    }
});


function playMessage(obj) {
    isBusy = true
    Promise.all([ getUserData(obj.memberId), getServerData(obj.guildId) ]).then(dataarray => {
        const userdata = dataarray[0]
        const serverdata = dataarray[1]
        let speed = userdata.speedScale ?? 1.0
        const pitch = userdata.pitchScale ?? 0.0
        const intonation = userdata.intonationScale ?? 1.0
        const dict = userdata.dict ?? []
        const serverdict = serverdata.dict ?? []
        let speakerId = userdata.speakerId ?? 0
        // ボイスオーバーライド
        /*if (obj.content.startsWith("vor?=")) {
            if (obj.content.indexOf("\n") !== -1) {
                obj.content.split(",")
            } else {
            }
            
        }*/
        if (fastforwardqueue > 0 && speakqueuearray.length >= fastforwardqueue) {
            speed = fastforwardspeed
            console.log("速読しました。 現在のキュー: " + speakqueuearray.length)
        }
        
        let content = obj.content.toLowerCase()
        console.log(`Message in channel!: ${obj.content} ${userdata.speakerId} ${speed} ${pitch} ${intonation}`)
        Promise.all([ dict.map(async elem => { content = content.replaceAll(elem.from.toLowerCase(), elem.to)}), serverdict.map(async elem => { content = content.replaceAll(elem.from.toLowerCase(), elem.to)}) ]).then(async () => {
            let currentHost = voicevox_host
            IsActiveHost(voicevox_preferhost).then(async (result) => {
                if ( result === true ) {
                    currentHost = voicevox_preferhost
                    console.log("優先ホストが使用されます")
                }
                const audioqueryresponse = await fetch(`http://${currentHost}/audio_query?text=${content}&speaker=${speakerId}`, {
                    method: "POST"
                }).catch((err) => {
                    console.log(err)
                })
                let queryresponse = await audioqueryresponse.text() ?? null
                if (queryresponse) {
                    const parsedquery = JSON.parse(queryresponse)
                    parsedquery.speedScale = speed
                    parsedquery.pitchScale = pitch
                    parsedquery.intonationScale = intonation
                    //console.log(parsedquery)
    
                    let voiceresource = await synthesisRequest(currentHost, parsedquery, speakerId)
                    player.play(voiceresource);
                    console.log(`再生中`)
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
        if ( player.state.status === AudioPlayerStatus.Idle && isBusy !== true ) {
            playMessage({ content: message.content, memberId: message.member.id, guildId: message.guild.id })
        } else {
            speakqueuearray.push({ content: message.content, memberId: message.member.id, guildId: message.guild.id  })
            console.log("読み上げ中のメッセージがあったため、キューに移動しました")
        }
    }

    //console.log(`Message coming: ${message.content}`)
});

client.on('voiceStateUpdate', (oldstate, newstate) => {
    if (oldstate.channelId === newstate.channelId) {
        return;
    }
    if (oldstate.channelId === null && newstate.channelId !== null) {
        console.log("It's all connected!" + newstate.channel.members.size)
    } else if (oldstate.channelId !== null && newstate.channelId === null) {
        console.log("It's all disconnected!")
        if (oldstate.channel.members.size < 2 && oldstate.channelId === currentvoicechannelid) {
            const connection = getVoiceConnection(oldstate.guild.id);
            //console.log(connection)
            if (connection !== undefined) {
                const textch = client.channels.cache.get(currenttextchannelid)
                if (textch) {
                    textch.send(lang.AUTO_DISCONNECT_NOLISTENER)
                }
                connection.destroy();
                currenttextchannelid = null
                currentvoicechannelid = null
            }
        }
    }
});

player.on(AudioPlayerStatus.Idle, () => {
    isBusy = false
    if (speakqueuearray.length > 0) {
        playMessage(speakqueuearray[0])
        speakqueuearray.shift()
    }
});

client.login(bot_token);
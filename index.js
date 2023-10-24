const { Client, GatewayIntentBits, Partials, ChannelType, ApplicationCommandOptionType, ActivityType, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, InteractionType, PermissionFlagsBits, PermissionsBitField } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const { bot_token, voicevox_host, database_host, fastforwardqueue, fastforwardspeed, owner_userid, language_file, voicevox_preferhost, noread_prefix, initial_userdata } = require('./config.json');
const lang = require('./langs/' + language_file);
const { cmdArray } = require('./modules/cmdarray.js');
const { synthesisRequest, IsActiveHost } = require('./modules/engineControl.js')
const { getUserData, setUserData, getServerData, setServerData, getDataBase } = require('./modules/dbcontrol.js')
const fs = require("fs");
const Keyv = require('keyv');
const { parse } = require('path');
const packageInfo = require('./package.json');
const userdata = new Keyv(database_host, { table: 'userobj' })
const serverdata = new Keyv(database_host, { table: 'serverobj' })
const url_regex = /https?:\/\/[-A-Z0-9+&@#/%=~_|$?!:,.]*[A-Z0-9+&@#/%=~_|$]/ig;
const spoiler_regex = /\|\|(.*?)\|\|/ig;

const client = new Client({ intents: [ GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent ], partials: [Partials.Channel] });

userdata.on('error', err => console.error('Keyv connection error:', err))
serverdata.on('error', err => console.error('Keyv connection error:', err))

let isready = false
let speakersdata = []
const player = createAudioPlayer();
let speakersnamearray = []
let speakerIdInfoObj = {}
let speakqueuearray = []
let isBusy = false

if (!fs.existsSync("temp")) {
    fs.mkdirSync("temp");
}

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
                            speakersdata.map( elem => {
                                elem.styles.map( selem => {
                                    speakerIdInfoObj[selem.id] = { styleName: selem.name, speakerName: elem.name, speakerUUID: elem.speaker_uuid }
                                } )
                            } )
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

client.on("interactionCreate", async (interaction) => {
    try {
        if (!isready) {
            await interaction.reply(lang.ENGINE_IS_PREPARING);
            return;
        }
        if (interaction.isStringSelectMenu()) {
            // ボイスチェンジの「スタイル選択」からスタイルが選択された時に発火する
            if (interaction.customId === 'setspeakerid') {
                const memberId = interaction.member.id
                getUserData(memberId).then(async data => {
                    let moddedUserData = JSON.parse(JSON.stringify(data))
                    moddedUserData.speakerId = interaction.values[0]
                    setUserData(memberId, moddedUserData)
                    await interaction.update({
                        content: lang.SAVE_SUCCESS,
                        ephemeral: false,
                        components: []
                    });
                })
            }
        } else if ( !interaction.options.getSubcommand() ) {
            // サブコマンドじゃなければ終わり
            await interaction.update({
                content: lang.ERROR,
                ephemeral: true,
                components: []
            });
        } else if (interaction.options.getSubcommand() === 'ping') {
            await interaction.reply(lang.PONG);
        } else if (interaction.options.getSubcommand() === 'help') {
            await interaction.reply(lang.HELP);
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
            let message = lang.VC_JOIN_ERROR;
            //console.log(interaction.guild.members.me.voice.channel.id)
            if (!interaction.guild.members.me.voice.channel) { 
                message = lang.VC_DISCONNECT_NO_CHANNEL;
            } else if (memberVC.id !== interaction.guild.members.me.voice.channel.id) {
                message = lang.VC_DISCONNECT_WRONG_CHANNEL;
            }  else if ( !memberVC || !memberVC.joinable || !memberVC.speakable ) {
                console.log("Voice connection check failed")
                message = lang.VC_DISCONNECT_FAIL;
            } else {
                const connection = getVoiceConnection(memberVC.guild.id);
                console.log(connection)
                if (connection !== undefined) {
                    currenttextchannelid = null
                    connection.destroy();
                    message = lang.VC_DISCONNECTED;
                }
            }
            //console.log(message)
            await interaction.reply({
                content: message,
                ephemeral: false
            });
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
                                content: lang.SAVE_SUCCESS + "話者を **" + interaction.options.getString("speakername") + " " + interaction.options.getString("speakerstyle") + "** " + lang.CHANGED,
                                ephemeral: false
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
                            .setLabel(`${interaction.options.getString("speakername")} ${elem.name}`)
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
        } else if (interaction.options.getSubcommand() === 'voiceprefixassign') {
            // 話者がそもそも存在しない場合は突っぱねる
            if (speakersnamearray.includes(interaction.options.getString("speakername"))) {
                // その話者を取得したspeakersから検索
                const speakerobj = speakersdata.find(elem => elem.name === interaction.options.getString("speakername"))
                // 検索結果からスタイルを検索
                const styleobj = speakerobj.styles.find(elem => elem.name === interaction.options.getString("speakerstyle"))
                // 検索結果があるならそのまま使用して、ないなら突っぱねる
                if ( styleobj ) {
                    const memberId = interaction.member.id
                    getUserData(memberId).then(async data => {
                        let moddedUserData = JSON.parse(JSON.stringify(data))
                        // あるならそれを使い、ないなら空のObj
                        const vorObj = moddedUserData.vorSettings ?? {}
                        vorObj[interaction.options.getString("assignprefix")] = styleobj.id
                        moddedUserData.vorSettings = vorObj
                        setUserData(memberId, moddedUserData)
                        await interaction.reply({
                            content: lang.SAVE_SUCCESS + "プレフィックス `" + interaction.options.getString("assignprefix") + "` に 話者 **" + interaction.options.getString("speakername") + " " + interaction.options.getString("speakerstyle") + "** " + lang.ASSIGNED,
                            ephemeral: false
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
                await interaction.reply({
                    content: `${lang.SPEAKER_NOT_FOUND}${speakersnamearray.join(',')}`,
                    ephemeral: true
                });
            }
        } else if (interaction.options.getSubcommand() === 'voiceprefixremove') {
            const memberId = interaction.member.id
            getUserData(memberId).then(async data => {
                let text = lang.PREFIX_NOT_FOUND
                let moddedUserData = JSON.parse(JSON.stringify(data))
                // あるならそれを使い、ないなら空のObj
                const vorObj = moddedUserData.vorSettings ?? {}
                if ( Object.keys(vorObj).includes(interaction.options.getString("removeprefix")) ) {
                    delete vorObj[interaction.options.getString("removeprefix")]
                    moddedUserData.vorSettings = vorObj
                    setUserData(memberId, moddedUserData)
                    text = lang.SAVE_SUCCESS + "プレフィックス `" + interaction.options.getString("removeprefix") + "` への割り当て" + lang.DELETED
                }
                await interaction.reply({
                    content: text,
                    ephemeral: true
                });
            })
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
            let typeText = "不明なオプション"
            if ( interaction.options.getString("voiceoption") === "speedScale" ) {
                typeText = "話速"
            } else if ( interaction.options.getString("voiceoption") === "pitchScale" ) {
                typeText = "ピッチ"
            } else if ( interaction.options.getString("voiceoption") === "intonationScale" ) {
                typeText = "抑揚"
            }

            getDataBase("user", memberId).then(async data => {
                let moddedUserData = JSON.parse(JSON.stringify(data))
                moddedUserData[interaction.options.getString("voiceoption")] = interaction.options.getNumber("optionvalue")
                setUserData(memberId, moddedUserData)
                console.log(`User data modified: ${memberId}`)
                await interaction.reply({
                    content: lang.SAVE_SUCCESS + "**" + typeText + "** を **" + interaction.options.getNumber("optionvalue") + "** " + lang.CHANGED,
                    ephemeral: false
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
                        content: lang.SAVE_SUCCESS_SERVER + "`" + interaction.options.getString("dictreplacefrom") + "` を `" + interaction.options.getString("dictreplaceto") + "` へ置き換えるよう" + lang.CONFIGURED,
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
                        content: lang.SAVE_SUCCESS + "`" + interaction.options.getString("dictreplacefrom") + "` を `" + interaction.options.getString("dictreplaceto") + "` へ置き換えるよう" + lang.CONFIGURED,
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
            let ephemeralStat = interaction.options.getBoolean("ephemeral") ?? true
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

        } else if (interaction.options.getSubcommand() === 'credit') {
            await interaction.reply({
                content: `TTSVOX v${packageInfo.version}\nリポジトリ: <${packageInfo.homepage}>\n\nVOICEVOX: ${speakersnamearray.join(',')}`,
                ephemeral: true
            });
        } else if (interaction.options.getSubcommand() === 'showmysettings') {
            const memberId = interaction.member.id
            const data = await getDataBase("user", memberId)
            const ephemeral = interaction.options.getBoolean("ephemeral") ?? true

            const speakerId = data.speakerId ?? initial_userdata.speakerId
            const speedScale = data.speedScale ?? initial_userdata.speedScale
            const pitchScale = data.pitchScale ?? initial_userdata.pitchScale
            const intonationScale = data.intonationScale ?? initial_userdata.intonationScale
            const vorSettings = data.vorSettings ?? {}

            let vorSettingsText = "ボイスオーバーライド: 割り当てなし"
            if ( Object.keys(vorSettings).length > 0 ) { 
                vorSettingsText = "ボイスオーバーライド(" + Object.keys(vorSettings).length + "個の割り当て): \n```\n" + Object.keys(vorSettings).slice(0,10).map(elem => elem + " => " + speakerIdInfoObj[vorSettings[elem]].speakerName + " " + speakerIdInfoObj[vorSettings[elem]].styleName).join("\n") + "\n```(最初の10個を表示)"
            }

            const text = "**" + interaction.member.displayName + " さんの設定**\n" + 
            "使用中の話者: " + speakerIdInfoObj[speakerId].speakerName + " " + speakerIdInfoObj[speakerId].styleName + "\n" + 
            "話速: " + speedScale  + " / ピッチ: " + pitchScale + " / 抑揚: " + intonationScale + "\n\n" + 
            vorSettingsText;
            await interaction.reply({
                content: text,
                ephemeral: ephemeral
            });
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
        const vorSettings = userdata.vorSettings ?? {}
        const vorPrefixArray = Object.keys(vorSettings)
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
        Promise.all([ 
            // vorのPrefixの配列でmapして、それで始まるなら話者をそのIDに、またcontentの先頭にあるPrefixも取っ払う
            vorPrefixArray.map(elem => { if ( content.startsWith(elem.toLowerCase()) ) { speakerId = vorSettings[elem]; content = content.replace(elem, ""); } }), 
            // dict用
            dict.map(async elem => { content = content.replaceAll(elem.from.toLowerCase(), elem.to)}), 
            serverdict.map(async elem => { content = content.replaceAll(elem.from.toLowerCase(), elem.to)}) 
        ]).then(async () => {
            let currentHost = voicevox_host
            IsActiveHost(voicevox_preferhost).then(async (result) => {
                if ( result === true ) {
                    currentHost = voicevox_preferhost
                    console.log("優先ホストが使用されます")
                }
                const audioqueryresponse = await fetch(`http://${currentHost}/audio_query?text=${encodeURIComponent(content)}&speaker=${encodeURIComponent(speakerId)}`, {
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

function playOrQueue(obj) {
    if ( player.state.status === AudioPlayerStatus.Idle && isBusy !== true ) {
        playMessage(obj)
    } else {
        speakqueuearray.push(obj)
        console.log("読み上げ中のメッセージがあったため、キューに移動しました")
    }
}

client.on('messageCreate', message => {
    if (message.author.bot) {
        return;
    }
    if ( message.channel.id === currenttextchannelid && !message.content.startsWith(noread_prefix) ) {
        let text = message.content.replace(url_regex, "").replace(spoiler_regex, lang.SPOILER_REPLACE)
        if ( url_regex.test(message.content) ) {
            text = text + lang.URL_INCLUDED
        }
        playOrQueue({ content: text, memberId: message.member.id, guildId: message.guild.id })
    }

    //console.log(`Message coming: ${message.content}`)
});

client.on('voiceStateUpdate', async (oldstate, newstate) => {
    if (oldstate.channelId === newstate.channelId) {
        return;
    }
    let text = null
    if (oldstate.channelId === null && newstate.channelId !== null) {
        console.log("It's all connected!" + newstate.channel.members.size)
        console.log(`connect username: ${newstate.member.displayName}`)
        console.log(`connect userisbot: ${newstate.member.user.bot}`)
        if ( !newstate.member.user.bot ) {
            text = newstate.member.displayName + lang.USER_CONNECTED
        }
    } else if (oldstate.channelId !== null && newstate.channelId === null) {
        console.log("It's all disconnected!")
        console.log(`disconnect username: ${oldstate.member.displayName}`)
        console.log(`disconnect userisbot: ${oldstate.member.user.bot}`)
        if ( !oldstate.member.user.bot ) {
            text = oldstate.member.displayName + lang.USER_DISCONNECTED
        }
        const currentGuild = await client.guilds.cache.get(oldstate.guild.id)
        //console.log(currentGuild)
        if (oldstate.channel.members.size < 2 && currentGuild.members.me.voice.channel && oldstate.channelId === currentGuild.members.me.voice.channel.id) {
            const connection = getVoiceConnection(oldstate.guild.id);
            //console.log(connection)
            if (connection !== undefined) {
                const textch = client.channels.cache.get(currenttextchannelid)
                if (textch) {
                    textch.send(lang.AUTO_DISCONNECT_NOLISTENER)
                }
                connection.destroy();
                currenttextchannelid = null
            }
        }
    }
    if ( text !== null ) {
        const textch = client.channels.cache.get(currenttextchannelid)
        if (textch) {
            textch.send(text)
            playOrQueue({ content: text, memberId: 0, guildId: 0 })
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
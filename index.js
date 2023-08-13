const { Client, GatewayIntentBits, Partials, ChannelType, ApplicationCommandOptionType, ActivityType, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection, createAudioPlayer, createAudioResource } = require('@discordjs/voice');
const got = require('got');
const { bot_token } = require('./config.json');
const userdata = require('./userdata.json');
const fs = require("fs");

const client = new Client({ intents: [ GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent ], partials: [Partials.Channel] });


let isready = false
let speakersdata = []
const player = createAudioPlayer();

client.once("ready", async () => {
    client.user.setPresence({
        activities: [{ name: `お待ちください…`, type: ActivityType.Watching }],
        status: 'dnd',
    });
    // スラッシュコマンドを作成する
    const data = [{
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
        description: "ボイス変更メニューを開きます。設定はあなた以外には見えません。"
    }];
    await client.application.commands.set(data);
    console.log("Ready!");

    client.user.setPresence({
        activities: [{ name: `VOICEVOXエンジンに連絡中`, type: ActivityType.Watching }],
        status: 'dnd',
    });
    // VOICEVOXエンジンに接続可能か確認する。
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
                        // isreadyを立ててコマンドの受付を開始する
                        client.user.setPresence({
                            activities: [{ name: `READY`, type: ActivityType.Playing }],
                            status: 'online',
                        });
                        isready = true
                    })
                }
            })
        } else {
            console.log(`重大なエラー: VOICEVOXエンジンの呼び出しに失敗しました。ステータスコードは ${response.status} でした。`)
        }
    })
});

// num
let currentchannelid

client.on("interactionCreate", async (interaction) => {
    try {
        if (!interaction.isCommand()) {
            return;
        }
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
            const select = new StringSelectMenuBuilder()
                .setCustomId('setvoicepanel')
                .setPlaceholder('Make a selection!')
                .addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Bulbasaur')
                        .setDescription('The dual-type Grass/Poison Seed Pokémon.')
                        .setValue('bulbasaur'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Charmander')
                        .setDescription('The Fire-type Lizard Pokémon.')
                        .setValue('charmander'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Squirtle')
                        .setDescription('The Water-type Tiny Turtle Pokémon.')
                        .setValue('squirtle'),
                );
            const row = new ActionRowBuilder()
                .addComponents(select);
            await interaction.reply({
                content: 'Choose your starter!',
                components: [row],
                ephemeral: true
            });
        } else {
            await interaction.reply('Invalid Command.....');
        }
    } catch (err) {
        console.log(err)
        interaction.channel.send("エラー！！問題が発生しました。")
    }
});

client.on('messageCreate', message => {
    if (message.author.bot) {
        return;
    }
    if (message.channel.id === currentchannelid) {
        console.log(`Message in channel!: ${message.content}`)
        fetch(`http://127.0.0.1:50021/audio_query?text=${message.content}&speaker=61`, {
            method: "POST"
        }).then(response => {
            if (response.status === 200) {
                response.text().then(text => {
                    console.log(text)
                    fetch(`http://127.0.0.1:50021/synthesis?speaker=61`, {
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
    }
    //console.log(`Message coming: ${message.content}`)
});

client.login(bot_token);
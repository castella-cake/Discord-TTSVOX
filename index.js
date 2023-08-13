const { Client, GatewayIntentBits, Partials, ChannelType, ApplicationCommandOptionType } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');
const { bot_token } = require('./config.json');

const client = new Client({ intents: [ GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent ], partials: [Partials.Channel] });

client.once("ready", async () => {
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
    }];
    await client.application.commands.set(data);
    console.log("Ready!");
});

// num
let currentchannelid

client.on("interactionCreate", async (interaction) => {
    try {
        if (!interaction.isCommand()) {
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
    }
    //console.log(`Message coming: ${message.content}`)
});

client.login(bot_token);
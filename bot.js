
const { Client, GatewayIntentBits, EmbedBuilder, ActivityType  } = require('discord.js');
const axios = require('axios');
const fs = require('fs');
const config = require('./config.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const STREAMERS_FILE = 'streamers.json';
let streamers = [];
let liveStreamers = new Set();
let twitchAccessToken = '';

// ==========================================
// Streamer-Verwaltung
// ==========================================

function loadStreamers() {
    try {
        if (fs.existsSync(STREAMERS_FILE)) {
            const data = fs.readFileSync(STREAMERS_FILE, 'utf8');
            streamers = JSON.parse(data);
            console.log(`📋 ${streamers.length} Streamer geladen`);
        }
    } catch (error) {
        console.error('❌ Fehler beim Laden der Streamer:', error);
        streamers = [];
    }
}

function saveStreamers() {
    try {
        fs.writeFileSync(STREAMERS_FILE, JSON.stringify(streamers, null, 2));
        console.log('💾 Streamer gespeichert');
    } catch (error) {
        console.error('❌ Fehler beim Speichern der Streamer:', error);
    }
}

// ==========================================
// Twitch API
// ==========================================

async function getTwitchAccessToken() {
    try {
        const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
            params: {
                client_id: config.twitchClientId,
                client_secret: config.twitchSecret,
                grant_type: 'client_credentials'
            }
        });
        twitchAccessToken = response.data.access_token;
        console.log('🔑 Twitch Access Token erhalten');
    } catch (error) {
        console.error('❌ Fehler beim Holen des Twitch Tokens:', error);
    }
}

async function checkStreamer(username) {
    try {
        const response = await axios.get('https://api.twitch.tv/helix/streams', {
            headers: {
                'Client-ID': config.twitchClientId,
                'Authorization': `Bearer ${twitchAccessToken}`
            },
            params: {
                user_login: username
            }
        });

        return response.data.data.length > 0 ? response.data.data[0] : null;
    } catch (error) {
        console.error(`❌ Fehler beim Prüfen von ${username}:`, error.message);
        return null;
    }
}

async function getUserInfo(username) {
    try {
        const response = await axios.get('https://api.twitch.tv/helix/users', {
            headers: {
                'Client-ID': config.twitchClientId,
                'Authorization': `Bearer ${twitchAccessToken}`
            },
            params: {
                login: username
            }
        });

        return response.data.data.length > 0 ? response.data.data[0] : null;
    } catch (error) {
        console.error(`❌ Fehler beim Holen der User-Info für ${username}:`, error.message);
        return null;
    }
}

// ==========================================
// Live-Benachrichtigungen
// ==========================================

async function sendLiveNotification(streamData) {
    try {
        const channel = await client.channels.fetch(config.notificationChannelId);
        
        const embed = new EmbedBuilder()
            .setColor('#9146FF')
            .setTitle(`🔴 ${streamData.user_name} is now live`)
            .setDescription(streamData.title)
            .addFields(
                { name: 'Playing:', value: streamData.game_name || 'Nicht verfügbar', inline: true },
                { name: 'Viewers:', value: streamData.viewer_count.toString(), inline: true },
                { name: 'Twitch:', value: `[watch stream](https://twitch.tv/${streamData.user_login})`, inline: false }
            )
            .setImage(streamData.thumbnail_url.replace('{width}', '1920').replace('{height}', '1080'))
            .setTimestamp();

        await channel.send({
            content: `<@&${config.pingRoleId}>`,
            embeds: [embed]
        });

        console.log(`📢 Benachrichtigung für ${streamData.user_name} gesendet`);
    } catch (error) {
        console.error('❌ Fehler beim Senden der Benachrichtigung:', error);
    }
}

async function checkAllStreamers() {
    for (const username of streamers) {
        const streamData = await checkStreamer(username);
        
        if (streamData && !liveStreamers.has(username)) {
            liveStreamers.add(username);
            await sendLiveNotification(streamData);
        } else if (!streamData && liveStreamers.has(username)) {
            liveStreamers.delete(username);
            console.log(`📴 ${username} ist offline`);
        }
    }
}

// ==========================================
// Discord Events
// ==========================================

client.once('ready', async () => {
    console.log(`✅ Bot eingeloggt als ${client.user.tag}`);

    // Presence setzen
    client.user.setPresence({
        activities: [{
            name: 'EXTASY-LIFE Content System By Feso',
            type: ActivityType.Streaming,
            url: 'https://www.twitch.tv/the_offical_feso2'
        }],
        status: 'online',
    });

    loadStreamers();
    await getTwitchAccessToken();

    setInterval(getTwitchAccessToken, 12 * 60 * 60 * 1000);
    setInterval(checkAllStreamers, config.checkInterval);

    console.log(`🔄 Streamer werden alle ${config.checkInterval / 1000} Sekunden geprüft`);
});


client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    // Prüfe Berechtigung
    if (!interaction.member.roles.cache.has(config.requiredRoleId) && 
        !interaction.member.permissions.has('Administrator')) {
        return interaction.reply({ 
            content: '❌ Du hast keine Berechtigung, diesen Befehl zu verwenden!', 
            ephemeral: true 
        });
    }

    const { commandName } = interaction;

    if (commandName === 'addstreamer') {
        await interaction.deferReply();
        
        const username = interaction.options.getString('username').toLowerCase();

        if (streamers.includes(username)) {
            return interaction.editReply(`❌ **${username}** ist bereits in der Liste!`);
        }

        const userInfo = await getUserInfo(username);
        if (!userInfo) {
            return interaction.editReply(`❌ Twitch-Benutzer **${username}** nicht gefunden!`);
        }

        streamers.push(username);
        saveStreamers();
        
        interaction.editReply(`✅ **${username}** wurde zur Liste hinzugefügt! (Gesamt: ${streamers.length})`);
        console.log(`➕ Streamer hinzugefügt: ${username}`);
    }

    if (commandName === 'removestreamer') {
        const username = interaction.options.getString('username').toLowerCase();

        if (!streamers.includes(username)) {
            return interaction.reply({ 
                content: `❌ **${username}** ist nicht in der Liste!`, 
                ephemeral: true 
            });
        }

        streamers = streamers.filter(s => s !== username);
        liveStreamers.delete(username);
        saveStreamers();
        
        interaction.reply(`✅ **${username}** wurde von der Liste entfernt! (Gesamt: ${streamers.length})`);
        console.log(`➖ Streamer entfernt: ${username}`);
    }

    if (commandName === 'streamers') {
        if (streamers.length === 0) {
            return interaction.reply({ 
                content: '📋 Die Streamerliste ist leer!', 
                ephemeral: true 
            });
        }
        
        const list = streamers.map((s, i) => `${i + 1}. ${s}`).join('\n');
        interaction.reply({ 
            content: `📋 **Überwachte Streamer (${streamers.length}):**\n\`\`\`\n${list}\n\`\`\``,
            ephemeral: true 
        });
    }
});

client.login(config.token);
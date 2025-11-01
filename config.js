require('dotenv').config();

module.exports = {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID,
    twitchClientId: process.env.TWITCH_CLIENT_ID,
    twitchSecret: process.env.TWITCH_SECRET,
    notificationChannelId: process.env.NOTIFICATION_CHANNEL_ID,
    pingRoleId: process.env.PING_ROLE_ID,
    requiredRoleId: process.env.REQUIRED_ROLE_ID,
    checkInterval: parseInt(process.env.CHECK_INTERVAL) || 60000
};

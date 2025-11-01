
const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const config = require('./config.js');

const commands = [
    new SlashCommandBuilder()
        .setName('addstreamer')
        .setDescription('Fügt einen Twitch-Streamer zur Überwachung hinzu')
        .addStringOption(option =>
            option.setName('username')
                .setDescription('Der Twitch-Benutzername')
                .setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('removestreamer')
        .setDescription('Entfernt einen Twitch-Streamer von der Überwachung')
        .addStringOption(option =>
            option.setName('username')
                .setDescription('Der Twitch-Benutzername')
                .setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('streamers')
        .setDescription('Zeigt alle überwachten Streamer an')
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(config.token);

(async () => {
    try {
        console.log('Registriere Slash-Commands...');

        await rest.put(
            Routes.applicationCommands(config.clientId),
            { body: commands }
        );

        console.log('✅ Slash-Commands erfolgreich registriert!');
    } catch (error) {
        console.error('❌ Fehler beim Registrieren der Commands:', error);
    }
})();
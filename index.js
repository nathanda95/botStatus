const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const isServerUp = require('./checkServer');
const config = require('./config.json');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

let lastStatus = null;

client.once('ready', async () => {
  console.log(`Bot connecté en tant que ${client.user.tag}`);

  setInterval(async () => {
    const isUp = await isServerUp(config.serverToMonitor.host, config.serverToMonitor.port);

    if (lastStatus === null) lastStatus = isUp;

    if (isUp !== lastStatus) {
      lastStatus = isUp;
      if (config.notifyUserId) {
        const user = await client.users.fetch(config.notifyUserId);
        user.send(`🔔 Le serveur est maintenant **${isUp ? 'EN LIGNE' : 'HORS LIGNE'}**`);
      }
    }

    if (config.channelId && config.statusMessageId) {
      const channel = await client.channels.fetch(config.channelId);
      const message = await channel.messages.fetch(config.statusMessageId).catch(() => null);
      const embed = new EmbedBuilder()
        .setTitle('État du serveur')
        .setDescription(isUp ? '🟢 En ligne' : '🔴 Hors ligne')
        .setColor(isUp ? 0x00ff00 : 0xff0000)
        .setTimestamp();

      if (message) {
        await message.edit({ embeds: [embed] });
      }
    }
  }, config.checkInterval);
});

client.on('messageCreate', async (message) => {
  if (!message.content.startsWith('!monitor') || message.author.bot) return;

  const args = message.content.split(' ');

  if (args[1] === 'setchannel') {
    config.channelId = message.channel.id;
    const embed = new EmbedBuilder().setTitle("État du serveur").setDescription("⏳ Vérification...");

    const sentMessage = await message.channel.send({ embeds: [embed] });
    config.statusMessageId = sentMessage.id;

    fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
    message.reply('✅ Salon de statut configuré.');
  }

  if (args[1] === 'setuser') {
    if (!message.mentions.users.first()) {
      return message.reply('❌ Vous devez mentionner un utilisateur.');
    }
    config.notifyUserId = message.mentions.users.first().id;
    fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
    message.reply(`✅ Notifications envoyées à ${message.mentions.users.first().tag}`);
  }
});

client.login(config.token);

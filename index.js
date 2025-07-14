const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const isServerUp = require('./checkServer');
const config = require('./config.json');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ]
});

let lastStatusMap = {};

client.once('ready', () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);

  setInterval(async () => {
    const embed = new EmbedBuilder()
      .setTitle('🖥️ État des serveurs')
      .setColor(0x00e100)
      .setTimestamp();

    let description = '';

    if (!config.servers || config.servers.length === 0) {
      description = 'Aucun serveur surveillé. Utilise `!monitor addserver` pour en ajouter.';
    } else {
      for (const server of config.servers) {
        const key = `${server.host}:${server.port}`;
        const isUp = await isServerUp(server.host, server.port);
        const lastStatus = lastStatusMap[key];

        if (lastStatus !== undefined && isUp !== lastStatus) {
          if (Array.isArray(config.notifyUserIds)) {
            for (const userId of config.notifyUserIds) {
              try {
                const user = await client.users.fetch(userId);
                await user.send(`🔔 **${server.name}** est maintenant **${isUp ? '🟢 EN LIGNE' : '🔴 HORS LIGNE'}** (${server.host}:${server.port})`);
              } catch (err) {
                console.warn(`⚠️ Impossible de DM ${userId} : ${err.message}`);
              }
            }
          }
        }

        lastStatusMap[key] = isUp;
        description += `• **${server.name}** (${server.host}:${server.port}) → ${isUp ? '🟢 En ligne' : '🔴 Hors ligne'}\n`;
      }
    }

    embed.setDescription(description);

    if (Array.isArray(config.channelIds) && config.statusMessageMap) {
      for (const channelId of config.channelIds) {
        const messageId = config.statusMessageMap[channelId];
        try {
          const channel = await client.channels.fetch(channelId);
          const message = await channel.messages.fetch(messageId);
          await message.edit({ embeds: [embed] });
        } catch (e) {
          console.warn(`❗ Erreur mise à jour salon ${channelId} : ${e.message}`);
        }
      }
    }
  }, config.checkInterval || 30000);
});

client.on('messageCreate', async (message) => {
  if (!message.content.startsWith('!monitor') || message.author.bot) return;

  const args = message.content.trim().split(/\s+/);

  switch (args[1]) {
    case 'addchannel': {
      if (!config.channelIds) config.channelIds = [];

      if (config.channelIds.includes(message.channel.id)) {
        return message.reply('❗ Ce salon est déjà configuré.');
      }

      config.channelIds.push(message.channel.id);

      const embed = new EmbedBuilder()
        .setTitle("🖥️ État des serveurs")
        .setDescription("⏳ Vérification en cours...");
      const sentMessage = await message.channel.send({ embeds: [embed] });

      if (!config.statusMessageMap) config.statusMessageMap = {};
      config.statusMessageMap[message.channel.id] = sentMessage.id;

      fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
      return message.reply('✅ Salon ajouté pour les mises à jour.');
    }

    case 'removechannel': {
      if (!config.channelIds || !config.channelIds.includes(message.channel.id)) {
        return message.reply('❗ Ce salon n\'est pas configuré.');
      }

      config.channelIds = config.channelIds.filter(id => id !== message.channel.id);

      if (config.statusMessageMap && config.statusMessageMap[message.channel.id]) {
        delete config.statusMessageMap[message.channel.id];
      }

      fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
      return message.reply('✅ Salon retiré des mises à jour.');
    }

    case 'listchannels': {
      if (!config.channelIds || config.channelIds.length === 0) {
        return message.reply('📭 Aucun salon configuré pour les mises à jour.');
      }

      // Récupérer noms salons si possible
      const channelsList = await Promise.all(config.channelIds.map(async (id) => {
        try {
          const channel = await client.channels.fetch(id);
          return `• #${channel.name}`;
        } catch {
          return `• Salon ID: ${id} (non accessible)`;
        }
      }));

      return message.reply(`📋 Salons configurés :\n${channelsList.join('\n')}`);
    }

    case 'adduser': {
      const user = message.mentions.users.first();
      if (!user) return message.reply('❌ Mentionne un utilisateur valide.');

      if (!config.notifyUserIds) config.notifyUserIds = [];

      if (config.notifyUserIds.includes(user.id)) {
        return message.reply('❗ Cet utilisateur est déjà dans la liste.');
      }

      config.notifyUserIds.push(user.id);
      fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
      return message.reply(`✅ ${user.tag} recevra les notifications.`);
    }

    case 'removeuser': {
      if (args.length < 3) {
        return message.reply('❌ Utilisation : `!monitor removeuser <@utilisateur>`');
      }

      // On tente d'extraire l'ID utilisateur de la mention
      const userIdFromMention = message.mentions.users.first()?.id;
      if (!userIdFromMention) {
        return message.reply('❌ Mentionne un utilisateur valide à supprimer.');
      }

      if (!config.notifyUserIds || !config.notifyUserIds.includes(userIdFromMention)) {
        return message.reply('❗ Cet utilisateur n\'est pas dans la liste.');
      }

      config.notifyUserIds = config.notifyUserIds.filter(id => id !== userIdFromMention);
      fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
      return message.reply(`✅ Utilisateur retiré des notifications.`);
    }

    case 'listusers': {
      if (!config.notifyUserIds || config.notifyUserIds.length === 0) {
        return message.reply('📭 Aucun utilisateur configuré pour les notifications.');
      }

      const usersList = await Promise.all(config.notifyUserIds.map(async (id) => {
        try {
          const user = await client.users.fetch(id);
          return `• ${user.tag}`;
        } catch {
          return `• Utilisateur ID: ${id} (non accessible)`;
        }
      }));

      return message.reply(`📋 Utilisateurs notifiés :\n${usersList.join('\n')}`);
    }

    case 'addserver': {
      if (args.length < 5) {
        return message.reply('❌ Utilisation : `!monitor addserver <nom> <ip> <port>`');
      }

      const [name, host, port] = [args[2], args[3], parseInt(args[4])];
      if (isNaN(port)) return message.reply('❌ Le port doit être un nombre.');

      if (!config.servers) config.servers = [];
      const exists = config.servers.find(s => s.name.toLowerCase() === name.toLowerCase());
      if (exists) return message.reply('❌ Un serveur avec ce nom existe déjà.');

      config.servers.push({ name, host, port });
      fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));

      return message.reply(`✅ Serveur **${name}** ajouté à la surveillance (${host}:${port})`);
    }

    case 'removeserver': {
      if (args.length < 3) {
        return message.reply('❌ Utilisation : `!monitor removeserver <nom>`');
      }

      const name = args[2];
      if (!config.servers) config.servers = [];

      const initialLength = config.servers.length;
      config.servers = config.servers.filter(s => s.name.toLowerCase() !== name.toLowerCase());

      if (config.servers.length === initialLength) {
        return message.reply(`❌ Aucun serveur trouvé avec le nom : ${name}`);
      }

      fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
      return message.reply(`✅ Serveur **${name}** supprimé de la surveillance.`);
    }

    case 'listservers': {
      if (!config.servers || config.servers.length === 0) {
        return message.reply('📭 Aucun serveur surveillé actuellement.');
      }

      const list = config.servers.map(s => `• **${s.name}** (${s.host}:${s.port})`).join('\n');
      return message.reply(`📋 Serveurs surveillés :\n${list}`);
    }

    default:
      return message.reply(
        '❓ Commandes disponibles :\n' +
        '- `addserver <nom> <ip> <port>`\n' +
        '- `removeserver <nom>`\n' +
        '- `listservers`\n' +
        '- `addchannel`\n' +
        '- `removechannel`\n' +
        '- `listchannels`\n' +
        '- `adduser @user`\n' +
        '- `removeuser @user`\n' +
        '- `listusers`'
      );
  }
});


async function shutdownProcedure() {
  console.log('⏳ Arrêt du bot : mise à jour des statuts à OFF...');

  const embed = new EmbedBuilder()
    .setTitle('🖥️ État des serveurs')
    .setColor(0xff0000)
    .setTimestamp()
    .setDescription(
      config.servers && config.servers.length > 0
        ? config.servers.map(s => `• **${s.name}** (${s.host}:${s.port}) → 🔴 Hors ligne`).join('\n')
        : 'Aucun serveur surveillé.'
    );

  if (Array.isArray(config.channelIds) && config.statusMessageMap) {
    for (const channelId of config.channelIds) {
      const messageId = config.statusMessageMap[channelId];
      try {
        const channel = await client.channels.fetch(channelId);
        const message = await channel.messages.fetch(messageId);
        await message.edit({ embeds: [embed] });
        console.log(`✅ Statut mis à jour dans le salon ${channelId}`);
      } catch (err) {
        console.warn(`⚠️ Erreur mise à jour salon ${channelId} : ${err.message}`);
      }
    }
  }

  console.log('✅ Mise à jour terminée. Fermeture propre du bot.');
  process.exit(0);
}

process.on('SIGINT', shutdownProcedure);  // Ctrl+C
process.on('SIGTERM', shutdownProcedure); // service systemd ou arrêt système


client.login(config.token);

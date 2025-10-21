const { Client, GatewayIntentBits, Collection, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const config = require('./config.json');
const isServerUp = require('./checkServer.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ]
});

client.commands = new Collection();

// Import des commandes
const monitorCommand = require('./commands/monitor.js');
client.commands.set(monitorCommand.data.name, monitorCommand);

client.once('ready', async () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);

  // Enregistrement des commandes (guild si configuré => propagation immédiate, sinon global)
  try {
    if (config.guildId) {
      const guild = await client.guilds.fetch(config.guildId);
      await guild.commands.set([monitorCommand.data]);
      console.log(`📦 Commandes slash synchronisées sur la guild ${config.guildId}`);
    } else {
      await client.application.commands.set([monitorCommand.data]);
      console.log("📦 Commandes slash synchronisées globalement (peut prendre jusqu'à 1h)");
    }
  } catch (e) {
    console.warn('⚠️ Erreur lors de la synchronisation des commandes :', e.message);
  }

  // 🔄 Lancement de la boucle de mise à jour
  setInterval(async () => {
    const embed = new EmbedBuilder()
      .setTitle('🖥️ État des serveurs')
      .setColor(0x00e100)
      .setTimestamp();

    let description = '';

    const servers = config.servers || [];
    const sites = config.sites || [];

    if (servers.length === 0 && sites.length === 0) {
      description = 'Aucun serveur ou site surveillé.';
    } else {
      for (const server of servers) {
        const res = await isServerUp(server.host, server.port);
        const ok = res && res.ok;
        const latencyStr = res && res.latency != null ? ` (${res.latency} ms)` : '';
        description += `• **${server.name}** (${server.host}:${server.port}) → ${ok ? '🟢 En ligne' : '🔴 Hors ligne'}${latencyStr}\n`;
      }
      for (const site of sites) {
        const res = await isServerUp({ url: site.url });
        const ok = res && res.ok;
        const latencyStr = res && res.latency != null ? ` (${res.latency} ms)` : '';
        description += `• **${site.name}** (${site.url}) → ${ok ? '🟢 En ligne' : '🔴 Hors ligne'}${latencyStr}\n`;
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

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, client, config);
  } catch (err) {
    console.error(err);
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: "❌ Une erreur est survenue.", ephemeral: true });
    } else {
      await interaction.reply({ content: "❌ Une erreur est survenue.", ephemeral: true });
    }
  }
});

client.login(config.token);


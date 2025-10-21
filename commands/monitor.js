const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const isServerUp = require('../checkServer.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('monitor')
    .setDescription('Gestion de la surveillance des serveurs')
    .addSubcommand(sub => 
      sub.setName('addserver')
        .setDescription('Ajouter un serveur')
        .addStringOption(opt => opt.setName('nom').setDescription('Nom du serveur').setRequired(true))
        .addStringOption(opt => opt.setName('ip').setDescription('Adresse IP').setRequired(true))
        .addIntegerOption(opt => opt.setName('port').setDescription('Port').setRequired(true))
    )
    .addSubcommand(sub => 
      sub.setName('listservers')
        .setDescription('Lister les serveurs et sites surveillés')
    )
    .addSubcommand(sub => 
      sub.setName('removeserver')
        .setDescription('Supprimer un serveur')
        .addStringOption(opt => opt.setName('nom').setDescription('Nom du serveur').setRequired(true))
    )
    .addSubcommand(sub => 
      sub.setName('addsite')
        .setDescription('Ajouter un site web')
        .addStringOption(opt => opt.setName('nom').setDescription('Nom du site').setRequired(true))
        .addStringOption(opt => opt.setName('url').setDescription('URL (http(s)://...)').setRequired(true))
    )
    .addSubcommand(sub => 
      sub.setName('removesite')
        .setDescription('Supprimer un site')
        .addStringOption(opt => opt.setName('nom').setDescription('Nom du site').setRequired(true))
    )
    .addSubcommand(sub => 
      sub.setName('addchannel')
        .setDescription('Configurer ce salon pour afficher l\'état des serveurs')
    )
    .addSubcommand(sub => 
      sub.setName('removechannel')
        .setDescription('Retirer ce salon de la configuration')
    )
    .addSubcommand(sub => 
      sub.setName('listchannels')
        .setDescription('Lister les salons configurés')
    )
    .addSubcommand(sub => 
      sub.setName('adduser')
        .setDescription('Notifier un utilisateur')
        .addUserOption(opt => opt.setName('user').setDescription('Utilisateur').setRequired(true))
    )
    .addSubcommand(sub => 
      sub.setName('removeuser')
        .setDescription('Retirer un utilisateur des notifications')
        .addUserOption(opt => opt.setName('user').setDescription('Utilisateur').setRequired(true))
    )
    .addSubcommand(sub => 
      sub.setName('listusers')
        .setDescription('Lister les utilisateurs notifiés')
    ),

  async execute(interaction, client, config) {
    const sub = interaction.options.getSubcommand();

    switch (sub) {
      case 'addserver': {
        const name = interaction.options.getString('nom');
        const host = interaction.options.getString('ip');
        const port = interaction.options.getInteger('port');

        if (!config.servers) config.servers = [];
        if (config.servers.find(s => s.name.toLowerCase() === name.toLowerCase())) {
          return interaction.reply({ content: '❌ Un serveur avec ce nom existe déjà.', ephemeral: true });
        }

        config.servers.push({ name, host, port });
        fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));

        return interaction.reply(`✅ Serveur **${name}** ajouté (${host}:${port})`);
      }

      case 'listservers': {
        const servers = config.servers || [];
        const sites = config.sites || [];

        if (servers.length === 0 && sites.length === 0) {
          return interaction.reply('📭 Aucun serveur ou site surveillé.');
        }

        let parts = [];
        if (servers.length > 0) {
          const list = servers.map(s => `• **${s.name}** (${s.host}:${s.port})`).join('\n');
          parts.push(`📋 Serveurs :\n${list}`);
        }
        if (sites.length > 0) {
          const listSites = sites.map(s => `• **${s.name}** (${s.url})`).join('\n');
          parts.push(`🌐 Sites web :\n${listSites}`);
        }

        return interaction.reply(parts.join('\n\n'));
      }

      case 'removeserver': {
        const name = interaction.options.getString('nom');
        if (!config.servers) config.servers = [];
        const initialLength = config.servers.length;

        config.servers = config.servers.filter(s => s.name.toLowerCase() !== name.toLowerCase());
        fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));

        if (config.servers.length === initialLength) {
          return interaction.reply(`❌ Aucun serveur trouvé avec le nom : ${name}`);
        }
        return interaction.reply(`✅ Serveur **${name}** supprimé.`);
      }

      case 'addsite': {
        const name = interaction.options.getString('nom');
        const url = interaction.options.getString('url');

        // Normalise : si protocole manquant, ajouter http:// puis valider
        let normalizedUrl = url;
        try {
          let parsed;
          if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(url)) {
            // pas de scheme, on préfixe http://
            parsed = new URL('http://' + url);
            normalizedUrl = parsed.toString();
          } else {
            parsed = new URL(url);
            normalizedUrl = parsed.toString();
          }
          if (!['http:', 'https:'].includes(parsed.protocol)) {
            return interaction.reply({ content: '❌ L\'URL doit être HTTP ou HTTPS.', ephemeral: true });
          }
        } catch (e) {
          return interaction.reply({ content: '❌ URL invalide.', ephemeral: true });
        }

        if (!config.sites) config.sites = [];
        if (config.sites.find(s => s.name.toLowerCase() === name.toLowerCase())) {
          return interaction.reply({ content: '❌ Un site avec ce nom existe déjà.', ephemeral: true });
        }

        config.sites.push({ name, url: normalizedUrl });
        fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));

        return interaction.reply(`✅ Site **${name}** ajouté (${normalizedUrl})`);
      }

      case 'removesite': {
        const name = interaction.options.getString('nom');
        if (!config.sites) config.sites = [];
        const initialLength = config.sites.length;

        config.sites = config.sites.filter(s => s.name.toLowerCase() !== name.toLowerCase());
        fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));

        if (config.sites.length === initialLength) {
          return interaction.reply(`❌ Aucun site trouvé avec le nom : ${name}`);
        }
        return interaction.reply(`✅ Site **${name}** supprimé.`);
      }

      case 'addchannel': {
        if (!config.channelIds) config.channelIds = [];
        if (config.channelIds.includes(interaction.channel.id)) {
          return interaction.reply({ content: '❗ Ce salon est déjà configuré.', ephemeral: true });
        }

        config.channelIds.push(interaction.channel.id);

        const embed = new EmbedBuilder()
          .setTitle("🖥️ État des serveurs")
          .setDescription("⏳ Vérification en cours...");
        const sentMessage = await interaction.channel.send({ embeds: [embed] });

        if (!config.statusMessageMap) config.statusMessageMap = {};
        config.statusMessageMap[interaction.channel.id] = sentMessage.id;

        fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
        return interaction.reply('✅ Salon ajouté pour les mises à jour.');
      }

      case 'removechannel': {
        if (!config.channelIds || !config.channelIds.includes(interaction.channel.id)) {
          return interaction.reply('❗ Ce salon n\'est pas configuré.');
        }

        config.channelIds = config.channelIds.filter(id => id !== interaction.channel.id);
        if (config.statusMessageMap) delete config.statusMessageMap[interaction.channel.id];

        fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
        return interaction.reply('✅ Salon retiré des mises à jour.');
      }

      case 'listchannels': {
        if (!config.channelIds || config.channelIds.length === 0) {
          return interaction.reply('📭 Aucun salon configuré.');
        }

        const channelsList = await Promise.all(config.channelIds.map(async (id) => {
          try {
            const channel = await client.channels.fetch(id);
            return `• #${channel.name}`;
          } catch {
            return `• Salon ID: ${id} (non accessible)`;
          }
        }));

        return interaction.reply(`📋 Salons configurés :\n${channelsList.join('\n')}`);
      }

      case 'adduser': {
        const user = interaction.options.getUser('user');
        if (!config.notifyUserIds) config.notifyUserIds = [];
        if (config.notifyUserIds.includes(user.id)) {
          return interaction.reply('❗ Cet utilisateur est déjà notifié.');
        }

        config.notifyUserIds.push(user.id);
        fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
        return interaction.reply(`✅ ${user.tag} recevra les notifications.`);
      }

      case 'removeuser': {
        const user = interaction.options.getUser('user');
        if (!config.notifyUserIds || !config.notifyUserIds.includes(user.id)) {
          return interaction.reply('❗ Cet utilisateur n\'est pas dans la liste.');
        }

        config.notifyUserIds = config.notifyUserIds.filter(id => id !== user.id);
        fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
        return interaction.reply(`✅ ${user.tag} retiré des notifications.`);
      }

      case 'listusers': {
        if (!config.notifyUserIds || config.notifyUserIds.length === 0) {
          return interaction.reply('📭 Aucun utilisateur configuré.');
        }

        const usersList = await Promise.all(config.notifyUserIds.map(async (id) => {
          try {
            const user = await client.users.fetch(id);
            return `• ${user.tag}`;
          } catch {
            return `• Utilisateur ID: ${id} (non accessible)`;
          }
        }));

        return interaction.reply(`📋 Utilisateurs notifiés :\n${usersList.join('\n')}`);
      }

      default:
        return interaction.reply({ content: '❓ Commande inconnue.', ephemeral: true });
    }
  }
};


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
        .setDescription('Lister les serveurs surveillés')
    )
    .addSubcommand(sub => 
      sub.setName('removeserver')
        .setDescription('Supprimer un serveur')
        .addStringOption(opt => opt.setName('nom').setDescription('Nom du serveur').setRequired(true))
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
        if (!config.servers || config.servers.length === 0) {
          return interaction.reply('📭 Aucun serveur surveillé.');
        }
        const list = config.servers.map(s => `• **${s.name}** (${s.host}:${s.port})`).join('\n');
        return interaction.reply(`📋 Serveurs surveillés :\n${list}`);
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


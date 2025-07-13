# 📡 Discord Server Status Bot

Un bot Discord développé avec `discord.js` qui permet de surveiller l'état de plusieurs serveurs (par IP et port).  
Il met automatiquement à jour un message dans un ou plusieurs salons et peut envoyer une notification privée à une ou plusieurs personnes lorsque l'état d'un serveur change.

---

## ⚙️ Fonctionnalités

- Surveillance de plusieurs serveurs (IP + port)
- Mise à jour automatique d'un message dans un ou plusieurs salons configurés
- Notification par DM aux utilisateurs désignés en cas de changement d'état
- Configuration des serveurs, salons et utilisateurs via des commandes Discord
- Persistance via `config.json`

---

## 🧠 Commandes disponibles

Toutes les commandes commencent par `!monitor`.

### 🔧 Serveurs

| Commande                             | Description                                      |
|--------------------------------------|--------------------------------------------------|
| `!monitor addserver <nom> <ip> <port>`   | Ajoute un serveur à surveiller.                  |
| `!monitor removeserver <nom>`           | Supprime un serveur de la liste.                 |
| `!monitor listservers`                  | Affiche la liste des serveurs surveillés.        |

### 📝 Salons

| Commande                        | Description                                                      |
|----------------------------------|------------------------------------------------------------------|
| `!monitor addchannel`           | Ajoute le salon courant pour afficher l’état des serveurs.       |
| `!monitor removechannel`        | Supprime le salon courant de la mise à jour automatique.         |
| `!monitor listchannels`         | Liste tous les salons configurés pour la mise à jour.            |

### 👤 Utilisateurs

| Commande                         | Description                                                  |
|-----------------------------------|--------------------------------------------------------------|
| `!monitor adduser @user`         | Ajoute un utilisateur aux notifications par DM.             |
| `!monitor removeuser @user`      | Supprime un utilisateur des notifications.                  |
| `!monitor listusers`             | Liste les utilisateurs recevant les notifications.          |

---

## 📁 Exemple de `config.json`

```json
{
  "token": "VOTRE_TOKEN_ICI",
  "checkInterval": 30000,
  "servers": [],
  "channelIds": [],
  "notifyUserIds": [],
  "statusMessageMap": {}
}

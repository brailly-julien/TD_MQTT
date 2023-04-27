# TD_MQTT

 Ce projet est une application de chat en temps réel basée sur le protocole MQTT, utilisant un serveur Mosquitto. Les utilisateurs peuvent discuter dans un salon général, en privé avec d'autres utilisateurs, ou dans des salles de chat personnalisées. Le chat offre également un mode administrateur permettant de basculer entre les différentes fonctionnalités.

Prérequis
Un serveur Mosquitto doit être en cours d'exécution à l'adresse par défaut : mqtt://localhost/1883.
Node.js doit être installé sur votre machine.
Installation
1 - Clonez le dépôt ou téléchargez le code source.
    git clone https://github.com/brailly-julien/TD_MQTT

2 - Accédez au répertoire du projet.
    cd TD_MQTT

3 - Installez les dépendances.
    npm install

Utilisation
Exécutez l'application avec la commande suivante :
    node app.js

Commandes
Voici la liste des commandes disponibles :

toGeneral : retourne au mode général (salon de discussion public).
disconnect : se déconnecter du chat.
chatWith <username> : discuter en privé avec un utilisateur spécifique.
createRoom <room_name> : créer une salle de chat personnalisée.
joinRoom <room_name> : rejoindre une salle de chat personnalisée.
invite <username> : inviter un utilisateur dans une salle de chat personnalisée (accessible uniquement depuis le mode salle personnalisée).
exit : quitter le mode actuel et revenir au mode administrateur.
Fonctionnement des topics
messages : topic général pour les messages publics.
chat/<username> : topic pour les messages privés entre utilisateurs.
notifications/<username> : topic pour les notifications d'invitation à une salle personnalisée.
custom/<room_name> : topic pour les messages dans une salle de chat personnalisée.
Fonctionnement global de la solution
L'application se connecte au serveur Mosquitto et s'abonne aux topics nécessaires. Les messages sont envoyés et reçus via MQTT. Les utilisateurs peuvent basculer entre les différents modes de chat (général, administrateur, privé et salle personnalisée) en utilisant les commandes appropriées. Les invitations à des salles personnalisées sont envoyées via des notifications, et les utilisateurs peuvent rejoindre ces salles en utilisant la commande joinRoom.

Lorsqu'un utilisateur envoie un message, celui-ci est publié sur le topic correspondant. Les autres utilisateurs abonnés à ce topic reçoivent le message et l'affichent. Les utilisateurs peuvent également basculer entre les différents modes de chat pour interagir avec d'autres utilisateurs ou créer des salles personnalisées.

Le fichier users.json stocke les noms des utilisateurs connectés pour éviter les doublons et les conflits.


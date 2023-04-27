// Import des modules nécessaires
const readline = require('readline');
const mqttBrokerUrl = "mqtt://localhost/1883";
const mqttClient = require("mqtt").connect(mqttBrokerUrl);
const prompt = require("prompt-sync")({ sigint: true });
const fs = require('fs');
const fileName = './users.json';

// Initialisation des variables globales
let currentMode;// le mode actuel du chat (general, admin, oneToOne, custom)
let currentRoom;// le nom de la room actuelle
let currentUser;// le nom de l'utilisateur actuel
let customRoomName;// le nom de la room personnalisée
let chatUserName; // le nom de l'utilisateur avec qui l'utilisateur actuel discute en mode "one-to-one"

// Lecture du fichier d'utilisateurs pour récupérer la liste
const usersFile = fs.readFileSync(fileName);
let usersList = JSON.parse(usersFile);

async function start() {

    // Demande à l'utilisateur d'entrer son nom
    const enteredUserName = prompt("Qui etes Vous: ");

    // Vérification que le nom n'est pas déjà pris et ne contient pas d'espaces
    if (usersList.users.includes(enteredUserName)) {
        console.log("Ce nom est déjà pris. Veuillez essayer un nom différent.");
        start();
    } else if (!/^[^ ]*$/.test(enteredUserName)) {
        console.log("Votre nom d'utilisateur ne peut pas contenir d'espaces. Veuillez essayer un nom différent.");
        start();
    } else {
        // Si le nom est valide, on l'enregistre comme utilisateur courant
        currentUser = enteredUserName;
        currentMode = 'general';

        console.log('-----------------------------------------------');
        console.log(`Bienvenue dans le salon de discussion public, ${currentUser} !`);
        console.log('Vous pouvez envoyer des messages visibles par tous les autres utilisateurs.');
        console.log('Tapez "exit" pour passer en mode Admin.');
        console.log('-----------------------------------------------');
        usersList.users.push(currentUser);
        fs.writeFileSync(fileName, JSON.stringify(usersList));

        try {
            // Connexion au broker MQTT et souscription aux topics pertinents
            mqttClient.on("connect", () => {
                console.log("Bien connecté à MQTT broker.");

                mqttClient.subscribe("messages");
                mqttClient.subscribe(`chat/${currentUser}`);
                mqttClient.subscribe(`notifications/${currentUser}`);
            });

            // Gestion des événements de déconnexion ou d'erreur
            mqttClient.on('offline', () => {
                console.log('MQTT client est déconnecté du broker.');
            });

            mqttClient.on('error', (err) => {
                console.error(`MQTT client error: ${err}`);
            });

            // Gestion des messages reçus sur les différents topics
            mqttClient.on(`message`, (topic, message) => {
                try {
                    // Réception d'un message
                    message = JSON.parse(message.toString());
                    if (topic === `chat/${currentUser}`) {
                        // Si le message est destiné à l'utilisateur actuel en mode "general" ou en mode "one-to-one"
                        if (currentMode === 'oneToOne' || message.from === chatUserName) {
                            console.log(`${message.from}: ${message.message}`);
                        } else {
                            console.log(`Message direct de ${message.from}: ${message.message}`);
                        }
                    } else if (topic === `notifications/${currentUser}`) {
                        // Si l'utilisateur actuel est invité dans une room
                        console.log(`Vous avez été invité par ${message.from} pour rejoindre la room ${message.message}. Veuillez taper 'joinRoom ${message.message}' pour rejoindre la room.`);
                    } else if (message.from !== currentUser) {
                        // Si le message est destiné à tous les utilisateurs en mode "general"
                        console.log(`${message.from} says: ${message.message}`);
                    }
                } catch (err) {
                    console.error(`Échec de l'analyse du message: ${err.message}`);
                }
            });
        } catch (err) {
            console.error(`Erreur de connexion au courtier MQTT: ${err.message}`);
        }

        // Création d'une interface de ligne de commande pour l'interaction avec l'utilisateur
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        // Fonction de lecture des messages dans le mode général
        const readGeneralMode = function () {
            // On pose une question à l'utilisateur en affichant 'General:'.
            rl.question('General: ', function (answer) {
                // Si l'utilisateur tape 'exit', on le désabonne du sujet MQTT correspondant au mode courant,
                // on passe au mode 'admin' et on affiche le menu d'administration.
                if (answer === 'exit') {
                    mqttClient.unsubscribe(`chat/${currentMode}`)
                    currentMode = 'admin';
                    readAdminMode();
                } else {
                    // Sinon, on publie le message sur le sujet MQTT correspondant aux messages généraux,
                    // puis on continue à lire les messages du mode général.
                    try {
                        mqttClient.publish(`messages`, JSON.stringify({
                            from: currentUser,
                            message: answer
                        }));
                    } catch (err) {
                        console.error(`Échec de publication du message: ${err.message}`);
                    }
                    readGeneralMode();
                }
            });
        };

        // Cette fonction gère la lecture des messages du mode de chat individuel.
        const readOneToOneMode = function () {
            console.log('-----------------------------------------------');
            console.log(`Vous discutez en privé avec ${chatUserName}.`);
            console.log('Tapez "exit" pour passer en mode Admin.');
            console.log('-----------------------------------------------');
            // On pose une question à l'utilisateur en affichant le nom d'utilisateur du correspondant.
            rl.question(`${chatUserName}: `, function (answer) {
                // Si l'utilisateur tape 'exit', on passe au mode 'admin' et on affiche le menu d'administration.
                if (answer === 'exit') {
                    currentMode = 'admin';
                    readAdminMode();
                } else {
                    // Sinon, on publie le message sur le sujet MQTT correspondant aux messages de chat individuel,
                    // puis on continue à lire les messages du mode de chat individuel.
                    try {
                        mqttClient.publish(`chat
                        ${chatUserName}`, JSON.stringify({
                            from: currentUser,
                            message: answer
                        }));
                    } catch (err) {
                        console.error(`Échec de publication du message: ${err.message}`);
                    }
                    readOneToOneMode();
                }
            });
        };

        // Cette fonction gère la lecture des messages du mode de chat personnalisé.
        const readCustomRoomMode = function () {
            console.log('-----------------------------------------------');
            console.log(`Vous êtes dans la salle de chat personnalisée ${customRoomName}.`);
            console.log('Tapez "exit" pour passer en mode Admin.');
            console.log('Pour inviter un utilisateur, tapez "invite <username>".');
            console.log('-----------------------------------------------');
            // On pose une question à l'utilisateur en affichant le nom de la salle de chat personnalisée.
            rl.question(`${customRoomName}: `, function (answer) {
                // Si l'utilisateur tape 'exit', on le désabonne du sujet MQTT correspondant à la salle de chat personnalisée,
                // on passe au mode 'admin' et on affiche le menu d'administration.
                if (answer === 'exit') {
                    mqttClient.unsubscribe(`custom/${customRoomName}`);
                    currentMode = 'admin';
                    readAdminMode();
                } else if (/^invite\s[^ \n]*$/.test(answer)) {
                    // Si l'utilisateur tape une commande d'invitation de la forme 'invite <nom_utilisateur>', 
                    // on extrait le nom de l'utilisateur invité, on affiche un message informant que l'utilisateur a été invité, 
                    // et on publie un message de notification sur le sujet MQTT correspondant aux notifications pour l'utilisateur invité.
                    const wordsArray = answer.split(" ");
                    const invitedUser = wordsArray[wordsArray.length - 1];
                    console.log(`Vous avez invité ${invitedUser} à rejoindre la room.`);

                    try {
                        mqttClient.publish(`notifications/${invitedUser}`, JSON.stringify({
                            from: currentUser,
                            message: customRoomName
                        }));
                    } catch (err) {
                        console.error(`Échec de publication du message: ${err.message}`);
                    }
                    readCustomRoomMode();
                } else {
                    try {
                        mqttClient.publish(`custom/${customRoomName}`, JSON.stringify({
                            from: currentUser,
                            message: answer
                        }));
                    } catch (err) {
                        console.error(`Échec de publication du message: ${err.message}`);
                    }
                    readCustomRoomMode();
                }
            });
        };

        // Fonction de lecture du mode administrateur
        const readAdminMode = function () {
            console.log('-----------------------------------------------');
            console.log('Bienvenue dans le mode Admin.');
            console.log('Commandes disponibles:');
            console.log('  - toGeneral: retourner au mode Général');
            console.log('  - disconnect: se déconnecter du chat');
            console.log('  - chatWith <username>: discuter en privé avec un utilisateur spécifique');
            console.log('  - createRoom <room_name>: créer une salle de chat personnalisée');
            console.log('  - joinRoom <room_name>: rejoindre une salle de chat personnalisée');
            console.log('-----------------------------------------------');
            // On pose une question à l'utilisateur en affichant 'Admin:'
            rl.question('Admin:  ', function (answer) {
                // Si l'utilisateur tape 'toGeneral', on se désabonne du sujet MQTT correspondant au mode courant,
                // on passe au mode 'general' et on appelle la fonction readGeneralMode().
                if (answer === 'toGeneral') {
                    mqttClient.unsubscribe(`chat/${currentMode}`);
                    currentMode = 'general';
                    readGeneralMode();
                    // Si l'utilisateur tape 'disconnect', on affiche 'Goodbye!', on ferme l'interface readline,
                    // et on termine la connexion avec le client MQTT.
                } else if (answer === 'disconnect') {
                    console.log('Goodbye!');
                    rl.close();
                    mqttClient.end();
                    // Si l'utilisateur tape 'chatWith <username>', on extrait le nom d'utilisateur du correspondant,
                    // on affiche 'Vous discutez maintenant avec <username>.' et on passe au mode 'oneToOne'.
                } else if (/^chatWith\s[^ \n]*$/.test(answer)) {
                    const wordsArray = answer.split(" ");
                    chatUserName = wordsArray[wordsArray.length - 1];
                    console.log(`Vous discutez maintenant avec ${chatUserName}.`);
                    mqttClient.unsubscribe(`chat/${currentMode}`);
                    currentMode = 'oneToOne';
                    readOneToOneMode();
                    // Si l'utilisateur tape 'createRoom <room_name>' ou 'joinRoom <room_name>', on extrait le nom de la salle,
                    // on se désabonne du sujet MQTT correspondant au mode courant et on s'abonne au sujet MQTT de la salle personnalisée,
                    // puis on passe au mode 'custom'.
                } else if (/^createRoom\s[^ \n]*$/.test(answer) || /^joinRoom\s[^ \n]*$/.test(answer)) {
                    const wordsArray = answer.split(" ");
                    customRoomName = wordsArray[wordsArray.length - 1];
                    mqttClient.unsubscribe(`chat/${currentMode}`);
                    mqttClient.subscribe(`custom/${customRoomName}`);
                    currentMode = "custom";
                    // Selon la commande (createRoom ou joinRoom), on affiche le message correspondant.
                    switch (wordsArray[0]) {
                        case 'createRoom':
                            console.log(`Room ${customRoomName} a été créée.`);
                            break;
                        case 'joinRoom':
                            console.log(`Vous avez rejoint la room ${customRoomName}.`);
                            break;
                    }
                    readCustomRoomMode();
                } else {
                    // Si la commande n'est pas reconnue, on affiche "Command not recognized." et on continue 
                    console.log(" Commande non reconnue.");
                    readAdminMode();
                }
            });
        };

        // Fonction de lecture des entrées en fonction du mode courant
        const readInput = async function () {
            mqttClient.subscribe(`chat/${currentMode}`);
            // En fonction du mode courant, on appelle la fonction correspondante
            switch (currentMode) {
                case 'general':
                    readGeneralMode();
                    break;
                case 'admin':
                    readAdminMode();
                    break;
                case 'oneToOne':
                    readOneToOneMode();
                    break;
                case 'custom':
                    readCustomRoomMode();
                    break;
            }
        };
        readInput();
    }
}
// Démarrage de l'application
start();
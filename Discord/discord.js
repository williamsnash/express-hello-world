const fs = require('node:fs');
const path = require('node:path');
const { Client, Events, GatewayIntentBits, Collection } = require('discord.js');
const { exit } = require('node:process');
const request = require('request'); // Used for imgur api

require('dotenv').config()


// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));


for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    // Set a new item in the Collection with the key as the command name and the value as the exported module
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

// When the client is ready, run this code (only once)
// We use 'c' for the event parameter to keep it separate from the already defined 'client'
client.once(Events.ClientReady, c => {
    console.log(`Ready! Logged in as ${c.user.tag}`);

});

// Log in to Discord with your client's token
client.login(process.env.discordToken);

client.on('messageCreate', (message) => {
    if (message.content.startsWith('!load')) {
        const id = message.content.split(' ')[1];
        getImageAlbum(id)
            .then((image_list) => {
                console.log(image_list)
                for (const image of image_list) {
                    message.channel.send(image);
                }
            })
    }
})

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
    }
});



function getImageAlbum(albumId) {
    // console.log("Getting album: " + albumId);
    const options = {
        url: `https://api.imgur.com/3/album/${albumId}`,
        headers: {
            'Authorization': `Client-ID ${process.env.CLIENT_ID}`
        }
    };
    let image_list = [];
    return new Promise((resolve, reject) => {
        request(options, (error, response, body) => {
            if (error) {
                console.error("GetImage: " + error);
            } else {
                try {
                    const data = JSON.parse(body);
                    for (const image of data.data.images) {
                        image_list.push(image.link);
                    }
                    // image_list = image_list.split(',');
                    resolve(image_list);
                } catch (e) {
                    // console.error(e);
                    console.error("ERROR ALBUM: " + e);
                    throw new Error('Throw makes it go boom!')
                }
            }
        });

    });
}
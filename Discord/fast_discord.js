const { Client, Events, GatewayIntentBits } = require('discord.js');
const request = require('request'); // Used for imgur api
require('dotenv').config()

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, c => {
    console.log(`Ready! Logged in as ${c.user.tag}`);

    // console.time('fetch2')
    // fetchAllMessages(client, "861958576603660288").then((img) => {
    //     console.timeEnd('fetch2')
    //     console.log(img)
    //     console.log(img.length)

    // })
    const channel = client.channels.cache.get("1069449031270551584");
    getImageAlbum('c9nRn2t')
        .then((image_list) => {
            console.log(image_list)
            for (const image of image_list) {
                channel.send(image);
            }
        })
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


// Log in to Discord with your client's token
client.login(process.env.discordToken);


async function fetchAllMessages(client, channelId) {
    var img_url = [];
    let lastID;
    const channel = client.channels.cache.get(channelId);

    const fetchMessagesRecursively = async () => {
        const fetchedMessages = await channel.messages.fetch({
            limit: 100,
            ...(lastID && { before: lastID }),
        });
        if (fetchedMessages.size === 0) {
            return img_url;
        }
        for (const entries of fetchedMessages.entries()) {
            const entry = entries[1]
            if (entry.attachments.size > 0) {
                img_url = img_url.concat(Array.from(entry.attachments.values()).map(attachment => attachment.url))
            }
            if (entry.content != "" && entry.embeds.length > 0) {
                img_url.push(entry.content)
            }
        }
        lastID = fetchedMessages.lastKey();
        return fetchMessagesRecursively();
    }
    return fetchMessagesRecursively();
}






// async function fetchAllMessages(client, channelId) {
//     const channel = client.channels.cache.get(channelId);
//     let content = [];

//     // Create message pointer
//     let message = await channel.messages
//         .fetch({ limit: 1 })
//         .then(messagePage => (messagePage.size === 1 ? messagePage.at(0) : null));

//     while (message) {
//         await channel.messages
//             .fetch({ limit: 100, before: message.id })
//             .then(messagePage => {
//                 messagePage.forEach(msg => {
//                     if (msg.attachments.size > 0) {
//                         msg.attachments.forEach(attachment => {
//                             content.push(attachment.url)
//                         })
//                     }
//                 });
//                 // Update our message pointer to be last message in page of messages
//                 message = 0 < messagePage.size ? messagePage.at(messagePage.size - 1) : null;
//             });
//     }

//     return content;
// }

async function fetchAllMessagesOther(client, channelId) {
    var img_url = [];
    var lastID;
    var channel = client.channels.cache.get(channelId);
    while (true) { // eslint-disable-line no-constant-condition
        var fetchedMessages = await channel.messages.fetch({
            limit: 100,
            ...(lastID && { before: lastID }),
        });
        if (fetchedMessages.size === 0) {
            return img_url;
        }
        for (var entries of fetchedMessages.entries()) {
            entry = entries[1]
            if (entry.attachments.size > 0) {
                for (var attachment of entry.attachments.values()) {
                    img_url.push(attachment.url)
                }
            }
            if (entry.content != "" && entry.embeds.length > 0) {
                img_url.push(entry.content)
            }
        }
        lastID = fetchedMessages.lastKey();
    }
}


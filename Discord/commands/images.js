const { SlashCommandBuilder, Message } = require('discord.js');
const { EmbedBuilder } = require('discord.js')

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

module.exports = {
    data: new SlashCommandBuilder()
        .setName('countimages')
        .setDescription('Returns all images in channel'),
    async execute(interaction) {
        fetchAllMessages(interaction.client, interaction.channelId).then((img) => {
            const embed = new EmbedBuilder()
                .setTitle('Total images in `' + interaction.channel.name + '`')
                .setColor('#9F2B68')
                .setDescription("Count: " + img.length)
            interaction.reply({ embeds: [embed], ephemeral: true }).then(msg => {
                setTimeout(() => interaction.deleteReply(), 10000)
            })
        })
    },
};
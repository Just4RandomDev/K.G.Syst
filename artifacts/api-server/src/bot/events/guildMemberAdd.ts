import { GuildMember, EmbedBuilder, TextChannel } from "discord.js";
import { logger } from "../../lib/logger";
import { BOT_CONFIG } from "../config";

const AUTO_ROLES = [
  "1495070253439520980",
  "1495070254370652160",
  "1508519190787788945",
  "1495109525907443762",
  "1495070252512317632",
  "1508519184227631104",
  "1495416250661081268",
  "1495109600066801786",
  "1505527337024880731",
  "1517192863518032044",
];

export async function handleGuildMemberAdd(member: GuildMember) {
  const { user, guild } = member;

  logger.info({ userId: user.id, guild: guild.name }, "New member joined");

  try {
    await member.roles.add(AUTO_ROLES, "Roles automáticos al unirse");
    logger.info({ userId: user.id }, "Auto roles assigned");
  } catch (err) {
    logger.error({ err, userId: user.id }, "Error assigning auto roles");
  }

  try {
    const dmText = BOT_CONFIG.welcomeDmMessage(`<@${user.id}>`);
    await user.send(dmText);
    logger.info({ userId: user.id }, "Welcome DM sent");
  } catch (err) {
    logger.warn(
      { userId: user.id, err },
      "Could not send welcome DM (user may have DMs disabled)",
    );
  }

  try {
    const channel = guild.channels.cache.get(
      BOT_CONFIG.welcomeChannel.id,
    ) as TextChannel | undefined;
    if (!channel) {
      logger.warn(
        { channelId: BOT_CONFIG.welcomeChannel.id },
        "Welcome channel not found",
      );
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x9c1f1f)
      .setThumbnail(
        "https://media.discordapp.net/attachments/1497222795111960636/1522049188744007690/Sin_titulo.png?ex=6a470e44&is=6a45bcc4&hm=fa5e92730fd988fb1847d529dbeb9dbf435033fed619a4755baaf8796304abf2&=&format=webp&quality=lossless&width=972&height=972",
      )
      .setDescription(
        "`👋 | Admisión`\n> Lee el apartado de admisión en el canalhttps://discord.com/channels/1493142716505264130/1493142967878287371. Una vez lo hayas leído, puedes continuar.\n\n`✅ | Verificación` \n> Para continuar, debes elegir tu camino. Puedes formar parte de la facción como aspirante, donde recibirás entrenamiento y participarás en eventos.\n>      \n> Por otro lado, tienes la opción de civil; en este caso, no tendrás acceso al servidor como miembro de la comunidad.",
      )
      .setImage(
        "https://media.discordapp.net/attachments/1497222795111960636/1522049272869032169/Kairon_Group.png?ex=6a470e58&is=6a45bcd8&hm=fb7998fbef6d3aa0792687d141248ace86661a106d340be92a296dd40fad4b49&=&format=webp&quality=lossless&width=1589&height=994",
      );

    await channel.send({
      content: `<@${user.id}>`,
      embeds: [embed],
    });

    logger.info(
      { userId: user.id, channelId: channel.id },
      "Welcome embed sent",
    );
  } catch (err) {
    logger.error({ err }, "Error sending welcome embed");
  }
}

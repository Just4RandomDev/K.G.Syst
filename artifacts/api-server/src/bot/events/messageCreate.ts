import {
  Message,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
  PermissionFlagsBits,
} from "discord.js";
import { logger } from "../../lib/logger";
import { getPendingRegistro, deletePendingRegistro } from "../store";
import { handleVerificacionCommand } from "./verification";

const ALLOWED_PANEL_ROLES = [
  "1495416008448540775",
  "1495070257511927838",
  "1495070257457664111",
];

const PANEL_CHANNEL_ID = "1522180928896761936";

const PING_CHANNEL_ID = "1518295415584456915";
const PING_ROLE_ID = "1517193121417531463";

export async function handleMessageCreate(message: Message) {
  if (message.author.bot) return;

  if (message.channelId === PING_CHANNEL_ID) {
    if (message.channel.isTextBased() && !message.channel.isDMBased()) {
      try {
        await message.channel.send({
          content: `<@&${PING_ROLE_ID}>`,
          allowedMentions: { roles: [PING_ROLE_ID] },
        });
      } catch (err) {
        logger.error({ err }, "Error sending role ping");
      }
    }
  }

  if (message.content.trim() === "?code") {
    const embed = new EmbedBuilder()
      .setColor(0x9c1f1f)
      .setDescription("# ```51411685-1e04-4ba4-b287-5eaf74e3d5a1```");

    if (!message.channel.isTextBased() || message.channel.isDMBased()) return;
    await message.channel.send({ embeds: [embed] });
    return;
  }

  if (message.content.trim() === "?redes") {
    const embed = new EmbedBuilder()
      .setColor(0x9c1f1f)
      .setDescription(
        [
          "# Youtube <:yt:1520746929330323528>: [Link](https://www.youtube.com/@KaironGroup)",
          "# TikTok <:tktk:1520746967590764684>: [Link](https://www.tiktok.com/@kairon.group)",
          "# Discord <:discord:1520745880104468542>: [Link](https://discord.gg/SyWZUzYePe)",
          "# Guns.lol <:web:1520747510233169971>: [Link](https://guns.lol/kairon_group)",
        ].join("\n"),
      );

    if (!message.channel.isTextBased() || message.channel.isDMBased()) return;
    await message.channel.send({ embeds: [embed] });
    return;
  }

  if (message.content.trim() === "!KGVerificacion") {
    await handleVerificacionCommand(message);
    return;
  }

  if (message.content.trim() === "!KGPanel") {
    if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await message.reply({ content: "No tienes permisos para usar este comando." });
      return;
    }

    const PANEL_ICON_URL =
      "https://media.discordapp.net/attachments/1497222795111960636/1522049188744007690/Sin_titulo.png?ex=6a470e44&is=6a45bcc4&hm=fa5e92730fd988fb1847d529dbeb9dbf435033fed619a4755baaf8796304abf2&=&format=webp&quality=lossless&width=972&height=972";

    const embed = new EmbedBuilder()
      .setColor(0x9c1f1f)
      .setAuthor({ name: "Panel de Control — Kairon Logistics", iconURL: PANEL_ICON_URL })
      .setDescription(
        [
          "Este panel está destinado al registro de todas las acciones, Registros, sanciones, ascensos, descensos, etc.",
          "",
          "Para realizar uno de estos registros solo debes pulsar el botón y rellenar los parámetros.",
        ].join("\n"),
      )
      .setFooter({ text: "Kairon Logistics · Sistema de Registros", iconURL: PANEL_ICON_URL })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("panel_registro")
        .setLabel("📋 Registrar")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("panel_ascenso")
        .setLabel("📈 Ascenso")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("panel_peticion")
        .setLabel("📩 Petición")
        .setStyle(ButtonStyle.Danger),
    );

    if (!message.channel.isTextBased() || message.channel.isDMBased()) return;
    await message.channel.send({ embeds: [embed], components: [row] });

    try {
      await message.delete();
    } catch {
      // Message may already be deleted or no permission
    }

    logger.info({ userId: message.author.id }, "KGPanel sent");
    return;
  }

  const pending = getPendingRegistro(message.author.id);
  const isValidPhotoUpload =
    !!pending &&
    pending.channelId === message.channelId &&
    message.attachments.size > 0;

  if (message.channelId === PANEL_CHANNEL_ID && !isValidPhotoUpload) {
    try {
      await message.delete();
    } catch {
      // Message may already be deleted or no permission
    }
    return;
  }

  if (
    pending &&
    pending.channelId === message.channelId &&
    message.attachments.size > 0
  ) {
    deletePendingRegistro(message.author.id);

    const attachment = message.attachments.first()!;

    const embed = new EmbedBuilder()
      .setColor(0x9c1f1f)
      .setTitle("📋 Registro de Evento")
      .addFields(
        { name: "Nombre del Evento", value: pending.nombreEvento },
        { name: "Personal", value: pending.personal },
        { name: "Aprobados", value: pending.aprobados },
        { name: "Suspendidos", value: pending.suspendidos },
        { name: "Descripción General", value: pending.descripcion },
      )
      .setImage(attachment.url)
      .setFooter({ text: `Registrado por ${message.author.username}` })
      .setTimestamp();

    const REGISTRO_CHANNEL_ID = "1495096536768708639";
    const channel = message.guild?.channels.cache.get(REGISTRO_CHANNEL_ID) as TextChannel | undefined;
    if (channel) {
      await channel.send({ embeds: [embed] });
    }

    try {
      await message.delete();
    } catch {
      // ignore
    }

    logger.info({ userId: message.author.id }, "Registro published with photo");
  }
}

export { ALLOWED_PANEL_ROLES };

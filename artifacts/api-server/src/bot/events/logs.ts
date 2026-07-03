import {
  Message,
  PartialMessage,
  GuildMember,
  PartialGuildMember,
  EmbedBuilder,
  AuditLogEvent,
  TextChannel,
  GuildBan,
  GuildChannel,
  Role,
  Collection,
  Snowflake,
  User,
} from "discord.js";
import { logger } from "../../lib/logger";

const LOG_CHANNEL_ID = "1495356347309363301";

async function getLogChannel(guild: NonNullable<GuildMember["guild"]>): Promise<TextChannel | null> {
  const ch = guild.channels.cache.get(LOG_CHANNEL_ID);
  if (ch && ch.isTextBased() && !ch.isDMBased()) return ch as TextChannel;
  return null;
}

function timestamp() {
  return `<t:${Math.floor(Date.now() / 1000)}:F>`;
}

// ── Message Deleted ────────────────────────────────────────────────────────────
export async function handleMessageDelete(message: Message | PartialMessage) {
  if (!message.guild || message.author?.bot) return;
  const ch = await getLogChannel(message.guild);
  if (!ch) return;

  const embed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle("🗑️ Mensaje eliminado")
    .addFields(
      { name: "Autor", value: message.author ? `<@${message.author.id}> (${message.author.tag})` : "Desconocido", inline: true },
      { name: "Canal", value: `<#${message.channelId}>`, inline: true },
      { name: "Contenido", value: message.content ? (message.content.length > 1000 ? message.content.slice(0, 1000) + "…" : message.content) : "*Sin texto*" },
    )
    .setFooter({ text: `ID mensaje: ${message.id}` })
    .setTimestamp();

  await ch.send({ embeds: [embed] }).catch((err) => logger.error({ err }, "Log error: messageDelete"));
}

// ── Message Edited ─────────────────────────────────────────────────────────────
export async function handleMessageUpdate(
  oldMsg: Message | PartialMessage,
  newMsg: Message | PartialMessage,
) {
  if (!newMsg.guild || newMsg.author?.bot) return;
  if (oldMsg.content === newMsg.content) return;
  const ch = await getLogChannel(newMsg.guild);
  if (!ch) return;

  const embed = new EmbedBuilder()
    .setColor(0xf39c12)
    .setTitle("✏️ Mensaje editado")
    .setURL(newMsg.url)
    .addFields(
      { name: "Autor", value: newMsg.author ? `<@${newMsg.author.id}> (${newMsg.author.tag})` : "Desconocido", inline: true },
      { name: "Canal", value: `<#${newMsg.channelId}>`, inline: true },
      { name: "Antes", value: oldMsg.content ? (oldMsg.content.length > 500 ? oldMsg.content.slice(0, 500) + "…" : oldMsg.content) : "*Sin texto*" },
      { name: "Después", value: newMsg.content ? (newMsg.content.length > 500 ? newMsg.content.slice(0, 500) + "…" : newMsg.content) : "*Sin texto*" },
    )
    .setFooter({ text: `ID mensaje: ${newMsg.id}` })
    .setTimestamp();

  await ch.send({ embeds: [embed] }).catch((err) => logger.error({ err }, "Log error: messageUpdate"));
}

// ── Member Leave / Kick ────────────────────────────────────────────────────────
export async function handleGuildMemberRemove(member: GuildMember | PartialGuildMember) {
  if (!member.guild) return;
  const ch = await getLogChannel(member.guild);
  if (!ch) return;

  await new Promise((r) => setTimeout(r, 2000));

  let isKick = false;
  let kickedBy: { id: string } | null = null;
  let kickReason: string | null = null;

  try {
    const logs = await member.guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 1 });
    const entry = logs.entries.first();
    if (entry && entry.target?.id === member.id && Date.now() - entry.createdTimestamp < 5000) {
      isKick = true;
      kickedBy = entry.executor;
      kickReason = entry.reason;
    }
  } catch {
    // No audit log access
  }

  const embed = new EmbedBuilder()
    .setColor(isKick ? 0xe67e22 : 0x95a5a6)
    .setTitle(isKick ? "👢 Miembro expulsado (kick)" : "🚪 Miembro salió")
    .setThumbnail(member.user?.displayAvatarURL() ?? null)
    .addFields(
      { name: "Usuario", value: member.user ? `<@${member.id}> (${member.user.tag})` : `ID: ${member.id}`, inline: true },
      { name: "Miembros", value: `${member.guild.memberCount}`, inline: true },
    );

  if (isKick) {
    embed.addFields(
      { name: "Expulsado por", value: kickedBy ? `<@${kickedBy.id}>` : "Desconocido", inline: true },
      { name: "Motivo", value: kickReason ?? "Sin motivo", inline: true },
    );
  }

  embed.setFooter({ text: `ID: ${member.id}` }).setTimestamp();

  await ch.send({ embeds: [embed] }).catch((err) => logger.error({ err }, "Log error: guildMemberRemove"));
}

// ── Member Banned ──────────────────────────────────────────────────────────────
export async function handleGuildBanAdd(ban: GuildBan) {
  const ch = await getLogChannel(ban.guild);
  if (!ch) return;

  let bannedBy: { id: string } | null = null;
  let reason: string | null = ban.reason ?? null;

  try {
    await new Promise((r) => setTimeout(r, 1000));
    const logs = await ban.guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 1 });
    const entry = logs.entries.first();
    if (entry && entry.target?.id === ban.user.id) {
      bannedBy = entry.executor;
      reason = entry.reason ?? reason;
    }
  } catch {
    // No audit log access
  }

  const embed = new EmbedBuilder()
    .setColor(0xc0392b)
    .setTitle("🔨 Miembro baneado")
    .setThumbnail(ban.user.displayAvatarURL())
    .addFields(
      { name: "Usuario", value: `<@${ban.user.id}> (${ban.user.tag})`, inline: true },
      { name: "Baneado por", value: bannedBy ? `<@${bannedBy.id}>` : "Desconocido", inline: true },
      { name: "Motivo", value: reason ?? "Sin motivo" },
    )
    .setFooter({ text: `ID: ${ban.user.id}` })
    .setTimestamp();

  await ch.send({ embeds: [embed] }).catch((err) => logger.error({ err }, "Log error: guildBanAdd"));
}

// ── Member Unbanned ────────────────────────────────────────────────────────────
export async function handleGuildBanRemove(ban: GuildBan) {
  const ch = await getLogChannel(ban.guild);
  if (!ch) return;

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle("✅ Ban levantado")
    .setThumbnail(ban.user.displayAvatarURL())
    .addFields(
      { name: "Usuario", value: `<@${ban.user.id}> (${ban.user.tag})`, inline: true },
    )
    .setFooter({ text: `ID: ${ban.user.id}` })
    .setTimestamp();

  await ch.send({ embeds: [embed] }).catch((err) => logger.error({ err }, "Log error: guildBanRemove"));
}

// ── Member Updated (roles / nickname) ─────────────────────────────────────────
export async function handleGuildMemberUpdate(
  oldMember: GuildMember | PartialGuildMember,
  newMember: GuildMember,
) {
  const ch = await getLogChannel(newMember.guild);
  if (!ch) return;

  const embeds: EmbedBuilder[] = [];

  // Nickname change
  const oldNick = oldMember.nickname ?? oldMember.user?.username ?? "—";
  const newNick = newMember.nickname ?? newMember.user?.username ?? "—";
  if (oldNick !== newNick) {
    embeds.push(
      new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle("📝 Apodo cambiado")
        .addFields(
          { name: "Usuario", value: `<@${newMember.id}>`, inline: true },
          { name: "Antes", value: oldNick, inline: true },
          { name: "Después", value: newNick, inline: true },
        )
        .setFooter({ text: `ID: ${newMember.id}` })
        .setTimestamp(),
    );
  }

  // Roles added
  const addedRoles = newMember.roles.cache.filter((r) => !oldMember.roles.cache.has(r.id));
  if (addedRoles.size > 0) {
    embeds.push(
      new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle("➕ Rol añadido")
        .addFields(
          { name: "Usuario", value: `<@${newMember.id}>`, inline: true },
          { name: "Roles", value: addedRoles.map((r: Role) => `<@&${r.id}>`).join(", "), inline: true },
        )
        .setFooter({ text: `ID: ${newMember.id}` })
        .setTimestamp(),
    );
  }

  // Roles removed
  const removedRoles = oldMember.roles.cache.filter((r: Role) => !newMember.roles.cache.has(r.id));
  if (removedRoles.size > 0) {
    embeds.push(
      new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle("➖ Rol eliminado")
        .addFields(
          { name: "Usuario", value: `<@${newMember.id}>`, inline: true },
          { name: "Roles", value: removedRoles.map((r: Role) => `<@&${r.id}>`).join(", "), inline: true },
        )
        .setFooter({ text: `ID: ${newMember.id}` })
        .setTimestamp(),
    );
  }

  // Timeout
  const wasTimedOut = !oldMember.communicationDisabledUntil && newMember.communicationDisabledUntil;
  const timeoutLifted = oldMember.communicationDisabledUntil && !newMember.communicationDisabledUntil;

  if (wasTimedOut && newMember.communicationDisabledUntil) {
    embeds.push(
      new EmbedBuilder()
        .setColor(0xe67e22)
        .setTitle("🔇 Timeout aplicado")
        .addFields(
          { name: "Usuario", value: `<@${newMember.id}>`, inline: true },
          { name: "Hasta", value: `<t:${Math.floor(newMember.communicationDisabledUntil.getTime() / 1000)}:F>`, inline: true },
        )
        .setFooter({ text: `ID: ${newMember.id}` })
        .setTimestamp(),
    );
  }

  if (timeoutLifted) {
    embeds.push(
      new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle("🔊 Timeout levantado")
        .addFields({ name: "Usuario", value: `<@${newMember.id}>`, inline: true })
        .setFooter({ text: `ID: ${newMember.id}` })
        .setTimestamp(),
    );
  }

  for (const embed of embeds) {
    await ch.send({ embeds: [embed] }).catch((err) => logger.error({ err }, "Log error: guildMemberUpdate"));
  }
}

// ── Channel Created ────────────────────────────────────────────────────────────
export async function handleChannelCreate(channel: GuildChannel) {
  const ch = await getLogChannel(channel.guild);
  if (!ch) return;

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle("📁 Canal creado")
    .addFields(
      { name: "Canal", value: `<#${channel.id}> (${channel.name})`, inline: true },
      { name: "Tipo", value: channel.type.toString(), inline: true },
    )
    .setFooter({ text: `ID: ${channel.id}` })
    .setTimestamp();

  await ch.send({ embeds: [embed] }).catch((err) => logger.error({ err }, "Log error: channelCreate"));
}

// ── Channel Deleted ────────────────────────────────────────────────────────────
export async function handleChannelDelete(channel: GuildChannel) {
  const ch = await getLogChannel(channel.guild);
  if (!ch) return;

  const embed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle("🗑️ Canal eliminado")
    .addFields(
      { name: "Nombre", value: channel.name, inline: true },
      { name: "Tipo", value: channel.type.toString(), inline: true },
    )
    .setFooter({ text: `ID: ${channel.id}` })
    .setTimestamp();

  await ch.send({ embeds: [embed] }).catch((err) => logger.error({ err }, "Log error: channelDelete"));
}

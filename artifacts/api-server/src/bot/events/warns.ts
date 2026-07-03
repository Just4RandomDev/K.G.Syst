import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  GuildMember,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ActionRowBuilder,
  StringSelectMenuInteraction,
  ComponentType,
} from "discord.js";
import { db, warnsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../../lib/logger";

const WARN_CHANNEL_ID = "1495096918097793244";
const ALLOWED_ROLES = [
  "1495070251509874882",
  "1495070251128193104",
  "1495070247366033438",
];

function memberHasRole(member: GuildMember): boolean {
  return ALLOWED_ROLES.some((id) => member.roles.cache.has(id));
}

// ── /warn ──────────────────────────────────────────────────────────────────────
export async function handleWarn(interaction: ChatInputCommandInteraction) {
  const member = interaction.member as GuildMember;
  if (!memberHasRole(member)) {
    await interaction.reply({ content: "No tienes permisos para usar este comando.", ephemeral: true });
    return;
  }

  const target = interaction.options.getMember("usuario") as GuildMember | null;
  const reason = interaction.options.getString("motivo", true);

  if (!target) {
    await interaction.reply({ content: "Usuario no encontrado.", ephemeral: true });
    return;
  }

  if (target.user.bot) {
    await interaction.reply({ content: "No puedes sancionar a un bot.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const [inserted] = await db.insert(warnsTable).values({
    userId: target.id,
    guildId: interaction.guildId!,
    moderatorId: interaction.user.id,
    reason,
  }).returning();

  const allWarns = await db
    .select()
    .from(warnsTable)
    .where(and(eq(warnsTable.userId, target.id), eq(warnsTable.guildId, interaction.guildId!)));

  const warnNumber = allWarns.length;

  // ── Escalación automática por warns acumulados ─────────────────────────────
  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

  let autoActionLabel: string | null = null;

  try {
    if (warnNumber >= 8) {
      // Ban permanente
      await interaction.guild?.bans.create(target.id, {
        reason: `Sanción automática: ${warnNumber} avisos acumulados`,
      });
      autoActionLabel = "🔨 Baneo permanente aplicado automáticamente.";
      logger.info({ targetId: target.id, warnNumber }, "Auto-action: permanent ban");
    } else if (warnNumber >= 6) {
      // Expulsión (kick)
      await target.kick(`Sanción automática: ${warnNumber} avisos acumulados`);
      autoActionLabel = "👢 Expulsión (kick) aplicada automáticamente.";
      logger.info({ targetId: target.id, warnNumber }, "Auto-action: kick");
    } else if (warnNumber >= 4) {
      // Aislamiento 7 días
      await target.timeout(SEVEN_DAYS_MS, `Sanción automática: ${warnNumber} avisos acumulados`);
      autoActionLabel = "🔇 Aislamiento de 7 días aplicado automáticamente.";
      logger.info({ targetId: target.id, warnNumber }, "Auto-action: 7-day timeout");
    } else if (warnNumber >= 2) {
      // Aislamiento 3 días
      await target.timeout(THREE_DAYS_MS, `Sanción automática: ${warnNumber} avisos acumulados`);
      autoActionLabel = "🔇 Aislamiento de 3 días aplicado automáticamente.";
      logger.info({ targetId: target.id, warnNumber }, "Auto-action: 3-day timeout");
    }
  } catch (err) {
    logger.error({ err, targetId: target.id }, "Auto-action failed — check bot permissions");
    autoActionLabel = "⚠️ La sanción automática falló (verifica permisos del bot).";
  }

  // DM al usuario
  const dmEmbed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle("⚠️ Has recibido un aviso")
    .setDescription(`Has recibido un aviso en **${interaction.guild?.name}**.`)
    .addFields(
      { name: "Motivo", value: reason },
      { name: "Avisos totales", value: `${warnNumber}` },
      ...(autoActionLabel ? [{ name: "Sanción aplicada", value: autoActionLabel }] : []),
    )
    .setTimestamp();

  try {
    await target.user.send({ embeds: [dmEmbed] });
  } catch {
    // DMs cerrados
  }

  // Embed al canal de sanciones
  const sanctionEmbed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle(`Warn - ${target.user.username} - Warn #${warnNumber}`)
    .addFields(
      { name: "User", value: `<@${target.id}>`, inline: true },
      { name: "Moderator", value: `<@${interaction.user.id}>`, inline: true },
      { name: "Reason", value: reason },
      ...(autoActionLabel ? [{ name: "Sanción automática", value: autoActionLabel }] : []),
    )
    .setThumbnail(target.user.displayAvatarURL())
    .setFooter({ text: `ID: ${inserted.id}` })
    .setTimestamp();

  const sanctionChannel = interaction.guild?.channels.cache.get(WARN_CHANNEL_ID);
  if (sanctionChannel?.isTextBased() && !sanctionChannel.isDMBased()) {
    await sanctionChannel.send({ embeds: [sanctionEmbed] });
  }

  const replyParts = [`✅ Aviso aplicado a <@${target.id}>. Tiene **${warnNumber}** aviso(s) en total.`];
  if (autoActionLabel) replyParts.push(autoActionLabel);
  await interaction.editReply({ content: replyParts.join("\n") });
  logger.info({ targetId: target.id, moderatorId: interaction.user.id, warnId: inserted.id }, "Warn applied");
}

// ── /historial ─────────────────────────────────────────────────────────────────
export async function handleHistorial(interaction: ChatInputCommandInteraction) {
  const member = interaction.member as GuildMember;
  if (!memberHasRole(member)) {
    await interaction.reply({ content: "No tienes permisos para usar este comando.", ephemeral: true });
    return;
  }

  const target = interaction.options.getMember("usuario") as GuildMember | null;
  if (!target) {
    await interaction.reply({ content: "Usuario no encontrado.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const warns = await db
    .select()
    .from(warnsTable)
    .where(and(eq(warnsTable.userId, target.id), eq(warnsTable.guildId, interaction.guildId!)));

  const topRole = target.roles.highest;
  const joinedAt = target.joinedAt;

  let warnsText = warns.length === 0
    ? "*Sin avisos*"
    : warns.map((w, i) =>
        `**#${i + 1}** — <@${w.moderatorId}> | ${w.reason}${w.appealed ? " *(Apelado)*" : ""} — <t:${Math.floor(w.createdAt.getTime() / 1000)}:d>`
      ).join("\n");

  if (warnsText.length > 1000) warnsText = warnsText.slice(0, 997) + "…";

  const embed = new EmbedBuilder()
    .setColor(0x9c1f1f)
    .setTitle(`Historial — ${target.user.username}`)
    .setThumbnail(target.user.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: "Usuario", value: `<@${target.id}>`, inline: true },
      { name: "Rol más alto", value: `<@&${topRole.id}>`, inline: true },
      { name: "Fecha de unión", value: joinedAt ? `<t:${Math.floor(joinedAt.getTime() / 1000)}:D>` : "Desconocida", inline: true },
      { name: `Warns (${warns.length})`, value: warnsText },
    )
    .setFooter({ text: `ID: ${target.id}` })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// ── /delwarn ───────────────────────────────────────────────────────────────────
export async function handleDelwarn(interaction: ChatInputCommandInteraction) {
  const member = interaction.member as GuildMember;
  if (!memberHasRole(member)) {
    await interaction.reply({ content: "No tienes permisos para usar este comando.", ephemeral: true });
    return;
  }

  const target = interaction.options.getMember("usuario") as GuildMember | null;
  if (!target) {
    await interaction.reply({ content: "Usuario no encontrado.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const warns = await db
    .select()
    .from(warnsTable)
    .where(and(eq(warnsTable.userId, target.id), eq(warnsTable.guildId, interaction.guildId!)));

  if (warns.length === 0) {
    await interaction.editReply({ content: `<@${target.id}> no tiene avisos registrados.` });
    return;
  }

  const options = warns.slice(0, 25).map((w, i) =>
    new StringSelectMenuOptionBuilder()
      .setLabel(`#${i + 1} — ${w.reason.slice(0, 80)}`)
      .setDescription(`Por <@${w.moderatorId}> · ${w.createdAt.toLocaleDateString("es-ES")}`)
      .setValue(String(w.id)),
  );

  const select = new StringSelectMenuBuilder()
    .setCustomId("delwarn_select")
    .setPlaceholder("Selecciona el aviso a eliminar")
    .addOptions(options);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

  await interaction.editReply({
    content: `Selecciona el aviso de <@${target.id}> que deseas eliminar:`,
    components: [row],
  });

  const collector = interaction.channel?.createMessageComponentCollector({
    componentType: ComponentType.StringSelect,
    filter: (i) => i.customId === "delwarn_select" && i.user.id === interaction.user.id,
    time: 30_000,
    max: 1,
  });

  collector?.on("collect", async (selectInteraction: StringSelectMenuInteraction) => {
    const warnId = parseInt(selectInteraction.values[0]!);
    await db.delete(warnsTable).where(eq(warnsTable.id, warnId));
    await selectInteraction.update({ content: `✅ Aviso #${warnId} eliminado correctamente.`, components: [] });
    logger.info({ warnId, moderatorId: interaction.user.id }, "Warn deleted");
  });

  collector?.on("end", async (_, reason) => {
    if (reason === "time") {
      await interaction.editReply({ content: "Tiempo agotado.", components: [] }).catch(() => {});
    }
  });
}

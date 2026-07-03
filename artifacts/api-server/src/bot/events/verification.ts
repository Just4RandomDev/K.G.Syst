import {
  Message,
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  TextChannel,
  GuildMember,
  PermissionFlagsBits,
} from "discord.js";
import { logger } from "../../lib/logger";

const VERIF_REQUEST_CHANNEL = "1495085354494066729";
const VERIF_STAFF_ROLE = "1518021117770731584";

type VerifType = "entrevista" | "visitante";

const VERIF_ROLES: Record<VerifType, string> = {
  entrevista: "1495070256404627508",
  visitante: "1495114109618884719",
};

const VERIF_TITLES: Record<VerifType, string> = {
  entrevista: "Entrevista",
  visitante: "Visitante",
};

const formStartedAt = new Map<string, number>();

export async function handleVerificacionCommand(message: Message) {
  if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await message.reply({ content: "No tienes permisos para usar este comando." });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x9c1f1f)
    .setTitle("Kairon Logistics")
    .setDescription(
      "Se te mostrarán dos opciones; elige la que mejor se ajuste a tus objetivos dentro de la facción.",
    );

  const select = new StringSelectMenuBuilder()
    .setCustomId("verif_type_select")
    .setPlaceholder("Haz una selección")
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel("Entrevista").setValue("entrevista"),
      new StringSelectMenuOptionBuilder().setLabel("Visitante").setValue("visitante"),
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

  if (!message.channel.isTextBased() || message.channel.isDMBased()) return;
  await message.channel.send({ embeds: [embed], components: [row] });

  try {
    await message.delete();
  } catch {
    // Message may already be deleted or no permission
  }

  logger.info({ userId: message.author.id }, "Verification panel sent");
}

export async function handleVerificationSelect(interaction: StringSelectMenuInteraction) {
  if (interaction.customId !== "verif_type_select") return;

  const type = interaction.values[0] as VerifType;
  formStartedAt.set(interaction.user.id, Date.now());

  const modal = new ModalBuilder()
    .setCustomId(`verif_modal:${type}`)
    .setTitle(type === "entrevista" ? "Formulario de Entrevista" : "Formulario de Visitante");

  const robloxInput = new TextInputBuilder()
    .setCustomId("q1").setLabel("Link al perfil de Roblox").setStyle(TextInputStyle.Short).setRequired(true);
  const apodoInput = new TextInputBuilder()
    .setCustomId("q2").setLabel("Apodo").setStyle(TextInputStyle.Short).setRequired(true);
  const descubrioInput = new TextInputBuilder()
    .setCustomId("q3").setLabel("¿Cómo descubrió la facción?").setStyle(TextInputStyle.Paragraph).setRequired(true);

  if (type === "entrevista") {
    const motivoInput = new TextInputBuilder()
      .setCustomId("q4").setLabel("¿Por qué quieres formar parte?").setStyle(TextInputStyle.Paragraph).setRequired(true);
    const previaInput = new TextInputBuilder()
      .setCustomId("q5")
      .setLabel("¿Has formado parte de otra facción?")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(robloxInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(apodoInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(descubrioInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(motivoInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(previaInput),
    );
  } else {
    const motivoIngresoInput = new TextInputBuilder()
      .setCustomId("q4").setLabel("¿Cuál es el motivo de su ingreso?").setStyle(TextInputStyle.Paragraph).setRequired(true);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(robloxInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(apodoInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(descubrioInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(motivoIngresoInput),
    );
  }

  await interaction.showModal(modal);
}

export async function handleVerificationModalSubmit(interaction: ModalSubmitInteraction) {
  if (!interaction.customId.startsWith("verif_modal:")) return;

  const type = interaction.customId.split(":")[1] as VerifType;

  const q1 = interaction.fields.getTextInputValue("q1");
  const q2 = interaction.fields.getTextInputValue("q2");
  const q3 = interaction.fields.getTextInputValue("q3");
  const q4 = interaction.fields.getTextInputValue("q4");
  const q5 = type === "entrevista" ? interaction.fields.getTextInputValue("q5") : null;

  const startedAt = formStartedAt.get(interaction.user.id);
  formStartedAt.delete(interaction.user.id);
  const durationSeconds = startedAt ? Math.round((Date.now() - startedAt) / 1000) : null;

  const member = interaction.member as GuildMember | null;
  const joinedUnix = member?.joinedTimestamp ? Math.floor(member.joinedTimestamp / 1000) : null;
  const submittedUnix = Math.floor(Date.now() / 1000);

  const embed = new EmbedBuilder()
    .setColor(0x9c1f1f)
    .setTitle(`📝 Solicitud de ${VERIF_TITLES[type]}`)
    .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
    .setThumbnail(interaction.user.displayAvatarURL())
    .addFields(
      { name: "Link de Roblox", value: q1 },
      { name: "Apodo", value: q2 },
      { name: "¿Cómo descubrió la facción?", value: q3 },
      type === "entrevista"
        ? { name: "¿Por qué quieres formar parte?", value: q4 }
        : { name: "Motivo de ingreso", value: q4 },
      ...(q5 ? [{ name: "¿Ha formado parte de otra facción?", value: q5 }] : []),
      {
        name: "Submission stats",
        value: [
          `UserId: ${interaction.user.id}`,
          `Username: ${interaction.user.username}`,
          `User: <@${interaction.user.id}>`,
          durationSeconds !== null ? `Duration: ${durationSeconds}s` : null,
          joinedUnix ? `Joined guild <t:${joinedUnix}:R>` : null,
          `Submitted <t:${submittedUnix}:R>`,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    )
    .setFooter({ text: `ID usuario: ${interaction.user.id}` })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`verif_accept:${interaction.user.id}:${type}`)
      .setLabel("✅ Aceptar")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`verif_deny:${interaction.user.id}:${type}`)
      .setLabel("❌ Denegar")
      .setStyle(ButtonStyle.Danger),
  );

  const channel = interaction.guild?.channels.cache.get(VERIF_REQUEST_CHANNEL) as TextChannel | undefined;
  if (channel) {
    await channel.send({
      content: `<@&${VERIF_STAFF_ROLE}>`,
      embeds: [embed],
      components: [row],
      allowedMentions: { roles: [VERIF_STAFF_ROLE] },
    });
  }

  try {
    await interaction.user.send("Solicitud enviada:");
  } catch {
    // User may have DMs disabled
  }

  await interaction.reply({ content: "✅ Tu solicitud ha sido enviada correctamente.", ephemeral: true });
  logger.info({ userId: interaction.user.id, type }, "Verification request submitted");
}

export async function handleVerificationButton(interaction: ButtonInteraction) {
  const { customId } = interaction;
  if (!customId.startsWith("verif_accept:") && !customId.startsWith("verif_deny:")) return;

  const member = interaction.member as GuildMember | null;
  if (!member || !member.roles.cache.has(VERIF_STAFF_ROLE)) {
    await interaction.reply({ content: "No tienes permisos para gestionar esta solicitud.", ephemeral: true });
    return;
  }

  const [action, targetId, type] = customId.split(":") as [string, string, VerifType];
  const isAccept = action === "verif_accept";

  const guild = interaction.guild;
  if (!guild) return;

  await interaction.deferUpdate();

  let target: GuildMember | null = null;
  try {
    target = await guild.members.fetch(targetId);
  } catch {
    target = null;
  }

  if (isAccept && target) {
    try {
      await target.roles.add(VERIF_ROLES[type], `Solicitud de ${type} aceptada`);
    } catch (err) {
      logger.error({ err, targetId }, "Error assigning verification role");
    }
  }

  try {
    const user = target?.user ?? (await interaction.client.users.fetch(targetId));
    await user.send(isAccept ? "Solicitud aceptada | K.G. Staff" : "Solicitud denegada | K.G. Staff");
  } catch {
    // User may have DMs disabled
  }

  const originalEmbed = interaction.message.embeds[0];
  const updatedEmbed = originalEmbed
    ? EmbedBuilder.from(originalEmbed).addFields({
        name: "Estado",
        value: `${isAccept ? "✅ Aceptada" : "❌ Denegada"} por <@${interaction.user.id}>`,
      })
    : null;

  const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("verif_accept_done").setLabel("✅ Aceptar").setStyle(ButtonStyle.Success).setDisabled(true),
    new ButtonBuilder().setCustomId("verif_deny_done").setLabel("❌ Denegar").setStyle(ButtonStyle.Danger).setDisabled(true),
  );

  await interaction.editReply({
    embeds: updatedEmbed ? [updatedEmbed] : undefined,
    components: [disabledRow],
  });

  if (isAccept && !target) {
    await interaction.followUp({
      content: "⚠️ El usuario ya no está en el servidor, no se pudo asignar el rol.",
      ephemeral: true,
    });
  }

  logger.info({ targetId, type, isAccept, staffId: interaction.user.id }, "Verification request resolved");
}

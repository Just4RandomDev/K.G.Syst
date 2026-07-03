import {
  Interaction,
  ButtonInteraction,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  GuildMember,
  UserSelectMenuBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  UserSelectMenuInteraction,
  StringSelectMenuInteraction,
  TextChannel,
} from "discord.js";
import { logger } from "../../lib/logger";
import { BOT_CONFIG } from "../config";
import { setPendingRegistro } from "../store";
import { ALLOWED_PANEL_ROLES } from "./messageCreate";
import { handleWarn, handleHistorial, handleDelwarn } from "./warns";
import {
  handleVerificationSelect,
  handleVerificationModalSubmit,
  handleVerificationButton,
} from "./verification";

const ASCENSO_LOG_CHANNEL = "1522063302803591288";
const PETICION_CHANNEL = "1522393542029344950";
const PETICION_ROLES = [
  "1495070257511927838",
  "1495416008448540775",
  "1495070251128193104",
  "1495416180482248865",
];

function memberHasPanelRole(member: GuildMember): boolean {
  return ALLOWED_PANEL_ROLES.some((roleId) => member.roles.cache.has(roleId));
}

// ── Button handler ─────────────────────────────────────────────────────────────
async function handleButton(interaction: ButtonInteraction) {
  const { customId } = interaction;

  if (customId.startsWith("verif_accept:") || customId.startsWith("verif_deny:")) {
    await handleVerificationButton(interaction);
    return;
  }

  // ── Panel Registro ──────────────────────────────────────────────────────────
  if (customId === "panel_registro") {
    const member = interaction.member as GuildMember | null;
    if (!member || !memberHasPanelRole(member)) {
      await interaction.reply({ content: "No tienes permisos para usar este botón.", ephemeral: true });
      return;
    }

    const modal = new ModalBuilder().setCustomId("registro_modal").setTitle("Registro de Evento");

    const nombreInput = new TextInputBuilder()
      .setCustomId("nombre_evento").setLabel("Nombre del Evento").setStyle(TextInputStyle.Short).setRequired(true);
    const personalInput = new TextInputBuilder()
      .setCustomId("personal").setLabel("Host / Co-host / Supervisor")
      .setPlaceholder("Host: \nCo-host: \nSupervisor: ").setStyle(TextInputStyle.Paragraph).setRequired(true);
    const aprobadosInput = new TextInputBuilder()
      .setCustomId("aprobados").setLabel("Aprobados").setStyle(TextInputStyle.Paragraph).setRequired(false);
    const suspendidosInput = new TextInputBuilder()
      .setCustomId("suspendidos").setLabel("Suspendidos").setStyle(TextInputStyle.Paragraph).setRequired(false);
    const descripcionInput = new TextInputBuilder()
      .setCustomId("descripcion").setLabel("Descripción General").setStyle(TextInputStyle.Paragraph).setRequired(true);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(nombreInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(personalInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(aprobadosInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(suspendidosInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(descripcionInput),
    );

    await interaction.showModal(modal);
    return;
  }

  // ── Panel Ascenso ───────────────────────────────────────────────────────────
  if (customId === "panel_ascenso") {
    const member = interaction.member as GuildMember | null;
    if (!member || !memberHasPanelRole(member)) {
      await interaction.reply({ content: "No tienes permisos para usar este botón.", ephemeral: true });
      return;
    }

    const userSelect = new UserSelectMenuBuilder()
      .setCustomId("ascenso_user_select")
      .setPlaceholder("Selecciona el usuario a ascender")
      .setMinValues(1)
      .setMaxValues(1);

    const row = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(userSelect);
    await interaction.reply({ content: "**Ascenso** — Selecciona el usuario:", components: [row], ephemeral: true });
    return;
  }

  // ── Panel Petición ──────────────────────────────────────────────────────────
  if (customId === "panel_peticion") {
    const guild = interaction.guild;
    if (!guild) return;

    await guild.roles.fetch();

    const options = PETICION_ROLES.map((roleId) => {
      const role = guild.roles.cache.get(roleId);
      return new StringSelectMenuOptionBuilder()
        .setLabel(role ? role.name : roleId)
        .setValue(roleId);
    });

    const select = new StringSelectMenuBuilder()
      .setCustomId("peticion_rol_select")
      .setPlaceholder("Selecciona el rol al que va dirigida la petición")
      .addOptions(options);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
    await interaction.reply({ content: "**Petición** — ¿A qué rol va dirigida?", components: [row], ephemeral: true });
    return;
  }

  if (customId === "panel_info") {
    await interaction.reply({ content: "Aquí tienes información general del servidor.", ephemeral: true });
  } else if (customId === "panel_ticket") {
    await interaction.reply({ content: "Para abrir un ticket, contacta al personal disponible.", ephemeral: true });
  } else if (customId === "panel_rules") {
    await interaction.reply({ content: "Revisa el canal de reglas del servidor.", ephemeral: true });
  }
}

// ── UserSelectMenu handler ─────────────────────────────────────────────────────
async function handleUserSelect(interaction: UserSelectMenuInteraction) {
  if (interaction.customId === "ascenso_user_select") {
    const targetId = interaction.values[0]!;

    const typeSelect = new StringSelectMenuBuilder()
      .setCustomId(`ascenso_type:${targetId}`)
      .setPlaceholder("Selecciona el tipo de ascenso")
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel("Aspirante → Operador")
          .setValue("aspirante_operador")
          .setDescription("Retira el rol Aspirante y asigna los roles de Operador"),
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(typeSelect);
    await interaction.update({ content: "**Ascenso** — Selecciona el tipo:", components: [row] });
  }
}

// ── StringSelectMenu handler ───────────────────────────────────────────────────
async function handleStringSelect(interaction: StringSelectMenuInteraction) {
  if (interaction.customId === "verif_type_select") {
    await handleVerificationSelect(interaction);
    return;
  }

  if (interaction.customId === "peticion_rol_select") {
    const roleId = interaction.values[0]!;

    const modal = new ModalBuilder()
      .setCustomId(`peticion_modal:${roleId}`)
      .setTitle("Nueva Petición");

    const peticionInput = new TextInputBuilder()
      .setCustomId("peticion_texto")
      .setLabel("Describe tu petición")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(peticionInput));

    await interaction.showModal(modal);
    return;
  }

  if (!interaction.customId.startsWith("ascenso_type:")) return;

  const targetId = interaction.customId.split(":")[1]!;
  const type = interaction.values[0]!;

  await interaction.deferUpdate();

  const guild = interaction.guild;
  if (!guild) return;

  let target: GuildMember | null = null;
  try {
    target = await guild.members.fetch(targetId);
  } catch {
    await interaction.editReply({ content: "No se encontró el usuario en el servidor.", components: [] });
    return;
  }

  if (type === "aspirante_operador") {
    const REMOVE_ROLES = ["1495070256404627508"];
    const ADD_ROLES = [
      "1495070255817425006",
      "1495106100326830171",
      "1495105901387059432",
      "1495070258040406207",
    ];

    try {
      await target.roles.remove(REMOVE_ROLES, "Ascenso: Aspirante → Operador");
      await target.roles.add(ADD_ROLES, "Ascenso: Aspirante → Operador");
    } catch (err) {
      logger.error({ err, targetId }, "Error applying ascenso roles");
      await interaction.editReply({ content: "❌ Error al aplicar los roles. Verifica los permisos del bot.", components: [] });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x9c1f1f)
      .setTitle("📈 Ascenso — Aspirante → Operador")
      .setThumbnail(target.user.displayAvatarURL())
      .addFields(
        { name: "Usuario", value: `<@${target.id}>`, inline: true },
        { name: "Ascendido por", value: `<@${interaction.user.id}>`, inline: true },
        { name: "Cambio", value: "**Aspirante → Operador**", inline: false },
        { name: "Rol retirado", value: `<@&${REMOVE_ROLES[0]}>`, inline: true },
        { name: "Roles añadidos", value: ADD_ROLES.map((r) => `<@&${r}>`).join("\n"), inline: true },
      )
      .setFooter({ text: `ID usuario: ${target.id}` })
      .setTimestamp();

    const logChannel = guild.channels.cache.get(ASCENSO_LOG_CHANNEL) as TextChannel | undefined;
    if (logChannel) {
      await logChannel.send({ embeds: [embed] });
    }

    await interaction.editReply({ content: `✅ <@${target.id}> ascendido correctamente a **Operador**.`, components: [] });
    logger.info({ targetId, moderatorId: interaction.user.id, type }, "Ascenso applied");
  }
}

// ── Command handler ────────────────────────────────────────────────────────────
async function handleCommand(interaction: ChatInputCommandInteraction) {
  const { commandName } = interaction;

  if (commandName === "warn") {
    await handleWarn(interaction);
    return;
  } else if (commandName === "historial") {
    await handleHistorial(interaction);
    return;
  } else if (commandName === "delwarn") {
    await handleDelwarn(interaction);
    return;
  }

  if (commandName === "panel") {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: "No tienes permisos para usar este comando.", ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("Panel de Kairon Group")
      .setDescription("Selecciona una opción del panel:")
      .setColor(0x5865f2)
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("panel_info").setLabel("Información").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("panel_ticket").setLabel("Tickets").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("panel_rules").setLabel("Reglas").setStyle(ButtonStyle.Danger),
    );

    await interaction.reply({ embeds: [embed], components: [row] });
  } else if (commandName === "embed") {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
      await interaction.reply({ content: "No tienes permisos para usar este comando.", ephemeral: true });
      return;
    }

    const modal = new ModalBuilder().setCustomId("embed_modal").setTitle("Crear Embed");

    const titleInput = new TextInputBuilder()
      .setCustomId("embed_title").setLabel("Título del embed").setStyle(TextInputStyle.Short).setRequired(true);
    const descInput = new TextInputBuilder()
      .setCustomId("embed_desc").setLabel("Descripción del embed").setStyle(TextInputStyle.Paragraph).setRequired(true);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(descInput),
    );

    await interaction.showModal(modal);
  }
}

// ── Modal handler ──────────────────────────────────────────────────────────────
async function handleModalSubmit(interaction: Interaction) {
  if (!interaction.isModalSubmit()) return;

  if (interaction.customId.startsWith("verif_modal:")) {
    await handleVerificationModalSubmit(interaction);
    return;
  }

  if (interaction.customId === "registro_modal") {
    const nombreEvento = interaction.fields.getTextInputValue("nombre_evento");
    const personal = interaction.fields.getTextInputValue("personal");
    const aprobados = interaction.fields.getTextInputValue("aprobados") || "—";
    const suspendidos = interaction.fields.getTextInputValue("suspendidos") || "—";
    const descripcion = interaction.fields.getTextInputValue("descripcion");

    setPendingRegistro(interaction.user.id, {
      channelId: interaction.channelId!,
      userId: interaction.user.id,
      nombreEvento,
      personal,
      aprobados,
      suspendidos,
      descripcion,
      createdAt: Date.now(),
    });

    await interaction.reply({
      content:
        "✅ Formulario recibido. Ahora **adjunta la foto de puntos** en este canal y el registro se publicará automáticamente.\n*(Tienes 10 minutos para subir la foto.)*",
      ephemeral: true,
    });
    logger.info({ userId: interaction.user.id }, "Registro form submitted, awaiting photo");
    return;
  }

  if (interaction.customId.startsWith("peticion_modal:")) {
    const roleId = interaction.customId.split(":")[1]!;
    const texto = interaction.fields.getTextInputValue("peticion_texto");

    const channel = interaction.guild?.channels.cache.get(PETICION_CHANNEL) as TextChannel | undefined;
    if (!channel) {
      await interaction.reply({ content: "No se encontró el canal de peticiones.", ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x9c1f1f)
      .setTitle("📩 Nueva Petición")
      .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
      .addFields({ name: "Petición", value: texto })
      .setFooter({ text: `ID usuario: ${interaction.user.id}` })
      .setTimestamp();

    await channel.send({ content: `<@&${roleId}>`, embeds: [embed] });
    await interaction.reply({ content: "✅ Tu petición ha sido enviada correctamente.", ephemeral: true });
    logger.info({ userId: interaction.user.id, roleId }, "Petición sent");
    return;
  }

  if (interaction.customId === "embed_modal") {
    const title = interaction.fields.getTextInputValue("embed_title");
    const desc = interaction.fields.getTextInputValue("embed_desc");

    const channel = interaction.guild?.channels.cache.get(BOT_CONFIG.welcomeChannel.id);
    if (!channel || !channel.isTextBased()) {
      await interaction.reply({ content: "No se encontró el canal de destino.", ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder().setTitle(title).setDescription(desc).setColor(0x5865f2).setTimestamp();
    const member = interaction.member;
    const userId = typeof member === "object" && member ? (member as { user?: { id?: string } }).user?.id : undefined;

    await channel.send({ content: userId ? `<@${userId}>` : undefined, embeds: [embed] });
    await interaction.reply({ content: `Embed enviado al canal <#${BOT_CONFIG.welcomeChannel.id}>.`, ephemeral: true });
  }
}

// ── Main dispatcher ────────────────────────────────────────────────────────────
export async function handleInteractionCreate(interaction: Interaction) {
  try {
    if (interaction.isButton()) {
      await handleButton(interaction);
    } else if (interaction.isUserSelectMenu()) {
      await handleUserSelect(interaction);
    } else if (interaction.isStringSelectMenu()) {
      await handleStringSelect(interaction);
    } else if (interaction.isChatInputCommand()) {
      await handleCommand(interaction);
    } else if (interaction.isModalSubmit()) {
      await handleModalSubmit(interaction);
    }
  } catch (err) {
    logger.error({ err }, "Error handling interaction");
  }
}

import { REST, Routes, SlashCommandBuilder } from "discord.js";
import { logger } from "../lib/logger";

const commands = [
  new SlashCommandBuilder()
    .setName("panel")
    .setDescription("Envía el panel de botones al canal actual")
    .toJSON(),

  new SlashCommandBuilder()
    .setName("embed")
    .setDescription("Crea y envía un embed personalizado al canal de recepción")
    .toJSON(),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Aplica un aviso a un usuario")
    .addUserOption((opt) =>
      opt.setName("usuario").setDescription("Usuario a sancionar").setRequired(true),
    )
    .addStringOption((opt) =>
      opt.setName("motivo").setDescription("Motivo del aviso").setRequired(true),
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName("historial")
    .setDescription("Muestra el historial de avisos de un usuario")
    .addUserOption((opt) =>
      opt.setName("usuario").setDescription("Usuario a consultar").setRequired(true),
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName("delwarn")
    .setDescription("Elimina un aviso de un usuario")
    .addUserOption((opt) =>
      opt.setName("usuario").setDescription("Usuario del que eliminar el aviso").setRequired(true),
    )
    .toJSON(),
];

export async function registerCommands(token: string, clientId: string) {
  const rest = new REST({ version: "10" }).setToken(token);
  try {
    logger.info("Registrando slash commands...");
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    logger.info("Slash commands registrados correctamente");
  } catch (err) {
    logger.error({ err }, "Error registrando slash commands");
  }
}

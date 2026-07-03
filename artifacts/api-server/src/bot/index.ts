import { Client, GatewayIntentBits, Partials } from "discord.js";
import { logger } from "../lib/logger";
import { handleGuildMemberAdd } from "./events/guildMemberAdd";
import { handleInteractionCreate } from "./events/interactionCreate";
import { handleMessageCreate } from "./events/messageCreate";
import { registerCommands } from "./commands";
import {
  handleMessageDelete,
  handleMessageUpdate,
  handleGuildMemberRemove,
  handleGuildBanAdd,
  handleGuildBanRemove,
  handleGuildMemberUpdate,
  handleChannelCreate,
  handleChannelDelete,
} from "./events/logs";

const SHUTDOWN_CHANNEL_ID = "1495085198378008646";
const SHUTDOWN_MENTION_USER_ID = "1350559471859929129";

export function startBot() {
  const token = process.env["DISCORD_TOKEN"];
  if (!token) {
    logger.error("DISCORD_TOKEN is not set — bot will not start");
    return;
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildModeration,
    ],
    partials: [Partials.GuildMember, Partials.Message, Partials.Channel],
  });

  client.once("ready", async (c) => {
    logger.info({ tag: c.user.tag }, "Bot connected and ready");
    await registerCommands(token, c.user.id);
  });

  // Welcome
  client.on("guildMemberAdd", handleGuildMemberAdd);

  // Interactions & prefix commands
  client.on("interactionCreate", handleInteractionCreate);
  client.on("messageCreate", handleMessageCreate);

  // Logs
  client.on("messageDelete", handleMessageDelete);
  client.on("messageUpdate", handleMessageUpdate);
  client.on("guildMemberRemove", handleGuildMemberRemove);
  client.on("guildBanAdd", handleGuildBanAdd);
  client.on("guildBanRemove", handleGuildBanRemove);
  client.on("guildMemberUpdate", handleGuildMemberUpdate);
  client.on("channelCreate", (ch) => { if ("guild" in ch) handleChannelCreate(ch); });
  client.on("channelDelete", (ch) => { if ("guild" in ch) handleChannelDelete(ch); });

  client.on("error", (err) => {
    logger.error({ err }, "Discord client error");
  });

  client.login(token).catch((err) => {
    logger.error({ err }, "Failed to login to Discord");
  });

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info({ signal }, "Bot shutting down, sending shutdown notice");

    try {
      const channel = await client.channels.fetch(SHUTDOWN_CHANNEL_ID);
      if (channel && channel.isTextBased() && !channel.isDMBased()) {
        await channel.send({
          content: `⚠️ <@${SHUTDOWN_MENTION_USER_ID}> El bot se está apagando.`,
          allowedMentions: { users: [SHUTDOWN_MENTION_USER_ID] },
        });
      }
    } catch (err) {
      logger.error({ err }, "Error sending shutdown notice");
    }

    client.destroy();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  return client;
}

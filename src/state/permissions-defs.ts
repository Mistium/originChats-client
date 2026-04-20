/**
 * permissions-defs.ts — Server permission definitions
 */
export interface ServerPermission {
  id: string;
  name: string;
  description: string;
  category: string;
}

export const DEFAULT_PERMISSIONS: ServerPermission[] = [
  {
    id: "administrator",
    name: "Administrator",
    description: "Full permissions (bypasses all checks except owner)",
    category: "Server",
  },
  {
    id: "manage_server",
    name: "Manage Server",
    description: "Update server settings, emojis, and webhooks",
    category: "Server",
  },
  {
    id: "view_audit_log",
    name: "View Audit Log",
    description: "View server audit logs",
    category: "Server",
  },
  {
    id: "manage_roles",
    name: "Manage Roles",
    description: "Create, delete, and assign roles below own position",
    category: "Roles",
  },
  {
    id: "manage_channels",
    name: "Manage Channels",
    description: "Create, delete, and configure channels",
    category: "Channels",
  },
  {
    id: "manage_threads",
    name: "Manage Threads",
    description: "Lock, archive, and delete threads",
    category: "Channels",
  },
  {
    id: "manage_users",
    name: "Manage Users",
    description: "Ban, unban, timeout, and manage user nicknames",
    category: "Moderation",
  },
  {
    id: "kick_members",
    name: "Kick Members",
    description: "Kick users from the server",
    category: "Moderation",
  },
  {
    id: "manage_nicknames",
    name: "Manage Nicknames",
    description: "Change other users' nicknames",
    category: "Moderation",
  },
  {
    id: "change_nickname",
    name: "Change Nickname",
    description: "Change own nickname",
    category: "Moderation",
  },
  {
    id: "manage_messages",
    name: "Manage Messages",
    description: "Delete and pin any message across all channels",
    category: "Messages",
  },
  {
    id: "read_message_history",
    name: "Read History",
    description: "View previous messages in channel",
    category: "Messages",
  },
  {
    id: "send_messages",
    name: "Send Messages",
    description: "Send messages in text channels",
    category: "Messages",
  },
  {
    id: "send_tts",
    name: "Send TTS",
    description: "Send text-to-speech messages",
    category: "Messages",
  },
  {
    id: "embed_links",
    name: "Embed Links",
    description: "Embed links in messages",
    category: "Messages",
  },
  {
    id: "attach_files",
    name: "Attach Files",
    description: "Attach files to messages",
    category: "Messages",
  },
  {
    id: "add_reactions",
    name: "Add Reactions",
    description: "Add reactions to messages",
    category: "Messages",
  },
  {
    id: "external_emojis",
    name: "External Emojis",
    description: "Use external/custom emojis",
    category: "Messages",
  },
  {
    id: "mention_everyone",
    name: "Mention Everyone",
    description: "Mention the @everyone role",
    category: "Special",
  },
  {
    id: "use_slash_commands",
    name: "Use Slash Commands",
    description: "Use slash commands in chat",
    category: "Special",
  },
  {
    id: "create_invite",
    name: "Create Invite",
    description: "Create channel invites",
    category: "Invites",
  },
  {
    id: "manage_invites",
    name: "Manage Invites",
    description: "Manage and revoke invites",
    category: "Invites",
  },
  { id: "connect", name: "Connect", description: "Connect to voice channels", category: "Voice" },
  { id: "speak", name: "Speak", description: "Speak in voice channels", category: "Voice" },
  {
    id: "stream",
    name: "Stream",
    description: "Stream video in voice channels",
    category: "Voice",
  },
  {
    id: "mute_members",
    name: "Mute Members",
    description: "Mute users in voice channels",
    category: "Voice",
  },
  {
    id: "deafen_members",
    name: "Deafen Members",
    description: "Deafen users in voice channels",
    category: "Voice",
  },
  {
    id: "move_members",
    name: "Move Members",
    description: "Move users between voice channels",
    category: "Voice",
  },
  {
    id: "use_voice_activity",
    name: "Voice Activity",
    description: "Use voice activity detection",
    category: "Voice",
  },
  {
    id: "priority_speaker",
    name: "Priority Speaker",
    description: "Be heard over other speakers",
    category: "Voice",
  },
];

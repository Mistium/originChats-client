import { signal } from "@preact/signals";
import { settings as dbSettings } from "../lib/persistence/db";
import {
  markSettingsLoaded,
  persistSimpleSignal,
  persistJsonSignal,
  persistNullableSignal,
} from "../lib/persistence/persistence-effects";
import { recentEmojis } from "./core";

export const isOffline = signal<boolean>(false);
export const offlinePushServers = signal<Record<string, boolean>>({});

export type NotificationLevel = "all" | "mentions" | "none";
export const serverNotifSettings = signal<Record<string, NotificationLevel>>({});
export const channelNotifSettings = signal<Record<string, NotificationLevel>>({});

export function getChannelNotifLevel(sUrl: string, channelName: string): NotificationLevel {
  const channelKey = `${sUrl}:${channelName}`;
  if (channelNotifSettings.value[channelKey] !== undefined) {
    return channelNotifSettings.value[channelKey];
  }
  if (serverNotifSettings.value[sUrl] !== undefined) {
    return serverNotifSettings.value[sUrl];
  }
  return "mentions";
}

export type PingSoundType = "default" | "soft" | "bell" | "pop" | "custom" | "none";
export type BlockedMessageDisplay = "hide" | "collapse" | "show";
export type AppTheme = "dark" | "midnight" | "dim" | "light" | "amoled" | "ocean" | "forest";
export type AppFont = "default" | "system" | "geometric" | "humanist" | "mono" | "serif";
export type AvatarShape = "circle" | "rounded" | "square";

export const pingSound = signal<PingSoundType>("default");
export const pingVolume = signal<number>(0.3);
export const customPingSound = signal<string | null>(null);
export const blockedMessageDisplay = signal<BlockedMessageDisplay>("collapse");
export const appTheme = signal<AppTheme>("dark");
export const appFont = signal<AppFont>("default");
export const hideScrollbars = signal<boolean>(false);
export const hideAvatarBorders = signal<boolean>(false);
export const reduceMotion = signal<boolean>(false);
export const avatarShape = signal<AvatarShape>("circle");
export const bubbleRadius = signal<number>(10);
export const accentColor = signal<string>("");
export const pingHighlightColor = signal<string>("");
export const useSystemEmojis = signal<boolean>(false);
export const messageFontSize = signal<number>(15);
export const compactMode = signal<boolean>(false);
export const showTimestamps = signal<boolean>(true);
export const notificationPromptDismissed = signal<boolean>(false);
export const showEditedIndicator = signal<boolean>(true);
export const maxInlineImageWidth = signal<number>(400);
export const micThreshold = signal<number>(30);
export const voiceVideoRes = signal<number>(720);
export const voiceVideoFps = signal<number>(30);

export const sendTypingIndicators = signal<boolean>(true);
export const dmMessageSound = signal<boolean>(true);

export type UserStatus = "online" | "idle" | "dnd" | "offline";
interface MyStatus {
  status: UserStatus;
  text?: string;
}
export const myStatus = signal<MyStatus>({ status: "online" });
export const autoIdleOnUnfocus = signal<boolean>(true);
export const savedStatusText = signal<string | undefined>(undefined);

const THEME_VARS: Record<AppTheme, Record<string, string>> = {
  dark: {
    "--bg": "#050505",
    "--surface": "#0a0a0c",
    "--surface-light": "#141419",
    "--surface-hover": "#1f1f26",
    "--border": "#2a2a33",
    "--text": "#ededed",
    "--text-dim": "#a0a0a0",
    "--primary": "#4e5058",
    "--primary-hover": "#586068",
  },
  midnight: {
    "--bg": "#000000",
    "--surface": "#060611",
    "--surface-light": "#0d0d1f",
    "--surface-hover": "#16162e",
    "--border": "#23233a",
    "--text": "#e8e8f4",
    "--text-dim": "#8888aa",
    "--primary": "#5865f2",
    "--primary-hover": "#4752c4",
  },
  dim: {
    "--bg": "#1a1a1f",
    "--surface": "#212128",
    "--surface-light": "#2a2a33",
    "--surface-hover": "#33333d",
    "--border": "#3a3a47",
    "--text": "#e0e0e8",
    "--text-dim": "#909099",
    "--primary": "#5865f2",
    "--primary-hover": "#4752c4",
  },
  light: {
    "--bg": "#f2f3f5",
    "--surface": "#ffffff",
    "--surface-light": "#f2f3f5",
    "--surface-hover": "#e8e9ec",
    "--border": "#e3e5e8",
    "--text": "#060607",
    "--text-dim": "#4e5058",
    "--primary": "#5865f2",
    "--primary-hover": "#4752c4",
  },
  amoled: {
    "--bg": "#000000",
    "--surface": "#000000",
    "--surface-light": "#0a0a0a",
    "--surface-hover": "#141414",
    "--border": "#1e1e1e",
    "--text": "#ffffff",
    "--text-dim": "#888888",
    "--primary": "#5865f2",
    "--primary-hover": "#4752c4",
  },
  ocean: {
    "--bg": "#040d1a",
    "--surface": "#081428",
    "--surface-light": "#0e1e38",
    "--surface-hover": "#162848",
    "--border": "#1e3258",
    "--text": "#e0f0ff",
    "--text-dim": "#7a9fc0",
    "--primary": "#00a8fc",
    "--primary-hover": "#0090d4",
  },
  forest: {
    "--bg": "#060d06",
    "--surface": "#0a140a",
    "--surface-light": "#111e11",
    "--surface-hover": "#192819",
    "--border": "#243424",
    "--text": "#e0f0e0",
    "--text-dim": "#7a9f7a",
    "--primary": "#3ba55c",
    "--primary-hover": "#2d8049",
  },
};

function applyTheme(theme: AppTheme) {
  const vars = THEME_VARS[theme] || THEME_VARS.dark;
  const root = document.documentElement;
  for (const [key, val] of Object.entries(vars)) {
    root.style.setProperty(key, val);
  }
  if (accentColor.value) applyAccentColor(accentColor.value);
  applyPingHighlightColor(pingHighlightColor.value);
}

function applyFont(font: AppFont) {
  const fontClasses: AppFont[] = ["system", "geometric", "humanist", "mono", "serif"];
  for (const cls of fontClasses) document.body.classList.remove(`font-${cls}`);
  if (font !== "default") document.body.classList.add(`font-${font}`);
}

function applyAvatarShape(shape: AvatarShape) {
  const r = shape === "circle" ? "50%" : shape === "rounded" ? "22%" : "6px";
  document.documentElement.style.setProperty("--avatar-radius", r);
}

function applyBubbleRadius(px: number) {
  document.documentElement.style.setProperty("--chat-radius", `${px}px`);
  document.documentElement.style.setProperty("--border-radius", `${px}px`);
}

function applyAccentColor(hex: string) {
  if (!hex) {
    const vars = THEME_VARS[appTheme.value] || THEME_VARS.dark;
    document.documentElement.style.setProperty("--primary", vars["--primary"]);
    document.documentElement.style.setProperty("--primary-hover", vars["--primary-hover"]);
    return;
  }
  document.documentElement.style.setProperty("--primary", hex);
  document.documentElement.style.setProperty("--primary-hover", hex + "cc");
}

function applyPingHighlightColor(hex: string) {
  if (!hex) {
    document.documentElement.style.setProperty("--mention", "#9b87f5");
    return;
  }
  document.documentElement.style.setProperty("--mention", hex);
}

function applyMessageFontSize(px: number) {
  document.documentElement.style.setProperty("--message-font-size", `${px}px`);
}

function applyCompactMode(on: boolean) {
  document.body.classList.toggle("compact-mode", on);
}

function applyMaxImageWidth(px: number) {
  document.documentElement.style.setProperty("--max-inline-image-width", `${px}px`);
}

applyTheme(appTheme.value);
applyFont(appFont.value);
applyAvatarShape(avatarShape.value);
applyBubbleRadius(bubbleRadius.value);
if (accentColor.value) applyAccentColor(accentColor.value);
applyPingHighlightColor(pingHighlightColor.value);
applyMessageFontSize(messageFontSize.value);
applyCompactMode(compactMode.value);
applyMaxImageWidth(maxInlineImageWidth.value);
document.body.classList.toggle("hide-scrollbars", hideScrollbars.value);
document.body.classList.toggle("hide-avatar-borders", hideAvatarBorders.value);
document.body.classList.toggle("reduce-motion", reduceMotion.value);
document.body.classList.toggle("hide-timestamps", !showTimestamps.value);
document.body.classList.toggle("hide-edited-indicator", !showEditedIndicator.value);

export async function initSettingsFromDb(): Promise<void> {
  const s = dbSettings;
  const bool = async (key: string, def: boolean) => {
    const v = await s.get<string | undefined>(key, undefined);
    return v === undefined ? def : v !== "false";
  };
  const num = async (key: string, def: number) => {
    const v = await s.get<string | undefined>(key, undefined);
    return v === undefined ? def : parseFloat(v);
  };
  const str = async <T extends string>(key: string, def: T): Promise<T> => {
    const v = await s.get<string | undefined>(key, undefined);
    return (v ?? def) as T;
  };

  const rawEmojis = await s.get<string[] | string>("recentEmojis", []);
  recentEmojis.value = Array.isArray(rawEmojis) ? rawEmojis : [];
  sendTypingIndicators.value = await bool("sendTypingIndicators", true);
  dmMessageSound.value = await bool("dmMessageSound", true);
  pingSound.value = await str<PingSoundType>("pingSound", "default");
  pingVolume.value = await num("pingVolume", 0.3);
  customPingSound.value = await s.get<string | null>("customPingSound", null);
  blockedMessageDisplay.value = await str<BlockedMessageDisplay>(
    "blockedMessageDisplay",
    "collapse"
  );
  appTheme.value = await str<AppTheme>("theme", "dark");
  appFont.value = await str<AppFont>("font", "default");
  hideScrollbars.value = await bool("hideScrollbars", false);
  hideAvatarBorders.value = await bool("hideAvatarBorders", false);
  reduceMotion.value = await bool("reduceMotion", false);
  avatarShape.value = await str<AvatarShape>("avatarShape", "circle");
  bubbleRadius.value = await num("bubbleRadius", 10);
  accentColor.value = await s.get<string>("accentColor", "");
  pingHighlightColor.value = await s.get<string>("pingHighlightColor", "");
  messageFontSize.value = await num("messageFontSize", 15);
  compactMode.value = await bool("compactMode", false);
  showTimestamps.value = await bool("showTimestamps", true);
  notificationPromptDismissed.value = await bool("notificationPromptDismissed", false);
  showEditedIndicator.value = await bool("showEdited", true);
  maxInlineImageWidth.value = await num("maxInlineImageWidth", 400);
  useSystemEmojis.value = await bool("useSystemEmojis", false);
  micThreshold.value = await num("micThreshold", 30);
  voiceVideoRes.value = await num("vcRes", 720);
  voiceVideoFps.value = await num("vcFps", 30);
  serverNotifSettings.value = await s.get<Record<string, NotificationLevel>>(
    "serverNotifSettings",
    {}
  );
  channelNotifSettings.value = await s.get<Record<string, NotificationLevel>>(
    "channelNotifSettings",
    {}
  );
  offlinePushServers.value = await s.get<Record<string, boolean>>("offlinePushSettings", {});
  autoIdleOnUnfocus.value = await bool("autoIdleOnUnfocus", true);
  savedStatusText.value = await s.get<string | undefined>("savedStatusText", undefined);

  markSettingsLoaded();
}

persistJsonSignal("recentEmojis", () => recentEmojis.value);
persistSimpleSignal("sendTypingIndicators", () => sendTypingIndicators.value);
persistSimpleSignal("dmMessageSound", () => dmMessageSound.value);
persistSimpleSignal("pingSound", () => pingSound.value);
persistSimpleSignal(
  "pingVolume",
  () => pingVolume.value,
  (v) => String(v)
);
persistNullableSignal(
  "customPingSound",
  () => customPingSound.value,
  (v) => v
);
persistSimpleSignal("blockedMessageDisplay", () => blockedMessageDisplay.value);
persistSimpleSignal(
  "theme",
  () => appTheme.value,
  (v) => {
    applyTheme(v);
  }
);
persistSimpleSignal(
  "font",
  () => appFont.value,
  (v) => {
    applyFont(v);
  }
);
persistSimpleSignal(
  "avatarShape",
  () => avatarShape.value,
  (v) => {
    applyAvatarShape(v);
  }
);
persistSimpleSignal(
  "bubbleRadius",
  () => bubbleRadius.value,
  (v) => {
    applyBubbleRadius(v);
  }
);
persistSimpleSignal(
  "accentColor",
  () => accentColor.value,
  (v) => {
    applyAccentColor(v);
  }
);
persistSimpleSignal(
  "pingHighlightColor",
  () => pingHighlightColor.value,
  (v) => {
    applyPingHighlightColor(v);
  }
);
persistSimpleSignal(
  "messageFontSize",
  () => messageFontSize.value,
  (v) => {
    applyMessageFontSize(v);
  }
);
persistSimpleSignal(
  "compactMode",
  () => compactMode.value,
  (v) => {
    applyCompactMode(v);
  }
);
persistSimpleSignal(
  "showTimestamps",
  () => showTimestamps.value,
  (v) => {
    document.body.classList.toggle("hide-timestamps", !v);
  }
);
persistSimpleSignal("notificationPromptDismissed", () => notificationPromptDismissed.value);
persistSimpleSignal(
  "showEdited",
  () => showEditedIndicator.value,
  (v) => {
    document.body.classList.toggle("hide-edited-indicator", !v);
  }
);
persistSimpleSignal(
  "maxInlineImageWidth",
  () => maxInlineImageWidth.value,
  (v) => {
    applyMaxImageWidth(v);
  }
);
persistSimpleSignal("useSystemEmojis", () => useSystemEmojis.value);
persistSimpleSignal(
  "hideScrollbars",
  () => hideScrollbars.value,
  (v) => {
    document.body.classList.toggle("hide-scrollbars", v);
  }
);
persistSimpleSignal(
  "hideAvatarBorders",
  () => hideAvatarBorders.value,
  (v) => {
    document.body.classList.toggle("hide-avatar-borders", v);
  }
);
persistSimpleSignal(
  "reduceMotion",
  () => reduceMotion.value,
  (v) => {
    document.body.classList.toggle("reduce-motion", v);
  }
);
persistSimpleSignal("micThreshold", () => micThreshold.value);
persistSimpleSignal("vcRes", () => voiceVideoRes.value);
persistSimpleSignal("vcFps", () => voiceVideoFps.value);
persistJsonSignal("serverNotifSettings", () => serverNotifSettings.value);
persistJsonSignal("channelNotifSettings", () => channelNotifSettings.value);
persistJsonSignal("offlinePushSettings", () => offlinePushServers.value);
persistSimpleSignal("autoIdleOnUnfocus", () => autoIdleOnUnfocus.value);
persistNullableSignal(
  "savedStatusText",
  () => savedStatusText.value,
  (v) => v
);

export type EmbedType =
  | "youtube"
  | "tenor"
  | "github_user"
  | "github_org"
  | "github_repo"
  | "github_commit"
  | "video"
  | "image"
  | "gift"
  | "wikipedia"
  | "spotify"
  | "steam"
  | "mistwarp"
  | "unknown";

export interface EmbedInfo {
  type: EmbedType;
  url: string;
  videoId?: string;
  tenorId?: string;
  giftCode?: string;
  owner?: string;
  repo?: string;
  sha?: string;
  path?: string;
  articleTitle?: string;
  wikiLang?: string;
  spotifyUrl?: string;
  steamAppId?: string;
  mistWarpId?: string;
}

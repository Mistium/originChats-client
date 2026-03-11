export * from "./types";
export * from "./utils";
export { YouTubeEmbed } from "./youtube";
export { TenorEmbed } from "./tenor";
export { GitHubUserEmbed } from "./github-user";
export { GitHubRepoEmbed } from "./github-repo";
export { GitHubCommitEmbed } from "./github-commit";
export { VideoEmbed } from "./video";
export { ImageEmbed } from "./image";
export { GiftEmbed } from "./gift";
export { WikipediaEmbed } from "./wikipedia";
export { SpotifyEmbed } from "./spotify";
export { SteamEmbed } from "./steam";
export { MistWarpEmbed } from "./mistwarp";

import { type EmbedInfo } from "./types";
import { YouTubeEmbed } from "./youtube";
import { TenorEmbed } from "./tenor";
import { GitHubUserEmbed } from "./github-user";
import { GitHubRepoEmbed } from "./github-repo";
import { GitHubCommitEmbed } from "./github-commit";
import { VideoEmbed } from "./video";
import { ImageEmbed } from "./image";
import { GiftEmbed } from "./gift";
import { WikipediaEmbed } from "./wikipedia";
import { SpotifyEmbed } from "./spotify";
import { SteamEmbed } from "./steam";
import { MistWarpEmbed } from "./mistwarp";

interface EmbedProps {
  info: EmbedInfo;
}

export function Embed({ info }: EmbedProps) {
  switch (info.type) {
    case "youtube":
      return <YouTubeEmbed videoId={info.videoId!} originalUrl={info.url} />;
    case "tenor":
      return <TenorEmbed tenorId={info.tenorId!} originalUrl={info.url} />;
    case "github_user":
      return <GitHubUserEmbed username={info.path!} originalUrl={info.url} />;
    case "github_repo": {
      const pathMatch = info.path!.match(/^([^/]+)\/([^/]+)$/);
      if (pathMatch) {
        return (
          <GitHubRepoEmbed
            owner={pathMatch[1]}
            repo={pathMatch[2]}
            originalUrl={info.url}
          />
        );
      }
      return <GitHubUserEmbed username={info.path!} originalUrl={info.url} />;
    }
    case "github_commit":
      return (
        <GitHubCommitEmbed
          owner={info.owner!}
          repo={info.repo!}
          sha={info.sha!}
          originalUrl={info.url}
        />
      );
    case "video":
      return <VideoEmbed url={info.url} />;
    case "image":
      return <ImageEmbed url={info.url} />;
    case "gift":
      return <GiftEmbed giftCode={info.giftCode!} originalUrl={info.url} />;
    case "wikipedia":
      return (
        <WikipediaEmbed
          articleTitle={info.articleTitle!}
          lang={info.wikiLang!}
          originalUrl={info.url}
        />
      );
    case "spotify":
      return (
        <SpotifyEmbed spotifyUrl={info.spotifyUrl!} originalUrl={info.url} />
      );
    case "steam":
      return <SteamEmbed appId={info.steamAppId!} originalUrl={info.url} />;
    case "mistwarp":
      return (
        <MistWarpEmbed projectId={info.mistWarpId!} originalUrl={info.url} />
      );
    default:
      return (
        <a href={info.url} target="_blank" rel="noopener noreferrer">
          {info.url}
        </a>
      );
  }
}

import { useSignalEffect } from "@preact/signals";
import { banners, dismissBanner, type Banner } from "../../lib/ui-signals";
import { serverUrl } from "../../state";
import { Icon } from "../Icon";

function BannerItem({ banner }: { banner: Banner }) {
  const iconName =
    banner.kind === "error" ? "AlertCircle" : banner.kind === "warning" ? "AlertTriangle" : "Info";

  return (
    <div class={`error-banner active error-banner--${banner.kind}`}>
      <Icon name={iconName as any} size={18} />
      <span>{banner.message}</span>
      {banner.action && (
        <button
          class="error-banner-action"
          onClick={() => {
            banner.action!.fn();
          }}
        >
          {banner.action.label}
        </button>
      )}
      <button class="error-close" onClick={() => dismissBanner(banner.id)} aria-label="Dismiss">
        <Icon name="X" size={16} />
      </button>
    </div>
  );
}

export function ErrorBannerStack() {
  // Subscribe to banner signal changes
  useSignalEffect(() => {
    banners.value;
    serverUrl.value;
  });

  const visibleBanners = banners.value.filter(
    (b) => b.serverUrl === undefined || b.serverUrl === serverUrl.value
  );

  if (visibleBanners.length === 0) return null;

  return (
    <div class="error-banner-stack">
      {visibleBanners.map((b) => (
        <BannerItem key={b.id} banner={b} />
      ))}
    </div>
  );
}

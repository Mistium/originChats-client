import { memo } from "preact/compat";

interface WebhookBadgeProps {
  name: string;
}

function WebhookBadgeInner({ name }: WebhookBadgeProps) {
  return (
    <span className="webhook-badge" title={`Posted by webhook: ${name}`}>
      <svg
        viewBox="0 0 24 24"
        width="12"
        height="12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.72.04-1.09.16-1.66" />
        <path d="M6 7.02h5.99c1.1 0 1.95-.94 2.48-1.9A4 4 0 0 1 22 7c-.01.72-.04 1.09-.16 1.66" />
        <circle cx="12" cy="12" r="3" />
        <path d="M10.5 8.5a3 3 0 0 0 3 0" />
        <path d="M13.5 15.5a3 3 0 0 1-3 0" />
      </svg>
      <span className="webhook-badge-text">WEBHOOK</span>
    </span>
  );
}

export const WebhookBadge = memo(WebhookBadgeInner);

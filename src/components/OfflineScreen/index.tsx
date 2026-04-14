import { h } from "preact";
import { useState } from "preact/hooks";
import { Icon } from "../Icon";

interface OfflineScreenProps {
  onRetry: () => void;
}

export function OfflineScreen({ onRetry }: OfflineScreenProps) {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="offline-screen">
      <div className="offline-content">
        <div className="offline-icon">
          <Icon name="WifiOff" size={48} />
        </div>
        <h1 className="offline-title">You're offline</h1>
        <p className="offline-body">
          OriginChats couldn't connect to the network.
          <br />
          Check your connection and try again.
        </p>
        <button className="offline-retry-btn" onClick={handleRetry} disabled={retrying}>
          {retrying ? (
            <>
              <Icon name="Loader" size={16} />
              Connecting...
            </>
          ) : (
            <>
              <Icon name="RefreshCw" size={16} />
              Try to connect
            </>
          )}
        </button>
      </div>
    </div>
  );
}

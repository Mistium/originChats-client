import { signal, computed } from "@preact/signals";

type ChannelKey = string;

export class UnreadState {
  readonly pings = signal<Record<ChannelKey, number>>({});
  readonly unreads = signal<Record<ChannelKey, number>>({});

  private makeKey(serverUrl: string, channel: string): ChannelKey {
    return `${serverUrl}:${channel}`;
  }

  getServerPingCount(serverUrl: string): number {
    const prefix = `${serverUrl}:`;
    return Object.entries(this.pings.value)
      .filter(([key]) => key.startsWith(prefix))
      .reduce((sum, [, count]) => sum + count, 0);
  }

  getServerUnreadCount(serverUrl: string): number {
    const prefix = `${serverUrl}:`;
    return Object.entries(this.unreads.value)
      .filter(([key]) => key.startsWith(prefix))
      .reduce((sum, [, count]) => sum + count, 0);
  }

  getChannelPingCount(serverUrl: string, channel: string): number {
    return this.pings.value[this.makeKey(serverUrl, channel)] || 0;
  }

  getChannelUnreadCount(serverUrl: string, channel: string): number {
    return this.unreads.value[this.makeKey(serverUrl, channel)] || 0;
  }

  increment(serverUrl: string, channel: string, isPing: boolean): void {
    const key = this.makeKey(serverUrl, channel);
    const target = isPing ? this.pings : this.unreads;
    target.value = {
      ...target.value,
      [key]: (target.value[key] || 0) + 1,
    };
  }

  decrement(serverUrl: string, channel: string, isPing: boolean): void {
    const key = this.makeKey(serverUrl, channel);
    const target = isPing ? this.pings : this.unreads;
    if (target.value[key] !== undefined && target.value[key] > 1) {
      target.value = { ...target.value, [key]: target.value[key] - 1 };
    } else if (target.value[key] !== undefined) {
      const next = { ...target.value };
      delete next[key];
      target.value = next;
    }
  }

  clearChannel(serverUrl: string, channel: string): void {
    const key = this.makeKey(serverUrl, channel);
    this.clearKey(key);
  }

  clearThread(serverUrl: string, threadId: string): void {
    const key = `${serverUrl}:thread:${threadId}`;
    this.clearKey(key);
  }

  private clearKey(key: ChannelKey): void {
    if (this.pings.value[key] !== undefined) {
      const next = { ...this.pings.value };
      delete next[key];
      this.pings.value = next;
    }
    if (this.unreads.value[key] !== undefined) {
      const next = { ...this.unreads.value };
      delete next[key];
      this.unreads.value = next;
    }
  }

  clearServer(serverUrl: string): void {
    const prefix = `${serverUrl}:`;
    this.pings.value = this.filterByPrefix(this.pings.value, prefix, true);
    this.unreads.value = this.filterByPrefix(this.unreads.value, prefix, true);
  }

  clearAllForServer(serverUrl: string): void {
    this.clearServer(serverUrl);
  }

  totalPings(): number {
    return Object.values(this.pings.value).reduce((sum, n) => sum + n, 0);
  }

  totalUnreads(): number {
    return Object.values(this.unreads.value).reduce((sum, n) => sum + n, 0);
  }

  private filterByPrefix(
    obj: Record<ChannelKey, number>,
    prefix: string,
    exclude: boolean,
  ): Record<ChannelKey, number> {
    return Object.fromEntries(
      Object.entries(obj).filter(([key]) =>
        exclude ? !key.startsWith(prefix) : key.startsWith(prefix),
      ),
    );
  }
}

export const unreadState = new UnreadState();

export const totalPings = computed(() => unreadState.totalPings());
export const totalUnreads = computed(() => unreadState.totalUnreads());

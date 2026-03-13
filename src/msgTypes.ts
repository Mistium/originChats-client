import type { Channel, Message, ServerUser } from "./types";

interface UserConnect {
  cmd: "user_connect";
  user: ServerUser;
}

interface UserDisconnect {
  cmd: "user_disconnect";
  user: string;
}

interface Ping {
  cmd: "ping";
}

interface ChannelsGet {
  cmd: "channels_get";
  channels: Channel[];
}

interface MessagesGet {
  cmd: "messages_get";
  channel: string;
  messages: Message[];
  range: {
    start: number;
    end: number;
  };
}

interface MessageGet {
  cmd: "message_get";
  channel: string;
  message: Message;
}

interface MessageNew {
  cmd: "message_new";
  channel: string;
  message: Message;
}

interface MessageEdit {
  cmd: "message_edit";
  id: string;
  content: string;
  message: Message;
  channel: string;
}

interface MessageDelete {
  cmd: "message_delete";
  id: string;
  channel: string;
}

interface MessagePin {
  cmd: "message_pin";
  id: string;
  channel: string;
}

interface MessageUnpin {
  cmd: "message_unpin";
  id: string;
  channel: string;
}

interface Typing {
  cmd: "typing";
  channel: string;
  user: string;
}

export type {
  UserConnect,
  UserDisconnect,
  Ping,
  ChannelsGet,
  MessagesGet,
  MessageGet,
  MessageNew,
  MessageEdit,
  MessageDelete,
  MessagePin,
  MessageUnpin,
  Typing,
};

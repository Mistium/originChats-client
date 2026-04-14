import type {
  WebhookCreate,
  WebhookList,
  WebhookGet,
  WebhookUpdate,
  WebhookRegenerate,
  WebhookDelete,
} from "@/msgTypes";
import { webhooksByServer, webhooksLoading } from "../../ui-signals";
import { showInfo, showError } from "../../ui-signals";

export function handleWebhookCreate(msg: WebhookCreate, sUrl: string): void {
  if (msg.webhook) {
    const currentWebhooks = webhooksByServer.value[sUrl] || [];
    webhooksByServer.value = {
      ...webhooksByServer.value,
      [sUrl]: [...currentWebhooks, msg.webhook],
    };
    if (msg.webhook.token) {
      showInfo(`Webhook "${msg.webhook.name}" created. Token: ${msg.webhook.token}`);
    }
  } else {
    showError(msg.val || "Failed to create webhook");
  }
}

export function handleWebhookList(msg: WebhookList, sUrl: string): void {
  webhooksByServer.value = {
    ...webhooksByServer.value,
    [sUrl]: msg.webhooks || [],
  };
  webhooksLoading.value = { ...webhooksLoading.value, [sUrl]: false };
}

export function handleWebhookGet(msg: WebhookGet, sUrl: string): void {
  if (msg.webhook) {
    const currentWebhooks = webhooksByServer.value[sUrl] || [];
    const idx = currentWebhooks.findIndex((w) => w.id === msg.webhook.id);
    if (idx !== -1) {
      const updatedList = [...currentWebhooks];
      updatedList[idx] = msg.webhook;
      webhooksByServer.value = {
        ...webhooksByServer.value,
        [sUrl]: updatedList,
      };
    } else {
      webhooksByServer.value = {
        ...webhooksByServer.value,
        [sUrl]: [...currentWebhooks, msg.webhook],
      };
    }
  }
}

export function handleWebhookUpdate(msg: WebhookUpdate, sUrl: string): void {
  const currentWebhooks = webhooksByServer.value[sUrl] || [];
  const idx = currentWebhooks.findIndex((w) => w.id === msg.webhook.id);
  if (idx !== -1 && msg.webhook) {
    const updatedList = [...currentWebhooks];
    updatedList[idx] = msg.webhook;
    webhooksByServer.value = {
      ...webhooksByServer.value,
      [sUrl]: updatedList,
    };
  } else if (msg.updated === false) {
    showError(msg.val || "Failed to update webhook");
  }
}

export function handleWebhookRegenerate(msg: WebhookRegenerate, sUrl: string): void {
  const currentWebhooks = webhooksByServer.value[sUrl] || [];
  const idx = currentWebhooks.findIndex((w) => w.id === msg.webhook.id);
  if (idx !== -1 && msg.webhook) {
    const updatedList = [...currentWebhooks];
    updatedList[idx] = msg.webhook;
    webhooksByServer.value = {
      ...webhooksByServer.value,
      [sUrl]: updatedList,
    };
    if (msg.webhook.token) {
      showInfo(`Webhook token regenerated. New token: ${msg.webhook.token}`);
    }
  } else if ((msg as any).updated === false) {
    showError((msg as any).val || "Failed to regenerate webhook token");
  }
}

export function handleWebhookDelete(msg: WebhookDelete, sUrl: string): void {
  const currentWebhooks = webhooksByServer.value[sUrl] || [];
  if (msg.deleted) {
    webhooksByServer.value = {
      ...webhooksByServer.value,
      [sUrl]: currentWebhooks.filter((w) => w.id !== msg.id),
    };
    showInfo("Webhook deleted successfully");
  } else {
    showError(msg.val || "Failed to delete webhook");
  }
}

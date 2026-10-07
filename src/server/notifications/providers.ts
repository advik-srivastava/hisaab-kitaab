import { PlatformError } from "../platform/errors";

export interface OutboundNotification {
  recipient: string;
  subject: string;
  message: string;
  transactionId?: string;
  batchId?: string;
}

export interface OutboundNotificationProvider {
  send(notification: OutboundNotification): Promise<{ providerMessageId: string }>;
  health(): Promise<"healthy" | "unavailable">;
}

abstract class ConfigurationRequiredNotificationProvider implements OutboundNotificationProvider {
  constructor(private readonly providerName: string) {}
  async send(_notification: OutboundNotification): Promise<never> {
    void _notification;
    throw new PlatformError(
      "CONFIGURATION_REQUIRED",
      `${this.providerName.toUpperCase()} NOTIFICATION CONFIGURATION REQUIRED.`,
      503,
    );
  }
  async health(): Promise<"unavailable"> { return "unavailable"; }
}

export class EmailNotificationProvider extends ConfigurationRequiredNotificationProvider {
  constructor() { super("Email"); }
}

export class TeamsNotificationProvider extends ConfigurationRequiredNotificationProvider {
  constructor() { super("Teams"); }
}

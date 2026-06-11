/**
 * Assistant AI - Library to integrate an AI assistant chat into any web application
 *
 * @module assistant-ia
 */

import { Notification, type NotificationType, type NotificationOptions } from "./core/Notification";
import {
  FloatingButton,
  type FloatingButtonOptions,
  type FloatingButtonPosition,
  type ButtonSize,
} from "./components/FloatingButton";
import { Chat, type ChatOptions, type ChatTheme, type ChatPosition } from "./components/Chat";
import { createAssistant, type Assistant, type AssistantOptions } from "./core/Assistant";

export type {
  NotificationType,
  NotificationOptions,
  FloatingButtonOptions,
  FloatingButtonPosition,
  ButtonSize,
  ChatOptions,
  ChatTheme,
  ChatPosition,
  Assistant,
  AssistantOptions,
};

export {
  Notification,
  FloatingButton,
  Chat,
  createAssistant,
};

// Export public API for direct use
export default createAssistant;

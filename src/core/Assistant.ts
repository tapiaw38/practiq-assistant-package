import { Chat, type ChatOptions, type ChatTheme, type ChatPosition } from "../components/Chat";
import {
  FloatingButton,
  type FloatingButtonOptions,
  type FloatingButtonPosition,
  type ButtonSize,
} from "../components/FloatingButton";

/**
 * Configuration options for the assistant
 */
export interface AssistantOptions {
  /** Required API Base URL for authentication */
  apiBaseUrl: string;
  /** Practiq endpoint that wraps Gillie into structured Copilot blocks. */
  copilotBaseUrl?: string;
  /** Session token for proxy-based authentication */
  authToken?: string;
  /** Direct API key for upstream authentication */
  apiKey?: string;
  /** Authentication strategy used in requests */
  authMode?: "bearer" | "x-api-key";
  /** Title of the chat window */
  title?: string;
  /** Placeholder text for the text area */
  placeholder?: string;
  /** Position of the button and chat window */
  position?: ChatPosition;
  /** Initial message from the assistant */
  initialMessage?: string;
  /** Whether to search for images in the context */
  searchImages?: boolean; // experimental feature, your search may go slower
  /** Enable audio responses (replaces text with audio player) */
  audioAnswers?: boolean;
  /** Enable recording and sending audio messages */
  audioInput?: boolean;
  /** Contextual actions rendered above input. */
  quickActions?: Array<{ label: string; prompt: string }>;
  /** Specific options for the floating button */
  buttonOptions?: {
    /** Background color of the button */
    backgroundColor?: string;
    /** Color of the icon/text */
    color?: string;
    /** Content of the button (icon or text) */
    icon?: string;
    /** Avatar image for the floating button */
    avatarUrl?: string;
    /** Size of the button */
    size?: ButtonSize;
    /** Selector of the container where to mount the button */
    container?: HTMLElement | string;
  };
  /** Theme options for the chat */
  theme?: ChatTheme;
  /** Selector of the container where to mount the chat */
  container?: HTMLElement | string;
  /** Whether to show the chat automatically on startup */
  autoOpen?: boolean;
  /** Desktop focused layout while assistant chat is open. Enabled by default. */
  desktopFocus?: boolean;
  /** Optional host root to compress. Defaults to #app, #root, then main. */
  desktopFocusTarget?: HTMLElement | string;
  /** Stable host-provided user/session id used to persist a conversation safely */
  conversationStorageKey?: string;
  /** Optional hook to attach a current canvas/image to the next message */
  getImageAttachment?: () =>
    | Promise<{
        dataUrl: string;
        filename?: string;
        contentType?: string;
      } | null>
    | {
        dataUrl: string;
        filename?: string;
        contentType?: string;
      }
    | null;
  /** Optional host-provided statement audio for Gillie's voice channel. */
  getMediaAttachments?: () =>
    | Array<{
        dataUrl: string;
        filename?: string;
        contentType?: string;
        field: "voice_content";
      }>
    | Promise<Array<{
        dataUrl: string;
        filename?: string;
        contentType?: string;
        field: "voice_content";
      }>>;
  /** Optional hook to collect structured page/exercise context from the host app */
  getStructuredContext?: () =>
    | Promise<Record<string, unknown> | null>
    | Record<string, unknown>
    | null;
  /** Host-agnostic visibility policy. Use stable logical view names, not URLs. */
  visibility?: {
    includeViews?: string[];
    excludeViews?: string[];
    getCurrentView: () => string | undefined | null;
  };
}

/**
 * Assistant interface
 */
export interface Assistant {
  /** Show the chat */
  open: () => void;
  /** Hide the chat */
  close: () => void;
  /** Toggle between showing/hiding the chat */
  toggle: () => void;
  /** Unmount the assistant (button and chat) */
  unmount: () => void;
  /** Check if the chat is open */
  isOpen: () => boolean;
  /** Hide the floating button */
  hideButton: () => void;
  /** Show the floating button */
  showButton: () => void;
  /** Force the next message to rebuild page context */
  refreshContext: () => void;
  /** Reset current conversation state and clear rendered messages */
  resetConversation: () => void;
  /** Re-evaluate configured view visibility after host navigation. */
  refreshVisibility: () => void;
  /** Open chat and send a quick action with current context. */
  prompt: (message: string) => Promise<void>;
}

/**
 * Creates a complete assistant with floating button and chat
 * @param options Configuration options for the assistant
 * @returns Assistant instance
 */
export function createAssistant(options: AssistantOptions): Assistant {
  const authCredential = options.authToken || options.apiKey;
  const authMode =
    options.authMode || (options.authToken ? "bearer" : "x-api-key");

  if (!authCredential) {
    throw new Error(
      "authToken or apiKey is required to initialize the assistant"
    );
  }
  const credential = authCredential;
  let isVisibleForCurrentView = true;

  function getAuthHeaders(contentType?: string): Record<string, string> {
    const headers: Record<string, string> = {};
    if (contentType) {
      headers["Content-Type"] = contentType;
    }
    if (authMode === "bearer") {
      headers.Authorization = `Bearer ${credential}`;
    } else {
      headers["x-api-key"] = credential;
    }
    return headers;
  }

  async function sendCopilotMessage(message: string): Promise<string | null> {
    if (!options.copilotBaseUrl || !options.getStructuredContext) return null;
    const context = await options.getStructuredContext();
    const active = context?.active_exercise as {
      id?: string;
      student_answer?: string;
      student_answer_raw?: string;
    } | undefined;
    const intent = inferCopilotIntent(message);
    const payload = {
      exercise_id: active?.id || "",
      context_id: active?.id || "",
      question: message,
      intent,
      // Host apps may provide a display-safe answer plus canonical value.
      // Copilot needs the latter to review placements precisely.
      student_answer: active?.student_answer_raw ?? active?.student_answer ?? "",
    };
    const streamResponse = await fetch(`${options.copilotBaseUrl}/stream`, {
      method: "POST", headers: { ...getAuthHeaders("application/json"), Accept: "text/event-stream" }, body: JSON.stringify(payload),
    });
    if (streamResponse.ok && streamResponse.body) {
      const reader = streamResponse.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let result: any = null;
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        const events = buffer.split("\n\n"); buffer = events.pop() || "";
        for (const event of events) {
          const name = event.match(/^event:\s*(.+)$/m)?.[1];
          const raw = event.match(/^data:\s*(.+)$/m)?.[1];
          if (!raw) continue;
          const data = JSON.parse(raw);
          if (name === "status") chat?.setTypingStatus(data.message || "Ana está pensando…");
          if (name === "response") result = data.data;
          if (name === "error") throw new Error(data.message || "Copilot stream failed");
        }
        if (done) break;
      }
      if (Array.isArray(result?.blocks)) return JSON.stringify({ copilot_blocks: result.blocks, suggested_actions: result.suggested_actions || [] });
    }
    const response = await fetch(options.copilotBaseUrl, {
      method: "POST", headers: getAuthHeaders("application/json"), body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`Copilot request failed: ${response.status}`);
    const data = await response.json();
    const blocks = data?.data?.blocks;
    if (!Array.isArray(blocks)) return null;
    return JSON.stringify({ copilot_blocks: blocks, suggested_actions: data?.data?.suggested_actions || [] });
  }

  function inferCopilotIntent(message: string): "hint" | "explanation" | "similar_example" | "review_answer" {
    const normalized = message.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (/(revis|correg|verific|cheque)/.test(normalized)) return "review_answer";
    if (normalized.includes("ejemplo")) return "similar_example";
    if (/(explica|como se hace|paso a paso)/.test(normalized)) return "explanation";
    return "hint";
  }

  function visionInstruction(message: string): string {
    message = `${message}\n\nLa consigna y el trabajo adjuntos son el estado actual. Usa esta imagen para leer la respuesta manuscrita; un campo de respuesta textual vacío no significa que el alumno no respondió. Conserva el hilo pedagógico, pero no reutilices un veredicto sobre una versión anterior del trabajo.`;
    const intent = inferCopilotIntent(message);
    if (intent === "review_answer") {
      return `${message}\n\nInstrucción Practiq: lee consigna y respuesta adjuntas. Si podés determinar el resultado, empieza con “Correcta.” o “Incorrecta.” y una comprobación concreta. Si falta información o la imagen es ilegible, responde “No puedo determinarlo” y explica qué falta. Nunca inventes un veredicto. Máximo 2 líneas. Sin saludo ni ánimo.`;
    }
    if (intent === "hint") {
      return `${message}\n\nInstrucción Practiq: da solo siguiente operación o idea. Máximo 20 palabras. Sin saludo ni pregunta final.`;
    }
    return `${message}\n\nInstrucción Practiq: respuesta directa, breve, sin saludo ni pregunta final.`;
  }

  // Floating button options
  const buttonOptions: FloatingButtonOptions = {
    position: (options.position as FloatingButtonPosition) || "bottom-right",
    backgroundColor: options.buttonOptions?.backgroundColor || "#4a90e2",
    color: options.buttonOptions?.color || "#ffffff",
    icon: options.buttonOptions?.icon || "💬",
    avatarUrl: options.buttonOptions?.avatarUrl,
    size: options.buttonOptions?.size || "medium",
    container: options.buttonOptions?.container || document.body,
  };

  const chatOptions: ChatOptions & { showImagesOption?: boolean } = {
    title: options.title || "Practiq Assistant",
    placeholder: options.placeholder || "Write your message here...",
    position: options.position || "bottom-right",
    initialMessage: options.initialMessage,
    theme: {
      primaryColor:
        options.theme?.primaryColor ||
        options.buttonOptions?.backgroundColor ||
        "#4a90e2",
      textColor: options.theme?.textColor || "#333333",
      backgroundColor: options.theme?.backgroundColor || "#ffffff",
      userMessageBgColor:
        options.theme?.userMessageBgColor ||
        options.theme?.primaryColor ||
        options.buttonOptions?.backgroundColor ||
        "#4a90e2",
      userMessageTextColor: options.theme?.userMessageTextColor || "#ffffff",
      assistantMessageBgColor:
        options.theme?.assistantMessageBgColor || "#f1f1f1",
      assistantMessageTextColor:
        options.theme?.assistantMessageTextColor ||
        options.theme?.textColor ||
        "#333333",
      inputBorderColor: options.theme?.inputBorderColor || "#e0e0e0",
      inputBgColor: options.theme?.inputBgColor || "#ffffff",
      inputTextColor:
        options.theme?.inputTextColor || options.theme?.textColor || "#333333",
    },
    isOpen: options.autoOpen || false,
    showImagesOption: options.searchImages ?? false,
    audioAnswers: options.audioAnswers ?? false,
    audioInput: options.audioInput ?? false,
    quickActions: options.quickActions || [
      { label: "Dame una pista", prompt: "Dame una pista sin decirme la respuesta." },
      { label: "Explicame", prompt: "Explicame paso a paso." },
      { label: "Revisá mi respuesta", prompt: "Revisá mi respuesta y decime cómo mejorarla." },
    ],
    preferencesStorageKey: `practiq-assistant:preferences:${options.conversationStorageKey || "default"}`,
  };

  // Create components
  const button = new FloatingButton(buttonOptions);
  let chat: Chat | null = null;
  let activeContextLabel = "";
  let conversationId: string | null = null;
  let pendingOpen = false;
  let lastContext: string = "";
  let desktopFocusTarget: HTMLElement | null | undefined;

  const resolveDesktopFocusTarget = (): HTMLElement | null => {
    if (typeof desktopFocusTarget !== "undefined") return desktopFocusTarget;
    const configured = options.desktopFocusTarget;
    if (configured instanceof HTMLElement) desktopFocusTarget = configured;
    else if (typeof configured === "string") desktopFocusTarget = document.querySelector(configured) as HTMLElement | null;
    else desktopFocusTarget = document.querySelector("#app, #root, main") as HTMLElement | null;
    return desktopFocusTarget;
  };

  const setDesktopFocus = (enabled: boolean): void => {
    const target = resolveDesktopFocusTarget();
    target?.classList.toggle("practiq-assistant-focus-target--open", enabled);
    if (target) target.classList.add("practiq-assistant-focus-target");
  };

  const conversationStorageKey = options.conversationStorageKey?.trim();
  const conversationStorageName = conversationStorageKey
    ? `practiq-assistant:conversation:${encodeURIComponent(options.apiBaseUrl)}:${conversationStorageKey}`
    : null;

  function readStoredConversationId(): string | null {
    if (!conversationStorageName) return null;
    try {
      return localStorage.getItem(conversationStorageName);
    } catch {
      return null;
    }
  }

  function storeConversationId(id: string) {
    if (!conversationStorageName) return;
    try {
      localStorage.setItem(conversationStorageName, id);
    } catch {
      // Storage is optional: private browsing or quota errors must not block chat.
    }
  }

  function clearStoredConversationId() {
    if (!conversationStorageName) return;
    try {
      localStorage.removeItem(conversationStorageName);
    } catch {
      // Storage is optional.
    }
  }

  function resetContextCache() {
    lastContext = "";
    console.log("[assistant-package] context cache reset");
  }

  // Cache only context successfully delivered to Gillie. Failed requests and
  // Copilot replies must leave it pending for the next Gillie request.
  function markContextDelivered(normalizedContext: string, contextToSend: string) {
    if (contextToSend !== "") lastContext = normalizedContext;
  }

  function resetConversationState() {
    conversationId = null;
    lastContext = "";
    // The badge names an exercise on the screen being left. Keeping it meant
    // the chat opened on the next screen still labelled "E5", pointing at an
    // exercise that is no longer anywhere. The host republishes it whenever
    // there is a current exercise to name.
    activeContextLabel = "";
    chat?.setContextLabel("");
    clearStoredConversationId();
    if (chat && typeof chat["clearMessages"] === "function") {
      chat["clearMessages"]();
    }
    console.log("[assistant-package] conversation state reset");
  }

  const handleRouteChange = () => {
    resetConversationState();
  };

  // Mount components
  button.mount(buttonOptions.container || document.body);
  const refreshVisibility = () => {
    const policy = options.visibility;
    if (!policy) {
      isVisibleForCurrentView = true;
      button.show();
      return;
    }
    const currentView = String(policy.getCurrentView?.() || "");
    const included = policy.includeViews || [];
    const excluded = policy.excludeViews || [];
    const isExcluded = excluded.includes(currentView);
    const isIncluded = included.length === 0 || included.includes(currentView);
    isVisibleForCurrentView = Boolean(currentView) && isIncluded && !isExcluded;
    if (isVisibleForCurrentView) {
      button.show();
      return;
    }
    chat?.close();
    chat?.stopAudio();
    button.restoreFromMobileChat();
    button.hide();
  };
  const syncChatBubble = () => {
    const focused = Boolean(chat?.getIsOpen() && options.desktopFocus !== false && window.innerWidth > 720);
    setDesktopFocus(focused);
    chat?.setDesktopFocus(focused);
    if (!chat?.getIsOpen()) { button.restoreFromMobileChat(); return; }
    if (window.innerWidth > 720) {
      const position = chat.getDesktopChatTopLeft();
      if (position) button.anchorToDesktopChat(position.top, position.left);
      return;
    }
    requestAnimationFrame(() => {
      const sheetTop = chat?.getMobileSheetTop();
      if (typeof sheetTop === "number") button.anchorToMobileChat(sheetTop);
    });
  };
  const onChatToggle = () => syncChatBubble();
  const onAudioState = (event: Event) => button.setSpeaking(!!(event as CustomEvent<{ playing?: boolean }>).detail?.playing);
  const onActiveContext = (event: Event) => {
    activeContextLabel = String((event as CustomEvent<{ label?: string }>).detail?.label || "");
    chat?.setContextLabel(activeContextLabel);
  };
  const trackEyes = (event: PointerEvent) => button.followPointerOccasionally(event);
  window.addEventListener("pointermove", trackEyes);
  window.addEventListener("practiq:assistant:route-change", handleRouteChange);
  window.addEventListener("practiq:assistant:chat-toggle", onChatToggle);
  window.addEventListener("practiq:assistant:chat-resize", syncChatBubble);
  window.addEventListener("practiq:assistant:audio-state", onAudioState);
  window.addEventListener("practiq:assistant:active-context", onActiveContext);
  window.addEventListener("resize", syncChatBubble);

  // Function to process HTML content
  function processHtmlContent(content: string): string {
    // Clean unnecessary escapes
    const cleanContent = content.replace(/\\"/g, '"');

    // Improve image styles
    const processedContent = cleanContent.replace(
      /<img ([^>]*style="[^"]*max-width:[^"]*)"([^>]*)>/g,
      '<img $1; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin: 10px 0;"$2>'
    );

    return processedContent;
  }

  async function appendImageAttachmentIfNeeded(formData: FormData): Promise<void> {
    if (formData.has("image_content") || !options.getImageAttachment) {
      return;
    }

    if (options.getImageAttachment) {
      try {
        const attachment = await options.getImageAttachment();
        if (attachment?.dataUrl) {
          console.log("[assistant-package] attaching image to message", {
            filename: attachment.filename || "canvas.png",
            contentType: attachment.contentType || "image/png",
            dataUrlPrefix: attachment.dataUrl.slice(0, 32),
            dataUrlLength: attachment.dataUrl.length,
          });
          const blob = dataUrlToBlob(
            attachment.dataUrl,
            attachment.contentType || "image/png"
          );
          formData.append(
            "image_content",
            blob,
            attachment.filename || "canvas.png"
          );
        } else {
          console.log("[assistant-package] no image attachment returned");
        }
      } catch (error) {
        console.error("Error getting image attachment:", error);
      }
    }
  }

  async function appendMediaAttachmentsIfNeeded(formData: FormData): Promise<void> {
    if (!options.getMediaAttachments) return;
    const instruction = "El primer audio adjunto pertenece al enunciado del docente. Escúchalo como parte del ejercicio, no como una consulta del alumno.";
    if (String(formData.get("context") || "").includes(instruction)) return;
    try {
      const attachments = await options.getMediaAttachments();
      for (const attachment of attachments) {
        if (!attachment?.dataUrl || attachment.field !== "voice_content") continue;
        // Preserve a student's recorded question too. Put statement audio
        // first so Gillie can identify it from the context instruction.
        const existingVoice = formData.getAll("voice_content");
        formData.delete("voice_content");
        formData.append(
          "voice_content",
          dataUrlToBlob(attachment.dataUrl, attachment.contentType || "audio/mpeg"),
          attachment.filename || "statement-audio.mp3",
        );
        for (const voice of existingVoice) formData.append("voice_content", voice);
        const context = String(formData.get("context") || "").trim();
        formData.set("context", context ? `${context}\n\n${instruction}` : instruction);
      }
    } catch (error) {
      console.error("Error getting statement media attachments:", error);
    }
  }

  async function buildMessageFormData(message: string, contextToSend: string): Promise<FormData> {
    const formData = new FormData();
    if (contextToSend) {
      formData.set("context", contextToSend);
    }

    await appendImageAttachmentIfNeeded(formData);
    await appendMediaAttachmentsIfNeeded(formData);
    formData.set("content", message.trim());

    console.log("[assistant-package] form data prepared", {
      hasContext: formData.has("context"),
      hasImageContent: formData.has("image_content"),
      contentLength: String(formData.get("content") || "").length,
    });

    return formData;
  }

  function dataUrlToBlob(dataUrl: string, fallbackType: string): Blob {
    const parts = dataUrl.split(",", 2);
    if (parts.length !== 2) {
      return new Blob([], { type: fallbackType });
    }

    const meta = parts[0];
    const data = parts[1];
    const mimeMatch = meta.match(/^data:(.*?)(;base64)?$/);
    const contentType = mimeMatch?.[1] || fallbackType;
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: contentType });
  }

  function collectPageContext(): string {
    const mainContent = document.querySelector(
      'main, article, .content, #content, [role="main"]'
    ) as HTMLElement | null;

    const root = (mainContent
      ? mainContent.cloneNode(true)
      : document.body.cloneNode(true)) as HTMLElement;

    const elementsToRemove = root.querySelectorAll(
      [
        "nav",
        "header",
        "footer",
        "script",
        "style",
        "aside",
        "button",
        "input",
        "textarea",
        "select",
        "option",
        "[role='button']",
        "[aria-hidden='true']",
        "[hidden]",
        ".sidebar",
        ".navigation",
        ".menu",
        ".ads",
        ".cookie-banner",
        ".drawer-backdrop",
        ".mobile-topbar",
        ".topbar-btn",
        ".close-btn",
        ".logout-btn",
        ".icon-btn",
        ".btn",
        ".btn-primary",
        ".btn-secondary",
        ".btn-ghost",
        ".btn-danger",
        ".submit-btn",
        ".ghost-btn",
        ".text-link",
        ".feature-list",
        ".feature-pill",
        ".card-footer",
        ".auth-divider",
        ".section-head",
        ".section-header",
        ".welcome-actions",
        ".progress-bar",
        ".dashboard-mascot",
        ".ai-review-box",
        ".ai-review-head",
        ".ai-review-badge",
        ".ai-review-text",
        ".results-ai-feedback",
        ".result-ai-feedback",
        ".results-box",
        ".level-up-badge",
        ".left-brand",
        ".left-preview",
      ].join(", ")
    );
    elementsToRemove.forEach((el) => el.remove());

    return root.innerText || "";
  }

  function sanitizeContext(rawContext: string): string {
    const noisyLinePatterns = [
      /^inicio$/i,
      /^mis cursos$/i,
      /^usuarios$/i,
      /^acad[eé]mico$/i,
      /^estudiante$/i,
      /^profesor(?: admin)?$/i,
      /^pr[aá]cticas$/i,
      /^cuadernos$/i,
      /^prueba de nivel$/i,
      /^sin contenido a[uú]n$/i,
      /^no hay cursos$/i,
      /^continuar pr[aá]ctica$/i,
      /^practicar con mi copiloto$/i,
      /^guardar$/i,
      /^cancelar$/i,
      /^volver$/i,
      /^correcto$/i,
      /^incorrecto$/i,
      /^asistente:\s*correcto$/i,
      /^asistente:\s*incorrecto$/i,
      /^sin observaciones de ia$/i,
      /^cerrar sesi[oó]n$/i,
      /^crear cuenta$/i,
      /^iniciar sesi[oó]n$/i,
      /^recuperar contrase[nñ]a$/i,
      /^completar acceso$/i,
      /^en curso$/i,
      /^nivel \d+$/i,
      /^\d+%\s+de dominio$/i,
      /^\d+\/\d+\s+aciertos$/i,
      /^\d+\s+pr[aá]cticas disponibles$/i,
    ];

    const cleanedLines = rawContext
      .replace(/\u00a0/g, " ")
      .replace(/\r/g, "\n")
      .replace(/\t/g, " ")
      .replace(/[ ]{2,}/g, " ")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .filter((line, index, lines) => {
        if (noisyLinePatterns.some((pattern) => pattern.test(line))) {
          return false;
        }
        if (line.length <= 2) {
          return false;
        }
        if (/^(pi-|menu|home|lock|logout)$/i.test(line)) {
          return false;
        }
        if (/^(gillie|asistente):/i.test(line)) {
          return false;
        }
        if (/respuesta (evaluada )?como (correcta|incorrecta)/i.test(line)) {
          return false;
        }
        if (/^\d+\s*[+\-*/]\s*\d+\s+es\s+\d+/i.test(line)) {
          return false;
        }
        if (index > 0 && lines[index - 1].trim() === line) {
          return false;
        }
        return true;
      });

    return cleanedLines.join("\n").replace(/\n{3,}/g, "\n\n").trim().substring(0, 8000);
  }

  function normalizeStructuredContextValue(value: unknown): unknown {
    if (value == null) {
      return null;
    }
    if (typeof value === "string") {
      return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return value;
    }
    if (Array.isArray(value)) {
      return value
        .map((item) => normalizeStructuredContextValue(item))
        .filter((item) => item !== null && item !== "");
    }
    if (typeof value === "object") {
      const normalizedEntries = Object.entries(value as Record<string, unknown>)
        .map(([key, nestedValue]) => [key, normalizeStructuredContextValue(nestedValue)] as const)
        .filter(([, nestedValue]) => {
          if (nestedValue == null) return false;
          if (nestedValue === "") return false;
          if (Array.isArray(nestedValue) && nestedValue.length === 0) return false;
          if (
            typeof nestedValue === "object" &&
            !Array.isArray(nestedValue) &&
            Object.keys(nestedValue as Record<string, unknown>).length === 0
          ) {
            return false;
          }
          return true;
        });

      return Object.fromEntries(normalizedEntries);
    }
    return String(value);
  }

  async function collectStructuredContextText(): Promise<string> {
    if (!options.getStructuredContext) {
      return "";
    }

    try {
      const rawStructuredContext = await options.getStructuredContext();
      if (!rawStructuredContext) {
        console.log("[assistant-package] no structured context returned");
        return "";
      }

      const normalizedStructuredContext = normalizeStructuredContextValue(
        rawStructuredContext
      ) as Record<string, unknown> | null;

      if (
        !normalizedStructuredContext ||
        Object.keys(normalizedStructuredContext).length === 0
      ) {
        console.log("[assistant-package] structured context normalized to empty");
        return "";
      }

      const contextForAssistant = JSON.parse(JSON.stringify(normalizedStructuredContext));
      // Canonical answer values are for Practiq's trusted Copilot request only.
      // Do not expose them to Gillie's general conversational context.
      if (contextForAssistant.active_exercise && typeof contextForAssistant.active_exercise === "object") {
        delete contextForAssistant.active_exercise.student_answer_raw;
      }
      const structuredContextText = shrinkStructuredContext(contextForAssistant);

      console.log("[assistant-package] structured context prepared", {
        keys: Object.keys(normalizedStructuredContext),
        characters: structuredContextText.length,
      });

      return structuredContextText;
    } catch (error) {
      console.error("Error getting structured context:", error);
      return "";
    }
  }

  function buildMessageContext(rawContext: string, structuredContextText: string): string {
    const sanitizedContext = sanitizeContext(rawContext);
    const structuredPrefix = "Contexto estructurado de Practiq (fuente confiable):\n";
    const visiblePrefix = "Contexto visible de la página:\n";
    let combinedContext = "";

    if (structuredContextText) {
      // shrinkStructuredContext guarantees this fits inside the structured
      // budget, so this never cuts a JSON document mid-object.
      combinedContext = `${structuredPrefix}${structuredContextText}`;
    }

    if (sanitizedContext) {
      const separator = combinedContext ? "\n\n" : "";
      const remaining = maxMessageContextChars - combinedContext.length - separator.length - visiblePrefix.length;
      if (remaining > 0) {
        combinedContext += `${separator}${visiblePrefix}${sanitizedContext.substring(0, remaining)}`;
      }
    }

    return combinedContext;
  }

  // Function to create conversation with title
  async function createConversation(title: string): Promise<void> {
    const response = await fetch(`${options.apiBaseUrl}/conversation/`, {
      method: "POST",
      mode: "cors",
      headers: getAuthHeaders("application/json"),
      body: JSON.stringify({ title }),
    });
    if (!response.ok) {
      throw new Error(`Error creating conversation: ${response.status}`);
    }
    const data = await response.json();
    conversationId = data.data.id;
    if (conversationId) {
      storeConversationId(conversationId);
    }
  }

  // Function to send FormData message (with audio)
  async function sendFormDataToApi(formData: FormData): Promise<string> {
    // Create conversation if it doesn't exist yet
    if (!conversationId) {
      const content = (formData.get("content") as string) || "";
      const title = content.substring(0, 20) || chatOptions.title || "Nueva conversación";
      await createConversation(title);
    }

    // Get context from FormData or generate it
    let context = (formData.get("context") as string) || "";

    if (context === "") {
      context = collectPageContext();
    }

    const structuredContextText = await collectStructuredContextText();
    const normalizedContext = buildMessageContext(context, structuredContextText);

    // Every turn operates on current work, including hints and explanations.
    // Image bytes can change while structured text stays identical.
    const contextToSend = normalizedContext;

    // Update FormData with processed context
    formData.set("context", contextToSend);
    await appendImageAttachmentIfNeeded(formData);
    await appendMediaAttachmentsIfNeeded(formData);

    const audioAnswers = chat?.getAudioAnswers?.() ?? false;
    const textToVoiceParam = audioAnswers ? "activate" : "deactivate";

    // Get checkbox state and add query parameter
    const showImages =
      chat && chat.getShowImages ? chat.getShowImages() : false;
    const hasImageAttachment = formData.has("image_content");
    // Gillie analyzes image_content independently. This flag enables its
    // document-image search, which must remain an explicit user preference.
    const imageProcessorParam = showImages ? "activate" : "deactivate";

    const url = `${options.apiBaseUrl}/conversation/${conversationId}/message?has_image_processor=${imageProcessorParam}&has_text_to_voice=${textToVoiceParam}`;

    try {
      console.log("[assistant-package] message request flags", {
        showImages,
        hasImageAttachment,
        imageProcessorParam,
        textToVoiceParam,
      });

      const response = await fetch(url, {
        method: "POST",
        mode: "cors",
        headers: getAuthHeaders(),
        body: formData, // Send FormData directly
      });

      if (!response.ok) {
        throw new Error(`Error sending message: ${response.status}`);
      }

      const data = await response.json();
      markContextDelivered(normalizedContext, contextToSend);
      const assistantMsg = data.data
        .reverse()
        .find((msg: any) => msg.sender === "assistant");

      if (assistantMsg) {
        if (audioAnswers && assistantMsg.audio_url) {
          return JSON.stringify({
            content: assistantMsg.content,
            audio_url: assistantMsg.audio_url,
          });
        }

        // Process the content to clean HTML and improve styles
        return processHtmlContent(assistantMsg.content);
      }

      return "No response from the assistant.";
    } catch (error) {
      console.error("Error sending FormData message:", error);
      return "Sorry, there was an error processing your audio message. Please try again.";
    }
  }

  // Function to send message
  async function sendMessageToApi(
    message: string,
    context: string = ""
  ): Promise<string> {
    // Copilot handles text only. Media is resolved below before choosing a
    // transport, because image/audio statements must reach Gillie.
    const audioAnswers = chat?.getAudioAnswers?.() ?? false;
    if (audioAnswers) {
      chat?.setTypingStatus("Generando respuesta con voz…");
    }

    if (context === "") {
      context = collectPageContext();
    }

    const structuredContextText = await collectStructuredContextText();
    const normalizedContext = buildMessageContext(context, structuredContextText);

    const contextToSend = normalizedContext;

    // Get checkbox state and add query parameter
    const showImages =
      chat && chat.getShowImages ? chat.getShowImages() : false;
    const pendingFormData = await buildMessageFormData(message, contextToSend);
    const hasImageAttachment = pendingFormData.has("image_content");
    if (hasImageAttachment) pendingFormData.set("content", visionInstruction(message));
    const hasVoiceAttachment = pendingFormData.has("voice_content");
    const hasMediaAttachment = hasImageAttachment || hasVoiceAttachment;
    // An attached image still goes through Gillie Vision. Do not also trigger
    // document-image search unless the user explicitly enabled it.
    const imageProcessorParam = showImages ? "activate" : "deactivate";

    if (!audioAnswers && !hasMediaAttachment) {
      const copilotResponse = await sendCopilotMessage(message);
      if (copilotResponse) return processHtmlContent(copilotResponse);
    }

    // Create a Gillie conversation only when the message is not handled by
    // Copilot. This includes all statement media.
    if (!conversationId) {
      const title = message.substring(0, 20) || chatOptions.title || "Nueva conversación";
      await createConversation(title);
    }

    // Same preference selected above decides Gillie TTS.
    const textToVoiceParam = audioAnswers ? "activate" : "deactivate";

    const messageEndpoint = hasMediaAttachment ? "message" : "message/text";
    const url = `${options.apiBaseUrl}/conversation/${conversationId}/${messageEndpoint}?has_image_processor=${imageProcessorParam}&has_text_to_voice=${textToVoiceParam}`;

    try {
      console.log("[assistant-package] message request flags", {
        showImages,
        hasImageAttachment,
        hasVoiceAttachment,
        imageProcessorParam,
        textToVoiceParam,
      });

      const response = await fetch(url, {
        method: "POST",
        mode: "cors",
        headers: hasMediaAttachment ? getAuthHeaders() : getAuthHeaders("application/json"),
        body: hasMediaAttachment
          ? pendingFormData
          : JSON.stringify({ content: message.trim(), context: contextToSend }),
      });

      console.log("[assistant-package] message request sent", {
        url,
        mode: hasMediaAttachment ? "multipart" : "json",
      });

      if (!response.ok) {
        throw new Error(`Error sending message: ${response.status}`);
      }

      const data = await response.json();
      markContextDelivered(normalizedContext, contextToSend);
      const assistantMsg = data.data
        .reverse()
        .find((msg: any) => msg.sender === "assistant");

      if (assistantMsg) {
        if (audioAnswers && assistantMsg.audio_url) {
          return JSON.stringify({
            content: assistantMsg.content,
            audio_url: assistantMsg.audio_url,
          });
        }

        // Process the content to clean HTML and improve styles
        return processHtmlContent(assistantMsg.content);
      }

      return "No response from the assistant.";
    } catch (error) {
      console.error("Error sending message:", error);
      return "Sorry, there was an error processing your message. Please try again.";
    }
  }

  // Mount immediately. History is intentionally loaded only when a host adds a
  // dedicated history UI, avoiding a network request before the first message.
  function initConversationAndMountChat() {
      conversationId = readStoredConversationId();
      chat = new Chat({
        ...chatOptions,
        onSend: async (message: string | FormData) => {
          const textarea = document.querySelector(
            ".ia-chat-input"
          ) as HTMLTextAreaElement;

          // Handle FormData (audio messages)
          if (message instanceof FormData) {
            const textContent = String(message.get("content") || "").trim();
            // Resolve host image before choosing transport. Previously this ran
            // inside sendFormDataToApi, after Copilot had already discarded it.
            await appendImageAttachmentIfNeeded(message);
            await appendMediaAttachmentsIfNeeded(message);
            const hasImageAttachment = message.has("image_content");
            const voiceContent = message.get("voice_content");
            // Chat emits text as FormData too. Route text through Practiq Copilot;
            // keep audio and Vision attachments on existing Gillie transport.
            if (textContent && !hasImageAttachment && !(voiceContent instanceof Blob && voiceContent.size > 0)) {
              const response = await sendMessageToApi(textContent);
              textarea.value = "";
              return { content: response, isHtml: response.includes("audio_url") };
            }
            if (textContent && hasImageAttachment) message.set("content", visionInstruction(textContent));
            const response = await sendFormDataToApi(message);
            textarea.value = "";

            // Verify if the response contains HTML or audio_url
            const containsHtml =
              response.includes("<img") ||
              response.includes("<p>") ||
              response.includes("<br>");

            const containsAudio = response.includes("audio_url");

            return {
              content: response,
              isHtml: containsHtml || containsAudio,
            };
          }

          // Handle string messages (text only)
          const trimmedMessage = message.trim();
          if (trimmedMessage) {
            const response = await sendMessageToApi(trimmedMessage);
            textarea.value = "";

            // Verify if the response contains HTML or audio_url
            const containsHtml =
              response.includes("<img") ||
              response.includes("<p>") ||
              response.includes("<br>");

            const containsAudio = response.includes("audio_url");

            return {
              content: response,
              isHtml: containsHtml || containsAudio,
            };
          }
          return {
            content: "Please write a valid message.",
            isHtml: false,
          };
        },
      });
      chat.mount(options.container || document.body);

      // Set the callback for the new conversation button
      chat.setOnNewConversation(async () => {
        resetConversationState();
      });
      chat.setContextLabel(activeContextLabel);
      // If the user tried to open the chat before it was ready, open it now
      if (pendingOpen) {
        chat.open();
        pendingOpen = false;
      }
  }

  // Start the conversation and mount the chat
  initConversationAndMountChat();
  refreshVisibility();

  // Configure interaction
  button.setOnClick(() => {
    if (!isVisibleForCurrentView) return;
    if (chat) {
      chat.toggle();
    } else {
      // If the chat is not yet ready, save the attempt
      pendingOpen = true;
    }
  });

  // Return public API
  return {
    open: () => isVisibleForCurrentView && chat && chat.open(),
    close: () => chat && chat.close(),
    toggle: () => isVisibleForCurrentView && chat && chat.toggle(),
    unmount: () => {
      chat && chat.unmount();
      button.unmount();
      setDesktopFocus(false);
      window.removeEventListener(
        "practiq:assistant:route-change",
        handleRouteChange
      );
      window.removeEventListener("pointermove", trackEyes);
      window.removeEventListener("practiq:assistant:chat-toggle", onChatToggle);
      window.removeEventListener("practiq:assistant:chat-resize", syncChatBubble);
      window.removeEventListener("practiq:assistant:audio-state", onAudioState);
      window.removeEventListener("practiq:assistant:active-context", onActiveContext);
      window.removeEventListener("resize", syncChatBubble);
    },
    isOpen: () => !!(chat && chat["isOpen"]),
    hideButton: () => button.hide(),
    showButton: () => button.show(),
    refreshContext: () => resetContextCache(),
    resetConversation: () => resetConversationState(),
    refreshVisibility,
    prompt: async (message: string) => {
      if (!isVisibleForCurrentView) return;
      if (chat) await chat.sendPrompt(message);
      else pendingOpen = true;
    },
  };
}

/** Bulky, least essential keys, dropped in this order when the context is too big. */
const shrinkableContextKeys = ["exercise_list", "answered_exercise_ids", "metadata_summary"];

const maxMessageContextChars = 4000;
// Keep space for labels and visible-page context. Structured JSON is first,
// therefore this budget must be strict: slicing it later would corrupt it.
const maxStructuredContextChars = 3000;

/**
 * Serializes the structured context without ever exceeding the cap.
 *
 * The previous version did `JSON.stringify(...).substring(0, 4000)`, which cuts
 * mid-object and hands the assistant invalid JSON. It then ignores the context
 * it was told to trust and answers from conversation history instead — which is
 * why it could name the exercise the student selected while explaining the one
 * discussed earlier. Long sheets crossed the cap; short ones did not, so it
 * only failed sometimes.
 *
 * Dropping whole keys keeps the payload parseable. active_exercise is retained
 * whenever it fits; pathological oversized payloads fall back to a marker.
 */
function shrinkStructuredContext(context: Record<string, unknown>): string {
  const shrunk: Record<string, unknown> = { ...context };
  let text = JSON.stringify(shrunk, null, 2);

  for (const key of shrinkableContextKeys) {
    if (text.length <= maxStructuredContextChars) break;
    if (!(key in shrunk)) continue;
    delete shrunk[key];
    text = JSON.stringify(shrunk, null, 2);
  }

  if (text.length > maxStructuredContextChars) {
    // Still too big: keep only what the answer cannot do without. Values are
    // compacted before serializing, never by slicing serialized JSON.
    const essential = {
      current_view: shrunk.current_view,
      activity_type: shrunk.activity_type,
      active_exercise: shrunk.active_exercise,
    };
    for (let stringLimit = 512; stringLimit >= 8; stringLimit = Math.floor(stringLimit / 2)) {
      text = JSON.stringify(compactStructuredValue(essential, stringLimit));
      if (text.length <= maxStructuredContextChars) break;
    }
    if (text.length > maxStructuredContextChars) {
      // Arbitrary host objects can still have thousands of keys. Keep a valid,
      // bounded summary rather than exceeding the budget or corrupting JSON.
      text = JSON.stringify({
        current_view: String(shrunk.current_view ?? "").substring(0, 120),
        activity_type: String(shrunk.activity_type ?? "").substring(0, 120),
        active_exercise: "[contexto resumido por tamaño]",
      });
    }
  }

  return text;
}

function compactStructuredValue(value: unknown, stringLimit: number, depth = 0): unknown {
  if (typeof value === "string") return value.substring(0, stringLimit);
  if (value == null || typeof value !== "object") return value;
  if (depth >= 3) return "[resumido]";
  if (Array.isArray(value)) {
    return value.slice(0, 6).map((item) => compactStructuredValue(item, stringLimit, depth + 1));
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .slice(0, 12)
      .map(([key, nestedValue]) => [key, compactStructuredValue(nestedValue, stringLimit, depth + 1)])
  );
}

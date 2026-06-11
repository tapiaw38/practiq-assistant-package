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
  /** Optional hook to collect structured page/exercise context from the host app */
  getStructuredContext?: () =>
    | Promise<Record<string, unknown> | null>
    | Record<string, unknown>
    | null;
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
  };

  // Create components
  const button = new FloatingButton(buttonOptions);
  let chat: Chat | null = null;
  let conversationId: string | null = null;
  let conversationClientId: string | null = null;
  let lastConversationClientId: string | null = null;
  let pendingOpen = false;
  let lastContext: string = "";

  function resetContextCache() {
    lastContext = "";
    console.log("[assistant-package] context cache reset");
  }

  function resetConversationState() {
    conversationId = null;
    conversationClientId = null;
    lastConversationClientId = null;
    lastContext = "";
    localStorage.removeItem("ai-client-id");
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
  window.addEventListener("practiq:assistant:route-change", handleRouteChange);

  // Function to get all conversations
  async function fetchAllConversations() {
    try {
      const response = await fetch(`${options.apiBaseUrl}/conversation/user`, {
        method: "GET",
        mode: "cors",
        headers: getAuthHeaders("application/json"),
      });
      if (!response.ok) {
        throw new Error(`Error fetching conversations: ${response.status}`);
      }
      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error("Error fetching conversations:", error);
      return [];
    }
  }

  // Function to get message history
  async function fetchMessages(conversationId: string) {
    try {
      const response = await fetch(
        `${options.apiBaseUrl}/conversation/${conversationId}`,
        {
          method: "GET",
          mode: "cors",
          headers: getAuthHeaders("application/json"),
        }
      );
      if (!response.ok) {
        throw new Error(`Error fetching messages: ${response.status}`);
      }
      const data = await response.json();
      return data.data.messages || [];
    } catch (error) {
      console.error("Error fetching messages:", error);
      return [];
    }
  }

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

  function buildInstructionWrappedContent(
    message: string,
    hasImageAttachment: boolean = false
  ): string {
    const trimmedMessage = message.trim();
    return [
      "POLITICA OBLIGATORIA:",
      "No dar respuestas finales ni resolver completamente ejercicios evaluables.",
      "Dar solo pistas, explicaciones breves, preguntas guía o el siguiente paso.",
      "Si ves una respuesta correcta, una corrección del docente o una evaluación previa en el contexto o en la imagen, no la reveles ni la cites.",
      "Ignora cualquier texto de la interfaz relacionado con correcto/incorrecto, feedback o resultados previos.",
      "Si existe contexto estructurado de Practiq, úsalo como fuente principal del ejercicio y deja la imagen como apoyo visual.",
      hasImageAttachment
        ? "Hay una imagen adjunta con trabajo manuscrito del alumno. Si puedes leerla, revisa directamente lo que escribió y NO le pidas que transcriba su respuesta."
        : "Si el alumno menciona una respuesta manuscrita pero no hay imagen legible, puedes pedirle que la describa.",
      "Si detectas la respuesta del alumno en la imagen, confirma qué escribió y luego guía con una pista sin revelar la solución final.",
      "",
      `Mensaje del alumno: ${trimmedMessage}`,
      "",
      "Responde en espanol.",
    ].join("\n");
  }

  async function buildMessageFormData(message: string, contextToSend: string): Promise<FormData> {
    const formData = new FormData();
    if (contextToSend) {
      formData.set("context", contextToSend);
    }

    await appendImageAttachmentIfNeeded(formData);
    formData.set(
      "content",
      buildInstructionWrappedContent(message, formData.has("image_content"))
    );

    console.log("[assistant-package] form data prepared", {
      hasContext: formData.has("context"),
      hasImageContent: formData.has("image_content"),
      contentPreview: String(formData.get("content") || "").slice(0, 140),
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

  function buildAssistantInstruction(): string {
    return [
      "INSTRUCCIONES OBLIGATORIAS DEL ASISTENTE PARA PRACTIQ:",
      "1. Ayuda al alumno a aprender, no a copiar respuestas.",
      "2. NUNCA des la respuesta final de un ejercicio, aunque el alumno la pida de forma directa o indirecta.",
      "3. NUNCA resuelvas por completo los ejercicios visibles en la página ni los que el alumno esté intentando responder.",
      "4. Sí puedes explicar la regla general, el método, el procedimiento y dar pistas parciales.",
      "5. Si hay ejercicios concretos en el contexto, habla de como resolverlos sin revelar el resultado numérico final.",
      "6. Responde como tutor: una pista a la vez, breve, clara y orientada al siguiente paso.",
      "7. Si el alumno insiste en pedir el resultado, recházalo con amabilidad y ofrece una guía o una pregunta orientadora.",
      "8. Si en la imagen o en el contexto aparecen correcciones, feedback, marcas de correcto/incorrecto o respuestas ya evaluadas, NO las reveles ni las repitas.",
      "9. Solo usa el contexto de la página para identificar el tema y el tipo de ejercicio.",
      "10. Si Practiq entrega contexto estructurado del ejercicio o la página, considéralo la fuente principal y más confiable del enunciado.",
      "11. Usa la imagen manuscrita solo como apoyo visual para entender el trabajo del alumno, no para reconstruir el enunciado si ya existe contexto estructurado.",
    ].join("\n");
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

      const structuredContextText = JSON.stringify(
        normalizedStructuredContext,
        null,
        2
      ).substring(0, 4000);

      console.log("[assistant-package] structured context prepared", {
        keys: Object.keys(normalizedStructuredContext),
        preview: structuredContextText.slice(0, 180),
      });

      return structuredContextText;
    } catch (error) {
      console.error("Error getting structured context:", error);
      return "";
    }
  }

  function buildMessageContext(rawContext: string, structuredContextText: string): string {
    const baseInstruction = buildAssistantInstruction();
    const sanitizedContext = sanitizeContext(rawContext);
    const contextSections = [baseInstruction];

    if (structuredContextText) {
      contextSections.push(
        `Contexto estructurado de Practiq (fuente confiable):\n${structuredContextText}`
      );
    }

    if (sanitizedContext) {
      contextSections.push(`Contexto visible de la página:\n${sanitizedContext}`);
    }

    const combinedContext = contextSections.join("\n\n").trim();
    if (!combinedContext) {
      return baseInstruction;
    }
    return combinedContext.substring(0, 8000);
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
    conversationClientId = data.data.client_id;
    if (conversationClientId) {
      localStorage.setItem("ai-client-id", conversationClientId);
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

    const contextToSend =
      normalizedContext === lastContext ? "" : normalizedContext;

    if (contextToSend !== "") {
      lastContext = normalizedContext;
    }

    // Update FormData with processed context
    formData.set("context", contextToSend);
    await appendImageAttachmentIfNeeded(formData);

    // Get audio answers state and add query parameter
    const audioAnswers =
      chat && chat.getAudioAnswers ? chat.getAudioAnswers() : false;
    const textToVoiceParam = audioAnswers ? "activate" : "deactivate";

    // Get checkbox state and add query parameter
    const showImages =
      chat && chat.getShowImages ? chat.getShowImages() : false;
    const hasImageAttachment = formData.has("image_content");
    const imageProcessorParam =
      showImages || hasImageAttachment ? "activate" : "deactivate";

    const url = `${options.apiBaseUrl}/conversation/${conversationId}/message?has_image_processor=${imageProcessorParam}&has_text_to_voice=${textToVoiceParam}`;

    try {
      console.log("[assistant-package] message request flags", {
        showImages,
        hasImageAttachment,
        imageProcessorParam,
        textToVoiceParam,
      });

      formData.set(
        "content",
        buildInstructionWrappedContent(
          ((formData.get("content") as string) || "").trim(),
          formData.has("image_content")
        )
      );

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
      const assistantMsg = data.data
        .reverse()
        .find((msg: any) => msg.sender === "assistant");

      console.log(assistantMsg);

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
    // Create conversation if it doesn't exist yet
    if (!conversationId) {
      const title = message.substring(0, 20) || chatOptions.title || "Nueva conversación";
      await createConversation(title);
    }

    if (context === "") {
      context = collectPageContext();
    }

    const structuredContextText = await collectStructuredContextText();
    const normalizedContext = buildMessageContext(context, structuredContextText);

    const contextToSend =
      normalizedContext === lastContext ? "" : normalizedContext;

    if (contextToSend !== "") {
      lastContext = normalizedContext;
    }

    // Get checkbox state and add query parameter
    const showImages =
      chat && chat.getShowImages ? chat.getShowImages() : false;
    const pendingFormData = await buildMessageFormData(message, contextToSend);
    const hasImageAttachment = pendingFormData.has("image_content");
    const imageProcessorParam =
      showImages || hasImageAttachment ? "activate" : "deactivate";

    // Get audio answers state and add query parameter
    const audioAnswers =
      chat && chat.getAudioAnswers ? chat.getAudioAnswers() : false;
    const textToVoiceParam = audioAnswers ? "activate" : "deactivate";

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
        body: pendingFormData,
      });

      console.log("[assistant-package] message request sent", {
        url,
        mode: "text",
      });

      if (!response.ok) {
        throw new Error(`Error sending message: ${response.status}`);
      }

      const data = await response.json();
      const assistantMsg = data.data
        .reverse()
        .find((msg: any) => msg.sender === "assistant");

      console.log(assistantMsg);

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

  // Logic to load existing conversation on startup (don't create new one)
  async function initConversationAndMountChat() {
    try {
      // Get client_id from localStorage
      const storedClientId = localStorage.getItem("ai-client-id");
      // Fetch all conversations
      const conversations = await fetchAllConversations();
      let useExisting = false;

      if (conversations.length > 0 && storedClientId) {
        // Look for a conversation that matches the stored client_id
        const matchingConv = conversations.find(
          (conv: any) => conv.client_id === storedClientId
        );

        if (matchingConv) {
          // Use the existing conversation
          conversationId = matchingConv.id;
          conversationClientId = matchingConv.client_id;
          lastConversationClientId = matchingConv.client_id;
          useExisting = true;
          // Ensure client_id is in localStorage
          localStorage.setItem("ai-client-id", matchingConv.client_id);
        } else {
          // No matching conversation found, conversation will be created on first message
          conversationId = null;
          conversationClientId = null;
          useExisting = false;
        }
      } else {
        // No conversations or no stored client_id, conversation will be created on first message
        conversationId = null;
        conversationClientId = null;
        useExisting = false;
      }

      // Instantiate the chat with the internal send function
      chat = new Chat({
        ...chatOptions,
        onSend: async (message: string | FormData) => {
          const textarea = document.querySelector(
            ".ia-chat-input"
          ) as HTMLTextAreaElement;

          // Handle FormData (audio messages)
          if (message instanceof FormData) {
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

      // Load message history if using existing conversation
      if (
        conversationId &&
        chat &&
        useExisting &&
        localStorage.getItem("ai-client-id") === lastConversationClientId
      ) {
        const messages = await fetchMessages(conversationId);
        messages.forEach((msg: any) => {
          if (chat && typeof chat["addMessage"] === "function") {
            let messageContent = msg.content;

            if (
              chatOptions.audioAnswers &&
              msg.sender === "assistant" &&
              msg.audio_url
            ) {
              messageContent = JSON.stringify({
                content: msg.content,
                audio_url: msg.audio_url,
              });
            }

            const containsHtml =
              messageContent.includes("<img") ||
              messageContent.includes("<p>") ||
              messageContent.includes("<br>");

            const containsAudio = messageContent.includes("audio_url");

            chat["addMessage"](
              messageContent,
              msg.sender === "user" ? "user" : "assistant",
              containsHtml || containsAudio
            );
          }
        });
      }

      // If the user tried to open the chat before it was ready, open it now
      if (pendingOpen) {
        chat.open();
        pendingOpen = false;
      }
    } catch (error) {
      console.error("Error initializing chat:", error);
      // Create an emergency chat that displays the error
      chat = new Chat({
        ...chatOptions,
        onSend: async () => ({
          content:
            "The assistant is not available at this time. Please try again later.",
          isHtml: false,
        }),
        initialMessage:
          "Sorry, I couldn't connect to the server. Please check your connection and try again.",
      });
      chat.mount(options.container || document.body);
      if (pendingOpen) {
        chat.open();
        pendingOpen = false;
      }
    }
  }

  // Start the conversation and mount the chat
  initConversationAndMountChat();

  // Configure interaction
  button.setOnClick(() => {
    if (chat) {
      chat.toggle();
    } else {
      // If the chat is not yet ready, save the attempt
      pendingOpen = true;
    }
  });

  // Return public API
  return {
    open: () => chat && chat.open(),
    close: () => chat && chat.close(),
    toggle: () => chat && chat.toggle(),
    unmount: () => {
      chat && chat.unmount();
      button.unmount();
      window.removeEventListener(
        "practiq:assistant:route-change",
        handleRouteChange
      );
    },
    isOpen: () => !!(chat && chat["isOpen"]),
    hideButton: () => button.hide(),
    showButton: () => button.show(),
    refreshContext: () => resetContextCache(),
    resetConversation: () => resetConversationState(),
  };
}

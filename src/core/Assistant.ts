import { Chat, ChatOptions, ChatTheme, ChatPosition } from "../components/Chat";
import {
  FloatingButton,
  FloatingButtonOptions,
  FloatingButtonPosition,
  ButtonSize,
} from "../components/FloatingButton";

/**
 * Configuration options for the assistant
 */
export interface AssistantOptions {
  /** Required API Key for authentication */
  apiKey: string;
  /** Required API Base URL for authentication */
  apiBaseUrl: string;
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
  /** Specific options for the floating button */
  buttonOptions?: {
    /** Background color of the button */
    backgroundColor?: string;
    /** Color of the icon/text */
    color?: string;
    /** Content of the button (icon or text) */
    icon?: string;
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
}

/**
 * Creates a complete assistant with floating button and chat
 * @param options Configuration options for the assistant
 * @returns Assistant instance
 */
export function createAssistant(options: AssistantOptions): Assistant {
  if (!options.apiKey) {
    throw new Error("apiKey is required to initialize the assistant");
  }

  // Floating button options
  const buttonOptions: FloatingButtonOptions = {
    position: (options.position as FloatingButtonPosition) || "bottom-right",
    backgroundColor: options.buttonOptions?.backgroundColor || "#4a90e2",
    color: options.buttonOptions?.color || "#ffffff",
    icon: options.buttonOptions?.icon || "💬",
    size: options.buttonOptions?.size || "medium",
    container: options.buttonOptions?.container || document.body,
  };

  const chatOptions: ChatOptions & { showImagesOption?: boolean } = {
    title: options.title || "Nymia IA Assistant",
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
  };

  // Create components
  const button = new FloatingButton(buttonOptions);
  let chat: Chat | null = null;
  let conversationId: string | null = null;
  let conversationClientId: string | null = null;
  let lastConversationClientId: string | null = null;
  let pendingOpen = false;
  let lastContext: string = "";

  // Mount components
  button.mount();

  // Function to get all conversations
  async function fetchAllConversations() {
    try {
      const response = await fetch(`${options.apiBaseUrl}/conversation/user`, {
        method: "GET",
        mode: "cors",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${options.apiKey}`,
        },
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
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${options.apiKey}`,
          },
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

  // Function to create conversation with title
  async function createConversation(title: string): Promise<void> {
    const response = await fetch(`${options.apiBaseUrl}/conversation/`, {
      method: "POST",
      mode: "cors",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.apiKey}`,
      },
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
      const mainContent = document.querySelector(
        'main, article, .content, #content, [role="main"]'
      ) as HTMLElement;
      if (mainContent) {
        context = mainContent.innerText;
      } else {
        const body = document.body.cloneNode(true) as HTMLElement;
        const elementsToRemove = body.querySelectorAll(
          "nav, header, footer, .sidebar, .navigation, .menu, .ads, script, style, .cookie-banner"
        );
        elementsToRemove.forEach((el) => el.remove());
        context = body.innerText;
      }
    }

    const normalizedContext = context
      .replace(/\s+/g, " ")
      .trim()
      .substring(0, 8000);

    const contextToSend =
      normalizedContext === lastContext ? "" : normalizedContext;

    if (contextToSend !== "") {
      lastContext = normalizedContext;
    }

    // Update FormData with processed context
    formData.set("context", contextToSend);
    formData.set(
      "contextHash",
      contextToSend ? btoa(contextToSend.substring(0, 100)) : ""
    );

    // Get audio answers state and add query parameter
    const audioAnswers =
      chat && chat.getAudioAnswers ? chat.getAudioAnswers() : false;
    const textToVoiceParam = audioAnswers ? "activate" : "deactivate";

    // Get checkbox state and add query parameter
    const showImages =
      chat && chat.getShowImages ? chat.getShowImages() : false;
    const imageProcessorParam = showImages ? "activate" : "deactivate";

    const url = `${options.apiBaseUrl}/conversation/${conversationId}/message?has_image_processor=${imageProcessorParam}&has_text_to_voice=${textToVoiceParam}`;

    try {
      const response = await fetch(url, {
        method: "POST",
        mode: "cors",
        headers: {
          "x-api-key": `${options.apiKey}`,
        },
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
      const mainContent = document.querySelector(
        'main, article, .content, #content, [role="main"]'
      ) as HTMLElement;
      if (mainContent) {
        context = mainContent.innerText;
      } else {
        const body = document.body.cloneNode(true) as HTMLElement;
        const elementsToRemove = body.querySelectorAll(
          "nav, header, footer, .sidebar, .navigation, .menu, .ads, script, style, .cookie-banner"
        );
        elementsToRemove.forEach((el) => el.remove());
        context = body.innerText;
      }
    }

    const normalizedContext = context
      .replace(/\s+/g, " ")
      .trim()
      .substring(0, 8000);

    const contextToSend =
      normalizedContext === lastContext ? "" : normalizedContext;

    if (contextToSend !== "") {
      lastContext = normalizedContext;
    }

    // Get checkbox state and add query parameter
    const showImages =
      chat && chat.getShowImages ? chat.getShowImages() : false;
    const imageProcessorParam = showImages ? "activate" : "deactivate";

    // Get audio answers state and add query parameter
    const audioAnswers =
      chat && chat.getAudioAnswers ? chat.getAudioAnswers() : false;
    const textToVoiceParam = audioAnswers ? "activate" : "deactivate";

    const url = `${options.apiBaseUrl}/conversation/${conversationId}/message?has_image_processor=${imageProcessorParam}&has_text_to_voice=${textToVoiceParam}`;

    try {
      const response = await fetch(url, {
        method: "POST",
        mode: "cors",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": `${options.apiKey}`,
        },
        body: JSON.stringify({
          content: message,
          context: contextToSend,
          contextHash: contextToSend
            ? btoa(contextToSend.substring(0, 100))
            : null,
        }),
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
        // Reset conversation - will be created on next message
        conversationId = null;
        conversationClientId = null;
        lastContext = "";
        // Clear messages in the UI
        if (chat && typeof chat["clearMessages"] === "function") {
          chat["clearMessages"]();
        }
        // Clear the stored client_id so a new conversation will be created
        localStorage.removeItem("ai-client-id");
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
    },
    isOpen: () => !!(chat && chat["isOpen"]),
    hideButton: () => button.hide(),
    showButton: () => button.show(),
  };
}

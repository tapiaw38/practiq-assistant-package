import { marked } from "marked";
import katex from "katex";

/**
 * Possible position for the chat window
 */
export type ChatPosition =
  | "bottom-right"
  | "bottom-left"
  | "top-right"
  | "top-left";

/**
 * Theme options for the chat
 */
export interface ChatTheme {
  /** Primary color for headers and user messages */
  primaryColor?: string;
  /** Text color */
  textColor?: string;
  /** Window background color */
  backgroundColor?: string;
  /** Background color of user messages */
  userMessageBgColor?: string;
  /** Text color of user messages */
  userMessageTextColor?: string;
  /** Background color of assistant messages */
  assistantMessageBgColor?: string;
  /** Text color of assistant messages */
  assistantMessageTextColor?: string;
  /** Input border color */
  inputBorderColor?: string;
  /** Input background color */
  inputBgColor?: string;
  /** Input text color */
  inputTextColor?: string;
}

/**
 * Configuration options for the chat
 */
export interface ChatOptions {
  /** Chat window title */
  title?: string;
  /** Placeholder text for the text area */
  placeholder?: string;
  /** Chat window position */
  position?: ChatPosition;
  /** Window width in pixels */
  width?: number;
  /** Window height in pixels */
  height?: number;
  /** Function to execute when a message is sent */
  onSend?: (
    message: any
  ) =>
    | Promise<string | { content: string; isHtml: boolean }>
    | string
    | { content: string; isHtml: boolean };
  /** Initial assistant message */
  initialMessage?: string;
  /** Theme options */
  theme?: ChatTheme;
  /** Whether it should be open on startup */
  isOpen?: boolean;
  /** Show images option (checkbox) */
  showImagesOption?: boolean;
  /** Enable audio answers (hide text, show audio player) */
  audioAnswers?: boolean;
  /** Enable recording and sending audio messages */
  audioInput?: boolean;
}

/**
 * Chat Component - Implements a complete chat interface with message handling,
 * input auto-adjustment, animations, and customizable styles
 */
export class Chat {
  private container!: HTMLDivElement;
  private chatWindow!: HTMLDivElement;
  private messageList!: HTMLDivElement;
  private inputArea!: HTMLDivElement;
  private isOpen: boolean = false;
  private options: Required<Omit<ChatOptions, "audioAnswers" | "audioInput">> & {
    showImagesOption?: boolean;
    audioAnswers?: boolean;
    audioInput?: boolean;
  };
  private onNewConversationCallback?: () => void;
  private newConvButton?: HTMLButtonElement;
  private mediaRecorder?: MediaRecorder;
  private audioChunks: Blob[] = [];
  private isRecording: boolean = false;
  private recordingTimer?: number;

  private getSendIconMarkup(): string {
    return `
      <svg class="ia-chat-btn-icon ia-chat-send-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 11.5L20 4l-4.8 16-3.6-5.1L4 11.5z"/>
      </svg>
    `;
  }

  private getRecordIconMarkup(recording: boolean = false): string {
    if (recording) {
      return `
        <svg class="ia-chat-btn-icon ia-chat-record-icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="6.5" fill="currentColor"/>
        </svg>
      `;
    }

    return `
      <svg class="ia-chat-btn-icon ia-chat-record-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 14c1.66 0 3-1.34 3-3V6a3 3 0 10-6 0v5c0 1.66 1.34 3 3 3z"/>
        <path d="M17 11a5 5 0 01-10 0H5a7 7 0 006 6.92V21h2v-3.08A7 7 0 0019 11h-2z"/>
      </svg>
    `;
  }

  /**
   * Creates a new Chat instance
   * @param options Configuration options
   */
  constructor(options: ChatOptions = {}) {
    this.options = {
      title: options.title || "IA Assistant",
      placeholder: options.placeholder || "Write your message here...",
      position: options.position || "bottom-right",
      width: options.width || 300,
      height: options.height || 400,
      onSend: options.onSend || (async (message) => `Received: ${message}`),
      initialMessage: options.initialMessage || "Hello, how can I help you?",
      theme: {
        primaryColor: options.theme?.primaryColor || "#4a90e2",
        textColor: options.theme?.textColor || "#333333",
        backgroundColor: options.theme?.backgroundColor || "#ffffff",
        userMessageBgColor:
          options.theme?.userMessageBgColor ||
          options.theme?.primaryColor ||
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
          options.theme?.inputTextColor ||
          options.theme?.textColor ||
          "#333333",
      },
      isOpen: options.isOpen || false,
      showImagesOption: !!options.showImagesOption,
      ...(typeof options.audioAnswers !== "undefined"
        ? { audioAnswers: !!options.audioAnswers }
        : {}),
      ...(typeof options.audioInput !== "undefined"
        ? { audioInput: !!options.audioInput }
        : {}),
    };

    this.createChatElements();
    this.addEventListeners();
    this.loadStyles();
    this.injectKatexCss();
    this.addInitialMessage();

    // Open the chat if specified in the options
    if (this.options.isOpen) {
      this.open();
    }
  }

  /**
   * Creates the DOM elements for the chat
   */
  private createChatElements(): void {
    // Main container
    this.container = document.createElement("div");
    this.container.className = "ia-chat-container";
    this.container.style.display = "none";

    // Chat window
    this.chatWindow = document.createElement("div");
    this.chatWindow.className = `ia-chat-window ${this.options.position}`;

    // Header
    const header = document.createElement("div");
    header.className = "ia-chat-header";

    const title = document.createElement("div");
    title.className = "ia-chat-title";
    title.textContent = this.options.title;

    const headerActions = document.createElement("div");
    headerActions.className = "ia-chat-header-actions";

    // New conversation button (+)
    const newConvButton = document.createElement("button");
    newConvButton.className = "ia-chat-new-conv";
    newConvButton.innerHTML = `
      <svg class="ia-chat-btn-icon ia-chat-new-conv-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 5v14M5 12h14"/>
      </svg>
      <span class="ia-chat-new-conv-text">Nueva</span>
    `;
    newConvButton.title = "Nueva conversación";
    newConvButton.setAttribute("aria-label", "Nueva conversación");
    newConvButton.setAttribute("type", "button");

    this.newConvButton = newConvButton;
    if (this.onNewConversationCallback) {
      newConvButton.onclick = this.onNewConversationCallback;
    }

    // Close button
    const closeButton = document.createElement("button");
    closeButton.className = "ia-chat-close";
    closeButton.innerHTML = `
      <svg class="ia-chat-btn-icon ia-chat-close-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18"/>
      </svg>
    `;
    closeButton.setAttribute("aria-label", "Close chat");
    closeButton.setAttribute("type", "button");

    header.appendChild(title);
    headerActions.appendChild(newConvButton);
    headerActions.appendChild(closeButton);
    header.appendChild(headerActions);

    // Message list
    this.messageList = document.createElement("div");
    this.messageList.className = "ia-chat-messages";

    // Input area
    this.inputArea = document.createElement("div");
    this.inputArea.className = "ia-chat-input-area";

    // Checkbox for showing images
    const checkboxContainer = document.createElement("div");
    checkboxContainer.className = "ia-chat-checkbox-container";
    checkboxContainer.style.display =
      this.options.showImagesOption === false ? "none" : "flex";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = "ia-show-images";
    checkbox.className = "ia-chat-checkbox";
    checkbox.title =
      "Al activar esta opción tu respuesta puede demorar más de lo esperado";

    const label = document.createElement("label");
    label.htmlFor = "ia-show-images";
    label.className = "ia-chat-checkbox-label";
    label.textContent = "Mostrar imágenes en la respuesta";
    label.title =
      "Al activar esta opción tu respuesta puede demorar más de lo esperado";

    checkboxContainer.appendChild(checkbox);
    checkboxContainer.appendChild(label);

    // CHANGE: Create div wrapper for the textarea for better control
    const textareaWrapper = document.createElement("div");
    textareaWrapper.className = "ia-chat-input-wrapper";

    const textarea = document.createElement("textarea");
    textarea.className = "ia-chat-input";
    textarea.placeholder = this.options.placeholder;
    textarea.rows = 1;
    // Set inline styles to override any calculated style
    textarea.style.height = "42px";
    textarea.style.minHeight = "42px";
    textarea.style.maxHeight = "120px";
    textarea.style.overflowY = "hidden";
    textarea.style.resize = "none";
    textarea.setAttribute("aria-label", "Message");

    // Create buttons based on audio input setting
    console.log(
      "Creating buttons with audioInput:",
      this.options.audioInput
    );

    if (this.options.audioInput) {
      console.log("Creating both send and record buttons");

      // Create send button
      const sendButton = document.createElement("button");
      sendButton.className = "ia-chat-send";
      sendButton.innerHTML = this.getSendIconMarkup();
      sendButton.setAttribute("aria-label", "Send message");
      sendButton.setAttribute("type", "button");

      // Create record button
      const recordButton = document.createElement("button");
      recordButton.className = "ia-chat-record";
      recordButton.innerHTML = this.getRecordIconMarkup();
      recordButton.setAttribute("aria-label", "Record audio message");
      recordButton.setAttribute("type", "button");
      recordButton.title = "Mantén presionado para grabar audio";

      // Start with send hidden, mic visible (toggles on input)
      sendButton.style.display = "none";

      // Add textarea and both buttons to input area
      textareaWrapper.appendChild(textarea);
      this.inputArea.appendChild(textareaWrapper);
      this.inputArea.appendChild(sendButton);
      this.inputArea.appendChild(recordButton);
    } else {
      console.log("Creating only send button");

      // Create only send button
      const sendButton = document.createElement("button");
      sendButton.className = "ia-chat-send";
      sendButton.innerHTML = this.getSendIconMarkup();
      sendButton.setAttribute("aria-label", "Send message");
      sendButton.setAttribute("type", "button");

      // Add textarea and send button to input area
      textareaWrapper.appendChild(textarea);
      this.inputArea.appendChild(textareaWrapper);
      this.inputArea.appendChild(sendButton);
    }

    // Assemble components
    this.chatWindow.appendChild(header);
    this.chatWindow.appendChild(this.messageList);
    this.chatWindow.appendChild(checkboxContainer);
    this.chatWindow.appendChild(this.inputArea);
    this.container.appendChild(this.chatWindow);
  }

  /**
   * Adds the necessary event listeners
   */
  private addEventListeners(): void {
    // Close button
    const closeButton = this.chatWindow.querySelector(
      ".ia-chat-close"
    ) as HTMLButtonElement;
    closeButton.addEventListener("click", () => {
      this.toggle();
      // Remove focus from the button after clicking
      closeButton.blur();
    });

    // Handle action buttons
    if (this.options.audioInput) {
      // Setup both send and record buttons
      const sendButton = this.chatWindow.querySelector(
        ".ia-chat-send"
      ) as HTMLButtonElement;
      const recordButton = this.chatWindow.querySelector(
        ".ia-chat-record"
      ) as HTMLButtonElement;

      // Send button event listener
      sendButton.addEventListener("click", () => {
        this.sendMessage();
        sendButton.blur();
      });

      // Record button event listener
      this.setupAudioRecording(recordButton);
    } else {
      // Setup only send button
      const sendButton = this.chatWindow.querySelector(
        ".ia-chat-send"
      ) as HTMLButtonElement;
      sendButton.addEventListener("click", () => {
        this.sendMessage();
        sendButton.blur();
      });
    }

    // Send with Enter, new line with Shift+Enter
    const textarea = this.chatWindow.querySelector(
      ".ia-chat-input"
    ) as HTMLTextAreaElement;

    // Set initial height
    textarea.style.height = "42px";

    // Handle keyboard events
    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      } else {
        // For any other key, adjust the height in the next cycle
        setTimeout(() => this.autoResizeTextarea(textarea), 0);
      }
    });

    // Auto-adjust on each content change + toggle send/record visibility
    textarea.addEventListener("input", () => {
      this.autoResizeTextarea(textarea);
      if (this.options.audioInput) {
        const sendBtn = this.chatWindow.querySelector(".ia-chat-send") as HTMLButtonElement | null;
        const recBtn  = this.chatWindow.querySelector(".ia-chat-record") as HTMLButtonElement | null;
        const hasText = textarea.value.trim().length > 0;
        if (sendBtn) sendBtn.style.display = hasText ? "" : "none";
        if (recBtn)  recBtn.style.display  = hasText ? "none" : "";
      }
    });

    // Also adjust on focus
    textarea.addEventListener("focus", () => {
      this.autoResizeTextarea(textarea);
    });

    // Click outside to close
    document.addEventListener("click", (e) => {
      if (
        this.isOpen &&
        !this.container.contains(e.target as Node) &&
        !(e.target as HTMLElement).closest(".floating-button")
      ) {
        this.toggle();
      }
    });

    // Reproducir audio si existe un botón de audio
    this.messageList.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      if (
        target.classList.contains("ia-audio-play-btn") ||
        target.closest(".ia-audio-play-btn")
      ) {
        const btn = target.classList.contains("ia-audio-play-btn")
          ? target
          : target.closest(".ia-audio-play-btn");
        const audio = btn?.parentElement?.querySelector(
          ".ia-audio-player"
        ) as HTMLAudioElement;
        if (audio) {
          audio.style.display = "block";
          audio.play();
        }
      }
    });
  }

  /**
   * Sets up audio recording functionality for the record button
   */
  private setupAudioRecording(recordButton: HTMLButtonElement): void {
    // Mouse events
    recordButton.addEventListener("mousedown", (e) => {
      e.preventDefault();
      this.startRecordingTimer();
    });

    recordButton.addEventListener("mouseup", () => {
      this.stopRecording();
    });

    recordButton.addEventListener("mouseleave", () => {
      this.stopRecording();
    });

    // Touch events for mobile
    recordButton.addEventListener("touchstart", (e) => {
      e.preventDefault();
      this.startRecordingTimer();
    });

    recordButton.addEventListener("touchend", (e) => {
      e.preventDefault();
      this.stopRecording();
    });

    recordButton.addEventListener("touchcancel", (e) => {
      e.preventDefault();
      this.stopRecording();
    });
  }

  /**
   * Starts the recording timer and begins audio recording
   */
  private startRecordingTimer(): void {
    this.recordingTimer = setTimeout(async () => {
      await this.startAudioRecording();
    }, 200); // Start recording after 200ms of holding
  }

  /**
   * Starts audio recording
   */
  private async startAudioRecording(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];
      this.isRecording = true;

      // Update button appearance
      const recordButton = this.chatWindow.querySelector(
        ".ia-chat-record"
      ) as HTMLButtonElement;
      recordButton.classList.add("recording");
      recordButton.innerHTML = this.getRecordIconMarkup(true);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.processRecordedAudio();
      };

      this.mediaRecorder.start();
    } catch (error) {
      console.error("Error starting audio recording:", error);
      this.addMessage("Error: No se pudo acceder al micrófono", "error");
    }
  }

  /**
   * Stops recording and processes the audio
   */
  private stopRecording(): void {
    if (this.recordingTimer) {
      clearTimeout(this.recordingTimer);
      this.recordingTimer = undefined;
    }

    if (this.isRecording && this.mediaRecorder) {
      this.mediaRecorder.stop();
      this.mediaRecorder.stream.getTracks().forEach((track) => track.stop());
      this.isRecording = false;

      // Reset button appearance
      const recordButton = this.chatWindow.querySelector(
        ".ia-chat-record"
      ) as HTMLButtonElement;
      recordButton.classList.remove("recording");
      recordButton.innerHTML = this.getRecordIconMarkup();
    }
  }

  /**
   * Processes the recorded audio and sends it
   */
  private async processRecordedAudio(): Promise<void> {
    if (this.audioChunks.length === 0) return;

    const audioBlob = new Blob(this.audioChunks, { type: "audio/webm" });

    try {
      // Convert WebM to WAV
      const wavBlob = await this.convertToWav(audioBlob);

      // Get text from textarea as well
      const textarea = this.chatWindow.querySelector(
        ".ia-chat-input"
      ) as HTMLTextAreaElement;
      const textMessage = textarea.value.trim();

      // Send the audio message with WAV blob
      this.sendAudioMessage(textMessage, wavBlob);

      // Clear textarea
      this.resetTextarea(textarea);
    } catch (error) {
      console.error("Error converting audio to WAV:", error);
      this.addMessage("Error al procesar el audio", "error");
    }
  }

  /**
   * Converts audio blob to WAV format
   */
  private async convertToWav(audioBlob: Blob): Promise<Blob> {
    const audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    return this.audioBufferToWav(audioBuffer);
  }

  /**
   * Converts AudioBuffer to WAV Blob
   */
  private audioBufferToWav(buffer: AudioBuffer): Blob {
    const length = buffer.length;
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const bytesPerSample = 2; // 16-bit
    const blockAlign = numberOfChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = length * blockAlign;
    const bufferSize = 44 + dataSize;

    const arrayBuffer = new ArrayBuffer(bufferSize);
    const view = new DataView(arrayBuffer);

    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, "RIFF");
    view.setUint32(4, bufferSize - 8, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true); // PCM format
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true); // 16-bit
    writeString(36, "data");
    view.setUint32(40, dataSize, true);

    // Convert audio data
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(
          -1,
          Math.min(1, buffer.getChannelData(channel)[i])
        );
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        view.setInt16(offset, intSample, true);
        offset += 2;
      }
    }

    return new Blob([arrayBuffer], { type: "audio/wav" });
  }

  /**
   * Sends an audio message with optional text
   */
  private async sendAudioMessage(
    textContent: string,
    audioBlob: Blob
  ): Promise<void> {
    // Show user message (text if available, otherwise indicate audio message)
    const displayMessage = textContent || "🎤 Mensaje de audio";
    this.addMessage(displayMessage, "user");

    // Show typing indicator
    this.showTypingIndicator();

    // Create FormData with audio and text
    const formData = new FormData();
    formData.append("content", textContent);
    formData.append("voice_content", audioBlob, "audio.wav");
    formData.append("context", ""); // You can implement context logic here if needed
    formData.append("contextHash", "");

    console.log("Sending FormData with audio:", {
      content: textContent,
      audioSize: audioBlob.size,
      audioType: audioBlob.type,
    });

    try {
      // Call the onSend function with FormData directly
      const response = await this.options.onSend(formData);

      // Remove indicator and show response
      this.hideTypingIndicator();

      // Handle different response types
      if (typeof response === "string") {
        this.addMessage(response, "assistant");
      } else if (
        response &&
        typeof response === "object" &&
        "content" in response
      ) {
        this.addMessage(
          response.content,
          "assistant",
          response.isHtml || false
        );
      } else {
        this.addMessage("Invalid response format", "error");
      }
    } catch (error) {
      this.hideTypingIndicator();
      console.error("Audio message error details:", {
        error: error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        formDataEntries: Array.from(formData.entries()).map(([key, value]) => ({
          key,
          value:
            value instanceof Blob
              ? `Blob(${value.size} bytes, ${value.type})`
              : value,
        })),
      });
      this.addMessage(
        `Error al procesar mensaje de audio: ${error instanceof Error ? error.message : String(error)}`,
        "error"
      );
    }

    // Scroll to the end
    this.scrollToBottom();
  }

  /**
   * Automatically adjusts the height of the textarea according to its content
   */
  private autoResizeTextarea(textarea: HTMLTextAreaElement): void {
    // Save the current scroll position
    const scrollPos = this.messageList.scrollTop;

    // First reset the height to get an accurate scrollHeight
    textarea.style.height = "42px";

    // Calculate new height based on content
    const newHeight = Math.min(textarea.scrollHeight, 120);

    // Apply the new height
    textarea.style.height = `${newHeight}px`;

    if (newHeight > 42) {
      // The content requires more than one line
      textarea.classList.add("multiline");
      textarea.style.overflowY = newHeight >= 120 ? "auto" : "hidden";
    } else {
      // The content fits on one line
      textarea.classList.remove("multiline");
      textarea.style.overflowY = "hidden";
    }

    // Restore the scroll position
    this.messageList.scrollTop = scrollPos;
  }

  /**
   * Resets the textarea to its initial state
   */
  private resetTextarea(textarea: HTMLTextAreaElement): void {
    textarea.value = "";
    textarea.classList.remove("multiline");
    textarea.style.height = "42px";
    textarea.style.minHeight = "42px";
    textarea.style.overflowY = "hidden";
    // Restore mic button after send
    if (this.options.audioInput) {
      const sendBtn = this.chatWindow.querySelector(".ia-chat-send") as HTMLButtonElement | null;
      const recBtn  = this.chatWindow.querySelector(".ia-chat-record") as HTMLButtonElement | null;
      if (sendBtn) sendBtn.style.display = "none";
      if (recBtn)  recBtn.style.display  = "";
    }
  }

  /**
   * Sends a message and processes the response
   */
  private async sendMessage(): Promise<void> {
    const textarea = this.chatWindow.querySelector(
      ".ia-chat-input"
    ) as HTMLTextAreaElement;
    const message = textarea.value.trim();

    if (message) {
      // Add user message
      this.addMessage(message, "user");

      // Clear and reset input
      this.resetTextarea(textarea);

      // Show typing indicator
      this.showTypingIndicator();

      try {
        // Create FormData for text message
        const formData = new FormData();
        formData.append("content", message);
        formData.append("context", ""); // You can implement context logic here if needed
        // No voice_content for text-only messages

        // Get response using FormData
        const response = await this.options.onSend(formData);

        // Remove indicator and show response
        this.hideTypingIndicator();

        // Handle different response types
        if (typeof response === "string") {
          this.addMessage(response, "assistant");
        } else if (
          response &&
          typeof response === "object" &&
          "content" in response
        ) {
          this.addMessage(
            response.content,
            "assistant",
            response.isHtml || false
          );
        } else {
          this.addMessage("Invalid response format", "error");
        }
      } catch (error) {
        this.hideTypingIndicator();
        this.addMessage(
          "Sorry, an error occurred while processing your message.",
          "error"
        );
        console.error("Chat error:", error);
      }

      // Scroll to the end
      this.scrollToBottom();
    }
  }

  /**
   * Adds a message to the chat
   * @param text Message text
   * @param sender Message sender (user, assistant, error)
   * @param isHtml Whether the text contains HTML (only for assistant messages)
   */

  /** Inject KaTeX CSS once into the document head */
  private injectKatexCss(): void {
    const ID = "ia-katex-css";
    if (document.getElementById(ID)) return;
    // Inline the essential KaTeX CSS subset via a CDN link so the package
    // doesn't need to bundle the font files itself.
    const link = document.createElement("link");
    link.id = ID;
    link.rel = "stylesheet";
    link.href = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css";
    document.head.appendChild(link);
  }

  /** Strip system analysis labels that leak into AI responses */
  private stripSystemLabels(text: string): string {
    return text
      .replace(/^(RESPONSE_CONTEXT|KEY_FINDINGS|TEXT_FOUND|EXTRACTED_TEXT|IMAGE_ANALYSIS)\s*:\s*/gim, "")
      .replace(/^\[Attached image analysis\]\n?/gim, "")
      .trim()
  }

  /** Render markdown + math (KaTeX) for assistant messages */
  private renderMarkdownAndMath(text: string): string {
    if (!text?.trim()) return "";
    text = this.stripSystemLabels(text);

    // 1. Stash fenced code blocks
    const fenced: string[] = [];
    let s = text.replace(/```[\s\S]*?```/g, (m) => {
      fenced.push(m);
      return `\x00FENCED${fenced.length - 1}\x00`;
    });

    // 2. Stash inline code
    const inlined: string[] = [];
    s = s.replace(/`[^`\n]+`/g, (m) => {
      inlined.push(m);
      return `\x00INLINED${inlined.length - 1}\x00`;
    });

    // 3. Block math  $$...$$
    s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
      try {
        return katex.renderToString(math.trim(), { displayMode: true, throwOnError: false, output: "html" });
      } catch {
        return `<code>$$${math}$$</code>`;
      }
    });

    // 4. Inline math  $...$
    s = s.replace(/(?<!\$)\$(?!\$)([^\n$]+?)(?<!\$)\$(?!\$)/g, (_, math) => {
      try {
        return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false, output: "html" });
      } catch {
        return `<code>$${math}$</code>`;
      }
    });

    // 5. Restore stashes
    inlined.forEach((v, i) => { s = s.replace(`\x00INLINED${i}\x00`, v); });
    fenced.forEach((v, i)  => { s = s.replace(`\x00FENCED${i}\x00`,  v); });

    // 6. Markdown → HTML  (marked preserves inline HTML like <img>)
    marked.setOptions({ breaks: true, gfm: true } as any);
    return marked.parse(s) as string;
  }

  private addMessage(
    text: string,
    sender: "user" | "assistant" | "error",
    isHtml: boolean = false
  ): void {
    const messageElement = document.createElement("div");
    messageElement.className = `ia-chat-message ${sender}`;

    // Handle text content first
    let displayText = text;

    // If audioAnswers is enabled and this is an assistant message, check for JSON with audio_url
    if (this.options.audioAnswers && sender === "assistant") {
      try {
        const jsonResponse = JSON.parse(text);
        if (jsonResponse.content && jsonResponse.audio_url) {
          displayText = jsonResponse.content;
        }
      } catch (e) {
        // Not JSON, use text as is
      }
    }

    if (sender === "assistant") {
      // Markdown + math rendering for all assistant messages
      messageElement.classList.add("ia-md");
      messageElement.innerHTML = this.renderMarkdownAndMath(displayText);
    } else {
      // User / error: escape text only
      const sanitizedText = this.sanitizeText(displayText);
      const formattedText = this.formatText(sanitizedText);
      messageElement.innerHTML = formattedText;
    }

    // Add audio player if audioAnswers is enabled and audio_url is present
    if (this.options.audioAnswers && sender === "assistant") {
      const audioUrlMatch = text.match(/"audio_url"\s*:\s*"([^"]+)"/s);
      if (audioUrlMatch) {
        const audioUrl = audioUrlMatch[1];

        const audioContainer = document.createElement("div");
        audioContainer.className = "ia-audio-container";
        audioContainer.style.marginTop = "8px";

        const playButton = document.createElement("button");
        playButton.className = "ia-audio-play-btn";
        playButton.innerHTML = `
          <svg class="ia-audio-icon" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>
          Audio
        `;

        const audioPlayer = document.createElement("audio");
        audioPlayer.className = "ia-audio-player";
        audioPlayer.src = audioUrl;
        audioPlayer.controls = true;
        audioPlayer.style.display = "none";

        audioContainer.appendChild(playButton);
        audioContainer.appendChild(audioPlayer);
        messageElement.appendChild(audioContainer);
      }
    }

    this.messageList.appendChild(messageElement);
    this.scrollToBottom();
  }

  /**
   * Sanitizes the text to prevent XSS
   */
  private sanitizeText(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Sanitizes HTML to allow only safe tags for assistant messages
   */
  private sanitizeHtml(html: string): string {
    // Create a temporary element to clean the HTML
    const temp = document.createElement("div");
    temp.innerHTML = html;

    // Define allowed tags and attributes
    const allowedTags = ["img", "br", "p", "strong", "em", "b", "i"];
    const allowedAttributes: { [key: string]: string[] } = {
      img: ["src", "alt", "style", "width", "height"],
      p: ["style"],
      strong: [],
      em: [],
      b: [],
      i: [],
      br: [],
    };

    this.cleanElement(temp, allowedTags, allowedAttributes);

    return temp.innerHTML;
  }

  /**
   * Recursively clean HTML elements
   */
  private cleanElement(
    element: HTMLElement,
    allowedTags: string[],
    allowedAttributes: { [key: string]: string[] }
  ): void {
    const children = Array.from(element.children);

    children.forEach((child) => {
      const tagName = child.tagName.toLowerCase();

      if (!allowedTags.includes(tagName)) {
        // Remove disallowed elements
        element.removeChild(child);
      } else {
        // Clean disallowed attributes
        const allowedAttrs = allowedAttributes[tagName] || [];
        const attributes = Array.from(child.attributes);

        attributes.forEach((attr) => {
          if (!allowedAttrs.includes(attr.name)) {
            child.removeAttribute(attr.name);
          }
        });

        // Recursively clean children
        this.cleanElement(child as HTMLElement, allowedTags, allowedAttributes);
      }
    });
  }

  /**
   * Formats the text by detecting links, titles, and lists
   */
  private formatText(text: string): string {
    // Convert URLs to links
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    let formatted = text.replace(
      urlRegex,
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );

    // Titles in **bold** => <span class="ia-title">...</span>
    formatted = formatted.replace(
      /\*\*(.*?)\*\*/g,
      '<span class="ia-title">$1</span>'
    );

    // Lists with - at the beginning of the line
    // First, convert lines starting with - to <li>
    formatted = formatted.replace(
      /(^|\n)-\s+(.*?)(?=\n|$)/g,
      (match, p1, p2) => `${p1}<li>${p2}</li>`
    );
    // Then, wrap consecutive <li> elements in <ul>
    formatted = formatted.replace(
      /(<li>.*?<\/li>\s*)+/gs,
      (match) => `<ul>${match.replace(/\s*$/, "")}</ul>`
    );

    return formatted;
  }

  /**
   * Formats the text by detecting titles and lists, but skipping URL conversion to links
   * Used when audioAnswers is enabled to avoid converting links to audio
   */
  private formatTextWithoutLinks(text: string): string {
    let formatted = text;

    // Titles in **bold** => <span class="ia-title">...</span>
    formatted = formatted.replace(
      /\*\*(.*?)\*\*/g,
      '<span class="ia-title">$1</span>'
    );

    // Lists with - at the beginning of the line
    // First, convert lines starting with - to <li>
    formatted = formatted.replace(
      /(^|\n)-\s+(.*?)(?=\n|$)/g,
      (match, p1, p2) => `${p1}<li>${p2}</li>`
    );
    // Then, wrap consecutive <li> elements in <ul>
    formatted = formatted.replace(
      /(<li>.*?<\/li>\s*)+/gs,
      (match) => `<ul>${match.replace(/\s*$/, "")}</ul>`
    );

    return formatted;
  }

  /**
   * Shows the typing indicator
   */
  private showTypingIndicator(): void {
    const typingElement = document.createElement("div");
    typingElement.className = "ia-chat-message assistant typing";
    typingElement.innerHTML =
      '<span class="ia-typing-dot"></span><span class="ia-typing-dot"></span><span class="ia-typing-dot"></span>';
    typingElement.id = "ia-typing-indicator";
    this.messageList.appendChild(typingElement);
    this.scrollToBottom();
  }

  /**
   * Hides the typing indicator
   */
  private hideTypingIndicator(): void {
    const typingElement = document.getElementById("ia-typing-indicator");
    if (typingElement) {
      typingElement.remove();
    }
  }

  /**
   * Scrolls to the end of the message list
   */
  private scrollToBottom(): void {
    this.messageList.scrollTop = this.messageList.scrollHeight;
  }

  /**
   * Adds the initial assistant message
   */
  private addInitialMessage(): void {
    if (this.options.initialMessage) {
      this.addMessage(this.options.initialMessage, "assistant");
    }
  }

  /**
   * Toggles between showing and hiding the chat
   */
  public toggle(): void {
    this.isOpen = !this.isOpen;
    this.container.style.display = this.isOpen ? "block" : "none";

    if (this.isOpen) {
      // Focus the textarea when opened
      setTimeout(() => {
        const textarea = this.chatWindow.querySelector(
          ".ia-chat-input"
        ) as HTMLTextAreaElement;
        textarea.style.height = "42px"; // Reset initial height
        textarea.focus();
      }, 100);

      // Scroll to the end
      this.scrollToBottom();
    }
  }

  /**
   * Opens the chat
   */
  public open(): void {
    if (!this.isOpen) {
      this.toggle();
    }
  }

  /**
   * Closes the chat
   */
  public close(): void {
    if (this.isOpen) {
      this.toggle();
    }
  }

  /**
   * Mounts the chat in the DOM
   * @param container Element or selector where to mount the chat
   */
  public mount(container: HTMLElement | string = document.body): void {
    const targetContainer =
      typeof container === "string"
        ? (document.querySelector(container) as HTMLElement)
        : container;

    if (targetContainer) {
      targetContainer.appendChild(this.container);
    }
  }

  /**
   * Unmounts the chat from the DOM
   */
  public unmount(): void {
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }

  /**
   * Gets the state of the show images checkbox
   * @returns boolean indicating if images should be shown
   */
  public getShowImages(): boolean {
    const checkbox = this.chatWindow.querySelector(
      "#ia-show-images"
    ) as HTMLInputElement;
    return checkbox ? checkbox.checked : false;
  }

  /**
   * Gets the audio answers setting from options
   * @returns boolean indicating if audio answers are enabled
   */
  public getAudioAnswers(): boolean {
    return !!this.options.audioAnswers;
  }

  /**
   * Gets audio input setting from options
   * @returns boolean indicating if audio recording is enabled
   */
  public getAudioInput(): boolean {
    return !!this.options.audioInput;
  }

  /**
   * Sets the callback for the new conversation button
   */
  public setOnNewConversation(callback: () => void): void {
    this.onNewConversationCallback = callback;
    if (this.newConvButton) {
      this.newConvButton.onclick = callback;
    }
  }

  /**
   * Clears all chat messages and resets the visual state
   */
  public clearMessages(): void {
    if (this.messageList) {
      this.messageList.innerHTML = "";
    }
    // Optionally: clear the textarea
    const textarea = this.chatWindow.querySelector(
      ".ia-chat-input"
    ) as HTMLTextAreaElement;
    if (textarea) {
      this.resetTextarea(textarea);
    }
  }

  /**
   * Loads the necessary CSS styles
   */
  private loadStyles(): void {
    // Check if styles are already loaded
    if (document.getElementById("ia-chat-styles")) {
      return;
    }

    const {
      primaryColor,
      textColor,
      backgroundColor,
      userMessageBgColor,
      userMessageTextColor,
      assistantMessageBgColor,
      assistantMessageTextColor,
      inputBorderColor,
      inputBgColor,
      inputTextColor,
    } = this.options.theme;

    const styleElement = document.createElement("style");
    styleElement.id = "ia-chat-styles";
    styleElement.textContent = `
      .ia-chat-container {
        position: fixed;
        z-index: 1001;
        pointer-events: none;
        width: 100%;
        height: 100%;
        top: 0;
        left: 0;
      }
      
      .ia-chat-window {
        position: absolute;
        width: min(${this.options.width}px, calc(100vw - 32px));
        height: min(${this.options.height}px, calc(100vh - 120px));
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 251, 253, 0.98) 100%);
        background-color: ${backgroundColor};
        border: 1px solid rgba(18, 60, 82, 0.10);
        border-radius: 24px;
        box-shadow: 0 24px 64px rgba(11, 38, 52, 0.22);
        backdrop-filter: blur(14px);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        pointer-events: auto;
        transition: transform 0.24s ease, opacity 0.24s ease, box-shadow 0.24s ease;
      }
      
      .ia-chat-window.bottom-right {
        bottom: 90px;
        right: 20px;
      }
      
      .ia-chat-window.bottom-left {
        bottom: 90px;
        left: 20px;
      }
      
      .ia-chat-window.top-right {
        top: 20px;
        right: 20px;
      }
      
      .ia-chat-window.top-left {
        top: 20px;
        left: 20px;
      }
      
      .ia-chat-header {
        background:
          linear-gradient(135deg, ${primaryColor} 0%, ${this.darkenColor(primaryColor || "#4a90e2", 12)} 100%);
        color: white;
        padding: 16px 18px 14px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid rgba(255, 255, 255, 0.12);
      }

      .ia-chat-header-actions {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-left: 12px;
      }
      
      .ia-chat-title {
        font-weight: 700;
        color: white;
        font-size: 15px;
        letter-spacing: 0.01em;
        display: block;
        margin: 0;
      }

      .ia-chat-new-conv,
      .ia-chat-close {
        appearance: none;
        border: none;
        background: rgba(255, 255, 255, 0.14);
        color: white;
        cursor: pointer;
        outline: none;
        transition: background-color 0.18s ease, transform 0.18s ease, opacity 0.18s ease;
      }

      .ia-chat-btn-icon {
        width: 16px;
        height: 16px;
        display: inline-block;
        flex-shrink: 0;
      }

      .ia-chat-btn-icon path,
      .ia-chat-btn-icon circle {
        vector-effect: non-scaling-stroke;
      }

      .ia-chat-new-conv:hover,
      .ia-chat-close:hover {
        background: rgba(255, 255, 255, 0.22);
        transform: translateY(-1px);
      }
      
      .ia-chat-new-conv {
        border-radius: 999px;
        padding: 8px 12px;
        font-size: 11px;
        line-height: 1;
        font-weight: 600;
        white-space: nowrap;
        display: inline-flex;
        align-items: center;
        gap: 7px;
        letter-spacing: 0.01em;
      }

      .ia-chat-new-conv-icon,
      .ia-chat-close-icon {
        stroke: currentColor;
        stroke-width: 2;
        fill: none;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      
      .ia-chat-close {
        border-radius: 999px;
        width: 32px;
        height: 32px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 22px;
        line-height: 1;
        padding: 0;
      }

      /* Prevent focus visual effects on header buttons */
      .ia-chat-new-conv:focus,
      .ia-chat-close:focus {
        outline: none;
        box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.18);
      }
      
      .ia-chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 18px 16px 16px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        background:
          radial-gradient(circle at top left, rgba(18, 60, 82, 0.04), transparent 34%),
          linear-gradient(180deg, rgba(248, 251, 253, 0.96) 0%, rgba(255, 255, 255, 1) 100%);
      }
      
      .ia-chat-message {
        padding: 10px 12px;
        border-radius: 16px;
        max-width: 84%;
        word-break: break-word;
        line-height: 1.5;
        font-size: 13px;
        box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);
        border: 1px solid transparent;
      }
      
      .ia-chat-message.user {
        background:
          linear-gradient(135deg, ${userMessageBgColor} 0%, ${this.darkenColor(userMessageBgColor || primaryColor || "#4a90e2", 12)} 100%);
        color: ${userMessageTextColor};
        align-self: flex-end;
        border-bottom-right-radius: 6px;
      }
      
      .ia-chat-message.assistant {
        background-color: ${assistantMessageBgColor};
        color: ${assistantMessageTextColor};
        align-self: flex-start;
        border: 1px solid rgba(18, 60, 82, 0.08);
        border-bottom-left-radius: 6px;
      }
      
      .ia-chat-message.error {
        background-color: #ffe6e6;
        color: #d32f2f;
        align-self: flex-start;
        border: 1px solid rgba(211, 47, 47, 0.18);
        border-bottom-left-radius: 6px;
      }

      /* Markdown + math typography */
      .ia-md { line-height: 1.7; overflow-wrap: break-word; }
      .ia-md p { margin: 0 0 8px; }
      .ia-md p:last-child { margin-bottom: 0; }
      .ia-md strong { font-weight: 700; }
      .ia-md em { font-style: italic; }
      .ia-md h1, .ia-md h2, .ia-md h3 { font-weight: 700; margin: 12px 0 5px; line-height: 1.3; }
      .ia-md h1 { font-size: 1.1em; }
      .ia-md h2 { font-size: 1.05em; }
      .ia-md h3 { font-size: 1em; }
      .ia-md ul, .ia-md ol { padding-left: 18px; margin: 4px 0 8px; }
      .ia-md li { margin-bottom: 3px; }
      .ia-md code {
        background: rgba(0,0,0,0.08);
        border-radius: 4px;
        padding: 1px 5px;
        font-family: 'JetBrains Mono', 'Fira Code', monospace;
        font-size: 0.87em;
      }
      .ia-md pre {
        background: #1e1e2e;
        color: #cdd6f4;
        border-radius: 8px;
        padding: 12px 14px;
        overflow-x: auto;
        margin: 6px 0;
        font-size: 0.84em;
        line-height: 1.5;
      }
      .ia-md pre code { background: none; padding: 0; color: inherit; font-size: inherit; }
      .ia-md blockquote {
        border-left: 3px solid ${primaryColor};
        padding: 4px 10px;
        margin: 6px 0;
        opacity: 0.85;
      }
      .ia-md table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 0.9em; }
      .ia-md th, .ia-md td { border: 1px solid rgba(0,0,0,0.15); padding: 5px 8px; text-align: left; }
      .ia-md th { font-weight: 700; background: rgba(0,0,0,0.05); }
      .ia-md hr { border: none; border-top: 1px solid rgba(0,0,0,0.12); margin: 10px 0; }
      .ia-md a { color: ${primaryColor}; text-decoration: underline; }
      .ia-md .katex-display { margin: 8px 0; overflow-x: auto; }
      .ia-md .katex { font-size: 1.05em; }

      .ia-chat-input-area {
        padding: 12px 14px 14px;
        border-top: 1px solid rgba(18, 60, 82, 0.08);
        display: flex;
        align-items: flex-end;
        gap: 8px;
        background: rgba(255, 255, 255, 0.96);
      }
      
      .ia-chat-input-wrapper {
        flex: 1;
        position: relative;
        display: flex;
      }
      
      .ia-chat-input {
        flex: 1;
        border: 1px solid ${inputBorderColor};
        border-radius: 18px;
        padding: 11px 14px;
        font-family: inherit;
        font-size: 14px;
        resize: none;
        box-sizing: border-box;
        outline: none;
        transition: height 0.1s ease-out, border-color 0.2s, box-shadow 0.2s, background-color 0.2s;
        line-height: 1.4;
        min-height: 42px !important;
        max-height: 120px;
        overflow-y: hidden !important; /* Force hide vertical scroll by default */
        background-color: ${inputBgColor};
        color: ${inputTextColor};
        box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.04);
      }
      
      .ia-chat-input.multiline {
        overflow-y: auto !important; /* Only allow scroll when there are multiple lines */
      }
      
      .ia-chat-input:focus {
        border-color: ${primaryColor};
        box-shadow: 0 0 0 4px rgba(18, 60, 82, 0.08);
      }
      
      .ia-chat-send,
      .ia-chat-record {
        appearance: none;
        -webkit-appearance: none;
        background: linear-gradient(135deg, ${primaryColor} 0%, ${this.darkenColor(primaryColor || "#4a90e2", 10)} 100%);
        color: white;
        border: none;
        border-radius: 50%;
        width: 42px;
        height: 42px;
        min-width: 42px;
        min-height: 42px;
        aspect-ratio: 1 / 1;
        padding: 0;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        transition: background-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease, opacity 0.15s ease, scale 0.15s ease;
        outline: none; /* Prevent the outline from being displayed on click */
        box-shadow: 0 10px 18px rgba(18, 60, 82, 0.20);
        flex-shrink: 0;
        position: relative;
        overflow: hidden;
        box-sizing: border-box;
      }

      .ia-chat-send::before,
      .ia-chat-record::before,
      .ia-audio-play-btn::before {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0));
        pointer-events: none;
      }

      .ia-chat-send .ia-chat-btn-icon,
      .ia-chat-record .ia-chat-btn-icon {
        width: 18px;
        height: 18px;
        position: relative;
        z-index: 1;
      }

      .ia-chat-send-icon {
        fill: currentColor;
        transform: translateX(1px) rotate(-8deg);
      }

      .ia-chat-record-icon {
        fill: currentColor;
      }
      
      .ia-chat-send:hover,
      .ia-chat-record:hover {
        background-color: ${this.darkenColor(primaryColor || "#4a90e2", 10)};
        transform: translateY(-1px);
        box-shadow: 0 14px 22px rgba(18, 60, 82, 0.24);
      }

      .ia-chat-send:active,
      .ia-chat-record:active,
      .ia-audio-play-btn:active,
      .ia-chat-new-conv:active,
      .ia-chat-close:active {
        transform: translateY(0) scale(0.98);
      }
      
      /* Prevent focus visual effects on send button */
      .ia-chat-send:focus,
      .ia-chat-record:focus {
        outline: none;
        box-shadow: 0 0 0 4px rgba(18, 60, 82, 0.12), 0 10px 18px rgba(18, 60, 82, 0.20);
      }

      .ia-chat-record {
        user-select: none;
      }
      
      .ia-chat-record.recording {
        background: linear-gradient(135deg, #ff5d5d 0%, #dc2626 100%);
        animation: pulse 1s infinite;
        box-shadow: 0 16px 26px rgba(255, 68, 68, 0.32);
      }
      
      @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.1); }
        100% { transform: scale(1); }
      }
      
      /* Audio container styles */
      /* Typing indicator */
      .typing {
        display: flex;
        align-items: center;
        padding: 10px 14px;
      }
      
      .ia-typing-dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: #888;
        margin-right: 4px;
        animation: typing-dot 1.4s infinite ease-in-out both;
      }
      
      .ia-typing-dot:nth-child(1) {
        animation-delay: 0s;
      }
      
      .ia-typing-dot:nth-child(2) {
        animation-delay: 0.2s;
      }
      
      .ia-typing-dot:nth-child(3) {
        animation-delay: 0.4s;
        margin-right: 0;
      }
      
      @keyframes typing-dot {
        0%, 80%, 100% { transform: scale(0.7); opacity: 0.6; }
        40% { transform: scale(1); opacity: 1; }
      }
      
      /* Responsive */
      @media (max-width: 480px) {
        .ia-chat-window {
          width: calc(100% - 20px);
          height: min(78vh, 680px);
          left: 10px !important;
          right: 10px !important;
          bottom: 10px !important;
          top: auto !important;
          border-radius: 22px;
        }

        .ia-chat-header {
          padding: 14px;
        }

        .ia-chat-header-actions {
          gap: 8px;
        }

        .ia-chat-new-conv {
          padding: 7px 10px;
          font-size: 10px;
        }

        .ia-chat-new-conv-text {
          display: none;
        }

        .ia-chat-new-conv {
          width: 32px;
          height: 32px;
          padding: 0;
          justify-content: center;
        }

        .ia-chat-messages {
          padding: 14px 12px;
        }

        .ia-chat-input-area {
          padding: 10px 12px 12px;
        }

        .ia-chat-message {
          max-width: 90%;
        }
      }
      
      ul {
        margin: 8px 0 8px 18px;
        padding-left: 18px;
      }
      ul li {
        margin-bottom: 2px;
        list-style: disc inside;
      }
      
      .ia-chat-messages::-webkit-scrollbar {
        width: 8px;
        background: transparent;
      }
      .ia-chat-messages::-webkit-scrollbar-thumb {
        background: ${inputBorderColor};
        border-radius: 8px;
      }
      .ia-chat-messages::-webkit-scrollbar-thumb:hover {
        background: ${primaryColor};
      }
      .ia-chat-messages {
        scrollbar-width: thin;
        scrollbar-color: ${inputBorderColor} transparent;
      }
      
      .ia-chat-input::-webkit-scrollbar {
        width: 8px;
        background: transparent;
        border-radius: 20px;
      }
      .ia-chat-input::-webkit-scrollbar-thumb {
        background: ${inputBorderColor};
        border-radius: 20px;
        min-height: 24px;
        border: 2px solid ${inputBgColor};
      }
      .ia-chat-input::-webkit-scrollbar-thumb:hover {
        background: ${primaryColor};
      }
      .ia-chat-input {
        scrollbar-width: thin;
        scrollbar-color: ${inputBorderColor} ${inputBgColor};
      }

      .ia-chat-checkbox-container {
        padding: 10px 14px 0;
        background-color: rgba(255, 255, 255, 0.96);
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .ia-chat-checkbox {
        width: 16px;
        height: 16px;
        cursor: pointer;
        accent-color: ${primaryColor};
      }

      .ia-chat-checkbox-label {
        font-size: 12px;
        color: ${assistantMessageTextColor};
        cursor: pointer;
        user-select: none;
        margin: 0;
        opacity: 0.82;
      }
      
      .ia-chat-checkbox-label:hover {
        color: ${primaryColor};
      }

      .ia-chat-message img {
        max-width: 100%;
        height: auto;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        margin: 10px 0;
        display: block;
      }

      .ia-chat-message.assistant img {
        max-width: 300px;
      }

      .ia-chat-message p {
        margin: 6px 0;
        line-height: 1.5;
      }

      .ia-audio-player {
        display: none;
        width: 100%;
        margin-top: 8px;
      }

      .ia-audio-container {
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-width: 260px;
      }

      .ia-audio-play-btn {
        background:
          linear-gradient(135deg, ${primaryColor} 0%, ${this.darkenColor(primaryColor || "#4a90e2", 12)} 100%);
        color: white;
        border: none;
        border-radius: 999px;
        padding: 10px 16px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        transition: all 0.2s ease;
        outline: none;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        box-shadow: 0 10px 18px rgba(18, 60, 82, 0.18);
        min-width: 132px;
        justify-content: center;
        position: relative;
        overflow: hidden;
      }

      .ia-audio-play-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 14px 24px rgba(18, 60, 82, 0.22);
      }

      .ia-audio-icon {
        width: 16px;
        height: 16px;
        display: inline-block;
        fill: white;
        flex-shrink: 0;
      }

      .ia-audio-player {
        width: 100%;
        margin-top: 8px;
        border-radius: 8px;
        outline: none;
      }

      .ia-audio-player::-webkit-media-controls-panel {
        background-color: ${assistantMessageBgColor};
        border-radius: 8px;
      }

      .ia-audio-player::-webkit-media-controls-play-button,
      .ia-audio-player::-webkit-media-controls-pause-button {
        background-color: ${primaryColor};
        border-radius: 50%;
      }
    `;

    document.head.appendChild(styleElement);
  }

  /**
   * Darkens a color by a certain percentage
   */
  private darkenColor(color: string, percent: number): string {
    // If the color is a name, convert it to hex format
    if (!/^#[0-9A-F]{3,6}$/i.test(color)) {
      const tempElement = document.createElement("div");
      tempElement.style.color = color;
      document.body.appendChild(tempElement);
      const computedColor = getComputedStyle(tempElement).color;
      document.body.removeChild(tempElement);

      if (computedColor.startsWith("rgb")) {
        color = this.rgbToHex(computedColor);
      } else {
        color = "#4a90e2"; // Default color if it cannot be converted
      }
    }

    // Remove the # symbol if it exists
    color = color.replace("#", "");

    // Convert to RGB
    let r = parseInt(color.substring(0, 2), 16);
    let g = parseInt(color.substring(2, 4), 16);
    let b = parseInt(color.substring(4, 6), 16);

    // Reduce brightness
    r = Math.floor((r * (100 - percent)) / 100);
    g = Math.floor((g * (100 - percent)) / 100);
    b = Math.floor((b * (100 - percent)) / 100);

    // Convert back to hex format
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  /**
   * Converts an RGB color to hexadecimal format
   */
  private rgbToHex(rgb: string): string {
    // Extract RGB values
    const match = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    if (!match) return "#000000";

    const r = parseInt(match[1], 10);
    const g = parseInt(match[2], 10);
    const b = parseInt(match[3], 10);

    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
}

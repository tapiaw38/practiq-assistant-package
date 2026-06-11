# Practiq Assistant Package

Library to integrate the Practiq assistant chat into any web application in a simple and customizable way.

## Features

- 🎯 **Easy Integration**: Add an IA assistant to your application with just a few lines of code
- 🎨 **Customizable**: Change colors, position, icons, size and more
- 💬 **Full Chat**: Chat interface with message bubbles, writing animation, and text formatting
- 📱 **Responsive**: Automatically adapts to mobile devices
- 🔍 **Flexible**: Use your own logic to process messages
- ⌨️ **Optimized UX**: Support for keyboard shortcuts and text area auto-adjustment

## Installation

```bash
npm install practiq-assistant-package
```

or

```bash
yarn add practiq-assistant-package
```

## Basic Usage

```javascript
import { createAssistant } from "practiq-assistant-package";

// Create an assistant with minimal configuration
const assistant = createAssistant({
  onSend: async (message) => {
    // Here you can integrate your own logic to respond
    // Connect with your backend, IA API, etc.
    return `Received: ${message}`;
  },
});

// The assistant is ready to use
// The floating button will appear in the bottom right corner
```

## Configuration Options

```javascript
// Assistant with full configuration
const assistant = createAssistant({
  // API URL for the assistant server (required)
  apiBaseUrl: "http://localhost:8000",
  // Auth token or API key for the assistant server (required)
  authToken: "your-session-token",
  // General options
  title: "Practiq Assistant",
  placeholder: "How can I help you?",
  position: "bottom-right", // 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  initialMessage: "Hello! I am your virtual assistant. How can I help you?",
  autoOpen: false, // If true, the chat will open automatically
  // Experimental: Enable image search in responses (may slow down replies)
  searchImages: false, // If true, the assistant will try to include images in the response. This is experimental and may make responses slower,
  // Enable recording and sending audio messages from chat
  audioInput: false, // If true, chat shows microphone button to record and send audio
  // Enable audio responses (replaces text with audio player)
  audioAnswers: false, // If true, assistant responses will be played as audio with a WhatsApp-style play button
  // Specific button options
  buttonOptions: {
    backgroundColor: "#4a90e2",
    color: "#ffffff",
    icon: "💬", // Emoticon or HTML for the button
    avatarUrl: "https://example.com/robot.png", // Optional avatar image
    size: "medium", // 'small' | 'medium' | 'large'
    container: "#my-container", // Selector or element where to mount the button
  },

  // Chat theme options
  theme: {
    primaryColor: "#4a90e2", // Primary color (header and send button)
    textColor: "#333333", // General text color
    backgroundColor: "#ffffff", // Chat background color
    userMessageBgColor: "#4a90e2", // User message background color
    userMessageTextColor: "#ffffff", // User message text color
    assistantMessageBgColor: "#f1f1f1", // Assistant message background color
    assistantMessageTextColor: "#333333", // Assistant message text color
    inputBorderColor: "#e0e0e0", // Input border color
    inputBgColor: "#ffffff", // Input background color
    inputTextColor: "#333333", // Input text color
  },
});
```

### Experimental option: image search

If you want the assistant to be able to show images in the responses, you can enable the `searchImages` option. This feature is experimental and, when enabled, may cause responses to take longer, as the assistant will try to find and process relevant images for the conversation.

```javascript
const assistant = createAssistant({
  // ...other options...
  searchImages: true, // Experimental: enables image search in responses
});
```

When disabled (`false`, the default value), the option to show images will not appear in the chat interface.

### Audio Responses

The library now supports audio responses from the assistant. When enabled, instead of showing text responses, the assistant will display an audio player with a WhatsApp-style play button.

```javascript
const assistant = createAssistant({
  // ...other options...
  audioAnswers: true, // Enable audio responses
});
```

**How it works:**

1. When `audioAnswers` is set to `true`, the library automatically adds `has_text_to_voice=activate` to the API query parameters
2. The API should return a response containing an `audio_url` field with the audio file URL
3. Instead of displaying text, the chat will show a play button that allows users to listen to the response
4. The audio player appears with a clean, WhatsApp-inspired design

**Expected API Response Format:**

```json
{
  "response": "Your text response here",
  "audio_url": "https://example.com/path/to/audio.wav"
}
```

**Features:**

- WhatsApp-style play button with audio icon
- Clean audio player interface
- Automatic detection of audio URLs in responses
- Seamless integration with existing chat functionality

### Audio Input

The library also supports recording and sending audio messages from the chat input.

```javascript
const assistant = createAssistant({
  // ...other options...
  audioInput: true, // Enable microphone button and audio uploads
});
```

**How it works:**

1. When `audioInput` is `true`, chat shows microphone button next to send button
2. User holds microphone button to record audio
3. Package records in browser, converts audio to WAV, and sends it as `voice_content`
4. Optional text written in textarea is sent together with recorded audio

## Methods

You can control the assistant with the following methods:

```javascript
// Open the chat
assistant.open();

// Close the chat
assistant.close();

// Toggle between open/closed
assistant.toggle();

// Check if it's open
const isOpen = assistant.isOpen();

// Hide the floating button (for example, when using your own button)
assistant.hideButton();

// Show the floating button
assistant.showButton();

// Unmount the assistant (remove from the DOM)
assistant.unmount();
```

## License

This project is licensed under the ISC License.

import Phaser from "phaser";
import { Room } from "colyseus.js";

export class ChatScene extends Phaser.Scene {
  private chatContainer: HTMLDivElement;
  private chatMessages: HTMLDivElement;
  private chatInput: HTMLInputElement;
  private chatForm: HTMLFormElement;
  private toggleButton: HTMLButtonElement;
  private room: Room;
  private isMinimized: boolean = false;
  private roomCheckInterval: number;
  private chatFocused: boolean = false;
  private documentClickListener: (e: MouseEvent) => void;

  constructor() {
    super({ key: "chat" });
  }

  create() {
    // Create chat UI first
    this.createChatUI();

    // Get the room from the registry
    try {
      this.room = this.registry.get("room");

      if (this.room) {
        // Set up message handling if room is available
        this.setupMessageHandling();
      } else {
        // Add a message to indicate that chat is in view-only mode
        this.addMessage(
          "System",
          "Chat is in view-only mode until connected to a room"
        );

        // Try to get the room again after a short delay
        setTimeout(() => {
          this.room = this.registry.get("room");
          if (this.room) {
            this.setupMessageHandling();
          }
        }, 2000);
      }

      /*
      // Set up a periodic check for room changes
      this.roomCheckInterval = setInterval(() => {
        const currentRoom = this.registry.get("room");
        if (currentRoom && (!this.room || currentRoom.id !== this.room.id)) {
          this.room = currentRoom;
          this.setupMessageHandling();
          this.addMessage("System", "Connected to a new room");
        }
      }, 2000);
      */

      // Listen for focus-chat events from other scenes
      this.game.events.on("focus-chat", () => {
        this.focusChat();
      });
    } catch (error) {
      console.error("Error in ChatScene create:", error);
      this.addMessage("System", "Error initializing chat: " + error.message);
    }

    // Set up document click listener to detect clicks outside chat
    this.documentClickListener = (e: MouseEvent) => {
      // Check if the click is outside the chat container
      if (
        this.chatContainer &&
        !this.chatContainer.contains(e.target as Node)
      ) {
        this.unfocusChat();
      }
    };

    document.addEventListener("click", this.documentClickListener);
  }

  private createChatUI() {
    // Remove any existing chat container
    const existingContainer = document.getElementById("chat-container");
    if (existingContainer) {
      existingContainer.remove();
    }

    // Create main container
    this.chatContainer = document.createElement("div");
    this.chatContainer.id = "chat-container";
    this.chatContainer.style.position = "fixed";
    this.chatContainer.style.bottom = "10px";
    this.chatContainer.style.left = "10px";
    this.chatContainer.style.width = "300px";
    this.chatContainer.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
    this.chatContainer.style.borderRadius = "5px";
    this.chatContainer.style.padding = "10px";
    this.chatContainer.style.zIndex = "10000";
    this.chatContainer.style.color = "white";
    this.chatContainer.style.fontFamily = "Arial, sans-serif";
    this.chatContainer.style.transition = "height 0.3s ease";
    this.chatContainer.style.pointerEvents = "auto";
    this.chatContainer.style.display = "block";

    // Create header with toggle button
    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.marginBottom = "5px";

    const title = document.createElement("span");
    title.textContent = "Room Chat";
    title.style.fontWeight = "bold";

    this.toggleButton = document.createElement("button");
    this.toggleButton.textContent = "-";
    this.toggleButton.style.width = "20px";
    this.toggleButton.style.height = "20px";
    this.toggleButton.style.backgroundColor = "transparent";
    this.toggleButton.style.border = "none";
    this.toggleButton.style.color = "white";
    this.toggleButton.style.cursor = "pointer";
    this.toggleButton.addEventListener("click", () => this.toggleChat());

    header.appendChild(title);
    header.appendChild(this.toggleButton);

    // Create messages container
    this.chatMessages = document.createElement("div");
    this.chatMessages.style.height = "150px";
    this.chatMessages.style.overflowY = "auto";
    this.chatMessages.style.marginBottom = "10px";
    this.chatMessages.style.padding = "5px";
    this.chatMessages.style.backgroundColor = "rgba(0, 0, 0, 0.3)";
    this.chatMessages.style.borderRadius = "3px";

    // Create input form
    this.chatForm = document.createElement("form");
    this.chatForm.style.display = "flex";

    this.chatInput = document.createElement("input");
    this.chatInput.type = "text";
    this.chatInput.placeholder = "Type a message...";
    this.chatInput.style.flex = "1";
    this.chatInput.style.padding = "5px";
    this.chatInput.style.backgroundColor = "rgba(255, 255, 255, 0.8)";
    this.chatInput.style.border = "none";
    this.chatInput.style.borderRadius = "3px";

    const sendButton = document.createElement("button");
    sendButton.type = "submit";
    sendButton.textContent = "Send";
    sendButton.style.marginLeft = "5px";
    sendButton.style.padding = "5px 10px";
    sendButton.style.backgroundColor = "#4CAF50";
    sendButton.style.border = "none";
    sendButton.style.borderRadius = "3px";
    sendButton.style.color = "white";
    sendButton.style.cursor = "pointer";

    this.chatForm.appendChild(this.chatInput);
    this.chatForm.appendChild(sendButton);

    // Add everything to the container
    this.chatContainer.appendChild(header);
    this.chatContainer.appendChild(this.chatMessages);
    this.chatContainer.appendChild(this.chatForm);

    // Add to document
    document.body.appendChild(this.chatContainer);

    // Set up form submission
    this.chatForm.addEventListener("submit", (e) => {
      e.preventDefault();
      this.sendMessage();
    });

    // Add keydown event to the chat input to handle Enter key
    this.chatInput.addEventListener("keydown", (e) => {
      e.stopPropagation(); // Prevent the key event from reaching the game

      // If Enter is pressed, send the message
      if (e.key === "Enter") {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Add keypress event to ensure all keys (including WASD) work in the input
    this.chatInput.addEventListener("keypress", (e) => {
      e.stopPropagation(); // Prevent the key event from reaching the game
    });

    // Add keyup event to prevent game from receiving keyup events
    this.chatInput.addEventListener("keyup", (e) => {
      e.stopPropagation(); // Prevent the key event from reaching the game
    });

    // Add click event to focus chat when clicked
    this.chatContainer.addEventListener("click", (e) => {
      // Stop propagation to prevent the document click handler from firing
      e.stopPropagation();
      this.focusChat();
    });

    // Add click event to the chat input to focus it
    this.chatInput.addEventListener("click", (e) => {
      e.stopPropagation();
      this.focusChat();
    });

    // Add click event to the chat messages to focus the input
    this.chatMessages.addEventListener("click", (e) => {
      e.stopPropagation();
      this.focusChat();
    });
  }

  private focusChat() {
    if (!this.chatFocused) {
      this.chatFocused = true;
      this.chatInput.focus();

      // Highlight the chat container to indicate focus
      this.chatContainer.style.boxShadow = "0 0 10px rgba(76, 175, 80, 0.7)";

      // Add a visual indicator to the chat input
      this.chatInput.style.border = "2px solid #4CAF50";
      this.chatInput.style.outline = "none";

      // Emit an event to notify game scenes that chat is focused
      this.game.events.emit("chat-focused", true);

      // We don't disable keyboard input for the scene anymore
      // Instead, we'll let the game scenes handle this based on the chatFocused flag
      // this.input.keyboard.enabled = false;
    }
  }

  private unfocusChat() {
    if (this.chatFocused) {
      this.chatFocused = false;
      this.chatInput.blur();

      // Remove highlight
      this.chatContainer.style.boxShadow = "none";

      // Remove visual indicator from chat input
      this.chatInput.style.border = "none";

      // Emit an event to notify game scenes that chat is unfocused
      this.game.events.emit("chat-focused", false);

      // We don't need to re-enable keyboard events here
      // this.input.keyboard.enabled = true;
    }
  }

  private setupMessageHandling() {
    if (!this.room) {
      this.addMessage(
        "System",
        "Chat in view-only mode: Not connected to a room"
      );
      return;
    }

    try {
      // Listen for chat messages from the server
      this.room.onMessage("chat", (message) => {
        if (message && message.username && message.text) {
          this.addMessage(message.username, message.text);
        }
      });

      // Send a join notification to the server
      this.room.send("chat", { text: "User joined the chat" });
    } catch (error) {
      console.error("Error setting up message handling:", error);
      this.addMessage("System", "Error setting up chat: " + error.message);
    }
  }

  private sendMessage() {
    const text = this.chatInput.value.trim();

    if (text && this.room) {
      try {
        const username = this.registry.get("playerData")?.username || "Unknown";

        // Send message to server
        this.room.send("chat", { text });

        // Clear input
        this.chatInput.value = "";
      } catch (error) {
        console.error("Error sending message:", error);
        this.addMessage("System", "Error sending message: " + error.message);
      }
    } else if (!this.room) {
      this.addMessage("System", "Cannot send message: Not connected to a room");
    }
  }

  private addMessage(username: string, text: string) {
    const messageElement = document.createElement("div");
    messageElement.style.marginBottom = "5px";

    const usernameSpan = document.createElement("span");
    usernameSpan.textContent = username + ": ";
    usernameSpan.style.fontWeight = "bold";
    usernameSpan.style.color = "#4CAF50";

    const textSpan = document.createElement("span");
    textSpan.textContent = text;

    messageElement.appendChild(usernameSpan);
    messageElement.appendChild(textSpan);

    this.chatMessages.appendChild(messageElement);

    // Auto-scroll to bottom
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  private toggleChat() {
    this.isMinimized = !this.isMinimized;

    if (this.isMinimized) {
      this.chatMessages.style.display = "none";
      this.chatForm.style.display = "none";
      this.toggleButton.textContent = "+";
    } else {
      this.chatMessages.style.display = "block";
      this.chatForm.style.display = "flex";
      this.toggleButton.textContent = "-";
    }
  }

  shutdown() {
    // Clear the room check interval
    if (this.roomCheckInterval) {
      clearInterval(this.roomCheckInterval);
    }

    // Remove document click listener
    if (this.documentClickListener) {
      document.removeEventListener("click", this.documentClickListener);
    }

    // Remove game event listeners
    this.game.events.off("focus-chat");

    // Remove chat UI when scene is shut down
    if (this.chatContainer && this.chatContainer.parentNode) {
      this.chatContainer.parentNode.removeChild(this.chatContainer);
    }
  }
}

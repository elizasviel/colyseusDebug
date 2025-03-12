import Phaser from "phaser";
import { Client } from "colyseus.js";

export class Login extends Phaser.Scene {
  private client: Client;
  private username: string = "";
  private password: string = "";
  private errorMessage: string = "";
  private usernameText: Phaser.GameObjects.Text;
  private passwordText: Phaser.GameObjects.Text;
  private errorText: Phaser.GameObjects.Text;
  private usernameField: Phaser.GameObjects.Rectangle;
  private passwordField: Phaser.GameObjects.Rectangle;
  private cursorTimer: Phaser.Time.TimerEvent;
  private cursorVisible: boolean = true;
  private cursor: Phaser.GameObjects.Text;

  constructor() {
    super({ key: "login" });
  }

  create() {
    // Initialize Colyseus client
    this.client = new Client("http://localhost:2567");
    //this.client = new Client("https://platformer-bcdf5c8186fd.herokuapp.com");
    this.registry.set("client", this.client);

    // Create Phaser UI elements for login form
    this.createLoginForm();

    // Setup cursor blink timer
    this.cursorTimer = this.time.addEvent({
      delay: 500,
      callback: this.blinkCursor,
      callbackScope: this,
      loop: true,
    });
  }

  private createLoginForm() {
    const { width, height } = this.scale;
    const centerX = width / 2;
    const centerY = height / 2;

    // Create background panel
    const panel = this.add.rectangle(centerX, centerY, 400, 300, 0x000000, 0.8);
    panel.setStrokeStyle(2, 0xffffff);

    // Title
    this.add
      .text(centerX, centerY - 120, "Login", {
        fontSize: "32px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    // Username field
    this.add
      .text(centerX - 150, centerY - 60, "Username:", {
        fontSize: "18px",
        color: "#ffffff",
      })
      .setOrigin(0, 0.5);

    const usernameField = this.add.rectangle(
      centerX + 50,
      centerY - 60,
      200,
      30,
      0x333333
    );
    usernameField.setStrokeStyle(1, 0xffffff);
    usernameField.setInteractive({ useHandCursor: true });

    // Store reference to the field for highlighting
    this.usernameField = usernameField;

    this.usernameText = this.add
      .text(centerX - 45, centerY - 60, "", {
        fontSize: "18px",
        color: "#ffffff",
      })
      .setOrigin(0, 0.5);

    // Password field
    this.add
      .text(centerX - 150, centerY, "Password:", {
        fontSize: "18px",
        color: "#ffffff",
      })
      .setOrigin(0, 0.5);

    const passwordField = this.add.rectangle(
      centerX + 50,
      centerY,
      200,
      30,
      0x333333
    );
    passwordField.setStrokeStyle(1, 0xffffff);
    passwordField.setInteractive({ useHandCursor: true });

    // Store reference to the field for highlighting
    this.passwordField = passwordField;

    this.passwordText = this.add
      .text(centerX - 45, centerY, "", {
        fontSize: "18px",
        color: "#ffffff",
      })
      .setOrigin(0, 0.5);

    // Login button
    const loginButton = this.add.rectangle(
      centerX - 60,
      centerY + 60,
      100,
      40,
      0x4a6fa5
    );
    loginButton.setStrokeStyle(1, 0xffffff);
    loginButton
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => loginButton.setFillStyle(0x5a7fb5))
      .on("pointerout", () => loginButton.setFillStyle(0x4a6fa5))
      .on("pointerdown", () => this.handleLogin());

    this.add
      .text(centerX - 60, centerY + 60, "Login", {
        fontSize: "18px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    // Register button
    const registerButton = this.add.rectangle(
      centerX + 60,
      centerY + 60,
      100,
      40,
      0x4a6fa5
    );
    registerButton.setStrokeStyle(1, 0xffffff);
    registerButton
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => registerButton.setFillStyle(0x5a7fb5))
      .on("pointerout", () => registerButton.setFillStyle(0x4a6fa5))
      .on("pointerdown", () => this.handleRegister());

    this.add
      .text(centerX + 60, centerY + 60, "Register", {
        fontSize: "18px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    // Error text
    this.errorText = this.add
      .text(centerX, centerY + 100, "", {
        fontSize: "16px",
        color: "#ff0000",
      })
      .setOrigin(0.5);

    // Create cursor
    this.cursor = this.add
      .text(0, 0, "|", {
        fontSize: "18px",
        color: "#ffffff",
      })
      .setOrigin(0, 0.5);

    // Set up keyboard input
    this.input.keyboard.on("keydown", (event) => {
      if (event.keyCode === 8) {
        // Backspace
        if (this.focusedField === "username" && this.username.length > 0) {
          this.username = this.username.slice(0, -1);
          this.updateUsernameDisplay();
        } else if (
          this.focusedField === "password" &&
          this.password.length > 0
        ) {
          this.password = this.password.slice(0, -1);
          this.updatePasswordDisplay();
        }
      } else if (event.keyCode === 13) {
        // Enter
        this.handleLogin();
      } else if (event.keyCode === 9) {
        // Tab
        event.preventDefault();
        this.focusedField =
          this.focusedField === "username" ? "password" : "username";
        this.updateFieldHighlights();
      } else if (event.key.length === 1) {
        // Regular character
        if (this.focusedField === "username") {
          this.username += event.key;
          this.updateUsernameDisplay();
        } else if (this.focusedField === "password") {
          this.password += event.key;
          this.updatePasswordDisplay();
        }
      }
    });

    // Set initial focus
    this.focusedField = "username";
    this.updateFieldHighlights();
    this.updateCursorPosition();

    // Make fields clickable to focus
    usernameField.on("pointerdown", () => {
      this.focusedField = "username";
      this.updateFieldHighlights();
    });

    passwordField.on("pointerdown", () => {
      this.focusedField = "password";
      this.updateFieldHighlights();
    });
  }

  private focusedField: "username" | "password" = "username";

  private updateUsernameDisplay() {
    this.usernameText.setText(this.username);
    this.updateCursorPosition();
  }

  private updatePasswordDisplay() {
    // Show asterisks for password
    this.passwordText.setText("*".repeat(this.password.length));
    this.updateCursorPosition();
  }

  private updateFieldHighlights() {
    // Highlight the focused field
    if (this.focusedField === "username") {
      this.usernameField.setStrokeStyle(2, 0x00ff00);
      this.passwordField.setStrokeStyle(1, 0xffffff);
    } else {
      this.usernameField.setStrokeStyle(1, 0xffffff);
      this.passwordField.setStrokeStyle(2, 0x00ff00);
    }
  }

  private async handleLogin() {
    if (!this.username || !this.password) {
      this.errorText.setText("Username and password are required");
      return;
    }

    try {
      const response = await fetch(
        "http://localhost:2567/auth/login",
        //"https://platformer-bcdf5c8186fd.herokuapp.com/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: this.username,
            password: this.password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        this.errorText.setText(data.error);
        return;
      }

      this.registry.set("playerData", data.playerData);
      this.registry.set("password", this.password);

      // Connect to the last room or default to field
      const lastRoom = data.playerData.lastRoom || "field";
      await this.connectToRoom(lastRoom);
    } catch (error) {
      console.error("Login error:", error);
      this.errorText.setText("Error connecting to server");
    }
  }

  private async handleRegister() {
    if (!this.username || !this.password) {
      this.errorText.setText("Username and password are required");
      return;
    }

    try {
      const response = await fetch(
        "http://localhost:2567/auth/register",
        //"https://platformer-bcdf5c8186fd.herokuapp.com/auth/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: this.username,
            password: this.password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        this.errorText.setText(data.error);
        return;
      }

      // After successful registration, attempt login
      await this.handleLogin();
    } catch (error) {
      this.errorText.setText("Error connecting to server");
      console.error(error);
    }
  }

  private async connectToRoom(roomName: string) {
    try {
      const playerData = this.registry.get("playerData");

      console.log("CONNECTING TO ROOM:", roomName);
      const room = await this.client.join(roomName, {
        username: playerData.username,
        password: this.registry.get("password"),
      });

      // Store room reference in registry
      this.registry.set("room", room);

      // Start the game scene
      console.log("STARTING GAME SCENE:", roomName);
      this.scene.start(roomName);
    } catch (error) {
      console.error("Room connection error:", error);
      this.errorText.setText("Error joining room");
    }
  }

  private blinkCursor() {
    this.cursorVisible = !this.cursorVisible;
    this.updateCursorPosition();
  }

  private updateCursorPosition() {
    if (!this.cursor) return;

    const textObj =
      this.focusedField === "username" ? this.usernameText : this.passwordText;
    const text =
      this.focusedField === "username"
        ? this.username
        : "*".repeat(this.password.length);

    // Calculate cursor position based on text width
    const textWidth = textObj.width;
    const cursorX = textObj.x + textWidth;
    const cursorY = textObj.y;

    // Update cursor position and visibility
    this.cursor.setPosition(cursorX, cursorY);
    this.cursor.setVisible(this.cursorVisible);
  }

  shutdown() {
    // Stop the cursor blink timer
    if (this.cursorTimer) {
      this.cursorTimer.destroy();
    }

    // Stop the chat scene if it's active when logging out
    if (this.scene.get("chat") && this.scene.isActive("chat")) {
      this.scene.stop("chat");
    }
  }
}

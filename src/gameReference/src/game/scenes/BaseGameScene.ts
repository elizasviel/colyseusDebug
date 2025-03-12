import Phaser from "phaser";
import { Room, Client } from "colyseus.js";

export class BaseGameScene extends Phaser.Scene {
  // Health bar UI elements
  protected healthBarBackground: Phaser.GameObjects.Rectangle;
  protected healthBar: Phaser.GameObjects.Rectangle;
  protected healthText: Phaser.GameObjects.Text;
  protected playerHealth: number = 100;
  protected playerMaxHealth: number = 100;
  protected isPlayerInvulnerable: boolean = false;

  // Container for health bar elements
  protected healthBarContainer: Phaser.GameObjects.Container;

  // Common properties for game scenes
  public room: Room;
  public client: Client;
  public currentPlayer: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  public playerEntities: {
    [username: string]: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  } = {};
  public monsterEntities: {
    [index: number]: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  } = {};
  public lootEntities: {
    [index: number]: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  } = {};
  public playerNameTags: { [username: string]: Phaser.GameObjects.Text } = {};
  public monsterHealthBars: { [index: number]: Phaser.GameObjects.Container } =
    {};
  public monsterNameTags: { [index: number]: Phaser.GameObjects.Text } = {};
  public chatFocused: boolean = false;

  // Tilemap-related properties
  protected map: Phaser.Tilemaps.Tilemap;
  protected tileset: Phaser.Tilemaps.Tileset;
  protected layer: Phaser.Tilemaps.TilemapLayer;

  // Reference objects
  protected localRef: Phaser.GameObjects.Rectangle;
  protected remoteRef: Phaser.GameObjects.Rectangle;

  // Input-related properties
  protected cursorKeys: Phaser.Types.Input.Keyboard.CursorKeys;
  protected collectKey: Phaser.Input.Keyboard.Key;
  protected wKey: Phaser.Input.Keyboard.Key;
  protected aKey: Phaser.Input.Keyboard.Key;
  protected sKey: Phaser.Input.Keyboard.Key;
  protected dKey: Phaser.Input.Keyboard.Key;

  // Time-related properties
  protected elapsedTime = 0;
  protected fixedTimeStep = 1000 / 60;
  protected currentTick = 0;

  // Collision-related properties
  protected obstacles: Phaser.GameObjects.Rectangle[] = [];

  // Input payload structure
  protected inputPayload = {
    left: false,
    right: false,
    up: false,
    down: false,
    jump: false,
    attack: false,
    loot: false,
    tick: 0,
    username: "",
  };

  // Networking-related properties
  protected portalCooldown = 0;
  protected pendingInputs: any[] = [];
  protected reconciliationThreshold = 5;

  // Setter for player entity
  public updateHealthBarPosition(playerEntity: any) {
    if (!this.healthBarContainer || !playerEntity) return;

    // Position the health bar container above the player but below the name tag
    this.healthBarContainer.x = playerEntity.x;
    // Position it further down from the name tag
    this.healthBarContainer.y = playerEntity.y - 30; // Moved down to create more space with name tag

    // Make sure the health bar is visible
    this.healthBarContainer.setVisible(true);
    this.healthBarContainer.setAlpha(1);
  }

  protected createHealthBar() {
    // Destroy existing health bar elements if they exist
    if (this.healthBarBackground) {
      this.healthBarBackground.destroy();
    }
    if (this.healthBar) {
      this.healthBar.destroy();
    }
    if (this.healthText) {
      this.healthText.destroy();
    }
    if (this.healthBarContainer) {
      this.healthBarContainer.destroy();
    }

    // Create a container for all health bar elements
    this.healthBarContainer = this.add.container(0, 0);
    this.healthBarContainer.setDepth(1000);

    // Create health bar rectangle (green by default)
    this.healthBar = this.add.rectangle(0, 5, 66, 8, 0x00ff00);
    this.healthBar.setOrigin(0.5, 0.5);

    // Add health text
    this.healthText = this.add.text(
      0,
      5,
      `${Math.ceil(this.playerHealth)}/${this.playerMaxHealth}`,
      {
        fontSize: "10px",
        color: "#ffffff",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 2,
      }
    );
    this.healthText.setOrigin(0.5, 0.5);

    this.healthBarContainer.add(this.healthBar);
    this.healthBarContainer.add(this.healthText);

    // Update the health bar display
    this.updateHealthBar();
  }

  protected updateHealthBar() {
    if (!this.healthBar) {
      console.warn("Health bar not initialized when trying to update");
      return;
    }

    // Calculate health percentage
    const healthPercent = Math.max(
      0,
      Math.min(1, this.playerHealth / this.playerMaxHealth)
    );

    // Get the original width from the background
    const fullWidth = this.healthBarBackground
      ? this.healthBarBackground.width
      : 66;

    // Update the width of the health bar
    this.healthBar.width = fullWidth * healthPercent;

    // Choose color based on health percentage
    let color = 0x00ff00; // Green
    if (healthPercent < 0.6) {
      color = 0xffff00; // Yellow
    }
    if (healthPercent < 0.3) {
      color = 0xff0000; // Red
    }

    // Set the color
    this.healthBar.fillColor = color;

    // Update text
    if (this.healthText) {
      this.healthText.setText(
        `${Math.ceil(this.playerHealth)}/${this.playerMaxHealth}`
      );
    }

    // Flash effect for invulnerability
    if (this.isPlayerInvulnerable) {
      this.healthBar.fillColor = 0xffffff;

      // Schedule it to return to normal color
      this.time.delayedCall(100, () => {
        this.healthBar.fillColor = color;
      });
    }
  }

  protected updateInvulnerabilityEffect(
    currentPlayer: Phaser.GameObjects.Sprite
  ) {
    if (!currentPlayer) return;

    // Apply visual effect for invulnerability (flashing)
    if (this.isPlayerInvulnerable) {
      // Flash the player every 100ms during invulnerability
      const flashRate = 100;
      const shouldBeVisible = Math.floor(this.time.now / flashRate) % 2 === 0;

      if (shouldBeVisible) {
        currentPlayer.setAlpha(1);
        currentPlayer.setTint(0xffffff);
      } else {
        currentPlayer.setAlpha(0.7);
        currentPlayer.setTint(0xff9999);
      }
    } else {
      // Reset to normal when not invulnerable
      currentPlayer.setAlpha(1);
      currentPlayer.clearTint();
    }
  }

  protected handlePlayerHealthChange(
    player: any,
    currentPlayer: Phaser.GameObjects.Sprite
  ) {
    // Check if health or invulnerability status changed
    if (
      this.playerHealth !== player.currentHealth ||
      this.isPlayerInvulnerable !== player.isInvulnerable
    ) {
      // Check if player took damage
      if (this.playerHealth > player.currentHealth) {
        // Flash the player sprite red to indicate damage
        currentPlayer.setTint(0xff0000);
        this.time.delayedCall(200, () => {
          currentPlayer.clearTint();
        });
      }

      // Update health values
      this.playerHealth = player.currentHealth;
      this.playerMaxHealth = player.maxHealth;
      this.isPlayerInvulnerable = player.isInvulnerable;

      // Update the health bar UI
      this.updateHealthBar();
    }
  }

  /**
   * Sets up loot handlers for the room state
   * @param room The Colyseus room
   */
  protected setupLootHandlers() {
    if (!this.room || !this.room.state.spawnedLoot) return;

    // Clear existing loot entities when setting up handlers
    // This prevents stale references after room transitions
    Object.values(this.lootEntities).forEach((entity) => {
      if (entity && entity.destroy) {
        entity.destroy();
      }
    });
    this.lootEntities = {};

    this.room.state.spawnedLoot.onAdd((loot, index) => {
      const entity = this.physics.add.sprite(loot.x, loot.y, "coin");
      entity.setDisplaySize(16, 16);

      // Store the loot ID on the entity for better tracking
      entity.setData("lootId", loot.id);
      entity.setData("lootIndex", index);

      this.lootEntities[index] = entity;

      this.updateLootAnimation(entity, loot);

      loot.onChange(() => {
        entity.setData("serverX", loot.x);
        entity.setData("serverY", loot.y);

        // Add handling for collection state changes
        if (loot.isBeingCollected && !entity.getData("beingCollected")) {
          entity.setData("beingCollected", true);
        }
      });
    });

    this.room.state.spawnedLoot.onRemove((loot, index) => {
      const entity = this.lootEntities[index];
      if (entity) {
        this.tweens.add({
          targets: entity,
          alpha: 0,
          y: entity.y - 20,
          duration: 200,
          onComplete: () => {
            if (entity.destroy) {
              entity.destroy();
            }
            delete this.lootEntities[index];
          },
        });
      } else {
        console.warn(
          `MAP: Could not find loot entity with index ${index} to remove`
        );
        // Log all current loot entities for debugging
        console.log(
          "MAP: Current loot entity keys:",
          Object.keys(this.lootEntities)
        );
      }
    });
  }

  /**
   * Updates the loot animation based on the loot type
   * @param entity The loot entity sprite
   * @param loot The loot data
   */
  protected updateLootAnimation(entity, loot) {
    // Apply different tints based on coin type
    if (loot.name.includes("Small Coin")) {
      // Bronze tint for small coins
      entity.setTint(0xcd7f32);
    } else if (loot.name.includes("Medium Coin")) {
      // Silver tint for medium coins - using a more bluish silver to distinguish from gold
      entity.setTint(0xa8b8c0);
    } else if (loot.name.includes("Large Coin")) {
      // Gold tint (no tint/default) for large coins
      entity.clearTint();
    }

    // Play the coin spin animation for all coin types
    entity.play("coin-spin", true);
  }

  /**
   * Checks for collision between a player and an obstacle
   * @param player The player entity
   * @param obstacle The obstacle entity
   * @returns True if collision detected, false otherwise
   */
  protected checkCollision(
    player: Phaser.Types.Physics.Arcade.ImageWithDynamicBody,
    obstacle:
      | Phaser.GameObjects.Rectangle
      | Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
  ): boolean {
    const playerSize = 16;
    const obstacleHalfWidth = obstacle.width / 2;
    const obstacleHalfHeight = obstacle.height / 2;

    const playerLeft = player.x - playerSize;
    const playerRight = player.x + playerSize;
    const playerTop = player.y - playerSize;
    const playerBottom = player.y + playerSize;

    const obstacleLeft = obstacle.x - obstacleHalfWidth;
    const obstacleRight = obstacle.x + obstacleHalfWidth;
    const obstacleTop = obstacle.y - obstacleHalfHeight;
    const obstacleBottom = obstacle.y + obstacleHalfHeight;

    const isOneWayPlatform = obstacle.getData("isOneWayPlatform");

    if (isOneWayPlatform) {
      const velocityY = player.getData("velocityY") || 0;
      const prevY = player.getData("prevY") || player.y;
      const prevPlayerBottom = prevY + playerSize;

      if (velocityY >= 0 && prevPlayerBottom <= obstacleTop) {
        return (
          playerRight > obstacleLeft &&
          playerLeft < obstacleRight &&
          playerBottom > obstacleTop &&
          playerTop < obstacleBottom
        );
      }
      return false;
    }

    return (
      playerRight > obstacleLeft &&
      playerLeft < obstacleRight &&
      playerBottom > obstacleTop &&
      playerTop < obstacleBottom
    );
  }

  /**
   * Checks for collision between a player and a portal
   * @param player The player entity
   * @param portal The portal entity
   * @returns True if collision detected, false otherwise
   */
  protected checkPortalCollision(
    player: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody,
    portal: any
  ): boolean {
    const playerSize = 16;
    const portalHalfWidth = portal.width / 2;
    const portalHalfHeight = portal.height / 2;

    const playerLeft = player.x - playerSize;
    const playerRight = player.x + playerSize;
    const playerTop = player.y - playerSize;
    const playerBottom = player.y + playerSize;

    const portalLeft = portal.x - portalHalfWidth;
    const portalRight = portal.x + portalHalfWidth;
    const portalTop = portal.y - portalHalfHeight;
    const portalBottom = portal.y + portalHalfHeight;

    return (
      playerRight > portalLeft &&
      playerLeft < portalRight &&
      playerBottom > portalTop &&
      playerTop < portalBottom
    );
  }

  /**
   * Handles portal collision and scene transition
   * @param portal The portal entity
   */
  protected async handlePortalCollision(portal: any) {
    try {
      this.shutdown(this.scene.key);
      const playerData = this.registry.get("playerData");
      const password = this.registry.get("password");

      if (!playerData?.username || !password) {
        console.error("Missing credentials for room transition");
        this.scene.start("login");
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      const newRoom = await this.client.join(portal.targetRoom, {
        username: playerData.username,
        password: password,
        targetX: portal.targetX,
        targetY: portal.targetY,
      });

      this.registry.set("room", newRoom);
      this.scene.start(portal.targetRoom);
    } catch (error) {
      console.error("Error handling portal collision:", error);
      this.scene.start("login");
    }
  }

  protected setupPortalCollisions() {
    if (!this.room || !this.room.state || !this.room.state.portals) {
      return;
    }

    this.room.state.portals.onAdd((portal) => {
      const portalRect = this.add.rectangle(
        portal.x,
        portal.y,
        portal.width,
        portal.height,
        0x00ffff,
        0.3
      );

      this.add
        .text(
          portal.x,
          portal.y - portal.height / 2 - 20,
          `To ${portal.targetRoom}`,
          { fontSize: "16px", color: "#ffffff" }
        )
        .setOrigin(0.5);
    });
  }

  protected handleServerReconciliation(serverPlayer) {
    if (!this.currentPlayer) return;

    const serverTick = serverPlayer.lastProcessedTick || 0;

    this.pendingInputs = this.pendingInputs.filter(
      (input) => input.tick > serverTick
    );

    const dx = Math.abs(this.currentPlayer.x - serverPlayer.x);
    const dy = Math.abs(this.currentPlayer.y - serverPlayer.y);

    if (
      dx > this.reconciliationThreshold ||
      dy > this.reconciliationThreshold
    ) {
      this.currentPlayer.x = serverPlayer.x;
      this.currentPlayer.y = serverPlayer.y;
      this.currentPlayer.setData("velocityX", serverPlayer.velocityX);
      this.currentPlayer.setData("velocityY", serverPlayer.velocityY);

      // Reapply pending inputs
      this.pendingInputs.forEach((input) => {
        this.applyInput(input);
      });
    }

    // Update health and invulnerability status using the base class method
    this.handlePlayerHealthChange(serverPlayer, this.currentPlayer);
  }

  protected updatePlayerAnimations() {
    if (!this.currentPlayer || !this.currentPlayer.scene) return;

    if (this.currentPlayer.getData("isAttacking")) {
      this.currentPlayer.play("character-attack", true);
    } else if (!this.currentPlayer.getData("canJump")) {
      this.currentPlayer.play("character-jump", true);
    } else if (this.inputPayload.left || this.inputPayload.right) {
      this.currentPlayer.play("character-run", true);
    } else {
      this.currentPlayer.play("character-idle", true);
    }

    if (this.inputPayload.left) {
      this.currentPlayer.setFlipX(true);
    } else if (this.inputPayload.right) {
      this.currentPlayer.setFlipX(false);
    }
  }

  protected applyInput(input) {
    if (!this.currentPlayer) return;

    const horizontalVelocity = 2;
    const gravity = 0.5;
    const jumpVelocity = -12;

    // Store previous position for collision resolution
    this.currentPlayer.setData("prevX", this.currentPlayer.x);
    this.currentPlayer.setData("prevY", this.currentPlayer.y);

    // Reset horizontal velocity
    this.currentPlayer.setData("velocityX", 0);

    // Handle horizontal movement
    if (!this.currentPlayer.getData("isAttacking")) {
      if (input.left) {
        this.currentPlayer.x -= horizontalVelocity;
        this.currentPlayer.setData("velocityX", -horizontalVelocity);

        // Check horizontal collisions
        for (const obstacle of this.obstacles) {
          if (this.checkCollision(this.currentPlayer, obstacle)) {
            this.currentPlayer.x = this.currentPlayer.getData("prevX");
            this.currentPlayer.setData("velocityX", 0);
            break;
          }
        }
      } else if (input.right) {
        this.currentPlayer.x += horizontalVelocity;
        this.currentPlayer.setData("velocityX", horizontalVelocity);

        // Check horizontal collisions
        for (const obstacle of this.obstacles) {
          if (this.checkCollision(this.currentPlayer, obstacle)) {
            this.currentPlayer.x = this.currentPlayer.getData("prevX");
            this.currentPlayer.setData("velocityX", 0);
            break;
          }
        }
      }

      // Handle jumping
      if (input.jump && this.currentPlayer.getData("canJump")) {
        this.currentPlayer.setData("velocityY", jumpVelocity);
        this.currentPlayer.setData("canJump", false); // Set canJump to false when jumping
      }
    }

    // Apply gravity
    let velocityY = this.currentPlayer.getData("velocityY") || 0;
    velocityY += gravity;
    this.currentPlayer.setData("velocityY", velocityY);

    // Apply vertical movement
    this.currentPlayer.y += velocityY;

    // Reset canJump to false before checking collisions
    let canJump = false;

    // Check vertical collisions
    for (const obstacle of this.obstacles) {
      if (this.checkCollision(this.currentPlayer, obstacle)) {
        const playerBottom = this.currentPlayer.getData("prevY") + 16; // half player height
        const obstacleTop = obstacle.y - obstacle.height / 2;

        if (playerBottom <= obstacleTop) {
          // Landing on top of platform
          this.currentPlayer.y = obstacleTop - 16;
          this.currentPlayer.setData("velocityY", 0);
          canJump = true; // Set canJump to true when on ground
        } else {
          // Other vertical collisions
          this.currentPlayer.y = this.currentPlayer.getData("prevY");
          this.currentPlayer.setData("velocityY", 0);
        }
        break;
      }
    }
    this.currentPlayer.setData("canJump", canJump);

    // Update local reference for debugging
    //this.localRef.x = this.currentPlayer.x;
    //this.localRef.y = this.currentPlayer.y;

    // Update animations based on state
    this.updatePlayerAnimations();

    // Update name tag position for current player
    const username = this.registry.get("playerData").username;
    if (this.playerNameTags[username]) {
      this.playerNameTags[username].setPosition(
        this.currentPlayer.x,
        this.currentPlayer.y - 30
      );
    }
  }

  protected updateOtherPlayersEffects() {
    if (!this.room || !this.room.state || !this.room.state.spawnedPlayers) {
      return;
    }

    const currentUsername = this.registry.get("playerData").username;

    // Loop through all players except the current player
    this.room.state.spawnedPlayers.forEach((player) => {
      if (player.username === currentUsername) {
        return; // Skip current player
      }

      const entity = this.playerEntities[player.username];
      if (!entity) {
        return;
      }

      // Apply invulnerability effect
      if (player.isInvulnerable) {
        // Flash the player every 100ms during invulnerability
        const flashRate = 100;
        const shouldBeVisible = Math.floor(this.time.now / flashRate) % 2 === 0;

        if (shouldBeVisible) {
          entity.setAlpha(1);
          entity.setTint(0xffffff);
        } else {
          entity.setAlpha(0.7);
          entity.setTint(0xff9999);
        }
      } else {
        // Reset to normal when not invulnerable
        entity.setAlpha(1);
        entity.clearTint();
      }
    });
  }

  protected fixedTick(time, delta) {
    if (!this.currentPlayer || !this.room) {
      return;
    }

    this.currentTick++;

    // Only process input if chat is not focused
    if (!this.chatFocused) {
      this.inputPayload.left = this.aKey.isDown;
      this.inputPayload.right = this.dKey.isDown;
      this.inputPayload.up = this.wKey.isDown;
      this.inputPayload.down = this.sKey.isDown;
      this.inputPayload.jump = this.cursorKeys.space.isDown;
      this.inputPayload.loot = this.collectKey.isDown;
      this.inputPayload.attack = !!this.currentPlayer.getData("queuedAttack");
    } else {
      // Reset all inputs when chat is focused
      this.inputPayload.left = false;
      this.inputPayload.right = false;
      this.inputPayload.up = false;
      this.inputPayload.down = false;
      this.inputPayload.jump = false;
      this.inputPayload.loot = false;
      this.inputPayload.attack = false;
    }

    this.inputPayload.tick = this.currentTick;

    const input = { ...this.inputPayload };

    this.applyInput(input);

    this.pendingInputs.push(input);

    if (this.room && this.room.connection.isOpen) {
      this.room.send(0, this.inputPayload);
      this.currentPlayer.setData("queuedAttack", false);
    }

    //this.localRef.x = this.currentPlayer.x;
    //this.localRef.y = this.currentPlayer.y;

    this.updatePlayerAnimations();

    // Update the interpolation for other players
    for (let username in this.playerEntities) {
      if (username === this.registry.get("playerData").username) {
        continue;
      }

      const entity = this.playerEntities[username];
      if (!entity || !entity.scene || !entity.data?.values) {
        continue;
      }

      const { serverX, serverY, isAttacking, canJump, velocityX } =
        entity.data.values;

      if (serverX !== undefined && serverY !== undefined) {
        entity.x = Phaser.Math.Linear(entity.x, serverX, 0.4);
        entity.y = Phaser.Math.Linear(entity.y, serverY, 0.6);

        // Fix animation logic for other players
        if (isAttacking) {
          entity.play("character-attack", true);
        } else if (!canJump) {
          // Play jump animation if not on ground (canJump is false)
          // This takes priority over running when in the air
          entity.play("character-jump", true);
        } else if (velocityX !== 0) {
          // Play run animation if moving horizontally and on the ground
          entity.play("character-run", true);
        } else {
          // Default to idle when on ground and not moving
          entity.play("character-idle", true);
        }

        // Allow flipping for other players based on horizontal velocity
        if (velocityX < 0) {
          entity.setFlipX(true);
        } else if (velocityX > 0) {
          entity.setFlipX(false);
        }
      }
    }

    // Update monster positions with interpolation
    Object.values(this.monsterEntities).forEach((entity) => {
      if (!entity || !entity.scene || !entity.data?.values) {
        return;
      }

      const { serverX, serverY } = entity.data.values;
      if (serverX !== undefined && serverY !== undefined) {
        entity.x = Phaser.Math.Linear(entity.x, serverX, 0.4);
        entity.y = Phaser.Math.Linear(entity.y, serverY, 0.6);
      }
    });

    // Update loot positions with interpolation
    Object.entries(this.lootEntities).forEach(([index, entity]) => {
      if (!entity || !entity.scene || !entity.data?.values) {
        delete this.lootEntities[index];
        return;
      }

      const { serverX, serverY } = entity.data.values;
      if (serverX !== undefined && serverY !== undefined) {
        entity.x = Phaser.Math.Linear(entity.x, serverX, 0.4);
        entity.y = Phaser.Math.Linear(entity.y, serverY, 0.6);
      }
    });

    // Decrement portal cooldown if it's active
    if (this.portalCooldown > 0) {
      this.portalCooldown--;
    }

    // Check portal collisions only if cooldown is expired and W is pressed
    if (
      this.currentPlayer &&
      this.room &&
      this.room.state.portals &&
      this.portalCooldown <= 0 &&
      this.wKey.isDown
    ) {
      for (const portal of this.room.state.portals) {
        if (this.checkPortalCollision(this.currentPlayer, portal)) {
          this.portalCooldown = 60; // Set cooldown to 1 second (60 ticks at 60fps)
          this.handlePortalCollision(portal);
          break;
        }
      }
    }

    // Update current player's name tag position
    if (this.currentPlayer && this.registry.get("playerData")?.username) {
      const username = this.registry.get("playerData").username;
      if (this.playerNameTags[username]) {
        this.playerNameTags[username].setPosition(
          this.currentPlayer.x,
          this.currentPlayer.y - 30
        );
      }
    }

    // Add this line before applying inputs
    this.preventPlayerStuck();
  }

  protected shutdown(scenekey: string) {
    this.obstacles.forEach((entity) => {
      entity.destroy();
    });
    this.obstacles = [];

    Object.values(this.playerNameTags).forEach((nameTag) => {
      if (nameTag) {
        nameTag.destroy();
      }
    });

    this.playerNameTags = {};

    Object.values(this.monsterHealthBars).forEach((healthBar) => {
      if (healthBar) {
        healthBar.destroy();
      }
    });

    this.monsterHealthBars = {};

    Object.values(this.monsterNameTags).forEach((nameTag) => {
      if (nameTag) {
        nameTag.destroy();
      }
    });

    this.monsterNameTags = {};

    Object.values(this.monsterEntities).forEach((entity) => {
      if (entity) {
        entity.destroy();
      }
    });

    this.monsterEntities = {};

    Object.values(this.lootEntities).forEach((entity) => {
      if (entity) {
        entity.destroy();
      }
    });

    this.lootEntities = {};

    this.cache.tilemap.remove(scenekey);
    this.room.leave();
    this.scene.stop(scenekey);
    this.game.events.off("chat-focused");
  }

  protected createMonsterHealthBar(monster: any, index: number) {
    // Destroy existing health bar if it exists
    if (this.monsterHealthBars[index]) {
      this.monsterHealthBars[index].destroy();
    }

    // Create a container for all health bar elements
    const container = this.add.container(monster.x, monster.y - 15);
    container.setDepth(1000);

    // Create health bar background (black)
    const background = this.add.rectangle(0, 0, 30, 3, 0x000000);
    background.setOrigin(0.5, 0.5);

    // Create health bar rectangle (green by default)
    const healthBar = this.add.rectangle(0, 0, 30, 3, 0x00ff00);
    healthBar.setOrigin(0.5, 0.5);

    // Add elements to container
    container.add(background);
    container.add(healthBar);

    // Store references to the elements
    container.setData("background", background);
    container.setData("healthBar", healthBar);
    container.setData("maxHealth", monster.maxHealth);
    container.setData("currentHealth", monster.currentHealth);

    // Store the container
    this.monsterHealthBars[index] = container;

    // Create name tag if it doesn't exist
    if (!this.monsterNameTags[index]) {
      const nameTag = this.add.text(monster.x, monster.y - 22, monster.name, {
        fontSize: "10px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 2,
        fontFamily: "Arial",
      });
      nameTag.setOrigin(0.5, 0.5);
      nameTag.setDepth(1000);
      this.monsterNameTags[index] = nameTag;
    }

    return container;
  }

  // Update a monster's health bar
  protected updateMonsterHealthBar(monster: any, index: number) {
    const container = this.monsterHealthBars[index];
    if (!container) return;

    // Get the health bar elements
    const background = container.getData("background");
    const healthBar = container.getData("healthBar");
    const maxHealth = container.getData("maxHealth");
    const currentHealth = monster.currentHealth;

    // Calculate health percentage
    const healthPercent = Math.max(0, Math.min(1, currentHealth / maxHealth));

    // Update the width of the health bar
    healthBar.width = background.width * healthPercent;

    // Choose color based on health percentage
    let color = 0x00ff00; // Green
    if (healthPercent < 0.6) {
      color = 0xffff00; // Yellow
    }
    if (healthPercent < 0.3) {
      color = 0xff0000; // Red
    }

    // Set the color
    healthBar.fillColor = color;

    // Update position
    const entity = this.monsterEntities[index];
    if (entity) {
      container.x = entity.x;
      container.y = entity.y - 15;

      // Update name tag position
      const nameTag = this.monsterNameTags[index];
      if (nameTag) {
        nameTag.x = entity.x;
        nameTag.y = entity.y - 22;
      }
    }

    // Update stored health value
    container.setData("currentHealth", currentHealth);
  }

  // Remove a monster's health bar and name tag
  protected removeMonsterHealthBar(index: number) {
    const container = this.monsterHealthBars[index];
    if (container) {
      container.destroy();
      delete this.monsterHealthBars[index];
    }

    const nameTag = this.monsterNameTags[index];
    if (nameTag) {
      nameTag.destroy();
      delete this.monsterNameTags[index];
    }
  }

  // Show damage number effect when a monster takes damage
  protected showDamageNumber(x: number, y: number, damage: number) {
    // Skip if damage is not a positive number
    if (isNaN(damage) || damage <= 0) return;

    // Add a small random offset to make multiple damage numbers not stack exactly
    const offsetX = Phaser.Math.Between(-10, 10);
    const offsetY = Phaser.Math.Between(-5, 0);

    // Determine color based on damage amount (higher damage = more intense color)
    let color = "#ff3333"; // Default red
    if (damage > 20) {
      color = "#ff0000"; // Brighter red for higher damage
    }
    if (damage > 40) {
      color = "#ff9900"; // Orange for even higher damage
    }
    if (damage > 60) {
      color = "#ffff00"; // Yellow for very high damage
    }

    // Create a text object for the damage number
    const damageText = this.add.text(
      x + offsetX,
      y - 15 + offsetY,
      `-${Math.round(damage)}`,
      {
        fontSize: "14px",
        fontFamily: "Arial",
        color: color,
        stroke: "#000000",
        strokeThickness: 3,
        fontStyle: "bold",
        shadow: {
          offsetX: 1,
          offsetY: 1,
          color: "#000",
          blur: 2,
          fill: true,
        },
      }
    );
    damageText.setOrigin(0.5, 0.5);
    damageText.setDepth(1001); // Ensure it appears above other UI elements

    // Add a floating and fading animation
    this.tweens.add({
      targets: damageText,
      y: damageText.y - 40, // Float upward
      alpha: 0, // Fade out
      scale: 1.3, // Grow slightly
      duration: 800,
      ease: "Sine.easeOut",
      onComplete: () => {
        damageText.destroy(); // Remove when animation completes
      },
    });
  }

  protected preventPlayerStuck() {
    // Check if player is stuck in any obstacle
    for (const obstacle of this.obstacles) {
      if (this.checkCollision(this.currentPlayer, obstacle)) {
        // Skip push-out correction for one-way platforms
        if (obstacle.getData("isOneWayPlatform")) {
          continue;
        }

        // Calculate push direction
        const overlapX = Math.min(
          this.currentPlayer.x +
            this.currentPlayer.width / 2 -
            (obstacle.x - obstacle.width / 2),
          obstacle.x +
            obstacle.width / 2 -
            (this.currentPlayer.x - this.currentPlayer.width / 2)
        );
        const overlapY = Math.min(
          this.currentPlayer.y +
            this.currentPlayer.height / 2 -
            (obstacle.y - obstacle.height / 2),
          obstacle.y +
            obstacle.height / 2 -
            (this.currentPlayer.y - this.currentPlayer.height / 2)
        );

        // Push in direction of smallest overlap
        if (overlapX < overlapY) {
          if (this.currentPlayer.x < obstacle.x) {
            this.currentPlayer.x -= overlapX;
          } else {
            this.currentPlayer.x += overlapX;
          }
        } else {
          if (this.currentPlayer.y < obstacle.y) {
            this.currentPlayer.y -= overlapY;
          } else {
            this.currentPlayer.y += overlapY;
          }
        }
      }
    }
  }
}

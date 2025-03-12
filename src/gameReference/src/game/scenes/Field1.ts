import Phaser from "phaser";
import { BaseGameScene } from "./BaseGameScene";

export class Field1 extends BaseGameScene {
  constructor() {
    super({ key: "field1" });
  }

  preload() {
    this.load.image("forest-bg", "assets/landscape.png");
    this.load.image("tileset", "assets/Map/VillageMap/_PNG/MainLevBuild.png");
    this.load.image(
      "buildings",
      "assets/Map/VillageBuildings/_PNG/VP2_Main.png"
    );
    this.load.tilemapTiledJSON("field1-map", "assets/FieldMap1.tmj");
    this.load.spritesheet(
      "character-idle",
      "assets/Character/Idle/Idle-Sheet.png",
      {
        frameWidth: 64,
        frameHeight: 64,
      }
    );
    this.load.spritesheet(
      "character-run",
      "assets/Character/Run/Run-Sheet.png",
      {
        frameWidth: 80,
        frameHeight: 80,
      }
    );
    this.load.spritesheet(
      "character-jump",
      "assets/Character/Jump-All/Jump-All-Sheet.png",
      {
        frameWidth: 64,
        frameHeight: 64,
      }
    );
    this.load.spritesheet(
      "character-attack",
      "assets/Character/Attack-01/Attack-01-Sheet.png",
      {
        frameWidth: 96,
        frameHeight: 80,
      }
    );
    this.load.spritesheet(
      "character-dead",
      "assets/Character/Dead/Dead-Sheet.png",
      {
        frameWidth: 64,
        frameHeight: 64,
      }
    );
    this.load.spritesheet("boar-idle", "assets/Mob/Boar/Idle/Idle-Sheet.png", {
      frameWidth: 48,
      frameHeight: 32,
    });
    this.load.spritesheet("boar-run", "assets/Mob/Boar/Run/Run-Sheet.png", {
      frameWidth: 48,
      frameHeight: 32,
    });
    this.load.spritesheet(
      "boar-walk",
      "assets/Mob/Boar/Walk/Walk-Base-Sheet.png",
      {
        frameWidth: 48,
        frameHeight: 32,
      }
    );
    this.load.spritesheet(
      "boar-vanish",
      "assets/Mob/Boar/Hit-Vanish/Hit-Sheet.png",
      {
        frameWidth: 48,
        frameHeight: 32,
      }
    );
    this.load.spritesheet(
      "bee-walk",
      "assets/Mob/Small Bee/Walk/Walk-Sheet.png",
      {
        frameWidth: 64,
        frameHeight: 64,
      }
    );

    this.load.spritesheet("bee-hit", "assets/Mob/Small Bee/Hit/Hit-Sheet.png", {
      frameWidth: 64,
      frameHeight: 64,
    });

    this.load.spritesheet(
      "black-boar-idle",
      "assets/Mob/Boar/Idle/Idle-Sheet-Black.png",
      {
        frameWidth: 48,
        frameHeight: 32,
      }
    );
    this.load.spritesheet(
      "black-boar-walk",
      "assets/Mob/Boar/Walk/Walk-Base-Sheet-Black.png",
      {
        frameWidth: 48,
        frameHeight: 32,
      }
    );
    this.load.spritesheet(
      "black-boar-vanish",
      "assets/Mob/Boar/Hit-Vanish/Hit-Sheet-Black.png",
      {
        frameWidth: 48,
        frameHeight: 32,
      }
    );
    this.load.spritesheet(
      "black-boar-run",
      "assets/Mob/Boar/Run/Run-Sheet-Black.png",
      {
        frameWidth: 48,
        frameHeight: 32,
      }
    );

    this.load.spritesheet("coin", "assets/Loot/coin.png", {
      frameWidth: 8, // Adjust these values based on your spritesheet
      frameHeight: 8,
    });
  }

  async create() {
    this.room = this.registry.get("room");
    this.client = this.registry.get("client");

    // Make sure the room is in the registry
    if (this.room) {
      // Ensure the room is in the registry for other scenes
      this.registry.set("room", this.room);

      // Start the chat scene
      if (!this.scene.isActive("chat")) {
        this.scene.launch("chat");
      }
    }

    // Create health bar UI
    super.createHealthBar();

    const bg = this.add.image(0, 0, "forest-bg");
    bg.setOrigin(0, 0);
    bg.setScrollFactor(0.6);
    this.map = this.make.tilemap({ key: "field1-map" });
    this.tileset = this.map.addTilesetImage("MainLevBuild", "tileset");
    const buildingsTileset = this.map.addTilesetImage("VP2_Main", "buildings");
    this.layer = this.map.createLayer(
      0,
      [this.tileset, buildingsTileset],
      0,
      0
    );
    const mapWidth = this.map.widthInPixels;
    const mapHeight = this.map.heightInPixels;
    bg.setDisplaySize(mapWidth, mapHeight);
    this.physics.world.setBounds(0, 0, mapWidth, mapHeight);
    this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);
    this.cursorKeys = this.input.keyboard.createCursorKeys();
    this.collectKey = this.input.keyboard.addKey("Z");
    this.wKey = this.input.keyboard.addKey("W");
    this.aKey = this.input.keyboard.addKey("A");
    this.sKey = this.input.keyboard.addKey("S");
    this.dKey = this.input.keyboard.addKey("D");

    this.setupPortalCollisions();

    this.input.on("pointerdown", (pointer) => {
      if (
        pointer.leftButtonDown() &&
        this.room.state.spawnedPlayers.find(
          (player) =>
            player.username === this.registry.get("playerData").username
        )?.canAttack
      ) {
        this.currentPlayer.setData("queuedAttack", true);
        this.currentPlayer.setData("isAttacking", true);
        setTimeout(() => {
          this.currentPlayer.setData("isAttacking", false);
        }, 500);
      }
    });

    this.room.state.obstacles.onAdd((obstacle) => {
      const sprite = this.add.rectangle(
        obstacle.x,
        obstacle.y,
        obstacle.width,
        obstacle.height
      );

      if (obstacle.isOneWayPlatform) {
        sprite.setData("isOneWayPlatform", true);
      }

      this.obstacles.push(sprite);
    });

    this.room.state.spawnedPlayers.onAdd((player) => {
      const entity = this.physics.add.sprite(
        player.x,
        player.y,
        "character-idle"
      );
      entity.setDisplaySize(48, 48);
      entity.setOrigin(0.5, 0.65);
      this.playerEntities[player.username] = entity;

      // Add name tag above player
      const nameTag = this.add.text(player.x, player.y - 65, player.username, {
        fontSize: "14px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 3,
        fontFamily: "Arial",
      });
      nameTag.setOrigin(0.5, 1);
      this.playerNameTags[player.username] = nameTag;

      if (player.username === this.registry.get("playerData").username) {
        this.currentPlayer = entity;

        this.cameras.main.startFollow(this.currentPlayer, true, 0.1, 0.1);
        this.cameras.main.setZoom(2);
        this.inputPayload.username = player.username;
        //this.localRef = this.add.rectangle(0, 0, entity.width, entity.height);
        //this.localRef.setStrokeStyle(1, 0x00ff00);
        //this.remoteRef = this.add.rectangle(0, 0, entity.width, entity.height);
        //this.remoteRef.setStrokeStyle(1, 0xff0000);

        // Initialize health values
        this.playerHealth = player.currentHealth;
        this.playerMaxHealth = player.maxHealth;
        this.isPlayerInvulnerable = player.isInvulnerable;

        // Update the health bar with current values
        this.updateHealthBar();

        player.onChange(() => {
          //this.remoteRef.x = player.x;
          //this.remoteRef.y = player.y;

          this.handleServerReconciliation(player);
        });
      } else {
        player.onChange(() => {
          entity.setData("serverX", player.x);
          entity.setData("serverY", player.y);
          entity.setData("velocityX", player.velocityX);
          entity.setData("velocityY", player.velocityY);
          entity.setData("canJump", player.canJump);
          entity.setData("canAttack", player.canAttack);
          entity.setData("canLoot", player.canLoot);
          entity.setData("isAttacking", player.isAttacking);
          entity.setData("height", player.height);
          entity.setData("width", player.width);
          entity.setData("experience", player.experience);
          entity.setData("level", player.level);
          entity.setData("username", player.username);
          entity.setData("id", player.id);

          // Check if health changed
          const prevHealth =
            entity.getData("currentHealth") || player.currentHealth;
          if (prevHealth > player.currentHealth) {
            // Player took damage, flash red
            entity.setTint(0xff0000);
            this.time.delayedCall(200, () => {
              entity.clearTint();
            });
          }

          // Update health data
          entity.setData("currentHealth", player.currentHealth);
          entity.setData("maxHealth", player.maxHealth);
          entity.setData("isInvulnerable", player.isInvulnerable);

          // Update name tag position
          if (this.playerNameTags[player.username]) {
            this.playerNameTags[player.username].setPosition(
              player.x,
              player.y - 65
            );
          }
        });
      }

      this.anims.create({
        key: "character-idle",
        frames: this.anims.generateFrameNumbers("character-idle", {
          start: 0,
          end: 3,
        }),
        frameRate: 8,
        repeat: -1,
      });
      this.anims.create({
        key: "character-run",
        frames: this.anims.generateFrameNumbers("character-run", {
          start: 0,
          end: 7,
        }),
        frameRate: 12,
        repeat: -1,
      });
      this.anims.create({
        key: "character-jump",
        frames: this.anims.generateFrameNumbers("character-jump", {
          start: 0,
          end: 14,
        }),
        frameRate: 15,
        repeat: 0,
      });
      this.anims.create({
        key: "character-attack",
        frames: this.anims.generateFrameNumbers("character-attack", {
          start: 0,
          end: 7,
        }),
        frameRate: 12,
        repeat: 0,
      });
      this.anims.create({
        key: "character-dead",
        frames: this.anims.generateFrameNumbers("character-dead", {
          start: 0,
          end: 5,
        }),
        frameRate: 10,
        repeat: 0,
      });
      this.anims.create({
        key: "boar-idle",
        frames: this.anims.generateFrameNumbers("boar-idle", {
          start: 0,
          end: 3,
        }),
        frameRate: 8,
        repeat: -1,
      });

      this.anims.create({
        key: "boar-run",
        frames: this.anims.generateFrameNumbers("boar-run", {
          start: 0,
          end: 5,
        }),
        frameRate: 10,
        repeat: -1,
      });

      this.anims.create({
        key: "boar-walk",
        frames: this.anims.generateFrameNumbers("boar-walk", {
          start: 0,
          end: 5,
        }),
        frameRate: 8,
        repeat: -1,
      });

      this.anims.create({
        key: "boar-vanish",
        frames: this.anims.generateFrameNumbers("boar-vanish", {
          start: 0,
          end: 3,
        }),
        frameRate: 12,
        repeat: 0,
      });
      this.anims.create({
        key: "black-boar-idle",
        frames: this.anims.generateFrameNumbers("black-boar-idle", {
          start: 0,
          end: 3,
        }),
        frameRate: 8,
        repeat: -1,
      });

      this.anims.create({
        key: "black-boar-run",
        frames: this.anims.generateFrameNumbers("black-boar-run", {
          start: 0,
          end: 5,
        }),
        frameRate: 10,
        repeat: -1,
      });

      this.anims.create({
        key: "black-boar-walk",
        frames: this.anims.generateFrameNumbers("black-boar-walk", {
          start: 0,
          end: 5,
        }),
        frameRate: 8,
        repeat: -1,
      });

      this.anims.create({
        key: "black-boar-vanish",
        frames: this.anims.generateFrameNumbers("black-boar-vanish", {
          start: 0,
          end: 3,
        }),
        frameRate: 12,
        repeat: 0,
      });

      this.anims.create({
        key: "bee-walk",
        frames: this.anims.generateFrameNumbers("bee-walk", {
          start: 0,
          end: 3,
        }),
        frameRate: 8,
        repeat: -1,
      });

      this.anims.create({
        key: "bee-hit",
        frames: this.anims.generateFrameNumbers("bee-hit", {
          start: 0,
          end: 3,
        }),
      });

      this.anims.create({
        key: "coin-spin",
        frames: this.anims.generateFrameNumbers("coin", {
          start: 0,
          end: 9,
        }),
        frameRate: 10,
        repeat: -1,
      });
    });

    this.room.state.spawnedPlayers.onRemove((player) => {
      const entity = this.playerEntities[player.username];
      if (entity) {
        entity.destroy();
        delete this.playerEntities[player.username];
      }

      // Remove name tag
      const nameTag = this.playerNameTags[player.username];
      if (nameTag) {
        nameTag.destroy();
        delete this.playerNameTags[player.username];
      }
    });

    this.room.state.spawnedMonsters.onAdd((monster, index) => {
      const monsterName = monster.name;
      console.log(monsterName);
      const entity = this.physics.add.sprite(
        monster.x,
        monster.y,
        monsterName === "Boar"
          ? "boar-idle"
          : monsterName === "Black Boar"
          ? "black-boar-idle"
          : "bee-idle"
      );
      if (monsterName === "Boar") {
        entity.setDisplaySize(48, 32);
      } else if (monsterName === "Black Boar") {
        entity.setScale(2);
        entity.setOrigin(0.5, 0.7);
      } else if (monsterName === "Bee") {
        entity.setOrigin(0.5, 0.7); // Shift up by changing the origin point
      }

      this.monsterEntities[index] = entity;

      // Create health bar and name tag for this monster
      this.createMonsterHealthBar(monster, index);

      monster.onChange((changes) => {
        if (!entity || !entity.anims) {
          return;
        }

        entity.setData("serverX", monster.x);
        entity.setData("serverY", monster.y);
        entity.setData("behaviorState", monster.behaviorState);

        // Store previous health value to detect changes
        const previousHealth =
          entity.getData("currentHealth") || monster.currentHealth;
        entity.setData("currentHealth", monster.currentHealth);

        // Update the monster's health bar
        this.updateMonsterHealthBar(monster, index);

        if (monster.currentHealth <= 0) {
          // Monster died

          // Calculate damage dealt for killing blow
          const damageTaken = Math.max(0, previousHealth);

          // Show damage number effect for killing blow with a slight delay to ensure it's visible
          if (damageTaken > 0) {
            // Add a small delay to make sure the damage number is visible
            this.time.delayedCall(50, () => {
              this.showDamageNumber(entity.x, entity.y, damageTaken);
            });
          }

          entity.play(
            monsterName === "Boar"
              ? "boar-vanish"
              : monsterName === "Black Boar"
              ? "black-boar-vanish"
              : "bee-hit",
            true
          );
          entity.once("animationcomplete", () => {
            if (!entity || !entity.anims) return;

            this.updateMonsterAnimation(entity, monster);
          });
        } else if (previousHealth > monster.currentHealth) {
          // Calculate damage dealt
          const damageTaken = previousHealth - monster.currentHealth;

          // Show damage number effect
          this.showDamageNumber(entity.x, entity.y, damageTaken);

          entity.play(
            monsterName === "Boar"
              ? "boar-vanish"
              : monsterName === "Black Boar"
              ? "black-boar-vanish"
              : "bee-hit",
            true
          );
          entity.once("animationcomplete", () => {
            if (!entity || !entity.anims) return;

            this.updateMonsterAnimation(entity, monster);
          });
        } else if (
          !entity.anims.isPlaying ||
          entity.anims.currentAnim?.key !==
            (monsterName === "Boar"
              ? "boar-vanish"
              : monsterName === "Black Boar"
              ? "black-boar-vanish"
              : "bee-hit")
        ) {
          this.updateMonsterAnimation(entity, monster);
        }

        entity.setFlipX(monster.velocityX > 0);
      });
    });

    this.room.state.spawnedMonsters.onRemove((monster, index) => {
      const entity = this.monsterEntities[index];
      if (entity) {
        entity.destroy();
        delete this.monsterEntities[index];
      }

      // Remove the monster's health bar and name tag
      this.removeMonsterHealthBar(index);
    });

    this.setupLootHandlers();

    // Listen for chat focus events
    this.game.events.on("chat-focused", (focused: boolean) => {
      this.chatFocused = focused;
    });

    // Add Enter key to focus chat
    const enterKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.ENTER
    );
    enterKey.on("down", () => {
      // Only focus chat if it's not already focused
      if (!this.chatFocused) {
        // Emit an event to focus the chat
        this.game.events.emit("focus-chat");
      }
    });
  }

  update(time: number, delta: number): void {
    if (!this.currentPlayer) {
      return;
    }

    this.elapsedTime += delta;
    while (this.elapsedTime >= this.fixedTimeStep) {
      this.elapsedTime -= this.fixedTimeStep;
      this.fixedTick(time, this.fixedTimeStep);
    }

    // Update visual effects for current player invulnerability
    super.updateInvulnerabilityEffect(this.currentPlayer);

    // Update visual effects for other players
    this.updateOtherPlayersEffects();

    // Ensure health bar is updated
    this.updateHealthBar();

    // Position health bar above player
    this.updateHealthBarPosition(this.currentPlayer);

    // Update monster health bars and name tags
    for (const index in this.monsterEntities) {
      const entity = this.monsterEntities[index];
      if (entity) {
        const monster = this.room.state.spawnedMonsters[index];
        if (monster) {
          this.updateMonsterHealthBar(monster, parseInt(index));
        }
      }
    }
  }

  private updateMonsterAnimation(entity, monster) {
    const monsterName = monster.name;
    const behaviorState = monster.behaviorState || "idle";

    switch (behaviorState) {
      case "run":
        entity.play(
          monsterName === "Boar"
            ? "boar-run"
            : monsterName === "Black Boar"
            ? "black-boar-run"
            : "bee-walk",
          true
        );
        break;
      case "walk":
        entity.play(
          monsterName === "Boar"
            ? "boar-walk"
            : monsterName === "Black Boar"
            ? "black-boar-walk"
            : "bee-walk",
          true
        );
        break;
      case "idle":
      default:
        entity.play(
          monsterName === "Boar"
            ? "boar-idle"
            : monsterName === "Black Boar"
            ? "black-boar-idle"
            : "bee-walk",
          true
        );
        break;
    }
  }
}

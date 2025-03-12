import { AUTO, Game } from "phaser";
import { Login } from "./scenes/Login";
import { Village } from "./scenes/Village";
import { Field } from "./scenes/Field";
import { Field1 } from "./scenes/Field1";
import { ChatScene } from "./scenes/ChatScene";
//  Find out more information about the Game Config at:
//  https://newdocs.phaser.io/docs/3.70.0/Phaser.Types.Core.GameConfig
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  fps: {
    target: 60,
    forceSetTimeOut: true,
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: "arcade",
  },
  pixelArt: true,
  scene: [Login, Village, Field, Field1, ChatScene],
};

const StartGame = (parent: string) => {
  return new Game({ ...config, parent });
};

export default StartGame;

import { createNanoEvents, Emitter, Unsubscribe } from "nanoevents";
import User, { ClientRank } from "./user";
import Mouse from "./mouse";
import VM from "./vm";

import { penisProtocol } from "./protocol";
import GetKeysym from "./keyboard";

interface PenisVMClientEvents {
  connectionOpened: () => void;
  connected: () => void;
  vmInfo: (vm: VM) => void;

  displayUpdate: (data: ArrayBuffer) => void;
  turnUpdate: (
    ourTurn: boolean,
    secondsRemaining?: number,
    queueSize?: number
  ) => void;
}

export default class PenisVMClient {
  private socket: WebSocket;
  private users: User[];
  private mouse: Mouse;
  private url: string;
  private isTurn: boolean;

  userRank?: ClientRank;
  emitter: Emitter<PenisVMClientEvents>;
  display: HTMLCanvasElement;
  displayCtx: CanvasRenderingContext2D;

  private unsubscribeCallbacks: Array<Unsubscribe> = [];

  constructor(url: string) {
    this.users = [];
    this.mouse = new Mouse();
    this.url = url;
    this.isTurn = false;

    this.emitter = createNanoEvents<PenisVMClientEvents>();

    this.display = document.createElement("canvas");
    this.display.tabIndex = -1;
    this.displayCtx = this.display.getContext("2d");

    this.display.addEventListener("click", () => {
      if (this.userRank == ClientRank.AdminUser) return;

      if (!this.isTurn) {
        this.sendTurn(true);
      }
    });

    const mouseDownEvent = (event: MouseEvent) => {
      if (!this.isTurn && this.userRank !== ClientRank.AdminUser) return;
      this.mouse.initFromMouseEvent(event);
      this.sendMouse(this.mouse.x, this.mouse.y, this.mouse.makeMask());
    };

    const mouseUpEvent = (event: MouseEvent) => {
      if (!this.isTurn && this.userRank !== ClientRank.AdminUser) return;
      this.mouse.initFromMouseEvent(event);
      this.sendMouse(this.mouse.x, this.mouse.y, this.mouse.makeMask());
    };

    const mouseMoveEvent = (event: MouseEvent) => {
      if (!this.isTurn && this.userRank !== ClientRank.AdminUser) return;
      this.mouse.initFromMouseEvent(event);
      this.sendMouse(this.mouse.x, this.mouse.y, this.mouse.makeMask());
    };

    const wheelEvent = (event: WheelEvent) => {
      event.preventDefault();
      if (!this.isTurn && this.userRank !== ClientRank.AdminUser) return;

      if (this.mouse.scrollUp) this.mouse.scrollUp = false;
      else if (this.mouse.scrollDown) this.mouse.scrollDown = false;

      this.mouse.initFromWheelEvent(event);
      this.sendMouse(this.mouse.x, this.mouse.y, this.mouse.makeMask());
    };

    const keyDownEvent = (event: KeyboardEvent) => {
      event.preventDefault();
      if (!this.isTurn && this.userRank !== ClientRank.AdminUser) return;
      const key = GetKeysym(event.keyCode, event.key, event.location);

      if (key === null) return;

      this.sendKey(key, true);
    };

    const keyUpEvent = (event: KeyboardEvent) => {
      event.preventDefault();
      if (!this.isTurn && this.userRank !== ClientRank.AdminUser) return;
      const key = GetKeysym(event.keyCode, event.key, event.location);

      if (key === null) return;

      this.sendKey(key, false);
    };

    this.display.addEventListener("contextmenu", (e) => e.preventDefault());

    this.display.addEventListener("mousedown", mouseDownEvent, { capture: true });
    this.display.addEventListener("mouseup", mouseUpEvent, { capture: true });
    this.display.addEventListener("mousemove", mouseMoveEvent, { capture: true });
    this.display.addEventListener("wheel", wheelEvent, { capture: true });
    this.display.addEventListener("keydown", keyDownEvent, { capture: true });
    this.display.addEventListener("keyup", keyUpEvent, { capture: true });

    this.socket = new WebSocket(url);
    this.socket.addEventListener("open", () => this.onOpen());
    this.socket.addEventListener("message", (message) =>
      this.onMessage(message)
    );
  }

  close() {
    for (const callback of this.unsubscribeCallbacks) {
      callback();
    }

    this.display = null;
    this.unsubscribeCallbacks = [];

    if (this.socket.readyState == WebSocket.OPEN) this.socket.close();
  }

  private onOpen() {
    this.emitter.emit("connectionOpened");
  }

  private async onMessage(message: MessageEvent) {
    let data;

    const binaryData = new Uint8Array(await message.data.arrayBuffer());

    if (binaryData[0] == penisProtocol.image) {
      data = binaryData.slice(1).buffer;

      this.updateDisplay(data);
      return;
    } else if (binaryData[0] == penisProtocol.text) {
      data = JSON.parse(new TextDecoder().decode(binaryData.slice(1)));
    }

    switch (data.type) {
      case "ping":
        this.socket.send(
          JSON.stringify({
            type: "ping",
            pingNumber: data.pingNumber,
          })
        );
        break;
      case "serverInfo":
        const image = new Image();
        image.src = `data:image/jpeg;base64,${data.thumbnail}`;

        const vm: VM = {
          name: data.serverName,
          description: data.serverDescription,
          url: this.url,
          thumbnail: image,
        };

        this.emitter.emit("vmInfo", vm);
        break;
      case "vgaSizeUpdate":
        this.display.width = data.width;
        this.display.height = data.height;
        break;
      case "connected":
        this.userRank = data.userRank as ClientRank;
        this.emitter.emit("connected");
        break;
      case "yourTurn":
        this.isTurn = true;
        this.display.focus();

        this.emitter.emit("turnUpdate", true, data.secondsRemaining, undefined);
        break;
      case "turnUpdate":
        if (typeof data.secondsRemaining !== "undefined") {
          this.isTurn = false;
          this.emitter.emit(
            "turnUpdate",
            false,
            data.secondsRemaining,
            data.queueSize
          );
        } else {
          this.isTurn = false;
          this.emitter.emit("turnUpdate", false, undefined, data.queueSize);
        }
        break;
    }
  }

  updateDisplay(data: ArrayBuffer) {
    let image = new Image();
    const blob = new Blob([data], { type: "image/jpeg" });

    image.addEventListener("load", () => {
      this.displayCtx.drawImage(image, 0, 0);

      URL.revokeObjectURL(image.src);
      image = null;
    });

    image.src = URL.createObjectURL(blob);
  }

  waitUntilConnectionOpen() {
    return new Promise<void>((res) => {
      const unsub = this.on("connectionOpened", () => {
        unsub();
        res();
      });
    });
  }

  listVM() {
    return new Promise<VM>((res) => {
      this.socket.send(
        JSON.stringify({
          type: "getServerInfo",
        })
      );

      const unsub = this.on("vmInfo", (vm) => {
        unsub();
        res(vm);
      });
    });
  }

  connect(username: string) {
    return new Promise<void>((res) => {
      this.socket.send(
        JSON.stringify({
          type: "connect",
          username,
        })
      );

      const unsub = this.on("connected", () => {
        unsub();
        res();
      });
    });
  }

  private sendTurn(takingTurn: boolean) {
    this.socket.send(
      JSON.stringify({
        type: "turn",
        takingTurn,
      })
    );
  }

  private sendMouse(x: number, y: number, mask: number) {
    this.socket.send(
      JSON.stringify({
        type: "mouse",
        x,
        y,
        mask,
      })
    );
  }

  private sendKey(keyCode: number, down: boolean) {
    this.socket.send(
      JSON.stringify({
        type: "key",
        keyCode,
        down,
      })
    );
  }

  on<E extends keyof PenisVMClientEvents>(
    event: E,
    callback: PenisVMClientEvents[E]
  ): Unsubscribe {
    const unsubscribe = this.emitter.on(event, callback);
    this.unsubscribeCallbacks.push(unsubscribe);
    return unsubscribe;
  }
}

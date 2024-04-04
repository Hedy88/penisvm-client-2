const maskContains = (mask: number, bit: number): boolean => {
  return (mask & bit) == bit;
};

export default class Mouse {
  left: boolean = false;
  middle: boolean = false;
  right: boolean = false;
  scrollDown: boolean = false;
  scrollUp: boolean = false;
  x: number = 0;
  y: number = 0;

  constructor() {}

  makeMask() {
    let mask = 0;

    if (this.left) mask |= 1;
    if (this.middle) mask |= 2;
    if (this.right) mask |= 4;
    if (this.scrollUp) mask |= 8;
    if (this.scrollDown) mask |= 16;

    return mask;
  }

  initFromMouseEvent(e: MouseEvent) {
    this.left = maskContains(e.buttons, 1);
    this.right = maskContains(e.buttons, 2);
    this.middle = maskContains(e.buttons, 4);

    this.x = e.offsetX;
    this.y = e.offsetY;
  }

  initFromWheelEvent(ev: WheelEvent) {
    this.initFromMouseEvent(ev as MouseEvent);

    if (ev.deltaY < 0) this.scrollUp = true;
    else if (ev.deltaY > 0) this.scrollDown = true;
  }
}

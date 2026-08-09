export interface FloatingButtonOptions {
  backgroundColor?: string;
  color?: string;
  icon?: string;
  avatarUrl?: string;
  size?: "small" | "medium" | "large";
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  onClick?: () => void;
  text?: string;
  container?: HTMLElement | string;
  draggable?: boolean;
  storageKey?: string;
}

export class FloatingButton {
  private element: HTMLButtonElement;
  private options: Required<FloatingButtonOptions>;
  private dragged = false;

  constructor(options: FloatingButtonOptions = {}) {
    this.options = {
      backgroundColor: options.backgroundColor || "#4a90e2",
      color: options.color || "#ffffff",
      icon: options.icon || "💬",
      avatarUrl: options.avatarUrl || "",
      size: options.size || "medium",
      position: options.position || "bottom-right",
      onClick: options.onClick || (() => {}),
      text: options.text || "",
      container: options.container || document.body,
      draggable: options.draggable ?? true,
      storageKey: options.storageKey || "practiq-assistant:bubble-position",
    };

    this.element = document.createElement("button");
    this.render();
  }

  private render(): void {
    const { backgroundColor, color, icon, avatarUrl, size, position, text } =
      this.options;

    // Set classes and styles
    this.element.className = `floating-button ${size} ${position}${avatarUrl ? "" : " floating-button--robot"}`;
    this.element.style.backgroundColor = backgroundColor;
    this.element.style.color = color;
    this.element.setAttribute("aria-label", "Open chat");

    // Button content
    this.element.replaceChildren();
    if (avatarUrl) {
      const avatar = document.createElement("img");
      avatar.src = avatarUrl;
      avatar.alt = "";
      avatar.className = "floating-button-avatar";
      this.element.appendChild(avatar);
    } else {
      const face = document.createElement("span");
      face.className = "floating-button-face";
      face.innerHTML = `<span class="floating-button-antenna"></span><span class="floating-button-ear floating-button-ear--left"></span><span class="floating-button-ear floating-button-ear--right"></span><span class="floating-button-screen"><span class="floating-button-eye"><i></i></span><span class="floating-button-eye"><i></i></span><b></b></span>`;
      this.element.appendChild(face);
    }
    if (text) {
      const textSpan = document.createElement("span");
      textSpan.textContent = text;
      textSpan.style.marginLeft = "5px";
      this.element.appendChild(textSpan);
    }

    // Events
    this.element.addEventListener("click", () => {
      if (this.dragged) { this.dragged = false; return; }
      if (this.options.onClick) {
        this.options.onClick();
      }
    });

    this.element.addEventListener("mouseenter", () => {
      this.element.classList.add("hovered");
    });

    this.element.addEventListener("mouseleave", () => {
      this.element.classList.remove("hovered");
    });
    this.enableDrag();
  }

  public mount(container: HTMLElement | string = document.body): void {
    const targetContainer =
      typeof container === "string"
        ? (document.querySelector(container) as HTMLElement)
        : container;

    if (targetContainer) {
      targetContainer.appendChild(this.element);
      this.restorePosition();

      // Load styles if not already loaded
      if (!document.getElementById("floating-button-styles")) {
        this.loadStyles();
      }
    }
  }

  public unmount(): void {
    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }

  private loadStyles(): void {
    const styleElement = document.createElement("style");
    styleElement.id = "floating-button-styles";
    styleElement.textContent = `
      .floating-button {
        border: none;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 6px 18px rgba(76, 54, 164, .22);
        position: fixed;
        /* Stay visible when chat overlay is open on desktop too. */
        z-index: 1002;
        outline: none;
        transition: transform 160ms ease-out, box-shadow 160ms ease-out;
        font-size: 24px;
      }
      
      .floating-button:hover, .floating-button.hovered {
        transform: translateY(-2px) scale(1.06);
        box-shadow: 0 10px 24px rgba(76, 54, 164, .28);
      }
      .floating-button:focus-visible { outline:3px solid #f4c95d; outline-offset:4px; }
      .floating-button--robot { background:transparent !important; border-radius:0; box-shadow:none; overflow:visible; touch-action:none; }
      .floating-button--robot:hover, .floating-button--robot.hovered { box-shadow:none; }
      .floating-button--chat-anchor { z-index:1002; }
      .floating-button--speaking .floating-button-face { animation:floating-robot-speaking 1.5s ease-in-out infinite; }
      @keyframes floating-robot-speaking { 0%,100% { transform:scale(1); box-shadow:inset 0 2px 4px rgba(255,255,255,.92), 0 0 0 0 rgba(244,201,93,.50), 0 8px 18px rgba(103,80,198,.24); } 50% { transform:scale(1.03); box-shadow:inset 0 2px 4px rgba(255,255,255,.92), 0 0 0 9px rgba(244,201,93,.12), 0 10px 23px rgba(181,139,38,.24); } }
      @media (prefers-reduced-motion: reduce) { .floating-button--speaking .floating-button-face { animation:none; box-shadow:inset 0 2px 4px rgba(255,255,255,.92), 0 0 0 5px rgba(244,201,93,.18); } }

      .floating-button-avatar {
        width: 72%;
        height: 72%;
        object-fit: contain;
        display: block;
      }
      /* Practiq mascot: white helmet, dark visor, cyan eyes and lilac ears. */
      .floating-button-face { position:relative; box-sizing:border-box; width:96%; height:90%; border:2px solid #d8d0ff; border-radius:34% 34% 30% 30% / 40% 40% 34% 34%; background:linear-gradient(155deg,#ffffff 12%,#fbfaff 57%,#e9e4ff 100%); display:grid; place-items:center; isolation:isolate; box-shadow:inset 0 3px 5px rgba(255,255,255,.98), inset -5px -5px 9px rgba(126,94,230,.14), 0 8px 18px rgba(91,69,181,.20); }
      .floating-button-screen { position:relative; z-index:1; box-sizing:border-box; width:75%; height:68%; border-radius:26% / 32%; background:radial-gradient(ellipse at 62% 0%,#222c60 0%,#080c22 45%,#02030c 100%); display:flex; gap:22%; align-items:center; justify-content:center; box-shadow:inset 0 2px 7px rgba(146,165,255,.16), inset 0 -3px 7px rgba(0,0,0,.72); }
      .floating-button-eye { width:26%; aspect-ratio:1; border-radius:28%; background:#62e9e9; display:grid; place-items:center; overflow:hidden; box-shadow:0 0 8px rgba(98,233,233,.34); }
      .floating-button-eye i { width:41%; aspect-ratio:1; border-radius:24%; background:#cbd5e1; box-shadow:inset 1px 1px 2px #f8fafc, 0 0 4px rgba(51,65,85,.53); transform:translate(0,0); }
      .floating-button-screen b { position:absolute; bottom:8%; width:20%; height:15%; border:3px solid #62e9e9; border-top:0; border-radius:0 0 15px 15px; box-sizing:border-box; }
      .floating-button-antenna { position:absolute; z-index:0; top:-10%; width:30%; height:12%; border:2px solid #9e8bfa; border-bottom:0; border-radius:50% 50% 4px 4px; background:linear-gradient(180deg,#9a82f2,#6953d8); box-shadow:inset 0 2px 2px rgba(255,255,255,.38),0 -1px 4px rgba(94,65,205,.22); }
      .floating-button-antenna::after { content:""; position:absolute; inset:12% 14% 28%; border-radius:50%; background:rgba(230,223,255,.42); }
      .floating-button-ear { position:absolute; z-index:-1; top:31%; box-sizing:border-box; width:16%; height:35%; border:2px solid #aa99fa; background:linear-gradient(90deg,#c4b8ff,#8f76ed); box-shadow:inset 2px 1px 3px rgba(255,255,255,.36), 0 3px 7px rgba(91,69,181,.18); }
      .floating-button-ear--left { left:-12%; border-radius:12px 4px 4px 12px; } .floating-button-ear--right { right:-12%; border-radius:4px 12px 12px 4px; background:linear-gradient(90deg,#8f76ed,#c4b8ff); }
      
      .floating-button.small {
        width: 40px;
        height: 40px;
        font-size: 18px;
      }
      
      .floating-button.medium {
        width: 88px;
        height: 76px;
        font-size: 24px;
      }
      
      .floating-button.large {
        width: 72px;
        height: 72px;
        font-size: 30px;
      }
      
      /* Posiciones */
      .floating-button.bottom-right {
        bottom: 20px;
        right: 20px;
      }
      
      .floating-button.bottom-left {
        bottom: 20px;
        left: 20px;
      }
      
      .floating-button.top-right {
        top: 20px;
        right: 20px;
      }
      
      .floating-button.top-left {
        top: 20px;
        left: 20px;
      }
      
      /* Animación al hacer clic */
      .floating-button:active {
        transform: scale(0.96);
      }
      @media (max-width:720px) { .floating-button.medium { width:72px; height:62px; } .floating-button--chat-anchor { width:64px !important; height:55px !important; } }
    `;
    document.head.appendChild(styleElement);
  }

  // Métodos para actualizar propiedades
  public setColor(color: string): void {
    this.options.color = color;
    this.element.style.color = color;
  }

  public setBackgroundColor(color: string): void {
    this.options.backgroundColor = color;
    this.element.style.backgroundColor = color;
  }

  public setIcon(icon: string): void {
    this.options.icon = icon;
    this.options.avatarUrl = "";
    this.render();
  }

  private enableDrag(): void {
    if (!this.options.draggable) return;
    let startX = 0, startY = 0, left = 0, top = 0;
    let dragReady = false;
    let touchHoldTimer: ReturnType<typeof setTimeout> | undefined;
    this.element.addEventListener("pointerdown", (event) => {
      startX = event.clientX; startY = event.clientY;
      const rect = this.element.getBoundingClientRect(); left = rect.left; top = rect.top;
      this.element.setPointerCapture(event.pointerId);
      dragReady = event.pointerType !== "touch";
      // Touch is click-first. Drag starts only after a short hold, avoiding
      // normal tap jitter consuming the first chat-open click.
      if (event.pointerType === "touch") {
        touchHoldTimer = setTimeout(() => { dragReady = true; }, 260);
      }
    });
    this.element.addEventListener("pointermove", (event) => {
      if (!this.element.hasPointerCapture(event.pointerId)) return;
      if (!dragReady) return;
      const x = Math.max(8, Math.min(window.innerWidth - this.element.offsetWidth - 8, left + event.clientX - startX));
      const y = Math.max(8, Math.min(window.innerHeight - this.element.offsetHeight - 8, top + event.clientY - startY));
      this.dragged ||= Math.abs(event.clientX - startX) + Math.abs(event.clientY - startY) > 5;
      this.element.style.cssText += `;left:${x}px;top:${y}px;right:auto;bottom:auto`;
    });
    this.element.addEventListener("pointerup", (event) => {
      if (!this.element.hasPointerCapture(event.pointerId)) return;
      if (touchHoldTimer) clearTimeout(touchHoldTimer);
      touchHoldTimer = undefined;
      this.element.releasePointerCapture(event.pointerId);
      if (this.dragged) localStorage.setItem(this.options.storageKey, JSON.stringify({left:this.element.style.left, top:this.element.style.top}));
    });
    this.element.addEventListener("pointercancel", () => {
      if (touchHoldTimer) clearTimeout(touchHoldTimer);
      touchHoldTimer = undefined;
      dragReady = false;
    });
  }

  private restorePosition(): void {
    // Stored coordinates predate viewport-aware persistence. Never apply a
    // desktop coordinate on mobile, where it can place bubble off-screen.
    if (window.innerWidth <= 720) return;
    try { const saved = JSON.parse(localStorage.getItem(this.options.storageKey) || "null"); if (saved?.left && saved?.top) this.element.style.cssText += `;left:${saved.left};top:${saved.top};right:auto;bottom:auto`; } catch { /* optional storage */ }
  }

  public setSize(size: "small" | "medium" | "large"): void {
    this.options.size = size;
    this.element.className = this.element.className.replace(
      /small|medium|large/,
      size
    );
  }

  public setPosition(
    position: "bottom-right" | "bottom-left" | "top-right" | "top-left"
  ): void {
    this.options.position = position;
    this.element.className = this.element.className.replace(
      /bottom-right|bottom-left|top-right|top-left/,
      position
    );
  }

  public setOnClick(onClick: () => void): void {
    this.options.onClick = onClick;
  }

  public hide(): void {
    this.element.style.display = "none";
  }

  public show(): void {
    this.element.style.display = "flex";
  }

  /** Mobile open state: keep same robot visible as a sheet-side companion. */
  public anchorToMobileChat(sheetTop: number): void {
    if (window.innerWidth > 720) return;
    this.element.classList.add("floating-button--chat-anchor");
    this.element.style.left = "20px";
    this.element.style.top = `${Math.max(8, sheetTop - 48)}px`;
    this.element.style.right = "auto";
    this.element.style.bottom = "auto";
  }

  public restoreFromMobileChat(): void {
    this.element.classList.remove("floating-button--chat-anchor", "floating-button--speaking");
    this.element.style.left = "";
    this.element.style.top = "";
    this.element.style.right = "";
    this.element.style.bottom = "";
    // Desktop drag coordinates can be outside a narrow mobile viewport.
    // Mobile always returns to a reachable default bubble position.
    if (window.innerWidth <= 720) {
      this.element.style.right = "16px";
      this.element.style.bottom = "max(16px, env(safe-area-inset-bottom))";
      return;
    }
    this.restorePosition();
  }

  public setSpeaking(speaking: boolean): void {
    this.element.classList.toggle("floating-button--speaking", speaking);
  }
}

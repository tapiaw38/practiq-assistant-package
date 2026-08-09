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
      .floating-button--robot { background:transparent !important; border-radius:0; box-shadow:none; overflow:visible; }
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
      .floating-button-face { position:relative; width:76%; height:66%; border:2px solid #c4b5fd; border-radius:44% 44% 42% 42% / 48% 48% 44% 44%; background:linear-gradient(145deg,#ffffff 15%,#f7f5ff 64%,#ddd6fe); display:grid; place-items:center; isolation:isolate; box-shadow:inset 0 2px 4px rgba(255,255,255,.92), 0 8px 18px rgba(103,80,198,.24); }
      .floating-button-screen { position:relative; z-index:1; width:76%; height:54%; border-radius:42% / 48%; background:linear-gradient(145deg,#101735,#030617 72%); display:flex; gap:10px; align-items:center; justify-content:center; box-shadow:inset 0 2px 6px rgba(111,142,255,.16), inset 0 -2px 5px rgba(0,0,0,.55); }
      .floating-button-eye { width:12px; height:14px; border-radius:50%; background:#5debe7; display:grid; place-items:center; overflow:hidden; box-shadow:0 0 7px rgba(93,235,231,.48); }
      .floating-button-eye i { width:4px; height:4px; border-radius:50%; background:rgba(4,24,49,.66); transform:translate(1px,1px); }
      .floating-button-screen b { position:absolute; bottom:6px; width:15px; height:8px; border:3px solid #5debe7; border-top:0; border-radius:0 0 14px 14px; }
      .floating-button-antenna { position:absolute; z-index:0; top:-9px; width:22px; height:8px; border:2px solid #a78bfa; border-bottom:0; border-radius:50% 50% 2px 2px; background:linear-gradient(#a78bfa,#c4b5fd); box-shadow:0 -1px 4px rgba(124,58,237,.20); }
      .floating-button-antenna::after { content:""; position:absolute; inset:-3px 4px 2px; border-radius:50%; background:rgba(255,255,255,.35); }
      .floating-button-ear { position:absolute; z-index:-1; top:33%; width:11px; height:22px; border:2px solid #a78bfa; background:linear-gradient(90deg,#c4b5fd,#a78bfa); box-shadow:0 3px 7px rgba(103,80,198,.18); }
      .floating-button-ear--left { left:-10px; border-radius:10px 3px 3px 10px; } .floating-button-ear--right { right:-10px; border-radius:3px 10px 10px 3px; background:linear-gradient(90deg,#a78bfa,#c4b5fd); }
      
      .floating-button.small {
        width: 40px;
        height: 40px;
        font-size: 18px;
      }
      
      .floating-button.medium {
        width: 72px;
        height: 62px;
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
      @media (max-width:720px) { .floating-button.medium { width:64px; height:54px; } .floating-button--chat-anchor { width:58px !important; height:50px !important; } }
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

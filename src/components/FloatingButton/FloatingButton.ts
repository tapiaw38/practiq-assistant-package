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
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        position: fixed;
        /* Stay visible when chat overlay is open on desktop too. */
        z-index: 1002;
        outline: none;
        transition: all 0.3s ease;
        font-size: 24px;
      }
      
      .floating-button:hover, .floating-button.hovered {
        transform: scale(1.1);
        box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3);
      }
      .floating-button--robot { background:transparent !important; border-radius:0; box-shadow:none; overflow:visible; }
      .floating-button--robot:hover, .floating-button--robot.hovered { box-shadow:none; }
      .floating-button--chat-anchor { z-index:1002; }
      .floating-button--speaking .floating-button-face { animation:floating-robot-speaking 1.45s ease-in-out infinite; }
      @keyframes floating-robot-speaking { 0%,100% { transform:scale(1); box-shadow:inset 0 2px 3px #fff8, 0 0 0 0 rgba(202,166,43,.22); } 50% { transform:scale(1.07); box-shadow:inset 0 2px 3px #fff8, 0 0 0 8px rgba(202,166,43,.14), 0 8px 22px rgba(202,166,43,.28); } }
      @media (prefers-reduced-motion: reduce) { .floating-button--speaking .floating-button-face { animation:none; box-shadow:inset 0 2px 3px #fff8, 0 0 0 5px rgba(202,166,43,.16); } }

      .floating-button-avatar {
        width: 72%;
        height: 72%;
        object-fit: contain;
        display: block;
      }
      .floating-button-face { position:relative; width:72%; height:66%; border:2px solid #312e81; border-radius:34% 34% 42% 42%; background:linear-gradient(145deg,#dbeafe,#a5b4fc); display:grid; place-items:center; box-shadow:inset 0 2px 3px #fff8; }
      .floating-button-screen { width:78%; height:55%; border-radius:9px; background:#312e81; display:flex; gap:7px; align-items:center; justify-content:center; box-shadow:inset 0 0 0 2px #818cf8; }
      .floating-button-eye { width:12px; height:15px; border-radius:50%; background:#f8fafc; display:grid; place-items:center; overflow:hidden; }
      .floating-button-eye i { width:6px; height:6px; border-radius:50%; background:#22d3ee; box-shadow:0 0 5px #67e8f9; }
      .floating-button-screen b { position:absolute; bottom:6px; width:11px; height:3px; border-radius:99px; background:#67e8f9; }
      .floating-button-antenna { position:absolute; top:-11px; width:3px; height:10px; background:#312e81; }
      .floating-button-antenna::after { content:""; position:absolute; top:-5px; left:-3px; width:9px; height:9px; border-radius:50%; background:#fbbf24; border:2px solid #312e81; }
      .floating-button-ear { position:absolute; top:35%; width:7px; height:17px; border:2px solid #312e81; background:#818cf8; }
      .floating-button-ear--left { left:-8px; border-radius:7px 0 0 7px; } .floating-button-ear--right { right:-8px; border-radius:0 7px 7px 0; }
      
      .floating-button.small {
        width: 40px;
        height: 40px;
        font-size: 18px;
      }
      
      .floating-button.medium {
        width: 56px;
        height: 56px;
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
        transform: scale(0.95);
      }
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
    this.element.addEventListener("pointerdown", (event) => {
      startX = event.clientX; startY = event.clientY;
      const rect = this.element.getBoundingClientRect(); left = rect.left; top = rect.top;
      this.element.setPointerCapture(event.pointerId);
    });
    this.element.addEventListener("pointermove", (event) => {
      if (!this.element.hasPointerCapture(event.pointerId)) return;
      const x = Math.max(8, Math.min(window.innerWidth - this.element.offsetWidth - 8, left + event.clientX - startX));
      const y = Math.max(8, Math.min(window.innerHeight - this.element.offsetHeight - 8, top + event.clientY - startY));
      this.dragged ||= Math.abs(event.clientX - startX) + Math.abs(event.clientY - startY) > 5;
      this.element.style.cssText += `;left:${x}px;top:${y}px;right:auto;bottom:auto`;
    });
    this.element.addEventListener("pointerup", (event) => {
      if (!this.element.hasPointerCapture(event.pointerId)) return;
      this.element.releasePointerCapture(event.pointerId);
      if (this.dragged) localStorage.setItem(this.options.storageKey, JSON.stringify({left:this.element.style.left, top:this.element.style.top}));
    });
  }

  private restorePosition(): void {
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
    this.restorePosition();
  }

  public setSpeaking(speaking: boolean): void {
    this.element.classList.toggle("floating-button--speaking", speaking);
  }
}

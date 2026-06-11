/**
 * Possible positions for the floating button
 */
export type FloatingButtonPosition =
  | "bottom-right"
  | "bottom-left"
  | "top-right"
  | "top-left";

/**
 * Available sizes for the floating button
 */
export type ButtonSize = "small" | "medium" | "large";

/**
 * Configuration options for the floating button
 */
export interface FloatingButtonOptions {
  /** Position of the button on the screen */
  position?: FloatingButtonPosition;
  /** Background color of the button */
  backgroundColor?: string;
  /** Color of the icon/text */
  color?: string;
  /** Content of the button (icon or text) */
  icon?: string;
  /** Avatar image shown instead of the icon */
  avatarUrl?: string;
  /** Size of the button */
  size?: ButtonSize;
  /** Function to execute when the button is clicked */
  onClick?: () => void;
  /** CSS selector or element where to mount the button */
  container?: HTMLElement | string;
  /** Additional CSS classes */
  className?: string;
  /** Whether to hide the button initially */
  hidden?: boolean;
}

/**
 * FloatingButton Component - Creates a customizable floating button
 * that can be positioned in any of the 4 corners of the screen
 */
export class FloatingButton {
  private button!: HTMLButtonElement;
  private options: Required<FloatingButtonOptions>;
  private mounted: boolean = false;

  /**
   * Default dimensions for each button size
   */
  private readonly sizes = {
    small: {
      width: "34px",
      height: "34px",
      fontSize: "15px",
    },
    medium: {
      width: "46px",
      height: "46px",
      fontSize: "20px",
    },
    large: {
      width: "56px",
      height: "56px",
      fontSize: "24px",
    },
  };

  /**
   * Creates a new instance of FloatingButton
   * @param options Configuration options
   */
  constructor(options: FloatingButtonOptions = {}) {
    // Default options
    this.options = {
      position: options.position || "bottom-right",
      backgroundColor: options.backgroundColor || "#4a90e2",
      color: options.color || "#ffffff",
      icon: options.icon || "💬",
      avatarUrl: options.avatarUrl || "",
      size: options.size || "medium",
      onClick: options.onClick || (() => {}),
      container: options.container || document.body,
      className: options.className || "",
      hidden: options.hidden || false,
    };

    this.createButton();
  }

  /**
   * Creates the floating button element and applies the styles
   */
  private createButton(): void {
    this.button = document.createElement("button");
    this.button.className =
      `floating-button ${this.options.size} ${this.options.position} ${this.options.className}`.trim();
    // Support for Material Design icons
    if (this.options.avatarUrl) {
      const avatar = document.createElement("img");
      avatar.src = this.options.avatarUrl;
      avatar.alt = "";
      Object.assign(avatar.style, {
        width: "72%",
        height: "72%",
        objectFit: "contain",
        display: "block",
      });
      this.button.replaceChildren(avatar);
    } else if (this.options.icon) {
      if (this.options.icon.startsWith("material:")) {
        const iconName = this.options.icon.replace("material:", "");
        this.button.innerHTML = `<span class="material-icons">${iconName}</span>`;
      } else {
        this.button.innerHTML = this.options.icon;
      }
    }
    this.button.setAttribute("aria-label", "Assistant");
    this.button.setAttribute("type", "button");

    // Apply styles
    this.applyStyles();

    // Add events
    this.button.addEventListener("click", (e) => {
      e.preventDefault();
      this.options.onClick();
    });
  }

  /**
   * Applies the CSS styles to the button
   */
  private applyStyles(): void {
    const { width, height, fontSize } = this.sizes[this.options.size];

    // Base styles
    Object.assign(this.button.style, {
      backgroundColor: this.options.backgroundColor,
      color: this.options.color,
      width,
      height,
      fontSize,
      position: "fixed",
      zIndex: "1000",
      borderRadius: "50%",
      border: "none",
      boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
      cursor: "pointer",
      display: this.options.hidden ? "none" : "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "all 0.3s ease",
      outline: "none",
    });

    // Position styles
    switch (this.options.position) {
      case "bottom-right":
        this.button.style.bottom = "20px";
        this.button.style.right = "20px";
        break;
      case "bottom-left":
        this.button.style.bottom = "20px";
        this.button.style.left = "20px";
        break;
      case "top-right":
        this.button.style.top = "20px";
        this.button.style.right = "20px";
        break;
      case "top-left":
        this.button.style.top = "20px";
        this.button.style.left = "20px";
        break;
    }
  }

  /**
   * Mounts the button to the DOM
   * @param container Element or selector where to mount the button
   */
  public mount(container: HTMLElement | string = this.options.container): void {
    if (this.mounted) return;

    const targetContainer =
      typeof container === "string"
        ? (document.querySelector(container) as HTMLElement)
        : container;

    if (targetContainer) {
      targetContainer.appendChild(this.button);
      this.mounted = true;
    }
  }

  /**
   * Unmounts the button from the DOM
   */
  public unmount(): void {
    if (!this.mounted) return;

    if (this.button.parentNode) {
      this.button.parentNode.removeChild(this.button);
      this.mounted = false;
    }
  }

  /**
   * Updates the button options
   * @param options New options to apply
   */
  public update(options: Partial<FloatingButtonOptions>): void {
    // Update options
    this.options = {
      ...this.options,
      ...options,
    };

    // Update classes
    this.button.className =
      `floating-button ${this.options.size} ${this.options.position} ${this.options.className}`.trim();

    // Update content
    if (options.icon !== undefined) {
      if (this.options.avatarUrl) {
        const avatar = document.createElement("img");
        avatar.src = this.options.avatarUrl;
        avatar.alt = "";
        Object.assign(avatar.style, {
          width: "72%",
          height: "72%",
          objectFit: "contain",
          display: "block",
        });
        this.button.replaceChildren(avatar);
      } else if (options.icon.startsWith("material:")) {
        const iconName = options.icon.replace("material:", "");
        this.button.innerHTML = `<span class="material-icons">${iconName}</span>`;
      } else {
        this.button.innerHTML = options.icon;
      }
    }

    // Update styles
    this.applyStyles();
  }

  /**
   * Shows the button
   */
  public show(): void {
    this.button.style.display = "flex";
    this.update({ hidden: false });
  }

  /**
   * Hides the button
   */
  public hide(): void {
    this.button.style.display = "none";
    this.update({ hidden: true });
  }

  /**
   * Change the onClick event
   * @param handler New handler function
   */
  public setOnClick(handler: () => void): void {
    this.options.onClick = handler;
  }
}

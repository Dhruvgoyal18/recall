interface ToastOptions {
  onUndo?: () => void;
  durationMs?: number;
}

const HOST_ID = "recall-toast-host";

export function showToast(message: string, options: ToastOptions = {}): void {
  document.getElementById(HOST_ID)?.remove();

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.style.all = "initial";
  host.style.position = "fixed";
  host.style.zIndex = "2147483647";
  host.style.bottom = "20px";
  host.style.right = "20px";
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
    .toast {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #1f2937;
      color: #f9fafb;
      padding: 10px 14px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.25);
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 13px;
      max-width: 320px;
      animation: recall-fade-in 150ms ease-out;
    }
    button {
      background: none;
      border: none;
      color: #818cf8;
      font-weight: 600;
      cursor: pointer;
      font-size: 13px;
      padding: 0;
      white-space: nowrap;
    }
    @keyframes recall-fade-in {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
  shadow.appendChild(style);

  const toast = document.createElement("div");
  toast.className = "toast";
  const text = document.createElement("span");
  text.textContent = message;
  toast.appendChild(text);

  if (options.onUndo) {
    const undoBtn = document.createElement("button");
    undoBtn.textContent = "Undo";
    undoBtn.addEventListener("click", () => {
      options.onUndo?.();
      host.remove();
    });
    toast.appendChild(undoBtn);
  }

  shadow.appendChild(toast);

  setTimeout(() => host.remove(), options.durationMs ?? 6000);
}

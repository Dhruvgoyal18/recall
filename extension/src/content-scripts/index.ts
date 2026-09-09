import { extractFullPage } from "./full-page-extract";
import { getSelectionPayload } from "./selection-capture";
import { showToast } from "./toast";

type ContentMessage =
  | { type: "recall/get-selection" }
  | { type: "recall/extract-full-page" }
  | { type: "recall/show-toast"; message: string; undoItemId?: string };

chrome.runtime.onMessage.addListener((message: ContentMessage, _sender, sendResponse) => {
  switch (message.type) {
    case "recall/get-selection": {
      sendResponse(getSelectionPayload());
      return false;
    }
    case "recall/extract-full-page": {
      sendResponse(extractFullPage());
      return false;
    }
    case "recall/show-toast": {
      showToast(message.message, {
        onUndo: message.undoItemId
          ? () => void chrome.runtime.sendMessage({ type: "recall/undo-save", itemId: message.undoItemId })
          : undefined,
      });
      return false;
    }
    default:
      return false;
  }
});

interface ChromeMessage {
  type: string;
  token?: string;
  [key: string]: unknown;
}

interface StorageArea {
  get(key: string | string[] | object | null, callback: (items: { [key: string]: string }) => void): void;
  set(items: { [key: string]: string }, callback?: () => void): void;
}

declare namespace chrome {
  export const storage: {
    local: StorageArea;
    sync: StorageArea;
  };

  export const runtime: {
    sendMessage(
      extensionId: string,
      message: ChromeMessage,
      callback?: (response: { success: boolean; error?: string }) => void
    ): void;
    lastError?: {
      message: string;
    };
    onMessageExternal: {
      addListener(
        callback: (
          message: ChromeMessage,
          sender: {
            id?: string;
            url?: string;
            origin?: string;
          },
          sendResponse: (response: { success: boolean; error?: string }) => void
        ) => void
      ): void;
    };
  };
}

declare interface Window {
  chrome: typeof chrome;
} 
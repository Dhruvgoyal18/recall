import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_API_BASE_URL } from "./constants";
import { getSettings, setSettings } from "./storage";

function installChromeStorageMock(): { store: Record<string, unknown> } {
  const state = { store: {} as Record<string, unknown> };
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: vi.fn(async (key: string) => ({ [key]: state.store[key] })),
        set: vi.fn(async (items: Record<string, unknown>) => {
          Object.assign(state.store, items);
        }),
      },
    },
  });
  return state;
}

describe("getSettings", () => {
  beforeEach(() => {
    installChromeStorageMock();
  });

  it("defaults apiBaseUrl to the baked-in production URL when unset", async () => {
    const settings = await getSettings();
    expect(settings).toEqual({ apiBaseUrl: DEFAULT_API_BASE_URL, authToken: "", email: "" });
  });

  it("round-trips a saved sign-in through setSettings/getSettings", async () => {
    await setSettings({ apiBaseUrl: DEFAULT_API_BASE_URL, authToken: "jwt-abc", email: "a@b.com" });
    const settings = await getSettings();
    expect(settings.authToken).toBe("jwt-abc");
    expect(settings.email).toBe("a@b.com");
  });

  it("fills in missing fields from defaults when only some are stored", async () => {
    const state = installChromeStorageMock();
    state.store["recall.settings"] = { authToken: "jwt-abc" };

    const settings = await getSettings();
    expect(settings.apiBaseUrl).toBe(DEFAULT_API_BASE_URL);
    expect(settings.authToken).toBe("jwt-abc");
    expect(settings.email).toBe("");
  });
});

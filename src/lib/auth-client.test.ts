import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function createSessionProbe(authMode: string) {
  vi.stubEnv("AUTH_MODE", authMode);
  const { useSession } = await import("./auth-client");
  let current: ReturnType<typeof useSession> | undefined;

  function SessionStatus() {
    current = useSession();
    return null;
  }

  return () => {
    renderToStaticMarkup(createElement(SessionStatus));
    if (!current) throw new Error("Session consumer did not render");
    return current;
  };
}

describe("client session by deployment mode", () => {
  it("does not wait for a hosted session in trusted local mode", async () => {
    const readSession = await createSessionProbe("local_noauth");
    expect(readSession()).toMatchObject({
      data: null,
      error: null,
      isPending: false,
      isRefetching: false,
    });
  });

  it.each(["local_noauth", "cloudflare_access"])(
    "%s keeps the hosted session absent even when a consumer refetches",
    async (mode) => {
      const fetch = vi.fn(async () => Response.json(null));
      vi.stubGlobal("fetch", fetch);
      const readSession = await createSessionProbe(mode);

      await readSession().refetch();

      expect(fetch).not.toHaveBeenCalled();
      expect(readSession()).toMatchObject({
        data: null,
        error: null,
        isPending: false,
        isRefetching: false,
      });
    },
  );

  it("hosted mode still resolves its pending session through the real auth client", async () => {
    const fetch = vi.fn(async () => Response.json(null));
    vi.stubGlobal("fetch", fetch);
    const readSession = await createSessionProbe("hosted");

    expect(readSession().isPending).toBe(true);
    await readSession().refetch();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/auth/get-session"),
      expect.objectContaining({ method: "GET" }),
    );
    expect(readSession()).toMatchObject({
      data: null,
      error: null,
      isPending: false,
      isRefetching: false,
    });
  });

  it("hosted mode preserves unauthorized errors instead of inventing a session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ message: "Unauthorized" }, { status: 401 }),
      ),
    );
    const readSession = await createSessionProbe("hosted");

    await readSession().refetch();

    expect(readSession()).toMatchObject({
      data: null,
      error: { status: 401 },
      isPending: false,
      isRefetching: false,
    });
  });
});

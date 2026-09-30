import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import UpdateButton from "../ui/UpdateButton";

describe("UpdateButton — fuerza la última versión", () => {
  const unregister = vi.fn().mockResolvedValue(true);
  const cacheDelete = vi.fn().mockResolvedValue(true);
  const reload = vi.fn();
  const originalLocation = window.location;

  beforeEach(() => {
    unregister.mockClear();
    cacheDelete.mockClear();
    reload.mockClear();
    Object.defineProperty(navigator, "serviceWorker", {
      value: { getRegistrations: vi.fn().mockResolvedValue([{ unregister }]) },
      configurable: true,
    });
    Object.defineProperty(window, "caches", {
      value: { keys: vi.fn().mockResolvedValue(["jr-dashboard-v1", "jr-dashboard-v2"]), delete: cacheDelete },
      configurable: true,
    });
    Object.defineProperty(window, "location", {
      value: { ...originalLocation, reload },
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", { value: originalLocation, configurable: true });
  });

  it("des-registra el service worker, borra todas las cachés y recarga", async () => {
    render(<UpdateButton />);
    fireEvent.click(screen.getByText("Actualizar"));

    expect(screen.getByText("Actualizando…")).toBeInTheDocument();
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(unregister).toHaveBeenCalledTimes(1);
    expect(cacheDelete).toHaveBeenCalledWith("jr-dashboard-v1");
    expect(cacheDelete).toHaveBeenCalledWith("jr-dashboard-v2");
  });

  it("recarga aunque falle la limpieza de caché", async () => {
    (window.caches.keys as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("boom"));
    render(<UpdateButton />);
    fireEvent.click(screen.getByText("Actualizar"));
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });
});

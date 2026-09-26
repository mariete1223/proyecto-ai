import {
  checkBackendHealth,
  fetchWebCategories,
  fetchWebEntries,
  fetchWebTags,
  isWebPlatform,
} from "./webApi";

describe("Web API Platform Adapter (Task 42)", () => {
  const config = { baseUrl: "http://localhost:8000", token: "test-token" };

  it("checks platform detection", () => {
    expect(typeof isWebPlatform()).toBe("boolean");
  });

  it("checks backend health status", async () => {
    const mockFetch = jest
      .fn()
      .mockResolvedValue({ ok: true, status: 200 } as Response);

    const healthy = await checkBackendHealth({
      ...config,
      fetchFn: mockFetch as unknown as typeof fetch,
    });
    expect(healthy).toBe(true);
  });

  it("fetches web entries successfully", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          { id: "e-1", content: "Entrada web", category_id: "c-1" },
        ]),
    } as Response);

    const res = await fetchWebEntries({
      ...config,
      fetchFn: mockFetch as unknown as typeof fetch,
    });
    expect(res.success).toBe(true);
    expect(res.data?.length).toBe(1);
  });

  it("handles backend unreachable gracefully", async () => {
    const mockFetch = jest
      .fn()
      .mockRejectedValue(new TypeError("Failed to fetch"));

    const res = await fetchWebEntries({
      ...config,
      fetchFn: mockFetch as unknown as typeof fetch,
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain("Servidor backend privado no disponible");
  });

  it("fetches categories and tags", async () => {
    const mockFetchCat = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: "c-1", name: "Cat Web" }]),
    } as Response);

    const mockFetchTags = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: "t-1", name: "Tag Web" }]),
    } as Response);

    const catRes = await fetchWebCategories({
      ...config,
      fetchFn: mockFetchCat as unknown as typeof fetch,
    });
    expect(catRes.success).toBe(true);

    const tagRes = await fetchWebTags({
      ...config,
      fetchFn: mockFetchTags as unknown as typeof fetch,
    });
    expect(tagRes.success).toBe(true);
  });
});

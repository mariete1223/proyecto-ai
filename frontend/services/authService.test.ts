import { authStorage, loginUser, registerUser } from "./authService";

describe("authService", () => {
  beforeEach(() => {
    authStorage.clearSession();
  });

  it("handles successful login and session storage", async () => {
    const mockFetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes("/login")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: "jwt-token-123",
              token_type: "bearer",
            }),
        });
      }
      if (url.includes("/me")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ id: "user-uuid-456", email: "test@example.com" }),
        });
      }
      return Promise.reject(new Error("Unknown URL"));
    });

    const res = await loginUser(
      "http://test-server",
      "test@example.com",
      "Password123!",
      mockFetch as any,
    );
    expect(res.success).toBe(true);
    expect(res.session?.token).toBe("jwt-token-123");
    expect(res.session?.email).toBe("test@example.com");
    expect(res.session?.userId).toBe("user-uuid-456");

    const loaded = authStorage.loadSession();
    expect(loaded?.token).toBe("jwt-token-123");
  });

  it("handles login error", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ detail: "Incorrect email or password" }),
    });

    const res = await loginUser(
      "http://test-server",
      "bad@example.com",
      "WrongPassword",
      mockFetch as any,
    );
    expect(res.success).toBe(false);
    expect(res.error).toBe("Incorrect email or password");
  });

  it("handles successful registration", async () => {
    const mockFetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes("/register")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: "new-jwt-token",
              token_type: "bearer",
            }),
        });
      }
      if (url.includes("/me")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ id: "new-user-id", email: "new@example.com" }),
        });
      }
      return Promise.reject(new Error("Unknown URL"));
    });

    const res = await registerUser(
      "http://test-server",
      "new@example.com",
      "SecurePass123!",
      mockFetch as any,
    );
    expect(res.success).toBe(true);
    expect(res.session?.token).toBe("new-jwt-token");
  });
});

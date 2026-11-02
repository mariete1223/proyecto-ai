import {
  authStorage,
  loginUser,
  notifySessionExpired,
  onSessionExpired,
  refreshToken,
  registerUser,
  resendVerification,
  verifyEmail,
} from "./authService";

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

  it("handles login error on invalid credentials", async () => {
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
    expect(res.isUnverified).toBe(false);
  });

  it("handles unverified user login error (HTTP 403)", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: () =>
        Promise.resolve({
          detail: "Email address is not verified. Please check your inbox.",
        }),
    });

    const res = await loginUser(
      "http://test-server",
      "unverified@example.com",
      "Password123!",
      mockFetch as any,
    );
    expect(res.success).toBe(false);
    expect(res.isUnverified).toBe(true);
    expect(res.error).toContain("not verified");
  });

  it("handles successful registration returning confirmation instruction message", async () => {
    const mockFetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes("/register")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              message:
                "Account created successfully. Please check your email to verify your account before logging in.",
              email: "new@example.com",
            }),
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
    expect(res.message).toContain("check your email");
    expect(res.session).toBeUndefined();
  });

  it("handles verifyEmail success and error", async () => {
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            message: "Email successfully verified. You may now log in.",
          }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({
            detail: "Invalid or expired verification token.",
          }),
      });

    const successRes = await verifyEmail(
      "http://test-server",
      "valid-token",
      mockFetch as any,
    );
    expect(successRes.success).toBe(true);
    expect(successRes.message).toContain("successfully verified");

    const failRes = await verifyEmail(
      "http://test-server",
      "bad-token",
      mockFetch as any,
    );
    expect(failRes.success).toBe(false);
    expect(failRes.error).toContain("expired");
  });

  it("handles resendVerification success and error", async () => {
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            message: "Verification email sent. Please check your inbox.",
          }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({
            detail: "This account is already verified.",
          }),
      });

    const successRes = await resendVerification(
      "http://test-server",
      "test@example.com",
      mockFetch as any,
    );
    expect(successRes.success).toBe(true);
    expect(successRes.message).toContain("sent");

    const failRes = await resendVerification(
      "http://test-server",
      "already@example.com",
      mockFetch as any,
    );
    expect(failRes.success).toBe(false);
    expect(failRes.error).toContain("already verified");
  });

  it("persists and retrieves last account independently of active token session (#137)", () => {
    authStorage.clearLastAccount();
    expect(authStorage.getLastAccount()).toBeNull();

    authStorage.saveLastAccount({
      userId: "user-persistent-999",
      email: "offline-user@example.com",
    });

    const account = authStorage.getLastAccount();
    expect(account).toEqual({
      userId: "user-persistent-999",
      email: "offline-user@example.com",
    });

    // clearSession should NOT wipe out lastAccount so offline mode retains the user identity
    authStorage.clearSession();
    expect(authStorage.loadSession()).toBeNull();
    expect(authStorage.getLastAccount()).toEqual({
      userId: "user-persistent-999",
      email: "offline-user@example.com",
    });

    // explicit clearLastAccount
    authStorage.clearLastAccount();
    expect(authStorage.getLastAccount()).toBeNull();
  });

  it("handles successful token refresh and updates session in authStorage", async () => {
    authStorage.saveSession({
      token: "old-token-xyz",
      email: "user@example.com",
      userId: "user-123",
    });

    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: "refreshed-token-abc",
          token_type: "bearer",
        }),
    });

    const res = await refreshToken(
      "http://test-server",
      "old-token-xyz",
      mockFetch as any,
    );
    expect(res.success).toBe(true);
    expect(res.session?.token).toBe("refreshed-token-abc");

    const loaded = authStorage.loadSession();
    expect(loaded?.token).toBe("refreshed-token-abc");
    expect(loaded?.email).toBe("user@example.com");

    expect(mockFetch).toHaveBeenCalledWith(
      "http://test-server/api/v1/auth/refresh",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer old-token-xyz",
        }),
      }),
    );
  });

  it("handles failed token refresh on 401 error", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ detail: "Token refresh window expired" }),
    });

    const res = await refreshToken(
      "http://test-server",
      "expired-token",
      mockFetch as any,
    );
    expect(res.success).toBe(false);
    expect(res.error).toContain("Token refresh window expired");
  });

  it("notifies session expired listeners", () => {
    const listener = jest.fn();
    const unsubscribe = onSessionExpired(listener);

    notifySessionExpired();
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    notifySessionExpired();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

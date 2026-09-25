import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginView } from "./LoginView";

describe("LoginView", () => {
  beforeEach(() => {
    window.PATIENT_APP_ENV = {
      API_BASE_URL: "https://hospital.example.com",
      GOOGLE_CLIENT_ID: "google-client-id.apps.googleusercontent.com",
    };
    vi.stubGlobal("fetch", vi.fn());

    let credentialCallback: ((response: { credential?: string }) => void) | undefined;
    window.google = {
      accounts: {
        id: {
          initialize: vi.fn((options) => {
            credentialCallback = options.callback;
          }),
          renderButton: vi.fn(),
          prompt: vi.fn(() => {
            credentialCallback?.({ credential: "google-credential" });
          }),
        },
      },
    };
  });

  it("sends username and password login payload", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true, access_token: "token" }), {
        headers: { "content-type": "application/json" },
      }),
    );
    const onSuccess = vi.fn();
    render(createElement(LoginView, {
      onRegister: vi.fn(),
      onSuccess,
      onGoogleRegister: vi.fn(),
    }));
    fireEvent.change(screen.getByLabelText("ชื่อผู้ใช้ หรือ อีเมล *"), {
      target: { value: "somchai99" },
    });
    fireEvent.change(screen.getByLabelText("รหัสผ่าน *"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "เข้าสู่ระบบ" }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith("token", undefined));
    expect(vi.mocked(fetch).mock.calls[0][1]?.body).toContain('"identifier":"somchai99"');
  });

  it("navigates to register view when register button clicked", () => {
    const onRegister = vi.fn();
    render(createElement(LoginView, {
      onRegister,
      onSuccess: vi.fn(),
      onGoogleRegister: vi.fn(),
    }));
    fireEvent.click(screen.getByRole("button", { name: /ลงทะเบียนผู้ป่วยใหม่/ }));
    expect(onRegister).toHaveBeenCalledTimes(1);
  });

  it("sends the Google Identity ID token as credential", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true, access_token: "google_token" }), {
        headers: { "content-type": "application/json" },
      }),
    );
    const onSuccess = vi.fn();
    render(createElement(LoginView, {
      onRegister: vi.fn(),
      onSuccess,
      onGoogleRegister: vi.fn(),
    }));

    const googleButton = await screen.findByRole("button", { name: "เข้าสู่ระบบด้วย Google" });
    await waitFor(() => expect(googleButton).toBeEnabled());
    fireEvent.click(googleButton);

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith("google_token", undefined));
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain("/api/patient/auth/google/");
    expect(init?.body).toContain('"credential":"google-credential"');
  });

  it("routes a new Google user into linked registration", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({
        ok: true,
        is_new_user: true,
        temp_token: "google-temp-token",
        suggested_profile: {
          first_name: "Somchai",
          last_name: "Jaidee",
          email: "somchai@example.com",
        },
      }), {
        headers: { "content-type": "application/json" },
      }),
    );
    const onGoogleRegister = vi.fn();
    render(createElement(LoginView, {
      onRegister: vi.fn(),
      onSuccess: vi.fn(),
      onGoogleRegister,
    }));

    const googleButton = await screen.findByRole("button", { name: "เข้าสู่ระบบด้วย Google" });
    await waitFor(() => expect(googleButton).toBeEnabled());
    fireEvent.click(googleButton);

    await waitFor(() => expect(onGoogleRegister).toHaveBeenCalledWith(
      "google-temp-token",
      {
        first_name: "Somchai",
        last_name: "Jaidee",
        email: "somchai@example.com",
      },
    ));
  });

  it("opens forgot password modal when forgot password link is clicked", () => {
    render(createElement(LoginView, {
      onRegister: vi.fn(),
      onSuccess: vi.fn(),
      onGoogleRegister: vi.fn(),
    }));
    fireEvent.click(screen.getByRole("button", { name: /ลืมรหัสผ่าน\?/ }));
    expect(screen.getByRole("heading", { name: /ลืมรหัสผ่าน \/ กู้คืนบัญชี/ })).toBeDefined();
  });

  it("initializes Google Identity Services and uses prompt from the compact trigger", async () => {
    let capturedCallback: ((response: { credential: string }) => void) | undefined;
    const initializeMock = vi.fn().mockImplementation((config: any) => {
      capturedCallback = config.callback;
    });
    const promptMock = vi.fn(() => {
      capturedCallback?.({ credential: "real_jwt_from_google" });
    });
    const renderButtonMock = vi.fn();

    window.google = {
      accounts: {
        id: {
          initialize: initializeMock,
          renderButton: renderButtonMock,
          prompt: promptMock,
        },
      },
    } as any;

    window.PATIENT_APP_ENV = {
      API_BASE_URL: "https://hospital.example.com",
      GOOGLE_CLIENT_ID: "test-client-id.apps.googleusercontent.com",
    };

    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true, access_token: "real_google_session_token" }), {
        headers: { "content-type": "application/json" },
      }),
    );

    const onSuccess = vi.fn();
    render(createElement(LoginView, { onRegister: vi.fn(), onSuccess }));

    await waitFor(() => expect(initializeMock).toHaveBeenCalled());
    expect(initializeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: "test-client-id.apps.googleusercontent.com",
      }),
    );

    const googleButton = await screen.findByRole("button", { name: "เข้าสู่ระบบด้วย Google" });
    expect(googleButton).toBeEnabled();
    fireEvent.click(googleButton);

    expect(promptMock).toHaveBeenCalledTimes(1);
    expect(renderButtonMock).not.toHaveBeenCalled();

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith("real_google_session_token", undefined));
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "https://hospital.example.com/api/patient/auth/google/",
      expect.objectContaining({
        body: JSON.stringify({ credential: "real_jwt_from_google" }),
      }),
    );
  });
});

import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const servers: ChildProcess[] = [];

function startServer(command: string, args: string[], env: NodeJS.ProcessEnv = process.env) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env,
    stdio: "ignore",
    windowsHide: true,
  });
  servers.push(child);
  return child;
}

async function waitForServer(child: ChildProcess, url: string) {
  let startupError: Error | undefined;
  child.once("error", (error) => { startupError = error; });

  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (startupError) throw startupError;
    if (child.exitCode !== null) throw new Error(`Test server exited early (${child.exitCode}): ${url}`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.status < 500) return;
    } catch {
      // Keep waiting while the server starts.
    }
    await delay(250);
  }

  throw new Error(`Test server did not start: ${url}`);
}

async function stopServer(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(forceStop);
      resolve();
    };
    const forceStop = setTimeout(() => {
      child.kill("SIGKILL");
      finish();
    }, 2000);
    child.once("exit", finish);
    child.kill();
  });
}

export default async function globalSetup() {
  const backendEnv = {
    ...process.env,
    PYTHONIOENCODING: "utf-8",
    MOCK_BACKEND_PORT: "8001",
    MOCK_BACKEND_TEST_MODE: "1",
  };
  const backend = startServer("python", ["mock_backend.py"], backendEnv);
  const frontend = startServer("python", ["-m", "http.server", "5500", "--bind", "127.0.0.1", "-d", "dist"]);

  try {
    await Promise.all([
      waitForServer(backend, "http://127.0.0.1:8001/"),
      waitForServer(frontend, "http://127.0.0.1:5500/patient/"),
    ]);
    const response = await fetch("http://127.0.0.1:8001/__test__/reset/", { method: "POST" });
    if (!response.ok) throw new Error("Playwright test backend is not in isolated test mode");
  } catch (error) {
    await Promise.all(servers.map(stopServer));
    throw error;
  }

  return async () => {
    await Promise.all(servers.map(stopServer));
  };
}

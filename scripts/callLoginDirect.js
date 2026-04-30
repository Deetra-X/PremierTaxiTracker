import { login } from "../src/modules/auth/auth.service.js";

try {
  const out = await login({ email: "hqadmin@police.lk", password: "Password123!" });
  // eslint-disable-next-line no-console
  console.log("login ok, token length:", out.token.length);
} catch (err) {
  // eslint-disable-next-line no-console
  console.error("login failed:", err?.message, err?.code, err?.status);
  process.exitCode = 1;
}


const port = process.env.API_PORT ? Number(process.env.API_PORT) : 3003;

const res = await fetch(`http://localhost:${port}/api/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "hqadmin@police.lk", password: "Password123!" })
});

// eslint-disable-next-line no-console
console.log("status", res.status);
// eslint-disable-next-line no-console
console.log(await res.text());


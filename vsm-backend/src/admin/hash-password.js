import { readFileSync } from "node:fs";
import { passwordHash } from "../security.js";

if (process.stdin.isTTY) {
  console.error("Passe a senha do painel pela entrada padrão. Veja o README.");
  process.exit(1);
}
const password = readFileSync(0, "utf8").replace(/\r?\n$/, "");
if (password.length < 12 || password.length > 256) {
  console.error("Use entre 12 e 256 caracteres para a senha do painel.");
  process.exit(1);
}
console.log(await passwordHash(password));

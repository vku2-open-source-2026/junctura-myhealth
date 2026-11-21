// SPDX-FileCopyrightText: 2026 Junctura Contributors
// SPDX-License-Identifier: Apache-2.0
import { createServer } from "node:http";
import { createApp } from "./app.mjs";
import { loadPatients } from "./accounts.mjs";
import { loadConfig } from "./config.mjs";
import { loadAppIds } from "./directory.mjs";
import { createGateway } from "./gateway.mjs";
import { createVerifier } from "./jwt.mjs";
import { openProfiles } from "./profile.mjs";

let config;
try {
  config = loadConfig();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
const portFlag = process.argv.indexOf("--port");
if (portFlag !== -1) config = Object.freeze({ ...config, port: Number(process.argv[portFlag + 1]) });

let patients;
try {
  patients = loadPatients(config.healthDir);
} catch (error) {
  console.error(`Cannot load the demo accounts from ${config.healthDir}: ${error.message}\nClone junctura-health next to this repository or set JUNCTURA_HEALTH_DIR.`);
  process.exit(1);
}
const appIds = loadAppIds(config.healthDir);
if (Object.keys(appIds).length < 2) console.warn("No application ids found under junctura-health/.junctura/demo: granting consent is unavailable until `npm run demo:setup` has run.");
if (!config.junctura) console.warn("JUNCTURA_URL is not set: consents and the access log are unavailable.");

const verifier = createVerifier({ issuer: config.issuer, keysBase: config.issuerInternal, clientId: config.webClientId });
const profiles = openProfiles(config.dbFile);
const gateway = config.junctura ? createGateway({ baseUrl: config.junctura.baseUrl }) : undefined;

const server = createServer(createApp({ config, patients, verifier, gateway, profiles, appIds }));
server.listen(config.port, config.host, () => {
  console.log(`Junctura MyHealth listening on http://${config.host}:${server.address().port}`);
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close(() => { profiles.close(); process.exit(0); }));

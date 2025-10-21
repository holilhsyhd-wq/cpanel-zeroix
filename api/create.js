import fs from "fs";
import path from "path";
import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Gunakan metode POST." });
  }

  const { serverName, memory, mode, password } = req.body || {};
  if (!serverName || !memory || !mode || !password) {
    return res.status(400).json({ success: false, error: "Data tidak lengkap." });
  }

  const isPrivate = mode === "private";
  const validPrivate = password === process.env.PRIVATE_SECRET_KEY;
  const validPublic = password === process.env.PUBLIC_SECRET_KEY;

  if (isPrivate && !validPrivate) return res.status(403).json({ success: false, error: "❌ Password private salah!" });
  if (!isPrivate && !validPublic) return res.status(403).json({ success: false, error: "❌ Password public salah!" });

  const config = {
    domain: isPrivate ? process.env.PRIVATE_PTERO_DOMAIN : process.env.PUBLIC_PTERO_DOMAIN,
    apiKey: isPrivate ? process.env.PRIVATE_PTERO_API_KEY : process.env.PUBLIC_PTERO_API_KEY,
    eggId: isPrivate ? process.env.PRIVATE_EGG_ID : process.env.PUBLIC_EGG_ID,
    locationId: isPrivate ? process.env.PRIVATE_LOCATION_ID : process.env.PUBLIC_LOCATION_ID,
    disk: isPrivate ? process.env.PRIVATE_DISK : process.env.PUBLIC_DISK,
    cpu: isPrivate ? process.env.PRIVATE_CPU : process.env.PUBLIC_CPU
  };

  const logsPath = path.resolve("./api/logs.json");
  if (!fs.existsSync(logsPath)) fs.writeFileSync(logsPath, "[]");

  async function createUser(serverName) {
    const url = `${config.domain}/api/application/users`;
    const random = Math.random().toString(36).substring(7);
    const email = `${serverName.toLowerCase().replace(/\s+/g, '')}@${random}.com`;
    const username = `${serverName.toLowerCase().replace(/\s+/g, '')}_${random}`;
    const password = Math.random().toString(36).slice(-10);

    const userData = {
      email, username,
      first_name: serverName,
      last_name: "User",
      password,
      root_admin: false
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(userData),
    });

    const data = await response.json();
    if (response.status === 201) return { success: true, user: data.attributes, password };
    return { success: false, error: data.errors?.[0]?.detail || "Gagal membuat user." };
  }

  async function createServer(serverName, memory, userId) {
    const url = `${config.domain}/api/application/servers`;
    const serverData = {
      name: serverName,
      user: userId,
      egg: parseInt(config.eggId),
      docker_image: "ghcr.io/parkervcp/yolks:nodejs_18",
      startup: "npm install && node index.js",
      environment: { CMD_RUN: "node index.js" },
      limits: {
        memory: parseInt(memory),
        swap: 0,
        disk: parseInt(config.disk),
        io: 500,
        cpu: parseInt(config.cpu)
      },
      feature_limits: { databases: 1, allocations: 1, backups: 1 },
      deploy: { locations: [parseInt(config.locationId)], dedicated_ip: false, port_range: [] }
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(serverData),
    });

    const data = await response.json();
    if (response.status === 201) return { success: true, data: data.attributes };
    return { success: false, error: data.errors?.[0]?.detail || "Gagal membuat server." };
  }

  try {
    const user = await createUser(serverName);
    if (!user.success) return res.json(user);

    const server = await createServer(serverName, memory, user.user.id);
    if (!server.success) return res.json(server);

    // Tulis log aktivitas
    const logs = JSON.parse(fs.readFileSync(logsPath, "utf-8"));
    logs.push({
      time: new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }),
      mode: mode,
      server: serverName,
      memory,
      panel: config.domain,
      ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress
    });
    fs.writeFileSync(logsPath, JSON.stringify(logs, null, 2));

    return res.json({
      success: true,
      panel: config.domain,
      user: user.user,
      password: user.password,
      server: server.data,
      mode: mode
    });
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ success: false, error: "Terjadi kesalahan server." });
  }
}

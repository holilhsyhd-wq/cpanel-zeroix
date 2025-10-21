import fs from "fs";
import path from "path";

export default function handler(req, res) {
  const { key } = req.query;

  if (key !== process.env.ADMIN_LOG_PASSWORD) {
    return res.status(403).json({ success: false, error: "Akses ditolak! Password salah." });
  }

  const logsPath = path.resolve("./api/logs.json");
  if (!fs.existsSync(logsPath)) return res.json({ success: true, logs: [] });

  const logs = JSON.parse(fs.readFileSync(logsPath, "utf-8"));
  return res.json({ success: true, logs });
}

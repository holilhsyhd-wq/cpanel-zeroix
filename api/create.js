export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { mode, server_name, ram } = req.body;

    if (!mode || !server_name || !ram) {
      return res.status(400).json({ message: "Data tidak lengkap." });
    }

    // Ambil environment variables sesuai mode
    const isPrivate = mode === "private";

    const domain = isPrivate
      ? process.env.PRIVATE_PTERO_DOMAIN
      : process.env.PUBLIC_PTERO_DOMAIN;

    const apiKey = isPrivate
      ? process.env.PRIVATE_PTERO_API_KEY
      : process.env.PUBLIC_PTERO_API_KEY;

    const egg = isPrivate
      ? process.env.PRIVATE_EGG_ID
      : process.env.PUBLIC_EGG_ID;

    const location = isPrivate
      ? process.env.PRIVATE_LOCATION_ID
      : process.env.PUBLIC_LOCATION_ID;

    const cpu = isPrivate
      ? process.env.PRIVATE_CPU
      : process.env.PUBLIC_CPU;

    const disk = isPrivate
      ? process.env.PRIVATE_DISK
      : process.env.PUBLIC_DISK;

    // Validasi environment variable
    if (!domain || !apiKey) {
      return res.status(500).json({ message: "Konfigurasi .env tidak lengkap" });
    }

    // Panggil API Pterodactyl
    const createUrl = `${domain}/api/application/servers`;
    const response = await fetch(createUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        name: server_name,
        user: 1, // ID user Pterodactyl (ubah sesuai kebutuhanmu)
        egg: Number(egg),
        docker_image: "ghcr.io/parkervcp/yolks:nodejs_18",
        startup: "npm start",
        environment: {},
        limits: {
          memory: Number(ram),
          swap: 0,
          disk: Number(disk),
          io: 500,
          cpu: Number(cpu),
        },
        feature_limits: {
          databases: 1,
          allocations: 1,
        },
        allocation: {
          default: 1,
        },
        deploy: {
          locations: [Number(location)],
          dedicated_ip: false,
          port_range: [],
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({
        message: `Gagal membuat server (${response.status})`,
        detail: text,
      });
    }

    const data = await response.json();
    return res.status(200).json({
      message: "Server berhasil dibuat!",
      server: data,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Terjadi kesalahan internal." });
  }
}

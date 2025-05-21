// dropbox-gallery.js
// Node.js script ที่ใช้ refresh token ดึงภาพจากโฟลเดอร์ /gallery ใน Dropbox
// แล้วเขียน gallery.json ที่มีลิงก์ภาพทั้งหมด

const fs = require("fs");
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const APP_KEY = "9q4xostz35xobpa";
const APP_SECRET = "4n38qvssrf5trjn";
const REFRESH_TOKEN = "tNg8BA_m55gAAAAAAAAAAcBfMVjiysYYZGzFYKONTYWts0kG6ORuJgttI21cYByw";

async function getAccessToken() {
  const params = new URLSearchParams();
  params.append("grant_type", "refresh_token");
  params.append("refresh_token", REFRESH_TOKEN);

  const auth = Buffer.from(`${APP_KEY}:${APP_SECRET}`).toString("base64");

  const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  const data = await res.json();
  return data.access_token;
}

async function listFiles(token) {
  const res = await fetch("https://api.dropboxapi.com/2/files/list_folder", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path: "/gallery" }),
  });
  const data = await res.json();
  return data.entries.filter((f) => f[".tag"] === "file");
}

async function getTempLink(token, path) {
  const res = await fetch("https://api.dropboxapi.com/2/files/get_temporary_link", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path }),
  });
  const data = await res.json();
  return data.link;
}

(async () => {
  try {
    const token = await getAccessToken();
    const files = await listFiles(token);
    const links = [];

    for (const file of files) {
      const link = await getTempLink(token, file.path_lower);
      links.push(link);
    }

    fs.writeFileSync("gallery.json", JSON.stringify(links, null, 2));
    console.log("✅ เขียน gallery.json สำเร็จแล้ว ✔");
  } catch (err) {
    console.error("❌ เกิดข้อผิดพลาด:", err);
  }
})();

// HELL OF ANT · 이벤트별 공유 미리보기 (Vercel Function)
// /s/<이벤트ID> 로 들어오면 그 이벤트의 제목·포스터를 메타태그(og)에 담아 보여주고,
// 사람은 곧바로 사이트의 이벤트 상세 화면(/?e=<ID>)으로 이동해요.
// 필요한 환경변수 (Vercel > Settings > Environment Variables)
//   SUPABASE_URL       : config.js 의 supabaseUrl 과 같은 값
//   SUPABASE_ANON_KEY  : config.js 의 supabaseAnonKey 와 같은 값
//   DEFAULT_POSTER     : (선택) 플라이어 없는 일정에 쓸 이미지 파일 이름. 기본값 default-poster.jpg

const WD = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const SITE = "HELL OF ANT · 개미지옥 행사 캘린더";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
const md = (s) => { const [y, m, d] = s.split("-").map(Number); const dt = new Date(Date.UTC(y, m - 1, d)); return `${String(m).padStart(2, "0")}.${String(d).padStart(2, "0")} ${WD[dt.getUTCDay()]}`; };

function page({ title, desc, image, url, target }) {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(SITE)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}">
${image ? `<meta property="og:image" content="${esc(image)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${esc(image)}">` : `<meta name="twitter:card" content="summary">`}
<meta name="theme-color" content="#0b0b0c">
<style>body{margin:0;background:#0b0b0c;color:#fafafa;font:15px/1.5 system-ui,sans-serif;display:grid;place-items:center;min-height:100vh}a{color:#b9a8ff}</style>
</head><body>
<p><a href="${esc(target)}">${esc(title)} 일정 보러 가기 →</a></p>
<script>location.replace(${JSON.stringify(target)});</script>
</body></html>`;
}

module.exports = async function handler(req, res) {
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const origin = `https://${host}`;
  const id = String((req.query && req.query.id) || "");
  const valid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const target = valid ? `/?e=${id}` : "/";
  const fallback = { title: SITE, desc: "개미지옥과 함께 가고 싶은 공연, 파티, 페스티벌을 모아두는 곳", image: "", url: `${origin}/`, target };

  const SB = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const KEY = process.env.SUPABASE_ANON_KEY || "";
  const poster = process.env.DEFAULT_POSTER || "default-poster.jpg";
  let data = fallback;

  if (valid && SB && KEY) {
    try {
      const r = await fetch(`${SB}/rest/v1/events?id=eq.${id}&status=eq.approved&select=title,start_date,end_date,start_time,venue,flyer_path&limit=1`, {
        headers: { apikey: KEY, Accept: "application/json" },
      });
      const rows = r.ok ? await r.json() : [];
      const e = rows[0];
      if (e) {
        const when = `${md(e.start_date)}${e.end_date && e.end_date > e.start_date ? ` – ${md(e.end_date)}` : ""}${e.start_time ? " " + e.start_time : ""}`;
        data = {
          title: e.title,
          desc: `${when}${e.venue ? " · " + e.venue : ""} | HELL OF ANT`,
          image: e.flyer_path ? `${SB}/storage/v1/object/public/flyers/${e.flyer_path.split("/").map(encodeURIComponent).join("/")}` : (/^[\w./-]+$/.test(poster) ? `${origin}/${poster}` : ""),
          url: `${origin}/s/${id}`,
          target,
        };
      }
    } catch (_) { /* 실패하면 사이트 공통 미리보기 */ }
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
  res.status(200).send(page(data));
};

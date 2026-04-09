const fs = require("fs");
const path = require("path");

const {
  buildThemePalette,
  escapeHtml,
  initialsOf,
  isDirectVideoUrl,
  toEmbedVideoUrl,
} = require("./generator-utils");

const WEBSITE_PAGES = [
  { slug: "index", label: "Home", file: "index.html" },
  { slug: "academics", label: "Academics", file: "academics.html" },
  { slug: "people", label: "People", file: "people.html" },
  { slug: "media", label: "Media", file: "media.html" },
  { slug: "updates", label: "Updates", file: "updates.html" },
  { slug: "admissions", label: "Admissions", file: "admissions.html" },
  { slug: "contact", label: "Contact", file: "contact.html" },
];

const PAGE_TEASERS = {
  academics: ["Programs", "Structured academic pathways", "Frame the institute with cleaner program cards, facilities, and admissions clarity."],
  people: ["People", "Leadership and learning culture", "Surface the principal note, staff profiles, and community voice instead of burying them in plain text."],
  media: ["Media", "A richer visual story", "Turn gallery images, campus frames, and videos into a stronger first impression for families."],
  updates: ["Updates", "Signals from campus life", "Keep social channels, focus stories, and reputation cues visible in one place."],
  admissions: ["Admissions", "Enrollment without friction", "Show process, FAQs, support, and next steps in a cleaner page built for decision-making."],
  contact: ["Contact", "Direct ways to reach the team", "Lead with the phone, email, map, and official links so the next action is obvious."],
};

const WEBSITE_TEMPLATE_DIR = path.resolve(__dirname, "..", "..", "site", "website");

function buildWebsitePages(business, website) {
  return {
    "index.html": renderHomePage(business, website),
    "academics.html": renderAcademicsPage(business, website),
    "people.html": renderPeoplePage(business, website),
    "media.html": renderMediaPage(business, website),
    "updates.html": renderUpdatesPage(business, website),
    "admissions.html": renderAdmissionsPage(business, website),
    "contact.html": renderContactPage(business, website),
  };
}

function buildWebsiteStyles(website) {
  const theme = buildThemePalette(website.theme_seed);
  const template = readWebsiteTemplateAsset("styles.css");
  if (!template) {
    return [buildStyleBase(theme), buildStyleComponents(), buildStyleResponsive()].join("\n");
  }

  return template
    .replace(/--tone:\s*#[0-9a-f]{6};/i, `--tone: ${theme.primary};`)
    .replace(/--tone-soft:\s*rgba\([^)]+\);/i, `--tone-soft: ${theme.primarySoft};`);
}

function buildWebsiteScript() {
  return readWebsiteTemplateAsset("site.js") || buildFallbackWebsiteScript();
}

function readWebsiteTemplateAsset(filename) {
  const assetPath = path.join(WEBSITE_TEMPLATE_DIR, filename);
  try {
    return fs.readFileSync(assetPath, "utf8");
  } catch {
    return "";
  }
}

function buildFallbackWebsiteScript() {
  return `function initRevealAnimations(){const items=Array.from(document.querySelectorAll("[data-reveal]"));if(!items.length)return;const reducedMotion=window.matchMedia("(prefers-reduced-motion: reduce)").matches;const showAll=()=>{items.forEach((item)=>{item.classList.add("visible")})};if(reducedMotion||!("IntersectionObserver"in window)){showAll();return}const observer=new IntersectionObserver((entries)=>{entries.forEach((entry)=>{if(!entry.isIntersecting)return;entry.target.classList.add("visible");observer.unobserve(entry.target)})},{threshold:.16,rootMargin:"0px 0px -8% 0px"});items.forEach((item)=>{observer.observe(item)})}function initNavMenus(){const menus=Array.from(document.querySelectorAll(".nav-menu"));if(!menus.length)return;const closeAll=(exceptMenu=null)=>{menus.forEach((menu)=>{if(menu!==exceptMenu){menu.open=false}})};menus.forEach((menu)=>{const toggle=menu.querySelector(".nav-toggle");const links=Array.from(menu.querySelectorAll(".nav-links a"));if(toggle){toggle.setAttribute("aria-expanded","false")}menu.addEventListener("toggle",()=>{if(menu.open){closeAll(menu)}if(toggle){toggle.setAttribute("aria-expanded",menu.open?"true":"false")}});links.forEach((link)=>{link.addEventListener("click",()=>{menu.open=false})})});document.addEventListener("click",(event)=>{const target=event.target;if(!(target instanceof Node)){return}menus.forEach((menu)=>{if(!menu.contains(target)){menu.open=false}})});document.addEventListener("keydown",(event)=>{if(event.key==="Escape"){closeAll()}})}document.addEventListener("DOMContentLoaded",()=>{initRevealAnimations();initNavMenus()});`;
}

function buildStyleBase(theme) {
  return `@import url("https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Poppins:wght@300;400;500;600;700&family=Qwitcher+Grypen:wght@400;700&display=swap");
:root{color-scheme:dark;--tone:${theme.primary};--tone-soft:${theme.primarySoft};--accent:#d2a855;--accent-bright:#efd296;--accent-soft:rgba(210,168,85,.16);--accent-line:rgba(210,168,85,.28);--bg:#141414;--panel:rgba(255,255,255,.045);--panel-strong:rgba(255,255,255,.075);--border:rgba(255,255,255,.12);--border-strong:rgba(255,255,255,.18);--text:#f7f3ee;--text-dim:rgba(247,243,238,.74);--text-faint:rgba(247,243,238,.54);--shadow:0 30px 90px rgba(0,0,0,.4);--radius-xl:34px;--radius-lg:26px;--radius-md:18px;--radius-pill:999px;--max-width:1240px}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;min-height:100vh;font-family:"Poppins","Segoe UI",sans-serif;color:var(--text);background:radial-gradient(circle at top left,rgba(210,168,85,.1),transparent 28rem),radial-gradient(circle at top right,var(--tone-soft),transparent 24rem),linear-gradient(180deg,#111 0%,#151311 44%,#191713 100%);overflow-x:hidden}body::before{content:"";position:fixed;inset:0;pointer-events:none;background:linear-gradient(120deg,rgba(255,255,255,.03),transparent 30%),radial-gradient(circle at 1px 1px,rgba(210,168,85,.08) 1px,transparent 0);background-size:auto,28px 28px;opacity:.6}img{display:block;max-width:100%}a{color:inherit}
.site-shell{position:relative;z-index:1;width:min(calc(100vw - 28px),var(--max-width));margin:0 auto;padding:18px 0 46px}.page-main{display:grid;gap:26px}
.site-header{position:sticky;top:14px;z-index:40;margin-bottom:20px;border:1px solid var(--border);border-radius:var(--radius-pill);background:rgba(18,18,18,.76);backdrop-filter:blur(18px);box-shadow:0 18px 50px rgba(0,0,0,.24)}.site-nav{display:flex;align-items:center;gap:20px;padding:14px 18px}.nav-menu{min-width:0;margin-left:auto}.nav-links{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px}.nav-toggle{display:none;min-height:44px;padding:0 16px;border:1px solid var(--border);border-radius:var(--radius-pill);background:rgba(255,255,255,.06);color:var(--text);font-weight:600;cursor:pointer;list-style:none}.nav-toggle::-webkit-details-marker{display:none}
.brand{display:flex;align-items:center;gap:14px;min-width:0;text-decoration:none}.brand-mark,.brand-mark-fallback,.hero-logo,.hero-logo-fallback,.tile-fallback,.staff-photo-fallback,.media-fallback{display:grid;place-items:center}.brand-mark,.brand-mark-fallback{width:56px;height:56px;border-radius:18px;object-fit:cover;background:linear-gradient(145deg,rgba(255,255,255,.12),rgba(255,255,255,.04));border:1px solid rgba(255,255,255,.16);box-shadow:0 16px 40px rgba(0,0,0,.28)}.brand-mark-fallback,.hero-logo-fallback,.tile-fallback,.staff-photo-fallback,.media-fallback{font-family:"Cormorant Garamond",serif;color:var(--accent-bright)}
.brand-copy,.footer-brand-copy{min-width:0;display:grid;gap:3px}.brand-copy strong,.footer-brand-copy strong,.section-heading h2,.hero-copy h1,.metric-card strong,.program-card h3,.glass-card h3,.contact-card strong,.quote-card strong,.faq-item summary,.page-link-card h3{font-family:"Cormorant Garamond",serif;font-weight:500}.brand-copy strong{font-size:1.1rem;line-height:1.1;overflow-wrap:anywhere}.brand-copy span,.footer-brand-copy span,.meta-line,.supporting-copy,.contact-card p,.program-card p,.quote-card p,.page-link-card p,.footer-text,.tiny-copy,.social-card p,.timeline-card p,.faq-item p,.hero-note p{color:var(--text-dim);overflow-wrap:anywhere}
.nav-links a,.button,.social-pill,.contact-link{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 18px;border-radius:var(--radius-pill);text-decoration:none;font-weight:600;transition:transform 220ms ease,background-color 220ms ease,color 220ms ease,border-color 220ms ease,box-shadow 220ms ease}.nav-links a{color:var(--text-dim)}.nav-links a.active,.nav-links a:hover{color:var(--text);background:rgba(255,255,255,.08)}.button-row,.chip-row,.footer-socials,.contact-links{display:flex;flex-wrap:wrap;gap:12px}.button.primary{background:var(--accent);color:#17120b;box-shadow:0 14px 30px rgba(210,168,85,.18)}.button.secondary,.contact-link{border:1px solid var(--accent-line);background:rgba(255,255,255,.06);color:var(--text)}.button.ghost,.social-pill{border:1px solid var(--border);background:transparent;color:var(--text-dim)}.button.primary:hover,.button.secondary:hover,.button.ghost:hover,.social-pill:hover,.contact-link:hover{transform:translateY(-2px)}.button.ghost:hover,.social-pill:hover{border-color:var(--accent-line);color:var(--text)}
.section-frame,.hero-stage,.glass-card,.page-link-card,.gallery-tile,.video-card,.social-card,.contact-card,.quote-card,.timeline-card,.faq-item,.social-frame,.map-panel,.footer-shell{border:1px solid var(--border);border-radius:var(--radius-xl);background:var(--panel);box-shadow:var(--shadow)}.section-frame,.footer-shell{padding:28px}
.hero-stage{overflow:hidden;display:grid;grid-template-columns:minmax(0,1.08fr) minmax(340px,.92fr);gap:24px;padding:30px;background:linear-gradient(135deg,rgba(255,255,255,.06),rgba(255,255,255,.02)),radial-gradient(circle at top right,rgba(210,168,85,.16),transparent 26rem),linear-gradient(180deg,rgba(255,255,255,.02),rgba(255,255,255,0))}.hero-copy,.hero-media{min-width:0}
.script-mark{display:block;margin-bottom:6px;font-family:"Qwitcher Grypen",cursive;font-size:clamp(2.3rem,5vw,4rem);color:var(--accent);line-height:.92}.section-label{display:inline-flex;align-items:center;gap:14px;margin-bottom:16px;color:var(--accent-bright);font-size:.76rem;font-weight:600;letter-spacing:.3em;text-transform:uppercase}.section-label::after{content:"";width:72px;height:1px;background:linear-gradient(90deg,var(--accent),transparent)}.hero-copy h1{margin:0;font-size:clamp(3rem,7vw,6.2rem);line-height:.95;letter-spacing:-.02em;overflow-wrap:anywhere}.hero-lead,.section-heading p{margin:16px 0 0;max-width:64ch;font-size:1rem;line-height:1.85;color:var(--text-dim)}.chip-row{margin-top:20px}.hero-chip{display:inline-flex;align-items:center;min-height:38px;padding:0 14px;border-radius:var(--radius-pill);border:1px solid var(--border);background:rgba(255,255,255,.04);color:var(--text-dim)}
.metric-strip{margin-top:28px;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}.metric-card{min-width:0;padding:18px;border:1px solid var(--border);border-radius:22px;background:rgba(255,255,255,.04)}.metric-card strong{display:block;font-size:clamp(1.6rem,4vw,2.4rem);line-height:1;color:var(--accent-bright)}.metric-card span{display:block;margin-top:8px;color:var(--text-faint);font-size:.78rem;letter-spacing:.16em;text-transform:uppercase}
.hero-media{position:relative;min-height:clamp(320px,44vw,600px);border-radius:var(--radius-xl);overflow:hidden;background:radial-gradient(circle at top,rgba(255,255,255,.14),transparent 36%),linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,0))}.hero-media img,.media-fallback{width:100%;height:100%;object-fit:cover}.media-fallback{background:radial-gradient(circle at top right,var(--tone-soft),transparent 15rem),linear-gradient(135deg,rgba(255,255,255,.06),rgba(255,255,255,.03));font-size:clamp(3.2rem,10vw,5rem)}.hero-media::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.18),rgba(0,0,0,.56))}
.hero-note,.hero-mark{position:absolute;z-index:2;border:1px solid rgba(255,255,255,.12);backdrop-filter:blur(16px);background:rgba(10,10,10,.52)}.hero-note{inset:auto 20px 20px 20px;padding:18px;border-radius:24px}.hero-mark{top:20px;right:20px;min-width:170px;padding:16px;border-radius:22px}.hero-note strong,.hero-mark strong{display:block;color:var(--text);font-family:"Cormorant Garamond",serif;font-size:1.35rem}.hero-note p,.hero-mark span{margin:8px 0 0;color:var(--text-dim);line-height:1.7}.hero-logo,.hero-logo-fallback{width:54px;height:54px;border-radius:16px;object-fit:cover;margin-bottom:12px;background:rgba(255,255,255,.08)}
.section-split{display:grid;grid-template-columns:minmax(250px,330px) minmax(0,1fr);gap:24px;align-items:start}.section-heading.center{text-align:center;justify-items:center}.section-heading.center .section-label::after{background:linear-gradient(90deg,transparent,var(--accent),transparent)}.section-heading h2{margin:0;font-size:clamp(2rem,4vw,3.35rem);line-height:.98;overflow-wrap:anywhere}
[data-reveal]{opacity:0;transform:translateY(28px);transition:opacity 720ms ease,transform 720ms ease}[data-reveal="left"]{transform:translateX(-34px)}[data-reveal="right"]{transform:translateX(34px)}[data-reveal].visible{opacity:1;transform:translate3d(0,0,0)}`;
}

function buildStyleComponents() {
  return `.card-stack,.support-stack,.faq-list,.footer-grid{display:grid;gap:18px}.glass-card,.page-link-card,.gallery-tile,.video-card,.social-card,.contact-card,.quote-card,.timeline-card,.faq-item{min-width:0;padding:22px}
.card-grid,.program-grid,.gallery-grid,.video-grid,.social-grid,.contact-grid,.quote-grid,.page-link-grid,.detail-grid{display:grid;gap:18px}.card-grid,.social-grid,.contact-grid,.page-link-grid{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}.program-grid{grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}.gallery-grid{grid-template-columns:repeat(12,minmax(0,1fr))}.video-grid,.quote-grid{grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}.staff-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:18px}
.gallery-tile{grid-column:span 4;overflow:hidden;min-height:260px;border-radius:var(--radius-lg);padding:0;background:rgba(255,255,255,.03)}.gallery-tile.featured{grid-column:span 8;min-height:420px}.gallery-tile img,.tile-fallback{width:100%;height:100%;object-fit:cover}.tile-fallback{padding:22px;background:radial-gradient(circle at top right,var(--tone-soft),transparent 15rem),linear-gradient(135deg,rgba(255,255,255,.06),rgba(255,255,255,.03));text-align:left}.tile-fallback strong{display:block;font-family:"Cormorant Garamond",serif;font-size:1.4rem;color:var(--text)}.tile-fallback span{display:block;margin-top:10px;color:var(--text-dim);line-height:1.7}
.program-card{position:relative;overflow:hidden}.program-card::before,.glass-card::before,.quote-card::before{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(145deg,rgba(255,255,255,.04),transparent 40%)}.card-eyebrow,.program-index,.inline-label{color:var(--accent-bright);font-size:.72rem;font-weight:600;letter-spacing:.22em;text-transform:uppercase}.program-index{display:inline-flex;margin-bottom:12px}.program-card h3,.glass-card h3,.page-link-card h3{margin:0;font-size:1.65rem;line-height:1.04}.card-meta,.page-link-card .card-meta,.staff-role{margin-top:8px;color:var(--text-faint);font-size:.82rem;letter-spacing:.08em;text-transform:uppercase}.card-copy{margin-top:14px;line-height:1.78;color:var(--text-dim)}.detail-list{display:grid;gap:10px;margin:0;padding-left:18px;color:var(--text-dim);line-height:1.7}
.page-link-card{text-decoration:none}.page-link-card:hover,.program-card:hover,.glass-card:hover,.social-card:hover,.contact-card:hover,.quote-card:hover{transform:translateY(-3px);border-color:var(--accent-line)}.page-link-card .inline-label,.social-card .inline-label,.quote-card .inline-label{display:inline-flex;margin-bottom:10px}
.staff-card{display:grid;gap:16px}.staff-photo,.staff-photo-fallback{width:100%;aspect-ratio:4/3;border-radius:22px;object-fit:cover;background:rgba(255,255,255,.04)}.staff-role{display:block;margin-top:6px}
.video-card iframe,.video-card video{width:100%;min-height:clamp(260px,28vw,420px);border:0;border-radius:22px;background:#0b0b0b}.video-card code,.social-card code,.contact-card code,.map-panel code{display:block;margin-top:12px;color:var(--text-faint);font-family:Consolas,"Courier New",monospace;overflow-wrap:anywhere}
.social-frame iframe{width:100%;min-height:680px;border:0;border-radius:22px;background:rgba(255,255,255,.02)}.timeline-grid{grid-template-columns:repeat(auto-fit,minmax(200px,1fr))}.timeline-card{display:grid;gap:12px}.timeline-step{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:50%;background:var(--accent-soft);color:var(--accent-bright);font-family:"Cormorant Garamond",serif;font-size:1.2rem}
.faq-item{overflow:hidden}.faq-item summary{cursor:pointer;list-style:none}.faq-item summary::-webkit-details-marker{display:none}.faq-item p{margin:12px 0 0;line-height:1.78}
.contact-card strong{display:block;font-size:1.5rem}.contact-card p,.social-card p,.quote-card p,.timeline-card p{margin:10px 0 0;line-height:1.78}
.map-panel iframe{width:100%;min-height:420px;border:0;border-radius:22px;background:rgba(255,255,255,.04)}.map-fallback{display:grid;gap:12px;padding:22px;border:1px dashed var(--border-strong);border-radius:22px;background:rgba(255,255,255,.03)}
.footer-shell{margin-top:8px;padding-bottom:20px}.footer-grid{grid-template-columns:minmax(0,1.2fr) repeat(2,minmax(0,.8fr));align-items:start}.footer-links{display:grid;gap:10px}.footer-links a{color:var(--text-dim);text-decoration:none}.footer-links a:hover{color:var(--accent-bright)}.footer-bottom{margin-top:22px;padding-top:18px;border-top:1px solid var(--border);display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px}`;
}

function buildStyleResponsive() {
  return `@media (max-width:1080px){.hero-stage,.section-split,.footer-grid{grid-template-columns:1fr}.hero-copy h1{max-width:none}.gallery-tile,.gallery-tile.featured{grid-column:span 12;min-height:280px}}@media (max-width:900px){.site-header{position:static}.site-nav{align-items:stretch}.nav-menu{width:100%;margin-left:0}.nav-toggle{display:inline-flex}.nav-links{display:none;padding-top:12px;justify-content:flex-start;flex-direction:column}.nav-menu[open] .nav-links{display:flex}}@media (max-width:720px){.site-shell{width:min(calc(100vw - 18px),var(--max-width));padding-top:12px}.hero-stage,.section-frame,.glass-card,.page-link-card,.gallery-tile,.video-card,.social-card,.contact-card,.quote-card,.timeline-card,.faq-item,.social-frame,.map-panel,.footer-shell{border-radius:24px}.hero-stage,.section-frame,.footer-shell,.glass-card,.page-link-card,.video-card,.social-card,.contact-card,.quote-card,.timeline-card,.faq-item{padding:20px}.hero-stage{gap:18px}.metric-strip,.card-grid,.program-grid,.video-grid,.social-grid,.contact-grid,.quote-grid,.page-link-grid,.detail-grid,.timeline-grid,.staff-grid{grid-template-columns:1fr}.button-row,.chip-row,.footer-bottom{flex-direction:column;align-items:stretch}.button,.social-pill,.contact-link{width:100%}}`;
}

function renderHomePage(business, website) {
  const content = [
    renderOverviewSection(website, business),
    renderPagePreviewSection(),
    renderProgramsSection(website, business, ["Featured programs", "Academic design", "Programs presented with more intent", "Use the institute’s program list, facilities, and profile details to make the academic story feel deliberate instead of generic."]),
    renderGallerySection(website, business, ["Campus frames", "Visual story", "A more immersive campus story", "Layered imagery, warm accents, and stronger hierarchy give the institute a more premium public presence."]),
    renderCalloutSection(website, business, ["Start the conversation", "Admissions next step", website.cta_title || "Connect with the admissions desk", website.cta_body || "Guide the visitor to a phone call, enquiry form, or official institute website without making them search for the next step."]),
  ].join("");
  return renderPageFrame(business, website, "index", "Welcome", "Institute profile", website.hero_title || business.name, website.hero_summary || business.description || `${business.name} presents its programs, culture, and campus life with clearer structure and stronger visual rhythm.`, uniqueStrings([business.type, business.affiliation, business.location_label]).slice(0, 3), buildHeroMetrics(website, business), "A confident first impression", "Richer section rhythm, cinematic imagery, and clearer storytelling help the institute feel more established online.", pickPrimaryImage(website, business), content);
}

function renderAcademicsPage(business, website) {
  const content = [
    renderProgramsSection(website, business, ["Programs", "Academic pathways", "Programs built for confident decisions", website.about_body || "Present each learning track with clearer hierarchy, sharper copy blocks, and a stronger sense of academic identity."]),
    renderFacilitiesSection(website, business),
    renderAdmissionsStepsSection(website, business),
    renderCalloutSection(website, business, ["Admissions", "Move from interest to action", website.admissions_title || "Admissions and enrollment", website.admissions_body || "Use this page to explain forms, deadlines, interview steps, scholarship support, or any required verification before seat confirmation."]),
  ].join("");
  return renderPageFrame(business, website, "academics", "Academic Focus", "Programs and support", "Programs built for confident decisions", website.about_body || `${business.name} can explain its programs, facilities, and academic structure with more authority.`, uniqueStrings([`${buildProgramCards(website, business).length} program highlights`, business.type, business.location_label]), buildHeroMetrics(website, business), "Academic positioning", "This page gives programs, facilities, and admissions detail a clearer and more persuasive presentation.", pickGalleryImage(website, business, 1), content);
}

function renderPeoplePage(business, website) {
  const content = [
    renderLeadershipSection(website, business),
    renderStaffSection(website, business),
    renderTestimonialsSection(website, business, ["Community voice", "Reputation and trust", "Voices that reinforce the institute promise", "When testimonials are present they are surfaced as designed quote cards; when they are not, the principal note carries the human layer."]),
    renderCalloutSection(website, business, ["Culture", "People and direction", "Leadership should feel visible, not buried", website.principal_message || "Use staff profiles, testimonials, and a stronger leadership note to make the institute’s people page more complete and persuasive."]),
  ].join("");
  return renderPageFrame(business, website, "people", "People & Culture", "Leadership and mentoring", "Leadership, mentors, and learner support", website.principal_message || `${business.name} can present the people behind the institute with more weight and less friction.`, uniqueStrings([website.principal_role || "Academic leadership", `${normalizeCollection(website.staff).length || 0} staff profiles`, business.affiliation]), buildHeroMetrics(website, business), "Human-centered presentation", "This page gives leadership voice, staff detail, and community proof a more intentional place in the institute story.", pickGalleryImage(website, business, 2), content);
}

function renderMediaPage(business, website) {
  const content = [
    renderGallerySection(website, business, ["Gallery", "Campus imagery", "Campus, labs, classrooms, and student life", "Gallery links and direct images are now rendered as a designed media wall instead of a plain list of assets."]),
    renderVideoSection(website, business),
    renderSocialShowcaseSection(website, business, ["Social presence", "Public channels", "Keep the official channels within reach", "Facebook, YouTube, and other public platforms help the institute feel active between formal updates."]),
  ].join("");
  return renderPageFrame(business, website, "media", "Visual Story", "Gallery and video", "Media that gives the institute atmosphere", website.hero_summary || `${business.name} can use the site to show campus visuals, culture, and video stories with much stronger presentation.`, uniqueStrings([`${buildGalleryItems(website, business).length} gallery assets`, `${normalizeCollection(website.videos).length} videos`, business.location_label]), buildHeroMetrics(website, business), "Sharper visual hierarchy", "The media pages bring imagery, film, and campus life into a more cinematic and memorable layout.", pickGalleryImage(website, business, 0), content);
}

function renderUpdatesPage(business, website) {
  const content = [
    renderUpdatesStorySection(website, business),
    renderTestimonialsSection(website, business, ["Reputation", "Community trust", "Current signals from the institute community", "Narrative cards, testimonials, and public channels can work together to show a more active and credible institute profile."]),
    renderSocialShowcaseSection(website, business, ["Channels", "Stay connected", "Social platforms and visual updates", "Use the official channels to keep the institute visible between formal academic or admissions announcements."]),
  ].join("");
  return renderPageFrame(business, website, "updates", "Signals & Updates", "What the institute is showing now", "Updates that feel like part of the brand", website.about_body || `${business.name} can turn structured notes, social presence, and testimonials into a page that feels more alive.`, uniqueStrings([business.affiliation, business.type, website.contact.website]), buildHeroMetrics(website, business), "More than a static profile", "This page gives social proof, focus stories, and public updates a proper place in the institute presence.", pickGalleryImage(website, business, 3), content);
}

function renderAdmissionsPage(business, website) {
  const content = [
    renderAdmissionsNarrativeSection(website, business),
    renderAdmissionsStepsSection(website, business),
    renderFaqSection(website, business),
    renderCalloutSection(website, business, ["Reach out", "Admissions contact", "Make the next action obvious", website.cta_body || "Use the primary contact action, phone, or official website link so interested families can move immediately instead of searching around the page."]),
  ].join("");
  return renderPageFrame(business, website, "admissions", "Admissions Flow", "Enrollment and next steps", website.admissions_title || "Admissions that remove friction", website.admissions_body || `${business.name} can explain admissions, contact points, and documentation in a page designed to move the visitor forward.`, uniqueStrings([website.contact.phone, website.contact.email, business.location_label]), buildHeroMetrics(website, business), "Enrollment clarity", "This page is meant to feel practical, readable, and immediate, not like a generic template section.", pickPrimaryImage(website, business), content);
}

function renderContactPage(business, website) {
  const content = [renderContactSection(website, business), renderMapSection(website, business), renderSocialShowcaseSection(website, business, ["Official links", "Public channels", "Contact, map, and official platforms together", "The contact page now behaves like the clean final stop in the funnel, keeping all high-intent links in one place."])].join("");
  return renderPageFrame(business, website, "contact", "Direct Contact", "Reach the institute", "Clear contact paths for families and learners", website.cta_body || `${business.name} can present location, phone, email, website, and map links in a more intentional page layout.`, uniqueStrings([website.contact.phone, website.contact.email, website.contact.website]), buildHeroMetrics(website, business), "Designed as the final conversion step", "Contact details, map access, and official URLs are placed where the visitor expects them, with fewer dead ends.", pickPrimaryImage(website, business), content);
}

function renderPageFrame(business, website, currentPage, scriptText, eyebrow, title, lead, meta, stats, mediaTitle, mediaCopy, imageUrl, content) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeHtml(title)} | ${escapeHtml(website.site_title || business.name)}</title><meta name="description" content="${escapeHtml(lead || website.hero_summary || business.description || business.name)}"><link rel="stylesheet" href="./styles.css"></head><body><div class="site-shell">${renderSiteHeader(website, business, currentPage)}<section class="hero-stage"><div class="hero-copy" data-reveal="left"><span class="script-mark">${escapeHtml(scriptText || "Institute profile")}</span><span class="section-label">${escapeHtml(eyebrow || "Institute profile")}</span><h1>${escapeHtml(title)}</h1><p class="hero-lead">${escapeHtml(lead || website.hero_summary || business.description || "")}</p><div class="button-row">${renderActionButton(resolvePrimaryAction(website), "primary")}${renderInternalButton(currentPage === "contact" ? "./admissions.html" : "./contact.html", currentPage === "contact" ? "Open admissions" : "Contact institute", "secondary")}${website.secondary_cta_url ? renderActionButton({ href: website.secondary_cta_url, label: website.secondary_cta_label || "Official website" }, "ghost") : ""}</div>${renderHeroMeta(meta)}${renderMetricStrip(stats)}</div>${renderHeroMedia(website, business, imageUrl, mediaTitle, mediaCopy)}</section><main class="page-main">${content}${renderFooter(website, business)}</main></div><script src="./site.js" defer></script></body></html>`;
}

function renderSiteHeader(website, business, currentPage) {
  return `<header class="site-header"><nav class="site-nav"><a class="brand" href="./index.html">${renderBrandMark(website, business)}<div class="brand-copy"><strong>${escapeHtml(website.site_title || business.name)}</strong><span>${escapeHtml(uniqueStrings([business.type, business.location_label]).join(" · "))}</span></div></a><details class="nav-menu"><summary class="nav-toggle" aria-label="Toggle navigation"><span></span></summary><div class="nav-links">${WEBSITE_PAGES.map((page) => `<a class="${page.slug === currentPage ? "active" : ""}" href="./${page.file}">${escapeHtml(page.label)}</a>`).join("")}</div></details></nav></header>`;
}

function renderHeroMedia(website, business, imageUrl, mediaTitle, mediaCopy) {
  const media = imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(website.site_title || business.name)} hero image">` : `<div class="media-fallback">${escapeHtml(initialsOf(website.site_title || business.name))}</div>`;
  return `<div class="hero-media" data-reveal="right">${media}<div class="hero-note"><strong>${escapeHtml(mediaTitle || "Campus highlights")}</strong><p>${escapeHtml(mediaCopy || "A stronger visual language helps the institute present its story with more clarity and confidence.")}</p></div></div>`;
}

function renderOverviewSection(website, business) {
  return `<section class="section-frame section-split">${renderSectionHeading("Overview", "Institute profile", website.about_title || `About ${business.name}`, website.about_body || business.description || `${business.name} can use this section to articulate identity, positioning, and campus promise.`, "left", "left")}<div class="card-stack" data-reveal="right">${renderLeadershipCard(website, business)}<div class="card-grid">${buildOverviewCards(website, business).map(renderInfoCard).join("")}</div></div></section>`;
}

function renderPagePreviewSection() {
  const cards = WEBSITE_PAGES.filter((page) => page.slug !== "index").map((page) => ({ href: `./${page.file}`, eyebrow: PAGE_TEASERS[page.slug][0], title: PAGE_TEASERS[page.slug][1], copy: PAGE_TEASERS[page.slug][2] }));
  return `<section class="section-frame">${renderSectionHeading("Explore pages", "Site navigation", "Explore the full institute profile", "Each page carries the same visual language while focusing on a different part of the institute story.", "center", "up")}<div class="page-link-grid">${cards.map((card, index) => `<a class="page-link-card" href="${card.href}" data-reveal="up" style="transition-delay:${80 + index * 60}ms;"><span class="inline-label">${escapeHtml(card.eyebrow)}</span><h3>${escapeHtml(card.title)}</h3><p>${escapeHtml(card.copy)}</p></a>`).join("")}</div></section>`;
}

function renderProgramsSection(website, business, options) {
  return `<section class="section-frame">${renderSectionHeading(options[0], options[1], options[2], options[3], "center", "up")}<div class="program-grid">${buildProgramCards(website, business).map((item, index) => renderProgramCard(item, index)).join("")}</div></section>`;
}

function renderFacilitiesSection(website, business) {
  return `<section class="section-frame section-split">${renderSectionHeading("Facilities", "Learning support", "Spaces, support, and campus resources", "Labs, libraries, hostels, workshops, and student services are rendered as support cards instead of being buried in a single line.", "left", "left")}<div class="card-grid" data-reveal="right">${buildFacilityCards(website, business).map(renderInfoCard).join("")}</div></section>`;
}

function renderLeadershipSection(website, business) {
  return `<section class="section-frame section-split">${renderSectionHeading("Leadership", "Direction and culture", "The institute voice becomes part of the design", website.principal_message || "Use the principal note and supporting cards to describe values, culture, and academic direction without resorting to generic filler.", "left", "left")}<div class="card-stack" data-reveal="right">${renderLeadershipCard(website, business)}<div class="card-grid">${buildCultureCards(website, business).map(renderInfoCard).join("")}</div></div></section>`;
}

function renderStaffSection(website, business) {
  const staff = normalizeCollection(website.staff);
  if (!staff.length) {
    return `<section class="section-frame">${renderSectionHeading("Staff", "Faculty and team", "Add staff profiles to unlock this section", "Names, roles, images, and short bios turn this page into a much stronger introduction to the institute team.", "center", "up")}<div class="glass-card" data-reveal="up"><h3>${escapeHtml(website.principal_name || business.name)}</h3><div class="card-meta">${escapeHtml(website.principal_role || business.type || "Institute leadership")}</div><p class="card-copy">${escapeHtml(website.principal_message || "No staff profiles have been added yet. The leadership message is used as the fallback until the institute team is available.")}</p></div></section>`;
  }
  return `<section class="section-frame">${renderSectionHeading("Staff", "Faculty and mentors", "Profiles for the people behind the institute", "Staff entries are rendered as cards with image support, role labels, and bios, making the people page feel far less generic.", "center", "up")}<div class="staff-grid">${staff.map((person, index) => renderStaffCard(person, index)).join("")}</div></section>`;
}

function renderTestimonialsSection(website, business, options) {
  return `<section class="section-frame">${renderSectionHeading(options[0], options[1], options[2], options[3], "center", "up")}<div class="quote-grid">${buildTestimonials(website, business).map((quote, index) => renderQuoteCard(quote, index)).join("")}</div></section>`;
}

function renderGallerySection(website, business, options) {
  return `<section class="section-frame">${renderSectionHeading(options[0], options[1], options[2], options[3], "center", "up")}${renderGalleryGrid(buildGalleryItems(website, business))}</section>`;
}

function renderVideoSection(website, business) {
  const videos = normalizeCollection(website.videos);
  return `<section class="section-frame">${renderSectionHeading("Video", "Campus watchlist", "Video embeds and direct links", videos.length ? "YouTube, Vimeo, and direct video files are rendered as playable cards inside the page." : `No videos are available yet for ${business.name}. Add video links to turn this into a playable media block.`, "center", "up")}${renderVideoGrid(videos)}</section>`;
}

function renderUpdatesStorySection(website, business) {
  return `<section class="section-frame">${renderSectionHeading("Focus stories", "Current narrative", "Structured stories that enrich the institute profile", "Extra sections, admissions notes, and institute details can all feed a richer updates page without needing a separate content workflow.", "center", "up")}<div class="card-grid">${buildUpdateStoryCards(website, business).map(renderInfoCard).join("")}</div></section>`;
}

function renderAdmissionsNarrativeSection(website, business) {
  return `<section class="section-frame section-split">${renderSectionHeading("Admissions", "Enrollment brief", website.admissions_title || "Admissions and enrollment", website.admissions_body || `Use this section to explain how applicants move from inquiry to confirmed enrollment at ${business.name}.`, "left", "left")}<div class="card-grid" data-reveal="right">${buildAdmissionsSupportCards(website, business).map(renderInfoCard).join("")}</div></section>`;
}

function renderAdmissionsStepsSection(website, business) {
  const steps = buildAdmissionsSteps(website, business);
  return `<section class="section-frame">${renderSectionHeading("Process", "Step by step", "Admissions steps that scan quickly", "If FAQs are present they power the timeline. If not, the page falls back to a sensible admissions sequence.", "center", "up")}<div class="timeline-grid">${steps.map((step, index) => `<article class="timeline-card" data-reveal="up" style="transition-delay:${80 + index * 70}ms;"><span class="timeline-step">${index + 1}</span><h3>${escapeHtml(step.title)}</h3><p>${escapeHtml(step.body)}</p></article>`).join("")}</div></section>`;
}

function renderFaqSection(website, business) {
  return `<section class="section-frame">${renderSectionHeading("FAQ", "Common questions", "Questions prospective families usually ask", "When specific FAQs are available they appear here. Otherwise the page falls back to practical enrollment questions.", "center", "up")}<div class="faq-list">${buildFaqItems(website, business).map((item, index) => `<details class="faq-item" data-reveal="up" style="transition-delay:${80 + index * 60}ms;"><summary>${escapeHtml(item.question)}</summary><p>${escapeHtml(item.answer)}</p></details>`).join("")}</div></section>`;
}

function renderContactSection(website, business) {
  return `<section class="section-frame">${renderSectionHeading("Contact", "Reach the institute", "Every primary contact path in one section", "Address, phone, email, website, and supporting notes are presented as conversion-friendly cards.", "center", "up")}<div class="contact-grid">${buildContactCards(website, business).map(renderContactCard).join("")}</div></section>`;
}

function renderMapSection(website, business) {
  const mapMarkup = renderMapPanel(website.contact.map_url, { address: website.contact.address, location: business.location_label });
  return mapMarkup ? `<section class="section-frame">${renderSectionHeading("Map", "Find the campus", "Location and route context", "If a map URL is available, this page shows either an embedded map or a direct open-map fallback.", "center", "up")}${mapMarkup}</section>` : "";
}

function renderSocialShowcaseSection(website, business, options) {
  return `<section class="section-frame section-split">${renderSectionHeading(options[0], options[1], options[2], options[3], "left", "left")}<div class="support-stack" data-reveal="right">${website.social.facebook ? renderFacebookTimeline(website.social.facebook) : ""}${renderSocialGrid(buildSocialEntries(website.social))}</div></section>`;
}

function renderCalloutSection(website, business, options) {
  return `<section class="section-frame section-split">${renderSectionHeading(options[0], options[1], options[2], options[3], "left", "left")}<div class="glass-card" data-reveal="right"><h3>${escapeHtml(options[2])}</h3><div class="card-meta">${escapeHtml(uniqueStrings([business.type, business.location_label]).join(" · "))}</div><p class="card-copy">${escapeHtml(options[3])}</p><div class="button-row">${renderActionButton(resolvePrimaryAction(website), "primary")}${website.contact.website ? renderActionButton({ href: website.contact.website, label: "Official website" }, "secondary") : ""}${website.contact.email ? renderActionButton({ href: `mailto:${website.contact.email}`, label: "Send email" }, "ghost") : ""}</div></div></section>`;
}

function renderSectionHeading(script, eyebrow, title, copy, align = "left", reveal = "up") {
  return `<div class="section-heading ${align === "center" ? "center" : ""}" data-reveal="${escapeHtml(reveal)}"><span class="script-mark">${escapeHtml(script || "Institute profile")}</span><span class="section-label">${escapeHtml(eyebrow || "Section")}</span><h2>${escapeHtml(title || "Untitled section")}</h2>${copy ? `<p>${escapeHtml(copy)}</p>` : ""}</div>`;
}

function renderMetricStrip(items) {
  const metrics = normalizeCollection(items);
  return metrics.length ? `<div class="metric-strip">${metrics.map((item) => `<article class="metric-card"><strong>${escapeHtml(item.value)}</strong><span>${escapeHtml(item.label)}</span></article>`).join("")}</div>` : "";
}

function renderHeroMeta(items) {
  const chips = uniqueStrings(items).slice(0, 4);
  return chips.length ? `<div class="chip-row">${chips.map((item) => `<span class="hero-chip">${escapeHtml(item)}</span>`).join("")}</div>` : "";
}

function renderBrandMark(website, business) {
  return website.logo_url ? `<img class="brand-mark" src="${escapeHtml(website.logo_url)}" alt="${escapeHtml(website.site_title || business.name)} logo">` : `<div class="brand-mark-fallback">${escapeHtml(initialsOf(website.site_title || business.name))}</div>`;
}

function renderLeadershipCard(website, business) {
  const name = website.principal_name || "Institute leadership";
  const role = website.principal_role || business.type || "Academic direction";
  const copy = website.principal_message || website.about_body || business.description || "Add a leadership note to turn this panel into the institute’s most human and persuasive block.";
  return `<article class="glass-card"><span class="inline-label">Leadership note</span><h3>${escapeHtml(name)}</h3><div class="card-meta">${escapeHtml(role)}</div><p class="card-copy">${escapeHtml(copy)}</p></article>`;
}

function renderInfoCard(item) {
  return `<article class="glass-card"><span class="inline-label">${escapeHtml(item.eyebrow || "Detail")}</span><h3>${escapeHtml(item.title || "Untitled")}</h3>${item.meta ? `<div class="card-meta">${escapeHtml(item.meta)}</div>` : ""}<p class="card-copy">${escapeHtml(item.copy || "")}</p>${normalizeCollection(item.details).length ? `<ul class="detail-list">${item.details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join("")}</ul>` : ""}</article>`;
}

function renderProgramCard(item, index) {
  return `<article class="glass-card program-card" data-reveal="up" style="transition-delay:${80 + index * 70}ms;"><span class="program-index">Track ${String(index + 1).padStart(2, "0")}</span><h3>${escapeHtml(item.title)}</h3><div class="card-meta">${escapeHtml(item.meta)}</div><p class="card-copy">${escapeHtml(item.copy)}</p>${item.details.length ? `<ul class="detail-list">${item.details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join("")}</ul>` : ""}</article>`;
}

function renderGalleryGrid(items) {
  const gallery = normalizeCollection(items);
  if (!gallery.length) {
    return `<div class="glass-card" data-reveal="up"><h3>No gallery items yet</h3><p class="card-copy">Add image URLs to turn this section into a proper campus gallery.</p></div>`;
  }
  return `<div class="gallery-grid">${gallery.slice(0, 5).map((item, index) => renderGalleryTile(item, index)).join("")}</div>`;
}

function renderGalleryTile(item, index) {
  const featured = index === 0 && item.kind === "image" ? " featured" : "";
  if (item.kind === "image") {
    return `<article class="gallery-tile${featured}" data-reveal="up" style="transition-delay:${80 + index * 70}ms;"><img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.title)}"></article>`;
  }
  return `<article class="gallery-tile${featured}" data-reveal="up" style="transition-delay:${80 + index * 70}ms;"><div class="tile-fallback"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.copy)}</span><div class="button-row">${renderActionButton({ href: item.url, label: "Open media link" }, "secondary")}</div></div></article>`;
}

function renderVideoGrid(items) {
  const videos = normalizeCollection(items);
  return videos.length ? `<div class="video-grid">${videos.map((item, index) => renderVideoCard(item, index)).join("")}</div>` : `<div class="glass-card" data-reveal="up"><h3>No videos added yet</h3><p class="card-copy">Add YouTube, Vimeo, or direct video URLs to populate this section.</p></div>`;
}

function renderVideoCard(item, index) {
  const title = item.title || "Institute video";
  const url = item.url || "";
  const embedUrl = toEmbedVideoUrl(url);
  const media = embedUrl ? `<iframe src="${escapeHtml(embedUrl)}" title="${escapeHtml(title)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>` : isDirectVideoUrl(url) ? `<video controls preload="metadata" src="${escapeHtml(url)}"></video>` : renderActionButton({ href: url, label: "Open video" }, "secondary");
  return `<article class="video-card" data-reveal="up" style="transition-delay:${80 + index * 70}ms;"><span class="inline-label">Video</span><h3>${escapeHtml(title)}</h3><div class="card-copy">${escapeHtml(url)}</div>${media}</article>`;
}

function renderStaffCard(person, index) {
  const photo = person.image ? `<img class="staff-photo" src="${escapeHtml(person.image)}" alt="${escapeHtml(person.name || person.role || "Staff member")}">` : `<div class="staff-photo-fallback">${escapeHtml(initialsOf(person.name || person.role || "Staff"))}</div>`;
  return `<article class="glass-card staff-card" data-reveal="up" style="transition-delay:${80 + index * 70}ms;">${photo}<div><h3>${escapeHtml(person.name || "Staff member")}</h3><span class="staff-role">${escapeHtml(person.role || "Team member")}</span></div><p class="card-copy">${escapeHtml(person.bio || "Add a short bio to make this profile more useful.")}</p></article>`;
}

function renderQuoteCard(item, index) {
  return `<article class="quote-card" data-reveal="up" style="transition-delay:${80 + index * 70}ms;"><span class="inline-label">${escapeHtml(item.eyebrow || "Community voice")}</span><strong>${escapeHtml(item.name)}</strong><div class="card-meta">${escapeHtml(item.role)}</div><p>${escapeHtml(item.quote)}</p></article>`;
}

function renderContactCard(item) {
  return `<article class="contact-card" data-reveal="up"><span class="inline-label">${escapeHtml(item.eyebrow)}</span><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.copy)}</p>${item.link ? renderActionButton(item.link, "secondary") : ""}</article>`;
}

function renderSocialGrid(entries) {
  const items = normalizeCollection(entries);
  return items.length ? `<div class="social-grid">${items.map((item, index) => `<article class="social-card" data-reveal="up" style="transition-delay:${80 + index * 70}ms;"><span class="inline-label">${escapeHtml(item.label)}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.copy)}</p>${renderActionButton({ href: item.url, label: "Open channel" }, "secondary")}</article>`).join("")}</div>` : `<div class="glass-card"><h3>No public social links yet</h3><p class="card-copy">Add official Facebook, Instagram, YouTube, or X links to populate this block.</p></div>`;
}

function renderFooter(website, business) {
  const description = website.about_body || website.hero_summary || business.description || `${business.name} public profile.`;
  const socials = buildSocialEntries(website.social);
  return `<footer class="footer-shell"><div class="footer-grid"><div><div class="brand">${renderBrandMark(website, business)}<div class="footer-brand-copy"><strong>${escapeHtml(website.site_title || business.name)}</strong><span>${escapeHtml(uniqueStrings([business.type, business.location_label]).join(" · "))}</span></div></div><p class="footer-text">${escapeHtml(description)}</p><div class="footer-socials">${socials.map((item) => renderActionButton({ href: item.url, label: item.label }, "ghost")).join("")}</div></div><div><span class="inline-label">Navigate</span><div class="footer-links">${WEBSITE_PAGES.map((page) => `<a href="./${page.file}">${escapeHtml(page.label)}</a>`).join("")}</div></div><div><span class="inline-label">Contact</span><div class="footer-links">${website.contact.phone ? `<a href="tel:${escapeHtml(website.contact.phone)}">${escapeHtml(website.contact.phone)}</a>` : ""}${website.contact.email ? `<a href="mailto:${escapeHtml(website.contact.email)}">${escapeHtml(website.contact.email)}</a>` : ""}${website.contact.website ? `<a href="${escapeHtml(website.contact.website)}" target="_blank" rel="noreferrer">${escapeHtml(website.contact.website)}</a>` : ""}${website.contact.address ? `<span class="tiny-copy">${escapeHtml(website.contact.address)}</span>` : ""}</div></div></div><div class="footer-bottom"><span class="tiny-copy">${escapeHtml(website.site_title || business.name)}</span><span class="tiny-copy">${escapeHtml(uniqueStrings([business.affiliation, business.location_label]).join(" · ") || "Institute profile")}</span></div></footer>`;
}

function renderActionButton(action, variant) {
  if (!action?.href) return "";
  const href = String(action.href).trim();
  const target = href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("./") ? "_self" : "_blank";
  return `<a class="button ${escapeHtml(variant || "secondary")}" href="${escapeHtml(href)}" target="${target}" rel="noreferrer">${escapeHtml(action.label || "Open")}</a>`;
}

function renderInternalButton(href, label, variant) {
  return href ? `<a class="button ${escapeHtml(variant || "secondary")}" href="${escapeHtml(href)}">${escapeHtml(label || "Open")}</a>` : "";
}

function renderFacebookTimeline(url) {
  const pluginUrl = `https://www.facebook.com/plugins/page.php?href=${encodeURIComponent(url)}&tabs=timeline&width=480&height=520&small_header=true&adapt_container_width=true&hide_cover=true&show_facepile=false`;
  return `<article class="social-frame"><span class="inline-label">Facebook timeline</span><h3>Live page feed</h3><p class="card-copy">${escapeHtml(url)}</p><iframe src="${pluginUrl}" loading="lazy" title="Facebook timeline"></iframe></article>`;
}

function renderMapPanel(url, details = {}) {
  const locationText = [details.address, details.location].filter(Boolean).join(" · ");
  const mapLinks = resolveMapUrls(url);
  if (!mapLinks.openUrl && !locationText) return "";
  const media = mapLinks.embedUrl ? `<iframe src="${escapeHtml(mapLinks.embedUrl)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Institute map"></iframe>` : `<div class="map-fallback"><strong>Interactive preview unavailable</strong><span class="supporting-copy">Use the direct map button below to open the institute location in a new tab.</span></div>`;
  return `<article class="map-panel" data-reveal="up"><div class="card-stack"><div><span class="inline-label">Campus location</span><h3>${escapeHtml(locationText || "Open map")}</h3>${mapLinks.openUrl ? renderActionButton({ href: mapLinks.openUrl, label: "Open map" }, "secondary") : ""}</div>${media}</div></article>`;
}

function renderEnhancementScript() {
  return `<script>document.addEventListener("DOMContentLoaded",function(){var items=[].slice.call(document.querySelectorAll("[data-reveal]"));if(!items.length)return;function showAll(){items.forEach(function(item){item.classList.add("visible")})}if(!("IntersectionObserver" in window)){showAll();return}var observer=new IntersectionObserver(function(entries){entries.forEach(function(entry){if(!entry.isIntersecting)return;entry.target.classList.add("visible");observer.unobserve(entry.target)})},{threshold:.16,rootMargin:"0px 0px -8% 0px"});items.forEach(function(item){observer.observe(item)})});</script>`;
}

function resolvePrimaryAction(website) {
  if (website.primary_cta_url) return { href: website.primary_cta_url, label: website.primary_cta_label || "Contact institute" };
  if (website.contact.phone) return { href: `tel:${website.contact.phone}`, label: "Call admissions" };
  if (website.contact.email) return { href: `mailto:${website.contact.email}`, label: "Send enquiry" };
  return { href: "./contact.html", label: "Open contact page" };
}

function buildHeroMetrics(website, business) {
  const metrics = normalizeCollection(website.achievements).map((item) => ({ value: String(item?.value || "").trim(), label: String(item?.label || "").trim() })).filter((item) => item.value && item.label);
  if (metrics.length) return metrics.slice(0, 4);
  const fallback = [];
  const programCount = normalizeCollection(website.programs).length || normalizeCollection(business.programs).length;
  const facilityCount = normalizeCollection(website.facilities).length || normalizeCollection(business.facilities).length;
  if (programCount) fallback.push({ value: String(programCount), label: "Programs" });
  if (facilityCount) fallback.push({ value: String(facilityCount), label: "Facilities" });
  if (normalizeCollection(business.level).length) fallback.push({ value: String(normalizeCollection(business.level).length), label: "Learning levels" });
  if (business.affiliation) fallback.push({ value: business.affiliation, label: "Affiliation" });
  return fallback.slice(0, 4);
}

function buildOverviewCards(website, business) {
  return [
    { eyebrow: "Location", title: business.location_label || "Campus location", copy: website.contact.address || "Add an address to complete the location card.", details: [] },
    { eyebrow: "Academic identity", title: business.affiliation || business.type || "Institute profile", copy: uniqueStrings([].concat(normalizeCollection(business.level), normalizeCollection(business.field))).slice(0, 4).join(", ") || "Add levels or focus fields in the institute record to enrich this block.", details: [] },
    { eyebrow: "Reach out", title: website.contact.phone || website.contact.email || "Contact channels", copy: website.contact.website || "Use the contact page to highlight the institute phone, email, website, and map.", details: [] },
  ];
}

function buildProgramCards(website, business) {
  const programs = uniqueStrings([].concat(normalizeCollection(website.programs), normalizeCollection(business.programs), normalizeCollection(business.field)));
  const facilities = uniqueStrings([].concat(normalizeCollection(website.facilities), normalizeCollection(business.facilities)));
  const levels = uniqueStrings(normalizeCollection(business.level));
  if (!programs.length) {
    return [{ title: business.type || "Academic pathway", meta: uniqueStrings([business.affiliation, business.location_label]).join(" · ") || "Program highlight", copy: `Add programs to populate this showcase for ${business.name}.`, details: facilities.slice(0, 3) }];
  }
  return programs.slice(0, 6).map((program, index) => ({ title: program, meta: uniqueStrings([levels[index % Math.max(levels.length, 1)] || business.type, business.affiliation]).join(" · ") || "Institute track", copy: buildProgramCopy(program, business, facilities[index % Math.max(facilities.length, 1)] || ""), details: uniqueStrings([facilities[index], facilities[index + 1], business.location_label]).filter(Boolean).slice(0, 3) }));
}

function buildProgramCopy(program, business, facility) {
  return [`${program} is presented as part of ${business.name}.`, facility ? `${facility} reinforces the learning environment for this track.` : "", business.affiliation ? `${business.affiliation} gives the academic profile additional context.` : ""].filter(Boolean).join(" ");
}

function buildFacilityCards(website, business) {
  const facilities = uniqueStrings([].concat(normalizeCollection(website.facilities), normalizeCollection(business.facilities)));
  if (!facilities.length) return [{ eyebrow: "Campus support", title: "Facilities not added yet", copy: `Add facilities to describe the labs, support spaces, and student services at ${business.name}.` }];
  return facilities.slice(0, 6).map((facility, index) => ({ eyebrow: `Facility ${String(index + 1).padStart(2, "0")}`, title: facility, copy: `${facility} is rendered as a dedicated support card to make the learning environment easier to scan.`, details: uniqueStrings([business.type, business.location_label]).slice(0, 2) }));
}

function buildCultureCards(website, business) {
  return [
    { eyebrow: "Affiliation", title: business.affiliation || "Institutional identity", copy: business.affiliation ? `${business.name} is positioned with ${business.affiliation} as part of its public academic identity.` : "Add affiliation details in the institute profile to make this card more specific." },
    { eyebrow: "Levels", title: uniqueStrings(normalizeCollection(business.level)).join(", ") || "Learning levels", copy: uniqueStrings(normalizeCollection(business.level)).length ? `The institute covers ${uniqueStrings(normalizeCollection(business.level)).join(", ")} within its academic profile.` : "Add learning levels to surface them as part of the people and culture story." },
    { eyebrow: "Message", title: website.cta_title || "Student-facing promise", copy: website.cta_body || "Use the CTA body to define how the institute invites families into the admissions conversation." },
  ];
}

function buildTestimonials(website, business) {
  const testimonials = normalizeCollection(website.testimonials).map((item) => ({ eyebrow: "Testimonial", name: item.name || "Community member", role: item.role || business.type || "Institute community", quote: item.quote || "" })).filter((item) => item.quote);
  if (testimonials.length) return testimonials.slice(0, 4);
  return [{ eyebrow: "Leadership voice", name: website.principal_name || business.name, role: website.principal_role || business.type || "Institute leadership", quote: website.principal_message || website.about_body || `Add testimonials or a stronger principal note to make this section more personal for ${business.name}.` }];
}

function buildGalleryItems(website, business) {
  return uniqueStrings([pickPrimaryImage(website, business)].concat(normalizeCollection(website.gallery))).slice(0, 5).map((url, index) => looksLikeImage(url) ? { kind: "image", url, title: `Campus visual ${index + 1}` } : { kind: "link", url, title: `Media link ${index + 1}`, copy: "This gallery entry is a non-image link. The page keeps it visible as a styled media card." });
}

function buildUpdateStoryCards(website, business) {
  const sections = normalizeCollection(website.extra_sections).map((item) => ({ eyebrow: "Story", title: item.title || "Institute story", copy: item.body || "", details: [] })).filter((item) => item.title || item.copy);
  if (sections.length) return sections.slice(0, 4);
  return [
    { eyebrow: "Admissions", title: website.admissions_title || "Enrollment brief", copy: website.admissions_body || `Use this section to explain how learners move into ${business.name}.` },
    { eyebrow: "Academic focus", title: business.type || "Institute profile", copy: business.affiliation ? `${business.name} is currently framed through ${business.affiliation} and its public academic direction.` : `${business.name} can use this section for current academic focus or institutional priorities.` },
    { eyebrow: "Public presence", title: website.contact.website || "Official website", copy: website.contact.website ? "The official institute website can be kept within reach as part of the updates and public-links story." : "Add the official website URL to make this block more useful." },
  ];
}

function buildAdmissionsSupportCards(website, business) {
  return [
    { eyebrow: "Primary action", title: website.primary_cta_label || "Contact admissions", copy: website.cta_body || "Use the primary CTA for the cleanest conversion path." },
    { eyebrow: "Contact", title: website.contact.email || website.contact.phone || "Admissions contact", copy: website.contact.address || "Add address and contact detail for a fuller admissions brief." },
    { eyebrow: "Programs", title: `${buildProgramCards(website, business).length} highlighted tracks`, copy: "The admissions page can echo the strongest academic offerings while keeping the focus on next steps." },
  ];
}

function buildAdmissionsSteps(website, business) {
  const faqs = normalizeCollection(website.faqs);
  if (faqs.length) return faqs.slice(0, 4).map((item) => ({ title: item.question || "Admissions step", body: item.answer || "Add more detail here." }));
  return [
    { title: "Make the first enquiry", body: website.cta_body || `Use the phone, email, or contact page to start a direct conversation with ${business.name}.` },
    { title: "Review program fit", body: normalizeCollection(website.programs).length ? `Match the applicant to ${normalizeCollection(website.programs).slice(0, 3).join(", ")} or other listed tracks.` : "Review the institute’s academic path, support options, and fit for the learner." },
    { title: "Prepare required documents", body: "Keep academic records, identification, and any institute-specific requirements ready before final submission." },
    { title: "Confirm enrollment", body: website.admissions_body || "Complete the institute’s final review, payment, and seat confirmation process." },
  ];
}

function buildFaqItems(website, business) {
  const faqs = normalizeCollection(website.faqs).map((item) => ({ question: item.question || "", answer: item.answer || "" })).filter((item) => item.question && item.answer);
  if (faqs.length) return faqs.slice(0, 6);
  return [
    { question: `How do I contact ${business.name}?`, answer: uniqueStrings([website.contact.phone, website.contact.email, website.contact.website]).join(" · ") || "Add phone, email, or website details." },
    { question: "What programs should families review first?", answer: normalizeCollection(website.programs).slice(0, 4).join(", ") || "Add the main programs to make this answer more specific." },
    { question: "Where is the institute located?", answer: [website.contact.address, business.location_label].filter(Boolean).join(" · ") || "Add address and location labels in the institute record." },
  ];
}

function buildContactCards(website, business) {
  return [
    { eyebrow: "Address", title: website.contact.address || business.location_label || "Institute address", copy: "Use the map section below for route context when a map URL is available.", link: null },
    { eyebrow: "Phone", title: website.contact.phone || "Phone number not added", copy: "Phone remains the highest-intent contact path on most education sites.", link: website.contact.phone ? { href: `tel:${website.contact.phone}`, label: "Call now" } : null },
    { eyebrow: "Email", title: website.contact.email || "Email not added", copy: "Keep admissions, admin, or enquiry email addresses visible on the contact page.", link: website.contact.email ? { href: `mailto:${website.contact.email}`, label: "Send email" } : null },
    { eyebrow: "Website", title: website.contact.website || "Official website not added", copy: "If an official institute website exists, surface it here as a direct public link.", link: website.contact.website ? { href: website.contact.website, label: "Open website" } : null },
  ];
}

function buildSocialEntries(social) {
  const source = social || {};
  return [
    { label: "Facebook", title: "Community updates", copy: "Useful for public notices, photo updates, and institute-led announcements.", url: source.facebook },
    { label: "Instagram", title: "Visual campus moments", copy: "A better fit for student life, events, campus energy, and day-to-day visual storytelling.", url: source.instagram },
    { label: "YouTube", title: "Video storytelling", copy: "Use it for campus tours, principal messages, event recaps, and learning highlights.", url: source.youtube },
    { label: "Twitter / X", title: "Fast public updates", copy: "Helpful for short institutional signals, announcements, and public-facing updates.", url: source.twitter },
  ].filter((item) => item.url);
}

function pickPrimaryImage(website, business) {
  return uniqueStrings([website.cover_url, ...normalizeCollection(website.gallery), business.cover, business.logo])[0] || "";
}

function pickGalleryImage(website, business, index) {
  const gallery = uniqueStrings([pickPrimaryImage(website, business), ...normalizeCollection(website.gallery)]);
  return gallery[index] || gallery[0] || "";
}

function uniqueStrings(values) {
  const seen = new Set();
  return normalizeCollection(values).map((item) => String(item || "").trim()).filter(Boolean).filter((item) => { const key = item.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; });
}

function normalizeCollection(value) {
  return Array.isArray(value) ? value.filter((item) => item !== null && item !== undefined && item !== "") : [];
}

function resolveMapUrls(url) {
  const openUrl = String(url || "").trim();
  if (!openUrl) return { openUrl: "", embedUrl: "" };
  try {
    const parsed = new URL(openUrl);
    const host = String(parsed.hostname || "").toLowerCase();
    const path = String(parsed.pathname || "").toLowerCase();
    if (path.includes("/maps/embed") || parsed.searchParams.get("output") === "embed") return { openUrl, embedUrl: openUrl };
    const query = parsed.searchParams.get("query") || parsed.searchParams.get("q");
    if ((host.includes("google.") || host.includes("maps.google.")) && query) return { openUrl, embedUrl: `https://www.google.com/maps?q=${encodeURIComponent(query)}&z=15&output=embed` };
    if (host.includes("openstreetmap.org") && path.includes("/export/embed.html")) return { openUrl, embedUrl: openUrl };
  } catch {}
  return { openUrl, embedUrl: "" };
}

function looksLikeImage(url) {
  const value = String(url || "").toLowerCase();
  return /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/.test(value) || value.includes("dummyimage.com");
}

module.exports = {
  buildWebsitePages,
  buildWebsiteScript,
  buildWebsiteStyles,
};

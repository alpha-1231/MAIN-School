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
  return `@import url("https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Sora:wght@600;700;800&display=swap");

:root {
  color-scheme: light;
  --seed: ${theme.primary};
  --seed-soft: ${theme.primarySoft};
  --ink: ${theme.ink};
  --muted: ${theme.muted};
  --paper: #f7f2ea;
  --surface: rgba(255, 255, 255, 0.84);
  --surface-strong: rgba(255, 255, 255, 0.94);
  --border: ${theme.border};
  --shadow: 0 24px 80px rgba(15, 23, 42, 0.12);
  --shadow-soft: 0 14px 34px rgba(15, 23, 42, 0.08);
  --radius-hero: 34px;
  --radius-card: 28px;
  --radius-media: 32px;
  --radius-pill: 999px;
  --max: 1240px;
}

* {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  min-height: 100vh;
  color: var(--ink);
  font-family: "Manrope", "Segoe UI", sans-serif;
  background:
    radial-gradient(circle at top left, rgba(255, 255, 255, 0.92), transparent 24rem),
    radial-gradient(circle at top right, rgba(255, 255, 255, 0.5), transparent 18rem),
    linear-gradient(180deg, #f4ede4 0%, #eef4ff 46%, #f6f1e8 100%);
}

body::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(120deg, rgba(255, 255, 255, 0.14), transparent 40%),
    repeating-linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.06),
      rgba(255, 255, 255, 0.06) 1px,
      transparent 1px,
      transparent 132px
    );
  opacity: 0.42;
}

img {
  display: block;
  max-width: 100%;
}

a {
  color: inherit;
}

.site-shell {
  position: relative;
  z-index: 1;
  width: min(calc(100vw - 28px), var(--max));
  margin: 0 auto;
  padding: 22px 0 68px;
}

.site-header {
  position: sticky;
  top: 14px;
  z-index: 20;
  margin-bottom: 22px;
  padding: 14px 18px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.74);
  backdrop-filter: blur(16px);
  box-shadow: var(--shadow-soft);
}

.site-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  min-width: 0;
}

.brand {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
  text-decoration: none;
}

.brand-logo,
.brand-logo-fallback,
.staff-avatar-fallback,
.page-media-fallback {
  display: grid;
  place-items: center;
}

.brand-logo,
.brand-logo-fallback {
  width: 56px;
  height: 56px;
  border-radius: 18px;
  object-fit: cover;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(255, 255, 255, 0.6));
  border: 1px solid rgba(255, 255, 255, 0.88);
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.14);
}

.brand-logo-fallback,
.staff-avatar-fallback,
.page-media-fallback {
  color: var(--seed);
  font-weight: 800;
}

.brand-copy strong,
.hero-copy h1,
.section-head h2,
.page-link-card h3,
.staff-card h3,
.quote-card strong,
.contact-card strong {
  font-family: "Sora", "Segoe UI", sans-serif;
}

.brand-copy strong {
  display: block;
  font-size: 1rem;
  line-height: 1.28;
  overflow-wrap: anywhere;
}

.brand-copy {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.brand-copy span,
.section-copy,
.panel-copy,
.meta-line,
.muted,
.page-link-card p,
.social-link-card p,
.timeline-card p,
.footer {
  color: var(--muted);
  overflow-wrap: anywhere;
}

.nav-links {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

.nav-menu {
  min-width: 0;
  margin-left: auto;
}

.nav-toggle {
  display: none;
  align-items: center;
  justify-content: center;
  min-height: 46px;
  padding: 0 18px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.82);
  color: var(--ink);
  font-weight: 800;
  cursor: pointer;
  list-style: none;
}

.nav-toggle::-webkit-details-marker {
  display: none;
}

.nav-links a {
  padding: 10px 14px;
  border-radius: var(--radius-pill);
  text-decoration: none;
  font-weight: 700;
}

.nav-links a.active,
.nav-links a:hover {
  color: #fff;
  background: var(--seed);
}

.page-hero,
.section-shell,
.feature-panel,
.page-link-card,
.stat-card,
.contact-card,
.timeline-card,
.social-frame,
.social-link-card,
.staff-card,
.quote-card,
.faq-item,
.video-card,
.gallery-card,
.map-card {
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  background: var(--surface);
  box-shadow: var(--shadow);
}

.page-hero {
  overflow: hidden;
  display: grid;
  grid-template-columns: minmax(0, 1.12fr) minmax(340px, 0.88fr);
  gap: 20px;
  padding: 22px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.66));
}

.hero-copy {
  min-width: 0;
  padding: 16px 8px;
}

.eyebrow {
  margin: 0 0 8px;
  color: var(--seed);
  text-transform: uppercase;
  letter-spacing: 0.22em;
  font-size: 0.72rem;
  font-weight: 800;
}

.hero-copy h1,
.section-head h2,
.page-link-card h3,
.social-link-card h3 {
  margin: 0;
  line-height: 1.02;
}

.hero-copy h1 {
  max-width: 11ch;
  font-size: clamp(2.3rem, 5vw, 5rem);
  overflow-wrap: anywhere;
}

.hero-copy .lede {
  max-width: 64ch;
  font-size: 1.04rem;
  line-height: 1.8;
  overflow-wrap: anywhere;
}

.hero-actions,
.hero-meta,
.cta-row,
.contact-stack,
.social-links {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.hero-actions {
  margin-top: 28px;
}

.hero-meta {
  margin-top: 18px;
}

.chip,
.social-links a {
  padding: 10px 14px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.76);
  color: var(--muted);
}

.cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  padding: 0 18px;
  border-radius: var(--radius-pill);
  border: 1px solid transparent;
  font-weight: 800;
  text-decoration: none;
}

.cta.primary {
  color: #fff;
  background: var(--seed);
}

.cta.secondary {
  color: var(--ink);
  border-color: var(--border);
  background: rgba(255, 255, 255, 0.82);
}

.hero-media {
  position: relative;
  min-height: clamp(300px, 34vw, 420px);
  aspect-ratio: 16 / 10;
  border-radius: var(--radius-media);
  overflow: hidden;
}

.hero-media img,
.page-media-fallback {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.page-media-fallback {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.6));
  font-size: 3rem;
}

.hero-overlay {
  position: absolute;
  inset: auto 16px 16px 16px;
  padding: 18px;
  border: 1px solid rgba(255, 255, 255, 0.36);
  border-radius: 20px;
  background: rgba(14, 22, 35, 0.54);
  backdrop-filter: blur(12px);
  color: #fff;
}

.hero-overlay strong {
  display: block;
  margin-bottom: 4px;
}

.hero-overlay span {
  color: rgba(255, 255, 255, 0.78);
}

.page-main {
  display: grid;
  gap: 24px;
  margin-top: 24px;
}

.stats-grid,
.link-grid,
.panel-grid,
.staff-grid,
.quote-grid,
.media-grid,
.video-grid,
.social-grid,
.contact-grid {
  display: grid;
  gap: 18px;
}

.stats-grid {
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
}

.link-grid {
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
}

.panel-grid,
.social-grid,
.contact-grid {
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

.staff-grid,
.quote-grid,
.media-grid,
.video-grid {
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}

.section-shell,
.feature-panel,
.page-link-card,
.timeline-card,
.social-frame,
.social-link-card,
.video-card,
.gallery-card,
.contact-card,
.faq-item,
.staff-card,
.quote-card,
.map-card {
  padding: 24px;
}

.section-split {
  display: grid;
  grid-template-columns: minmax(220px, 320px) minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}

.section-head h2 {
  font-size: clamp(1.9rem, 3vw, 3rem);
  max-width: 12ch;
}

.section-copy,
.panel-copy,
.feature-list,
.quote-card p,
.contact-card p {
  line-height: 1.78;
  font-size: 1rem;
  overflow-wrap: anywhere;
}

.feature-list,
.faq-list {
  display: grid;
  gap: 14px;
}

.feature-list {
  margin: 0;
  padding-left: 18px;
}

.stat-card strong {
  display: block;
  margin-bottom: 8px;
  font-size: clamp(1.5rem, 4vw, 2.15rem);
  line-height: 1.16;
  overflow-wrap: anywhere;
}

.page-link-card,
.social-link-card {
  display: grid;
  gap: 12px;
  min-width: 0;
  text-decoration: none;
}

.page-link-card:hover,
.social-link-card:hover {
  transform: translateY(-2px);
}

.inline-badge {
  display: inline-flex;
  width: fit-content;
  padding: 6px 10px;
  border-radius: var(--radius-pill);
  background: var(--seed-soft);
  color: var(--seed);
  font-size: 0.78rem;
  font-weight: 800;
}

.leadership-card,
.staff-card {
  display: grid;
  gap: 16px;
}

.staff-avatar,
.staff-avatar-fallback {
  width: 100%;
  aspect-ratio: 4 / 3;
  border-radius: 20px;
  object-fit: cover;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.62));
}

.staff-role,
.quote-card span {
  display: block;
  margin-top: 4px;
  color: var(--muted);
}

.gallery-card {
  overflow: hidden;
  display: flex;
  align-items: stretch;
  min-height: 0;
  aspect-ratio: 16 / 9;
  min-width: 0;
  border-radius: var(--radius-media);
}

.gallery-card img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.gallery-link-card {
  display: grid;
  gap: 14px;
  place-content: center;
  min-height: 0;
  aspect-ratio: 16 / 9;
  text-align: left;
}

.video-card iframe,
.video-card video {
  width: 100%;
  min-height: clamp(300px, 24vw, 420px);
  aspect-ratio: 16 / 9;
  border: 0;
  border-radius: 18px;
  background: #0f172a;
}

.timeline-card .video-card iframe,
.timeline-card .video-card video {
  min-height: clamp(340px, 28vw, 460px);
}

.video-card a,
.contact-link,
.social-link-card a {
  color: var(--seed);
  font-weight: 800;
}

.video-card .meta-line {
  margin-bottom: 12px;
  overflow-wrap: anywhere;
}

.social-frame iframe {
  width: 100%;
  min-height: 680px;
  border: 0;
  border-radius: 18px;
}

.social-link-card {
  align-content: start;
}

.timeline-card {
  display: grid;
  gap: 14px;
}

.faq-item summary {
  cursor: pointer;
  font-weight: 800;
}

.faq-item p {
  margin: 12px 0 0;
  line-height: 1.72;
}

.map-card iframe {
  width: 100%;
  min-height: 420px;
  border: 0;
  border-radius: 18px;
  background: #e8edf5;
}

.map-fallback {
  display: grid;
  gap: 10px;
  padding: 20px;
  border: 1px dashed var(--border);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.74);
}

.footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-top: 28px;
  padding: 18px 24px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.72);
}

@media (max-width: 980px) {
  .site-header {
    position: static;
    border-radius: 28px;
  }

  .site-nav {
    align-items: stretch;
  }

  .page-hero,
  .section-split {
    grid-template-columns: 1fr;
  }

  .nav-menu {
    width: 100%;
    margin-left: 0;
  }

  .nav-toggle {
    display: inline-flex;
  }

  .nav-links {
    display: none;
    padding-top: 12px;
    justify-content: flex-start;
    grid-template-columns: 1fr;
  }

  .nav-menu[open] .nav-links {
    display: grid;
  }

  .hero-copy h1,
  .section-head h2 {
    max-width: none;
  }

  .hero-media {
    min-height: 280px;
    aspect-ratio: 16 / 9;
  }
}

@media (max-width: 640px) {
  .site-shell {
    width: min(calc(100vw - 18px), var(--max));
    padding-top: 14px;
  }

  .brand {
    align-items: flex-start;
  }

  .brand-logo,
  .brand-logo-fallback {
    width: 52px;
    height: 52px;
  }

  .nav-links a {
    justify-content: center;
  }

  .site-header,
  .page-hero,
  .section-shell,
  .feature-panel,
  .page-link-card,
  .timeline-card,
  .social-frame,
  .social-link-card,
  .video-card,
  .gallery-card,
  .contact-card,
  .faq-item,
  .staff-card,
  .quote-card,
  .map-card {
    padding: 18px;
  }

  .hero-media {
    min-height: 240px;
  }
}

@media (max-width: 480px) {
  .hero-copy h1 {
    font-size: clamp(2rem, 11vw, 2.8rem);
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }
}`;
}

function renderHomePage(business, website) {
  const previewCards = [
    {
      file: "academics.html",
      badge: "Programs",
      title: "Academic pathways and learning environment",
      copy: "Present programs, facilities, outcomes, and the academic promise in a page built for serious evaluation.",
    },
    {
      file: "people.html",
      badge: "Team",
      title: "Leadership, faculty, and community voice",
      copy: "Highlight the people behind the institute with leadership notes, staff profiles, and testimonials.",
    },
    {
      file: "media.html",
      badge: "Media",
      title: "Gallery, campus visuals, and video stories",
      copy: "Give prospective students a richer visual sense of the institute through dedicated image and video pages.",
    },
    {
      file: "updates.html",
      badge: "Updates",
      title: "Official social presence and current activity",
      copy: "Keep Facebook and YouTube visible so students can follow the institute where updates already happen.",
    },
  ];

  const content = `
    <section class="section-shell section-split">
      <div class="section-head">
        <p class="eyebrow">Overview</p>
        <h2>${escapeHtml(website.about_title)}</h2>
      </div>
      <div class="section-copy">
        <p>${escapeHtml(website.about_body)}</p>
        ${renderLeadershipCard(website, false)}
      </div>
    </section>
    <section class="section-shell">
      <div class="section-head">
        <p class="eyebrow">Explore</p>
        <h2>Navigate the complete institute story</h2>
      </div>
      <div class="link-grid">
        ${previewCards
          .map(
            (item) => `
              <a class="page-link-card" href="./${item.file}">
                <span class="inline-badge">${escapeHtml(item.badge)}</span>
                <h3>${escapeHtml(item.title)}</h3>
                <p>${escapeHtml(item.copy)}</p>
              </a>
            `
          )
          .join("")}
      </div>
    </section>
    <section class="section-shell">
      <div class="section-head">
        <p class="eyebrow">Highlights</p>
        <h2>Why families move closer</h2>
      </div>
      <div class="panel-grid">
        ${renderSimplePanel("Admissions", website.admissions_body || "Use the admissions page to explain intake flow, scholarships, documents, and important timelines.")}
        ${renderSimplePanel("Facilities", website.facilities.length ? website.facilities.join(", ") : "Add facilities in Generator Studio to show labs, studios, libraries, transport, and student support.")}
        ${renderSimplePanel("Programs", website.programs.length ? website.programs.join(", ") : "Add programs to turn this block into a clear academic overview.")}
      </div>
    </section>
    ${renderTextPanels(website.extra_sections)}
    ${renderContactCta(website)}
  `;

  return renderPageFrame({
    business,
    website,
    currentPage: "index",
    title: website.hero_title,
    kicker: website.hero_kicker,
    lead: website.hero_summary,
    heroMeta: [business.location_label, business.type, business.affiliation].filter(Boolean),
    heroOverlayTitle: "Institution profile",
    heroOverlayCopy: "A multi-page institute website generated from Generator Studio.",
    content,
  });
}

function renderAcademicsPage(business, website) {
  const content = `
    <section class="section-shell section-split">
      <div class="section-head">
        <p class="eyebrow">Programs</p>
        <h2>Academic offerings</h2>
      </div>
      <div class="feature-panel">
        ${renderFeatureList(website.programs, "Programs will appear here once they are added in Generator Studio.")}
      </div>
    </section>
    <section class="section-shell section-split">
      <div class="section-head">
        <p class="eyebrow">Campus</p>
        <h2>Facilities and learner support</h2>
      </div>
      <div class="feature-panel">
        ${renderFeatureList(website.facilities, "Facilities will appear here once they are added in Generator Studio.")}
      </div>
    </section>
    ${renderTextPanels(website.extra_sections)}
    <section class="section-shell section-split">
      <div class="section-head">
        <p class="eyebrow">Enrollment</p>
        <h2>${escapeHtml(website.admissions_title)}</h2>
      </div>
      <div class="section-copy">
        <p>${escapeHtml(website.admissions_body || "Use Generator Studio to add a full admissions narrative for this page.")}</p>
        <div class="cta-row">
          ${renderLinkButton(website.primary_cta_url, website.primary_cta_label, "primary")}
          <a class="cta secondary" href="./admissions.html">Open admissions page</a>
        </div>
      </div>
    </section>
  `;

  return renderPageFrame({
    business,
    website,
    currentPage: "academics",
    title: "Academics and learning environment",
    kicker: business.type || website.hero_kicker,
    lead: "A dedicated page for programs, facilities, and the institute’s academic direction.",
    heroMeta: [business.location_label, `${website.programs.length || 0} programs`],
    heroOverlayTitle: "Academic profile",
    heroOverlayCopy: "Designed to answer the first serious questions a prospective student asks.",
    content,
  });
}

function renderPeoplePage(business, website) {
  const content = `
    <section class="section-shell section-split">
      <div class="section-head">
        <p class="eyebrow">Leadership</p>
        <h2>Institutional voice and direction</h2>
      </div>
      <div class="section-copy">
        ${renderLeadershipCard(website, true)}
      </div>
    </section>
    <section class="section-shell">
      <div class="section-head">
        <p class="eyebrow">Staff</p>
        <h2>Meet the people behind the institute</h2>
      </div>
      ${renderStaffGrid(website.staff)}
    </section>
    <section class="section-shell">
      <div class="section-head">
        <p class="eyebrow">Testimonials</p>
        <h2>Community voice</h2>
      </div>
      ${renderTestimonials(website.testimonials)}
    </section>
  `;

  return renderPageFrame({
    business,
    website,
    currentPage: "people",
    title: "Leadership, staff, and community",
    kicker: "People",
    lead: "Show the credibility, warmth, and professionalism of the institution through real team profiles and community feedback.",
    heroMeta: [business.location_label, `${website.staff.length} staff profiles`],
    heroOverlayTitle: "Human side of the institute",
    heroOverlayCopy: "A strong institute feels personal before it feels promotional.",
    content,
  });
}

function renderMediaPage(business, website) {
  const content = `
    <section class="section-shell">
      <div class="section-head">
        <p class="eyebrow">Gallery</p>
        <h2>Campus and atmosphere</h2>
      </div>
      ${renderGallery(website.gallery)}
    </section>
    <section class="section-shell">
      <div class="section-head">
        <p class="eyebrow">Videos</p>
        <h2>Playable video cards</h2>
      </div>
      ${renderVideos(website.videos)}
    </section>
  `;

  return renderPageFrame({
    business,
    website,
    currentPage: "media",
    title: "Gallery and video stories",
    kicker: "Media",
    lead: "A richer visual page for galleries, playable videos, and the atmosphere students will connect with first.",
    heroMeta: [business.location_label, `${website.gallery.length} gallery assets`, `${website.videos.length} videos`],
    heroOverlayTitle: "Visual storytelling",
    heroOverlayCopy: "Built for a stronger first impression than a single landing page can provide.",
    content,
  });
}

function renderUpdatesPage(business, website) {
  const content = `
    <section class="section-shell">
      <div class="section-head">
        <p class="eyebrow">Social</p>
        <h2>Official public updates</h2>
      </div>
      <div class="social-grid">
        ${renderFacebookTimeline(website.social.facebook)}
        ${renderYouTubeUpdates(website)}
      </div>
    </section>
    <section class="section-shell">
      <div class="section-head">
        <p class="eyebrow">Follow</p>
        <h2>Official social channels</h2>
      </div>
      <div class="panel-grid">
        ${renderSocialLinkCard("Facebook", website.social.facebook, "See page activity, public notices, and community announcements.")}
        ${renderSocialLinkCard("YouTube", website.social.youtube, "Direct students toward the institute’s video presence and public archive.")}
        ${renderSocialLinkCard("Instagram", website.social.instagram, "Use Instagram for event coverage, campus visuals, and lighter updates.")}
      </div>
    </section>
  `;

  return renderPageFrame({
    business,
    website,
    currentPage: "updates",
    title: "Public updates and social presence",
    kicker: "Updates",
    lead: "Keep current channels visible so students can move from the website into the institute’s real public activity.",
    heroMeta: [business.location_label, website.social.facebook ? "Facebook connected" : "", website.social.youtube ? "YouTube connected" : ""].filter(Boolean),
    heroOverlayTitle: "Live public presence",
    heroOverlayCopy: "Social surfaces make the institute feel active instead of static.",
    content,
  });
}

function renderAdmissionsPage(business, website) {
  const content = `
    <section class="section-shell section-split">
      <div class="section-head">
        <p class="eyebrow">Admissions</p>
        <h2>${escapeHtml(website.admissions_title)}</h2>
      </div>
      <div class="section-copy">
        <p>${escapeHtml(website.admissions_body || "Add admissions guidance in Generator Studio to turn this page into a proper enrollment briefing.")}</p>
        <div class="cta-row">
          ${renderLinkButton(website.primary_cta_url, website.primary_cta_label, "primary")}
          ${renderLinkButton(website.secondary_cta_url, website.secondary_cta_label, "secondary")}
        </div>
      </div>
    </section>
    <section class="section-shell">
      <div class="section-head">
        <p class="eyebrow">FAQ</p>
        <h2>Common questions</h2>
      </div>
      ${renderFaqList(website.faqs)}
    </section>
    ${renderContactCta(website)}
  `;

  return renderPageFrame({
    business,
    website,
    currentPage: "admissions",
    title: "Admissions and enrollment",
    kicker: "Admissions",
    lead: "Give families a clean explanation of next steps, documentation, contact points, and timing.",
    heroMeta: [business.location_label, business.affiliation],
    heroOverlayTitle: "Next step clarity",
    heroOverlayCopy: "A strong admissions page removes friction before the first visit or call.",
    content,
  });
}

function renderContactPage(business, website) {
  const content = `
    <section class="section-shell">
      <div class="section-head">
        <p class="eyebrow">Contact</p>
        <h2>Reach the institute</h2>
      </div>
      <div class="contact-grid">
        ${renderContactCard("Address", website.contact.address)}
        ${renderContactCard("Phone", website.contact.phone, website.contact.phone ? `tel:${website.contact.phone}` : "", "Call now")}
        ${renderContactCard("Email", website.contact.email, website.contact.email ? `mailto:${website.contact.email}` : "", "Send email")}
        ${renderContactCard("Website", website.contact.website, website.contact.website, "Open website")}
      </div>
    </section>
    ${renderMapPanel(website.contact.map_url, {
      address: website.contact.address,
      location: business.location_label,
    })}
    <section class="section-shell">
      <div class="section-head">
        <p class="eyebrow">Social</p>
        <h2>Stay connected</h2>
      </div>
      ${renderSocialLinks(website.social)}
    </section>
  `;

  return renderPageFrame({
    business,
    website,
    currentPage: "contact",
    title: "Contact and location",
    kicker: "Contact",
    lead: "Make it easy for prospective students and families to reach the institute without searching for the basics.",
    heroMeta: [business.location_label, website.contact.phone, website.contact.email].filter(Boolean),
    heroOverlayTitle: "Clear contact flow",
    heroOverlayCopy: "Every serious inquiry should find a direct next action here.",
    content,
  });
}

function renderPageFrame({
  business,
  website,
  currentPage,
  title,
  kicker,
  lead,
  heroMeta,
  heroOverlayTitle,
  heroOverlayCopy,
  content,
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} | ${escapeHtml(website.site_title || business.name)}</title>
  <meta name="description" content="${escapeHtml(lead || website.hero_summary || business.description || business.name)}">
  <link rel="stylesheet" href="./styles.css">
</head>
<body>
  <div class="site-shell">
    ${renderSiteHeader(website, business, currentPage)}
    <section class="page-hero">
      <div class="hero-copy">
        <p class="eyebrow">${escapeHtml(kicker || business.type || "Institute")}</p>
        <h1>${escapeHtml(title)}</h1>
        <p class="lede">${escapeHtml(lead || website.hero_summary || business.description || "")}</p>
        <div class="hero-actions">
          ${renderLinkButton(website.primary_cta_url, website.primary_cta_label, "primary")}
          <a class="cta secondary" href="./contact.html">Contact institute</a>
        </div>
        ${heroMeta && heroMeta.length ? `<div class="hero-meta">${heroMeta.map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join("")}</div>` : ""}
      </div>
      ${renderHeroMedia(website, business, heroOverlayTitle, heroOverlayCopy)}
    </section>
    <main class="page-main">
      ${content}
    </main>
    <footer class="footer">
      <span>${escapeHtml(website.site_title || business.name)}</span>
      <span>Generated by Generator Studio</span>
    </footer>
  </div>
</body>
</html>`;
}

function renderSiteHeader(website, business, currentPage) {
  const logo = website.logo_url
    ? `<img class="brand-logo" src="${escapeHtml(website.logo_url)}" alt="${escapeHtml(website.site_title || business.name)} logo">`
    : `<div class="brand-logo-fallback">${escapeHtml(initialsOf(website.site_title || business.name))}</div>`;

  return `
    <header class="site-header">
      <nav class="site-nav">
        <a class="brand" href="./index.html">
          ${logo}
          <div class="brand-copy">
            <strong>${escapeHtml(website.site_title || business.name)}</strong>
            <span>${escapeHtml([business.type, business.location_label].filter(Boolean).join(" · "))}</span>
          </div>
        </a>
        <details class="nav-menu">
          <summary class="nav-toggle">Menu</summary>
          <div class="nav-links">
            ${WEBSITE_PAGES.map((page) => `<a class="${page.slug === currentPage ? "active" : ""}" href="./${page.file}">${escapeHtml(page.label)}</a>`).join("")}
          </div>
        </details>
      </nav>
    </header>
  `;
}

function renderHeroMedia(website, business, overlayTitle, overlayCopy) {
  const image = website.cover_url
    ? `<img src="${escapeHtml(website.cover_url)}" alt="${escapeHtml(website.site_title || business.name)} cover">`
    : `<div class="page-media-fallback">${escapeHtml(initialsOf(website.site_title || business.name))}</div>`;

  return `
    <div class="hero-media">
      ${image}
      <div class="hero-overlay">
        <strong>${escapeHtml(overlayTitle || "Institute profile")}</strong>
        <span>${escapeHtml(overlayCopy || "A professional public profile generated from structured institute data.")}</span>
      </div>
    </div>
  `;
}

function renderLeadershipCard(website, includeHeading) {
  if (!website.principal_name && !website.principal_message) {
    return renderSimplePanel(
      "Leadership note",
      "Add the institute lead and a short message in Generator Studio to make the site feel more personal and authoritative."
    );
  }

  return `
    <div class="feature-panel leadership-card">
      ${includeHeading ? `<span class="inline-badge">Leadership</span>` : ""}
      <div>
        <strong>${escapeHtml(website.principal_name || "Institute Lead")}</strong>
        <div class="meta-line">${escapeHtml(website.principal_role || "Academic Lead")}</div>
      </div>
      <div class="panel-copy">${escapeHtml(website.principal_message || "")}</div>
    </div>
  `;
}

function renderStatsGrid(items) {
  if (!items || !items.length) {
    return "";
  }

  return `
    <section class="stats-grid">
      ${items
        .map(
          (item) => `
            <article class="stat-card">
              <strong>${escapeHtml(item.value || "")}</strong>
              <span class="meta-line">${escapeHtml(item.label || "")}</span>
            </article>
          `
        )
        .join("")}
    </section>
  `;
}

function renderSimplePanel(title, copy) {
  return `
    <article class="feature-panel">
      <span class="inline-badge">${escapeHtml(title)}</span>
      <div class="panel-copy">${escapeHtml(copy)}</div>
    </article>
  `;
}

function renderFeatureList(items, emptyCopy) {
  if (!items || !items.length) {
    return `<div class="panel-copy">${escapeHtml(emptyCopy)}</div>`;
  }

  return `<ul class="feature-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderTextPanels(items) {
  if (!items || !items.length) {
    return "";
  }

  return `
    <section class="section-shell">
      <div class="section-head">
        <p class="eyebrow">Additional detail</p>
        <h2>What else students should know</h2>
      </div>
      <div class="panel-grid">
        ${items.map((item) => renderSimplePanel(item.title || "Detail", item.body || "")).join("")}
      </div>
    </section>
  `;
}

function renderStaffGrid(staff) {
  if (!staff || !staff.length) {
    return renderSimplePanel(
      "Staff profiles",
      "Add staff profiles in Generator Studio to turn this page into a fuller faculty and team showcase."
    );
  }

  return `
    <div class="staff-grid">
      ${staff
        .map((item) => {
          const image = item.image
            ? `<img class="staff-avatar" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name || item.role || "Staff member")}">`
            : `<div class="staff-avatar-fallback">${escapeHtml(initialsOf(item.name || item.role || "Staff"))}</div>`;
          return `
            <article class="staff-card">
              ${image}
              <div>
                <h3>${escapeHtml(item.name || "Staff Member")}</h3>
                <span class="staff-role">${escapeHtml(item.role || "")}</span>
              </div>
              <p class="panel-copy">${escapeHtml(item.bio || "")}</p>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderTestimonials(items) {
  if (!items || !items.length) {
    return renderSimplePanel(
      "Testimonials",
      "Add testimonials in Generator Studio to show the institute through the voice of students, parents, or alumni."
    );
  }

  return `
    <div class="quote-grid">
      ${items
        .map(
          (item) => `
            <article class="quote-card">
              <strong>${escapeHtml(item.name || "Community member")}</strong>
              <span>${escapeHtml(item.role || "")}</span>
              <p>${escapeHtml(item.quote || "")}</p>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderGallery(items) {
  if (!items || !items.length) {
    return renderSimplePanel(
      "Gallery",
      "Add image links in Generator Studio to fill this page with campus and event visuals."
    );
  }

  return `
    <div class="media-grid">
      ${items
        .map((item, index) => {
          if (looksLikeImage(item)) {
            return `<article class="gallery-card"><img src="${escapeHtml(item)}" alt="Institute media ${index + 1}"></article>`;
          }
          return `
            <article class="gallery-card gallery-link-card">
              <span class="inline-badge">Media link</span>
              <strong>${escapeHtml(item)}</strong>
              <a class="cta secondary" href="${escapeHtml(item)}" target="_blank" rel="noreferrer">Open media</a>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderVideos(items) {
  if (!items || !items.length) {
    return renderSimplePanel(
      "Videos",
      "Add YouTube, Vimeo, or direct video links in Generator Studio to create playable media cards here."
    );
  }

  return `<div class="video-grid">${items.map((item) => renderVideoCard(item)).join("")}</div>`;
}

function renderVideoCard(item) {
  const title = escapeHtml(item.title || "Institute video");
  const url = escapeHtml(item.url || "");
  const embedUrl = toEmbedVideoUrl(item.url);

  let media = `<a class="cta secondary" href="${url}" target="_blank" rel="noreferrer">Open video</a>`;
  if (embedUrl) {
    media = `<iframe src="${escapeHtml(embedUrl)}" title="${title}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
  } else if (isDirectVideoUrl(item.url)) {
    media = `<video controls preload="metadata" src="${url}"></video>`;
  }

  return `
    <article class="video-card">
      <span class="inline-badge">Video</span>
      <div class="meta-line">${title}</div>
      ${media}
      <div class="meta-line">${url}</div>
    </article>
  `;
}

function renderFacebookTimeline(url) {
  if (!url) {
    return renderSimplePanel(
      "Facebook",
      "Add the institute Facebook URL in Generator Studio to embed the official public page timeline here."
    );
  }

  const pluginUrl = `https://www.facebook.com/plugins/page.php?href=${encodeURIComponent(url)}&tabs=timeline&width=600&height=720&small_header=false&adapt_container_width=true&hide_cover=false&show_facepile=true`;
  return `
    <section class="social-frame">
      <span class="inline-badge">Facebook</span>
      <div class="meta-line">${escapeHtml(url)}</div>
      <iframe src="${pluginUrl}" loading="lazy" allowfullscreen title="Facebook updates"></iframe>
    </section>
  `;
}

function renderYouTubeUpdates(website) {
  const socialUrl = website.social.youtube;
  const intro = socialUrl
    ? `<a class="cta secondary" href="${escapeHtml(socialUrl)}" target="_blank" rel="noreferrer">Open YouTube channel</a>`
    : `<div class="panel-copy">Add a YouTube URL to connect the institute’s video presence.</div>`;

  return `
    <section class="timeline-card">
      <span class="inline-badge">YouTube</span>
      <p>${socialUrl ? "Use the official channel for current public videos and open the latest featured cards below." : "No YouTube channel has been added yet."}</p>
      ${intro}
      ${website.videos.length ? `<div class="video-grid">${website.videos.slice(0, 2).map((item) => renderVideoCard(item)).join("")}</div>` : ""}
    </section>
  `;
}

function renderSocialLinkCard(name, url, copy) {
  if (!url) {
    return renderSimplePanel(name, `Add the institute ${name} URL in Generator Studio to show it here.`);
  }

  return `
    <article class="social-link-card">
      <span class="inline-badge">${escapeHtml(name)}</span>
      <h3>${escapeHtml(name)} channel</h3>
      <p>${escapeHtml(copy)}</p>
      <a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(url)}</a>
    </article>
  `;
}

function renderFaqList(items) {
  if (!items || !items.length) {
    return renderSimplePanel(
      "FAQ",
      "Add question and answer pairs in Generator Studio to turn this section into a useful admissions FAQ."
    );
  }

  return `
    <div class="faq-list">
      ${items
        .map(
          (item) => `
            <details class="faq-item">
              <summary>${escapeHtml(item.question || "Question")}</summary>
              <p>${escapeHtml(item.answer || "")}</p>
            </details>
          `
        )
        .join("")}
    </div>
  `;
}

function renderContactCard(title, body, href = "", linkLabel = "Open") {
  if (!body) {
    return renderSimplePanel(title, `${title} details have not been added yet.`);
  }

  return `
    <article class="contact-card">
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(body)}</p>
      ${href ? `<a class="contact-link" href="${escapeHtml(href)}" target="${href.startsWith("mailto:") || href.startsWith("tel:") ? "_self" : "_blank"}" rel="noreferrer">${escapeHtml(linkLabel)}</a>` : ""}
    </article>
  `;
}

function renderMapPanel(url, details = {}) {
  const locationText = [details.address, details.location].filter(Boolean).join(" · ");
  const mapLinks = resolveMapUrls(url);
  if (!mapLinks.openUrl && !locationText) {
    return "";
  }

  const media = mapLinks.embedUrl
    ? `<iframe src="${escapeHtml(mapLinks.embedUrl)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Institute map"></iframe>`
    : `
      <div class="map-fallback">
        <strong>Interactive map preview is unavailable for this location link.</strong>
        <div class="panel-copy">Use the direct map button below to open the institute location in a new tab.</div>
      </div>
    `;

  return `
    <section class="map-card">
      <span class="inline-badge">Map</span>
      <div class="meta-line">Institute location</div>
      ${locationText ? `<div class="panel-copy">${escapeHtml(locationText)}</div>` : ""}
      ${media}
      <div class="cta-row">
        ${mapLinks.openUrl ? `<a class="cta secondary" href="${escapeHtml(mapLinks.openUrl)}" target="_blank" rel="noreferrer">Open map</a>` : ""}
      </div>
    </section>
  `;
}

function resolveMapUrls(url) {
  const openUrl = String(url || "").trim();
  if (!openUrl) {
    return { openUrl: "", embedUrl: "" };
  }

  try {
    const parsed = new URL(openUrl);
    const host = String(parsed.hostname || "").toLowerCase();
    const path = String(parsed.pathname || "").toLowerCase();
    if (path.includes("/maps/embed") || parsed.searchParams.get("output") === "embed") {
      return { openUrl, embedUrl: openUrl };
    }

    const query = parsed.searchParams.get("query") || parsed.searchParams.get("q");
    if ((host.includes("google.") || host.includes("maps.google.")) && query) {
      return {
        openUrl,
        embedUrl: `https://www.google.com/maps?q=${encodeURIComponent(query)}&z=15&output=embed`,
      };
    }

    if (host.includes("openstreetmap.org") && path.includes("/export/embed.html")) {
      return { openUrl, embedUrl: openUrl };
    }
  } catch {}

  return { openUrl, embedUrl: "" };
}

function renderSocialLinks(social) {
  const items = [
    ["Facebook", social.facebook],
    ["Instagram", social.instagram],
    ["YouTube", social.youtube],
    ["Twitter / X", social.twitter],
  ].filter((item) => item[1]);

  if (!items.length) {
    return renderSimplePanel(
      "Social links",
      "Add official social links in Generator Studio to make it easier for students to follow the institute."
    );
  }

  return `
    <div class="social-links">
      ${items
        .map(
          ([label, url]) => `
            <a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>
          `
        )
        .join("")}
    </div>
  `;
}

function renderContactCta(website) {
  if (!website.cta_title && !website.cta_body) {
    return "";
  }

  return `
    <section class="section-shell section-split">
      <div class="section-head">
        <p class="eyebrow">Next step</p>
        <h2>${escapeHtml(website.cta_title || "Start the conversation")}</h2>
      </div>
      <div class="section-copy">
        <p>${escapeHtml(website.cta_body || "")}</p>
        <div class="cta-row">
          ${renderLinkButton(website.primary_cta_url, website.primary_cta_label, "primary")}
          <a class="cta secondary" href="./contact.html">Open contact page</a>
        </div>
      </div>
    </section>
  `;
}

function renderLinkButton(url, label, variant) {
  if (!url) {
    return "";
  }

  const target = url.startsWith("mailto:") || url.startsWith("tel:") ? "_self" : "_blank";
  return `<a class="cta ${escapeHtml(variant || "secondary")}" href="${escapeHtml(url)}" target="${target}" rel="noreferrer">${escapeHtml(label || "Open link")}</a>`;
}

function looksLikeImage(url) {
  const value = String(url || "").toLowerCase();
  return /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/.test(value) || value.includes("dummyimage.com");
}

module.exports = {
  buildWebsitePages,
  buildWebsiteStyles,
};

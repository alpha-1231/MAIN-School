const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const BASIC_DIR = path.join(DATA_DIR, "basic");
const DETAILED_DIR = path.join(DATA_DIR, "detailed");
const PAYMENTS_DIR = path.join(DATA_DIR, "payments");
const BASIC_INDEX_FILE = path.join(BASIC_DIR, "_cards.json");
const PLAN_CATALOG_FILE = path.join(ROOT_DIR, "config", "plan-catalog.json");

const TOTAL_RECORDS = 50;
const PLAN_CATALOG = loadPlanCatalog();
const PROVINCES = {
  "1": {
    name: "Koshi",
    districts: ["Biratnagar", "Dharan", "Itahari", "Bhojpur", "Jhapa", "Ilam", "Dhankuta"],
    lat: 26.72,
    lng: 87.29,
  },
  "2": {
    name: "Madhesh",
    districts: ["Janakpur", "Birgunj", "Lahan", "Rajbiraj", "Kalaiya", "Malangwa", "Jaleshwar"],
    lat: 26.75,
    lng: 85.92,
  },
  "3": {
    name: "Bagmati",
    districts: ["Kathmandu", "Lalitpur", "Bhaktapur", "Hetauda", "Chitwan", "Banepa", "Dhading"],
    lat: 27.72,
    lng: 85.32,
  },
  "4": {
    name: "Gandaki",
    districts: ["Pokhara", "Baglung", "Besisahar", "Gorkha", "Syangja", "Damauli", "Parbat"],
    lat: 28.21,
    lng: 83.99,
  },
  "5": {
    name: "Lumbini",
    districts: ["Butwal", "Bhairahawa", "Kapilvastu", "Nepalgunj", "Tulsipur", "Palpa", "Gulmi"],
    lat: 27.68,
    lng: 83.47,
  },
  "6": {
    name: "Karnali",
    districts: ["Surkhet", "Jumla", "Dailekh", "Kalikot", "Jajarkot", "Salyan", "Dolpa"],
    lat: 28.60,
    lng: 81.63,
  },
  "7": {
    name: "Sudurpashchim",
    districts: ["Dhangadhi", "Mahendranagar", "Dadeldhura", "Baitadi", "Doti", "Bajhang", "Achham"],
    lat: 28.70,
    lng: 80.58,
  },
};

const BRAND_PREFIXES = [
  "Everest",
  "Lotus",
  "Summit",
  "Horizon",
  "Crest",
  "Radiant",
  "Future",
  "Valley",
  "Insight",
  "Pioneer",
  "Meridian",
  "Northfield",
  "Southgate",
  "Riverside",
  "Brighton",
  "Scholars",
];

const STREET_NAMES = [
  "Knowledge Marg",
  "Campus Chowk",
  "Learning Path",
  "Innovation Lane",
  "Scholars Road",
  "Heritage Street",
  "Bridgeway",
  "North Avenue",
  "Green Hills Road",
  "Vision Square",
];

const VIDEO_LINKS = [
  "https://www.youtube.com/watch?v=ysz5S6PUM-U",
  "https://www.youtube.com/watch?v=jNQXAC9IVRw",
  "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
  "https://vimeo.com/76979871",
  "https://vimeo.com/22439234",
];

const COLOR_PAIRS = [
  { bg: "d8e8ff", fg: "163152" },
  { bg: "ffe4d2", fg: "4b2e1f" },
  { bg: "e2f3df", fg: "21482f" },
  { bg: "f4e6ff", fg: "38214b" },
  { bg: "fff2bf", fg: "5b4210" },
  { bg: "dff4f7", fg: "173a46" },
];

const TEMPLATES = [
  {
    brand: "Scholars School",
    type: "School",
    level: ["Pre-School", "School", "+2"],
    field: ["Science", "Management", "Humanities"],
    affiliation: "NEB",
    programs: [
      "Montessori Program",
      "Secondary Curriculum",
      "+2 Science",
      "+2 Management",
      "ECA Leadership Track",
    ],
    facilities: ["Library", "Science Lab", "Computer Lab", "Playground", "Transport"],
    tags: ["school", "day-school", "student-life"],
    baseAmount: 18000,
  },
  {
    brand: "National College",
    type: "College",
    level: ["+2", "Bachelor"],
    field: ["Management", "Computer Science", "Education"],
    affiliation: "TU",
    programs: [
      "+2 Management",
      "BBS",
      "BCA",
      "B.Ed.",
      "Career Placement Cell",
    ],
    facilities: ["Seminar Hall", "Wi-Fi Campus", "Computer Lab", "Library", "Cafeteria"],
    tags: ["college", "undergraduate", "career-focused"],
    baseAmount: 24000,
  },
  {
    brand: "Technical Institute",
    type: "Polytechnic Institute",
    level: ["Diploma"],
    field: ["Civil Engineering", "Computer Engineering", "Health Sciences"],
    affiliation: "CTEVT",
    programs: [
      "Diploma in Civil Engineering",
      "Diploma in Computer Engineering",
      "Diploma in Medical Lab Technology",
      "Industrial Training Lab",
    ],
    facilities: ["Workshop", "Hostel", "Project Lab", "Industry Desk", "Library"],
    tags: ["technical", "diploma", "hands-on"],
    baseAmount: 26000,
  },
  {
    brand: "Metropolitan University",
    type: "University",
    level: ["Bachelor", "Master"],
    field: ["Engineering", "Business", "Law"],
    affiliation: "KU",
    programs: [
      "B.Tech.",
      "BBA",
      "LLB",
      "MBA",
      "Research and Innovation Hub",
    ],
    facilities: ["Innovation Lab", "Digital Library", "Auditorium", "Research Center", "Hostel"],
    tags: ["university", "research", "residential"],
    baseAmount: 32000,
  },
  {
    brand: "Skills Training Center",
    type: "Training Institute",
    level: ["Certificate", "Diploma"],
    field: ["IT", "Language", "Design"],
    affiliation: "Private",
    programs: [
      "Full Stack Bootcamp",
      "English Communication",
      "Graphic Design",
      "Digital Marketing",
      "Career Coaching",
    ],
    facilities: ["Mac Lab", "Studio Room", "Wi-Fi Campus", "Career Desk", "Cafe"],
    tags: ["training", "skills", "bootcamp"],
    baseAmount: 15000,
  },
  {
    brand: "Health Sciences College",
    type: "Nursing College",
    level: ["Bachelor", "Master"],
    field: ["Nursing", "Public Health", "Medical Lab"],
    affiliation: "PU",
    programs: [
      "BSc Nursing",
      "BPH",
      "BMLT",
      "MSc Nursing",
      "Hospital Internship Desk",
    ],
    facilities: ["Simulation Lab", "Library", "Clinical Lab", "Hostel", "Counseling Center"],
    tags: ["health", "nursing", "clinical"],
    baseAmount: 28000,
  },
];

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function resetDir(dirPath) {
  ensureDir(dirPath);
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      fs.rmSync(entryPath, { recursive: true, force: true });
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".json")) {
      fs.unlinkSync(entryPath);
    }
  }
}

function writeJson(filePath, value, pretty = true) {
  ensureDir(path.dirname(filePath));
  const output = pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value);
  fs.writeFileSync(filePath, output);
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function pad(num) {
  return String(num).padStart(2, "0");
}

function isoDate(year, monthIndex, day, hour = 5, minute = 30) {
  return new Date(Date.UTC(year, monthIndex, day, hour, minute, 0, 0)).toISOString();
}

function plusMonths(dateValue, monthOffset) {
  const date = new Date(dateValue);
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() + monthOffset,
      date.getUTCDate(),
      date.getUTCHours(),
      date.getUTCMinutes(),
      0,
      0
    )
  ).toISOString();
}

function loadPlanCatalog() {
  const rawCatalog = readJson(PLAN_CATALOG_FILE, {});
  const baseMonthlyRate = Number(rawCatalog?.base_monthly_rate) || 100;
  const currency = String(rawCatalog?.currency || "NPR").trim() || "NPR";
  const fallbackPlans = [
    { id: "monthly", label: "monthly", months: 1, discount_percent: 0 },
    { id: "yearly", label: "Yearly", months: 12, discount_percent: 10 },
    { id: "six-months", label: "6 Months", months: 6, discount_percent: 5 },
  ];
  const plans = Array.isArray(rawCatalog?.plans) ? rawCatalog.plans : fallbackPlans;

  return {
    currency,
    base_monthly_rate: baseMonthlyRate,
    plans: plans
      .map((plan, index) => normalizePlan(plan, index, baseMonthlyRate, currency))
      .filter(Boolean),
  };
}

function normalizePlan(plan, index, baseMonthlyRate, currency) {
  if (!plan || typeof plan !== "object") {
    return null;
  }

  const label = String(plan.label || `Plan ${index + 1}`).trim();
  const months = Math.max(1, Number.parseInt(plan.months, 10) || 12);
  const discountPercent = Math.min(100, Math.max(0, Number(plan.discount_percent) || 0));

  return {
    id: slugify(plan.id || label) || `plan-${index + 1}`,
    label,
    months,
    discount_percent: discountPercent,
    currency,
    amount: Number((baseMonthlyRate * months * (1 - discountPercent / 100)).toFixed(2)),
  };
}

function readJson(filePath, fallback = null) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function initialText(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function makeImageUrl(width, height, bg, fg, label, extension = "jpg") {
  return `https://dummyimage.com/${width}x${height}/${bg}/${fg}.${extension}?text=${encodeURIComponent(label)}`;
}

function buildRecords() {
  const basics = [];

  for (let index = 1; index <= TOTAL_RECORDS; index += 1) {
    const template = TEMPLATES[(index - 1) % TEMPLATES.length];
    const plan = PLAN_CATALOG.plans[(index - 1) % PLAN_CATALOG.plans.length];
    const provinceCode = String(((index - 1) % Object.keys(PROVINCES).length) + 1);
    const province = PROVINCES[provinceCode];
    const district = province.districts[(Math.floor((index - 1) / TEMPLATES.length) + index) % province.districts.length];
    const prefix = BRAND_PREFIXES[(index - 1) % BRAND_PREFIXES.length];
    const color = COLOR_PAIRS[(index - 1) % COLOR_PAIRS.length];
    const accentColor = COLOR_PAIRS[index % COLOR_PAIRS.length];
    const street = STREET_NAMES[(index - 1) % STREET_NAMES.length];
    const slug = `test-${index}`;
    const name = `${prefix} ${district} ${template.brand}`;
    const createdAt = isoDate(2025, 0, ((index - 1) % 25) + 1);
    const updatedAt = isoDate(2026, 2, ((index - 1) % 27) + 1);
    const currentPaidAt = isoDate(2026, 2, ((index - 1) % 24) + 1);
    const currentStartsAt = currentPaidAt;
    const currentExpiresAt = plusMonths(currentStartsAt, plan.months);
    const previousPaidAt = isoDate(2025, 2, ((index - 1) % 24) + 1);
    const previousStartsAt = previousPaidAt;
    const previousExpiresAt = plusMonths(previousStartsAt, plan.months);
    const amount = plan.amount;
    const initials = initialText(name) || `T${index}`;
    const logo = makeImageUrl(360, 360, color.bg, color.fg, initials, "png");
    const cover = makeImageUrl(1600, 980, color.bg, color.fg, name);
    const gallery = [
      makeImageUrl(1400, 920, color.bg, color.fg, `${name} Main Block`),
      makeImageUrl(1400, 920, accentColor.bg, accentColor.fg, `${name} Learning Space`),
      makeImageUrl(1400, 920, "f3f6fb", color.fg, `${name} Student Life`),
      `https://drive.google.com/drive/folders/${slugify(`gallery-${slug}-folder`)}`,
    ];
    const videos = [
      VIDEO_LINKS[(index - 1) % VIDEO_LINKS.length],
      VIDEO_LINKS[index % VIDEO_LINKS.length],
    ];
    const phoneOne = `98${String(10000000 + index * 137).slice(0, 8)}`;
    const phoneTwo = `01-${String(400000 + index * 17).slice(0, 6)}`;
    const website = `www.${slug}.edu.np`;
    const email = `info@${slug}.edu.np`;
    const mapLat = Number((province.lat + ((index % 7) - 3) * 0.042).toFixed(6));
    const mapLng = Number((province.lng + ((index % 5) - 2) * 0.053).toFixed(6));
    const paymentMethod = ["Bank Transfer", "Cash", "eSewa", "Khalti"][index % 4];
    const paymentReference = `REF-${String(index).padStart(4, "0")}`;

    const subscription = {
      plan: plan.label,
      amount,
      currency: PLAN_CATALOG.currency,
      payment_method: paymentMethod,
      payment_reference: paymentReference,
      notes: `Demo ${plan.label} subscription for ${name}`,
      auto_renew: index % 2 === 0,
      paid_at: currentPaidAt,
      starts_at: currentStartsAt,
      expires_at: currentExpiresAt,
      payment_status: "active",
      last_updated_at: updatedAt,
    };

    const basic = {
      id: `biz-${String(index).padStart(3, "0")}`,
      slug,
      name,
      name_np: `Nepali ${name}`,
      type: template.type,
      level: template.level,
      field: template.field,
      affiliation: template.affiliation,
      district,
      province: provinceCode,
      is_verified: index % 3 !== 0,
      is_certified: false,
      tags: unique([
        ...template.tags,
        district.toLowerCase(),
        province.name.toLowerCase(),
      ]),
      logo,
      cover,
      subscription,
      updated_at: updatedAt,
      created_at: createdAt,
    };

    const detailed = {
      ...basic,
      description: `${name} is a fully populated demo listing created for search, filter, media, and payment testing. It includes academic offerings, facilities, social links, contact data, and active payment history so the entire directory flow can be exercised without manual entry.`,
      contact: {
        address: `Ward ${((index - 1) % 9) + 1}, ${street}, ${district}, ${province.name}, Nepal`,
        phone: [phoneOne, phoneTwo],
        email,
        website,
        map: {
          lat: mapLat,
          lng: mapLng,
        },
      },
      stats: {
        students: 350 + index * 21,
        faculty: 24 + (index % 11) * 4,
        rating: Number((3.8 + (index % 12) * 0.09).toFixed(1)),
        programs_count: template.programs.length,
      },
      media: {
        logo,
        cover,
        gallery,
        videos,
      },
      facilities: unique([
        ...template.facilities,
        "Student Counseling",
        "Scholarship Desk",
      ]),
      social: {
        facebook: `facebook.com/${slug}`,
        instagram: `instagram.com/${slug}`,
        youtube: `youtube.com/@${slug}`,
        twitter: `x.com/${slug}`,
      },
      programs: template.programs,
    };

    const paymentHistory = [
      {
        id: `pm${String(index).padStart(3, "0")}a`,
        slug,
        plan: plan.label,
        amount,
        currency: PLAN_CATALOG.currency,
        paid_at: previousPaidAt,
        starts_at: previousStartsAt,
        expires_at: previousExpiresAt,
        payment_method: paymentMethod,
        payment_reference: `${paymentReference}-A`,
        notes: `Initial ${plan.label} activation for ${name}`,
        created_at: previousPaidAt,
        updated_at: previousPaidAt,
      },
      {
        id: `pm${String(index).padStart(3, "0")}b`,
        slug,
        plan: plan.label,
        amount,
        currency: PLAN_CATALOG.currency,
        paid_at: currentPaidAt,
        starts_at: currentStartsAt,
        expires_at: currentExpiresAt,
        payment_method: paymentMethod,
        payment_reference: `${paymentReference}-B`,
        notes: `Active ${plan.label} renewal record for ${name}`,
        created_at: currentPaidAt,
        updated_at: updatedAt,
      },
    ];

    basics.push({ basic, detailed, paymentHistory });
  }

  return basics;
}

function main() {
  ensureDir(BASIC_DIR);
  ensureDir(DETAILED_DIR);
  ensureDir(PAYMENTS_DIR);

  resetDir(DETAILED_DIR);
  resetDir(PAYMENTS_DIR);

  const records = buildRecords();

  writeJson(
    BASIC_INDEX_FILE,
    records.map((record) => record.basic),
    false
  );

  for (const record of records) {
    writeJson(path.join(DETAILED_DIR, `${record.basic.slug}.json`), record.detailed, true);
    const paymentDir = path.join(PAYMENTS_DIR, record.basic.slug);
    ensureDir(paymentDir);
    for (const payment of record.paymentHistory) {
      writeJson(path.join(paymentDir, `${payment.id}.json`), payment, true);
    }
  }

  const paymentFileCount = records.reduce((total, record) => total + record.paymentHistory.length, 0);
  console.log(
    `Generated ${records.length} businesses, ${records.length} detailed files, and ${paymentFileCount} payment records.`
  );
}

main();

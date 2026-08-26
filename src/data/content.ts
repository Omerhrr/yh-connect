// YH Connect - static content and type definitions for the construction
// industry marketplace (architects, engineers, contractors, MEP, quantity
// surveyors and related trades).

export type Skill = {
  id: string;
  label: string;
  category: string;
};

export type Category = {
  id: string;
  label: string;
  icon: string;
};

// These ids must match the construction category taxonomy seeded by the
// FastAPI backend (backend/app/seed.py) so registration/project forms line up.
export const CATEGORIES: Category[] = [
  { id: "architecture", label: "Architecture", icon: "Building2" },
  { id: "civil-structural-engineering", label: "Civil & Structural Engineering", icon: "HardHat" },
  { id: "general-contracting", label: "General Contracting & Building", icon: "Construction" },
  { id: "mep-engineering", label: "MEP Engineering", icon: "Zap" },
  { id: "electrical", label: "Electrical Contractors", icon: "Plug" },
  { id: "plumbing", label: "Plumbing & HVAC", icon: "Wrench" },
  { id: "quantity-surveying", label: "Quantity Surveying", icon: "Calculator" },
  { id: "project-management", label: "Construction Project Management", icon: "ClipboardList" },
  { id: "interior-design", label: "Interior Design & Finishing", icon: "Sofa" },
  { id: "land-surveying", label: "Land Surveying & Geomatics", icon: "MapPinned" },
  { id: "hse-safety", label: "Health, Safety & Environment (HSE)", icon: "ShieldCheck" },
  { id: "masonry-carpentry", label: "Masonry, Carpentry & Skilled Trades", icon: "Hammer" },
];

export const SKILLS: Skill[] = [
  { id: "autocad", label: "AutoCAD", category: "Design & Drafting" },
  { id: "revit", label: "Revit / BIM", category: "Design & Drafting" },
  { id: "structural-analysis", label: "Structural Analysis", category: "Engineering" },
  { id: "structural-design", label: "Structural Design", category: "Engineering" },
  { id: "site-supervision", label: "Site Supervision", category: "Construction" },
  { id: "boq", label: "Bill of Quantities (BOQ)", category: "Quantity Surveying" },
  { id: "cost-estimation", label: "Cost Estimation", category: "Quantity Surveying" },
  { id: "electrical-installation", label: "Electrical Installation", category: "MEP" },
  { id: "plumbing-hvac", label: "Plumbing & HVAC", category: "MEP" },
  { id: "solar-power", label: "Solar & Power Systems", category: "MEP" },
  { id: "project-scheduling", label: "Project Scheduling", category: "Project Management" },
  { id: "contract-admin", label: "Contract Administration", category: "Project Management" },
  { id: "interior-fitout", label: "Interior Fit-Out", category: "Interior Design" },
  { id: "land-survey", label: "Land Surveying", category: "Surveying" },
  { id: "gis-mapping", label: "GIS & Mapping", category: "Surveying" },
  { id: "hse-compliance", label: "HSE Compliance", category: "Safety" },
  { id: "masonry", label: "Masonry", category: "Skilled Trades" },
  { id: "carpentry", label: "Carpentry", category: "Skilled Trades" },
  { id: "welding", label: "Welding & Fabrication", category: "Skilled Trades" },
  { id: "painting-finishing", label: "Painting & Finishing", category: "Skilled Trades" },
];

export const HOW_IT_WORKS_STEPS = [
  {
    step: "01",
    title: "Post Your Project",
    description:
      "Describe your build, from structural design to site supervision, set your budget, and publish it in minutes.",
    icon: "FileText",
  },
  {
    step: "02",
    title: "Review Bids",
    description:
      "Verified architects, engineers, and contractors send tailored bids. Browse profiles, licenses, and past work.",
    icon: "Users",
  },
  {
    step: "03",
    title: "Build & Pay Securely",
    description:
      "Track progress milestone by milestone. Funds are held in escrow and released as work is approved.",
    icon: "ShieldCheck",
  },
];

export const WHY_CHOOSE = [
  {
    title: "Verified Professionals",
    description:
      "Every architect, engineer, and contractor on YH Connect is verified for identity, licensing (e.g. COREN/ARCON), and experience.",
    icon: "BadgeCheck",
  },
  {
    title: "Secure Escrow Payments",
    description:
      "Funds are held in escrow per milestone and only released when you approve the work.",
    icon: "Lock",
  },
  {
    title: "Built for Construction",
    description:
      "Categories, workflows, and profiles designed specifically for architecture, engineering, and building trades, not generic freelancing.",
    icon: "HardHat",
  },
  {
    title: "24/7 Support",
    description:
      "Our support team is available around the clock to help resolve disputes and answer questions on-site or off.",
    icon: "HeadphonesIcon",
  },
];

export const CLIENT_BENEFITS = [
  "Access to verified architects, engineers, contractors, and trades",
  "Post unlimited projects for free",
  "Pay securely via escrow, milestone by milestone",
  "Built-in messaging and file sharing for drawings & documents",
  "Track site progress and project status in real time",
  "Money-back guarantee on failed deliveries",
];

export const TALENT_BENEFITS = [
  "Create a free professional profile with license/registration details",
  "Browse and bid on construction projects near you",
  "Showcase your portfolio of completed builds",
  "Get paid on time, every time, per milestone",
  "Build your reputation with verified client reviews",
  "Access training resources and safety guidelines",
];

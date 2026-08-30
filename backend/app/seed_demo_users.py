"""Seed the database with a large batch of realistic demo clients,
professionals (with working logins), and projects for local development /
demos.

Destructive + idempotent: each run wipes any previously seeded demo data
(scoped strictly to @pro.yhconnect.demo / @client.yhconnect.demo accounts and
anything hanging off them) and recreates it fresh, so re-running always
gives a clean, fully-populated dataset.

Run with: python -m app.seed_demo_users
All seeded accounts share the password printed at the end (also written to
demo_credentials.csv in the backend/ directory).
"""
import csv
import random
from datetime import date, datetime, timedelta

from sqlalchemy import text

from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.core.security import hash_password
from app.models.category import Category
from app.models.user import User, UserRole, KycStatus
from app.models.profile import ProfessionalProfile
from app.models.portfolio import PortfolioItem
from app.models.employment import EmploymentHistory
from app.models.education import Education
from app.models.certification import Certification
from app.models.project import Project, ProjectStatus, BudgetType
from app.models.bid import Bid, BidStatus
from app.models.review import Review

DEMO_PASSWORD = "YhConnect2026!"
PRO_DOMAIN = "pro.yhconnect.demo"
CLIENT_DOMAIN = "client.yhconnect.demo"

NIGERIAN_CITIES = [
    "Lagos", "Abuja", "Port Harcourt", "Ibadan", "Kano", "Enugu",
    "Benin City", "Kaduna", "Uyo", "Owerri", "Abeokuta", "Warri",
    "Calabar", "Jos", "Ilorin", "Asaba", "Onitsha", "Lekki, Lagos",
    "Victoria Island, Lagos", "Ikeja, Lagos",
]

MALE_FIRST_NAMES = [
    "Chinedu", "Emeka", "Oluwaseun", "Adewale", "Tunde", "Ibrahim", "Musa",
    "Abdullahi", "Chukwuma", "Femi", "Segun", "Kelechi", "Uche", "Yakubu",
    "Ayodele", "Obinna", "Nnamdi", "Kabiru", "Suleiman", "Damola",
    "Chidi", "Bashir", "Gbenga", "Ekene", "Tobenna", "Aminu", "Emmanuel",
    "Victor", "Samuel", "Godwin",
]

FEMALE_FIRST_NAMES = [
    "Ngozi", "Amaka", "Funmilayo", "Aisha", "Chiamaka", "Blessing",
    "Yetunde", "Halima", "Adaeze", "Folake", "Zainab", "Ifeoma",
    "Temitope", "Grace", "Chioma", "Hadiza", "Bukola", "Nkechi",
    "Rita", "Comfort", "Patience", "Maryam", "Simisola", "Ebele",
]

LAST_NAMES = [
    "Okafor", "Adeyemi", "Balogun", "Eze", "Abubakar", "Okonkwo",
    "Bello", "Nwosu", "Adebayo", "Yusuf", "Chukwu", "Musa", "Ogunleye",
    "Ibrahim", "Nwachukwu", "Okoro", "Aliyu", "Uzoma", "Fashola",
    "Ojo", "Danjuma", "Obi", "Sani", "Ekwueme", "Lawal", "Adeleke",
    "Okeke", "Umar", "Nwankwo", "Suleiman", "Igwe", "Afolabi",
    "Onyeka", "Garba", "Ademola", "Chinwe", "Ojukwu", "Idris",
]

COMPANY_SUFFIXES = ["Properties", "Estates", "Homes", "Developers", "Real Estate", "Ventures", "Living", "Group"]
COMPANY_PREFIXES = [
    "Skyline", "Horizon", "Golden Gate", "Palmview", "Ridgeway", "Sunrise",
    "Coral", "Emerald", "Prestige", "Lakeside", "Sterling", "Northshore",
    "Ivory", "Crestview", "Union", "Landmark", "Metro", "Bluewave",
    "Heritage", "Ecobuild",
]

NIGERIAN_UNIVERSITIES = [
    "University of Lagos", "Obafemi Awolowo University", "University of Nigeria, Nsukka",
    "Ahmadu Bello University", "University of Ibadan", "Covenant University",
    "Federal University of Technology, Akure", "University of Benin",
    "Federal University of Technology, Minna", "University of Port Harcourt",
    "Yaba College of Technology", "Lagos State Polytechnic",
]

DEGREES = ["B.Sc.", "B.Eng.", "HND", "M.Sc.", "B.Tech."]

LANGUAGE_POOL = ["English", "Yoruba", "Igbo", "Hausa", "Nigerian Pidgin", "French"]
LANGUAGE_LEVELS = ["Native", "Fluent", "Conversational"]

EMPLOYERS = [
    "Julius Berger Nigeria", "Costain West Africa", "Setraco Nigeria", "CCECC Nigeria",
    "Arbico Plc", "PW Nigeria", "Dantata & Sawoe", "Reynolds Construction",
    "Triacta Nigeria", "Craneburg Construction", "Bolands Construction",
    "Freelance / Independent Practice", "Lagos State Public Works Agency",
]

CATEGORY_PROFILES = {
    "architecture": (
        ["Principal Architect", "Building Architect", "Interior Architect", "Landscape Architect"],
        ["AutoCAD", "Revit", "SketchUp", "3ds Max", "Space Planning", "Master Planning", "BIM", "Lumion"],
        "Registered architect with {yrs} years designing residential and commercial buildings across Nigeria. "
        "Focused on functional, code-compliant designs that clients actually love living and working in.",
        "ARCON",
    ),
    "civil-structural-engineering": (
        ["Structural Engineer", "Civil Engineer", "Site Engineer", "Foundation Engineer"],
        ["Structural Analysis", "ETABS", "STAAD Pro", "Reinforced Concrete Design", "Steel Design", "Soil Testing", "AutoCAD"],
        "Structural/civil engineer with {yrs} years on residential, commercial and industrial projects. "
        "Strong on foundation design for Nigerian soil conditions and structural integrity sign-off.",
        "COREN",
    ),
    "general-contracting": (
        ["General Contractor", "Site Supervisor", "Construction Manager", "Building Contractor"],
        ["Site Management", "Building Construction", "Renovation", "Team Supervision", "Cost Control", "Scheduling"],
        "General contractor with {yrs} years delivering residential and commercial builds on time and on budget. "
        "Runs a reliable crew and keeps clients informed at every stage.",
        None,
    ),
    "mep-engineering": (
        ["MEP Engineer", "Mechanical Engineer", "Building Services Engineer"],
        ["HVAC Design", "Electrical Systems", "Plumbing Design", "Fire Safety Systems", "AutoCAD MEP", "Revit MEP"],
        "MEP engineer with {yrs} years designing and coordinating mechanical, electrical and plumbing "
        "systems for buildings of all sizes.",
        "COREN",
    ),
    "electrical": (
        ["Electrical Contractor", "Solar Installer", "Electrical Engineer", "Power Systems Technician"],
        ["Wiring & Installation", "Solar/Inverter Systems", "Power Distribution", "Generator Installation", "Panel Upgrades"],
        "Licensed electrical contractor with {yrs} years handling wiring, solar installations and power "
        "backup systems for homes and offices.",
        None,
    ),
    "plumbing": (
        ["Plumbing Contractor", "HVAC Technician", "Pipefitter", "Water Systems Specialist"],
        ["Pipe Installation", "Borehole & Water Systems", "AC Installation", "Drainage Systems", "Leak Detection"],
        "Plumbing and HVAC contractor with {yrs} years fitting water, drainage and air conditioning "
        "systems on residential and commercial sites.",
        None,
    ),
    "quantity-surveying": (
        ["Quantity Surveyor", "Cost Consultant", "Contracts Administrator"],
        ["BOQ Preparation", "Cost Estimation", "Contract Administration", "Tender Analysis", "Valuation"],
        "Registered quantity surveyor with {yrs} years preparing BOQs, managing costs and administering "
        "contracts to keep projects within budget.",
        "NIQS",
    ),
    "project-management": (
        ["Construction Project Manager", "Site Project Coordinator", "Program Manager"],
        ["Project Scheduling", "Site Coordination", "Risk Management", "Stakeholder Management", "MS Project", "Primavera"],
        "Construction project manager with {yrs} years coordinating multi-disciplinary teams from "
        "groundbreaking to handover.",
        None,
    ),
    "interior-design": (
        ["Interior Designer", "Fit-Out Specialist", "Furniture & Finishing Consultant"],
        ["Space Planning", "3D Rendering", "Material Selection", "Furniture Design", "Lighting Design"],
        "Interior designer with {yrs} years turning bare shells into finished, livable spaces for homes "
        "and offices across Nigeria.",
        None,
    ),
    "land-surveying": (
        ["Land Surveyor", "Geomatics Engineer", "GIS Specialist"],
        ["Land Survey", "GPS/GNSS Survey", "GIS Mapping", "Topographic Survey", "Boundary Demarcation"],
        "Licensed land surveyor with {yrs} years providing topographic, boundary and GIS mapping "
        "services for land and construction projects.",
        "SURCON",
    ),
    "hse-safety": (
        ["HSE Officer", "Site Safety Manager", "HSE Consultant"],
        ["Risk Assessment", "Site Safety Audits", "HSE Compliance", "Incident Investigation", "Permit to Work"],
        "HSE professional with {yrs} years keeping construction sites compliant and accident-free "
        "across residential and industrial projects.",
        None,
    ),
    "masonry-carpentry": (
        ["Master Mason", "Carpenter", "Welder & Fabricator", "Tiler", "Painter"],
        ["Block Work", "Woodwork & Joinery", "Welding & Fabrication", "Tiling", "Painting & Finishing"],
        "Skilled tradesperson with {yrs} years of hands-on masonry, carpentry and finishing work "
        "on residential and commercial sites.",
        None,
    ),
}

PORTFOLIO_TEMPLATES = [
    ("{city} 4-Bedroom Duplex", "Full delivery of a 4-bedroom duplex, from foundation to finishing."),
    ("{city} Office Fit-Out", "Complete fit-out of a 3-floor commercial office space."),
    ("{city} Estate Development", "Worked on a multi-unit residential estate development."),
    ("{city} Renovation Project", "Full renovation and upgrade of an existing residential property."),
    ("{city} Retail Complex", "Delivered structural and finishing work for a retail shopping complex."),
]

PROJECT_TEMPLATES = {
    "architecture": (
        ["{city} Residential Duplex Design", "{city} Office Building Concept & Working Drawings", "{city} Bungalow Renovation Design"],
        "Need a registered architect to produce full design drawings and building approval documentation for a "
        "new {kind} in {city}. Should include concept design, working drawings, and coordination with structural "
        "and MEP consultants.",
    ),
    "civil-structural-engineering": (
        ["{city} Structural Design & Analysis", "{city} Foundation Engineering for New Build", "{city} Structural Integrity Assessment"],
        "Looking for a structural engineer to handle structural analysis and design for a {kind} in {city}, "
        "including foundation design suited to local soil conditions and sign-off documentation.",
    ),
    "general-contracting": (
        ["{city} Full House Construction", "{city} Building Renovation & Upgrade", "{city} Turnkey Construction Project"],
        "Seeking an experienced general contractor to manage full construction of a {kind} in {city} from "
        "groundbreaking to handover, including sourcing materials and supervising trades.",
    ),
    "mep-engineering": (
        ["{city} MEP Design & Coordination", "{city} HVAC and Electrical Systems Design"],
        "Need an MEP engineer to design and coordinate mechanical, electrical and plumbing systems for a "
        "{kind} in {city}, ensuring code compliance and efficient system layout.",
    ),
    "electrical": (
        ["{city} Full Electrical Wiring & Installation", "{city} Solar & Inverter System Installation", "{city} Electrical Panel Upgrade"],
        "Looking for a licensed electrical contractor to handle wiring, panel installation and backup power "
        "for a {kind} in {city}.",
    ),
    "plumbing": (
        ["{city} Plumbing & Water Systems Installation", "{city} AC Installation & HVAC Fit-Out", "{city} Borehole & Drainage Works"],
        "Need a plumbing contractor to install water supply, drainage and air conditioning systems for a "
        "{kind} in {city}.",
    ),
    "quantity-surveying": (
        ["{city} Bill of Quantities Preparation", "{city} Cost Estimation & Contract Administration"],
        "Seeking a quantity surveyor to prepare a full BOQ and manage cost estimation and contract "
        "administration for a {kind} in {city}.",
    ),
    "project-management": (
        ["{city} Construction Project Management", "{city} Site Coordination for Multi-Trade Build"],
        "Need an experienced construction project manager to coordinate contractors and keep a {kind} build "
        "in {city} on schedule and within budget.",
    ),
    "interior-design": (
        ["{city} Interior Design & Fit-Out", "{city} Office Interior Styling", "{city} Home Interior Makeover"],
        "Looking for an interior designer to plan and execute the interior fit-out and finishing for a "
        "{kind} in {city}.",
    ),
    "land-surveying": (
        ["{city} Land Survey & Boundary Demarcation", "{city} Topographic Survey for New Development"],
        "Need a licensed land surveyor to carry out a topographic and boundary survey ahead of development "
        "of a {kind} in {city}.",
    ),
    "hse-safety": (
        ["{city} Site HSE Compliance & Audits", "{city} Construction Safety Management"],
        "Seeking an HSE professional to manage site safety compliance and audits throughout construction of a "
        "{kind} in {city}.",
    ),
    "masonry-carpentry": (
        ["{city} Block Work & Masonry", "{city} Custom Carpentry & Finishing", "{city} Tiling & Painting Works"],
        "Need skilled tradespeople for masonry, carpentry and finishing work on a {kind} in {city}.",
    ),
}

PROJECT_KINDS = [
    "residential duplex", "3-bedroom bungalow", "commercial office building",
    "retail shop complex", "residential estate", "warehouse facility",
    "short-let apartment block", "family home renovation",
]

def rand_phone() -> str:
    return f"+234{random.choice(['80','81','70','90','91'])}{random.randint(10000000, 99999999)}"

def pick_name(rng) -> tuple[str, str]:
    first = rng.choice(MALE_FIRST_NAMES + FEMALE_FIRST_NAMES)
    last = rng.choice(LAST_NAMES)
    return first, last

def slugify_email(first: str, last: str, n: int, domain: str) -> str:
    return f"{first.lower()}.{last.lower()}{n}@{domain}"

def wipe_demo_data(db) -> None:
    """Remove any previously seeded demo accounts and everything hanging off
    them (projects, bids, reviews, profiles, etc.), scoped strictly to
    @pro.yhconnect.demo / @client.yhconnect.demo emails so real accounts are
    never touched. SQLite FKs aren't enforced in this app, so plain deletes
    in a sensible order are enough (no PRAGMA foreign_keys juggling needed).
    """
    demo_email_filter = f"(email LIKE '%@{PRO_DOMAIN}' OR email LIKE '%@{CLIENT_DOMAIN}')"

    db.execute(text(f"""
        DELETE FROM milestone_updates WHERE milestone_id IN (
            SELECT m.id FROM milestones m JOIN projects p ON m.project_id = p.id
            JOIN users u ON p.client_id = u.id WHERE {demo_email_filter.replace('email', 'u.email')}
        )
    """))
    db.execute(text(f"""
        DELETE FROM wallet_transactions WHERE project_id IN (
            SELECT p.id FROM projects p JOIN users u ON p.client_id = u.id WHERE {demo_email_filter.replace('email', 'u.email')}
        )
    """))
    db.execute(text(f"""
        DELETE FROM messages WHERE project_id IN (
            SELECT p.id FROM projects p JOIN users u ON p.client_id = u.id WHERE {demo_email_filter.replace('email', 'u.email')}
        ) OR sender_id IN (SELECT id FROM users WHERE {demo_email_filter}) OR recipient_id IN (SELECT id FROM users WHERE {demo_email_filter})
    """))
    db.execute(text(f"""
        DELETE FROM reviews WHERE project_id IN (
            SELECT p.id FROM projects p JOIN users u ON p.client_id = u.id WHERE {demo_email_filter.replace('email', 'u.email')}
        )
    """))
    db.execute(text(f"""
        DELETE FROM disputes WHERE project_id IN (
            SELECT p.id FROM projects p JOIN users u ON p.client_id = u.id WHERE {demo_email_filter.replace('email', 'u.email')}
        )
    """))
    db.execute(text(f"""
        DELETE FROM project_reports WHERE project_id IN (
            SELECT p.id FROM projects p JOIN users u ON p.client_id = u.id WHERE {demo_email_filter.replace('email', 'u.email')}
        )
    """))
    db.execute(text(f"""
        DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE {demo_email_filter})
    """))
    db.execute(text(f"""
        DELETE FROM password_reset_tokens WHERE user_id IN (SELECT id FROM users WHERE {demo_email_filter})
    """))
    db.execute(text(f"""
        DELETE FROM favorites WHERE user_id IN (SELECT id FROM users WHERE {demo_email_filter})
    """))
    db.execute(text(f"""
        DELETE FROM project_invites WHERE project_id IN (
            SELECT p.id FROM projects p JOIN users u ON p.client_id = u.id WHERE {demo_email_filter.replace('email', 'u.email')}
        ) OR professional_id IN (SELECT id FROM users WHERE {demo_email_filter})
    """))
    db.execute(text(f"""
        DELETE FROM bids WHERE project_id IN (
            SELECT p.id FROM projects p JOIN users u ON p.client_id = u.id WHERE {demo_email_filter.replace('email', 'u.email')}
        ) OR professional_id IN (SELECT id FROM users WHERE {demo_email_filter})
    """))
    db.execute(text("""
        DELETE FROM change_orders WHERE project_id IN (
            SELECT p.id FROM projects p JOIN users u ON p.client_id = u.id WHERE (u.email LIKE '%@pro.yhconnect.demo' OR u.email LIKE '%@client.yhconnect.demo')
        )
    """))
    db.execute(text("""
        DELETE FROM milestones WHERE project_id IN (
            SELECT p.id FROM projects p JOIN users u ON p.client_id = u.id WHERE (u.email LIKE '%@pro.yhconnect.demo' OR u.email LIKE '%@client.yhconnect.demo')
        )
    """))
    db.execute(text(f"""
        DELETE FROM projects WHERE client_id IN (SELECT id FROM users WHERE {demo_email_filter})
    """))
    db.execute(text(f"""
        DELETE FROM employment_history WHERE profile_id IN (
            SELECT pr.id FROM professional_profiles pr JOIN users u ON pr.user_id = u.id WHERE {demo_email_filter.replace('email', 'u.email')}
        )
    """))
    db.execute(text(f"""
        DELETE FROM educations WHERE profile_id IN (
            SELECT pr.id FROM professional_profiles pr JOIN users u ON pr.user_id = u.id WHERE {demo_email_filter.replace('email', 'u.email')}
        )
    """))
    db.execute(text(f"""
        DELETE FROM certifications WHERE profile_id IN (
            SELECT pr.id FROM professional_profiles pr JOIN users u ON pr.user_id = u.id WHERE {demo_email_filter.replace('email', 'u.email')}
        )
    """))
    db.execute(text(f"""
        DELETE FROM portfolio_items WHERE profile_id IN (
            SELECT pr.id FROM professional_profiles pr JOIN users u ON pr.user_id = u.id WHERE {demo_email_filter.replace('email', 'u.email')}
        )
    """))
    db.execute(text(f"""
        DELETE FROM professional_profiles WHERE user_id IN (SELECT id FROM users WHERE {demo_email_filter})
    """))
    db.execute(text(f"DELETE FROM users WHERE {demo_email_filter}"))
    db.commit()

def seed_professionals(db, categories: list[Category], rng: random.Random, password_hash: str, per_category: int = 4) -> tuple[list[dict], dict[str, list[User]]]:
    created = []
    pros_by_category: dict[str, list[User]] = {}
    n = 0
    for cat in categories:
        titles, skills_pool, bio_template, license_prefix = CATEGORY_PROFILES.get(
            cat.id, (["Professional"], ["General"], "Experienced professional with {yrs} years in the field.", None)
        )
        pros_by_category[cat.id] = []
        for i in range(per_category):
            n += 1
            first, last = pick_name(rng)
            email = slugify_email(first, last, n, PRO_DOMAIN)

            title = rng.choice(titles)
            yrs = rng.choice([2, 3, 4, 5, 6, 8, 10, 12, 15])
            skills = rng.sample(skills_pool, k=min(4, len(skills_pool)))
            city = rng.choice(NIGERIAN_CITIES)
            rate = rng.choice([8000, 10000, 12000, 15000, 18000, 20000, 25000, 30000, 40000])
            verification = rng.choices(
                ["verified", "pending", "unverified"], weights=[70, 20, 10], k=1
            )[0]
            rating = round(rng.uniform(3.8, 5.0), 1) if verification == "verified" else 0.0
            review_count = rng.randint(3, 40) if verification == "verified" else 0

            langs = rng.sample(LANGUAGE_POOL, k=rng.randint(1, 3))
            if "English" not in langs:
                langs[0] = "English"
            lang_pairs = []
            for idx, lang in enumerate(langs):
                level = "Native" if idx == 0 else rng.choice(LANGUAGE_LEVELS)
                lang_pairs.append(f"{lang}:{level}")

            user = User(
                email=email,
                hashed_password=password_hash,
                first_name=first,
                last_name=last,
                phone=rand_phone(),
                role=UserRole.professional,
                is_active=True,
                is_verified=True,
                email_verified_at=datetime.utcnow(),
                kyc_status=KycStatus.verified,
                kyc_verified_at=datetime.utcnow(),
                created_at=datetime.utcnow() - timedelta(days=rng.randint(30, 1100)),
            )
            db.add(user)
            db.flush()

            license_number = f"{license_prefix}/{rng.randint(10000,99999)}" if license_prefix else None

            profile = ProfessionalProfile(
                user_id=user.id,
                title=title,
                category_id=cat.id,
                bio=bio_template.format(yrs=yrs),
                location=city,
                hourly_rate=float(rate),
                years_experience=str(yrs),
                availability=rng.choices(["available", "busy"], weights=[80, 20], k=1)[0],
                skills=",".join(skills),
                license_number=license_number,
                is_verified=verification == "verified",
                rating=rating,
                review_count=review_count,
                service_locations=city,
                verification_status=verification,
                languages=",".join(lang_pairs),
            )
            db.add(profile)
            db.flush()

            if verification == "verified":
                for pt_title, pt_desc in rng.sample(PORTFOLIO_TEMPLATES, k=rng.randint(1, 2)):
                    db.add(PortfolioItem(
                        profile_id=profile.id,
                        title=pt_title.format(city=city),
                        description=pt_desc,
                        completed_date=date.today() - timedelta(days=rng.randint(30, 900)),
                    ))

            n_jobs = rng.randint(1, 3)
            cursor_year_offset = 0
            for j in range(n_jobs):
                job_len = rng.randint(1, 5)
                end_offset = cursor_year_offset
                start_offset = end_offset + job_len
                is_current = j == 0 and rng.random() < 0.6
                db.add(EmploymentHistory(
                    profile_id=profile.id,
                    title=rng.choice(titles),
                    employer=rng.choice(EMPLOYERS),
                    start_date=date.today() - timedelta(days=365 * start_offset),
                    end_date=None if is_current else date.today() - timedelta(days=365 * end_offset),
                    description="Delivered projects across residential and commercial sites, working closely with clients and site teams.",
                    sort_order=j,
                ))
                cursor_year_offset = start_offset

            for e in range(rng.randint(1, 2)):
                grad_year = date.today().year - yrs - rng.randint(0, 3)
                db.add(Education(
                    profile_id=profile.id,
                    school=rng.choice(NIGERIAN_UNIVERSITIES),
                    degree=rng.choice(DEGREES),
                    field_of_study=cat.label,
                    start_year=grad_year - 4,
                    end_year=grad_year,
                    sort_order=e,
                ))

            if verification == "verified":
                if license_prefix:
                    issued = date.today() - timedelta(days=365 * rng.randint(1, 8))
                    db.add(Certification(
                        profile_id=profile.id,
                        name=f"{license_prefix} Registration",
                        issuing_body=license_prefix,
                        issued_date=issued,
                        expiry_date=None,
                        sort_order=0,
                    ))
                if rng.random() < 0.4:
                    db.add(Certification(
                        profile_id=profile.id,
                        name="Occupational Health & Safety Certificate",
                        issuing_body="Nigerian Institute of Safety Professionals",
                        issued_date=date.today() - timedelta(days=365 * rng.randint(1, 5)),
                        expiry_date=None,
                        sort_order=1,
                    ))

            pros_by_category[cat.id].append(user)
            created.append({
                "role": "professional",
                "name": f"{first} {last}",
                "email": email,
                "password": DEMO_PASSWORD,
                "title": title,
                "category": cat.label,
                "location": city,
            })
    return created, pros_by_category

def seed_clients(db, rng: random.Random, password_hash: str, count: int = 20) -> list[dict]:
    created = []
    client_users: list[User] = []
    for i in range(1, count + 1):
        first, last = pick_name(rng)
        email = slugify_email(first, last, i, CLIENT_DOMAIN)

        is_business = rng.random() < 0.55
        company_name = None
        industry = None
        if is_business:
            company_name = f"{rng.choice(COMPANY_PREFIXES)} {rng.choice(COMPANY_SUFFIXES)}"
            industry = rng.choice(["Real Estate Development", "Property Management", "Hospitality", "Retail", "Facilities Management"])

        user = User(
            email=email,
            hashed_password=password_hash,
            first_name=first,
            last_name=last,
            phone=rand_phone(),
            role=UserRole.client,
            company_name=company_name,
            industry=industry,
            is_verified_business=is_business and rng.random() < 0.6,
            is_active=True,
            is_verified=True,
            email_verified_at=datetime.utcnow(),
            kyc_status=KycStatus.verified,
            kyc_verified_at=datetime.utcnow(),
            nin=str(rng.randint(10000000000, 99999999999)),
            created_at=datetime.utcnow() - timedelta(days=rng.randint(30, 1100)),
        )
        db.add(user)
        db.flush()
        client_users.append(user)

        created.append({
            "role": "client",
            "name": f"{first} {last}",
            "email": email,
            "password": DEMO_PASSWORD,
            "company": company_name or "",
            "location": rng.choice(NIGERIAN_CITIES),
        })
    return created, client_users

def seed_projects(db, rng: random.Random, categories: list[Category], client_users: list[User], pros_by_category: dict[str, list[User]]) -> int:
    """Post projects from demo clients, with bids/assignments/reviews so the
    marketplace (find-work, job detail, professional work history, client
    trust stats) has real, varied data to show instead of empty states."""
    n_projects = 0
    status_weights = [
        (ProjectStatus.open, 40),
        (ProjectStatus.in_progress, 20),
        (ProjectStatus.review, 8),
        (ProjectStatus.completed, 27),
        (ProjectStatus.cancelled, 5),
    ]
    statuses = [s for s, _ in status_weights]
    weights = [w for _, w in status_weights]

    for client in client_users:
        for _ in range(rng.randint(1, 4)):
            cat = rng.choice(categories)
            titles, desc_template = PROJECT_TEMPLATES.get(
                cat.id, (["{city} Construction Project"], "General construction work needed for a {kind} in {city}.")
            )
            city = rng.choice(NIGERIAN_CITIES)
            kind = rng.choice(PROJECT_KINDS)
            title = rng.choice(titles).format(city=city)
            description = desc_template.format(city=city, kind=kind)
            budget_type = rng.choices([BudgetType.fixed, BudgetType.hourly], weights=[75, 25], k=1)[0]
            base = rng.choice([150000, 250000, 400000, 600000, 900000, 1500000, 2500000, 4000000])
            budget_min = float(base)
            budget_max = float(round(base * rng.uniform(1.2, 1.8)))
            status = rng.choices(statuses, weights=weights, k=1)[0]
            skills_pool = CATEGORY_PROFILES.get(cat.id, (None, ["General"], None, None))[1]
            skills = rng.sample(skills_pool, k=min(3, len(skills_pool)))
            created_days_ago = rng.randint(1, 400)

            project = Project(
                client_id=client.id,
                category_id=cat.id,
                title=title,
                description=description,
                location=city,
                budget_min=budget_min,
                budget_max=budget_max,
                budget_type=budget_type,
                skills=",".join(skills),
                status=status,
                created_at=datetime.utcnow() - timedelta(days=created_days_ago),
            )

            candidates = pros_by_category.get(cat.id, [])

            if status == ProjectStatus.open:
                project.progress = 0
                db.add(project)
                db.flush()

                bidders = rng.sample(candidates, k=min(len(candidates), rng.randint(0, 4)))
                for pro in bidders:
                    db.add(Bid(
                        project_id=project.id,
                        professional_id=pro.id,
                        amount=round(rng.uniform(budget_min, budget_max)),
                        cover_letter="I'd love to take this on, happy to share references from similar work.",
                        estimated_days=rng.randint(7, 60),
                        status=rng.choices(
                            [BidStatus.pending, BidStatus.shortlisted, BidStatus.rejected],
                            weights=[70, 20, 10], k=1
                        )[0],
                        created_at=project.created_at + timedelta(days=rng.randint(0, min(created_days_ago, 5))),
                    ))
            elif status == ProjectStatus.cancelled:
                project.progress = 0
                db.add(project)
                db.flush()
            else:

                if not candidates:
                    project.status = ProjectStatus.open
                    project.progress = 0
                    db.add(project)
                    db.flush()
                else:
                    pro = rng.choice(candidates)
                    project.assigned_professional_id = pro.id
                    project.progress = {
                        ProjectStatus.in_progress: rng.choice([20, 35, 50, 65]),
                        ProjectStatus.review: 90,
                        ProjectStatus.completed: 100,
                    }[status]
                    accepted_amount = round(rng.uniform(budget_min, budget_max))
                    if status == ProjectStatus.completed:
                        project.completed_at = project.created_at + timedelta(days=rng.randint(10, 90))
                    db.add(project)
                    db.flush()

                    db.add(Bid(
                        project_id=project.id,
                        professional_id=pro.id,
                        amount=accepted_amount,
                        cover_letter="I'd love to take this on, happy to share references from similar work.",
                        estimated_days=rng.randint(7, 60),
                        status=BidStatus.accepted,
                        created_at=project.created_at + timedelta(days=1),
                    ))

                    other_candidates = [p for p in candidates if p.id != pro.id]
                    for other in rng.sample(other_candidates, k=min(len(other_candidates), rng.randint(0, 2))):
                        db.add(Bid(
                            project_id=project.id,
                            professional_id=other.id,
                            amount=round(rng.uniform(budget_min, budget_max)),
                            status=BidStatus.rejected,
                            created_at=project.created_at + timedelta(days=1),
                        ))

                    if status == ProjectStatus.completed and rng.random() < 0.75:
                        rating = rng.choices([5, 4, 3], weights=[60, 30, 10], k=1)[0]
                        comments = [
                            "Great work, delivered on time and communicated well throughout.",
                            "Solid job, would hire again for future projects.",
                            "Professional and thorough, handled a few site issues smoothly.",
                            "Good quality work, took a bit longer than expected but worth it.",
                        ]
                        db.add(Review(
                            project_id=project.id,
                            reviewer_id=client.id,
                            reviewee_id=pro.id,
                            rating=rating,
                            comment=rng.choice(comments),
                            created_at=project.completed_at or project.created_at,
                        ))

            n_projects += 1
    return n_projects

def run(seed: int = 42):
    Base.metadata.create_all(bind=engine)
    rng = random.Random(seed)
    db = SessionLocal()
    try:
        categories = db.query(Category).all()
        if not categories:
            print("No categories found, run `python -m app.seed` first.")
            return

        print("Wiping previously seeded demo data...")
        wipe_demo_data(db)

        password_hash = hash_password(DEMO_PASSWORD)
        pros, pros_by_category = seed_professionals(db, categories, rng, password_hash, per_category=4)
        clients, client_users = seed_clients(db, rng, password_hash, count=20)
        db.commit()

        n_projects = seed_projects(db, rng, categories, client_users, pros_by_category)
        db.commit()

        all_rows = clients + pros
        out_path = "demo_credentials.csv"
        with open(out_path, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=["role", "name", "email", "password", "title", "category", "company", "location"])
            writer.writeheader()
            for row in all_rows:
                writer.writerow({k: row.get(k, "") for k in writer.fieldnames})

        print(f"Seeded {len(clients)} clients, {len(pros)} professionals, and {n_projects} projects.")
        print(f"All accounts share password: {DEMO_PASSWORD}")
        print(f"Credentials written to backend/{out_path}")
    finally:
        db.close()

if __name__ == "__main__":
    run()

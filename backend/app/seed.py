"""Seed the database with the construction category taxonomy.
Run with: python -m app.seed
"""
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.category import Category
import app.models

CATEGORIES = [
    ("architecture", "Architecture", "Building2", "Building & landscape architects, interior architects"),
    ("civil-structural-engineering", "Civil & Structural Engineering", "HardHat", "Structural design, civil works, site engineering"),
    ("general-contracting", "General Contracting & Building", "Construction", "General contractors, builders, site supervisors"),
    ("mep-engineering", "MEP Engineering", "Zap", "Mechanical, electrical & plumbing design and installation"),
    ("electrical", "Electrical Contractors", "Plug", "Electrical installation, wiring, solar & power systems"),
    ("plumbing", "Plumbing & HVAC", "Wrench", "Plumbing, heating, ventilation & air conditioning"),
    ("quantity-surveying", "Quantity Surveying", "Calculator", "Cost estimation, BOQs, contract administration"),
    ("project-management", "Construction Project Management", "ClipboardList", "Project & site management, scheduling"),
    ("interior-design", "Interior Design & Finishing", "Sofa", "Interior design, fit-out, finishing works"),
    ("land-surveying", "Land Surveying & Geomatics", "MapPinned", "Land surveying, mapping, GIS"),
    ("hse-safety", "Health, Safety & Environment (HSE)", "ShieldCheck", "Site safety officers, HSE compliance"),
    ("masonry-carpentry", "Masonry, Carpentry & Skilled Trades", "Hammer", "Masons, carpenters, welders, tilers, painters"),
]

def run():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        for cid, label, icon, desc in CATEGORIES:
            if not db.get(Category, cid):
                db.add(Category(id=cid, label=label, icon=icon, description=desc))
        db.commit()
        print(f"Seeded {len(CATEGORIES)} construction categories.")
    finally:
        db.close()

if __name__ == "__main__":
    run()

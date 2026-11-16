
from app.database import engine, SessionLocal, Base
from app.models import Dam, WaterQualityRecord, UploadHistory

# Create all database tables
Base.metadata.create_all(bind=engine)

print("Database tables created successfully!")

# Insert the five dams
db = SessionLocal()

dams = [
    {
        "dam_code": "mettur",
        "name": "Mettur Dam",
        "district": "Salem",
        "river": "Cauvery"
    },
    {
        "dam_code": "bhavanisagar",
        "name": "Bhavanisagar Dam",
        "district": "Erode",
        "river": "Bhavani"
    },
    {
        "dam_code": "vaigai",
        "name": "Vaigai Dam",
        "district": "Theni",
        "river": "Vaigai"
    },
    {
        "dam_code": "papanasam",
        "name": "Papanasam Dam",
        "district": "Tirunelveli",
        "river": "Thamirabarani"
    },
    {
        "dam_code": "sathanur",
        "name": "Sathanur Dam",
        "district": "Tiruvannamalai",
        "river": "Thenpennai"
    }
]

try:
    for dam_data in dams:
        existing_dam = db.query(Dam).filter_by(
            dam_code=dam_data["dam_code"]
        ).first()

        if not existing_dam:
            db.add(Dam(**dam_data))

    db.commit()
    print("Five dams inserted successfully!")

    print("\nDatabase contents:")
    for dam in db.query(Dam).all():
        print(dam.name, "-", dam.district)

finally:
    db.close()


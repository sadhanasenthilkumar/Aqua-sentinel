import csv
from pathlib import Path

from app.database import Base, engine, SessionLocal
from app.models import ReservoirReading


# File locations
BASE_DIR = Path(__file__).resolve().parent
CSV_FILE = BASE_DIR / "reservoir_daily.csv"

# Only import these five dams
TARGET_DAMS = [
    "mettur",
    "bhavanisagar",
    "vaigai",
    "papanasam",
    "sathanur"
]

NUMERIC_FIELDS = [
    "full_depth_ft",
    "capacity_mcft",
    "level_ft",
    "storage_mcft",
    "inflow_cusecs",
    "outflow_cusecs",
    "last_year_level_ft",
    "last_year_storage_mcft"
]


def to_float(value):
    """Convert CSV values to float safely."""
    if value is None or value.strip() == "":
        return None

    try:
        return float(value)
    except ValueError:
        return None


def import_data():

    if not CSV_FILE.exists():
        print("ERROR: reservoir_daily.csv not found!")
        return

    # Create the new table if it does not exist.
    # Existing database tables and records are preserved.
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()

    try:
        # Find records already imported.
        existing_records = set(
            db.query(
                ReservoirReading.date,
                ReservoirReading.reservoir_slug
            ).all()
        )

        imported_counts = {
            dam: 0 for dam in TARGET_DAMS
        }

        skipped = 0
        batch = []
        seen_in_file = set()

        with open(
            CSV_FILE,
            "r",
            encoding="utf-8-sig",
            newline=""
        ) as file:

            reader = csv.DictReader(file)

            required_columns = [
                "date",
                "reservoir_slug",
                "reservoir"
            ]

            if not reader.fieldnames or not all(
                column in reader.fieldnames
                for column in required_columns
            ):
                raise ValueError("CSV columns are missing or invalid.")

            for row in reader:

                slug = row["reservoir_slug"].strip().lower()
                date = row["date"].strip()

                if slug not in TARGET_DAMS:
                    continue

                if not date:
                    skipped += 1
                    continue

                record_key = (date, slug)

                # Avoid duplicates in the database or CSV itself.
                if (
                    record_key in existing_records
                    or record_key in seen_in_file
                ):
                    skipped += 1
                    continue

                seen_in_file.add(record_key)

                values = {
                    field: to_float(row.get(field))
                    for field in NUMERIC_FIELDS
                }

                reading = ReservoirReading(
                    date=date,
                    reservoir_slug=slug,
                    reservoir=row.get("reservoir"),
                    source_updated=row.get("source_updated"),
                    **values
                )

                batch.append(reading)
                imported_counts[slug] += 1

                if len(batch) >= 500:
                    db.add_all(batch)
                    db.commit()
                    batch.clear()

        # Insert remaining records.
        if batch:
            db.add_all(batch)
            db.commit()

        print("\nIMPORT COMPLETED")
        print("---------------------------")

        total_imported = sum(imported_counts.values())

        for dam, count in imported_counts.items():
            print(f"{dam}: {count} records")

        print("---------------------------")
        print("TOTAL IMPORTED:", total_imported)
        print("SKIPPED:", skipped)

        total_in_database = (
            db.query(ReservoirReading).count()
        )

        print("TOTAL DATABASE RECORDS:", total_in_database)

        date_range = db.query(
            ReservoirReading.date
        ).all()

        dates = [item[0] for item in date_range]

        if dates:
            print("DATABASE DATE RANGE:")
            print(min(dates), "to", max(dates))

    except Exception as error:
        db.rollback()
        print("IMPORT FAILED:", error)

    finally:
        db.close()


if __name__ == "__main__":
    import_data()
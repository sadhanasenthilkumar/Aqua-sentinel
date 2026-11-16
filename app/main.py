import csv
from datetime import datetime
import shutil
import uuid
from pathlib import Path
from io import StringIO

from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.database import Base, engine, get_db
from app.models import (
    Dam,
    WaterQualityRecord,
    UploadHistory,
    ReservoirReading
)
from app.services.rainfall_service import (
    DAMS,
    get_rainfall,
    get_all_dams_rainfall,
    get_rainfall_history
)


# Create database tables
Base.metadata.create_all(bind=engine)


# Application
app = FastAPI(
    title="Aqua Sentinel API",
    description="Dam Monitoring and Public Water Intelligence System",
    version="3.3.0"
)


# CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Folders
BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


# Supported reservoir slugs
RESERVOIR_SLUGS = [
    "mettur",
    "bhavanisagar",
    "vaigai",
    "papanasam",
    "sathanur"
]


DATA_SOURCE = (
    "TamilNaduData reservoir_daily.csv; "
    "dataset attribution to Tamil Nadu Agriculture Department (AGRISNET)"
)


def reservoir_to_dict(record):
    return {
        "id": record.id,
        "date": record.date,
        "reservoir_slug": record.reservoir_slug,
        "reservoir": record.reservoir,
        "full_depth_ft": record.full_depth_ft,
        "capacity_mcft": record.capacity_mcft,
        "level_ft": record.level_ft,
        "storage_mcft": record.storage_mcft,
        "inflow_cusecs": record.inflow_cusecs,
        "outflow_cusecs": record.outflow_cusecs,
        "last_year_level_ft": record.last_year_level_ft,
        "last_year_storage_mcft": record.last_year_storage_mcft,
        "source_updated": record.source_updated,
        "source": record.source or DATA_SOURCE,
        "data_type": "Historical dataset - not live telemetry"
    }


@app.get("/")
def home():
    return {"message": "Welcome to Aqua Sentinel API"}


@app.get("/api/health")
def health():
    return {
        "status": "healthy",
        "project": "Aqua Sentinel"
    }


# ---------------- RAINFALL APIs ----------------

# Keep /all before /{reservoir_slug} so "all" is handled correctly.
@app.get("/api/rainfall/all")
def rainfall_all():
    return {
        "total_dams": len(DAMS),
        "source": "Open-Meteo",
        "data_type": (
            "Weather model estimates, not rain-gauge observations"
        ),
        "data": get_all_dams_rainfall()
    }


@app.get("/api/rainfall/{reservoir_slug}")
def rainfall_by_dam(reservoir_slug: str):
    slug = reservoir_slug.lower()

    if slug not in DAMS:
        raise HTTPException(
            status_code=404,
            detail=(
                "Dam not found. Use mettur, bhavanisagar, "
                "vaigai, papanasam or sathanur."
            )
        )

    dam = DAMS[slug]

    try:
        weather = get_rainfall(
            dam["latitude"],
            dam["longitude"]
        )
    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail=f"Rainfall service temporarily unavailable: {error}"
        )

    return {
        "reservoir_slug": slug,
        "dam": dam["name"],
        "district": dam["district"],
        "coordinates": {
            "latitude": dam["latitude"],
            "longitude": dam["longitude"]
        },
        "source": "Open-Meteo",
        "data_type": (
            "Weather model estimate, not rain-gauge observation"
        ),
        "current": weather.get("current"),
        "daily_forecast": weather.get("daily")
    }


@app.get("/api/rainfall/{reservoir_slug}/history")
def rainfall_history(
    reservoir_slug: str,
    days: int = Query(default=30, ge=1, le=365)
):
    slug = reservoir_slug.lower()

    if slug not in DAMS:
        raise HTTPException(status_code=404, detail="Dam not found")

    dam = DAMS[slug]

    try:
        history = get_rainfall_history(
            dam["latitude"], dam["longitude"], days=days
        )
    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail=f"Rainfall history service temporarily unavailable: {error}"
        )

    return {
        "reservoir_slug": slug,
        "dam": dam["name"],
        "days_requested": days,
        "source": "Open-Meteo Archive API",
        "data_type": "Historical weather-model estimates, not rain-gauge observations",
        "history": history
    }


# ---------------- DAM APIs ----------------

@app.get("/api/dams")
def get_dams(db: Session = Depends(get_db)):
    dams = db.query(Dam).all()

    return [
        {
            "id": dam.id,
            "dam_code": dam.dam_code,
            "name": dam.name,
            "district": dam.district,
            "river": dam.river
        }
        for dam in dams
    ]


@app.get("/api/dams/compare")
def compare_dams(db: Session = Depends(get_db)):
    dams = db.query(Dam).all()

    return {
        "total_dams": len(dams),
        "dams": [
            {
                "name": dam.name,
                "district": dam.district,
                "river": dam.river
            }
            for dam in dams
        ]
    }


@app.get("/api/dams/{dam_id}")
def get_dam(dam_id: int, db: Session = Depends(get_db)):
    dam = db.query(Dam).filter(Dam.id == dam_id).first()

    if not dam:
        raise HTTPException(
            status_code=404,
            detail="Dam not found"
        )

    return {
        "id": dam.id,
        "dam_code": dam.dam_code,
        "name": dam.name,
        "district": dam.district,
        "river": dam.river
    }


# ---------------- RESERVOIR APIs ----------------

@app.get("/api/reservoirs/latest")
def get_all_latest_reservoirs(db: Session = Depends(get_db)):
    """Get the latest available historical record for each of the five dams."""

    results = []

    for slug in RESERVOIR_SLUGS:
        record = (
            db.query(ReservoirReading)
            .filter(ReservoirReading.reservoir_slug == slug)
            .order_by(ReservoirReading.date.desc())
            .first()
        )

        if record:
            results.append(reservoir_to_dict(record))

    return {
        "total_reservoirs": len(results),
        "data_type": "Latest available historical dataset records; not live readings",
        "reservoirs": results
    }


@app.get("/api/reservoirs/{reservoir_slug}/latest")
def get_reservoir_latest(
    reservoir_slug: str,
    db: Session = Depends(get_db)
):
    """Get the latest available record for one reservoir."""

    slug = reservoir_slug.lower()

    if slug not in RESERVOIR_SLUGS:
        raise HTTPException(
            status_code=404,
            detail=(
                "Reservoir not found. Use mettur, bhavanisagar, "
                "vaigai, papanasam or sathanur."
            )
        )

    record = (
        db.query(ReservoirReading)
        .filter(ReservoirReading.reservoir_slug == slug)
        .order_by(ReservoirReading.date.desc())
        .first()
    )

    if not record:
        raise HTTPException(
            status_code=404,
            detail="No reservoir records available"
        )

    return reservoir_to_dict(record)


@app.get("/api/reservoirs/{reservoir_slug}/history")
def get_reservoir_history(
    reservoir_slug: str,
    limit: int = Query(default=590, ge=1, le=590),
    db: Session = Depends(get_db)
):
    """Get historical records for a reservoir."""

    slug = reservoir_slug.lower()

    if slug not in RESERVOIR_SLUGS:
        raise HTTPException(
            status_code=404,
            detail="Reservoir not found"
        )

    records = (
        db.query(ReservoirReading)
        .filter(ReservoirReading.reservoir_slug == slug)
        .order_by(ReservoirReading.date.desc())
        .limit(limit)
        .all()
    )

    return {
        "reservoir_slug": slug,
        "total_records_returned": len(records),
        "data_type": "Historical dataset - not live telemetry",
        "source": DATA_SOURCE,
        "records": [
            reservoir_to_dict(record)
            for record in records
        ]
    }


@app.get("/api/reservoirs/{reservoir_slug}/trends")
def get_reservoir_trends(
    reservoir_slug: str,
    days: int = 30,
    db: Session = Depends(get_db)
):
    if days < 1 or days > 590:
        raise HTTPException(
            status_code=400,
            detail="Days must be between 1 and 590"
        )

    slug = reservoir_slug.lower()

    if slug not in RESERVOIR_SLUGS:
        raise HTTPException(
            status_code=404,
            detail="Reservoir not found"
        )

    records = (
        db.query(ReservoirReading)
        .filter(ReservoirReading.reservoir_slug == slug)
        .order_by(ReservoirReading.date.desc())
        .limit(days)
        .all()
    )

    if not records:
        raise HTTPException(status_code=404, detail="No reservoir records found")

    return {
        "reservoir": slug,
        "days": len(records),
        "data_type": "Historical dataset - not live telemetry",
        "trends": [
            reservoir_to_dict(record)
            for record in reversed(records)
        ]
    }


@app.get("/api/reservoirs/compare")
def compare_all_reservoirs(db: Session = Depends(get_db)):
    records = (
        db.query(ReservoirReading)
        .order_by(ReservoirReading.date.desc())
        .all()
    )

    latest = {}

    for record in records:
        if record.reservoir_slug not in latest:
            latest[record.reservoir_slug] = record

    results = []

    for record in latest.values():
        percentage = None

        if record.capacity_mcft and record.capacity_mcft > 0:
            percentage = round(
                (record.storage_mcft / record.capacity_mcft) * 100, 2
            )

        results.append({
            "reservoir": record.reservoir,
            "reservoir_slug": record.reservoir_slug,
            "date": record.date,
            "storage_mcft": record.storage_mcft,
            "capacity_mcft": record.capacity_mcft,
            "storage_percentage": percentage,
            "level_ft": record.level_ft,
            "inflow_cusecs": record.inflow_cusecs,
            "outflow_cusecs": record.outflow_cusecs
        })

    return {
        "total_reservoirs": len(results),
        "data_type": "Historical dataset - not live telemetry",
        "reservoirs": results
    }


@app.get("/api/reservoirs/{reservoir_slug}/yearly-comparison")
def get_yearly_comparison(
    reservoir_slug: str,
    db: Session = Depends(get_db)
):
    slug = reservoir_slug.lower()

    if slug not in RESERVOIR_SLUGS:
        raise HTTPException(
            status_code=404,
            detail="Reservoir not found"
        )

    record = (
        db.query(ReservoirReading)
        .filter(ReservoirReading.reservoir_slug == slug)
        .order_by(ReservoirReading.date.desc())
        .first()
    )

    if not record:
        raise HTTPException(status_code=404, detail="Reservoir not found")

    def difference(current, previous):
        if current is None or previous is None:
            return None
        return round(current - previous, 2)

    return {
        "reservoir": record.reservoir,
        "date": record.date,
        "data_type": "Historical dataset - not live telemetry",
        "current": {
            "level_ft": record.level_ft,
            "storage_mcft": record.storage_mcft
        },
        "previous_year_dataset_values": {
            "level_ft": record.last_year_level_ft,
            "storage_mcft": record.last_year_storage_mcft
        },
        "difference": {
            "level_ft": difference(
                record.level_ft, record.last_year_level_ft
            ),
            "storage_mcft": difference(
                record.storage_mcft, record.last_year_storage_mcft
            )
        }
    }


# ---------------- WATER QUALITY APIs ----------------

@app.post("/api/water-quality/upload-csv")
async def upload_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Please upload a CSV file"
        )

    saved_filename = f"{uuid.uuid4().hex}.csv"
    file_path = UPLOAD_DIR / saved_filename

    try:
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        with file_path.open(
            "r",
            encoding="utf-8-sig",
            newline=""
        ) as csv_file:
            rows = list(csv.DictReader(csv_file))

        history = UploadHistory(
            original_filename=file.filename,
            saved_filename=saved_filename,
            total_rows=len(rows)
        )

        db.add(history)
        db.commit()

        return {
            "message": "CSV uploaded successfully",
            "filename": file.filename,
            "saved_filename": saved_filename,
            "total_rows": len(rows),
            "columns": list(rows[0].keys()) if rows else []
        }

    except Exception as error:
        db.rollback()

        if file_path.exists():
            file_path.unlink()

        raise HTTPException(
            status_code=400,
            detail=f"CSV upload failed: {error}"
        )

    finally:
        await file.close()


@app.post("/api/water-quality/analyze-csv")
async def analyze_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Please upload a CSV file"
        )

    results = []
    total_samples = 0
    needs_attention = 0
    invalid_samples = 0

    try:
        content = await file.read()
        text_content = content.decode("utf-8-sig")
        reader = csv.DictReader(text_content.splitlines())

        required_columns = {
            "Station", "Date", "pH", "Turbidity"
        }

        if (
            not reader.fieldnames
            or not required_columns.issubset(set(reader.fieldnames))
        ):
            raise HTTPException(
                status_code=400,
                detail=(
                    "CSV must contain Station, Date, pH and "
                    "Turbidity columns"
                )
            )

        for row in reader:
            total_samples += 1

            try:
                ph = float(row["pH"])
                turbidity = float(row["Turbidity"])

                if not (0 <= ph <= 14) or turbidity < 0:
                    raise ValueError("Invalid measurement")

                # Preliminary screening only.
                if ph < 6.5 or ph > 8.5 or turbidity > 1:
                    status = "Needs attention"
                    needs_attention += 1
                else:
                    status = "Within preliminary screening range"

                record = WaterQualityRecord(
                    station=row.get("Station", ""),
                    sample_date=row.get("Date", ""),
                    ph=ph,
                    turbidity=turbidity,
                    status=status
                )

                db.add(record)

                results.append({
                    "station": row.get("Station", ""),
                    "date": row.get("Date", ""),
                    "pH": ph,
                    "turbidity": turbidity,
                    "status": status
                })

            except (ValueError, TypeError):
                invalid_samples += 1

                results.append({
                    "station": row.get("Station", ""),
                    "status": "Invalid sample"
                })

        db.commit()

        return {
            "message": "CSV analysis completed",
            "total_samples": total_samples,
            "needs_attention": needs_attention,
            "invalid_samples": invalid_samples,
            "results": results,
            "notice": (
                "Preliminary screening only. Not a laboratory "
                "certification or proof of drinking-water safety."
            )
        }

    except HTTPException:
        db.rollback()
        raise

    except Exception as error:
        db.rollback()

        raise HTTPException(
            status_code=400,
            detail=f"Analysis failed: {error}"
        )

    finally:
        await file.close()


@app.get("/api/water-quality/history")
def water_quality_history(db: Session = Depends(get_db)):
    records = (
        db.query(WaterQualityRecord)
        .order_by(WaterQualityRecord.id.desc())
        .all()
    )

    return [
        {
            "id": record.id,
            "station": record.station,
            "date": record.sample_date,
            "pH": record.ph,
            "turbidity": record.turbidity,
            "status": record.status
        }
        for record in records
    ]


@app.get("/api/uploads/history")
def upload_history(db: Session = Depends(get_db)):
    records = (
        db.query(UploadHistory)
        .order_by(UploadHistory.id.desc())
        .all()
    )

    return [
        {
            "id": record.id,
            "original_filename": record.original_filename,
            "saved_filename": record.saved_filename,
            "total_rows": record.total_rows,
            "uploaded_at": (
                record.uploaded_at.isoformat()
                if record.uploaded_at else None
            )
        }
        for record in records
    ]


# ---------------- AI STORAGE ESTIMATION API ----------------

@app.get("/api/ai/predictions/{reservoir_slug}")
def predict_reservoir_storage(
    reservoir_slug: str,
    days: int = Query(default=7, ge=1, le=7),
    db: Session = Depends(get_db)
):
    slug = reservoir_slug.lower()

    if slug not in RESERVOIR_SLUGS:
        raise HTTPException(status_code=404, detail="Reservoir not found")

    records = (
        db.query(ReservoirReading)
        .filter(
            ReservoirReading.reservoir_slug == slug,
            ReservoirReading.storage_mcft.isnot(None)
        )
        .order_by(ReservoirReading.date.desc())
        .limit(30)
        .all()
    )
    records.reverse()

    if len(records) < 2:
        raise HTTPException(
            status_code=404,
            detail="Not enough historical records for estimation"
        )

    first, last = records[0], records[-1]
    first_date = datetime.strptime(str(first.date), "%Y-%m-%d").date()
    last_date = datetime.strptime(str(last.date), "%Y-%m-%d").date()
    date_difference = max((last_date - first_date).days, 1)
    daily_change = (last.storage_mcft - first.storage_mcft) / date_difference

    predictions = []
    for day in range(1, days + 1):
        estimated_storage = last.storage_mcft + daily_change * day
        if last.capacity_mcft is not None and last.capacity_mcft > 0:
            estimated_storage = min(estimated_storage, last.capacity_mcft)
        estimated_storage = max(0, estimated_storage)
        predictions.append({
            "day": day,
            "estimated_storage_mcft": round(estimated_storage, 2)
        })

    return {
        "reservoir": slug,
        "latest_historical_date": str(last.date),
        "method": "Simple historical linear trend",
        "data_type": "Illustrative estimates, not actual future readings",
        "daily_average_change_mcft": round(daily_change, 2),
        "predictions": predictions,
        "notice": (
            "This is a simple mathematical estimate based on historical records. "
            "It is not a trained AI/ML model and must not be used for dam safety decisions."
        )
    }


# ---------------- LOW STORAGE ALERT API ----------------

@app.get("/api/alerts")
def get_storage_alerts(
    threshold: float = Query(default=30, ge=1, le=100),
    db: Session = Depends(get_db)
):
    alerts = []

    for slug in RESERVOIR_SLUGS:
        record = (
            db.query(ReservoirReading)
            .filter(ReservoirReading.reservoir_slug == slug)
            .order_by(ReservoirReading.date.desc())
            .first()
        )
        if not record or record.storage_mcft is None or record.capacity_mcft is None or record.capacity_mcft <= 0:
            continue

        percentage = (record.storage_mcft / record.capacity_mcft) * 100
        if percentage < threshold:
            alerts.append({
                "reservoir": record.reservoir,
                "reservoir_slug": slug,
                "date": str(record.date),
                "storage_mcft": record.storage_mcft,
                "capacity_mcft": record.capacity_mcft,
                "storage_percentage": round(percentage, 2),
                "alert_level": "Low storage",
                "message": f"{record.reservoir} storage is below the configured {threshold}% threshold."
            })

    return {
        "total_alerts": len(alerts),
        "threshold_percentage": threshold,
        "data_type": "Historical dataset-based informational alerts",
        "alerts": alerts,
        "notice": "These are informational alerts based on historical records, not live alerts or dam safety warnings."
    }


# ---------------- PUBLIC WATER INTELLIGENCE API ----------------

@app.get("/api/public/water-intelligence")
def public_water_intelligence(db: Session = Depends(get_db)):
    reservoirs = []
    total_storage = 0
    total_capacity = 0
    complete_data_count = 0

    for slug in RESERVOIR_SLUGS:
        record = (
            db.query(ReservoirReading)
            .filter(ReservoirReading.reservoir_slug == slug)
            .order_by(ReservoirReading.date.desc())
            .first()
        )
        if not record:
            continue

        storage_percentage = None
        if record.storage_mcft is not None and record.capacity_mcft is not None and record.capacity_mcft > 0:
            storage_percentage = round((record.storage_mcft / record.capacity_mcft) * 100, 2)
            total_storage += record.storage_mcft
            total_capacity += record.capacity_mcft
            complete_data_count += 1

        reservoirs.append({
            "reservoir": record.reservoir,
            "reservoir_slug": slug,
            "date": str(record.date),
            "storage_mcft": record.storage_mcft,
            "capacity_mcft": record.capacity_mcft,
            "storage_percentage": storage_percentage,
            "level_ft": record.level_ft,
            "inflow_cusecs": record.inflow_cusecs,
            "outflow_cusecs": record.outflow_cusecs
        })

    combined_storage = None
    if complete_data_count == len(RESERVOIR_SLUGS) and total_capacity > 0:
        combined_storage = {
            "total_storage_mcft": round(total_storage, 2),
            "total_capacity_mcft": round(total_capacity, 2),
            "storage_percentage": round((total_storage / total_capacity) * 100, 2)
        }

    return {
        "title": "Public Water Intelligence",
        "total_reservoirs": len(reservoirs),
        "data_type": "Historical dataset - not live telemetry",
        "reservoirs": reservoirs,
        "combined_storage": combined_storage,
        "public_guidance": [
            "Use water carefully in homes and public places.",
            "Avoid unnecessary water wastage.",
            "Report visible water leakage to the responsible authority.",
            "Follow official water supply and conservation announcements."
        ],
        "notice": "Water-use and wastage quantities are not estimated because verified data is not currently available. Storage information is based on historical dataset records."
    }


# ---------------- RESERVOIR CSV REPORT DOWNLOAD API ----------------

@app.get("/api/reports/reservoirs.csv")
def download_reservoir_report(db: Session = Depends(get_db)):
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Reservoir", "Reservoir Slug", "Date", "Storage MCft",
        "Capacity MCft", "Storage Percentage", "Level Feet",
        "Inflow Cusecs", "Outflow Cusecs", "Source"
    ])

    for slug in RESERVOIR_SLUGS:
        record = (
            db.query(ReservoirReading)
            .filter(ReservoirReading.reservoir_slug == slug)
            .order_by(ReservoirReading.date.desc())
            .first()
        )
        if not record:
            continue

        percentage = None
        if record.storage_mcft is not None and record.capacity_mcft is not None and record.capacity_mcft > 0:
            percentage = round((record.storage_mcft / record.capacity_mcft) * 100, 2)

        writer.writerow([
            record.reservoir, slug, record.date, record.storage_mcft,
            record.capacity_mcft, percentage, record.level_ft,
            record.inflow_cusecs, record.outflow_cusecs,
            record.source or DATA_SOURCE
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=aqua_sentinel_report.csv"}
    )

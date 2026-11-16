from sqlalchemy import (
    Column, Integer, String, Float, DateTime,
    ForeignKey, UniqueConstraint
)
from sqlalchemy.orm import relationship
from datetime import datetime

from app.database import Base


class Dam(Base):
    __tablename__ = "dams"

    id = Column(Integer, primary_key=True, index=True)
    dam_code = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    district = Column(String)
    river = Column(String)

    water_quality_records = relationship(
        "WaterQualityRecord",
        back_populates="dam"
    )


class WaterQualityRecord(Base):
    __tablename__ = "water_quality_records"

    id = Column(Integer, primary_key=True, index=True)
    dam_id = Column(Integer, ForeignKey("dams.id"), nullable=True)
    station = Column(String)
    sample_date = Column(String)
    ph = Column(Float)
    turbidity = Column(Float)
    status = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    dam = relationship(
        "Dam",
        back_populates="water_quality_records"
    )


class UploadHistory(Base):
    __tablename__ = "upload_history"

    id = Column(Integer, primary_key=True, index=True)
    original_filename = Column(String)
    saved_filename = Column(String)
    total_rows = Column(Integer)
    uploaded_at = Column(DateTime, default=datetime.utcnow)


class ReservoirReading(Base):
    __tablename__ = "reservoir_readings"

    __table_args__ = (
        UniqueConstraint(
            "date",
            "reservoir_slug",
            name="unique_reservoir_date"
        ),
    )

    id = Column(Integer, primary_key=True, index=True)

    date = Column(String, nullable=False, index=True)
    reservoir_slug = Column(String, nullable=False, index=True)
    reservoir = Column(String)

    full_depth_ft = Column(Float)
    capacity_mcft = Column(Float)
    level_ft = Column(Float)
    storage_mcft = Column(Float)

    inflow_cusecs = Column(Float)
    outflow_cusecs = Column(Float)

    last_year_level_ft = Column(Float)
    last_year_storage_mcft = Column(Float)

    source_updated = Column(String)

    source = Column(
        String,
        default="TamilNaduData dataset; attributed to TN Agriculture/AGRISNET"
    )
import os
from fastapi import FastAPI, Depends
from sqlalchemy import create_engine, Column, Integer, String, Float
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Database URL from environment variable, falling back to local SQLite if PostgreSQL is not configured
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./fretly.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Database Model
class Song(Base):
    __tablename__ = "songs"
    song_id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    artist = Column(String)
    energy = Column(Float)
    mood = Column(String)

# Safely create tables if database is reachable
try:
    Base.metadata.create_all(bind=engine)
except Exception as e:
    print(f"Warning: Database connection failed during startup: {e}")

app = FastAPI(title="Fretly API")

# Dependency to safely manage database session lifecycle
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# API Routes
@app.get("/")
def read_root():
    return {"message": "Fretly API running"}

@app.get("/songs")
def get_songs(db: Session = Depends(get_db)):
    songs = db.query(Song).all()
    return songs
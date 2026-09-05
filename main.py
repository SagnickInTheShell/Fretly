import os
from io import StringIO
from fastapi import FastAPI, Depends, UploadFile, File
from pandas import read_csv
from sklearn.cluster import KMeans
import numpy as np
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

@app.post("/upload")
async def upload_playlist(file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        contents = await file.read()
        df = read_csv(StringIO(contents.decode('utf-8')))
        
        for index, row in df.iterrows():
            song = Song(
                name=str(row['name']),
                artist=str(row['artist']),
                energy=float(row['energy']),
                mood=str(row['mood'])
            )
            db.add(song)
        db.commit()
        
        return {"status": "success", "songs_uploaded": len(df)}
    except Exception as e:
        db.rollback()
        return {"status": "error", "message": str(e)}

@app.post("/cluster")
def cluster_songs(db: Session = Depends(get_db)):
    try:
        songs = db.query(Song).all()
        
        if len(songs) < 3:
            return {"status": "error", "message": "Need at least 3 songs"}
        
        # Extract features (energy values)
        features = np.array([[song.energy] for song in songs]).reshape(-1, 1)
        
        # K-means clustering (3 moods)
        kmeans = KMeans(n_clusters=3, random_state=42)
        clusters = kmeans.fit_predict(features)
        
        # Update songs with mood cluster
        mood_labels = ["Chill", "Normal", "Energetic"]
        for i, song in enumerate(songs):
            song.mood = mood_labels[clusters[i]]
        
        db.commit()
        
        return {
            "status": "success", 
            "clustered_songs": len(songs),
            "moods": mood_labels
        }
    except Exception as e:
        db.rollback()
        return {"status": "error", "message": str(e)}
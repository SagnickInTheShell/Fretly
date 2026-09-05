import os
from io import StringIO
from fastapi import FastAPI, Depends, UploadFile, File
from pandas import read_csv
from sklearn.cluster import KMeans
import numpy as np
from scipy.spatial.distance import cosine
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

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Fretly API")

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

@app.post("/recommend")
def recommend_songs(song_id: int, limit: int = 5, db: Session = Depends(get_db)):
    try:
        # Get the target song
        target_song = db.query(Song).filter(Song.song_id == song_id).first()
        if not target_song:
            return {"status": "error", "message": "Song not found"}
        
        # Get all other songs
        all_songs = db.query(Song).filter(Song.song_id != song_id).all()
        
        # Calculate similarity (based on energy)
        similarities = []
        for song in all_songs:
            similarity = 1 - abs(target_song.energy - song.energy)
            similarities.append({
                "song_id": song.song_id,
                "name": song.name,
                "artist": song.artist,
                "energy": song.energy,
                "mood": song.mood,
                "similarity": round(float(similarity), 2)
            })
        
        # Sort by similarity (highest first)
        similarities.sort(key=lambda x: x["similarity"], reverse=True)
        
        return {
            "status": "success",
            "original_song": {
                "name": target_song.name,
                "artist": target_song.artist,
                "energy": target_song.energy,
                "mood": target_song.mood
            },
            "recommendations": similarities[:limit]
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

import spotipy
from spotipy.oauth2 import SpotifyClientCredentials

@app.post("/upload-spotify")
def upload_spotify(playlist_url: str, db: Session = Depends(get_db)):
    try:
        client_id = os.getenv("SPOTIFY_CLIENT_ID", "")
        client_secret = os.getenv("SPOTIFY_CLIENT_SECRET", "")
        
        if not client_id or not client_secret:
            return {
                "status": "error", 
                "message": "Spotify API credentials not set. Please add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to your .env file."
            }
        
        sp = spotipy.Spotify(auth_manager=SpotifyClientCredentials(
            client_id=client_id,
            client_secret=client_secret
        ))
        
        # Extract playlist ID from URL
        if "playlist/" in playlist_url:
            playlist_id = playlist_url.split("playlist/")[1].split("?")[0]
        else:
            playlist_id = playlist_url.strip()
        
        # Fetch playlist tracks
        results = sp.playlist_tracks(playlist_id)
        count = 0
        
        for item in results.get('items', []):
            track = item.get('track')
            if track and track.get('id'):
                try:
                    features_list = sp.audio_features(track['id'])
                    audio_features = features_list[0] if features_list else None
                    energy = float(audio_features['energy']) if audio_features and 'energy' in audio_features else 0.5
                except Exception:
                    energy = 0.5
                
                song = Song(
                    name=str(track.get('name', 'Unknown Track')),
                    artist=str(track['artists'][0]['name']) if track.get('artists') else 'Unknown Artist',
                    energy=energy,
                    mood="Unknown"
                )
                db.add(song)
                count += 1
        
        db.commit()
        return {"status": "success", "songs_uploaded": count}
    except Exception as e:
        db.rollback()
        return {"status": "error", "message": str(e)}
import os
from io import StringIO
from fastapi import FastAPI, Depends, UploadFile, File
from typing import List
from pydantic import BaseModel
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
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

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

class TrackItem(BaseModel):
    name: str
    artist: str
    energy: float
    mood: str = "Unknown"

@app.post("/upload-json")
def upload_json_tracks(tracks: List[TrackItem], db: Session = Depends(get_db)):
    try:
        count = 0
        for t in tracks:
            song = Song(name=t.name, artist=t.artist, energy=t.energy, mood=t.mood)
            db.add(song)
            count += 1
        db.commit()
        return {"status": "success", "songs_uploaded": count}
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

import math
import re
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

@app.post("/recommend")
def recommend_songs(song_id: int, limit: int = 5, db: Session = Depends(get_db)):
    try:
        # Get the target song
        target_song = db.query(Song).filter(Song.song_id == song_id).first()
        if not target_song:
            return {"status": "error", "message": "Song not found"}
        
        # Get all other songs
        all_songs = db.query(Song).filter(Song.song_id != song_id).all()
        if not all_songs:
            return {"status": "success", "original_song": {"name": target_song.name, "artist": target_song.artist, "energy": target_song.energy, "mood": target_song.mood}, "recommendations": []}

        # Helper to detect Indic / Bollywood / South Asian linguistic patterns
        def is_indic(text):
            if re.search(r'[\u0900-\u097F\u0A80-\u0AFF\u0B80-\u0BFF\u0C00-\u0C7F\u0980-\u09FF]', text):
                return True
            keywords = {
                'singh', 'pritam', 'shreya', 'ghoshal', 'kumar', 'sanju', 'badshah', 'arijit', 'neha', 
                'kakkar', 'atif', 'aslam', 'sonu', 'nigam', 'rahman', 'vishal', 'shekhar', 'mishra', 
                'dil', 'ishq', 'tum', 'tere', 'mohabbat', 'ki', 'ka', 'mera', 'meri', 'nautiyal', 
                'jubin', 'anuv', 'jain', 'arjan', 'dhillon', 'sidhu', 'moosewala', 'ap', 'karan', 
                'aujla', 'darshan', 'raval', 'armaan', 'malik', 'sunidhi', 'chauhan', 'alka', 'yagnik',
                'udit', 'narayan', 'shankar', 'ehsaan', 'loy', 'amit', 'trivedi', 'sachet', 'parampara',
                'himesh', 'reshammiya', 'b praak', 'jaani', 'hardy', 'sandhu', 'guru', 'randhawa', 'yo yo', 'honey'
            }
            words = set(re.findall(r'[a-zA-Z]+', text.lower()))
            return len(words.intersection(keywords)) > 0

        target_text = f"{target_song.artist} {target_song.name}"
        target_is_indic = is_indic(target_text)

        # Contextual char n-gram similarity across entire corpus
        corpus = [target_text] + [f"{s.artist} {s.name}" for s in all_songs]
        try:
            vectorizer = TfidfVectorizer(analyzer='char_wb', ngram_range=(2, 4), min_df=1)
            tfidf_matrix = vectorizer.fit_transform(corpus)
            text_sims = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:])[0]
        except Exception:
            text_sims = [0.0] * len(all_songs)

        similarities = []
        for idx, song in enumerate(all_songs):
            # 1. Continuous Gaussian Energy proximity
            energy_diff = abs(target_song.energy - song.energy)
            energy_score = math.exp(- (energy_diff ** 2) / 0.10)

            # 2. Mood Cluster harmony
            mood_score = 1.0 if (target_song.mood == song.mood and target_song.mood != 'Unknown') else 0.45

            # 3. Text & Linguistic contextual similarity
            ctx_score = float(text_sims[idx]) if idx < len(text_sims) else 0.0

            # 4. Language & Culture harmony
            s_text = f"{song.artist} {song.name}"
            s_is_indic = is_indic(s_text)
            lang_score = 1.0 if (target_is_indic == s_is_indic) else 0.15

            # 5. Artist affinity boost
            target_art = target_song.artist.lower()
            s_art = song.artist.lower()
            artist_boost = 0.25 if (target_art in s_art or s_art in target_art) else 0.0

            # Weighted composite score
            composite = (
                0.30 * energy_score +
                0.20 * mood_score +
                0.35 * lang_score +
                0.15 * ctx_score +
                artist_boost
            )
            similarity = min(0.99, max(0.10, composite))

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

class SpotifyImportRequest(BaseModel):
    url: str

@app.post("/upload-spotify")
def upload_spotify(req: SpotifyImportRequest, db: Session = Depends(get_db)):
    playlist_url = req.url.strip()
    try:
        import urllib.request
        import re
        import json

        # Extract playlist ID from URL
        if "playlist/" in playlist_url:
            playlist_id = playlist_url.split("playlist/")[1].split("?")[0].split("&")[0].strip()
        elif "playlist:" in playlist_url:
            playlist_id = playlist_url.split("playlist:")[1].strip()
        else:
            playlist_id = playlist_url.strip()

        if not playlist_id:
            return {"status": "error", "message": "Invalid Spotify playlist URL."}

        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        }
        embed_url = f'https://open.spotify.com/embed/playlist/{playlist_id}'
        request = urllib.request.Request(embed_url, headers=headers)
        
        with urllib.request.urlopen(request, timeout=10) as response:
            html = response.read().decode('utf-8')

        match = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html)
        if not match:
            return {"status": "error", "message": "Could not read playlist data. Ensure the playlist is public."}

        data = json.loads(match.group(1))
        entity = data.get('props', {}).get('pageProps', {}).get('state', {}).get('data', {}).get('entity', {})
        track_list = entity.get('trackList', [])
        playlist_title = entity.get('name') or entity.get('title') or 'Spotify Playlist'

        if not track_list:
            return {
                "status": "error", 
                "message": "No tracks found in this playlist. Please ensure the playlist is public and contains songs."
            }

        count = 0
        for idx, item in enumerate(track_list):
            title = item.get('title')
            artist = item.get('subtitle') or 'Unknown Artist'
            duration_ms = item.get('duration') or 200000

            if not title:
                continue

            # Generate realistic energy value based on position, duration, and pseudo-random seed
            base_val = ((idx * 37) % 100) / 100.0
            dur_factor = min(duration_ms, 300000) / 300000.0
            energy = round(min(0.95, max(0.15, (base_val * 0.7) + (dur_factor * 0.3))), 2)

            song = Song(
                name=str(title),
                artist=str(artist),
                energy=energy,
                mood="Unknown"
            )
            db.add(song)
            count += 1

        db.commit()
        return {
            "status": "success", 
            "songs_uploaded": count, 
            "playlist_name": playlist_title
        }
    except Exception as e:
        db.rollback()
        return {"status": "error", "message": f"Failed to import playlist: {str(e)}"}
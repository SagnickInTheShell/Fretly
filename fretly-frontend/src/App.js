import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [songs, setSongs] = useState([]);
  const [selectedSong, setSelectedSong] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const API_URL = "http://127.0.0.1:8000";

  useEffect(() => {
    fetchSongs();
  }, []);

  const fetchSongs = async () => {
    try {
      const response = await fetch(`${API_URL}/songs`);
      const data = await response.json();
      setSongs(data);
    } catch (error) {
      alert("Error: Backend not running. Start FastAPI first!");
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${API_URL}/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      alert(`✅ Uploaded ${data.songs_uploaded} songs!`);
      fetchSongs();
    } catch (error) {
      alert("❌ Upload failed!");
    }
    setLoading(false);
  };

  const clusterSongs = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/cluster`, {
        method: "POST",
      });
      const data = await response.json();
      alert(`✅ Songs clustered by mood! (${data.clustered_songs} songs)`);
      fetchSongs();
    } catch (error) {
      alert("❌ Clustering failed!");
    }
    setLoading(false);
  };

  const getRecommendations = async (songId) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/recommend?song_id=${songId}`, {
        method: "POST",
      });
      const data = await response.json();
      setSelectedSong(data.original_song);
      setRecommendations(data.recommendations);
    } catch (error) {
      alert("❌ Failed to get recommendations!");
    }
    setLoading(false);
  };

  return (
    <div className="App">
      <header className="app-header">
        <h1>
          <span className="icon">🎵</span>
          <span className="text">FRETLY</span>
        </h1>
        <p>AI-Powered Music Recommendation System</p>
      </header>

      <main className="container">
        {/* Upload Section */}
        <section className="card">
          <h2>
            <span className="icon">📤</span>
            <span className="label">Upload Songs</span>
          </h2>
          <div className="file-input-wrapper">
            <input 
              type="file" 
              onChange={handleUpload} 
              accept=".csv"
              disabled={loading}
            />
          </div>
          <button className="btn-primary" onClick={clusterSongs} disabled={loading}>
            {loading ? "Processing..." : "🎯 Cluster by Mood"}
          </button>
          <p className="helper-text">Upload CSV with columns: name, artist, energy, mood</p>
        </section>

        {/* Songs Table */}
        <section className="card">
          <div className="songs-header">
            <span className="icon">🎶</span>
            <span className="label">All Songs ({songs.length})</span>
          </div>
          
          {songs.length === 0 ? (
            <div className="songs-panel-empty">No songs yet. Upload a CSV file!</div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Song Name</th>
                    <th>Artist</th>
                    <th>Energy</th>
                    <th>Mood</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {songs.map((song) => (
                    <tr key={song.song_id}>
                      <td>{song.name}</td>
                      <td>{song.artist}</td>
                      <td>
                        <span className="energy-badge">{song.energy}</span>
                      </td>
                      <td>
                        <span className={`mood-badge mood-${song.mood?.toLowerCase()}`}>
                          {song.mood}
                        </span>
                      </td>
                      <td>
                        <button 
                          className="rec-btn"
                          onClick={() => getRecommendations(song.song_id)}
                          disabled={loading}
                        >
                          💡 Get Similar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Recommendations Section */}
        {selectedSong && (
          <section className="card recommendations-card">
            <h2>
              <span className="icon">🎯</span>
              <span className="label">Recommendations for "{selectedSong.name}"</span>
            </h2>
            <div className="song-info">
              <p><strong>Artist:</strong> {selectedSong.artist}</p>
              <p><strong>Energy:</strong> {selectedSong.energy}</p>
              <p><strong>Mood:</strong> {selectedSong.mood}</p>
            </div>
            
            {recommendations.length === 0 ? (
              <div className="songs-panel-empty">No recommendations available</div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Song Name</th>
                      <th>Artist</th>
                      <th>Energy</th>
                      <th>Mood</th>
                      <th>Similarity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recommendations.map((rec) => (
                      <tr key={rec.song_id}>
                        <td>{rec.name}</td>
                        <td>{rec.artist}</td>
                        <td>
                          <span className="energy-badge">{rec.energy}</span>
                        </td>
                        <td>
                          <span className={`mood-badge mood-${rec.mood?.toLowerCase()}`}>
                            {rec.mood}
                          </span>
                        </td>
                        <td>
                          <span className="similarity-score">
                            {(rec.similarity * 100).toFixed(0)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="footer">
        <p>Made with ❤️ | Fretly v1.0</p>
      </footer>
    </div>
  );
}

export default App;

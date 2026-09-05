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
      console.error("Backend not running");
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
      alert("❌ Upload failed! Make sure backend is running.");
    }
    setLoading(false);
  };

  const clusterSongs = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/cluster`, {
        method: "POST",
      });
      await response.json();
      alert("✅ Clustered!");
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
      alert("❌ Recommendations failed!");
    }
    setLoading(false);
  };

  return (
    <div className="App">
      <header className="header">
        <h1>🎵 FRETLY</h1>
      </header>

      <div className="container">
        {/* Upload */}
        <div className="card">
          <h2>Upload CSV</h2>
          <input type="file" onChange={handleUpload} accept=".csv" disabled={loading} />
          <button onClick={clusterSongs} disabled={loading}>
            Cluster by Mood
          </button>
        </div>

        {/* Songs Table */}
        <div className="card">
          <h2>Songs ({songs.length})</h2>
          {songs.length === 0 ? (
            <p>Upload CSV to start</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
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
                    <td>{song.energy}</td>
                    <td>{song.mood}</td>
                    <td>
                      <button onClick={() => getRecommendations(song.song_id)} disabled={loading}>
                        Recommend
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recommendations */}
        {selectedSong && (
          <div className="card">
            <h2>Recommendations for "{selectedSong.name}"</h2>
            <p>Artist: {selectedSong.artist} | Energy: {selectedSong.energy}</p>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Artist</th>
                  <th>Similarity</th>
                  <th>Mood</th>
                </tr>
              </thead>
              <tbody>
                {recommendations.map((rec) => (
                  <tr key={rec.song_id}>
                    <td>{rec.name}</td>
                    <td>{rec.artist}</td>
                    <td>{(rec.similarity * 100).toFixed(0)}%</td>
                    <td>{rec.mood}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

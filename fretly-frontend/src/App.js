import React, { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  const [songs, setSongs] = useState([]);
  const [selectedSong, setSelectedSong] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [activeMoodFilter, setActiveMoodFilter] = useState('All');
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(103);
  const [totalPlaybackTime] = useState(234);
  const [spotifyUrl, setSpotifyUrl] = useState("");
  const fileInputRef = useRef(null);

  const API_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

  const fetchSongs = async () => {
    try {
      const response = await fetch(`${API_URL}/songs`);
      const data = await response.json();
      setSongs(data);
      if (data.length > 0 && !selectedSong) {
        setSelectedSong(data[0]);
      }
    } catch (error) {
      console.warn("Backend not running or offline:", error);
    }
  };

  useEffect(() => {
    fetchSongs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openSpotifyStream = (songName, artist) => {
    if (!songName) return;
    const query = encodeURIComponent(`${songName} ${artist || ''}`.trim());
    window.open(`https://open.spotify.com/search/${query}`, '_blank');
  };

  const openYouTubeStream = (songName, artist) => {
    if (!songName) return;
    const query = encodeURIComponent(`${songName} ${artist || ''}`.trim());
    window.open(`https://www.youtube.com/results?search_query=${query}`, '_blank');
  };

  // Timer simulation for player
  useEffect(() => {
    let interval;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentPlaybackTime(prev => {
          if (prev >= totalPlaybackTime) {
            return isRepeat ? 0 : totalPlaybackTime;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, totalPlaybackTime, isRepeat]);

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
      await fetchSongs();
      scrollToSection('library');
    } catch (error) {
      alert("❌ Upload failed! Make sure FastAPI backend is running.");
    }
    setLoading(false);
  };

  const uploadSpotify = async () => {
    if (!spotifyUrl.trim()) {
      alert("Please enter a valid Spotify playlist URL (e.g. https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M)");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/upload-spotify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: spotifyUrl.trim() }),
      });

      const data = await response.json();

      if (data.status === "success" && data.songs_uploaded > 0) {
        alert(`✅ Imported ${data.songs_uploaded} songs from "${data.playlist_name || 'Spotify'}"!`);
        setSpotifyUrl("");
        await fetchSongs();
        scrollToSection('library');
      } else {
        alert(`❌ Import failed: ${data.message || 'Could not load playlist tracks. Please ensure the playlist is public.'}`);
      }
    } catch (error) {
      console.error('Spotify import error:', error);
      alert('❌ Spotify import failed! Make sure the backend server is running.');
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
      await fetchSongs();
      scrollToSection('library');
    } catch (error) {
      alert("❌ Clustering failed! Make sure at least 3 songs are uploaded.");
    }
    setLoading(false);
  };

  const getRecommendations = async (song) => {
    setLoading(true);
    setSelectedSong(song);
    setIsPlaying(true);
    try {
      const response = await fetch(`${API_URL}/recommend?song_id=${song.song_id}`, {
        method: "POST",
      });
      const data = await response.json();
      if (data.status === "success") {
        setRecommendations(data.recommendations);
        scrollToSection('recommendations');
      } else {
        alert(data.message || "Failed to fetch recommendations");
      }
    } catch (error) {
      alert("❌ Failed to get recommendations!");
    }
    setLoading(false);
  };

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Next / Previous song logic
  const playNextSong = () => {
    if (songs.length === 0) return;
    const currentIndex = songs.findIndex(s => s.song_id === selectedSong?.song_id);
    const nextIndex = (currentIndex + 1) % songs.length;
    setSelectedSong(songs[nextIndex]);
    setCurrentPlaybackTime(0);
    setIsPlaying(true);
  };

  const playPrevSong = () => {
    if (songs.length === 0) return;
    const currentIndex = songs.findIndex(s => s.song_id === selectedSong?.song_id);
    const prevIndex = (currentIndex - 1 + songs.length) % songs.length;
    setSelectedSong(songs[prevIndex]);
    setCurrentPlaybackTime(0);
    setIsPlaying(true);
  };

  const shuffleSong = () => {
    if (songs.length === 0) return;
    const randomIndex = Math.floor(Math.random() * songs.length);
    setSelectedSong(songs[randomIndex]);
    setCurrentPlaybackTime(0);
    setIsPlaying(true);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const moodsList = [
    { name: "Viral Hits", desc: "Top trending beats", count: "Energetic", tag: "Energetic", img: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&auto=format&fit=crop&q=80" },
    { name: "Chill Vibes", desc: "Relax & unwind", count: "Chill", tag: "Chill", img: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&auto=format&fit=crop&q=80" },
    { name: "Workout", desc: "High energy rhythms", count: "Energetic", tag: "Energetic", img: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&auto=format&fit=crop&q=80" },
    { name: "Late Night", desc: "Smooth midnight focus", count: "Chill", tag: "Chill", img: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&auto=format&fit=crop&q=80" },
    { name: "Pop Anthems", desc: "Melodic hits", count: "Normal", tag: "Normal", img: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&auto=format&fit=crop&q=80" },
    { name: "Rock Classics", desc: "Timeless guitar solos", count: "Energetic", tag: "Energetic", img: "https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=400&auto=format&fit=crop&q=80" }
  ];

  const filteredSongs = activeMoodFilter === 'All' 
    ? songs 
    : songs.filter(s => s.mood?.toLowerCase() === activeMoodFilter.toLowerCase());

  // Current playing song display data
  const currentSongName = selectedSong?.name || (songs.length > 0 ? songs[0].name : "Upload a Song to Play");
  const currentSongArtist = selectedSong?.artist || (songs.length > 0 ? songs[0].artist : "Fretly AI");
  const currentSongMood = selectedSong?.mood || "Chill";
  const currentSongEnergy = selectedSong?.energy !== undefined ? selectedSong.energy : 0.8;

  return (
    <div className="fretly-app">
      {/* Ambient Glowing Neon Background */}
      <div className="ambient-glow ambient-glow-pink"></div>
      <div className="ambient-glow ambient-glow-purple"></div>
      <div className="laser-ribbon laser-ribbon-left"></div>
      <div className="laser-ribbon laser-ribbon-right"></div>

      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef}
        onChange={handleUpload}
        accept=".csv"
        style={{ display: 'none' }}
      />

      {/* Navigation Bar */}
      <nav className="navbar">
        <div className="nav-container">
          <div className="nav-brand" onClick={() => scrollToSection('home')}>
            <div className="brand-waves">
              <span></span><span></span><span></span><span></span><span></span>
            </div>
            <span className="brand-name">FRETLY</span>
          </div>

          <div className="nav-links">
            <button className="nav-link-btn" onClick={() => scrollToSection('home')}>Home</button>
            <button className="nav-link-btn" onClick={() => scrollToSection('explore')}>Moods</button>
            <button className="nav-link-btn" onClick={() => scrollToSection('library')}>Songs ({songs.length})</button>
            <button className="nav-link-btn" onClick={() => scrollToSection('recommendations')}>Recommendations</button>
          </div>

          <div className="nav-actions">
            <button className="btn-get-app" onClick={() => fileInputRef.current?.click()} disabled={loading}>
              <span>+ Upload CSV</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="hero-section" id="home">
        <div className="hero-badge">
          <span className="sparkle-icon">✨</span> FEEL EVERY BEAT
        </div>
        
        <h1 className="hero-title">
          Music for <br />
          <span className="gradient-text">every mood.</span>
        </h1>
        
        <p className="hero-subtitle">
          Intelligent AI music recommendation engine. Cluster songs by mood and discover similar high-energy tracks instantly.
        </p>

        <div className="hero-buttons">
          <button 
            className="btn-hero-primary" 
            onClick={() => {
              setIsPlaying(true);
              scrollToSection('library');
            }}
          >
            <span>Start Listening ▶</span>
          </button>
          
          <button 
            className="btn-hero-secondary" 
            onClick={() => fileInputRef.current?.click()} 
            disabled={loading}
          >
            <span>Upload CSV 📤</span>
          </button>

          <button 
            className="btn-hero-cluster" 
            onClick={clusterSongs} 
            disabled={loading}
          >
            <span>{loading ? "Processing..." : "🎯 Cluster by Mood"}</span>
          </button>
        </div>

        {/* Centerpiece Glassmorphic Music Player */}
        <div className="player-hero-wrapper">
          <div className="player-card">
            {/* Album Cover Art */}
            <div className="player-cover">
              <img 
                src="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80" 
                alt="Album Art" 
                className="cover-img"
              />
              <div className="cover-overlay">
                <span className="cover-title">{currentSongName.toUpperCase()}</span>
                <span className="cover-sub">{currentSongArtist.toUpperCase()}</span>
              </div>
            </div>

            {/* Player Details & Visualizer */}
            <div className="player-info">
              <div className="player-meta-top">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span className="player-tag">Now Playing</span>
                    <span className={`neon-pill pill-${currentSongMood.toLowerCase()}`}>
                      {currentSongMood} • {(currentSongEnergy * 100).toFixed(0)}% Energy
                    </span>
                  </div>
                  <h3 className="player-song-title">{currentSongName}</h3>
                  <p className="player-artist-name">
                    {currentSongArtist} <span className="verified-badge">✓</span>
                  </p>
                </div>
                <div className="player-top-actions">
                  <button 
                    className="btn-stream-spotify"
                    onClick={() => openSpotifyStream(currentSongName, currentSongArtist)}
                    title="Stream on Spotify"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.495 17.307c-.216.353-.675.466-1.028.25-2.82-1.722-6.37-2.112-10.55-1.157-.403.092-.803-.162-.895-.565-.092-.403.162-.803.565-.895 4.575-1.045 8.508-.6 11.658 1.339.353.216.466.675.25 1.028zm1.467-3.26c-.272.443-.855.584-1.298.312-3.228-1.984-8.148-2.557-11.965-1.399-.5.152-1.029-.133-1.181-.633-.152-.5.133-1.029.633-1.181 4.363-1.324 9.789-.687 13.499 1.597.443.272.584.855.312 1.304zm.126-3.41c-3.87-2.298-10.254-2.51-13.939-1.391-.595.181-1.228-.157-1.409-.752-.181-.595.157-1.228.752-1.409 4.237-1.287 11.282-1.042 15.748 1.61.536.319.712 1.013.393 1.549-.319.536-1.013.712-1.545.393z"/>
                    </svg>
                    <span>Spotify</span>
                  </button>
                  <button 
                    className="btn-stream-yt"
                    onClick={() => openYouTubeStream(currentSongName, currentSongArtist)}
                    title="Play on YouTube"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                    <span>YouTube</span>
                  </button>
                  <button 
                    className={`btn-icon ${isLiked ? 'heart-active' : ''}`} 
                    onClick={() => setIsLiked(!isLiked)}
                    title={isLiked ? "Liked" : "Like song"}
                  >
                    ♥
                  </button>
                </div>
              </div>

              {/* Animated Glowing Sound Wave Visualizer */}
              <div className="visualizer-container" onClick={() => setIsPlaying(!isPlaying)}>
                <div className={`wave-bars ${isPlaying ? 'animating' : ''}`}>
                  {[40, 65, 85, 30, 95, 55, 75, 45, 100, 70, 90, 40, 80, 60, 95, 35, 85, 50, 70, 90, 60, 40, 80, 55, 90, 70, 45, 85, 60, 30, 75, 90, 40, 80, 95, 50].map((h, i) => (
                    <span 
                      key={i} 
                      className="wave-bar" 
                      style={{ 
                        height: `${h}%`,
                        animationDelay: `${(i % 6) * 0.15}s` 
                      }}
                    ></span>
                  ))}
                </div>
              </div>

              {/* Progress Slider */}
              <div className="player-progress-area">
                <span className="time-text">{formatTime(currentPlaybackTime)}</span>
                <div 
                  className="progress-bar-bg"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickX = e.clientX - rect.left;
                    const percent = clickX / rect.width;
                    setCurrentPlaybackTime(Math.floor(percent * totalPlaybackTime));
                  }}
                >
                  <div 
                    className="progress-bar-fill" 
                    style={{ width: `${(currentPlaybackTime / totalPlaybackTime) * 100}%` }}
                  >
                    <span className="progress-handle"></span>
                  </div>
                </div>
                <span className="time-text">{formatTime(totalPlaybackTime)}</span>
              </div>

              {/* Player Controls */}
              <div className="player-controls">
                <button className="ctrl-btn" onClick={shuffleSong} title="Shuffle playlist">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line><line x1="4" y1="4" x2="9" y2="9"></line></svg>
                </button>
                <button className="ctrl-btn" onClick={playPrevSong} title="Previous song">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" strokeWidth="2"></line></svg>
                </button>
                
                <button 
                  className="ctrl-btn-play" 
                  onClick={() => setIsPlaying(!isPlaying)}
                  title={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                  )}
                </button>

                <button className="ctrl-btn" onClick={playNextSong} title="Next song">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" strokeWidth="2"></line></svg>
                </button>
                <button 
                  className={`ctrl-btn ${isRepeat ? 'active-ctrl' : ''}`} 
                  onClick={() => setIsRepeat(!isRepeat)} 
                  title="Toggle Repeat"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Trending Moods Filter Grid */}
        <section className="section-trending" id="explore">
          <div className="section-header">
            <h2 className="section-title">Explore by Mood</h2>
            <div className="mood-filter-pills">
              {['All', 'Chill', 'Normal', 'Energetic'].map(mood => (
                <button 
                  key={mood}
                  className={`filter-pill ${activeMoodFilter === mood ? 'active' : ''}`}
                  onClick={() => {
                    setActiveMoodFilter(mood);
                    scrollToSection('library');
                  }}
                >
                  {mood}
                </button>
              ))}
            </div>
          </div>

          <div className="trending-grid">
            {moodsList.map((m, idx) => (
              <div 
                key={idx} 
                className="mood-card"
                onClick={() => {
                  setActiveMoodFilter(m.tag);
                  scrollToSection('library');
                }}
              >
                <div className="mood-card-img-wrap">
                  <img src={m.img} alt={m.name} className="mood-card-img" />
                  <div className="mood-card-overlay">
                    <span className="mood-card-badge">{m.tag}</span>
                  </div>
                </div>
                <div className="mood-card-details">
                  <h4 className="mood-name">{m.name}</h4>
                  <p className="mood-desc">{m.desc}</p>
                  <span className="mood-count">Filter {m.tag}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Songs Library Workspace */}
        <section className="library-section" id="library">
          {/* Quick Action Box */}
          <div className="workspace-control-card">
            <div className="control-card-header">
              <div>
                <h3>Upload Tracks & AI Clustering</h3>
                <p>Import playlist via CSV file or paste any public Spotify playlist URL</p>
              </div>
              <div className="control-actions">
                <button 
                  className="btn-glass"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                >
                  📁 Upload CSV
                </button>
                <button 
                  className="btn-gradient-glow"
                  onClick={clusterSongs}
                  disabled={loading}
                >
                  {loading ? "Clustering..." : "🎯 Cluster by Mood"}
                </button>
              </div>
            </div>

            {/* Spotify Playlist Import Row */}
            <div className="spotify-import-box">
              <div className="spotify-input-wrapper">
                <span className="spotify-icon">🟢</span>
                <input 
                  type="text" 
                  className="spotify-input"
                  placeholder="Paste Spotify Playlist URL (e.g. https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M)"
                  value={spotifyUrl}
                  onChange={(e) => setSpotifyUrl(e.target.value)}
                  disabled={loading}
                />
              </div>
              <button 
                className="btn-spotify-upload"
                onClick={uploadSpotify}
                disabled={loading}
              >
                {loading ? "Importing..." : "⚡ Import Playlist"}
              </button>
            </div>
          </div>

          {/* Songs Table Card */}
          <div className="songs-table-card">
            <div className="table-header-bar">
              <div className="table-title">
                <span className="neon-note">🎶</span>
                <h3>All Songs ({filteredSongs.length})</h3>
              </div>
              <div className="table-actions-right">
                {activeMoodFilter !== 'All' && (
                  <button className="filter-reset-btn" onClick={() => setActiveMoodFilter('All')}>
                    Show All ({songs.length})
                  </button>
                )}
                <span className="table-subtext">Click any song to play • Click "💡 Get Similar" for AI match</span>
              </div>
            </div>

            {filteredSongs.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🎵</div>
                <p>No songs found for this filter. Upload a CSV file to get started!</p>
                <button className="btn-gradient-glow" onClick={() => fileInputRef.current?.click()}>
                  Upload songs.csv
                </button>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="sonic-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Track & Artist</th>
                      <th>Energy Level</th>
                      <th>Mood Cluster</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSongs.map((song, i) => {
                      const isRowSelected = selectedSong?.song_id === song.song_id;
                      return (
                        <tr 
                          key={song.song_id} 
                          className={isRowSelected ? 'active-row' : ''}
                          onClick={() => {
                            setSelectedSong(song);
                            setIsPlaying(true);
                            setCurrentPlaybackTime(0);
                          }}
                        >
                          <td className="col-index">
                            {isRowSelected && isPlaying ? "▶" : i + 1}
                          </td>
                          <td className="col-track">
                            <div className="track-info">
                              <div className="track-avatar">
                                <span>{isRowSelected ? "🎵" : "🎧"}</span>
                              </div>
                              <div>
                                <div className="track-name">{song.name}</div>
                                <div className="track-artist">{song.artist}</div>
                              </div>
                            </div>
                          </td>
                          <td className="col-energy">
                            <div className="energy-meter-container">
                              <div className="energy-bar-bg">
                                <div 
                                  className="energy-bar-fill" 
                                  style={{ width: `${Math.min(100, Math.max(10, song.energy * 100))}%` }}
                                ></div>
                              </div>
                              <span className="energy-val">{(song.energy * 100).toFixed(0)}%</span>
                            </div>
                          </td>
                          <td className="col-mood">
                            <span className={`neon-pill pill-${song.mood?.toLowerCase() || 'default'}`}>
                              {song.mood || 'Unclustered'}
                            </span>
                          </td>
                          <td className="col-action">
                            <div className="table-action-group">
                              <button 
                                className="btn-stream-pill-mini"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openSpotifyStream(song.name, song.artist);
                                }}
                                title="Stream full song on Spotify"
                              >
                                🟢 Stream
                              </button>
                              <button 
                                className="btn-similar-pill"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  getRecommendations(song);
                                }}
                                disabled={loading}
                              >
                                💡 Get Similar
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* AI Recommendations Panel */}
          <div className="recommendations-container" id="recommendations">
            <div className="rec-header">
              <div className="rec-tag">AI RECOMMENDATION ENGINE</div>
              <h2>
                {selectedSong ? (
                  <>Similar Tracks to <span className="gradient-text">"{selectedSong.name}"</span></>
                ) : (
                  "Select a Song to View Recommendations"
                )}
              </h2>
              {selectedSong && (
                <div className="selected-song-pill">
                  <span>Artist: <strong>{selectedSong.artist}</strong></span>
                  <span>Energy: <strong>{(selectedSong.energy * 100).toFixed(0)}%</strong></span>
                  <span>Mood: <strong>{selectedSong.mood}</strong></span>
                </div>
              )}
            </div>

            {recommendations.length === 0 ? (
              <div className="rec-prompt-box">
                <p>Click <strong>"💡 Get Similar"</strong> next to any track in the table above to calculate instant energy similarity rankings!</p>
                {selectedSong && (
                  <button className="btn-gradient-glow" onClick={() => getRecommendations(selectedSong)}>
                    Find Similar to "{selectedSong.name}"
                  </button>
                )}
              </div>
            ) : (
              <div className="rec-cards-grid">
                {recommendations.map((rec) => (
                  <div 
                    key={rec.song_id} 
                    className="rec-card"
                    onClick={() => {
                      setSelectedSong(rec);
                      setIsPlaying(true);
                      setCurrentPlaybackTime(0);
                      scrollToSection('home');
                    }}
                  >
                    <div className="rec-card-top">
                      <div className="rec-badge-similarity">
                        {(rec.similarity * 100).toFixed(0)}% MATCH
                      </div>
                      <span className={`neon-pill pill-${rec.mood?.toLowerCase() || 'default'}`}>
                        {rec.mood}
                      </span>
                    </div>

                    <div className="rec-card-body">
                      <div className="rec-avatar">🎵</div>
                      <h4 className="rec-song-name">{rec.name}</h4>
                      <p className="rec-artist-name">{rec.artist}</p>
                    </div>

                    <div className="rec-card-footer">
                      <div className="rec-energy-row">
                        <span>Energy</span>
                        <span>{(rec.energy * 100).toFixed(0)}%</span>
                      </div>
                      <div className="energy-bar-bg small">
                        <div 
                          className="energy-bar-fill" 
                          style={{ width: `${Math.min(100, Math.max(10, rec.energy * 100))}%` }}
                        ></div>
                      </div>
                      <div className="rec-card-actions-row">
                        <button className="btn-play-rec">▶ Play</button>
                        <button 
                          className="btn-stream-rec"
                          onClick={(e) => {
                            e.stopPropagation();
                            openSpotifyStream(rec.name, rec.artist);
                          }}
                          title="Stream full song on Spotify"
                        >
                          🟢 Stream
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="footer">
        <p>© 2026 Fretly • AI-Powered Music Recommendation Engine</p>
      </footer>
    </div>
  );
}

export default App;

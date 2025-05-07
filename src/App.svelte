<script lang="ts">


  import { onDestroy } from "svelte";
  import { onMount } from "svelte";


  //Everything related to the audio stream
  let audio: HTMLAudioElement | null = null;
  let track = "";
  let startTime = 0;
  let ws: WebSocket;
  let isPlaying = false;
  let currentOffset = 0;
  let currentTrackName = "";
  let trackDuration = 0;
  let progress = 0;
  let volume = 0.25; // Valeur par défaut (25%)

  // Mettre à jour l'offset en continu
  let offsetInterval: ReturnType<typeof setInterval>;

  let albumCover = '/default-cover.jpg';
  let albumName = 'Album inconnu';

  let isMuted = false;

  let connectedClients = 0;

  let showInfo = false;

  function updateOffset() {
    if (startTime > 0) {
      currentOffset = (Date.now() - startTime) / 1000;
      if (trackDuration > 0) {
        progress = (currentOffset / trackDuration) * 100;
      }
      if (audio && isPlaying) {
        // Resynchroniser si l'écart est trop important (plus de 1 seconde)
        const diff = Math.abs(audio.currentTime - currentOffset);
        if (diff > 1) {
          console.log("Resynchronisation, écart :", diff);
          audio.currentTime = currentOffset;
        }
      }
    }
  }

  function formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  function togglePlay() {
    if (!audio) return;
    
    if (isPlaying) {
      audio.pause();
    } else {
      audio.currentTime = currentOffset; // Reprendre à la position actuelle
      audio.play()
        .then(() => console.log("Audio started playing at:", currentOffset))
        .catch(e => console.error("Error playing audio:", e));
    }
    isPlaying = !isPlaying;
  }

  function nextTrack() {
    if (audio) {
      // On ne met plus en pause l'audio
      isPlaying = true; // On garde l'état de lecture
    }
    ws.send(JSON.stringify({ type: 'trackEnded' }));
  }

  function getTrackName(path: string): string {
    const parts = path.split('/');
    const filename = parts[parts.length - 1];
    return filename.replace('.mp3', '').replace('.flac', '');
  }

  function setupAudioListeners() {
    if (!audio) return;

    audio.onended = () => {
      // Ne déclencher le changement que si on est proche de la fin de la piste
      if (currentOffset >= trackDuration - 1) {
        console.log("Track ended naturally, requesting next track");
        nextTrack();
      }
    };
  }

  function setVolume(newVolume: number) {
    volume = newVolume;
    if (audio) {
      audio.volume = volume;
    }
    document.documentElement.style.setProperty('--volume', String(volume * 100));
  }

  function toggleMute() {
    isMuted = !isMuted;
    setVolume(isMuted ? 0 : 1);
  }

  function getAlbumInfo(trackPath: string) {
    // Le chemin est de la forme "music/album1/song.mp3"
    const parts = trackPath.split('/');
    if (parts.length >= 2) {
      const albumFolder = parts[1]; // "album1"
      albumCover = `/music/${albumFolder}/cover.png`;
      albumName = albumFolder.charAt(0).toUpperCase() + albumFolder.slice(1); // Capitalise le nom de l'album
    }
  }

  onMount(() => {
    console.log("Attempting to connect to WebSocket server...");
    ws = new WebSocket('ws://localhost:3001');

    // Démarrer la mise à jour de l'offset
    offsetInterval = setInterval(updateOffset, 100);

    // Initialiser la variable CSS pour le volume
    document.documentElement.style.setProperty('--volume', String(volume * 100));

    ws.onopen = () => {
      console.log("Connected to WebSocket server");
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    ws.onclose = () => {
      console.log("Disconnected from WebSocket server");
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'state') {
          console.log("Received state from server:", message.data);
          const fullTrackPath = message.data.track.startsWith("/") ? message.data.track : `/${message.data.track}`;
          console.log("Full track path:", fullTrackPath);
          
          const newTrack = fullTrackPath !== track;
          track = fullTrackPath;
          currentTrackName = getTrackName(message.data.track);
          getAlbumInfo(message.data.track);
          startTime = message.data.startTime;
          trackDuration = message.data.duration;
          currentOffset = (Date.now() - startTime) / 1000;
          connectedClients = message.data.connectedClients;

          try {
            if (!audio) {
              console.log("Creating new Audio instance");
              audio = new Audio(track);
              setupAudioListeners();
              audio.currentTime = currentOffset;
              if (isPlaying) {
                audio.play()
                  .then(() => console.log("Audio started playing"))
                  .catch(e => console.error("Error playing audio:", e));
              }
            } else if (newTrack) {
              console.log("Changing audio source");
              audio.src = track;
              audio.currentTime = currentOffset;
              if (isPlaying) {
                audio.play()
                  .then(() => console.log("Audio started playing"))
                  .catch(e => console.error("Error playing audio:", e));
              }
            }
            if (audio) {
              audio.volume = volume;
            }
          } catch (error) {
            console.error("Error handling audio:", error);
          }
        }
      } catch (error) {
        console.error("Error parsing message:", error);
      }
    };

    return () => {
      if (ws) {
        ws.close();
      }
      if (audio) {
        audio.pause();
        audio = null;
      }
      if (offsetInterval) {
        clearInterval(offsetInterval);
      }
    };
  });

  //Everything related to the elapsed time
  const startDate = new Date("2013-12-30T00:00:00Z");
  let elapsedTime = Date.now() - startDate.getTime();

  const interval = setInterval(() => {
    elapsedTime = Date.now() - startDate.getTime();
  }, 1000);

  
  onDestroy(() => clearInterval(interval));

  function formatElapsedTime(ms: number) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30.44); // Approximation des mois
    const years = Math.floor(months / 12);

    return {
      years,
      months: months % 12,
      days: days % 30.44 | 0,
      hours: String(hours % 24).padStart(2, "0"),
      minutes: String(minutes % 60).padStart(2, "0"),
      seconds: String(seconds % 60).padStart(2, "0")
    };
  }

</script>

<main>
  <div class="info-button" on:click={() => showInfo = !showInfo}>
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="16" x2="12" y2="12"></line>
      <line x1="12" y1="8" x2="12.01" y2="8"></line>
    </svg>
  </div>

  {#if showInfo}
    <div class="info-popup">
      <div class="info-content">
        <div class="header">
          <h2>About FGE Radio</h2>
          <button class="close-button" on:click={() => showInfo = false}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <p>This radio is a tribute to Foreground Eclipse, a band that has left its mark on the music scene with its unique creativity and talent.</p>
        <p>Our mission is to carry on their legacy by sharing their music with the world.</p>
        <p>Features:</p>
        <ul>
          <li>🎵 Non-stop Foreground Eclipse radio</li>
          <li>📻 Ad-free</li>
          <li>💫 Non-profit project</li>
        </ul>
        <p>Contact:</p>
        <div class="social-links">
          <a href="https://twitter.com/SukiFlavian" target="_blank" rel="noopener noreferrer">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
            </svg>
            Twitter
          </a>
          <div class="discord-info">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            <span>SukiFlavian</span>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <div class="connected-clients">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
      <circle cx="9" cy="7" r="4"></circle>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    </svg>
    <span>{connectedClients} {connectedClients > 1 ? 'listeners' : 'listener'}</span>
  </div>

  <div class="volume-control">
    <input 
      type="range" 
      min="0" 
      max="1" 
      step="0.01" 
      bind:value={volume} 
      on:input={() => setVolume(volume)}
      class="volume-slider"
    />
  </div>

  <p>Foreground Eclipse last album was released </p>
  {#await Promise.resolve(formatElapsedTime(elapsedTime)) then time}
    <h1>{time.years} Years, {time.months} Months, {time.days} Days,
    {time.hours}:{time.minutes}:{time.seconds} ago</h1>
  {/await}

  <div class="album-display">
    <img class="album-cover-large" src={albumCover} alt="Pochette d'album" />
    <div class="track-info-large">
      <div class="track-title-large">{currentTrackName}</div>
      <div class="album-name-large">{albumName}</div>
    </div>
  </div>

  <div class="player-layout">
    <div class="center-controls">
      <div class="buttons">
        <button on:click={togglePlay}>
          {isPlaying ? 'Pause' : 'Launch The Foreground Eclipse Radio'}
        </button>
      </div>
    </div>
  </div>

  <div class="progress-bar-bottom">
    <div class="progress-bar">
      <div class="progress-fill" style="width: {progress}%"></div>
    </div>
  </div>

</main>

<style>
  .album-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    margin: 40px auto;
    max-width: 400px;
  }

  .album-cover-large {
    width: 300px;
    height: 300px;
    border-radius: 8px;
    object-fit: cover;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    position: relative;
    z-index: 1;
  }

  .track-info-large {
    text-align: center;
  }

  .track-title-large {
    font-size: 1.8em;
    font-weight: bold;
    color: #c4d4e3;
    margin-bottom: 8px;
  }

  .album-name-large {
    font-size: 1.2em;
    color: rgb(242,233,226);
  }

  .player-layout {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    width: 100%;
    max-width: 700px;
    margin: 20px auto;
    padding: 0 20px;
  }

  .center-controls {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  button {
    padding: 10px 20px;
    font-size: 16px;
    cursor: pointer;
    background-color: rgb(242,233,226);
    color: #213547;
    border: none;
    border-radius: 4px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.08);
    transition: background 0.2s;
  }

  button:hover {
    background-color: rgb(227,211,196);
  }


  .progress-bar-bottom {
    position: fixed;
    left: 0;
    bottom: 0;
    width: 100vw;
    padding: 20px 0 0 0;
    z-index: 100;
    background: linear-gradient(to top, rgba(28, 44, 59, 1), rgba(28, 44, 59, 0.8));
  }

  .progress-bar {
    position: relative;
    width: 100%;
    height: 12px;
    background-color: rgba(238, 242, 247, 0.2);
    border-radius: 6px;
    margin: 0 auto 5px auto;
  }

  .progress-fill {
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    background-color: rgb(227,211,196);
    border-radius: 6px;
    transition: width 0.1s linear;
  }

  .progress-bar::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .connected-clients {
    position: fixed;
    top: 20px;
    right: 20px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background-color: rgba(28, 44, 59, 0.8);
    border-radius: 20px;
    color: rgb(242,233,226);
    font-size: 0.9em;
  }

  .connected-clients svg {
    width: 16px;
    height: 16px;
    stroke: rgb(242,233,226);
  }

  .volume-control {
    position: fixed;
    right: 20px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    z-index: 100;
  }

  .volume-slider {
    -webkit-appearance: none;
    width: 500px;
    height: 6px;
    background: rgba(238, 242, 247, 0.2);
    border-radius: 3px;
    transform: rotate(-90deg) translateX(250px);
    transform-origin: right;
    position: relative;
    margin: 0;
    padding: 0;
  }

  .volume-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 20px;
    height: 20px;
    background: rgb(242,233,226);
    border-radius: 50%;
    cursor: pointer;
    transition: background 0.2s;
    margin-top: -7px;
  }

  .volume-slider::-webkit-slider-thumb:hover {
    background: rgb(227,211,196);
  }

  .volume-slider::-moz-range-thumb {
    width: 20px;
    height: 20px;
    background: rgb(242,233,226);
    border-radius: 50%;
    cursor: pointer;
    transition: background 0.2s;
    border: none;
  }

  .volume-slider::-moz-range-thumb:hover {
    background: rgb(227,211,196);
  }

  .volume-slider::-webkit-slider-runnable-track {
    width: 100%;
    height: 6px;
    cursor: pointer;
    background: linear-gradient(to right, rgb(242,233,226) 0%, rgb(242,233,226) calc(var(--volume, 0) * 1%), rgba(238, 242, 247, 0.2) calc(var(--volume, 0) * 1%));
    border-radius: 3px;
    margin: 0;
    padding: 0;
  }

  .volume-slider::-moz-range-track {
    width: 100%;
    height: 6px;
    cursor: pointer;
    background: linear-gradient(to right, rgb(242,233,226) 0%, rgb(242,233,226) calc(var(--volume, 0) * 1%), rgba(238, 242, 247, 0.2) calc(var(--volume, 0) * 1%));
    border-radius: 3px;
    margin: 0;
    padding: 0;
  }

  .info-button {
    position: fixed;
    top: 20px;
    left: 20px;
    cursor: pointer;
    color: rgb(242,233,226);
    transition: transform 0.2s;
    z-index: 1000;
  }

  .info-button:hover {
    transform: scale(1.1);
  }

  .info-popup {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 999;
  }

  .info-content {
    background: #1c2c3b;
    padding: 2rem;
    border-radius: 8px;
    max-width: 500px;
    width: 90%;
    color: rgb(242,233,226);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .header h2 {
    margin: 0;
  }

  .close-button {
    background: rgba(242,233,226, 0.1);
    border: none;
    color: rgb(242,233,226);
    cursor: pointer;
    padding: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    border-radius: 4px;
    width: 32px;
    height: 32px;
  }

  .close-button:hover {
    transform: scale(1.1);
    background: rgba(242,233,226, 0.2);
  }

  .close-button svg {
    width: 20px;
    height: 20px;
  }

  .info-content p {
    margin: 1rem 0;
    line-height: 1.6;
  }

  .info-content ul {
    list-style: none;
    padding: 0;
    margin: 1rem 0;
  }

  .info-content li {
    margin: 0.5rem 0;
  }

  .social-links {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    margin-top: 1rem;
  }

  .social-links a {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: rgb(242,233,226);
    text-decoration: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    background: rgba(242,233,226, 0.1);
    transition: background 0.2s;
  }

  .social-links a:hover {
    background: rgba(242,233,226, 0.2);
  }

  .social-links svg {
    width: 20px;
    height: 20px;
  }

  .discord-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    background: rgba(242,233,226, 0.1);
    margin-left: auto;
  }

  .discord-info svg {
    width: 20px;
    height: 20px;
  }

</style>

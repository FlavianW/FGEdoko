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

</style>

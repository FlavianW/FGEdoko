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
  let volume = 1; // Valeur par défaut (100%)

  // Mettre à jour l'offset en continu
  let offsetInterval: ReturnType<typeof setInterval>;

  let albumCover = '/default-cover.jpg';
  let albumName = 'Album inconnu';

  let isMuted = false;

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
      audio.pause(); // Arrêter la lecture en cours
      isPlaying = false;
    }
    ws.send(JSON.stringify({ type: 'trackEnded' }));
  }

  function getTrackName(path: string): string {
    const parts = path.split('/');
    const filename = parts[parts.length - 1];
    return filename.replace('.mp3', '');
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
          getAlbumInfo(message.data.track); // Mettre à jour les infos de l'album
          startTime = message.data.startTime;
          trackDuration = message.data.duration;
          currentOffset = (Date.now() - startTime) / 1000;

          try {
            if (!audio) {
              console.log("Creating new Audio instance");
              audio = new Audio(track);
              setupAudioListeners();
              audio.currentTime = currentOffset;
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
          {isPlaying ? 'Pause' : 'Play'}
        </button>
      </div>
    </div>
  </div>

  <div class="progress-bar-bottom">
    <div class="progress-bar">
      <div class="progress-fill" style="width: {progress}%"></div>
    </div>
  </div>

  <button class="mute-button" on:click={toggleMute}>
    {#if isMuted}
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="1" y1="1" x2="23" y2="23"></line>
        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
        <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
        <line x1="12" y1="19" x2="12" y2="23"></line>
        <line x1="8" y1="23" x2="16" y2="23"></line>
      </svg>
    {:else}
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
      </svg>
    {/if}
  </button>
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
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
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

  .mute-button {
    position: fixed;
    bottom: 20px;
    left: 20px;
    background-color: transparent;
    box-shadow: none;
  }

  .mute-button svg {
    width: 24px;
    height: 24px;
    stroke: #c4d4e3;
  }

  .progress-bar-bottom {
    position: fixed;
    left: 0;
    bottom: 0;
    width: 100vw;
    padding: 12px 0 6px 0;
    z-index: 10;
  }

  .progress-bar {
    position: relative;
    width: 100%;
    height: 8px;
    background-color: rgba(238, 242, 247, 0.2);
    border-radius: 4px;
    margin: 0 auto 5px auto;
  }

  .progress-fill {
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    background-color: rgb(227,211,196);
    border-radius: 4px;
    transition: width 0.1s linear;
  }

  .progress-bar::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    -webkit-box-shadow: 0px 0px 20px 15px rgba(227, 211, 196, 0.3);
    -moz-box-shadow: 0px 0px 20px 15px rgba(227, 211, 196, 0.3);
    box-shadow: 0px 0px 20px 15px rgba(227, 211, 196, 0.3);
    pointer-events: none;
  }
</style>

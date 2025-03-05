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

  // Mettre à jour l'offset en continu
  let offsetInterval: ReturnType<typeof setInterval>;

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
    ws.send(JSON.stringify({ type: 'trackEnded' }));
  }

  function getTrackName(path: string): string {
    const parts = path.split('/');
    const filename = parts[parts.length - 1];
    return filename.replace('.mp3', '');
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
          startTime = message.data.startTime;
          trackDuration = message.data.duration;
          currentOffset = (Date.now() - startTime) / 1000;

          try {
            if (!audio) {
              console.log("Creating new Audio instance");
              audio = new Audio(track);
              setupAudioListeners();
            } else if (newTrack) {
              console.log("Changing audio source");
              audio.src = track;
              if (isPlaying) {
                audio.currentTime = currentOffset;
                audio.play()
                  .then(() => console.log("Audio started playing"))
                  .catch(e => console.error("Error playing audio:", e));
              }
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

  function setupAudioListeners() {
    if (!audio) return;

    audio.onended = () => {
      // Ne déclencher le changement que si on est proche de la fin de la piste
      if (currentOffset >= trackDuration - 1) {
        console.log("Track ended naturally, requesting next track");
        ws.send(JSON.stringify({ type: 'trackEnded' }));
      }
    };

  }

  //Everything related to the elapsed time
  const startDate = new Date("2012-12-01T00:00:00Z");
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

  <div class="controls">
    <div class="track-info">
      <h2>Now Playing:</h2>
      <p>{currentTrackName}</p>
    </div>
    <div class="progress-container">
      <div class="progress-bar">
        <div class="progress-fill" style="width: {progress}%"></div>
      </div>
      <div class="time-display">
        <span>{formatTime(currentOffset)}</span>
        <span>{formatTime(trackDuration)}</span>
      </div>
    </div>
    <div class="buttons">
      <button on:click={togglePlay}>
        {isPlaying ? 'Pause' : 'Play'}
      </button>
      <button on:click={nextTrack}>
        Next Track
      </button>
    </div>
  </div>
</main>

<style>
  .controls {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    margin-top: 30px;
    width: 100%;
    max-width: 600px;
    margin-left: auto;
    margin-right: auto;
  }

  .track-info {
    text-align: center;
    width: 100%;
  }

  .track-info h2 {
    margin: 0;
    font-size: 1.2em;
    color: #666;
  }

  .track-info p {
    margin: 5px 0;
    font-size: 1.4em;
    font-weight: bold;
  }

  .progress-container {
    width: 100%;
  }

  .progress-bar {
    width: 100%;
    height: 8px;
    background-color: #ddd;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 5px;
  }

  .progress-fill {
    height: 100%;
    background-color: #4CAF50;
    transition: width 0.1s linear;
  }

  .time-display {
    display: flex;
    justify-content: space-between;
    font-family: monospace;
    font-size: 0.9em;
    color: #666;
  }

  .buttons {
    display: flex;
    gap: 10px;
  }

  button {
    padding: 10px 20px;
    font-size: 16px;
    cursor: pointer;
    background-color: #4CAF50;
    color: white;
    border: none;
    border-radius: 4px;
  }

  button:hover {
    background-color: #45a049;
  }
</style>

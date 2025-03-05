import { WebSocketServer, WebSocket } from 'ws';
import { readdirSync } from 'fs';
import { join } from 'path';
import { getAudioDurationInSeconds } from 'get-audio-duration';

const wss = new WebSocketServer({ port: 3001 });

interface Track {
    path: string;
    duration: number;
}

let currentTrack: Track | null = null;
let startTime = Date.now();
let playedTracks: Set<string> = new Set();
let allTracks: Track[] = [];

// Fonction pour charger toutes les pistes disponibles
async function loadAllTracks(): Promise<Track[]> {
    const tracks: Track[] = [];
    const albumsPath = join(process.cwd(), 'public', 'music');
    
    try {
        const albums = readdirSync(albumsPath, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);

        for (const album of albums) {
            const songsPath = join(albumsPath, album);
            const songs = readdirSync(songsPath)
                .filter(file => file.endsWith('.mp3'));
            
            for (const song of songs) {
                const trackPath = `music/${album}/${song}`;
                const duration = await getAudioDurationInSeconds(join(process.cwd(), 'public', trackPath));
                tracks.push({ path: trackPath, duration });
            }
        }
    } catch (error) {
        console.error('Error loading tracks:', error);
    }

    return tracks;
}

// Fonction pour obtenir une piste aléatoire non jouée
async function getRandomTrack(): Promise<Track> {
    // Si toutes les pistes ont été jouées, réinitialiser la liste
    if (playedTracks.size >= allTracks.length) {
        console.log('All tracks have been played, resetting playlist');
        playedTracks.clear();
        // Ne pas effacer la piste actuelle de playedTracks pour éviter de la rejouer immédiatement
        if (currentTrack) {
            playedTracks.add(currentTrack.path);
        }
    }

    // Filtrer les pistes non jouées
    const availableTracks = allTracks.filter(track => !playedTracks.has(track.path));
    
    if (availableTracks.length === 0) {
        // Cela ne devrait jamais arriver grâce à la vérification précédente
        console.error('No available tracks found');
        return allTracks[0];
    }

    // Choisir une piste aléatoire parmi les disponibles
    const randomTrack = availableTracks[Math.floor(Math.random() * availableTracks.length)];
    playedTracks.add(randomTrack.path);
    
    return randomTrack;
}

async function changeTrack() {
    currentTrack = await getRandomTrack();
    startTime = Date.now();
    console.log('Changing to track:', currentTrack.path, 'Duration:', currentTrack.duration);
    console.log('Played tracks:', playedTracks.size, '/', allTracks.length);
    
    broadcastState();
}

function broadcastState() {
    if (!currentTrack) return;

    const currentTime = Date.now();
    const elapsed = (currentTime - startTime) / 1000;

    // Si la piste actuelle est terminée, en choisir une nouvelle
    if (elapsed >= currentTrack.duration) {
        const timeOverrun = elapsed - currentTrack.duration;
        startTime = currentTime - (timeOverrun * 1000);
        changeTrack();
        return;
    }

    // Informer tous les clients de l'état actuel
    wss.clients.forEach(function each(client) {
        if (client.readyState === WebSocket.OPEN && currentTrack) {
            client.send(JSON.stringify({
                type: 'state',
                data: {
                    track: currentTrack.path,
                    startTime,
                    duration: currentTrack.duration
                }
            }));
        }
    });
}

// Charger toutes les pistes au démarrage
loadAllTracks().then(tracks => {
    allTracks = tracks;
    console.log(`Loaded ${tracks.length} tracks`);
    // Initialiser la première piste
    return getRandomTrack();
}).then(track => {
    currentTrack = track;
    broadcastState();
});

// Vérifier régulièrement si la piste est terminée
setInterval(() => {
    broadcastState();
}, 1000);

wss.on('connection', function connection(ws) {
    console.log('Client connected');

    // Envoyer l'état actuel au nouveau client
    if (currentTrack) {
        broadcastState();
    }

    ws.on('message', function incoming(message) {
        try {
            const data = JSON.parse(message.toString());
            if (data.type === 'trackEnded') {
                console.log('Track ended, changing to next track');
                changeTrack();
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    // On garde juste un log de déconnexion pour le debug
    ws.on('close', () => {
        console.log('Client disconnected');
    });
}); 

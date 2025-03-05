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

// Fonction pour obtenir un chemin de fichier aléatoire
async function getRandomTrack(): Promise<Track> {
    try {
        // Lister tous les albums
        const albumsPath = join(process.cwd(), 'public', 'music');
        const albums = readdirSync(albumsPath, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);

        if (albums.length === 0) {
            const defaultPath = "music/album1/Storytellers.mp3";
            const duration = await getAudioDurationInSeconds(join(process.cwd(), 'public', defaultPath));
            return { path: defaultPath, duration };
        }

        // Choisir un album au hasard
        const randomAlbum = albums[Math.floor(Math.random() * albums.length)];
        
        // Lister toutes les chansons de l'album
        const songsPath = join(albumsPath, randomAlbum);
        const songs = readdirSync(songsPath)
            .filter(file => file.endsWith('.mp3'));

        if (songs.length === 0) {
            const defaultPath = "music/album1/chanson1.mp3";
            const duration = await getAudioDurationInSeconds(join(process.cwd(), 'public', defaultPath));
            return { path: defaultPath, duration };
        }

        // Choisir une chanson au hasard
        const randomSong = songs[Math.floor(Math.random() * songs.length)];
        const trackPath = `music/${randomAlbum}/${randomSong}`;
        const duration = await getAudioDurationInSeconds(join(process.cwd(), 'public', trackPath));
        
        return { path: trackPath, duration };
    } catch (error) {
        console.error('Error getting random track:', error);
        const defaultPath = "music/album1/chanson1.mp3";
        const duration = await getAudioDurationInSeconds(join(process.cwd(), 'public', defaultPath));
        return { path: defaultPath, duration };
    }
}

async function changeTrack() {
    currentTrack = await getRandomTrack();
    startTime = Date.now();
    console.log('Changing to track:', currentTrack.path, 'Duration:', currentTrack.duration);
    
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

// Initialiser la première piste
getRandomTrack().then(track => {
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

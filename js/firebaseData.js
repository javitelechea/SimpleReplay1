/* ═══════════════════════════════════════════
SimpleReplay — Firebase Data Module
Saves/loads projects to Firestore
═══════════════════════════════════════════ */

const FirebaseData = (() => {
    // Firebase config
    const firebaseConfig = {
        apiKey: "AIzaSyB9CTnhEXXOUAdHpI9Ne23PKzuN8lQtuGQ",
        authDomain: "simplereplay-6a425.firebaseapp.com",
        projectId: "simplereplay-6a425",
        storageBucket: "simplereplay-6a425.firebasestorage.app",
        messagingSenderId: "268601479367",
        appId: "1:268601479367:web:e34f198b194abf4b88aee2"
    };

    // Initialize Firebase (compat SDK)
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();

    /**
     * Save a full project to Firestore.
     * If projectId is provided, overwrites that document.
     * Otherwise creates a new one.
     * Returns the projectId.
     */
    async function saveProject(projectId, data) {
        const doc = {
            title: data.title || 'Sin título',
            youtubeVideoId: data.youtubeVideoId || '',
            tagTypes: data.tagTypes || [],
            games: data.games || [],
            clips: data.clips || [],
            playlists: data.playlists || [],
            playlistItems: data.playlistItems || {},
            clipFlags: data.clipFlags || {},
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        };

        // Timeout wrapper to avoid infinite hang
        const timeout = (ms) => new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Tiempo agotado. Verificá tu conexión a internet y que Firestore esté activo.')), ms));

        const doSave = async () => {
            if (projectId) {
                await db.collection('projects').doc(projectId).set(doc, { merge: true });
                return projectId;
            } else {
                doc.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                const ref = await db.collection('projects').add(doc);
                return ref.id;
            }
        };

        return Promise.race([doSave(), timeout(15000)]);
    }

    /**
     * Load a project from Firestore by its ID.
     * Returns the project data or null if not found.
     */
    async function loadProject(projectId) {
        try {
            const snap = await db.collection('projects').doc(projectId).get();
            if (!snap.exists) return null;
            return { id: snap.id, ...snap.data() };
        } catch (err) {
            console.error('Error loading project:', err);
            return null;
        }
    }

    /**
     * Generate a shareable URL for a project, optionally scoped to a game and/or playlist.
     */
    function getShareUrl(projectId, gameId = null, playlistId = null) {
        const url = new URL(window.location.href);
        const params = new URLSearchParams();
        params.set('project', projectId);
        if (gameId) params.set('game', gameId);
        if (playlistId) params.set('playlist', playlistId);
        return url.origin + url.pathname + '?' + params.toString();
    }

    /**
     * Get the playlist ID from the current URL, if any.
     */
    function getPlaylistIdFromUrl() {
        const params = new URLSearchParams(window.location.search);
        return params.get('playlist') || null;
    }

    /**
     * Get the game ID from the current URL, if any.
     */
    function getGameIdFromUrl() {
        const params = new URLSearchParams(window.location.search);
        return params.get('game') || null;
    }

    /**
     * Get the project ID from the current URL, if any.
     */
    function getProjectIdFromUrl() {
        const params = new URLSearchParams(window.location.search);
        return params.get('project') || null;
    }

    /**
     * Local storage management for user's projects
     */
    function getLocalProjects() {
        try {
            const stored = localStorage.getItem('sr_my_projects');
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            return [];
        }
    }

    function addProjectLocally(projectId) {
        const ids = getLocalProjects();
        if (!ids.includes(projectId)) {
            ids.push(projectId);
            localStorage.setItem('sr_my_projects', JSON.stringify(ids));
        }
    }

    function removeProjectLocally(projectId) {
        let ids = getLocalProjects();
        ids = ids.filter(id => id !== projectId);
        localStorage.setItem('sr_my_projects', JSON.stringify(ids));
    }

    /**
     * List user's saved projects based on local storage tracking.
     */
    async function listProjects() {
        try {
            const projectIds = getLocalProjects();
            if (projectIds.length === 0) return [];

            const promises = projectIds.map(id => loadProject(id));
            const results = await Promise.all(promises);
            // Filter out nulls (deleted projects) and map to summary objects
            return results.filter(p => p !== null).map(p => ({
                id: p.id,
                title: p.title || 'Sin título',
                updatedAt: p.updatedAt?.toDate?.() || null,
                youtubeVideoId: p.youtubeVideoId || ''
            })).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        } catch (err) {
            console.error('Error listing projects:', err);
            return [];
        }
    }

    return {
        saveProject,
        loadProject,
        listProjects,
        getShareUrl,
        getProjectIdFromUrl,
        getPlaylistIdFromUrl,
        addProjectLocally,
        removeProjectLocally
    };
})();

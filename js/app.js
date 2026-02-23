/* ═══════════════════════════════════════════
   SimpleReplay — Main Application
   Event wiring, keyboard shortcuts, init
   ═══════════════════════════════════════════ */

(function () {
    'use strict';

    const $ = UI.$;

    // Extract YouTube video ID from any input (full URL or raw ID)
    function extractYouTubeId(input) {
        if (!input) return '';
        input = input.trim();
        // Full URL patterns
        const patterns = [
            /(?:youtube\.com\/watch\?.*v=)([a-zA-Z0-9_-]{11})/,
            /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
            /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
            /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
            /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
        ];
        for (const pat of patterns) {
            const match = input.match(pat);
            if (match) return match[1];
        }
        // If it looks like a raw ID (11 chars, alphanumeric + _ -)
        if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
        // Return as-is as fallback
        return input;
    }

    // ═══════════════════════════════════════
    // STATE → UI BINDINGS
    // ═══════════════════════════════════════

    let hasUnsavedChanges = false;

    // Reset unsaved changes on load/save
    AppState.on('projectLoaded', () => hasUnsavedChanges = false);
    AppState.on('projectSaved', () => hasUnsavedChanges = false);

    // Mark as unsaved when anything editable changes
    const markUnsaved = () => hasUnsavedChanges = true;
    AppState.on('clipChanged', markUnsaved);
    AppState.on('clipsUpdated', markUnsaved);
    AppState.on('playlistsUpdated', markUnsaved);
    AppState.on('flagsUpdated', markUnsaved);
    AppState.on('clipCommentsUpdated', markUnsaved);
    AppState.on('tagTypesUpdated', markUnsaved);

    window.addEventListener('beforeunload', (e) => {
        if (hasUnsavedChanges) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    AppState.on('modeChanged', () => {
        UI.updateMode();
    });

    AppState.on('gameChanged', (game) => {
        UI.updateNoGameOverlay();
        UI.renderGameSelector();
        UI.renderAnalyzeClips();
        UI.renderAnalyzePlaylists();
        UI.renderViewClips();
        UI.renderViewSources();
        UI.updateClipEditControls();
        if (game) {
            YTPlayer.loadVideo(game.youtube_video_id);
        }
    });

    AppState.on('clipChanged', (clip) => {
        UI.renderAnalyzeClips();
        UI.renderViewClips();
        UI.updateClipEditControls();
        UI.updateFlagButtons();
        UI.updateFocusView();
    });

    AppState.on('clipsUpdated', () => {
        UI.renderAnalyzeClips();
        UI.renderViewClips();
    });

    AppState.on('playlistsUpdated', () => {
        UI.renderAnalyzePlaylists();
        UI.renderViewSources();
    });

    AppState.on('flagsUpdated', () => {
        UI.renderAnalyzeClips();
        UI.renderViewClips();
        UI.updateFlagButtons();
        UI.updateFocusView();
    });

    AppState.on('viewFiltersChanged', () => {
        UI.renderViewSources();
        UI.updateFlagFilterBar();
        UI.renderViewClips();
        // Show/hide reset button
        const hasFilters = AppState.get('activeTagFilters').length > 0 ||
            AppState.get('activePlaylistId') ||
            AppState.get('filterFlags').length > 0;
        const resetBtn = UI.$('#btn-reset-all-filters');
        if (resetBtn) resetBtn.style.display = hasFilters ? 'inline-flex' : 'none';
    });

    AppState.on('panelToggled', () => {
        UI.updatePanelState();
    });

    AppState.on('focusViewToggled', () => {
        UI.updateFocusView();
        UI.updatePanelState();
    });

    AppState.on('tagTypesUpdated', () => {
        UI.renderTagButtons();
        UI.renderViewSources();
    });

    // ═══════════════════════════════════════
    // DOM EVENT LISTENERS
    // ═══════════════════════════════════════

    // Mode toggle
    $('#btn-mode-analyze').addEventListener('click', () => AppState.setMode('analyze'));
    $('#btn-mode-view').addEventListener('click', () => AppState.setMode('view'));

    // Game selector
    $('#game-selector').addEventListener('change', (e) => {
        const id = e.target.value;
        AppState.setCurrentGame(id || null);
    });

    // New game modal
    $('#btn-new-game').addEventListener('click', () => {
        $('#modal-new-game').classList.remove('hidden');
        $('#input-game-title').focus();
    });

    $('#btn-cancel-game').addEventListener('click', () => {
        UI.hideModal('modal-new-game');
    });

    // Close modals on backdrop click
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', () => {
            backdrop.closest('.modal').classList.add('hidden');
        });
    });

    $('#btn-save-game').addEventListener('click', () => {
        const title = $('#input-game-title').value.trim();
        const rawYtInput = $('#input-youtube-id').value.trim();
        if (!title) { UI.toast('Ingresá un título', 'error'); return; }
        if (!rawYtInput) { UI.toast('Ingresá un link o ID de YouTube', 'error'); return; }

        const ytId = extractYouTubeId(rawYtInput);
        if (!ytId) { UI.toast('No se pudo extraer el Video ID', 'error'); return; }

        const game = AppState.addGame(title, ytId);
        AppState.setCurrentGame(game.id);
        UI.hideModal('modal-new-game');
        $('#input-game-title').value = '';
        $('#input-youtube-id').value = '';
        UI.toast(`Partido creado: ${title}`, 'success');
    });

    // Panel collapse
    $('#btn-collapse-panel').addEventListener('click', () => AppState.togglePanel());
    $('#btn-expand-panel').addEventListener('click', () => AppState.togglePanel());

    // Clip edit buttons
    $('#clip-edit-controls').addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        if (!action) return;
        const clipId = AppState.get('currentClipId');
        if (!clipId) return;

        switch (action) {
            case 'in-minus': AppState.updateClipBounds(clipId, 'start_sec', -1); break;
            case 'in-plus': AppState.updateClipBounds(clipId, 'start_sec', 1); break;
            case 'out-minus': AppState.updateClipBounds(clipId, 'end_sec', -1); break;
            case 'out-plus': AppState.updateClipBounds(clipId, 'end_sec', 1); break;
            case 'delete-clip':
                AppState.deleteClip(clipId);
                UI.toast('Clip eliminado', 'success');
                break;
        }
    });

    // Source group toggles (collapsible Tags/Playlists in View mode)
    document.querySelectorAll('.source-group-toggle').forEach(toggle => {
        toggle.addEventListener('click', () => {
            const targetId = toggle.dataset.toggle;
            const body = document.getElementById(targetId);
            if (!body) return;
            const isCollapsed = body.classList.contains('collapsed');
            body.classList.toggle('collapsed', !isCollapsed);
            toggle.classList.toggle('open', isCollapsed);
        });
    });

    // Create playlist
    $('#btn-create-playlist').addEventListener('click', () => {
        const nameInput = $('#new-playlist-name');
        const name = nameInput.value.trim();
        if (!name) { UI.toast('Ingresá un nombre', 'error'); return; }
        if (!AppState.get('currentGameId')) { UI.toast('Primero seleccioná un partido', 'error'); return; }
        AppState.addPlaylist(name);
        nameInput.value = '';
        UI.toast(`Playlist creada: ${name}`, 'success');
    });

    // Add selected clips to playlist (View mode multi-select)
    $('#btn-add-selected-to-playlist').addEventListener('click', () => {
        const selected = UI.getSelectedClipIds();
        if (selected.length === 0) { UI.toast('Seleccioná al menos un clip', 'error'); return; }

        const playlists = AppState.get('playlists');
        if (playlists.length === 0) { UI.toast('Creá una playlist primero (o creala en el modal)', 'error'); }

        UI.showAddToPlaylistModal(selected);
    });

    // Create playlist from modal
    $('#btn-create-playlist-modal').addEventListener('click', () => {
        const nameInput = $('#new-playlist-name-modal');
        const name = nameInput.value.trim();
        if (!name) { UI.toast('Ingresá un nombre', 'error'); return; }
        if (!AppState.get('currentGameId')) { UI.toast('Primero seleccioná un partido', 'error'); return; }

        AppState.addPlaylist(name);
        nameInput.value = '';
        UI.toast(`Playlist creada: ${name}`, 'success');
        if (UI.renderPlaylistModalList) {
            UI.renderPlaylistModalList();
        }
    });

    $('#new-playlist-name-modal').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') $('#btn-create-playlist-modal').click();
    });

    // Enter key on playlist name
    $('#new-playlist-name').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') $('#btn-create-playlist').click();
    });

    // Tag editor toggle
    $('#btn-toggle-tag-editor').addEventListener('click', () => {
        UI.toggleTagEditor();
    });

    // Inline tag editor buttons
    $('#btn-save-tag').addEventListener('click', () => UI.saveTagFromEditor());
    $('#btn-delete-tag').addEventListener('click', () => UI.deleteTagFromEditor());
    $('#btn-cancel-tag-edit').addEventListener('click', () => UI.closeTagInlineEditor());
    $('#edit-tag-label').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') UI.saveTagFromEditor();
        if (e.key === 'Escape') UI.closeTagInlineEditor();
    });

    // Add to playlist modal cancel
    $('#btn-cancel-add-playlist').addEventListener('click', () => {
        UI.hideModal('modal-add-to-playlist');
    });

    // Flag filter buttons (View mode) - toggle filter
    $('#flag-filter-bar').addEventListener('click', (e) => {
        const btn = e.target.closest('.flag-btn');
        if (!btn) return;
        const flag = btn.dataset.flag;
        AppState.toggleFilterFlag(flag);
    });

    // Clear flag filter
    $('#btn-clear-flag-filter').addEventListener('click', () => {
        AppState.clearFilterFlags();
    });

    // Reset ALL filters
    $('#btn-reset-all-filters').addEventListener('click', () => {
        AppState.clearAllFilters();
    });

    // ═══ PROJECTS LIST ═══
    $('#btn-my-projects').addEventListener('click', async () => {
        UI.showModal('modal-projects');
        const container = $('#project-list');
        container.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;text-align:center;padding:16px;">Cargando...</p>';
        try {
            const projects = await FirebaseData.listProjects();
            if (projects.length === 0) {
                container.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;text-align:center;padding:16px;">No hay proyectos guardados todavía. Usá 💾 Guardar para crear uno.</p>';
            } else {
                container.innerHTML = '';
                projects.forEach(p => {
                    const div = document.createElement('div');
                    div.className = 'project-item';
                    const date = p.updatedAt ? p.updatedAt.toLocaleDateString('es-AR') : '';
                    div.innerHTML = `
                        <div class="project-info">
                            <span class="project-title">${p.title}</span>
                            <span class="project-date">${date}</span>
                        </div>
                        <div class="project-actions">
                            <button class="btn btn-xs btn-share project-share-btn" data-project-id="${p.id}" title="Copiar link">🔗</button>
                            <button class="btn btn-xs btn-primary project-load-btn" data-project-id="${p.id}">Abrir</button>
                            <button class="btn btn-xs btn-danger project-delete-btn" data-project-id="${p.id}" title="Eliminar de mi lista">🗑️</button>
                        </div>
                    `;
                    container.appendChild(div);
                });
                // Attach share handlers
                container.querySelectorAll('.project-share-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const url = FirebaseData.getShareUrl(btn.dataset.projectId);
                        navigator.clipboard.writeText(url).then(() => {
                            UI.toast('🔗 Link copiado', 'success');
                        }).catch(() => { prompt('Copiá este link:', url); });
                    });
                });
                // Attach load handlers
                container.querySelectorAll('.project-load-btn').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const pid = btn.dataset.projectId;
                        UI.hideModal('modal-projects');
                        UI.toast('Cargando proyecto...', '');
                        const loaded = await AppState.loadFromCloud(pid);
                        if (loaded) {
                            FirebaseData.addProjectLocally(pid);
                            UI.toast('Proyecto cargado ✅', 'success');
                            UI.refreshAll();
                            const game = AppState.getCurrentGame();
                            if (game && game.youtube_video_id) {
                                YTPlayer.loadVideo(game.youtube_video_id);
                            }
                            const url = FirebaseData.getShareUrl(pid);
                            window.history.replaceState({}, '', url);
                        } else {
                            UI.toast('Error al cargar el proyecto', 'error');
                        }
                    });
                });
                // Attach delete handlers
                container.querySelectorAll('.project-delete-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const pid = btn.dataset.projectId;
                        if (confirm('¿Seguro que querés eliminar este proyecto de tu lista local? (No se borrará de la nube si otro tiene el link)')) {
                            FirebaseData.removeProjectLocally(pid);
                            btn.closest('.project-item').remove();
                            if (container.querySelectorAll('.project-item').length === 0) {
                                container.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;text-align:center;padding:16px;">Lista de proyectos vacía.</p>';
                            }
                        }
                    });
                });
            }
        } catch (err) {
            container.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;text-align:center;padding:16px;">Error al conectar con Firebase. Verificá que Firestore esté activo.</p>';
            console.error('List projects error:', err);
        }
    });

    $('#btn-close-projects').addEventListener('click', () => {
        UI.hideModal('modal-projects');
    });

    // Focus view toggle
    $('#btn-focus-view').addEventListener('click', () => {
        AppState.toggleFocusView();
    });

    // Nav arrows
    $('#btn-prev-clip').addEventListener('click', () => {
        AppState.navigateClip('prev');
        const clip = AppState.getCurrentClip();
        if (clip) YTPlayer.playClip(clip.start_sec, clip.end_sec);
    });

    $('#btn-next-clip').addEventListener('click', () => {
        AppState.navigateClip('next');
        const clip = AppState.getCurrentClip();
        if (clip) YTPlayer.playClip(clip.start_sec, clip.end_sec);
    });

    // ═══════════════════════════════════════
    // KEYBOARD SHORTCUTS
    // ═══════════════════════════════════════

    document.addEventListener('keydown', (e) => {
        // Don't handle shortcuts when typing in inputs
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

        const mode = AppState.get('mode');

        // Arrow keys: seek video (Analyze mode)
        if (mode === 'analyze') {
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                const t = YTPlayer.getCurrentTime();
                YTPlayer.seekTo(Math.max(0, t - 5));
                return;
            }
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                const t = YTPlayer.getCurrentTime();
                YTPlayer.seekTo(t + 5);
                return;
            }

            // Check for tag hotkeys
            const activeKey = e.key.toLowerCase();
            const tagBtn = document.querySelector(`.tag-btn[data-hotkey="${activeKey}"]`);
            if (tagBtn) {
                e.preventDefault();
                tagBtn.click();
                return;
            }
        }

        // Arrow keys: navigate clips (View mode)
        if (mode === 'view') {
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                AppState.navigateClip('prev');
                const clip = AppState.getCurrentClip();
                if (clip) YTPlayer.playClip(clip.start_sec, clip.end_sec);
                return;
            }
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                AppState.navigateClip('next');
                const clip = AppState.getCurrentClip();
                if (clip) YTPlayer.playClip(clip.start_sec, clip.end_sec);
                return;
            }

            // Number keys 1-4: toggle flags
            const clip = AppState.getCurrentClip();
            if (clip) {
                const flagMap = { '1': 'bueno', '2': 'acorregir', '3': 'duda', '4': 'importante' };
                if (flagMap[e.key]) {
                    e.preventDefault();
                    const flag = flagMap[e.key];
                    AppState.toggleFlag(clip.id, flag);
                    const flags = AppState.getClipUserFlags(clip.id);
                    const emoji = UI.FLAG_EMOJI[flag];
                    const has = flags.includes(flag);
                    UI.toast(`${emoji} ${has ? 'agregado' : 'quitado'}`, has ? 'success' : '');
                    return;
                }
            }
        }

        // Escape: close modals or exit focus
        if (e.key === 'Escape') {
            // Close any open modal
            document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden'));
            // Exit focus view
            if (AppState.get('focusView')) {
                AppState.toggleFocusView();
            }
        }

        // F key: toggle focus view (View mode)
        if (e.key === 'f' && mode === 'view') {
            e.preventDefault();
            AppState.toggleFocusView();
        }

        // Space: play/pause handled by YouTube player naturally
    });



    // ═══════════════════════════════════════
    // SAVE / SHARE
    // ═══════════════════════════════════════

    $('#btn-save-project').addEventListener('click', async () => {
        const btn = $('#btn-save-project');

        // Before saving the first time, if we have custom games + the demo game, let's remove the demo game
        const hasCustomGames = AppState.get('games').some(g => g.id !== 'game-demo-1');
        if (hasCustomGames) {
            const demoIdx = AppState.get('games').findIndex(g => g.id === 'game-demo-1');
            if (demoIdx >= 0) {
                // If demo game exists, we remove it from the state
                AppState.get('games').splice(demoIdx, 1);
            }
        }

        btn.disabled = true;
        btn.textContent = '⏳ Guardando...';
        try {
            const projectId = await AppState.saveToCloud();
            FirebaseData.addProjectLocally(projectId);
            UI.toast('Proyecto guardado ✅', 'success');
            // Show share button
            $('#btn-share-project').style.display = 'inline-flex';
        } catch (err) {
            console.error('Save error:', err);
            UI.toast('Error al guardar: ' + err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = '💾 Guardar';
        }
    });

    $('#btn-share-project').addEventListener('click', () => {
        const projectId = AppState.get('currentProjectId');
        const gameId = AppState.get('currentGameId');
        if (!projectId) {
            UI.toast('Primero guardá el proyecto', 'error');
            return;
        }
        const url = FirebaseData.getShareUrl(projectId, gameId);
        navigator.clipboard.writeText(url).then(() => {
            UI.toast('🔗 Link copiado al portapapeles', 'success');
        }).catch(() => {
            // Fallback: show URL in prompt
            prompt('Copiá este link:', url);
        });
    });

    // Show share button if project is already saved
    AppState.on('projectSaved', () => {
        $('#btn-share-project').style.display = 'inline-flex';
    });

    AppState.on('projectLoaded', () => {
        $('#btn-share-project').style.display = 'inline-flex';
    });

    // ═══════════════════════════════════════
    // PLAYLIST SHARE
    // ═══════════════════════════════════════

    $('#analyze-playlists').addEventListener('click', (e) => {
        const btn = e.target.closest('.pl-share-btn');
        if (!btn) return;
        const playlistId = btn.dataset.playlistId;
        const projectId = AppState.get('currentProjectId');

        if (!projectId) {
            UI.toast('Primero guardá el proyecto para compartir', 'error');
            return;
        }

        const url = FirebaseData.getShareUrl(projectId, null, playlistId);
        navigator.clipboard.writeText(url).then(() => {
            UI.toast('🔗 Link de playlist copiado', 'success');
        }).catch(() => {
            prompt('Copiá este link:', url);
        });
    });

    // ═══════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════

    async function init() {
        // Init state (loads demo data as default)
        AppState.init();

        // Init YouTube Player
        await YTPlayer.init();

// Check if loading a shared project from URL
const projectIdFromUrl = FirebaseData.getProjectIdFromUrl();
const playlistIdFromUrl = FirebaseData.getPlaylistIdFromUrl();

if (projectIdFromUrl) {
    UI.toast('Cargando proyecto...', '');
    const loaded = await AppState.loadFromCloud(projectIdFromUrl);

    if (loaded) {
        FirebaseData.addProjectLocally(projectIdFromUrl);
        UI.toast('Proyecto cargado ✅', 'success');

        // Si existe gameIdFromUrl, asegurate de haberlo declarado arriba
        // (si no, comentá estas 3 líneas)
        if (typeof gameIdFromUrl !== 'undefined' && gameIdFromUrl) {
            AppState.setCurrentGame(gameIdFromUrl);
        }

        const game = AppState.getCurrentGame();
        if (game && game.youtube_video_id) {
            YTPlayer.loadVideo(game.youtube_video_id);
        }
    } else {
        UI.toast('No se pudo cargar el proyecto', 'error');
    }

} else {
    // Auto-select first game for demo
    const games = AppState.get('games');
    if (games.length > 0) {
        AppState.setCurrentGame(games[0].id);
    }
}
        // Apply playlist-only mode if requested
        if (playlistIdFromUrl) {
            document.body.classList.add('playlist-only-mode');
            AppState.setMode('view');
            AppState.setPlaylistFilter(playlistIdFromUrl);
        }

        // Render initial UI
        UI.refreshAll();
    }

    init();

})();

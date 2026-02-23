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

    AppState.on('commentAdded', async () => {
        markUnsaved();
        if (AppState.get('currentProjectId')) {
            try {
                // Auto-save silently so viewers can add comments easily
                await AppState.saveToCloud();
            } catch (e) { console.error('Error auto-saving comment', e); }
        }
    });

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

    AppState.on('clipCommentsUpdated', () => {
        UI.renderNotifications();
    });

    // ═══════════════════════════════════════
    // DOM EVENT LISTENERS
    // ═══════════════════════════════════════

    // Mode toggle
    $('#btn-mode-analyze').addEventListener('click', () => AppState.setMode('analyze'));
    $('#btn-mode-view').addEventListener('click', () => AppState.setMode('view'));

    // Sync Novedades (fetch latest comments)
    const btnRefreshNovedades = $('#btn-refresh-novedades');
    if (btnRefreshNovedades) {
        btnRefreshNovedades.addEventListener('click', async () => {
            const pid = AppState.get('currentProjectId');
            if (!pid) return;
            UI.toast('Sincronizando...', 'info');
            // Re-load the project from cloud to get fresh comments
            const success = await AppState.loadFromCloud(pid);
            if (success) {
                UI.toast('Novedades actualizadas ✅', 'success');
            } else {
                UI.toast('Error al sincronizar', 'error');
            }
        });
    }

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

    // ═══ PROJECTS LIST ═══
    $('#btn-my-projects').addEventListener('click', async () => {
        UI.showModal('modal-projects');
        const listOwned = $('#project-list');
        const listShared = $('#shared-project-list');
        listOwned.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;text-align:center;padding:16px;">Cargando...</p>';
        listShared.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;text-align:center;padding:16px;">Cargando...</p>';

        const renderList = (container, arr) => {
            container.innerHTML = '';
            if (arr.length === 0) {
                container.innerHTML = '<p style="color:var(--text-muted);font-size:0.8rem;text-align:center;padding:16px;">No hay proyectos</p>';
                return;
            }

            arr.forEach(p => {
                const el = document.createElement('div');
                el.className = 'project-item';
                el.style.display = 'flex';
                el.style.alignItems = 'center';
                el.style.justifyContent = 'space-between';
                el.style.padding = '10px';
                el.style.borderBottom = '1px solid var(--border)';
                el.style.gap = '8px';

                const dateStr = p.updatedAt ? p.updatedAt.toLocaleDateString() : '';
                const info = document.createElement('div');
                info.className = 'project-info';
                info.style.flex = '1';
                info.style.cursor = 'pointer';
                info.innerHTML = `
                    <div class="project-title" style="font-weight:500;font-size:0.9rem;">${p.title}</div>
                    <div class="project-date" style="font-size:0.75rem;color:var(--text-muted);">${dateStr}</div>
                `;

                const actions = document.createElement('div');
                actions.className = 'project-actions';

                // Share btn
                const shareBtn = document.createElement('button');
                shareBtn.className = 'btn btn-xs btn-share project-share-btn';
                shareBtn.innerHTML = '🔗';
                shareBtn.title = 'Compartir link';
                shareBtn.addEventListener('click', () => {
                    _pendingShareUrlBase = FirebaseData.getShareUrl(p.id);
                    UI.showModal('modal-share-options');
                });

                // Load btn
                const loadBtn = document.createElement('button');
                loadBtn.className = 'btn btn-xs btn-primary project-load-btn';
                loadBtn.textContent = 'Abrir';
                loadBtn.addEventListener('click', async () => {
                    UI.hideModal('modal-projects');

                    if (p.isShared) {
                        // For shared projects, redirect completely to enforce read-only URL state
                        window.location.href = FirebaseData.getShareUrl(p.id) + '&mode=view';
                        return;
                    }

                    UI.toast('Cargando proyecto...', '');
                    const loaded = await AppState.loadFromCloud(p.id);
                    if (loaded) {
                        FirebaseData.addProjectLocally(p.id, false);
                        UI.toast('Proyecto cargado ✅', 'success');
                        UI.refreshAll();
                        const game = AppState.getCurrentGame();
                        if (game && game.youtube_video_id) {
                            YTPlayer.loadVideo(game.youtube_video_id);
                        }
                        const url = FirebaseData.getShareUrl(p.id);
                        window.history.replaceState({}, '', url);
                    } else {
                        UI.toast('Error al cargar', 'error');
                    }
                });

                // Delete btn
                const delBtn = document.createElement('button');
                delBtn.className = 'btn btn-xs btn-danger project-delete-btn';
                delBtn.textContent = '🗑️';
                delBtn.title = p.isShared ? 'Remover de la lista' : 'Eliminar localmente';
                delBtn.addEventListener('click', () => {
                    if (confirm(`¿Quitar "${p.title}" de tu lista local?`)) {
                        FirebaseData.removeProjectLocally(p.id);
                        el.remove();
                    }
                });

                actions.appendChild(shareBtn);
                actions.appendChild(loadBtn);
                actions.appendChild(delBtn);

                el.appendChild(info);
                el.appendChild(actions);
                container.appendChild(el);
            });
        };

        try {
            const projects = await FirebaseData.listProjects();
            const ownedProjects = projects.filter(p => !p.isShared);
            const sharedProjects = projects.filter(p => p.isShared);
            renderList(listOwned, ownedProjects);
            renderList(listShared, sharedProjects);
        } catch (err) {
            listOwned.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;text-align:center;padding:16px;">Error al conectar.</p>';
            listShared.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;text-align:center;padding:16px;">Error al conectar.</p>';
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

    // Share Project Modal logic
    let _pendingShareUrlBase = '';

    $('#btn-share-project').addEventListener('click', () => {
        const projectId = AppState.get('currentProjectId');
        const gameId = AppState.get('currentGameId');
        if (!projectId) {
            UI.toast('Primero guardá el proyecto', 'error');
            return;
        }

        _pendingShareUrlBase = FirebaseData.getShareUrl(projectId, gameId);
        UI.showModal('modal-share-options');
    });

    $('#btn-share-edit').addEventListener('click', () => {
        UI.hideModal('modal-share-options');
        const url = _pendingShareUrlBase;
        navigator.clipboard.writeText(url).then(() => {
            UI.toast('🔗 Link (Edición) copiado', 'success');
        }).catch(() => {
            prompt('Copiá este link:', url);
        });
    });

    $('#btn-share-view').addEventListener('click', () => {
        UI.hideModal('modal-share-options');
        const url = _pendingShareUrlBase + '&mode=view';
        navigator.clipboard.writeText(url).then(() => {
            UI.toast('🔗 Link (Solo Ver) copiado', 'success');
        }).catch(() => {
            prompt('Copiá este link:', url);
        });
    });

    $('#btn-cancel-share').addEventListener('click', () => {
        UI.hideModal('modal-share-options');
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

    const handlePlaylistShare = (e) => {
        const btn = e.target.closest('.pl-share-btn');
        if (!btn) return;
        const playlistId = btn.dataset.playlistId;
        const projectId = AppState.get('currentProjectId');

        if (!projectId) {
            UI.toast('Primero guardá el proyecto para compartir', 'error');
            return;
        }

        const url = FirebaseData.getShareUrl(projectId, null, playlistId) + '&mode=view';
        navigator.clipboard.writeText(url).then(() => {
            UI.toast('🔗 Link de Playlist copiado', 'success');
        }).catch(() => {
            prompt('Copiá este link:', url);
        });
    };

    $('#analyze-playlists').addEventListener('click', handlePlaylistShare);
    // También escuchamos los clicks de compartir playlist en la vista "Ver"
    const sourcePlaylistsCont = $('#source-playlists');
    if (sourcePlaylistsCont) {
        sourcePlaylistsCont.addEventListener('click', handlePlaylistShare);
    }

    // ═══════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════

    async function init() {
        // Check if loading a shared project from URL
        const projectIdFromUrl = FirebaseData.getProjectIdFromUrl();
        const playlistIdFromUrl = FirebaseData.getPlaylistIdFromUrl();
        const gameIdFromUrl = FirebaseData.getGameIdFromUrl();
        const params = new URLSearchParams(window.location.search);
        const modeFromUrl = params.get('mode');

        if (projectIdFromUrl) {
            // No cargamos los clips demo si venimos de un link
            DemoData.clear();
        }

        // Init state (loads whatever is in DemoData)
        AppState.init();

        // Init YouTube Player safely (handles file:// origin errors cleanly)
        try {
            await YTPlayer.init();
        } catch (e) {
            console.warn('YouTube Player no se pudo iniciar inmediatamente (común en file://).', e);
        }

        if (projectIdFromUrl) {
            UI.toast('Cargando proyecto...', '');
            const loaded = await AppState.loadFromCloud(projectIdFromUrl);

            if (loaded) {
                // Determine if this project was already in our local 'owned' list
                const localProjects = JSON.parse(localStorage.getItem('sr_my_projects') || '[]');
                const isOwned = localProjects.some(p => {
                    if (typeof p === 'string') return p === projectIdFromUrl;
                    return p.id === projectIdFromUrl && p.shared === false;
                });

                FirebaseData.addProjectLocally(projectIdFromUrl, !isOwned); // Save as shared if we don't own it
                UI.toast('Proyecto cargado ✅', 'success');

                if (gameIdFromUrl) {
                    AppState.setCurrentGame(gameIdFromUrl);
                }

                const game = AppState.getCurrentGame();
                if (game && game.youtube_video_id) {
                    YTPlayer.loadVideo(game.youtube_video_id);
                }

                if (modeFromUrl === 'view') {
                    document.body.classList.add('read-only-mode');
                    AppState.setMode('view');
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

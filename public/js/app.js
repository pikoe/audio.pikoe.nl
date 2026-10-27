let mediaTagsLibraryPromise;

function loadMediaTagsLibrary() {
	if (window.jsmediatags) {
		return Promise.resolve(window.jsmediatags);
	}

	if (!mediaTagsLibraryPromise) {
		mediaTagsLibraryPromise = new Promise((resolve, reject) => {
			const script = document.createElement('script');
			script.src = 'https://cdn.jsdelivr.net/npm/jsmediatags@3.9.7/dist/jsmediatags.min.js';
			script.async = true;
			script.onload = () => {
				if (window.jsmediatags) {
					resolve(window.jsmediatags);
				} else {
					reject(new Error('De MP3-lezer kon niet worden geladen.'));
				}
			};
			script.onerror = () => reject(new Error('De MP3-lezer kon niet worden geladen.'));
			document.head.append(script);
		});
	}

	return mediaTagsLibraryPromise;
}

function readMp3Tags(file) {
	return loadMediaTagsLibrary().then((library) => new Promise((resolve, reject) => {
		library.read(file, {
			onSuccess: (result) => resolve(result.tags),
			onError: (error) => {
				if (error.type === 'tagFormat' && error.info === 'No suitable tag reader found') {
					resolve({});
					return;
				}
				reject(new Error(error.info || 'De tags van dit MP3-bestand konden niet worden gelezen.'));
			},
		});
	}));
}

function getFrameData(tags, frameId) {
	const frame = tags[frameId];
	const selectedFrame = Array.isArray(frame) ? frame[0] : frame;
	return selectedFrame?.data ?? '';
}

function metadataText(value) {
	if (typeof value === 'string' || typeof value === 'number') {
		return String(value);
	}

	if (Array.isArray(value)) {
		return value.map(metadataText).filter(Boolean).join('; ');
	}

	if (value && typeof value === 'object') {
		return metadataText(value.text ?? value.lyrics ?? value.value ?? '');
	}

	return '';
}

function initializeDiscography() {
	const tracks = [...document.querySelectorAll('[data-discography-track]')];
	if (!tracks.length) {
		return;
	}

	const AudioContextClass = window.AudioContext || window.webkitAudioContext;
	let audioContext = null;
	let activeTrack = null;

	const trackStates = new Map(tracks.map((track) => {
		const audio = track.querySelector('audio');
		const title = track.querySelector('[data-track-title]');
		const artist = track.querySelector('[data-track-artist]');
		const cover = track.querySelector('[data-track-cover]');
		const playButton = track.querySelector('[data-track-play]');
		const downloadButton = track.querySelector('[data-track-download]');
		const timeDisplay = track.querySelector('[data-track-time]');
		const waveformCanvas = track.querySelector('[data-track-waveform]');

		if (
			!(audio instanceof HTMLAudioElement)
			|| !(title instanceof HTMLElement)
			|| !(artist instanceof HTMLElement)
			|| !(cover instanceof HTMLImageElement)
			|| !(playButton instanceof HTMLButtonElement)
			|| !(downloadButton instanceof HTMLButtonElement)
			|| !(timeDisplay instanceof HTMLElement)
			|| !(waveformCanvas instanceof HTMLCanvasElement)
		) {
			return [track, null];
		}

		return [track, {
			audio,
			title,
			artist,
			cover,
			playButton,
			downloadButton,
			timeDisplay,
			waveformCanvas,
			waveformContext: waveformCanvas.getContext('2d'),
			filename: track.dataset.trackFilename ?? '',
			url: track.dataset.trackUrl ?? '',
			blob: null,
			objectUrl: null,
			loadPromise: null,
			waveform: null,
			waveformPromise: null,
			animationFrame: null,
		}];
	}).filter(([, state]) => state !== null));

	function updatePlaybackButton(state, isPlaying) {
		const icon = state.playButton.querySelector('.fas');
		const buttonText = state.playButton.querySelector('span');
		const title = state.title.textContent;
		if (icon instanceof HTMLElement) {
			icon.classList.toggle('fa-play', !isPlaying);
			icon.classList.toggle('fa-pause', isPlaying);
		}
		if (buttonText instanceof HTMLElement) {
			buttonText.textContent = isPlaying ? 'Pauzeren' : 'Afspelen';
		}
		state.playButton.setAttribute('aria-label', `${isPlaying ? 'Pauzeer' : 'Speel'} ${title}`);
		state.playButton.setAttribute('aria-pressed', String(isPlaying));
		state.track.classList.toggle('is-playing', isPlaying);
	}

	function formatTrackTime(seconds) {
		const totalSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
		const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
		const remainingSeconds = (totalSeconds % 60).toString().padStart(2, '0');
		return `${minutes}:${remainingSeconds}`;
	}

	function updateTrackTime(state) {
		state.timeDisplay.textContent = `${formatTrackTime(state.audio.currentTime)} / ${formatTrackTime(state.audio.duration)}`;
	}

	function drawWaveform(state) {
		if (!state.waveformContext) {
			return;
		}

		const bounds = state.waveformCanvas.getBoundingClientRect();
		if (bounds.width <= 0) {
			return;
		}

		const pixelRatio = window.devicePixelRatio || 1;
		const canvasWidth = Math.round(bounds.width * pixelRatio);
		const canvasHeight = Math.round(bounds.height * pixelRatio);
		if (state.waveformCanvas.width !== canvasWidth || state.waveformCanvas.height !== canvasHeight) {
			state.waveformCanvas.width = canvasWidth;
			state.waveformCanvas.height = canvasHeight;
		}

		const context = state.waveformContext;
		context.clearRect(0, 0, canvasWidth, canvasHeight);
		const isLoading = state.waveform === null;
		const barCount = Math.max(1, Math.floor(bounds.width / 2));
		const progress = Number.isFinite(state.audio.duration) && state.audio.duration > 0
			? state.audio.currentTime / state.audio.duration
			: 0;
		const barWidth = 2 * pixelRatio;
		const barGap = pixelRatio;
		const animationTime = performance.now() / 220;
		for (let index = 0; index < barCount; index++) {
			let amplitude = 0.12 + ((Math.sin(index * 0.42 - animationTime) + 1) / 2) * 0.72;
			if (!isLoading) {
				const start = Math.floor(index * state.waveform.length / barCount);
				const end = Math.max(start + 1, Math.floor((index + 1) * state.waveform.length / barCount));
				amplitude = 0;
				for (let sampleIndex = start; sampleIndex < end; sampleIndex++) {
					amplitude = Math.max(amplitude, state.waveform[sampleIndex]);
				}
			}
			const barHeight = Math.max(pixelRatio, amplitude * canvasHeight);
			context.fillStyle = !isLoading && index / barCount < progress ? '#777777' : '#c7c7c7';
			context.fillRect(index * barWidth, canvasHeight - barHeight, barGap, barHeight);
		}

		if (isLoading && state.animationFrame === null) {
			state.animationFrame = window.requestAnimationFrame(() => {
				state.animationFrame = null;
				drawWaveform(state);
			});
		}
	}

	async function loadWaveform(state) {
		if (state.waveform || state.waveformPromise || !state.blob) {
			return state.waveformPromise;
		}
		if (!AudioContextClass) {
			state.waveform = new Float32Array(64);
			if (state.animationFrame !== null) {
				window.cancelAnimationFrame(state.animationFrame);
				state.animationFrame = null;
			}
			drawWaveform(state);
			return;
		}

		state.waveformPromise = (async () => {
			if (!audioContext) {
				audioContext = new AudioContextClass();
			}
			const audioBuffer = await audioContext.decodeAudioData(await state.blob.arrayBuffer());
			const sampleCount = audioBuffer.length;
			const bucketCount = Math.min(1024, sampleCount);
			const peaks = new Float32Array(bucketCount);
			const channels = Array.from({ length: audioBuffer.numberOfChannels }, (_, channel) => audioBuffer.getChannelData(channel));
			for (let bucket = 0; bucket < bucketCount; bucket++) {
				const start = Math.floor(bucket * sampleCount / bucketCount);
				const end = Math.max(start + 1, Math.floor((bucket + 1) * sampleCount / bucketCount));
				let peak = 0;
				const sampleStep = Math.max(1, Math.floor((end - start) / 256));
				for (let sampleIndex = start; sampleIndex < end; sampleIndex += sampleStep) {
					let combinedAmplitude = 0;
					for (const channel of channels) {
						combinedAmplitude += Math.abs(channel[sampleIndex]);
					}
					peak = Math.max(peak, combinedAmplitude);
				}
				peaks[bucket] = Math.min(1, peak);
			}
			state.waveform = peaks;
			if (state.animationFrame !== null) {
				window.cancelAnimationFrame(state.animationFrame);
				state.animationFrame = null;
			}
			drawWaveform(state);
		})().catch((error) => {
			state.waveform = new Float32Array(64);
			drawWaveform(state);
			console.error(`Kon de geluidsvorm voor ${state.filename} niet berekenen.`, error);
		}).finally(() => {
			state.waveformPromise = null;
		});

		return state.waveformPromise;
	}

	async function loadTrack(state) {
		if (state.blob) {
			return state.blob;
		}
		if (state.loadPromise) {
			return state.loadPromise;
		}

		state.loadPromise = (async () => {
			const response = await fetch(state.url);
			if (!response.ok) {
				throw new Error(`MP3 laden mislukt: HTTP ${response.status}`);
			}

			state.blob = await response.blob();
			state.objectUrl = URL.createObjectURL(state.blob);
			state.audio.src = state.objectUrl;
			state.audio.load();
			state.downloadButton.disabled = false;
			void loadWaveform(state);

			try {
				const file = new File([state.blob], state.filename, { type: state.blob.type || 'audio/mpeg' });
				const tags = await readMp3Tags(file);
				const title = metadataText(tags.title ?? getFrameData(tags, 'TIT2'));
				const artist = metadataText(tags.artist ?? getFrameData(tags, 'TPE1'));
				state.title.textContent = title || state.filename.replace(/\.mp3$/i, '');
				state.artist.textContent = artist || 'Onbekende artiest';
				state.track.setAttribute('aria-label', `Nummer afspelen: ${state.title.textContent}`);
				state.playButton.setAttribute('aria-label', `Speel ${state.title.textContent}`);

				const picture = tags.picture ?? getFrameData(tags, 'APIC');
				if (picture?.data?.length) {
					const coverBlob = new Blob([new Uint8Array(picture.data)], {
						type: typeof picture.format === 'string' ? picture.format : 'application/octet-stream',
					});
					state.cover.src = URL.createObjectURL(coverBlob);
					state.cover.hidden = false;
					const fallbackIcon = state.cover.parentElement?.querySelector('.fa-music');
					if (fallbackIcon instanceof HTMLElement) {
						fallbackIcon.hidden = true;
					}
					state.cover.alt = `Cover van ${state.title.textContent}`;
				}
			} catch (error) {
				state.title.textContent = state.filename.replace(/\.mp3$/i, '');
				state.artist.textContent = 'Onbekende artiest';
				console.error(`Kon de MP3-tags van ${state.filename} niet uitlezen.`, error);
			}

			drawWaveform(state);
			return state.blob;
		})().catch((error) => {
			state.loadPromise = null;
			console.error(`Kon ${state.filename} niet laden.`, error);
			throw error;
		});

		return state.loadPromise;
	}

	async function startPlayback(state) {
		if (activeTrack && activeTrack !== state.track) {
			const previousState = trackStates.get(activeTrack);
			previousState?.audio.pause();
		}

		activeTrack = state.track;
		if (AudioContextClass) {
			if (!audioContext) {
				audioContext = new AudioContextClass();
			}
			if (audioContext.state === 'suspended') {
				await audioContext.resume();
			}
			void loadWaveform(state);
		}
		await state.audio.play();
	}

	async function togglePlayback(track) {
		const state = trackStates.get(track);
		if (!state) {
			return;
		}

		if (activeTrack === track && !state.audio.paused) {
			state.audio.pause();
			return;
		}

		try {
			await loadTrack(state);
			await startPlayback(state);
		} catch (error) {
			console.error(`Kon ${state.filename} niet afspelen.`, error);
		}
	}

	async function seekAndPlay(track, event) {
		const state = trackStates.get(track);
		event.preventDefault();
		event.stopPropagation();
		if (!state) {
			return;
		}

		const bounds = state.waveformCanvas.getBoundingClientRect();
		if (bounds.width <= 0) {
			return;
		}
		const progress = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));

		try {
			await loadTrack(state);
			if (state.audio.readyState < HTMLMediaElement.HAVE_METADATA) {
				await new Promise((resolve, reject) => {
					const onLoadedMetadata = () => {
						cleanup();
						resolve();
					};
					const onError = () => {
						cleanup();
						reject(new Error('De audiometadata kon niet worden geladen.'));
					};
					const cleanup = () => {
						state.audio.removeEventListener('loadedmetadata', onLoadedMetadata);
						state.audio.removeEventListener('error', onError);
					};

					state.audio.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
					state.audio.addEventListener('error', onError, { once: true });
					state.audio.preload = 'auto';
					state.audio.load();
				});
			}
			if (!Number.isFinite(state.audio.duration) || state.audio.duration <= 0) {
				throw new Error('De duur van de audio is niet beschikbaar.');
			}

			state.audio.currentTime = progress * state.audio.duration;
			await startPlayback(state);
		} catch (error) {
			console.error(`Kon niet naar het gekozen punt in ${state.filename} springen.`, error);
		}
	}

	for (const [track, state] of trackStates) {
		state.track = track;
		updateTrackTime(state);
		drawWaveform(state);
		state.audio.addEventListener('play', () => updatePlaybackButton(state, true));
		state.audio.addEventListener('pause', () => updatePlaybackButton(state, false));
		state.audio.addEventListener('ended', () => {
			updatePlaybackButton(state, false);
			if (activeTrack === track) {
				activeTrack = null;
			}
			drawWaveform(state);
		});
		state.audio.addEventListener('timeupdate', () => {
			updateTrackTime(state);
			drawWaveform(state);
		});
		state.audio.addEventListener('durationchange', () => {
			updateTrackTime(state);
			drawWaveform(state);
		});
		state.audio.addEventListener('loadedmetadata', () => updateTrackTime(state));
		state.audio.addEventListener('seeked', () => updateTrackTime(state));

		state.waveformCanvas.addEventListener('click', (event) => {
			void seekAndPlay(track, event);
		});
		track.addEventListener('click', (event) => {
			if (event.target instanceof Element && event.target.closest('[data-track-download]')) {
				return;
			}
			void togglePlayback(track);
		});
		track.addEventListener('keydown', (event) => {
			if (event.target === track && (event.key === 'Enter' || event.key === ' ')) {
				event.preventDefault();
				void togglePlayback(track);
			}
		});
		state.downloadButton.addEventListener('click', async (event) => {
			event.preventDefault();
			event.stopPropagation();
			try {
				await loadTrack(state);
				const link = document.createElement('a');
				link.href = state.objectUrl;
				link.download = state.filename;
				document.body.append(link);
				link.click();
				link.remove();
			} catch (error) {
				console.error(`Kon ${state.filename} niet downloaden.`, error);
			}
		});
	}

	const observer = 'IntersectionObserver' in window
		? new IntersectionObserver((entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) {
					observer.unobserve(entry.target);
					const state = trackStates.get(entry.target);
					if (state) {
						void loadTrack(state).catch(() => {});
					}
				}
			}
		}, { rootMargin: '120px' })
		: null;

	for (const [track, state] of trackStates) {
		if (observer) {
			observer.observe(track);
		} else {
			void loadTrack(state).catch(() => {});
		}
	}

	window.addEventListener('resize', () => {
		for (const state of trackStates.values()) {
			drawWaveform(state);
		}
	});
}

function isValidCalendarDate(year, month, day) {
	if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day) || year < 1 || month < 1 || month > 12) {
		return false;
	}

	const daysInMonth = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
	return day >= 1 && day <= daysInMonth[month - 1];
}

function initializeMp3LabelTool() {
	const uploadPanel = document.querySelector('[data-mp3-label-upload]');
	const editor = document.querySelector('[data-mp3-label-editor]');
	if (!(uploadPanel instanceof HTMLElement) || !(editor instanceof HTMLElement)) {
		return;
	}

	const fileInput = uploadPanel.querySelector('[data-mp3-file-input]');
	const dropzone = uploadPanel.querySelector('[data-mp3-dropzone]');
	const uploadStatus = uploadPanel.querySelector('[data-mp3-file-status]');
	const saveButton = editor.querySelector('[data-save-label]');
	const changeButton = editor.querySelector('[data-change-audio]');
	const status = editor.querySelector('[data-label-status]');
	const selectedAudio = editor.querySelector('[data-selected-audio]');
	const coverInput = editor.querySelector('[data-cover-file-input]');
	const coverDropzone = editor.querySelector('[data-cover-dropzone]');
	const coverStatus = editor.querySelector('[data-cover-file-status]');
	const coverTitle = editor.querySelector('[data-cover-title]');
	const coverPreview = editor.querySelector('[data-cover-preview]');

	if (
		!(fileInput instanceof HTMLInputElement)
		|| !(dropzone instanceof HTMLElement)
		|| !(uploadStatus instanceof HTMLElement)
		|| !(saveButton instanceof HTMLButtonElement)
		|| !(changeButton instanceof HTMLButtonElement)
		|| !(status instanceof HTMLElement)
		|| !(selectedAudio instanceof HTMLElement)
		|| !(coverInput instanceof HTMLInputElement)
		|| !(coverDropzone instanceof HTMLElement)
		|| !(coverStatus instanceof HTMLElement)
		|| !(coverTitle instanceof HTMLElement)
		|| !(coverPreview instanceof HTMLImageElement)
	) {
		return;
	}

	let selectedFile = null;
	let selectedCoverFile = null;
	let originalPicture = null;
	let coverUrl = null;
	let selectionId = 0;
	let coverSelectionId = 0;

	const setStatus = (message, isError = false) => {
		status.textContent = message;
		status.classList.toggle('is-error', isError);
	};

	const showCoverPreview = (blob) => {
		if (coverUrl) {
			URL.revokeObjectURL(coverUrl);
		}
		coverUrl = URL.createObjectURL(blob);
		coverPreview.src = coverUrl;
		coverPreview.hidden = false;
	};

	const showOriginalPicture = () => {
		if (originalPicture?.data?.length) {
			const mimeType = typeof originalPicture.format === 'string' ? originalPicture.format : 'application/octet-stream';
			showCoverPreview(new Blob([new Uint8Array(originalPicture.data)], { type: mimeType }));
			coverTitle.textContent = 'Bestaande cover gevonden. Kies of sleep een nieuwe afbeelding om deze te vervangen.';
			coverStatus.textContent = 'De bestaande cover blijft behouden als je geen nieuwe kiest.';
			return;
		}

		coverPreview.hidden = true;
		coverPreview.removeAttribute('src');
		coverTitle.textContent = 'Sleep een JPG- of PNG-afbeelding hierheen of kies een bestand.';
		coverStatus.textContent = 'Geen cover in de MP3 gevonden.';
	};

	const setField = (name, value) => {
		const field = editor.querySelector(`[name="${name}"]`);
		if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
			field.value = value;
		}
	};

	const getField = (name) => {
		const field = editor.querySelector(`[name="${name}"]`);
		return field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement ? field.value.trim() : '';
	};

	const fillFields = (tags) => {
		const recordingTime = metadataText(getFrameData(tags, 'TDRC'));
		const year = recordingTime.match(/^(\d{4})/)?.[1]
			?? metadataText(tags.year ?? getFrameData(tags, 'TYER')).match(/^(\d{4})/)?.[1]
			?? '';
		const dayMonth = metadataText(getFrameData(tags, 'TDAT'));
		const composer = metadataText(getFrameData(tags, 'TCOM'));
		const lyricist = metadataText(getFrameData(tags, 'TEXT'));
		const contributors = [...new Set([composer, lyricist].filter(Boolean))].join(' / ');
		const fullDate = recordingTime.match(/^(\d{4})-(\d{2})-(\d{2})$/);
		const legacyDate = dayMonth.match(/^(\d{2})(\d{2})$/);
		let date = year;

		if (fullDate && isValidCalendarDate(Number(fullDate[1]), Number(fullDate[2]), Number(fullDate[3]))) {
			date = `${fullDate[1]}-${fullDate[2]}-${fullDate[3]}`;
		} else if (year && legacyDate && isValidCalendarDate(Number(year), Number(legacyDate[2]), Number(legacyDate[1]))) {
			date = `${year}-${legacyDate[2]}-${legacyDate[1]}`;
		}

		setField('title', metadataText(tags.title ?? getFrameData(tags, 'TIT2')));
		setField('artist', metadataText(tags.artist ?? getFrameData(tags, 'TPE1')));
		setField('album', metadataText(tags.album ?? getFrameData(tags, 'TALB')));
		setField('genre', metadataText(tags.genre ?? getFrameData(tags, 'TCON')));
		setField('date', date);
		setField('composer', contributors);
		setField('comment', metadataText(tags.comment ?? getFrameData(tags, 'COMM')));
		setField('lyrics', metadataText(tags.lyrics ?? getFrameData(tags, 'USLT')));

		originalPicture = tags.picture ?? getFrameData(tags, 'APIC');
		showOriginalPicture();
	};

	const loadFile = async (file) => {
		const currentSelection = ++selectionId;
		if (!file.name.toLowerCase().endsWith('.mp3')) {
			uploadStatus.textContent = 'Kies een bestand met de extensie .mp3.';
			return;
		}

		selectedFile = null;
		originalPicture = null;
		saveButton.disabled = true;
		uploadStatus.textContent = `Tags uitlezen: ${file.name}`;
		setStatus('');

		try {
			const tags = await readMp3Tags(file);
			if (currentSelection !== selectionId) {
				return;
			}

			selectedFile = file;
			selectedAudio.textContent = file.name;
			fillFields(tags);
			uploadPanel.hidden = true;
			editor.hidden = false;
			saveButton.disabled = false;
			uploadStatus.textContent = `Geselecteerd: ${file.name}`;
			setStatus('Gegevens uit de MP3 zijn ingelezen. Je kunt ze nu aanpassen.');
		} catch (error) {
			if (currentSelection !== selectionId) {
				return;
			}
			uploadStatus.textContent = error instanceof Error ? error.message : 'De tags van dit MP3-bestand konden niet worden gelezen.';
		}
	};

	const handleAudioDrop = (event) => {
		event.preventDefault();
		dropzone.classList.remove('is-dragging');
		const file = event.dataTransfer?.files[0];
		if (file) {
			void loadFile(file);
		}
	};

	fileInput.addEventListener('change', () => {
		const file = fileInput.files?.[0];
		if (file) {
			void loadFile(file);
		}
	});

	['dragenter', 'dragover'].forEach((eventName) => {
		dropzone.addEventListener(eventName, (event) => {
			event.preventDefault();
			dropzone.classList.add('is-dragging');
		});
	});
	['dragleave', 'drop'].forEach((eventName) => {
		dropzone.addEventListener(eventName, (event) => {
			event.preventDefault();
			dropzone.classList.remove('is-dragging');
		});
	});
	dropzone.addEventListener('drop', handleAudioDrop);

	const setCoverFile = async (file) => {
		if (!file) {
			return;
		}
		const currentSelection = ++coverSelectionId;
		coverStatus.textContent = `Afbeelding controleren: ${file.name}`;
		let header;
		try {
			header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
		} catch (error) {
			if (currentSelection === coverSelectionId) {
				selectedCoverFile = null;
				coverInput.value = '';
				showOriginalPicture();
				coverStatus.textContent = error instanceof Error ? error.message : 'De afbeelding kon niet worden gelezen.';
			}
			return;
		}
		if (currentSelection !== coverSelectionId) {
			return;
		}
		const isJpeg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
		const isPng = header[0] === 0x89
			&& header[1] === 0x50
			&& header[2] === 0x4e
			&& header[3] === 0x47
			&& header[4] === 0x0d
			&& header[5] === 0x0a
			&& header[6] === 0x1a
			&& header[7] === 0x0a;
		if (!isJpeg && !isPng) {
			selectedCoverFile = null;
			coverInput.value = '';
			showOriginalPicture();
			coverStatus.textContent = 'Kies een geldige JPG- of PNG-afbeelding.';
			return;
		}
		selectedCoverFile = file;
		showCoverPreview(file);
		coverTitle.textContent = file.name;
		coverStatus.textContent = `Nieuwe cover geselecteerd: ${file.name}`;
	};

	coverInput.addEventListener('change', () => {
		void setCoverFile(coverInput.files?.[0] ?? null);
	});
	['dragenter', 'dragover'].forEach((eventName) => {
		coverDropzone.addEventListener(eventName, (event) => {
			event.preventDefault();
			coverDropzone.classList.add('is-dragging');
		});
	});
	['dragleave', 'drop'].forEach((eventName) => {
		coverDropzone.addEventListener(eventName, (event) => {
			event.preventDefault();
			coverDropzone.classList.remove('is-dragging');
		});
	});
	coverDropzone.addEventListener('drop', (event) => {
		event.preventDefault();
		const file = event.dataTransfer?.files[0];
		if (file) {
			void setCoverFile(file);
		}
	});

	changeButton.addEventListener('click', () => {
		selectionId++;
		coverSelectionId++;
		selectedFile = null;
		selectedCoverFile = null;
		originalPicture = null;
		fileInput.value = '';
		coverInput.value = '';
		saveButton.disabled = true;
		editor.hidden = true;
		uploadPanel.hidden = false;
		uploadStatus.textContent = 'Kies een MP3-bestand.';
		if (coverUrl) {
			URL.revokeObjectURL(coverUrl);
			coverUrl = null;
		}
	});

	saveButton.addEventListener('click', async () => {
		if (!selectedFile) {
			return;
		}
		saveButton.disabled = true;
		changeButton.disabled = true;
		setStatus('Bezig met verwerken...');

		try {
			const { ID3Writer } = await import('https://cdn.jsdelivr.net/npm/browser-id3-writer@6.4.0/+esm');
			const writer = new ID3Writer(await selectedFile.arrayBuffer());
			const title = getField('title');
			const artist = getField('artist');
			const album = getField('album');
			const genre = getField('genre');
			const date = getField('date');
			const comment = getField('comment');
			const lyrics = getField('lyrics');
			const composer = getField('composer');

			if (title) writer.setFrame('TIT2', title);
			if (artist) writer.setFrame('TPE1', [artist]);
			if (album) writer.setFrame('TALB', album);
			if (genre) writer.setFrame('TCON', [genre]);
			if (composer) {
				writer.setFrame('TCOM', [composer]);
				writer.setFrame('TEXT', composer);
			}
			if (comment) writer.setFrame('COMM', { description: '', text: comment, language: 'eng' });
			if (lyrics) writer.setFrame('USLT', { description: '', lyrics, language: 'eng' });

			if (date) {
				let year;
				let day;
				let month;
				const yearOnly = date.match(/^(\d{4})$/);
				const isoDate = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
				const dayFirstDate = date.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
				if (yearOnly) {
					year = yearOnly[1];
				} else if (isoDate) {
					[, year, month, day] = isoDate;
				} else if (dayFirstDate) {
					[, day, month, year] = dayFirstDate;
				} else {
					throw new Error('Vul een jaartal (JJJJ) of datum (JJJJ-MM-DD of DD-MM-JJJJ) in.');
				}

				if (day && month) {
					if (!isValidCalendarDate(Number(year), Number(month), Number(day))) {
						throw new Error('Vul een geldige datum in.');
					}
				}

				writer.setFrame('TYER', Number(year));
				if (day && month) {
					writer.setFrame('TDAT', `${day}${month}`);
				}
			}

			const cover = selectedCoverFile;
			if (cover) {
				writer.setFrame('APIC', { type: 3, data: await cover.arrayBuffer(), description: 'Album cover' });
			} else if (originalPicture?.data?.length) {
				writer.setFrame('APIC', {
					type: 3,
					data: new Uint8Array(originalPicture.data).buffer,
					description: originalPicture.description || 'Album cover',
				});
			}

			writer.addTag();
			const url = URL.createObjectURL(writer.getBlob());
			const link = document.createElement('a');
			link.href = url;
			link.download = `${selectedFile.name.replace(/\.mp3$/i, '')}_met_labels.mp3`;
			document.body.append(link);
			link.click();
			link.remove();
			window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
			setStatus('Je nieuwe MP3 is aangemaakt en gedownload.');
		} catch (error) {
			setStatus(error instanceof Error ? error.message : 'Er ging iets mis bij het verwerken van de MP3.', true);
		} finally {
			saveButton.disabled = false;
			changeButton.disabled = false;
		}
	});
}

let mp3EncoderLibraryPromise;

function loadMp3Encoder() {
	if (window.lamejs) {
		return Promise.resolve(window.lamejs);
	}

	if (!mp3EncoderLibraryPromise) {
		mp3EncoderLibraryPromise = new Promise((resolve, reject) => {
			const script = document.createElement('script');
			script.src = 'https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js';
			script.async = true;
			script.onload = () => {
				if (window.lamejs) {
					resolve(window.lamejs);
				} else {
					reject(new Error('De MP3-encoder kon niet worden geladen.'));
				}
			};
			script.onerror = () => reject(new Error('De MP3-encoder kon niet worden geladen.'));
			document.head.append(script);
		});
	}

	return mp3EncoderLibraryPromise;
}

function initializeMp3CropTool() {
	const uploadPanel = document.querySelector('[data-mp3-crop-upload]');
	const editor = document.querySelector('[data-crop-editor]');
	if (!(uploadPanel instanceof HTMLElement) || !(editor instanceof HTMLElement)) {
		return;
	}

	const fileInput = uploadPanel.querySelector('[data-crop-file-input]');
	const dropzone = uploadPanel.querySelector('[data-crop-dropzone]');
	const uploadStatus = uploadPanel.querySelector('[data-crop-file-status]');
	const selectedAudio = editor.querySelector('[data-crop-selected-audio]');
	const audio = editor.querySelector('[data-crop-audio]');
	const playButton = editor.querySelector('[data-crop-play]');
	const modeButtons = [...editor.querySelectorAll('[data-crop-mode]')];
	const navigator = editor.querySelector('[data-crop-navigator]');
	const navigatorWaveform = editor.querySelector('[data-crop-navigator-waveform]');
	const navigatorPlayhead = editor.querySelector('[data-crop-navigator-playhead]');
	const navigatorFrame = editor.querySelector('[data-crop-navigator-frame]');
	const rulerViewport = editor.querySelector('[data-crop-ruler-viewport]');
	const ruler = editor.querySelector('[data-crop-ruler]');
	const waveViewport = editor.querySelector('[data-crop-wave-viewport]');
	const track = editor.querySelector('[data-crop-track]');
	const cropContextMenu = editor.querySelector('[data-crop-context-menu]');
	const status = editor.querySelector('[data-crop-status]');
	const changeButton = editor.querySelector('[data-crop-change]');
	const dataExportButton = editor.querySelector('[data-crop-export-data]');
	const audioExportButton = editor.querySelector('[data-crop-export-audio]');
	const startInput = editor.querySelector('[data-crop-time="start"]');
	const endInput = editor.querySelector('[data-crop-time="end"]');

	if (
		!(fileInput instanceof HTMLInputElement)
		|| !(dropzone instanceof HTMLElement)
		|| !(uploadStatus instanceof HTMLElement)
		|| !(selectedAudio instanceof HTMLElement)
		|| !(audio instanceof HTMLAudioElement)
		|| !(playButton instanceof HTMLButtonElement)
		|| !modeButtons.every((button) => button instanceof HTMLButtonElement)
		|| !(navigator instanceof HTMLElement)
		|| !(navigatorWaveform instanceof HTMLCanvasElement)
		|| !(navigatorPlayhead instanceof HTMLElement)
		|| !(navigatorFrame instanceof HTMLElement)
		|| !(rulerViewport instanceof HTMLElement)
		|| !(ruler instanceof HTMLElement)
		|| !(waveViewport instanceof HTMLElement)
		|| !(track instanceof HTMLElement)
		|| !(cropContextMenu instanceof HTMLElement)
		|| !(status instanceof HTMLElement)
		|| !(changeButton instanceof HTMLButtonElement)
		|| !(dataExportButton instanceof HTMLButtonElement)
		|| !(audioExportButton instanceof HTMLButtonElement)
		|| !(startInput instanceof HTMLInputElement)
		|| !(endInput instanceof HTMLInputElement)
	) {
		return;
	}

	const AudioContextClass = window.AudioContext || window.webkitAudioContext;
	const waveCanvases = [...track.querySelectorAll('[data-crop-wave]')];
	const lanes = [...track.querySelectorAll('[data-crop-lane]')];
	const markers = new Map([...track.querySelectorAll('[data-crop-marker]')].map((marker) => [marker.dataset.cropMarker, marker]));
	const markerTimes = new Map([...track.querySelectorAll('[data-crop-marker-time]')].map((element) => [element.dataset.cropMarkerTime, element]));
	const shades = new Map([...track.querySelectorAll('[data-crop-shade]')].map((element) => [element.dataset.cropShade, element]));
	const navigatorShades = new Map([...navigator.querySelectorAll('[data-crop-navigator-shade]')].map((element) => [element.dataset.cropNavigatorShade, element]));
	const navigatorMarkers = new Map([...navigator.querySelectorAll('[data-crop-navigator-marker]')].map((element) => [element.dataset.cropNavigatorMarker, element]));
	let fileSelectionId = 0;
	let selectedFile = null;
	let fileBuffer = null;
	let decodedAudio = null;
	let sourceObjectUrl = null;
	let audioContext = null;
	let channelPeaks = [];
	let duration = 0;
	let cropStart = 0;
	let cropEnd = 0;
	let playhead = 0;
	let zoom = 1;
	let playbackMode = 'full';
	let exportInProgress = false;
	let markerDrag = null;
	let navigatorDrag = null;
	let activeMarkerName = null;
	let cropContextMenuTime = 0;
	const waveformInset = 5;
	const minZoom = 1;
	const maxZoom = 20;

	document.body.append(cropContextMenu);

	const getWaveformWidth = (width = track.clientWidth) => Math.max(1, width - (waveformInset * 2));
	const timeToTrackX = (time, width = track.clientWidth) => (
		waveformInset + (Math.max(0, Math.min(duration, time)) / duration) * getWaveformWidth(width)
	);
	const trackXToTime = (position, width = track.clientWidth) => (
		Math.max(0, Math.min(1, (position - waveformInset) / getWaveformWidth(width))) * duration
	);

	const setStatus = (message, isError = false) => {
		status.textContent = message;
		status.classList.toggle('is-error', isError);
	};

	const updatePlaybackButton = () => {
		const isPlaying = !audio.paused;
		const icon = playButton.querySelector('.fas');
		const buttonText = playButton.querySelector('span');
		if (icon instanceof HTMLElement) {
			icon.classList.toggle('fa-play', !isPlaying);
			icon.classList.toggle('fa-pause', isPlaying);
		}
		if (buttonText instanceof HTMLElement) {
			buttonText.textContent = isPlaying ? 'Pauzeren' : 'Afspelen';
		}
		playButton.setAttribute('aria-label', isPlaying ? 'Pauzeren' : 'Afspelen');
		playButton.setAttribute('aria-pressed', String(isPlaying));
	};

	const formatTimestamp = (seconds) => {
		const centiseconds = Math.max(0, Math.round(seconds * 100));
		const minutes = Math.floor(centiseconds / 6000).toString().padStart(2, '0');
		const remainingSeconds = (Math.floor(centiseconds / 100) % 60).toString().padStart(2, '0');
		const fraction = (centiseconds % 100).toString().padStart(2, '0');
		return `${minutes}:${remainingSeconds}.${fraction}`;
	};

	const parseTimestamp = (value) => {
		const match = value.trim().match(/^(\d{2,}):([0-5]\d)\.(\d{2})$/);
		if (!match) {
			return null;
		}
		return (Number(match[1]) * 60) + Number(match[2]) + (Number(match[3]) / 100);
	};

	const isMp3File = (file) => file.type === 'audio/mpeg' || /\.mp3$/i.test(file.name);

	const hasPreservableMetadata = (tags) => {
		if (!tags || typeof tags !== 'object') {
			return false;
		}
		if (tags.picture?.data?.length) {
			return true;
		}
		return Object.entries(tags).some(([name, value]) => name !== 'picture' && metadataText(value).trim() !== '');
	};

	const extractId3v2Tag = (buffer) => {
		const bytes = new Uint8Array(buffer);
		if (
			bytes.length < 10
			|| bytes[0] !== 0x49
			|| bytes[1] !== 0x44
			|| bytes[2] !== 0x33
			|| (bytes[6] & 0x80)
			|| (bytes[7] & 0x80)
			|| (bytes[8] & 0x80)
			|| (bytes[9] & 0x80)
		) {
			return null;
		}
		const tagLength = (bytes[6] << 21) | (bytes[7] << 14) | (bytes[8] << 7) | bytes[9];
		const tagEnd = 10 + tagLength;
		if (tagEnd > bytes.length) {
			return null;
		}
		return bytes.slice(0, tagEnd);
	};

	const extractId3v1Tag = (buffer) => {
		const bytes = new Uint8Array(buffer);
		const tagStart = bytes.length - 128;
		if (tagStart < 0 || bytes[tagStart] !== 0x54 || bytes[tagStart + 1] !== 0x41 || bytes[tagStart + 2] !== 0x47) {
			return null;
		}
		return bytes.slice(tagStart);
	};

	const createPeaks = (audioBuffer, channelIndex) => {
		const samples = audioBuffer.getChannelData(channelIndex);
		const bucketSize = Math.max(1, Math.floor(audioBuffer.sampleRate / 100));
		const peaks = new Float32Array(Math.ceil(samples.length / bucketSize));
		for (let bucket = 0; bucket < peaks.length; bucket++) {
			const end = Math.min(samples.length, (bucket + 1) * bucketSize);
			let peak = 0;
			for (let sample = bucket * bucketSize; sample < end; sample++) {
				peak = Math.max(peak, Math.abs(samples[sample]));
			}
			peaks[bucket] = peak;
		}
		return peaks;
	};

	const niceTimeStep = (pixelsPerSecond) => {
		const candidates = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600, 7200];
		return candidates.find((step) => step * pixelsPerSecond >= 72) ?? 14400;
	};

	const renderRuler = (trackWidth) => {
		ruler.replaceChildren();
		if (duration <= 0 || trackWidth <= 0) {
			return;
		}
		const pixelsPerSecond = getWaveformWidth(trackWidth) / duration;
		const step = niceTimeStep(pixelsPerSecond);
		for (let time = 0; time <= duration; time += step) {
			const tick = document.createElement('span');
			tick.className = 'crop-ruler-tick';
			tick.style.left = `${timeToTrackX(time, trackWidth)}px`;
			tick.textContent = formatTimestamp(time);
			ruler.append(tick);
		}
	};

	const drawWaveforms = (trackWidth) => {
		if (!decodedAudio) {
			return;
		}
		const pixelRatio = window.devicePixelRatio || 1;
		waveCanvases.forEach((canvas, channelIndex) => {
			if (!(canvas instanceof HTMLCanvasElement)) {
				return;
			}
			const bounds = canvas.getBoundingClientRect();
			const width = Math.max(1, Math.ceil(trackWidth));
			const height = Math.max(1, Math.ceil(bounds.height));
			canvas.width = Math.ceil(width * pixelRatio);
			canvas.height = Math.ceil(height * pixelRatio);
			const context = canvas.getContext('2d');
			if (!context) {
				return;
			}
			context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
			context.clearRect(0, 0, width, height);
			const peaks = channelPeaks[channelIndex];
			if (!peaks?.length) {
				return;
			}
			const center = height / 2;
			const waveformWidth = getWaveformWidth(width);
			const pixelsPerPeak = peaks.length / waveformWidth;
			for (let x = 0; x < waveformWidth; x++) {
				const peakStart = Math.floor(x * pixelsPerPeak);
				const peakEnd = Math.max(peakStart + 1, Math.ceil((x + 1) * pixelsPerPeak));
				let peak = 0;
				for (let index = peakStart; index < Math.min(peakEnd, peaks.length); index++) {
					peak = Math.max(peak, peaks[index]);
				}
				const amplitude = Math.max(1, peak * (height * 0.44));
				const time = (x / waveformWidth) * duration;
				context.fillStyle = time < cropStart || time > cropEnd ? '#666666' : '#1f9187';
				context.fillRect(x + waveformInset, center - amplitude, 1, amplitude * 2);
			}
		});
	};

	const drawNavigatorWaveform = () => {
		const bounds = navigatorWaveform.getBoundingClientRect();
		if (!channelPeaks.length || bounds.width <= 0 || bounds.height <= 0) {
			return;
		}
		const pixelRatio = window.devicePixelRatio || 1;
		const width = Math.max(1, Math.round(bounds.width * pixelRatio));
		const height = Math.max(1, Math.round(bounds.height * pixelRatio));
		if (navigatorWaveform.width !== width || navigatorWaveform.height !== height) {
			navigatorWaveform.width = width;
			navigatorWaveform.height = height;
		}
		const context = navigatorWaveform.getContext('2d');
		if (!context) {
			return;
		}
		context.clearRect(0, 0, width, height);
		const center = height / 2;
		const peakCount = Math.max(...channelPeaks.map((peaks) => peaks.length));
		for (let x = 0; x < width; x++) {
			const start = Math.floor((x / width) * peakCount);
			const end = Math.max(start + 1, Math.ceil(((x + 1) / width) * peakCount));
			let peak = 0;
			for (const peaks of channelPeaks) {
				const peakStart = Math.floor((start / peakCount) * peaks.length);
				const peakEnd = Math.max(peakStart + 1, Math.ceil((end / peakCount) * peaks.length));
				for (let index = peakStart; index < Math.min(peakEnd, peaks.length); index++) {
					peak = Math.max(peak, peaks[index]);
				}
			}
			const amplitude = Math.max(1, peak * (height * 0.44));
			const time = (x / width) * duration;
			context.fillStyle = time < cropStart || time > cropEnd ? '#666666' : '#1f9187';
			context.fillRect(x, center - amplitude, 1, amplitude * 2);
		}
	};

	const updateNavigator = () => {
		if (duration <= 0 || track.clientWidth <= 0 || navigator.clientWidth <= 0) {
			return;
		}
		const waveformWidth = getWaveformWidth();
		const frameWidth = Math.min(1, Math.max(1, waveViewport.clientWidth - (waveformInset * 2)) / waveformWidth);
		const frameLeft = Math.max(0, Math.min(1 - frameWidth, waveViewport.scrollLeft / waveformWidth));
		navigatorFrame.style.left = `${frameLeft * 100}%`;
		navigatorFrame.style.width = `${frameWidth * 100}%`;
		const startShade = navigatorShades.get('start');
		const endShade = navigatorShades.get('end');
		if (startShade instanceof HTMLElement) {
			startShade.style.width = `${frameLeft * 100}%`;
		}
		if (endShade instanceof HTMLElement) {
			endShade.style.left = `${(frameLeft + frameWidth) * 100}%`;
			endShade.style.width = `${(1 - frameLeft - frameWidth) * 100}%`;
		}
	};

	const updateTimeline = () => {
		if (duration <= 0) {
			return;
		}
		for (const [name, time] of [['start', cropStart], ['end', cropEnd]]) {
			const marker = navigatorMarkers.get(name);
			if (marker instanceof HTMLElement) {
				marker.style.left = `${(time / duration) * 100}%`;
			}
		}
		const startPosition = timeToTrackX(cropStart);
		const endPosition = timeToTrackX(cropEnd);
		const playheadPosition = timeToTrackX(playhead);
		navigatorPlayhead.style.left = `${(playhead / duration) * 100}%`;
		const startMarker = markers.get('start');
		const endMarker = markers.get('end');
		const playheadMarker = markers.get('playhead');
		markers.forEach((marker, name) => {
			if (marker instanceof HTMLElement) {
				marker.classList.toggle('is-active', name === activeMarkerName);
			}
		});
		if (startMarker instanceof HTMLElement) {
			startMarker.style.left = `${startPosition}px`;
			const slider = startMarker.querySelector('[role="slider"]');
			slider?.setAttribute('aria-valuemax', String(duration));
			slider?.setAttribute('aria-valuenow', cropStart.toFixed(2));
			slider?.setAttribute('aria-valuetext', formatTimestamp(cropStart));
		}
		if (endMarker instanceof HTMLElement) {
			endMarker.style.left = `${endPosition}px`;
			const slider = endMarker.querySelector('[role="slider"]');
			slider?.setAttribute('aria-valuemax', String(duration));
			slider?.setAttribute('aria-valuenow', cropEnd.toFixed(2));
			slider?.setAttribute('aria-valuetext', formatTimestamp(cropEnd));
		}
		if (playheadMarker instanceof HTMLElement) {
			playheadMarker.style.left = `${playheadPosition}px`;
			const slider = playheadMarker.querySelector('[role="slider"]');
			slider?.setAttribute('aria-valuemax', String(duration));
			slider?.setAttribute('aria-valuenow', playhead.toFixed(2));
			slider?.setAttribute('aria-valuetext', formatTimestamp(playhead));
		}
		const startShade = shades.get('start');
		const endShade = shades.get('end');
		if (startShade instanceof HTMLElement) {
			startShade.style.width = `${startPosition}px`;
		}
		if (endShade instanceof HTMLElement) {
			endShade.style.left = `${endPosition}px`;
			endShade.style.width = `${track.clientWidth - endPosition}px`;
		}
		for (const [name, time] of [['start', cropStart], ['end', cropEnd], ['playhead', playhead]]) {
			const label = markerTimes.get(name);
			if (label instanceof HTMLInputElement && document.activeElement !== label) {
				label.value = formatTimestamp(time);
				label.setAttribute('aria-invalid', 'false');
			} else if (label instanceof HTMLElement) {
				label.textContent = formatTimestamp(time);
			}
		}
		const hasCrop = cropEnd - cropStart >= 0.01;
		audioExportButton.disabled = !selectedFile || !decodedAudio || hasCrop === false || exportInProgress;
		dataExportButton.disabled = !dataExportButton.dataset.metadataAvailable
			|| !selectedFile
			|| hasCrop === false
			|| exportInProgress;
	};

	const updateLayout = (preserveCenter = true) => {
		if (duration <= 0 || waveViewport.clientWidth <= 0) {
			return;
		}
		const oldWidth = Math.max(1, track.clientWidth);
		const centerTime = preserveCenter
			? trackXToTime(waveViewport.scrollLeft + waveViewport.clientWidth / 2, oldWidth)
			: 0;
		const trackWidth = Math.max(
			1,
			Math.round((Math.max(1, waveViewport.clientWidth - (waveformInset * 2)) * zoom) + (waveformInset * 2)),
		);
		track.style.width = `${trackWidth}px`;
		ruler.style.width = `${trackWidth}px`;
		renderRuler(trackWidth);
		drawWaveforms(trackWidth);
		waveViewport.scrollLeft = preserveCenter
			? timeToTrackX(centerTime, trackWidth) - waveViewport.clientWidth / 2
			: 0;
		ruler.style.transform = `translateX(-${waveViewport.scrollLeft}px)`;
		drawNavigatorWaveform();
		updateNavigator();
		updateTimeline();
	};

	const getTimeFromClientX = (clientX) => {
		const bounds = track.getBoundingClientRect();
		return duration > 0 ? trackXToTime(clientX - bounds.left, bounds.width) : 0;
	};

	const closeCropContextMenu = () => {
		cropContextMenu.hidden = true;
	};

	const openCropContextMenu = (event) => {
		if (!selectedFile || !decodedAudio || duration <= 0) {
			return;
		}
		event.preventDefault();
		cropContextMenuTime = getTimeFromClientX(event.clientX);
		cropContextMenu.hidden = false;
		const bounds = cropContextMenu.getBoundingClientRect();
		cropContextMenu.style.left = `${Math.max(0, Math.min(event.clientX, window.innerWidth - bounds.width))}px`;
		cropContextMenu.style.top = `${Math.max(0, Math.min(event.clientY, window.innerHeight - bounds.height))}px`;
		cropContextMenu.querySelector('button')?.focus({ preventScroll: true });
	};

	const applyCropContextAction = (action) => {
		if (action === 'start') {
			if (cropContextMenuTime >= cropEnd) {
				cropEnd = duration;
			}
			cropStart = Math.max(0, Math.min(cropContextMenuTime, cropEnd - 0.01));
		} else {
			if (cropContextMenuTime <= cropStart) {
				cropStart = 0;
			}
			cropEnd = Math.min(duration, Math.max(cropStart + 0.01, cropContextMenuTime));
		}
		drawWaveforms(track.clientWidth);
		drawNavigatorWaveform();
		updateTimeline();
	};

	const snapTime = (time, references) => {
		const tolerance = (duration / getWaveformWidth()) * 10;
		let closestReference = null;
		let closestDistance = tolerance;
		for (const reference of references) {
			const distance = Math.abs(time - reference);
			if (distance <= closestDistance) {
				closestReference = reference;
				closestDistance = distance;
			}
		}
		return closestReference ?? time;
	};

	const updateExportAvailability = (hasMetadata) => {
		dataExportButton.dataset.metadataAvailable = hasMetadata ? 'true' : '';
		dataExportButton.title = hasMetadata
			? 'Behoudt de aanwezige ID3-tags en albumcover.'
			: 'Alleen beschikbaar voor MP3-bestanden met leesbare ID3-gegevens of een albumcover.';
		updateTimeline();
	};

	const setMarkerTime = (markerName, proposedTime) => {
		let nextTime = Math.max(0, Math.min(duration, proposedTime));
		if (markerName === 'start') {
			nextTime = snapTime(nextTime, [playhead, cropEnd]);
			cropStart = Math.max(0, Math.min(cropEnd - 0.01, nextTime));
		} else if (markerName === 'end') {
			nextTime = snapTime(nextTime, [playhead, cropStart]);
			cropEnd = Math.max(cropStart + 0.01, Math.min(duration, nextTime));
		} else {
			nextTime = snapTime(nextTime, [cropStart, cropEnd]);
			playhead = nextTime;
			if (audio.readyState >= HTMLMediaElement.HAVE_METADATA && Math.abs(audio.currentTime - playhead) > 0.02) {
				audio.currentTime = playhead;
			}
		}
		if (markerName !== 'playhead') {
			drawWaveforms(track.clientWidth);
			drawNavigatorWaveform();
		}
		updateTimeline();
	};

	const togglePlayback = async () => {
		if (!selectedFile || !decodedAudio) {
			return;
		}
		if (!audio.paused) {
			audio.pause();
			return;
		}
		if (playbackMode === 'cropped' && (audio.currentTime < cropStart || audio.currentTime >= cropEnd)) {
			audio.currentTime = cropStart;
		} else if (playbackMode === 'full' && audio.ended) {
			audio.currentTime = 0;
		}
		try {
			await audio.play();
			updatePlaybackButton();
			setStatus(playbackMode === 'cropped' ? 'Je hoort nu alleen het gekozen fragment.' : 'De volledige audio wordt afgespeeld.');
		} catch (error) {
			setStatus(error instanceof Error ? `Afspelen is niet gelukt: ${error.message}` : 'Afspelen is niet gelukt.', true);
		}
	};

	const downloadBlob = (blob, filename) => {
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = filename;
		document.body.append(link);
		link.click();
		link.remove();
		window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
	};

	const getSample = (samples, position) => {
		const left = Math.max(0, Math.min(samples.length - 1, Math.floor(position)));
		const right = Math.min(samples.length - 1, left + 1);
		const fraction = Math.max(0, position - left);
		return samples[left] * (1 - fraction) + samples[right] * fraction;
	};

	const encodeSelection = async (keepMetadata) => {
		if (!selectedFile || !decodedAudio || !fileBuffer || cropEnd - cropStart < 0.01) {
			throw new Error('Kies eerst een geldig audiofragment.');
		}
		if (keepMetadata && (!isMp3File(selectedFile) || !dataExportButton.dataset.metadataAvailable)) {
			throw new Error('Dit MP3-bestand bevat geen leesbare ID3-gegevens of albumcover.');
		}
		setStatus('MP3-encoder laden…');
		const library = await loadMp3Encoder();
		if (audioContext?.state === 'suspended') {
			await audioContext.resume();
		}

		const supportedRates = [48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000];
		const sourceRate = decodedAudio.sampleRate;
		const sampleRate = supportedRates.find((rate) => rate <= sourceRate) ?? 8000;
		const channels = Math.min(2, decodedAudio.numberOfChannels);
		const encoder = new library.Mp3Encoder(channels, sampleRate, 192);
		const encodedChunks = [];
		const outputSamples = Math.max(1, Math.floor((cropEnd - cropStart) * sampleRate));
		const sourceChannels = Array.from({ length: decodedAudio.numberOfChannels }, (_, index) => decodedAudio.getChannelData(index));
		const chunkSize = 1152;
		for (let offset = 0; offset < outputSamples; offset += chunkSize) {
			const size = Math.min(chunkSize, outputSamples - offset);
			const left = new Int16Array(size);
			const right = channels === 2 ? new Int16Array(size) : null;
			for (let index = 0; index < size; index++) {
				const sourcePosition = ((cropStart * sourceRate) + ((offset + index) * sourceRate / sampleRate));
				let leftSample = getSample(sourceChannels[0], sourcePosition);
				let rightSample = channels === 2
					? getSample(sourceChannels[1], sourcePosition)
					: leftSample;
				if (channels === 2 && sourceChannels.length > 2) {
					for (let extraChannel = 2; extraChannel < sourceChannels.length; extraChannel++) {
						const extraSample = getSample(sourceChannels[extraChannel], sourcePosition) / sourceChannels.length;
						if (extraChannel % 2 === 0) {
							leftSample += extraSample;
						} else {
							rightSample += extraSample;
						}
					}
				}
				left[index] = Math.max(-32768, Math.min(32767, Math.round(leftSample * (leftSample < 0 ? 32768 : 32767))));
				if (right && rightSample !== undefined) {
					right[index] = Math.max(-32768, Math.min(32767, Math.round(rightSample * (rightSample < 0 ? 32768 : 32767))));
				}
			}
			const chunk = right ? encoder.encodeBuffer(left, right) : encoder.encodeBuffer(left);
			if (chunk.length) {
				encodedChunks.push(chunk);
			}
			if (offset % (chunkSize * 40) === 0) {
				const progress = Math.min(100, Math.round(((offset + size) / outputSamples) * 100));
				setStatus(`MP3 maken… ${progress}%`);
				await new Promise((resolve) => window.setTimeout(resolve, 0));
			}
		}
		const finalChunk = encoder.flush();
		if (finalChunk.length) {
			encodedChunks.push(finalChunk);
		}

		const output = [];
		if (keepMetadata) {
			const id3Tag = extractId3v2Tag(fileBuffer);
			const id3v1Tag = extractId3v1Tag(fileBuffer);
			if (!id3Tag && !id3v1Tag) {
				throw new Error('De ID3-tags konden niet veilig uit het bronbestand worden overgenomen.');
			}
			if (id3Tag) {
				output.push(id3Tag);
			}
			output.push(...encodedChunks);
			if (id3v1Tag) {
				output.push(id3v1Tag);
			}
			return new Blob(output, { type: 'audio/mpeg' });
		}
		output.push(...encodedChunks);
		return new Blob(output, { type: 'audio/mpeg' });
	};

	const exportSelection = async (keepMetadata) => {
		if (exportInProgress) {
			return;
		}
		exportInProgress = true;
		changeButton.disabled = true;
		audioExportButton.disabled = true;
		dataExportButton.disabled = true;
		try {
			const blob = await encodeSelection(keepMetadata);
			const baseName = selectedFile.name.replace(/\.[^.]+$/, '');
			downloadBlob(blob, `${baseName}_${formatTimestamp(cropStart).replace(/[:.]/g, '-')}-${formatTimestamp(cropEnd).replace(/[:.]/g, '-')}${keepMetadata ? '_met_gegevens' : '_audio-only'}.mp3`);
			setStatus(keepMetadata
				? 'Het gecropte MP3-bestand met de oorspronkelijke ID3-gegevens is gedownload.'
				: 'Het gecropte audio-only MP3-bestand zonder metadata is gedownload.');
		} catch (error) {
			setStatus(error instanceof Error ? error.message : 'Het audiofragment kon niet worden geëxporteerd.', true);
		} finally {
			exportInProgress = false;
			changeButton.disabled = false;
			updateTimeline();
		}
	};

	const loadFile = async (file) => {
		const currentSelection = ++fileSelectionId;
		selectedFile = null;
		decodedAudio = null;
		fileBuffer = null;
		channelPeaks = [];
		audio.pause();
		audio.removeAttribute('src');
		audio.load();
		if (sourceObjectUrl) {
			URL.revokeObjectURL(sourceObjectUrl);
			sourceObjectUrl = null;
		}
		if (audioContext) {
			void audioContext.close();
			audioContext = null;
		}
		updateExportAvailability(false);
		uploadStatus.textContent = `Audio laden: ${file.name}`;
		setStatus('Audio wordt ingelezen op dit apparaat…');
		if (!AudioContextClass) {
			uploadStatus.textContent = 'Deze browser ondersteunt geen lokale audioverwerking.';
			setStatus('De Web Audio API is niet beschikbaar in deze browser.', true);
			return;
		}

		try {
			fileBuffer = await file.arrayBuffer();
			audioContext = new AudioContextClass();
			decodedAudio = await audioContext.decodeAudioData(fileBuffer.slice(0));
			if (currentSelection !== fileSelectionId) {
				return;
			}
			if (!Number.isFinite(decodedAudio.duration) || decodedAudio.duration <= 0) {
				throw new Error('De duur van dit audiobestand kon niet worden bepaald.');
			}

			selectedFile = file;
			duration = decodedAudio.duration;
			cropStart = 0;
			cropEnd = duration;
			playhead = 0;
			zoom = 1;
			channelPeaks = Array.from(
				{ length: Math.min(2, decodedAudio.numberOfChannels) },
				(_, index) => createPeaks(decodedAudio, index),
			);
			lanes.forEach((lane, index) => {
				if (lane instanceof HTMLElement) {
					lane.hidden = index >= channelPeaks.length;
					const channelLabel = lane.querySelector('[data-crop-channel-label]');
					if (channelLabel instanceof HTMLElement) {
						channelLabel.textContent = channelPeaks.length === 1 ? 'Mono' : index === 0 ? 'Links' : 'Rechts';
					}
				}
			});
			sourceObjectUrl = URL.createObjectURL(file);
			audio.src = sourceObjectUrl;
			audio.load();
			selectedAudio.textContent = `${file.name} · ${formatTimestamp(duration)} · ${channelPeaks.length === 1 ? 'mono' : 'stereo'}`;
			uploadPanel.hidden = true;
			editor.hidden = false;
			uploadStatus.textContent = `Geselecteerd: ${file.name}`;
			updateLayout(false);
			updateTimeline();
			updatePlaybackButton();
			updateExportAvailability(false);

			if (!isMp3File(file)) {
				setStatus('Audio geladen. Exporteren kan als MP3 zonder metadata; de metadata-export is alleen beschikbaar voor MP3-bestanden met ID3-gegevens of een cover.');
				return;
			}

			setStatus('Audio geladen. ID3-gegevens controleren…');
			try {
				const tags = await readMp3Tags(file);
				if (currentSelection !== fileSelectionId) {
					return;
				}
				const hasMetadata = Boolean(extractId3v2Tag(fileBuffer) || extractId3v1Tag(fileBuffer))
					&& hasPreservableMetadata(tags);
				updateExportAvailability(hasMetadata);
				setStatus(hasMetadata
					? 'Audio en ID3-gegevens geladen. De gegevens-export behoudt titel, artiest, cover en overige aanwezige ID3-tags.'
					: 'Audio geladen. Er zijn geen leesbare ID3-gegevens of albumcover gevonden; de metadata-export is daarom uitgeschakeld.');
			} catch (error) {
				if (currentSelection !== fileSelectionId) {
					return;
				}
				updateExportAvailability(false);
				setStatus(`Audio geladen, maar ID3-gegevens konden niet worden gelezen: ${error instanceof Error ? error.message : 'onbekende fout'}. Audio-only export blijft beschikbaar.`);
			}
		} catch (error) {
			if (currentSelection !== fileSelectionId) {
				return;
			}
			decodedAudio = null;
			selectedFile = null;
			fileBuffer = null;
			channelPeaks = [];
			audio.pause();
			audio.removeAttribute('src');
			audio.load();
			if (sourceObjectUrl) {
				URL.revokeObjectURL(sourceObjectUrl);
				sourceObjectUrl = null;
			}
			if (audioContext) {
				void audioContext.close();
				audioContext = null;
			}
			uploadPanel.hidden = false;
			editor.hidden = true;
			uploadStatus.textContent = error instanceof Error ? error.message : 'Dit audiobestand kon niet worden ingelezen.';
			setStatus('Kies een geldig audioformaat dat door deze browser wordt ondersteund.', true);
		}
	};

	const handleFileDrop = (event) => {
		event.preventDefault();
		dropzone.classList.remove('is-dragging');
		const file = event.dataTransfer?.files[0];
		if (file) {
			void loadFile(file);
		}
	};

	fileInput.addEventListener('change', () => {
		const file = fileInput.files?.[0];
		if (file) {
			void loadFile(file);
		}
	});
	['dragenter', 'dragover'].forEach((eventName) => {
		dropzone.addEventListener(eventName, (event) => {
			event.preventDefault();
			dropzone.classList.add('is-dragging');
		});
	});
	['dragleave', 'drop'].forEach((eventName) => {
		dropzone.addEventListener(eventName, (event) => {
			event.preventDefault();
			dropzone.classList.remove('is-dragging');
		});
	});
	dropzone.addEventListener('drop', handleFileDrop);

	playButton.addEventListener('click', () => void togglePlayback());
	modeButtons.forEach((button) => {
		button.addEventListener('click', () => {
			playbackMode = button.dataset.cropMode === 'cropped' ? 'cropped' : 'full';
			modeButtons.forEach((modeButton) => {
				const isActive = modeButton === button;
				modeButton.classList.toggle('is-active', isActive);
				modeButton.setAttribute('aria-pressed', String(isActive));
			});
			if (playbackMode === 'cropped' && !audio.paused && (audio.currentTime < cropStart || audio.currentTime >= cropEnd)) {
				audio.currentTime = cropStart;
			}
			setStatus(playbackMode === 'cropped'
				? 'Gecropt-modus: afspelen stopt bij het gekozen eindpunt.'
				: 'Volledig-modus: afspelen gebruikt de volledige audio.');
		});
	});

	const resizeNavigatorFrame = (edge, initialLeft, initialWidth, delta) => {
		let left = initialLeft;
		let width = initialWidth;
		const minWidth = 1 / maxZoom;
		if (edge === 'start') {
			const right = left + width;
			left = Math.max(0, Math.min(right - minWidth, left + delta));
			width = right - left;
		} else {
			const right = Math.max(left + minWidth, Math.min(1, left + width + delta));
			width = right - left;
		}
		zoom = Math.max(minZoom, Math.min(maxZoom, 1 / width));
		updateLayout(false);
		waveViewport.scrollLeft = left * getWaveformWidth();
	};
	waveViewport.addEventListener('scroll', () => {
		ruler.style.transform = `translateX(-${waveViewport.scrollLeft}px)`;
		updateNavigator();
	});
	navigator.addEventListener('pointerdown', (event) => {
		if (!(event.target instanceof HTMLElement)) {
			return;
		}
		const frame = event.target.closest('[data-crop-navigator-frame]');
		if (!(frame instanceof HTMLElement)) {
			return;
		}
		event.preventDefault();
		const handle = event.target.closest('[data-crop-navigator-handle]');
		const frameBounds = frame.getBoundingClientRect();
		const navigatorBounds = navigator.getBoundingClientRect();
		navigatorDrag = {
			mode: handle instanceof HTMLElement ? handle.dataset.cropNavigatorHandle : 'move',
			startX: event.clientX,
			startLeft: frameBounds.left - navigatorBounds.left,
			startWidth: frameBounds.width,
		};
		navigator.setPointerCapture(event.pointerId);
	});
	navigator.addEventListener('pointermove', (event) => {
		if (!navigatorDrag || event.buttons === 0) {
			return;
		}
		const bounds = navigator.getBoundingClientRect();
		if (bounds.width <= 0) {
			return;
		}
		const delta = (event.clientX - navigatorDrag.startX) / bounds.width;
		const left = navigatorDrag.startLeft / bounds.width;
		const width = navigatorDrag.startWidth / bounds.width;
		if (navigatorDrag.mode === 'move') {
			const nextLeft = Math.max(0, Math.min(1 - width, left + delta));
			waveViewport.scrollLeft = nextLeft * getWaveformWidth();
			return;
		}
		if (navigatorDrag.mode === 'start' || navigatorDrag.mode === 'end') {
			resizeNavigatorFrame(navigatorDrag.mode, left, width, delta);
		}
	});
	const stopNavigatorDrag = () => {
		navigatorDrag = null;
	};
	navigator.addEventListener('pointerup', stopNavigatorDrag);
	navigator.addEventListener('pointercancel', stopNavigatorDrag);
	navigator.addEventListener('lostpointercapture', stopNavigatorDrag);
	navigatorFrame.addEventListener('keydown', (event) => {
		const focusedHandle = event.target instanceof HTMLElement
			? event.target.closest('[data-crop-navigator-handle]')
			: null;
		if (focusedHandle instanceof HTMLElement && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
			event.preventDefault();
			event.stopPropagation();
			const bounds = navigator.getBoundingClientRect();
			const frameBounds = navigatorFrame.getBoundingClientRect();
			const left = (frameBounds.left - bounds.left) / bounds.width;
			const width = frameBounds.width / bounds.width;
			const direction = event.key === 'ArrowLeft' ? -1 : 1;
			resizeNavigatorFrame(focusedHandle.dataset.cropNavigatorHandle, left, width, direction * 0.01);
			return;
		}
		const panAmount = waveViewport.clientWidth * 0.05;
		if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
			event.preventDefault();
			waveViewport.scrollLeft += event.key === 'ArrowLeft' ? -panAmount : panAmount;
		} else if (event.key === 'Home' || event.key === 'End') {
			event.preventDefault();
			waveViewport.scrollLeft = event.key === 'Home' ? 0 : track.scrollWidth;
		} else if (event.key === '+' || event.key === '=') {
			event.preventDefault();
			zoom = Math.min(maxZoom, zoom + 0.5);
			updateLayout();
		} else if (event.key === '-') {
			event.preventDefault();
			zoom = Math.max(minZoom, zoom - 0.5);
			updateLayout();
		}
	});
	const handleTimelineWheel = (event) => {
		if (event.altKey) {
			event.preventDefault();
			waveViewport.scrollLeft += event.deltaY || event.deltaX;
			return;
		}
		if (!event.ctrlKey && !event.metaKey) {
			return;
		}
		event.preventDefault();
		const previousZoom = zoom;
		zoom = Math.max(minZoom, Math.min(maxZoom, zoom + (event.deltaY < 0 ? 0.25 : -0.25)));
		if (previousZoom !== zoom) {
			updateLayout();
		}
	};
	waveViewport.addEventListener('wheel', handleTimelineWheel, { passive: false });
	rulerViewport.addEventListener('wheel', handleTimelineWheel, { passive: false });

	track.addEventListener('contextmenu', openCropContextMenu);
	cropContextMenu.addEventListener('click', (event) => {
		if (!(event.target instanceof Element)) {
			return;
		}
		const action = event.target.closest('[data-crop-context-action]')?.getAttribute('data-crop-context-action');
		if (action !== 'start' && action !== 'end') {
			return;
		}
		applyCropContextAction(action);
		closeCropContextMenu();
	});
	cropContextMenu.addEventListener('keydown', (event) => {
		if (!(event.target instanceof Element)) {
			return;
		}
		const items = [...cropContextMenu.querySelectorAll('[role="menuitem"]')];
		const currentIndex = items.indexOf(event.target.closest('[role="menuitem"]'));
		if (currentIndex < 0) {
			return;
		}
		const nextIndex = event.key === 'ArrowDown'
			? (currentIndex + 1) % items.length
			: event.key === 'ArrowUp'
				? (currentIndex - 1 + items.length) % items.length
				: event.key === 'Home'
					? 0
					: event.key === 'End'
						? items.length - 1
						: -1;
		if (nextIndex >= 0) {
			event.preventDefault();
			items[nextIndex].focus();
		}
	});
	document.addEventListener('click', (event) => {
		if (!(event.target instanceof Element) || !event.target.closest('[data-crop-context-menu]')) {
			closeCropContextMenu();
		}
	});
	document.addEventListener('keydown', (event) => {
		if (cropContextMenu.hidden) {
			return;
		}
		if (event.key === 'Escape') {
			closeCropContextMenu();
			waveViewport.focus({ preventScroll: true });
		} else if (event.key === 'Tab') {
			closeCropContextMenu();
		}
	});

	track.addEventListener('pointerdown', (event) => {
		if (event.button !== 0) {
			return;
		}
		if (event.target instanceof HTMLElement && event.target.closest('[data-crop-marker]')) {
			return;
		}
		if (event.target instanceof HTMLElement && (event.target.closest('.crop-wave-lane') || event.target === track)) {
			setMarkerTime('playhead', getTimeFromClientX(event.clientX));
		}
	});
	markers.forEach((marker, markerName) => {
		if (!(marker instanceof HTMLElement)) {
			return;
		}
		marker.addEventListener('pointerdown', (event) => {
			if (event.button !== 0) {
				return;
			}
			activeMarkerName = markerName;
			if (event.target instanceof HTMLElement && event.target.matches('[data-crop-time]')) {
				updateTimeline();
				return;
			}
			event.preventDefault();
			updateTimeline();
			markerDrag = markerName;
			marker.setPointerCapture(event.pointerId);
			marker.querySelector('[role="slider"]')?.focus({ preventScroll: true });
		});
		marker.addEventListener('focusin', () => {
			activeMarkerName = markerName;
			updateTimeline();
		});
		marker.addEventListener('pointermove', (event) => {
			if (markerDrag === markerName && event.buttons > 0) {
				setMarkerTime(markerName, getTimeFromClientX(event.clientX));
			}
		});
		const stopDrag = () => {
			if (markerDrag === markerName) {
				markerDrag = null;
			}
		};
		marker.addEventListener('pointerup', stopDrag);
		marker.addEventListener('pointercancel', stopDrag);
		marker.addEventListener('lostpointercapture', stopDrag);
		marker.addEventListener('keydown', (event) => {
			if (!(event.target instanceof HTMLButtonElement)) {
				return;
			}
			const step = event.shiftKey ? 0.1 : 0.01;
			if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
				event.preventDefault();
				const value = markerName === 'start' ? cropStart : markerName === 'end' ? cropEnd : playhead;
				setMarkerTime(markerName, value - step);
			} else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
				event.preventDefault();
				const value = markerName === 'start' ? cropStart : markerName === 'end' ? cropEnd : playhead;
				setMarkerTime(markerName, value + step);
			}
		});
	});
	document.addEventListener('pointerdown', (event) => {
		if (!(event.target instanceof Element) || !event.target.closest('[data-crop-marker]')) {
			activeMarkerName = null;
			updateTimeline();
		}
	});

	[[startInput, 'start'], [endInput, 'end']].forEach(([input, markerName]) => {
		input.addEventListener('input', () => {
			const value = parseTimestamp(input.value);
			if (value === null || value > duration || (markerName === 'start' && value >= cropEnd) || (markerName === 'end' && value <= cropStart)) {
				input.setAttribute('aria-invalid', 'true');
				return;
			}
			input.setAttribute('aria-invalid', 'false');
			setMarkerTime(markerName, value);
		});
		input.addEventListener('change', () => {
			const value = parseTimestamp(input.value);
			if (value === null || value > duration || (markerName === 'start' && value >= cropEnd) || (markerName === 'end' && value <= cropStart)) {
				input.value = formatTimestamp(markerName === 'start' ? cropStart : cropEnd);
				input.setAttribute('aria-invalid', 'false');
				setStatus('Gebruik MM:SS.uu en kies een beginpunt vóór het eindpunt, binnen de totale duur.');
				return;
			}
			setMarkerTime(markerName, value);
			input.value = formatTimestamp(value);
		});
	});

	audio.addEventListener('timeupdate', () => {
		playhead = audio.currentTime;
		if (playbackMode === 'cropped') {
			if (playhead >= cropEnd) {
				audio.pause();
				audio.currentTime = cropEnd;
				playhead = cropEnd;
				setStatus('Het gekozen fragment is afgelopen.');
			} else if (playhead < cropStart) {
				audio.currentTime = cropStart;
			}
		}
		updateTimeline();
	});
	audio.addEventListener('play', updatePlaybackButton);
	audio.addEventListener('pause', updatePlaybackButton);
	audio.addEventListener('ended', () => {
		if (playbackMode === 'cropped') {
			audio.currentTime = cropEnd;
			playhead = cropEnd;
		}
		updatePlaybackButton();
		updateTimeline();
	});

	changeButton.addEventListener('click', () => {
		fileSelectionId++;
		audio.pause();
		selectedFile = null;
		decodedAudio = null;
		fileBuffer = null;
		fileInput.value = '';
		audio.removeAttribute('src');
		audio.load();
		if (audioContext) {
			void audioContext.close();
			audioContext = null;
		}
		uploadPanel.hidden = false;
		editor.hidden = true;
		uploadStatus.textContent = 'Kies een audiobestand.';
		setStatus('');
		updateExportAvailability(false);
		if (sourceObjectUrl) {
			URL.revokeObjectURL(sourceObjectUrl);
			sourceObjectUrl = null;
		}
	});
	dataExportButton.addEventListener('click', () => void exportSelection(true));
	audioExportButton.addEventListener('click', () => void exportSelection(false));

	document.addEventListener('keydown', (event) => {
		if (
			event.code !== 'Space'
			|| event.repeat
			|| event.target instanceof HTMLInputElement
			|| event.target instanceof HTMLTextAreaElement
			|| event.target instanceof HTMLSelectElement
			|| (event.target instanceof HTMLElement && event.target.isContentEditable)
			|| (event.target instanceof HTMLButtonElement && !event.target.matches('[data-crop-marker]'))
		) {
			return;
		}
		event.preventDefault();
		void togglePlayback();
	});

	if ('ResizeObserver' in window) {
		new ResizeObserver(() => updateLayout()).observe(waveViewport);
	} else {
		window.addEventListener('resize', () => updateLayout());
	}
}

document.addEventListener('DOMContentLoaded', () => {
	initializeMp3LabelTool();
	initializeDiscography();
	initializeMp3CropTool();

	const menuToggle = document.querySelector('.menu-toggle');
	const navigation = document.querySelector('#primary-navigation');

	if (menuToggle instanceof HTMLButtonElement && navigation instanceof HTMLElement) {
		menuToggle.addEventListener('click', () => {
			const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true';
			menuToggle.setAttribute('aria-expanded', String(!isExpanded));
			menuToggle.setAttribute('aria-label', isExpanded ? 'Menu openen' : 'Menu sluiten');
			navigation.classList.toggle('is-open', !isExpanded);
		});
	}

	document.querySelectorAll('[data-audio-upload]').forEach((form) => {
		const input = form.querySelector('[data-file-input]');
		const dropzone = form.querySelector('[data-dropzone]');
		const status = form.querySelector('[data-file-status]');

		if (!(input instanceof HTMLInputElement) || !(dropzone instanceof HTMLElement) || !(status instanceof HTMLElement)) {
			return;
		}

		const updateStatus = (file) => {
			status.textContent = file ? `Geselecteerd: ${file.name}` : 'Nog geen bestand gekozen.';
		};

		input.addEventListener('change', () => updateStatus(input.files?.[0] ?? null));

		['dragenter', 'dragover'].forEach((eventName) => {
			dropzone.addEventListener(eventName, (event) => {
				event.preventDefault();
				dropzone.classList.add('is-dragging');
			});
		});

		['dragleave', 'drop'].forEach((eventName) => {
			dropzone.addEventListener(eventName, (event) => {
				event.preventDefault();
				dropzone.classList.remove('is-dragging');
			});
		});

		dropzone.addEventListener('drop', (event) => {
			const files = event.dataTransfer?.files;
			if (!files?.length) {
				return;
			}

			input.files = files;
			updateStatus(files[0]);
		});
	});
});

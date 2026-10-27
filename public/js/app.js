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

document.addEventListener('DOMContentLoaded', () => {
	initializeMp3LabelTool();
	initializeDiscography();

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

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

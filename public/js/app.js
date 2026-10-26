document.addEventListener('DOMContentLoaded', () => {
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

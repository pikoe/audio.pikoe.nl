@extends('layout.master')

@section('title', 'Audio opnemen')

@section('content')
	<section class="crop-editor glass-panel capture-editor" data-capture-audio aria-labelledby="capture-audio-heading">
		<div class="capture-heading">
			<div>
				<h2 id="capture-audio-heading">Opname</h2>
				<p class="capture-help">Stereo en 48 kHz worden aangevraagd; audiofilters zoals echo-onderdrukking worden uitgeschakeld. De browser of bron kan dit beperken. Bij schermdelen moet je ook audio delen inschakelen.</p>
			</div>
		</div>

		<div class="capture-control-row">
			<div class="capture-control-group" role="group" aria-label="Opnamebediening">
				<button class="secondary-button capture-source-button" type="button" data-capture-source-choice="microphone" aria-label="Opnemen met microfoon" aria-pressed="false">
					<i class="fas fa-microphone" aria-hidden="true"></i>
				</button>
				<button class="secondary-button capture-source-button" type="button" data-capture-source-choice="screen" aria-label="Opnemen vanaf scherm of tabblad" aria-pressed="false">
					<i class="fas fa-desktop" aria-hidden="true"></i>
				</button>
				<button class="primary-button capture-record-button" type="button" data-capture-toggle disabled>
					<i class="fas fa-circle" aria-hidden="true"></i>
					<span>Opname starten</span>
				</button>
				<button class="secondary-button capture-settings-button" type="button" data-capture-settings-open aria-label="Microfooninstellingen openen" aria-haspopup="dialog" hidden>
					<i class="fas fa-cog" aria-hidden="true"></i>
				</button>
			</div>
		</div>

		<div>
			<span class="capture-time" data-capture-time>00:00</span>
			<span class="capture-status" data-capture-status role="status" aria-live="polite">Kies een bron en start de opname.</span>
		</div>
		<select class="capture-source-state" data-capture-source tabindex="-1" aria-hidden="true">
			<option value="" selected></option>
			<option value="microphone">Microfoon</option>
			<option value="screen">Scherm of tabblad</option>
		</select>
		<div class="crop-timeline-viewport" data-capture-ruler-viewport aria-hidden="true">
			<div class="crop-ruler-track" data-capture-ruler></div>
		</div>
		<div
			class="crop-wave-viewport capture-wave-viewport"
			data-capture-wave-viewport
			tabindex="0"
			role="group"
			aria-label="Opnamewaveform. Gebruik horizontaal scrollen om te navigeren, Alt plus scrollen om te pannen en Ctrl of Command plus scrollen om te zoomen."
		>
			<div class="crop-wave-track capture-wave-track" data-capture-track>
				<canvas class="capture-waveform" data-capture-waveform aria-hidden="true"></canvas>
				<div class="capture-end-marker" data-capture-end-marker aria-hidden="true"></div>
				<button class="capture-playhead" data-capture-playhead type="button" role="slider" aria-label="Afspeelpositie" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0" aria-valuetext="00:00" disabled></button>
			</div>
		</div>

		<div class="crop-navigator capture-navigator" data-capture-navigator role="group" aria-label="Opname-navigator">
			<canvas class="crop-navigator-waveform" data-capture-navigator-waveform aria-hidden="true"></canvas>
			<div class="crop-navigator-shade crop-navigator-shade-start" data-capture-shade="start" aria-hidden="true"></div>
			<div class="crop-navigator-shade crop-navigator-shade-end" data-capture-shade="end" aria-hidden="true"></div>
			<div class="capture-navigator-end-marker" data-capture-navigator-end-marker aria-hidden="true"></div>
			<button class="capture-navigator-playhead" data-capture-navigator-playhead type="button" aria-label="Afspeelpositie verslepen" disabled></button>
			<div class="crop-navigator-frame" data-capture-frame tabindex="0" role="group" aria-label="Zichtbaar opnamegebied. Gebruik de pijltjestoetsen om te navigeren en plus of min om te zoomen.">
				<button class="crop-navigator-handle crop-navigator-handle-start" type="button" data-capture-handle="start" aria-label="Begin van het zichtbare gebied verslepen om te zoomen"></button>
				<button class="crop-navigator-handle crop-navigator-handle-end" type="button" data-capture-handle="end" aria-label="Einde van het zichtbare gebied verslepen om te zoomen"></button>
			</div>
		</div>
		<p class="crop-navigator-help">Sleep de navigator om te navigeren. Sleep een rand om in of uit te zoomen. Ctrl/⌘ + scroll zoomt; Alt + scroll verplaatst.</p>

		<div class="capture-playback-controls">
			<button class="primary-button capture-play-button" data-capture-play type="button" aria-label="Afspelen" aria-pressed="false" disabled>
				<i class="fas fa-play" aria-hidden="true"></i>
				<span>Afspelen</span>
			</button>
		</div>
		<audio class="capture-preview" data-capture-preview hidden></audio>
		<section class="capture-export" data-capture-export hidden aria-labelledby="capture-export-heading">
			<h2 id="capture-export-heading">Opname exporteren</h2>
			<div class="capture-export-fields">
				<div class="capture-field">
					<label for="capture-format">Bestandsformaat</label>
					<select class="capture-select" id="capture-format" data-capture-format></select>
				</div>
				<div class="capture-field capture-filename-field">
					<label for="capture-filename">Bestandsnaam</label>
					<input class="capture-select" id="capture-filename" type="text" autocomplete="off" data-capture-filename placeholder="Wordt ingevuld zodra de opname start">
				</div>
				<button class="primary-button capture-export-button" type="button" data-capture-export-button disabled>
					<i class="fas fa-download" aria-hidden="true"></i>
					Download opname
				</button>
			</div>
			<p class="upload-note">MP3 en WAV worden lokaal in je browser gemaakt. Andere formaten zijn beschikbaar als deze browser ze ondersteunt.</p>
		</section>

		<div class="capture-modal-backdrop" data-capture-settings-modal hidden>
			<section class="capture-settings-modal" role="dialog" aria-modal="true" aria-labelledby="capture-settings-heading">
				<div class="capture-modal-heading">
					<h2 id="capture-settings-heading">Invoerapparaat</h2>
					<button class="secondary-button capture-modal-close" type="button" data-capture-settings-close aria-label="Instellingen sluiten">
						<i class="fas fa-times" aria-hidden="true"></i>
					</button>
				</div>
				<ul class="capture-device-list" data-capture-device-list aria-label="Kies een invoerapparaat"></ul>
			</section>
		</div>
	</section>
@endsection

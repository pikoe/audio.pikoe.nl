@extends('layout.master')

@section('title', 'MP3 crop tool')

@section('content')
	<section class="page-intro">
		<h1>MP3 crop tool</h1>
		<p>Luister, zoom in op de waveform en kies precies welk fragment je wilt bewaren.</p>
	</section>

	<section class="upload-panel glass-panel crop-upload" data-mp3-crop-upload aria-labelledby="mp3-crop-upload-heading">
		<h2 id="mp3-crop-upload-heading">Kies een audiobestand</h2>
		<label class="dropzone" for="mp3-crop-file" data-crop-dropzone>
			<span class="dropzone-icon" aria-hidden="true">♫</span>
			<span class="dropzone-title">Sleep je audiobestand hierheen</span>
			<span class="dropzone-description">Of blader op je apparaat om een bestand te kiezen.</span>
			<span class="dropzone-browse">Bestand kiezen</span>
			<input
				class="file-input"
				id="mp3-crop-file"
				name="audio"
				type="file"
				accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac"
				data-crop-file-input
				aria-describedby="mp3-crop-file-status"
			>
		</label>
		<p class="file-status" id="mp3-crop-file-status" data-crop-file-status aria-live="polite">Nog geen bestand gekozen.</p>
		<p class="upload-note">Je bestand wordt lokaal op je apparaat verwerkt en niet geüpload.</p>
	</section>

	<section class="crop-editor glass-panel" data-crop-editor aria-labelledby="crop-editor-heading" hidden>
		<div class="crop-editor-heading">
			<div>
				<h2 id="crop-editor-heading">Fragment knippen</h2>
				<p class="selected-audio" data-crop-selected-audio></p>
			</div>
			<div class="crop-playback-controls">
				<button class="primary-button crop-play-button" type="button" data-crop-play aria-label="Afspelen">
					<i class="fas fa-play" aria-hidden="true"></i>
					<span>Afspelen</span>
				</button>
				<div class="crop-mode-toggle" role="group" aria-label="Afspeelmodus">
					<button class="crop-mode-button is-active" type="button" data-crop-mode="full" aria-pressed="true">Volledig</button>
					<button class="crop-mode-button" type="button" data-crop-mode="cropped" aria-pressed="false">Gecropt</button>
				</div>
			</div>
		</div>

		<div class="crop-timeline-viewport" data-crop-ruler-viewport aria-hidden="true">
			<div class="crop-ruler-track" data-crop-ruler></div>
		</div>
		<div
			class="crop-wave-viewport"
			data-crop-wave-viewport
			tabindex="0"
			role="group"
			aria-label="Waveform. Sleep de afspeelpositie of de begin- en eindmarkeringen om het fragment te kiezen."
		>
			<div class="crop-wave-track" data-crop-track>
				<div class="crop-wave-lane" data-crop-lane="0">
					<span class="crop-channel-label" data-crop-channel-label>Links</span>
					<canvas data-crop-wave="0" aria-hidden="true"></canvas>
				</div>
				<div class="crop-wave-lane" data-crop-lane="1">
					<span class="crop-channel-label" data-crop-channel-label>Rechts</span>
					<canvas data-crop-wave="1" aria-hidden="true"></canvas>
				</div>
				<div class="crop-selection-shade crop-selection-shade-start" data-crop-shade="start" aria-hidden="true"></div>
				<div class="crop-selection-shade crop-selection-shade-end" data-crop-shade="end" aria-hidden="true"></div>
				<div class="crop-marker crop-marker-start" data-crop-marker="start">
					<button class="crop-marker-line" type="button" role="slider" aria-label="Begin van het fragment" aria-valuemin="0" aria-valuenow="0" tabindex="0"></button>
					<input class="crop-marker-time crop-marker-time-start" type="text" inputmode="decimal" autocomplete="off" placeholder="00:00.00" pattern="[0-9]{2,}:[0-5][0-9]\.[0-9]{2}" aria-label="Begintijd in minuten, seconden en honderdsten" aria-description="Gebruik MM:SS.uu, bijvoorbeeld 01:23.45." data-crop-marker-time="start" data-crop-time="start" value="00:00.00">
				</div>
				<div class="crop-marker crop-marker-end" data-crop-marker="end">
					<button class="crop-marker-line" type="button" role="slider" aria-label="Einde van het fragment" aria-valuemin="0" aria-valuenow="0" tabindex="0"></button>
					<input class="crop-marker-time crop-marker-time-end" type="text" inputmode="decimal" autocomplete="off" placeholder="00:00.00" pattern="[0-9]{2,}:[0-5][0-9]\.[0-9]{2}" aria-label="Eindtijd in minuten, seconden en honderdsten" aria-description="Gebruik MM:SS.uu, bijvoorbeeld 01:23.45." data-crop-marker-time="end" data-crop-time="end" value="00:00.00">
				</div>
				<div class="crop-marker crop-marker-playhead" data-crop-marker="playhead">
					<button class="crop-marker-line" type="button" role="slider" aria-label="Afspeelpositie" aria-valuemin="0" aria-valuenow="0" tabindex="0"></button>
					<span class="crop-marker-time crop-marker-time-playhead" data-crop-marker-time="playhead">00:00.00</span>
				</div>
			</div>
		</div>
		<div class="crop-context-menu" data-crop-context-menu role="menu" aria-label="Crop vanaf afspeelpositie" hidden>
			<button type="button" role="menuitem" data-crop-context-action="start">Crop vanaf hier</button>
			<button type="button" role="menuitem" data-crop-context-action="end">Crop tot hier</button>
		</div>

		<div class="crop-navigator" data-crop-navigator role="group" aria-label="Audio-navigator">
			<canvas class="crop-navigator-waveform" data-crop-navigator-waveform aria-hidden="true"></canvas>
			<div class="crop-navigator-shade crop-navigator-shade-start" data-crop-navigator-shade="start" aria-hidden="true"></div>
			<div class="crop-navigator-shade crop-navigator-shade-end" data-crop-navigator-shade="end" aria-hidden="true"></div>
			<div class="crop-navigator-marker" data-crop-navigator-marker="start" aria-hidden="true"></div>
			<div class="crop-navigator-marker" data-crop-navigator-marker="end" aria-hidden="true"></div>
			<div class="crop-navigator-playhead" data-crop-navigator-playhead aria-hidden="true"></div>
			<div
				class="crop-navigator-frame"
				data-crop-navigator-frame
				tabindex="0"
				role="group"
				aria-label="Zichtbaar audiogebied. Gebruik de pijltjestoetsen om te navigeren en plus of min om te zoomen."
				aria-describedby="crop-navigator-help"
			>
				<button class="crop-navigator-handle crop-navigator-handle-start" type="button" data-crop-navigator-handle="start" aria-label="Begin van het zichtbare gebied verslepen om te zoomen"></button>
				<button class="crop-navigator-handle crop-navigator-handle-end" type="button" data-crop-navigator-handle="end" aria-label="Einde van het zichtbare gebied verslepen om te zoomen"></button>
			</div>
		</div>

		<p class="crop-live-status" data-crop-status aria-live="polite"></p>
		<div class="crop-actions">
			<button class="secondary-button" type="button" data-crop-change>Ander bestand kiezen</button>
			<div class="crop-export-actions">
				<button class="secondary-button" type="button" data-crop-export-data disabled>
					<i class="fas fa-download" aria-hidden="true"></i>
					Gecropt MP3 met gegevens
				</button>
				<button class="primary-button" type="button" data-crop-export-audio disabled>
					<i class="fas fa-download" aria-hidden="true"></i>
					Gecropt audio-only MP3
				</button>
			</div>
		</div>
		<p class="upload-note">De originele audio blijft ongewijzigd. Exporteren gebeurt lokaal in je browser.</p>
		<audio data-crop-audio preload="metadata" hidden></audio>
	</section>
@endsection

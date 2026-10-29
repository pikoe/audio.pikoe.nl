@extends('layout.master')

@section('title', 'Convert tool')

@section('content')
	<section class="page-intro">
		<h1>Convert tool</h1>
		<p>Kies een audiobestand, stel het gewenste formaat en de bestandsnaam in en download de conversie.</p>
	</section>

	<div data-audio-converter>
		<section class="upload-panel glass-panel" aria-labelledby="convert-upload-heading">
			<h2 id="convert-upload-heading">Kies een audiobestand</h2>
			<div class="upload-form" data-audio-upload>
				<label class="dropzone" for="convert-file" data-dropzone>
					<span class="dropzone-icon" aria-hidden="true">♫</span>
					<span class="dropzone-title">Sleep je bestand hierheen</span>
					<span class="dropzone-description">Sleep een audiobestand hierheen of blader op je apparaat.</span>
					<span class="dropzone-browse">Bestand kiezen</span>
					<input
						class="file-input"
						id="convert-file"
						name="audio"
						type="file"
						accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac"
						data-file-input
						aria-describedby="convert-file-status"
					>
				</label>
				<p class="file-status" id="convert-file-status" data-file-status aria-live="polite">Nog geen bestand gekozen.</p>
				<p class="upload-note">Je bestand wordt lokaal op je apparaat verwerkt en niet geüpload.</p>
			</div>
		</section>

		<section class="capture-export glass-panel convert-export-panel" data-convert-export hidden aria-labelledby="convert-export-heading">
			<h2 id="convert-export-heading">Conversie downloaden</h2>
			<div class="capture-export-fields">
				<div class="capture-field">
					<label for="convert-format">Bestandsformaat</label>
					<select class="capture-select" id="convert-format" data-convert-format>
						<option value="mp3" selected>MP3 (aanbevolen)</option>
						<option value="wav">WAV</option>
					</select>
				</div>
				<div class="capture-field capture-filename-field">
					<label for="convert-filename">Bestandsnaam</label>
					<input class="capture-select" id="convert-filename" type="text" autocomplete="off" data-convert-filename>
				</div>
				<button class="primary-button capture-export-button" type="button" data-convert-export-button disabled>
					<i class="fas fa-download" aria-hidden="true"></i>
					Download geconverteerd bestand
				</button>
			</div>
			<p class="upload-note">MP3 en WAV worden lokaal in je browser gemaakt. Andere formaten zijn beschikbaar als deze browser ze ondersteunt.</p>
			<p class="file-status" data-convert-status role="status" aria-live="polite">Kies een audiobestand om te converteren.</p>
			<button class="secondary-button" type="button" data-crop-change>Ander bestand kiezen</button>
		</section>
	</div>
@endsection

@extends('layout.master')

@section('title', 'MP3 label tool')

@section('content')
	<section class="page-intro">
		<h1>MP3 label tool</h1>
		<p>Pas de metadata van je MP3-bestand aan en download daarna de aangepaste versie.</p>
	</section>

	<section class="upload-panel glass-panel" data-mp3-label-upload aria-labelledby="mp3-label-upload-heading">
		<h2 id="mp3-label-upload-heading">Kies een MP3-bestand</h2>
		<label class="dropzone" for="mp3-label-file" data-mp3-dropzone>
			<span class="dropzone-icon" aria-hidden="true">♫</span>
			<span class="dropzone-title">Sleep je MP3 hierheen</span>
			<span class="dropzone-description">Of blader op je apparaat om een bestand te kiezen.</span>
			<span class="dropzone-browse">Bestand kiezen</span>
			<input
				class="file-input"
				id="mp3-label-file"
				type="file"
				accept=".mp3,audio/mpeg"
				data-mp3-file-input
				aria-describedby="mp3-label-file-status"
			>
		</label>
		<p class="file-status" id="mp3-label-file-status" data-mp3-file-status aria-live="polite">Nog geen bestand gekozen.</p>
		<p class="upload-note">Je bestand wordt lokaal op je apparaat verwerkt en niet geüpload.</p>
	</section>

	<section class="upload-panel glass-panel metadata-panel" data-mp3-label-editor aria-labelledby="mp3-label-editor-heading" hidden>
		<h2 id="mp3-label-editor-heading">Embedded file info aanpassen</h2>
		<p class="selected-audio" data-selected-audio></p>

		<div class="metadata-grid">
			<div class="metadata-field">
				<label for="mp3-title">Titel</label>
				<input id="mp3-title" name="title" type="text" autocomplete="off" data-metadata-field>
			</div>
			<div class="metadata-field">
				<label for="mp3-artist">Artiest</label>
				<input id="mp3-artist" name="artist" type="text" autocomplete="off" data-metadata-field>
			</div>
			<div class="metadata-field">
				<label for="mp3-album">Album</label>
				<input id="mp3-album" name="album" type="text" autocomplete="off" data-metadata-field>
			</div>
			<div class="metadata-field">
				<label for="mp3-genre">Genre</label>
				<input id="mp3-genre" name="genre" type="text" autocomplete="off" data-metadata-field>
			</div>
			<div class="metadata-field">
				<label for="mp3-date">Jaar / datum</label>
				<input id="mp3-date" name="date" type="text" inputmode="numeric" placeholder="Bijv. 2025 of 2025-10-31" autocomplete="off" data-metadata-field>
			</div>
			<div class="metadata-field">
				<label for="mp3-composer">Componist / tekstschrijver</label>
				<input id="mp3-composer" name="composer" type="text" autocomplete="off" data-metadata-field>
			</div>
			<div class="metadata-field metadata-field-wide">
				<label for="mp3-comment">Commentaar</label>
				<textarea id="mp3-comment" name="comment" rows="3" data-metadata-field></textarea>
			</div>
			<div class="metadata-field metadata-field-wide">
				<label for="mp3-lyrics">Songtekst</label>
				<textarea id="mp3-lyrics" name="lyrics" rows="6" data-metadata-field></textarea>
			</div>
			<div class="metadata-field metadata-field-wide">
				<label for="mp3-cover-file">Coverafbeelding (JPG of PNG)</label>
				<label class="cover-dropzone" for="mp3-cover-file" data-cover-dropzone>
					<img class="cover-preview" data-cover-preview alt="Voorbeeld van de coverafbeelding" hidden>
					<span data-cover-title>Sleep een JPG- of PNG-afbeelding hierheen of kies een bestand.</span>
					<input
						class="file-input"
						id="mp3-cover-file"
						type="file"
						accept="image/jpeg,image/png,.jpg,.jpeg,.png"
						data-cover-file-input
						aria-describedby="mp3-cover-file-status"
					>
				</label>
				<p class="file-status" id="mp3-cover-file-status" data-cover-file-status aria-live="polite">Geen nieuwe cover gekozen.</p>
			</div>
		</div>

		<p class="label-status" data-label-status aria-live="polite"></p>
		<div class="metadata-actions">
			<button class="secondary-button" type="button" data-change-audio>Ander MP3-bestand kiezen</button>
			<button class="primary-button" type="button" data-save-label disabled>MP3 met labels downloaden</button>
		</div>
		<p class="upload-note">De originele MP3 blijft ongewijzigd; je downloadt een nieuw bestand.</p>
	</section>
@endsection

<section class="upload-panel glass-panel" aria-labelledby="{{ $tool }}-upload-heading">
	<h2 id="{{ $tool }}-upload-heading">{{ $heading }}</h2>
	<div class="upload-form" data-audio-upload>
		<label class="dropzone" for="{{ $tool }}-file" data-dropzone>
			<span class="dropzone-icon" aria-hidden="true">♫</span>
			<span class="dropzone-title">Sleep je bestand hierheen</span>
			<span class="dropzone-description">{{ $description }}</span>
			<span class="dropzone-browse">Bestand kiezen</span>
			<input
				class="file-input"
				id="{{ $tool }}-file"
				name="audio"
				type="file"
				accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac"
				data-file-input
				aria-describedby="{{ $tool }}-file-status"
			>
		</label>
		<p class="file-status" id="{{ $tool }}-file-status" data-file-status aria-live="polite">Nog geen bestand gekozen.</p>
		<p class="upload-note">Bestanden worden nog niet geüpload of verwerkt.</p>
	</div>
</section>

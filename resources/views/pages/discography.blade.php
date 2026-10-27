@extends('layout.master')

@section('title', 'Discografie')

@section('content')
	<section class="page-intro">
		<h1>Discografie</h1>
		<p>Luister naar de fragmenten en ontdek de geluiden uit onze collectie.</p>
	</section>

	@if ($tracks->isNotEmpty())
		<section class="track-grid" aria-label="Nummers">
			@foreach ($tracks as $index => $track)
				<article
					class="track-card glass-panel"
					data-discography-track
					data-track-url="{{ $track['url'] }}"
					data-track-filename="{{ $track['filename'] }}"
					tabindex="0"
					role="group"
					aria-label="Nummer afspelen: {{ $track['title'] }}"
				>
				<div class="track-thumbnail">
					<img data-track-cover alt="" hidden>
					<i class="fas fa-music" aria-hidden="true"></i>
				</div>
				<div class="track-details">
					<h2 data-track-title>{{ $track['title'] }}</h2>
					<p class="track-artist" data-track-artist>Artiest wordt geladen...</p>
					<div class="track-actions">
						<span class="track-time" data-track-time aria-label="Afspeeltijd">00:00 / 00:00</span>
						<div class="track-action-buttons">
							<button class="track-play" type="button" data-track-play aria-label="Speel {{ $track['title'] }}" aria-pressed="false">
								<i class="fas fa-play" aria-hidden="true"></i>
							</button>
							<button class="track-download" type="button" data-track-download disabled aria-label="Download {{ $track['filename'] }}">
								<i class="fas fa-download" aria-hidden="true"></i>
							</button>
						</div>
					</div>
				</div>
				<canvas class="track-waveform" data-track-waveform aria-hidden="true"></canvas>
				<audio preload="none" aria-hidden="true"></audio>
				</article>
			@endforeach
		</section>
	@else
		<p class="empty-state">Er staan nog geen MP3-bestanden in de map audio.</p>
	@endif
@endsection

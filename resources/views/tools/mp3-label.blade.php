@extends('layout.master')

@section('title', 'MP3 label tool')

@section('content')
	<section class="page-intro">
		<h1>MP3 label tool</h1>
		<p>Voeg straks eenvoudig labels en metadata toe aan je MP3-bestand.</p>
	</section>

	@include('tools.upload-form', [
		'tool' => 'mp3-label',
		'heading' => 'Kies een MP3-bestand',
		'description' => 'Sleep een audiobestand hierheen of blader op je apparaat.',
	])
@endsection

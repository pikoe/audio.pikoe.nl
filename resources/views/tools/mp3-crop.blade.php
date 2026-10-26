@extends('layout.master')

@section('title', 'MP3 crop tool')

@section('content')
	<section class="page-intro">
		<h1>MP3 crop tool</h1>
		<p>Selecteer straks het fragment dat je wilt behouden.</p>
	</section>

	@include('tools.upload-form', [
		'tool' => 'mp3-crop',
		'heading' => 'Kies een audiobestand',
		'description' => 'Sleep een audiobestand hierheen of blader op je apparaat.',
	])
@endsection

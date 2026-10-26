@extends('layout.master')

@section('title', 'Convert tool')

@section('content')
	<section class="page-intro">
		<h1>Convert tool</h1>
		<p>Zet straks je audiobestand om naar een ander bestandsformaat.</p>
	</section>

	@include('tools.upload-form', [
		'tool' => 'convert',
		'heading' => 'Kies een audiobestand',
		'description' => 'Sleep een audiobestand hierheen of blader op je apparaat.',
	])
@endsection

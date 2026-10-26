@extends('layout.master')

@section('title', 'Discografie')

@section('content')
	<section class="page-intro">
		<h1>Discografie</h1>
		<p>Luister naar de fragmenten en ontdek de geluiden uit onze collectie.</p>
	</section>

	<section class="track-grid" aria-label="Audiofragmenten">
		@foreach (range(1, 4) as $number)
			<article class="track-card glass-panel">
				<div class="track-thumbnail" aria-hidden="true"><i class="fas fa-music"></i></div>
				<div class="track-details">
					<p class="track-number">Fragment {{ sprintf('%02d', $number) }}</p>
					<h2>Audiofragment {{ $number }}</h2>
					<audio controls preload="none" aria-label="Audiofragment {{ $number }}"></audio>
				</div>
			</article>
		@endforeach
	</section>
@endsection

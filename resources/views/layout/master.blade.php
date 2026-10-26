<!doctype html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<meta name="theme-color" content="#ffffff">
	<title>@yield('title', 'Audio tools') | {{ config('app.name', 'Audio.pikoe.nl') }}</title>
	<link rel="apple-touch-icon" sizes="180x180" href="{{ asset('apple-touch-icon.png') }}">
	<link rel="icon" type="image/png" sizes="32x32" href="{{ asset('favicon-32x32.png') }}">
	<link rel="icon" type="image/png" sizes="16x16" href="{{ asset('favicon-16x16.png') }}">
	<link rel="manifest" href="{{ asset('site.webmanifest') }}">
	<link rel="mask-icon" href="{{ asset('safari-pinned-tab.svg') }}" color="#ffffff">
	<link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.15.4/css/all.css" integrity="sha512-1ycn6IcaQQ40/MKBW2W4Rhis/DbILU74C1vSrLJxCq57o941Ym01SwNsOMqvEBFlcgUa6xLiPY/NS5R+E6ztJQ==" crossorigin="anonymous">
	<link rel="stylesheet" href="{{ asset('css/app.css') }}">
	<script src="{{ asset('js/app.js') }}" defer></script>
</head>
<body>
	<div class="site-shell">
		<header class="site-header glass-panel">
			<a class="site-brand" href="{{ route('home') }}"><img src="{{ asset('img/pikoe.svg') }}" alt="Audiostudio logo" class="site-brand-icon"> Audio<span>studio</span></a>
			<button class="menu-toggle" type="button" aria-expanded="false" aria-controls="primary-navigation" aria-label="Menu openen">
				<span></span>
				<span></span>
				<span></span>
			</button>
			<nav class="primary-navigation" id="primary-navigation" aria-label="Hoofdnavigatie">
				<a href="{{ route('home') }}" @class(['is-active' => request()->routeIs('home')]) @if(request()->routeIs('home')) aria-current="page" @endif>Discografie</a>
				<a href="{{ route('mp3-label') }}" @class(['is-active' => request()->routeIs('mp3-label')]) @if(request()->routeIs('mp3-label')) aria-current="page" @endif>MP3 label tool</a>
				<a href="{{ route('mp3-crop') }}" @class(['is-active' => request()->routeIs('mp3-crop')]) @if(request()->routeIs('mp3-crop')) aria-current="page" @endif>MP3 crop tool</a>
				<a href="{{ route('convert') }}" @class(['is-active' => request()->routeIs('convert')]) @if(request()->routeIs('convert')) aria-current="page" @endif>Convert tool</a>
			</nav>
		</header>

		<main class="page-content">
			@yield('content')
		</main>

		<footer class="site-footer">
			&copy; Dennis Veeneman {{ date('Y') }}
			<a href="mailto:dennis_veeneman@hotmail.com" aria-label="E-mail"><i class="fas fa-envelope-square" aria-hidden="true"></i></a>
			<a href="tel:+31630077100" aria-label="Bellen"><i class="fas fa-phone-square" aria-hidden="true"></i></a>
			<a href="https://github.com/pikoe" target="_blank" rel="noopener noreferrer" aria-label="GitHub"><i class="fab fa-github-square" aria-hidden="true"></i></a>
			<a href="https://www.facebook.com/pikoe.nl" target="_blank" rel="noopener noreferrer" aria-label="Facebook"><i class="fab fa-facebook-square" aria-hidden="true"></i></a>
			<a href="https://www.instagram.com/dennis_veeneman" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><i class="fab fa-instagram-square" aria-hidden="true"></i></a>
			<a href="https://www.linkedin.com/in/dennis-veeneman-34917a34/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn"><i class="fab fa-linkedin" aria-hidden="true"></i></a>
		</footer>
	</div>
</body>
</html>

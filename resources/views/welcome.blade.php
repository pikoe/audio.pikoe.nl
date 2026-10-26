<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <meta name="viewport" content="width=device-width, initial-scale=1">

        <title>{{ config('app.name', 'Laravel') }}</title>

        
		<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
		<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
		<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
		<link rel="manifest" href="/site.webmanifest">
		<link rel="mask-icon" href="/safari-pinned-tab.svg" color="#ffffff">
		<meta name="msapplication-TileColor" content="#ffffff">
		<meta name="theme-color" content="#ffffff">
		<style>
			html,
			body {
				margin: 0;
				padding: 0;
				min-height: 100%;
				font-family: Helvetica, Arial, sans-serif;
				-ms-text-size-adjust: 100%;
				-webkit-text-size-adjust: 100%;
				-webkit-tap-highlight-color: rgba(0, 0, 0, 0);

				font-size: 14px;
				line-height: 1.42857143;

				color: #333333;
				background: url(img/watercolor.png) center bottom / cover no-repeat #fff fixed;
			}
			body > div {
				
			}
			footer {
				position: fixed;
				bottom: 0;
				left: 0;
				right: 0;
				padding: 10px;
				text-align: center;
			}
			footer a {
				color: #333333;
				text-decoration: none;
			}
		</style>
        <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.15.4/css/all.css" integrity="sha512-1ycn6IcaQQ40/MKBW2W4Rhis/DbILU74C1vSrLJxCq57o941Ym01SwNsOMqvEBFlcgUa6xLiPY/NS5R+E6ztJQ==" crossorigin="anonymous">
	</head>
    <body>
		<div>
            
		</div>
        <footer>
            &copy; Dennis Veeneman <?= date('Y') ?>
            
            <a href="mailto:dennis_veeneman@hotmail.com"><i class="fas fa-envelope-square"></i>
            <a href="tel:+316-30077100"><i class="fas fa-phone-square"></i></i>
            <a href="https://github.com/pikoe" target="_blank"><i class="fab fa-github-square"></i></a>
            <a href="https://www.facebook.com/pikoe.nl" target="_blank"><i class="fab fa-facebook-square"></i></a>
            <a href="https://www.instagram.com/dennis_veeneman" target="_blank"><i class="fab fa-instagram-square"></i></a>
            <a href="https://www.linkedin.com/in/dennis-veeneman-34917a34/" target="_blank"><i class="fab fa-linkedin"></i></a>
        </footer>
    </body>
</html>

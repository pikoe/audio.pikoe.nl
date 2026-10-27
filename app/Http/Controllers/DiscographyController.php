<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\File;

class DiscographyController extends Controller
{
    public function __invoke()
    {
        $audioDirectory = public_path('audio');
        $tracks = File::isDirectory($audioDirectory)
            ? collect(File::files($audioDirectory))
                ->filter(fn ($file) => strtolower($file->getExtension()) === 'mp3')
                ->map(fn ($file) => [
                    'filename' => $file->getFilename(),
                    'title' => pathinfo($file->getFilename(), PATHINFO_FILENAME),
                    'url' => asset('audio/'.rawurlencode($file->getFilename())),
                ])
                ->sortBy('filename', SORT_NATURAL | SORT_FLAG_CASE)
                ->values()
            : collect();

        return view('pages.discography', ['tracks' => $tracks]);
    }
}

<?php

use App\Http\Controllers\DiscographyController;
use Illuminate\Support\Facades\Route;

Route::get('/', DiscographyController::class)->name('home');
Route::view('/mp3-label', 'tools.mp3-label')->name('mp3-label');
Route::view('/mp3-crop', 'tools.mp3-crop')->name('mp3-crop');
Route::view('/convert', 'tools.convert')->name('convert');
Route::view('/capture-audio', 'tools.capture-audio')->name('capture-audio');

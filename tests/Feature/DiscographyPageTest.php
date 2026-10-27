<?php

namespace Tests\Feature;

use Tests\TestCase;

class DiscographyPageTest extends TestCase
{
    public function test_homepage_lists_mp3_files_from_the_public_audio_directory(): void
    {
        $response = $this->get('/');

        $response
            ->assertOk()
            ->assertViewIs('pages.discography')
            ->assertViewHas('tracks', function ($tracks): bool {
                $mp3Files = glob(public_path('audio/*.mp3')) ?: [];

                return $tracks->count() === count($mp3Files)
                    && $tracks->isNotEmpty()
                    && $tracks->every(fn (array $track): bool => str_ends_with(strtolower($track['filename']), '.mp3'));
            })
            ->assertSee('data-discography-track', false)
            ->assertSee('data-track-waveform', false)
            ->assertSee('00:00 / 00:00')
            ->assertDontSee('Audiofragment 1');
    }
}

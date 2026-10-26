<?php

namespace Tests\Feature;

use Tests\TestCase;

class CaptureAudioPageTest extends TestCase
{
    public function test_capture_audio_placeholder_is_available_and_linked_in_navigation(): void
    {
        $response = $this->get('/capture-audio');

        $response
            ->assertOk()
            ->assertViewIs('tools.capture-audio')
            ->assertSee('Audio opnemen komt binnenkort.')
            ->assertSee('href="' . route('capture-audio') . '"', false)
            ->assertSee('aria-current="page"', false);
    }
}

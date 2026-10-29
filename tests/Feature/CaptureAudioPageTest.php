<?php

namespace Tests\Feature;

use Tests\TestCase;

class CaptureAudioPageTest extends TestCase
{
    public function test_capture_audio_tool_is_available_with_recording_and_export_controls(): void
    {
        $response = $this->get('/capture-audio');

        $response
            ->assertOk()
            ->assertViewIs('tools.capture-audio')
            ->assertSee('data-capture-audio', false)
            ->assertSee('data-capture-source', false)
            ->assertSee('data-capture-source-choice="microphone"', false)
            ->assertSee('data-capture-source-choice="screen"', false)
            ->assertSee('data-capture-settings-open', false)
            ->assertSee('data-capture-settings-modal', false)
            ->assertSee('data-capture-device-list', false)
            ->assertDontSee('data-capture-device-choice', false)
            ->assertSee('data-capture-toggle', false)
            ->assertSee('data-capture-waveform', false)
            ->assertSee('data-capture-end-marker', false)
            ->assertSee('data-capture-play', false)
            ->assertSee('data-capture-playhead', false)
            ->assertSee('data-capture-navigator-playhead', false)
            ->assertSee('data-capture-navigator', false)
            ->assertSee('data-capture-format', false)
            ->assertSee('data-capture-filename', false)
            ->assertSee('data-capture-export-button', false)
            ->assertSee('data-capture-toggle disabled', false)
            ->assertDontSee('controls hidden', false)
            ->assertDontSee('Audio opnemen komt binnenkort.')
            ->assertSee('href="' . route('capture-audio') . '"', false)
            ->assertSee('aria-current="page"', false);
    }
}

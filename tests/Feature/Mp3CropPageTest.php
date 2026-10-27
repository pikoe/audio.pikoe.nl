<?php

namespace Tests\Feature;

use Tests\TestCase;

class Mp3CropPageTest extends TestCase
{
    public function test_mp3_crop_page_has_its_own_upload_form_and_editor_controls(): void
    {
        $response = $this->get('/mp3-crop');

        $response
            ->assertOk()
            ->assertViewIs('tools.mp3-crop')
            ->assertSee('data-mp3-crop-upload', false)
            ->assertSee('data-crop-file-input', false)
            ->assertSee('data-crop-editor', false)
            ->assertSee('data-crop-wave-viewport', false)
            ->assertSee('data-crop-marker="start"', false)
            ->assertSee('data-crop-marker="end"', false)
            ->assertSee('data-crop-marker="playhead"', false)
            ->assertSee('data-crop-marker-time="start"', false)
            ->assertSee('data-crop-marker-time="end"', false)
            ->assertDontSee('crop-time-fields', false)
            ->assertSee('Alt + scroll', false)
            ->assertSee('data-crop-export-data disabled', false)
            ->assertSee('data-crop-export-audio disabled', false)
            ->assertSee('Gebruik MM:SS.uu', false)
            ->assertDontSee('data-audio-upload', false);
    }
}
